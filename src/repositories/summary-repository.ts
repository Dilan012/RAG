import { injectable } from "tsyringe";
import { SummaryModel, type SummaryDocument } from "../models/summary.js";
import type { SummaryRepositoryInterface, UpsertSummaryInput } from "./interfaces/summary-repository.interface.js";

@injectable()
export class SummaryRepository implements SummaryRepositoryInterface {
  async findByConversationId(conversationId: string, userId: string): Promise<SummaryDocument | null> {
    return SummaryModel.findOne({ conversationId, userId }).lean();
  }

  async upsert(input: UpsertSummaryInput): Promise<SummaryDocument> {
    const summary = await SummaryModel.findOneAndUpdate(
      { conversationId: input.conversationId, userId: input.userId },
      {
        $set: { content: input.content },
        $setOnInsert: { conversationId: input.conversationId, userId: input.userId },
      },
      { returnDocument: "after", upsert: true }
    ).lean();

    // upsert: true guarantees a document is returned, either the updated existing
    // one or the newly inserted one.
    return summary as SummaryDocument;
  }
}
