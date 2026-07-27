import { Schema, model, Types } from "mongoose";

export interface KnowledgeBaseDocumentDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  fileName: string;
  filePath: string;
  mimeType: string;
  source: "file" | "text";
  sizeBytes: number;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseDocumentSchema = new Schema<KnowledgeBaseDocumentDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    source: { type: String, enum: ["file", "text"], required: true },
    sizeBytes: { type: Number, required: true },
    chunkCount: { type: Number, required: true },
  },
  { timestamps: true }
);

export const KnowledgeBaseDocumentModel = model<KnowledgeBaseDocumentDocument>(
  "KnowledgeBaseDocument",
  knowledgeBaseDocumentSchema
);
