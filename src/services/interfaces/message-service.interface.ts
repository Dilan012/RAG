export interface MessageSummary {
  id: string;
  conversationId: string | null;
  customerId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface MessageServiceInterface {
  listMessages(conversationId: string): Promise<MessageSummary[]>;
}
