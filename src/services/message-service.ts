import { inject, injectable } from "tsyringe";
import type { MessageRepositoryInterface } from "../repositories/interfaces/message-repository.interface.js";
import type { MessageServiceInterface, MessageSummary } from "./interfaces/message-service.interface.js";
import { TOKENS } from "../di/tokens.js";

@injectable()
export class MessageService implements MessageServiceInterface {
  constructor(@inject(TOKENS.MessageRepository) private readonly messageRepository: MessageRepositoryInterface) {}

  async listMessages(conversationId: string, userId: string): Promise<MessageSummary[]> {
    const messages = await this.messageRepository.findByConversationId(conversationId, userId);

    return messages.map((message) => ({
      id: message._id.toString(),
      conversationId: message.conversationId ? message.conversationId.toString() : null,
      userId: message.userId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }
}
