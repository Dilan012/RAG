import { MessageModel } from "../models/message.js";
import type { ChatMessage, ConversationStore } from "./chat-service.js";

export class ConversationService implements ConversationStore {
  async getHistory(customerId: string): Promise<ChatMessage[]> {
    const messages = await MessageModel.find({ customerId })
      .sort({ createdAt: 1 })
      .lean();

    return messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  async appendMessage(customerId: string, message: ChatMessage): Promise<void> {
    await MessageModel.create({
      customerId,
      role: message.role,
      content: message.content,
    });
  }
}
