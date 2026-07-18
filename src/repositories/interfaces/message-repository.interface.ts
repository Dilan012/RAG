import type { MessageDocument } from "../../models/message.js";

export interface CreateMessageInput {
  userId: string;
  conversationId?: string;
  role: MessageDocument["role"];
  content: string;
}

export interface MessageRepositoryInterface {
  findByUserId(userId: string): Promise<MessageDocument[]>;
  findByConversationId(conversationId: string, userId: string, limit?: number): Promise<MessageDocument[]>;
  /** Messages in the conversation created after `after` (or all of them, if omitted), oldest first. */
  findByConversationIdSince(conversationId: string, userId: string, after?: Date): Promise<MessageDocument[]>;
  /** Count of messages in the conversation created after `after` (or the total, if omitted). */
  countByConversationIdSince(conversationId: string, userId: string, after?: Date): Promise<number>;
  create(input: CreateMessageInput): Promise<void>;
}
