export interface IngestSource {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  userId: string;
}

export interface EmbeddingServiceInterface {
  embed(text: string): Promise<number[]>;
  ingest(source: IngestSource): Promise<void>;
}
