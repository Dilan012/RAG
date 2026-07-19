import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import multer, { MulterError } from "multer";
import type { EmbeddingController } from "../controllers/embedding-controller.js";
import { ValidationError } from "../errors/index.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Memory storage — files never touch disk, req.file.buffer is handed straight to the service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// multer surfaces a limit violation as a raw MulterError via next(err), not one of this
// app's AppError types — without this wrapper it'd fall through errorHandler as a generic
// 500 instead of a proper 400 with a clear message.
function handleFileUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(new ValidationError(`File is too large — the maximum allowed size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`));
      return;
    }
    next(err);
  });
}

export function createEmbeddingRouter(controller: EmbeddingController, authMiddleware: RequestHandler): Router {
  const router = Router();

  // Accepts either multipart/form-data with a "file" field, or a JSON body with a "text"
  // field — see EmbeddingController.ingest for the either/or handling. multer only acts on
  // multipart requests; a JSON request passes through untouched (express.json() already
  // parsed req.body in index.ts).
  router.post("/ingest", authMiddleware, handleFileUpload, controller.ingest);

  return router;
}
