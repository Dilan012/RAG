import { Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post("/signup", authController.signup);
  router.post("/login", authController.login);

  return router;
}
