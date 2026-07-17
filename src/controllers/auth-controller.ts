import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import type { AuthServiceInterface } from "../services/interfaces/auth-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { ValidationError } from "../errors/index.js";

@injectable()
export class AuthController {
  constructor(@inject(TOKENS.AuthService) private readonly authService: AuthServiceInterface) {}

  signup = async (req: Request, res: Response): Promise<void> => {
    const { name, email, password } = req.body ?? {};

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      throw new ValidationError("name, email and password are required strings");
    }

    const result = await this.authService.signup(name, email, password);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || typeof password !== "string") {
      throw new ValidationError("email and password are required strings");
    }

    const result = await this.authService.login(email, password);
    res.json(result);
  };
}
