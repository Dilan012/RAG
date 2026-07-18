import { injectable } from "tsyringe";
import { Types } from "mongoose";
import { ChatConversationModel, type ChatConversationDocument } from "../models/chat-conversation.js";
import type {
  ChatConversationRepositoryInterface,
  CreateChatConversationInput,
} from "./interfaces/chat-conversation-repository.interface.js";

@injectable()
export class ChatConversationRepository implements ChatConversationRepositoryInterface {
  async create(input: CreateChatConversationInput): Promise<ChatConversationDocument> {
    const conversation = await ChatConversationModel.create({
      userId: new Types.ObjectId(input.userId),
      name: input.name,
    });
    return conversation.toObject();
  }

  async findById(id: string): Promise<ChatConversationDocument | null> {
    return ChatConversationModel.findById(id).lean();
  }

  async findByUserId(userId: string): Promise<ChatConversationDocument[]> {
    return ChatConversationModel.find({ userId }).sort({ updatedAt: -1 }).lean();
  }

  async updateName(id: string, name: string): Promise<ChatConversationDocument | null> {
    return ChatConversationModel.findByIdAndUpdate(id, { name }, { new: true }).lean();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await ChatConversationModel.findByIdAndDelete(id);
    return result !== null;
  }
}
