import type { BaseMessageLike } from "@langchain/core/messages";
import { inject, injectable } from "tsyringe";
import { tavily } from "@tavily/core"
import { ModelProvider, type SupportedModelName } from "./model-provider.js";
import type { ChatServiceInterface } from "./interfaces/chat-service.interface.js";
import type { ChatMemoryServiceInterface } from "./interfaces/chat-memory-service.interface.js";
import type { EmbeddingServiceInterface } from "./interfaces/embedding-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { appConfig } from "../config/app-config.js";

// The plain OpenAI-compatible shapes OpenRouter's REST API actually speaks — used only
// by chat()'s direct fetch() call below, as opposed to chatStream()'s LangChain
// BaseMessageLike/ChatOpenRouter path.
interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChatCompletionResponse {
  choices: { message: { content: string } }[];
}

// OpenAI-compatible tool/function-calling schema — passed as "tools" in the request
// body below. Not wired up to actually execute a tool call yet (the model may return
// a tool_calls entry instead of content; that response isn't handled here yet) — this
// is just the tool definition(s) sent along with the request for testing.
interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const OPENROUTER_TOOLS: OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information relevant to the user's question.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
];

@injectable()
export class ChatService implements ChatServiceInterface {
  constructor(
    @inject(TOKENS.ModelName) private readonly modelName: SupportedModelName,
    @inject(TOKENS.ChatMemoryService) private readonly conversationStore: ChatMemoryServiceInterface,
    @inject(TOKENS.EmbeddingService) private readonly embeddingService: EmbeddingServiceInterface,
    @inject(TOKENS.TavilyApiKey) private readonly tavilyApiKey: string,
    @inject(TOKENS.OpenRouterApiKey) private readonly openRouterApiKey: string
  ) {}

  // Persists the user's message before streaming starts (rather than after, like the
  // old invoke()-based chat() used to) — with a streaming response there's no single
  // "success" point to hang that write off of, so it happens as soon as the turn is
  // going ahead. The assistant's reply is only persisted once the model has finished
  // streaming, from the full accumulated text — never partial content.
  async *chatStream(
    userId: string,
    userMessage: string,
    conversationId?: string,
    systemPrompt?: string
  ): AsyncGenerator<string> {
    const model = ModelProvider.getModel(this.modelName);
    const history = await this.conversationStore.getHistory(userId, conversationId);

    const messages: BaseMessageLike[] = [{ role: "system", content: appConfig.chat.baseSystemPrompt }];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    const knowledgeBaseContext = await this.buildKnowledgeBaseContext(userId, userMessage);
    if (knowledgeBaseContext) {
      messages.push({ role: "system", content: knowledgeBaseContext });
    }

    for (const message of history) {
      messages.push({ role: message.role, content: message.content });
    }
    messages.push({ role: "user", content: userMessage });

    await this.conversationStore.appendMessage(userId, { role: "user", content: userMessage }, conversationId);

    const stream = await model.stream(messages);
    let fullReply = "";
    for await (const chunk of stream) {
      const piece = String(chunk.content);
      if (!piece) continue;
      fullReply += piece;
      yield piece;
    }

    await this.conversationStore.appendMessage(
      userId,
      { role: "assistant", content: fullReply },
      conversationId
    );
  }

  // A standalone, non-streaming implementation (model.invoke() instead of chatStream())
  // rather than draining the stream internally — kept independent on purpose so it can
  // be modified/tested on its own without touching the streaming path.
  async chat(
    userId: string,
    userMessage: string,
    conversationId?: string,
    systemPrompt?: string
  ): Promise<string> {
    const history = await this.conversationStore.getHistory(userId, conversationId);
    // const searchResult = this.searchTool(userMessage)
    // return (await searchResult).results.map(i => i.content).join("")


    const messages: OpenRouterMessage[] = [{ role: "system", content: appConfig.chat.baseSystemPrompt }];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    const knowledgeBaseContext = await this.buildKnowledgeBaseContext(userId, userMessage);
    if (knowledgeBaseContext) {
      messages.push({ role: "system", content: knowledgeBaseContext });
    }

    for (const message of history) {
      messages.push({ role: message.role, content: message.content });
    }
    messages.push({ role: "user", content: userMessage });

    const replyContent = await this.callOpenRouter(messages);

    await this.conversationStore.appendMessage(userId, { role: "user", content: userMessage }, conversationId);
    await this.conversationStore.appendMessage(
      userId,
      { role: "assistant", content: replyContent },
      conversationId
    );

    return replyContent;
  }

  // Calls OpenRouter's chat completions endpoint directly over fetch — no LangChain
  // ChatModel/ModelProvider involved. Kept separate from chatStream()'s LangChain-based
  // path so the raw request/response shape here is fully visible and easy to tweak while
  // testing, without needing to go through LangChain's abstractions to see what's
  // actually being sent/received.
  private async callOpenRouter(messages: OpenRouterMessage[], tools: OpenRouterTool[] = OPENROUTER_TOOLS): Promise<string> {
    const response = await fetch(`${appConfig.embedding.openRouterBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openRouterApiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages,
        tools,
        temperature: 0,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OpenRouterChatCompletionResponse;
    console.log("OpenRouter response body:", JSON.stringify(data, null, 2));
    return data.choices[0]?.message.content ?? "";
  }

  private async buildKnowledgeBaseContext(userId: string, query: string): Promise<string | null> {
    const results = await this.embeddingService.similaritySearch(userId, query);
    if (results.length === 0) {
      return null;
    }

    const context = results.map((result) => result.content).join("\n\n---\n\n");
    return `Relevant information from the knowledge base:\n\n${context}`;
  }

  private async searchTool (query: string) {
    const tavilyClient = tavily({apiKey: this.tavilyApiKey})
    const response = await tavilyClient.search(query)
    console.log("tavily response----------------------", response)
    return response
  }
}
