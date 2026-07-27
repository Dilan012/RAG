import type { BaseMessageLike } from "@langchain/core/messages";
import { inject, injectable } from "tsyringe";
import { ModelProvider, type SupportedModelName } from "./model-provider.js";
import type { ChatServiceInterface } from "./interfaces/chat-service.interface.js";
import type { ChatMemoryServiceInterface } from "./interfaces/chat-memory-service.interface.js";
import type { EmbeddingServiceInterface } from "./interfaces/embedding-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { appConfig } from "../config/app-config.js";

@injectable()
export class ChatService implements ChatServiceInterface {
  constructor(
    @inject(TOKENS.ModelName) private readonly modelName: SupportedModelName,
    @inject(TOKENS.ChatMemoryService) private readonly conversationStore: ChatMemoryServiceInterface,
    @inject(TOKENS.EmbeddingService) private readonly embeddingService: EmbeddingServiceInterface
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

  private async buildKnowledgeBaseContext(userId: string, query: string): Promise<string | null> {
    const results = await this.embeddingService.similaritySearch(userId, query);
    if (results.length === 0) {
      return null;
    }

    const context = results.map((result) => result.content).join("\n\n---\n\n");
    return `Relevant information from the knowledge base:\n\n${context}`;
  }
}
