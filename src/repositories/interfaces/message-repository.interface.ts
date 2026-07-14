import type { MessageDocument } from "../../models/message.js";

export interface MessageRepositoryInterface {
  findByCustomerId(customerId: string): Promise<MessageDocument[]>;
  create(document: Omit<MessageDocument, "createdAt">): Promise<void>;
}
