import { Router, type RequestHandler } from "express";
import type { ConversationController } from "../controllers/conversation-controller.js";
import { validateBody, validateParams } from "../middleware/validate-middleware.js";
import {
  conversationIdParamSchema,
  createConversationSchema,
  updateConversationSchema,
} from "../dtos/conversation.dto.js";

export function createConversationRouter(controller: ConversationController, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.get("/", authMiddleware, controller.list);
  router.post("/", authMiddleware, validateBody(createConversationSchema), controller.create);
  router.put(
    "/:id",
    authMiddleware,
    validateParams(conversationIdParamSchema),
    validateBody(updateConversationSchema),
    controller.update
  );
  router.delete("/:id", authMiddleware, validateParams(conversationIdParamSchema), controller.delete);

  return router;
}
