export interface IngestSource {
  filePath: string;
  fileName: string;
  mimeType: string;
  userId: string;
  source: "file" | "text";
}

export interface SimilaritySearchResult {
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface KnowledgeBaseDocumentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  source: "file" | "text";
  sizeBytes: number;
  chunkCount: number;
  createdAt: Date;
}

export interface EmbeddingServiceInterface {
  embed(text: string): Promise<number[]>;
  ingest(source: IngestSource): Promise<KnowledgeBaseDocumentSummary>;
  similaritySearch(userId: string, query: string, topK?: number): Promise<SimilaritySearchResult[]>;
  listDocuments(userId: string): Promise<KnowledgeBaseDocumentSummary[]>;
}
