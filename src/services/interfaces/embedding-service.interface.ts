export interface IngestSource {
  filePath: string;
  fileName: string;
  mimeType: string;
  userId: string;
}

export interface SimilaritySearchResult {
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface EmbeddingServiceInterface {
  embed(text: string): Promise<number[]>;
  ingest(source: IngestSource): Promise<void>;
  similaritySearch(userId: string, query: string, topK?: number): Promise<SimilaritySearchResult[]>;
}
