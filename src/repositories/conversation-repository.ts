import { injectable } from "tsyringe";
import { Types } from "mongoose";
import { ConversationModel, type ConversationDocument } from "../models/conversation.js";
import type {
  ConversationRepositoryInterface,
  CreateConversationInput,
} from "./interfaces/conversation-repository.interface.js";

@injectable()
export class ConversationRepository implements ConversationRepositoryInterface {
  async create(input: CreateConversationInput): Promise<ConversationDocument> {
    const conversation = await ConversationModel.create({
      userId: new Types.ObjectId(input.userId),
      name: input.name,
    });
    return conversation.toObject();
  }

  async findById(id: string): Promise<ConversationDocument | null> {
    return ConversationModel.findById(id).lean();
  }

  async findByUserId(userId: string): Promise<ConversationDocument[]> {
    return ConversationModel.find({ userId }).sort({ updatedAt: -1 }).lean();
  }

  async updateName(id: string, name: string): Promise<ConversationDocument | null> {
    return ConversationModel.findByIdAndUpdate(id, { name }, { new: true }).lean();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await ConversationModel.findByIdAndDelete(id);
    return result !== null;
  }
}
