import { injectable } from "tsyringe";
import type {
  EmbeddingServiceInterface,
  IngestSource,
} from "./interfaces/embedding-service.interface.js";

@injectable()
export class EmbeddingService implements EmbeddingServiceInterface {
  async embed(text: string): Promise<number[]> {
    throw new Error("EmbeddingService.embed is not implemented yet");
  }

  async ingest(source: IngestSource): Promise<void> {
    throw new Error("EmbeddingService.ingest is not implemented yet");
  }
}
