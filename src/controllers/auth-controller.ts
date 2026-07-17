import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import type { AuthServiceInterface } from "../services/interfaces/auth-service.interface.js";
import { TOKENS } from "../di/tokens.js";

@injectable()
export class AuthController {
  constructor(@inject(TOKENS.AuthService) private readonly authService: AuthServiceInterface) {}

  signup = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.body ?? {};

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "name, email and password are required strings" });
      return;
    }

    try {
      const result = await this.authService.signup(name, email, password);
      res.status(201).json(result);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "Signup failed" });
    }
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "email and password are required strings" });
      return;
    }

    try {
      const result = await this.authService.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" });
    }
  };
}
