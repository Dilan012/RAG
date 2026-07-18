import { injectable } from "tsyringe";
import { Types } from "mongoose";
import { MessageModel, type MessageDocument } from "../models/message.js";
import type { CreateMessageInput, MessageRepositoryInterface } from "./interfaces/message-repository.interface.js";

@injectable()
export class MessageRepository implements MessageRepositoryInterface {
  async findByUserId(userId: string): Promise<MessageDocument[]> {
    return MessageModel.find({ userId }).sort({ createdAt: 1 }).lean();
  }

  async findByConversationId(conversationId: string, userId: string): Promise<MessageDocument[]> {
    return MessageModel.find({ conversationId, userId }).sort({ createdAt: 1 }).lean();
  }

  async create(input: CreateMessageInput): Promise<void> {
    await MessageModel.create({
      userId: input.userId,
      ...(input.conversationId ? { conversationId: new Types.ObjectId(input.conversationId) } : {}),
      role: input.role,
      content: input.content,
    });
  }
}
