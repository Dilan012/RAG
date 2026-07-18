import { Router } from "express";
import type { ConversationController } from "../controllers/conversation-controller.js";
import { validateBody, validateParams } from "../middleware/validate-middleware.js";
import {
  conversationIdParamSchema,
  createConversationSchema,
  updateConversationSchema,
} from "../controllers/schemas/conversation.schema.js";

export function createConversationRouter(controller: ConversationController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", validateBody(createConversationSchema), controller.create);
  router.put(
    "/:id",
    validateParams(conversationIdParamSchema),
    validateBody(updateConversationSchema),
    controller.update
  );
  router.delete("/:id", validateParams(conversationIdParamSchema), controller.delete);

  return router;
}
