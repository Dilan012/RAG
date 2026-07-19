export interface IngestSource {
  filePath: string;
  fileName: string;
  mimeType: string;
  userId: string;
}

export interface EmbeddingServiceInterface {
  embed(text: string): Promise<number[]>;
  ingest(source: IngestSource): Promise<void>;
}
