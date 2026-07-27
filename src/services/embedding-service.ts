import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { inject, injectable } from "tsyringe";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type {
  EmbeddingServiceInterface,
  IngestSource,
  KnowledgeBaseDocumentSummary,
  SimilaritySearchResult,
} from "./interfaces/embedding-service.interface.js";
import type { KnowledgeBaseDocumentRepositoryInterface } from "../repositories/interfaces/knowledge-base-document-repository.interface.js";
import type { KnowledgeBaseDocumentDocument } from "../models/knowledge-base-document.js";
import { TOKENS } from "../di/tokens.js";
import { appConfig } from "../config/app-config.js";

async function extractText(source: IngestSource): Promise<string> {
  if (source.mimeType === "application/pdf") {
    const loader = new PDFLoader(source.filePath);
    const docs = await loader.load();
    console.log(`Extracted text from PDF: ${source.fileName} (${docs.length} page(s))`);
    return docs.map((doc) => doc.pageContent).join("\n\n");
  }
  return readFile(source.filePath, "utf-8");
}

function toSummary(document: KnowledgeBaseDocumentDocument): KnowledgeBaseDocumentSummary {
  return {
    id: document._id.toString(),
    fileName: document.fileName,
    mimeType: document.mimeType,
    source: document.source,
    sizeBytes: document.sizeBytes,
    chunkCount: document.chunkCount,
    createdAt: document.createdAt,
  };
}

@injectable()
export class EmbeddingService implements EmbeddingServiceInterface {
  private readonly embeddings: OpenAIEmbeddings;
  // PineconeStore.fromExistingIndex is async, so the store itself is built lazily —
  // every method awaits this same promise instead of re-connecting per call.
  private readonly vectorStore: Promise<PineconeStore>;

  constructor(
    @inject(TOKENS.PineconeApiKey) pineconeApiKey: string,
    @inject(TOKENS.PineconeIndexName) pineconeIndexName: string,
    @inject(TOKENS.OpenRouterApiKey) openRouterApiKey: string,
    @inject(TOKENS.KnowledgeBaseDocumentRepository)
    private readonly knowledgeBaseDocumentRepository: KnowledgeBaseDocumentRepositoryInterface
  ) {
    // OpenRouter exposes an OpenAI-compatible /embeddings endpoint, so OpenAIEmbeddings
    // works unmodified — just pointed at OpenRouter's base URL with an OpenRouter key.
    this.embeddings = new OpenAIEmbeddings({
      apiKey: openRouterApiKey,
      model: appConfig.embedding.model,
      dimensions: appConfig.embedding.dimensions,
      configuration: { baseURL: appConfig.embedding.openRouterBaseUrl },
    });

    const pineconeIndex = new Pinecone({ apiKey: pineconeApiKey }).index(pineconeIndexName);
    this.vectorStore = PineconeStore.fromExistingIndex(this.embeddings, { pineconeIndex });
  }

  async embed(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async ingest(source: IngestSource): Promise<KnowledgeBaseDocumentSummary> {
    const text = await extractText(source);
    const { size: sizeBytes } = await stat(source.filePath);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: appConfig.embedding.chunkSize,
      chunkOverlap: appConfig.embedding.chunkOverlap,
    });
    const chunks = await splitter.splitText(text);

    const documents = chunks.map((chunk) => ({
      pageContent: chunk,
      metadata: { userId: source.userId, fileName: source.fileName },
    }));
    const ids = chunks.map(() => randomUUID());

    const vectorStore = await this.vectorStore;
    await vectorStore.addDocuments(documents, { ids });

    console.log(`Ingested ${source.fileName}: stored ${chunks.length} chunk(s) in Pinecone`);

    const document = await this.knowledgeBaseDocumentRepository.create({
      userId: source.userId,
      fileName: source.fileName,
      filePath: source.filePath,
      mimeType: source.mimeType,
      source: source.source,
      sizeBytes,
      chunkCount: chunks.length,
    });

    return toSummary(document);
  }

  async similaritySearch(
    userId: string,
    query: string,
    topK: number = appConfig.embedding.defaultTopK
  ): Promise<SimilaritySearchResult[]> {
    const vectorStore = await this.vectorStore;

    // Always scope by userId — same defense-in-depth convention as Mongo queries
    // elsewhere in this codebase (see MessageRepository). Never search unscoped.
    const results = await vectorStore.similaritySearchWithScore(query, topK, {
      userId: { $eq: userId },
    });

    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      score,
      metadata: doc.metadata ?? {},
    }));
  }

  async listDocuments(userId: string): Promise<KnowledgeBaseDocumentSummary[]> {
    const documents = await this.knowledgeBaseDocumentRepository.findByUserId(userId);
    return documents.map(toSummary);
  }
}
