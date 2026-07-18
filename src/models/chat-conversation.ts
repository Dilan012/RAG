import { Schema, model, Types } from "mongoose";

export interface ChatConversationDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatConversationSchema = new Schema<ChatConversationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const ChatConversationModel = model<ChatConversationDocument>("ChatConversation", chatConversationSchema);
