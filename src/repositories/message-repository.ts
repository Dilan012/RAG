import { injectable } from "tsyringe";
import { Types } from "mongoose";
import { MessageModel, type MessageDocument } from "../models/message.js";
import type { CreateMessageInput, MessageRepositoryInterface } from "./interfaces/message-repository.interface.js";
import { appConfig } from "../config/app-config.js";

function conversationSinceFilter(conversationId: string, userId: string, after?: Date) {
  return {
    conversationId,
    userId,
    ...(after ? { createdAt: { $gt: after } } : {}),
  };
}

@injectable()
export class MessageRepository implements MessageRepositoryInterface {
  async findByUserId(userId: string): Promise<MessageDocument[]> {
    return MessageModel.find({ userId }).sort({ createdAt: 1 }).lean();
  }

  async findByConversationId(
    conversationId: string,
    userId: string,
    limit: number = appConfig.memory.defaultMessageLimit
  ): Promise<MessageDocument[]> {
    // Fetch the most recent `limit` messages, then reverse back to chronological
    // order — sorting descending first is what lets .limit() keep the latest
    // messages instead of the oldest ones.
    const messages = await MessageModel.find({ conversationId, userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return messages.reverse();
  }

  async findByConversationIdSince(conversationId: string, userId: string, after?: Date): Promise<MessageDocument[]> {
    return MessageModel.find(conversationSinceFilter(conversationId, userId, after))
      .sort({ createdAt: 1 })
      .lean();
  }

  async countByConversationIdSince(conversationId: string, userId: string, after?: Date): Promise<number> {
    return MessageModel.countDocuments(conversationSinceFilter(conversationId, userId, after));
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
