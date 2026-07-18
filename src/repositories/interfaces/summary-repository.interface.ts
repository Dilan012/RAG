import type { SummaryDocument } from "../../models/summary.js";

export interface UpsertSummaryInput {
  conversationId: string;
  userId: string;
  content: string;
}

export interface SummaryRepositoryInterface {
  findByConversationId(conversationId: string, userId: string): Promise<SummaryDocument | null>;
  upsert(input: UpsertSummaryInput): Promise<SummaryDocument>;
}
