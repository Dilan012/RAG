export interface ChatServiceInterface {
  chat(customerId: string, userMessage: string, systemPrompt?: string): Promise<string>;
}
