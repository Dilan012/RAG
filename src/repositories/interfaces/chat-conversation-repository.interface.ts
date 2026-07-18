import type { ChatConversationDocument } from "../../models/chat-conversation.js";

export interface CreateChatConversationInput {
  userId: string;
  name: string;
}

export interface ChatConversationRepositoryInterface {
  create(input: CreateChatConversationInput): Promise<ChatConversationDocument>;
  findById(id: string): Promise<ChatConversationDocument | null>;
  findByUserId(userId: string): Promise<ChatConversationDocument[]>;
  updateName(id: string, name: string): Promise<ChatConversationDocument | null>;
  deleteById(id: string): Promise<boolean>;
}
