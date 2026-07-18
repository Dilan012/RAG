import { Schema, model, Types } from "mongoose";

export interface MessageDocument {
  _id: Types.ObjectId;
  customerId: string;
  conversationId?: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<MessageDocument>({
  customerId: { type: String, required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: "ChatConversation", index: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const MessageModel = model<MessageDocument>("Message", messageSchema);
