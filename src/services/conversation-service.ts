import type { ChatMessage, ConversationServiceInterface } from "./interfaces/conversation-service.interface.js";
import type { MessageRepositoryInterface } from "../repositories/interfaces/message-repository.interface.js";

export class ConversationService implements ConversationServiceInterface {
  constructor(private readonly messageRepository: MessageRepositoryInterface) {}

  async getHistory(customerId: string): Promise<ChatMessage[]> {
    const messages = await this.messageRepository.findByCustomerId(customerId);

    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  async appendMessage(customerId: string, message: ChatMessage): Promise<void> {
    await this.messageRepository.create({
      customerId,
      role: message.role,
      content: message.content,
    });
  }
}
