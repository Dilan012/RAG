import { inject, injectable } from "tsyringe";
import type { ChatMessage, ConversationServiceInterface } from "./interfaces/conversation-service.interface.js";
import type { MessageRepositoryInterface } from "../repositories/interfaces/message-repository.interface.js";
import { TOKENS } from "../di/tokens.js";

@injectable()
export class ConversationService implements ConversationServiceInterface {
  constructor(
    @inject(TOKENS.MessageRepository) private readonly messageRepository: MessageRepositoryInterface
  ) {}

  async getHistory(userId: string, conversationId?: string): Promise<ChatMessage[]> {
    const messages = conversationId
      ? await this.messageRepository.findByConversationId(conversationId, userId)
      : await this.messageRepository.findByUserId(userId);

    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  async appendMessage(userId: string, message: ChatMessage, conversationId?: string): Promise<void> {
    await this.messageRepository.create({
      userId,
      ...(conversationId ? { conversationId } : {}),
      role: message.role,
      content: message.content,
    });
  }
}
