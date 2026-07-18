export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationServiceInterface {
  getHistory(userId: string, conversationId?: string): Promise<ChatMessage[]>;
  appendMessage(userId: string, message: ChatMessage, conversationId?: string): Promise<void>;
}
