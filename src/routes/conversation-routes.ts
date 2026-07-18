import { Router } from "express";
import type { ConversationController } from "../controllers/conversation-controller.js";

export function createConversationRouter(controller: ConversationController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.delete);

  return router;
}
