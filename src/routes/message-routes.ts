import { Router } from "express";
import type { MessageController } from "../controllers/message-controller.js";
import { validateQuery } from "../middleware/validate-middleware.js";
import { listMessagesQuerySchema } from "../controllers/schemas/message.schema.js";

export function createMessageRouter(controller: MessageController): Router {
  const router = Router();

  router.get("/", validateQuery(listMessagesQuerySchema), controller.list);

  return router;
}
