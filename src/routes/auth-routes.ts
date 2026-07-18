import { Router } from "express";
import type { AuthController } from "../controllers/auth-controller.js";
import { validateBody } from "../middleware/validate-middleware.js";
import { loginSchema, signupSchema } from "../dtos/auth.dto.js";

export function createAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post("/signup", validateBody(signupSchema), authController.signup);
  router.post("/login", validateBody(loginSchema), authController.login);

  return router;
}
