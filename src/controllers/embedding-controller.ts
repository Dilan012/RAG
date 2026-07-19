import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import type { EmbeddingServiceInterface } from "../services/interfaces/embedding-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { requireUserId } from "./require-user-id.js";
import { validate } from "../validation/validate.js";
import { ingestTextSchema } from "../dtos/embedding.dto.js";
import { saveTextToDisk } from "../utils/save-text-to-disk.js";

@injectable()
export class EmbeddingController {
  constructor(@inject(TOKENS.EmbeddingService) private readonly embeddingService: EmbeddingServiceInterface) {}

  ingest = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);

    if (req.file) {
      await this.embeddingService.ingest({
        filePath: req.file.path,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        userId,
      });
      res.success({ ingested: true }, 201);
      return;
    }

    // No single predictable body shape for this route (file vs. text — see
    // embedding-routes.ts), so validation happens here instead of route middleware.
    const { text } = validate(ingestTextSchema, req.body);
    const filePath = await saveTextToDisk(text);

    await this.embeddingService.ingest({
      filePath,
      fileName: "text-input.txt",
      mimeType: "text/plain",
      userId,
    });
    res.success({ ingested: true }, 201);
  };
}
