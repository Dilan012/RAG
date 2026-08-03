export interface ChatServiceInterface {
  chatStream(userId: string, userMessage: string, conversationId?: string, systemPrompt?: string): AsyncGenerator<string>;
  /** Same turn as chatStream(), just drained into one string — for callers that want a
   *  single JSON response instead of a live stream (see index.ts's POST /chat/invoke). */
  chat(userId: string, userMessage: string, conversationId?: string, systemPrompt?: string): Promise<string>;
}
