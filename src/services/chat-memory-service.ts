import { inject, injectable } from "tsyringe";
import type { ChatMessage, ChatMemoryServiceInterface } from "./interfaces/chat-memory-service.interface.js";
import type { MessageRepositoryInterface } from "../repositories/interfaces/message-repository.interface.js";
import type { SummaryRepositoryInterface } from "../repositories/interfaces/summary-repository.interface.js";
import type { SummaryServiceInterface } from "./interfaces/summary-service.interface.js";
import type { MessageDocument } from "../models/message.js";
import { TOKENS } from "../di/tokens.js";

// Once a conversation accumulates this many messages since its last summary,
// appendMessage() triggers a new summarization pass to fold them in.
const SUMMARIZATION_MESSAGE_COUNT = 10;

function toChatMessage(message: MessageDocument): ChatMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

@injectable()
export class ChatMemoryService implements ChatMemoryServiceInterface {
  constructor(
    @inject(TOKENS.MessageRepository) private readonly messageRepository: MessageRepositoryInterface,
    @inject(TOKENS.SummaryRepository) private readonly summaryRepository: SummaryRepositoryInterface,
    @inject(TOKENS.SummaryService) private readonly summaryService: SummaryServiceInterface
  ) {}

  async getHistory(userId: string, conversationId?: string): Promise<ChatMessage[]> {
    if (!conversationId) {
      const messages = await this.messageRepository.findByUserId(userId);
      return messages.map(toChatMessage);
    }

    const summary = await this.summaryRepository.findByConversationId(conversationId, userId);
    const recentMessages = await this.messageRepository.findByConversationIdSince(
      conversationId,
      userId,
      summary?.createdAt
    );

    const history: ChatMessage[] = [];
    if (summary) {
      history.push({
        role: "system",
        content: `Summary of the conversation so far:\n${summary.content}`,
      });
    }
    history.push(...recentMessages.map(toChatMessage));

    return history;
  }

  async appendMessage(userId: string, message: ChatMessage, conversationId?: string): Promise<void> {
    await this.messageRepository.create({
      userId,
      ...(conversationId ? { conversationId } : {}),
      role: message.role as "user" | "assistant",
      content: message.content,
    });

    if (!conversationId) {
      return;
    }

    await this.summarizeIfThresholdReached(userId, conversationId);
  }

  private async summarizeIfThresholdReached(userId: string, conversationId: string): Promise<void> {
    const summary = await this.summaryRepository.findByConversationId(conversationId, userId);
    const unsummarizedCount = await this.messageRepository.countByConversationIdSince(
      conversationId,
      userId,
      summary?.createdAt
    );

    if (unsummarizedCount < SUMMARIZATION_MESSAGE_COUNT) {
      return;
    }

    const unsummarizedMessages = await this.messageRepository.findByConversationIdSince(
      conversationId,
      userId,
      summary?.createdAt
    );

    await this.summaryService.summarizeConversation(conversationId, userId, unsummarizedMessages.map(toChatMessage));
  }
}
