import "reflect-metadata";
import { container } from "tsyringe";
import { TOKENS } from "./tokens.js";
import { MessageRepository } from "../repositories/message-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ConversationService } from "../services/conversation-service.js";
import { AuthService } from "../services/auth-service.js";
import type { SupportedModelName } from "../services/model-provider.js";

export function configureContainer(): void {
  container.register(TOKENS.MessageRepository, { useClass: MessageRepository });
  container.register(TOKENS.UserRepository, { useClass: UserRepository });
  container.register(TOKENS.ConversationService, { useClass: ConversationService });
  container.register(TOKENS.AuthService, { useClass: AuthService });

  const modelName: SupportedModelName = "gpt-4o-mini";
  container.register(TOKENS.ModelName, { useValue: modelName });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  container.register(TOKENS.JwtSecret, { useValue: jwtSecret });
}

export { container };
