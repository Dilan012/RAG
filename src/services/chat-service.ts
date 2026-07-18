import type { BaseMessageLike } from "@langchain/core/messages";
import { inject, injectable } from "tsyringe";
import { ModelProvider, type SupportedModelName } from "./model-provider.js";
import type { ChatServiceInterface } from "./interfaces/chat-service.interface.js";
import type { ChatMemoryServiceInterface } from "./interfaces/chat-memory-service.interface.js";
import { TOKENS } from "../di/tokens.js";

const BASE_SYSTEM_PROMPT =
  "You are the customer support assistant for a logistics company. You help users with " +
  "questions about shipments, deliveries, tracking, freight, warehousing, and related logistics " +
  "services. Only answer questions related to logistics and this company's services — if a user " +
  "asks about something unrelated, politely explain that you can only help with logistics-related " +
  "questions and steer the conversation back on topic.";

@injectable()
export class ChatService implements ChatServiceInterface {
  constructor(
    @inject(TOKENS.ModelName) private readonly modelName: SupportedModelName,
    @inject(TOKENS.ChatMemoryService) private readonly conversationStore: ChatMemoryServiceInterface
  ) {}

  async chat(
    userId: string,
    userMessage: string,
    conversationId?: string,
    systemPrompt?: string
  ): Promise<string> {
    const model = ModelProvider.getModel(this.modelName);
    const history = await this.conversationStore.getHistory(userId, conversationId);

    const messages: BaseMessageLike[] = [{ role: "system", content: BASE_SYSTEM_PROMPT }];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    for (const message of history) {
      messages.push({ role: message.role, content: message.content });
    }
    messages.push({ role: "user", content: userMessage });

    const response = await model.invoke(messages);

    const replyContent = String(response.content);

    await this.conversationStore.appendMessage(userId, { role: "user", content: userMessage }, conversationId);
    await this.conversationStore.appendMessage(
      userId,
      { role: "assistant", content: replyContent },
      conversationId
    );

    return replyContent;
  }
}
