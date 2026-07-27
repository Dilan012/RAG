export interface ChatServiceInterface {
  chatStream(userId: string, userMessage: string, conversationId?: string, systemPrompt?: string): AsyncGenerator<string>;
}
