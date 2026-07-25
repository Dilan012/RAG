import type { BaseMessageLike } from "@langchain/core/messages";
import { inject, injectable } from "tsyringe";
import { ModelProvider, type SupportedModelName } from "./model-provider.js";
import type { ChatServiceInterface } from "./interfaces/chat-service.interface.js";
import type { ChatMemoryServiceInterface } from "./interfaces/chat-memory-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { appConfig } from "../config/app-config.js";

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

    const messages: BaseMessageLike[] = [{ role: "system", content: appConfig.chat.baseSystemPrompt }];
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
