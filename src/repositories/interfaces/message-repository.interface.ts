import type { MessageDocument } from "../../models/message.js";

export interface CreateMessageInput {
  userId: string;
  conversationId?: string;
  role: MessageDocument["role"];
  content: string;
}

export interface MessageRepositoryInterface {
  findByUserId(userId: string): Promise<MessageDocument[]>;
  findByConversationId(conversationId: string, userId: string): Promise<MessageDocument[]>;
  create(input: CreateMessageInput): Promise<void>;
}
