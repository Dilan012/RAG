import type { ChatMessage } from "./chat-memory-service.interface.js";

export interface SummaryRecord {
  id: string;
  conversationId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface SummaryServiceInterface {
  summarizeConversation(conversationId: string, userId: string, messages: ChatMessage[]): Promise<SummaryRecord>;
}
