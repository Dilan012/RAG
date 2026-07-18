export interface ConversationSummary {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConversationServiceInterface {
  createConversation(userId: string, name: string): Promise<ConversationSummary>;
  listConversations(userId: string): Promise<ConversationSummary[]>;
  getConversation(id: string, userId: string): Promise<ConversationSummary>;
  renameConversation(id: string, userId: string, name: string): Promise<ConversationSummary>;
  deleteConversation(id: string, userId: string): Promise<void>;
}
