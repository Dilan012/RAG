import { injectable } from "tsyringe";
import { Types } from "mongoose";
import { KnowledgeBaseDocumentModel } from "../models/knowledge-base-document.js";
import type {
  CreateKnowledgeBaseDocumentInput,
  KnowledgeBaseDocumentRepositoryInterface,
} from "./interfaces/knowledge-base-document-repository.interface.js";

@injectable()
export class KnowledgeBaseDocumentRepository implements KnowledgeBaseDocumentRepositoryInterface {
  async create(input: CreateKnowledgeBaseDocumentInput) {
    const document = await KnowledgeBaseDocumentModel.create({
      userId: new Types.ObjectId(input.userId),
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      source: input.source,
      sizeBytes: input.sizeBytes,
      chunkCount: input.chunkCount,
    });
    return document.toObject();
  }

  async findByUserId(userId: string) {
    return KnowledgeBaseDocumentModel.find({ userId }).sort({ createdAt: -1 }).lean();
  }
}
