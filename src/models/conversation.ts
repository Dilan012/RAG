import { Schema, model, Types } from "mongoose";

export interface ConversationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ConversationModel = model<ConversationDocument>("Conversation", conversationSchema);
