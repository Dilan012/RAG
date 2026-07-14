import { MessageModel, type MessageDocument } from "../models/message.js";
import type { MessageRepositoryInterface } from "./interfaces/message-repository.interface.js";

export class MessageRepository implements MessageRepositoryInterface {
  async findByCustomerId(customerId: string): Promise<MessageDocument[]> {
    return MessageModel.find({ customerId }).sort({ createdAt: 1 }).lean();
  }

  async create(document: Omit<MessageDocument, "createdAt">): Promise<void> {
    await MessageModel.create(document);
  }
}
