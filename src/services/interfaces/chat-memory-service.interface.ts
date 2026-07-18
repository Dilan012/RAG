export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatMemoryServiceInterface {
  getHistory(userId: string, conversationId?: string): Promise<ChatMessage[]>;
  appendMessage(userId: string, message: ChatMessage, conversationId?: string): Promise<void>;
}
