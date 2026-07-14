import { Schema, model } from "mongoose";

export interface MessageDocument {
  customerId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<MessageDocument>({
  customerId: { type: String, required: true, index: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const MessageModel = model<MessageDocument>("Message", messageSchema);
