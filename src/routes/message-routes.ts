import { Router } from "express";
import type { MessageController } from "../controllers/message-controller.js";

export function createMessageRouter(controller: MessageController): Router {
  const router = Router();

  router.get("/", controller.list);

  return router;
}
