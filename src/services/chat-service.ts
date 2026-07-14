import type { BaseMessageLike } from "@langchain/core/messages";
import { ModelProvider, type SupportedModelName } from "./model-provider.js";
import type { ChatServiceInterface } from "./interfaces/chat-service.interface.js";
import type { ConversationServiceInterface } from "./interfaces/conversation-service.interface.js";

export class ChatService implements ChatServiceInterface {
  constructor(
    private readonly modelName: SupportedModelName,
    private readonly conversationStore: ConversationServiceInterface
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
