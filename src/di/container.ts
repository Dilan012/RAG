import "reflect-metadata";
import { container } from "tsyringe";
import { TOKENS } from "./tokens.js";
import { MessageRepository } from "../repositories/message-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { SummaryRepository } from "../repositories/summary-repository.js";
import { ChatMemoryService } from "../services/chat-memory-service.js";
import { AuthService } from "../services/auth-service.js";
import { ConversationService } from "../services/conversation-service.js";
import { MessageService } from "../services/message-service.js";
import { SummaryService } from "../services/summary-service.js";
import { EmbeddingService } from "../services/embedding-service.js";
import { appConfig } from "../config/app-config.js";

export function configureContainer(): void {
  container.register(TOKENS.MessageRepository, { useClass: MessageRepository });
  container.register(TOKENS.UserRepository, { useClass: UserRepository });
  container.register(TOKENS.ConversationRepository, { useClass: ConversationRepository });
  container.register(TOKENS.SummaryRepository, { useClass: SummaryRepository });
  container.register(TOKENS.ChatMemoryService, { useClass: ChatMemoryService });
  container.register(TOKENS.AuthService, { useClass: AuthService });
  container.register(TOKENS.ConversationService, { useClass: ConversationService });
  container.register(TOKENS.MessageService, { useClass: MessageService });
  container.register(TOKENS.SummaryService, { useClass: SummaryService });
  container.register(TOKENS.EmbeddingService, { useClass: EmbeddingService });

  container.register(TOKENS.ModelName, { useValue: appConfig.chat.defaultModel });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  container.register(TOKENS.JwtSecret, { useValue: jwtSecret });

  const pineconeApiKey = process.env.PINECONE_API_KEY;
  if (!pineconeApiKey) {
    throw new Error("PINECONE_API_KEY environment variable is required");
  }
  container.register(TOKENS.PineconeApiKey, { useValue: pineconeApiKey });

  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
  if (!pineconeIndexName) {
    throw new Error("PINECONE_INDEX_NAME environment variable is required");
  }
  container.register(TOKENS.PineconeIndexName, { useValue: pineconeIndexName });

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }
  container.register(TOKENS.OpenRouterApiKey, { useValue: openRouterApiKey });
}

export { container };
