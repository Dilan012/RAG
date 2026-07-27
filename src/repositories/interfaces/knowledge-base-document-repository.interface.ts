import type { KnowledgeBaseDocumentDocument } from "../../models/knowledge-base-document.js";

export interface CreateKnowledgeBaseDocumentInput {
  userId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  source: "file" | "text";
  sizeBytes: number;
  chunkCount: number;
}

export interface KnowledgeBaseDocumentRepositoryInterface {
  create(input: CreateKnowledgeBaseDocumentInput): Promise<KnowledgeBaseDocumentDocument>;
  findByUserId(userId: string): Promise<KnowledgeBaseDocumentDocument[]>;
}
