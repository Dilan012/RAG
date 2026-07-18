import "reflect-metadata";
import { container } from "tsyringe";
import { TOKENS } from "./tokens.js";
import { MessageRepository } from "../repositories/message-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ChatConversationRepository } from "../repositories/chat-conversation-repository.js";
import { ConversationService } from "../services/conversation-service.js";
import { AuthService } from "../services/auth-service.js";
import { ChatConversationService } from "../services/chat-conversation-service.js";
import { MessageService } from "../services/message-service.js";
import type { SupportedModelName } from "../services/model-provider.js";

export function configureContainer(): void {
  container.register(TOKENS.MessageRepository, { useClass: MessageRepository });
  container.register(TOKENS.UserRepository, { useClass: UserRepository });
  container.register(TOKENS.ChatConversationRepository, { useClass: ChatConversationRepository });
  container.register(TOKENS.ConversationService, { useClass: ConversationService });
  container.register(TOKENS.AuthService, { useClass: AuthService });
  container.register(TOKENS.ChatConversationService, { useClass: ChatConversationService });
  container.register(TOKENS.MessageService, { useClass: MessageService });

  const modelName: SupportedModelName = "gpt-4o-mini";
  container.register(TOKENS.ModelName, { useValue: modelName });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  container.register(TOKENS.JwtSecret, { useValue: jwtSecret });
}

export { container };
