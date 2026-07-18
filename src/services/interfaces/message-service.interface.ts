export interface MessageSummary {
  id: string;
  conversationId: string | null;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface MessageServiceInterface {
  listMessages(conversationId: string, userId: string): Promise<MessageSummary[]>;
}
