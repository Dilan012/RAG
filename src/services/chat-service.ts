import type { BaseMessageLike } from "@langchain/core/messages";
import { ModelProvider, type SupportedModelName } from "./model-provider.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationStore {
  getHistory(customerId: string): Promise<ChatMessage[]>;
  appendMessage(customerId: string, message: ChatMessage): Promise<void>;
}

export class ChatService {
  constructor(
    private readonly modelName: SupportedModelName,
    private readonly conversationStore: ConversationStore
  ) {}

  async chat(
    customerId: string,
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const model = ModelProvider.getModel(this.modelName);
    const history = await this.conversationStore.getHistory(customerId);

    const messages: BaseMessageLike[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    for (const message of history) {
      messages.push({ role: message.role, content: message.content });
    }
    messages.push({ role: "user", content: userMessage });

    const response = await model.invoke(messages);
    const replyContent = String(response.content);

    await this.conversationStore.appendMessage(customerId, {
      role: "user",
      content: userMessage,
    });
    await this.conversationStore.appendMessage(customerId, {
      role: "assistant",
      content: replyContent,
    });

    return replyContent;
  }
}
