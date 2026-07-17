export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationServiceInterface {
  getHistory(customerId: string): Promise<ChatMessage[]>;
  appendMessage(customerId: string, message: ChatMessage): Promise<void>;
}
 