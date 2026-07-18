import { Schema, model, Types } from "mongoose";

export interface SummaryDocument {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  userId: string;
  content: string;
  createdAt: Date;
}

const summarySchema = new Schema<SummaryDocument>({
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  userId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const SummaryModel = model<SummaryDocument>("Summary", summarySchema);
