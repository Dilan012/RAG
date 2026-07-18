import type { MessageDocument } from "../../models/message.js";

export interface MessageRepositoryInterface {
  findByCustomerId(customerId: string): Promise<MessageDocument[]>;
  findByConversationId(conversationId: string): Promise<MessageDocument[]>;
  create(document: Omit<MessageDocument, "_id" | "createdAt">): Promise<void>;
}
