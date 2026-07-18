export interface ChatServiceInterface {
  chat(userId: string, userMessage: string, conversationId?: string, systemPrompt?: string): Promise<string>;
}
