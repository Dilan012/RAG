import { inject, injectable } from "tsyringe";
import type { ConversationRepositoryInterface } from "../repositories/interfaces/conversation-repository.interface.js";
import type { ConversationDocument } from "../models/conversation.js";
import type {
  ConversationServiceInterface,
  ConversationSummary,
} from "./interfaces/conversation-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { NotFoundError } from "../errors/index.js";

function toSummary(conversation: ConversationDocument): ConversationSummary {
  return {
    id: conversation._id.toString(),
    userId: conversation.userId.toString(),
    name: conversation.name,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

@injectable()
export class ConversationService implements ConversationServiceInterface {
  constructor(
    @inject(TOKENS.ConversationRepository)
    private readonly conversationRepository: ConversationRepositoryInterface
  ) {}

  async createConversation(userId: string, name: string): Promise<ConversationSummary> {
    const conversation = await this.conversationRepository.create({ userId, name });
    return toSummary(conversation);
  }

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const conversations = await this.conversationRepository.findByUserId(userId);
    return conversations.map(toSummary);
  }

  async getConversation(id: string, userId: string): Promise<ConversationSummary> {
    const conversation = await this.getOwnedConversation(id, userId);
    return toSummary(conversation);
  }

  async renameConversation(id: string, userId: string, name: string): Promise<ConversationSummary> {
    await this.getOwnedConversation(id, userId);
    const updated = await this.conversationRepository.updateName(id, name);
    if (!updated) {
      throw new NotFoundError("Conversation not found");
    }
    return toSummary(updated);
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    await this.getOwnedConversation(id, userId);
    await this.conversationRepository.deleteById(id);
  }

  private async getOwnedConversation(id: string, userId: string): Promise<ConversationDocument> {
    const conversation = await this.conversationRepository.findById(id);
    if (!conversation || conversation.userId.toString() !== userId) {
      throw new NotFoundError("Conversation not found");
    }
    return conversation;
  }
}
