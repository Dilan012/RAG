import type { ConversationDocument } from "../../models/conversation.js";

export interface CreateConversationInput {
  userId: string;
  name: string;
}

export interface ConversationRepositoryInterface {
  create(input: CreateConversationInput): Promise<ConversationDocument>;
  findById(id: string): Promise<ConversationDocument | null>;
  findByUserId(userId: string): Promise<ConversationDocument[]>;
  updateName(id: string, name: string): Promise<ConversationDocument | null>;
  deleteById(id: string): Promise<boolean>;
}
