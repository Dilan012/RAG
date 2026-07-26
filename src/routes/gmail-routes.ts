import { Router, type RequestHandler } from "express";
import type { GmailController } from "../controllers/gmail-controller.js";
import { validateQuery } from "../middleware/validate-middleware.js";
import { gmailCallbackQuerySchema } from "../dtos/gmail.dto.js";

export function createGmailRouter(controller: GmailController, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.get("/connect", authMiddleware, controller.connect);
  // No authMiddleware — Google redirects the user's browser here directly, without our
  // app's JWT. The signed `state` param (verified inside handleCallback) is what proves
  // which user this callback belongs to.
  router.get("/callback", validateQuery(gmailCallbackQuerySchema), controller.callback);
  router.get("/status", authMiddleware, controller.status);
  router.delete("/", authMiddleware, controller.disconnect);

  return router;
}
