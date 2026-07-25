import type { BaseMessageLike } from "@langchain/core/messages";
import { inject, injectable } from "tsyringe";
import { ModelProvider, type SupportedModelName } from "./model-provider.js";
import type { ChatMessage } from "./interfaces/chat-memory-service.interface.js";
import type { SummaryRecord, SummaryServiceInterface } from "./interfaces/summary-service.interface.js";
import type { SummaryDocument } from "../models/summary.js";
import type { SummaryRepositoryInterface } from "../repositories/interfaces/summary-repository.interface.js";
import { TOKENS } from "../di/tokens.js";
import { appConfig } from "../config/app-config.js";

function toSummaryRecord(summary: SummaryDocument): SummaryRecord {
  return {
    id: summary._id.toString(),
    conversationId: summary.conversationId.toString(),
    userId: summary.userId,
    content: summary.content,
    createdAt: summary.createdAt,
  };
}

@injectable()
export class SummaryService implements SummaryServiceInterface {
  constructor(
    @inject(TOKENS.ModelName) private readonly modelName: SupportedModelName,
    @inject(TOKENS.SummaryRepository) private readonly summaryRepository: SummaryRepositoryInterface
  ) {}

  async summarizeConversation(
    conversationId: string,
    userId: string,
    messages: ChatMessage[]
  ): Promise<SummaryRecord> {
    const existingSummary = await this.summaryRepository.findByConversationId(conversationId, userId);

    const model = ModelProvider.getModel(this.modelName);
    const transcript = messages.map((message) => `${message.role}: ${message.content}`).join("\n");

    const prompt: BaseMessageLike[] = [{ role: "system", content: appConfig.summary.systemPrompt }];
    if (existingSummary) {
      prompt.push({
        role: "system",
        content: `Previous summary of this conversation, to be updated with the new messages below:\n${existingSummary.content}`,
      });
    }
    prompt.push({ role: "user", content: transcript });

    const response = await model.invoke(prompt);
    const content = String(response.content);

    const saved = await this.summaryRepository.upsert({ conversationId, userId, content });
    return toSummaryRecord(saved);
  }
}
