import { Router, type RequestHandler } from "express";
import type { MessageController } from "../controllers/message-controller.js";
import { validateQuery } from "../middleware/validate-middleware.js";
import { listMessagesQuerySchema } from "../dtos/message.dto.js";

export function createMessageRouter(controller: MessageController, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.get("/", authMiddleware, validateQuery(listMessagesQuerySchema), controller.list);

  return router;
}
