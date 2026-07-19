import { readFile } from "node:fs/promises";
import { injectable } from "tsyringe";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import type {
  EmbeddingServiceInterface,
  IngestSource,
} from "./interfaces/embedding-service.interface.js";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

async function extractText(source: IngestSource): Promise<string> {
  if (source.mimeType === "application/pdf") {
    const loader = new PDFLoader(source.filePath);
    const docs = await loader.load();
    console.log(`Extracted text from PDF: ${source.fileName} (${docs.length} page(s))`);
    return docs.map((doc) => doc.pageContent).join("\n\n");
  }
  return readFile(source.filePath, "utf-8");
}

@injectable()
export class EmbeddingService implements EmbeddingServiceInterface {
  async embed(text: string): Promise<number[]> {
    throw new Error("EmbeddingService.embed is not implemented yet");
  }

  async ingest(source: IngestSource): Promise<void> {
    const text = await extractText(source);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
    const chunks = await splitter.splitText(text);

    // TODO: generate an embedding for each chunk (via embed()) and persist them.
    console.log(`Ingested ${source.fileName}: split into ${chunks.length} chunk(s)`);
    chunks.forEach((chunk, i) => {
      console.log(`--- chunk ${i + 1}/${chunks.length} ---`);
      console.log(chunk);
    });
  }
}
