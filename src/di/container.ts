import "reflect-metadata";
import { container } from "tsyringe";
import { TOKENS } from "./tokens.js";
import { MessageRepository } from "../repositories/message-repository.js";
import { UserRepository } from "../repositories/user-repository.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { SummaryRepository } from "../repositories/summary-repository.js";
import { GmailConnectionRepository } from "../repositories/gmail-connection-repository.js";
import { KnowledgeBaseDocumentRepository } from "../repositories/knowledge-base-document-repository.js";
import { ChatMemoryService } from "../services/chat-memory-service.js";
import { AuthService } from "../services/auth-service.js";
import { ConversationService } from "../services/conversation-service.js";
import { MessageService } from "../services/message-service.js";
import { SummaryService } from "../services/summary-service.js";
import { EmbeddingService } from "../services/embedding-service.js";
import { GmailOAuthService } from "../services/gmail-oauth-service.js";
import { GmailMcpService } from "../services/gmail-mcp-service.js";
import { appConfig } from "../config/app-config.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export function configureContainer(): void {
  container.register(TOKENS.MessageRepository, { useClass: MessageRepository });
  container.register(TOKENS.UserRepository, { useClass: UserRepository });
  container.register(TOKENS.ConversationRepository, { useClass: ConversationRepository });
  container.register(TOKENS.SummaryRepository, { useClass: SummaryRepository });
  container.register(TOKENS.GmailConnectionRepository, { useClass: GmailConnectionRepository });
  container.register(TOKENS.KnowledgeBaseDocumentRepository, { useClass: KnowledgeBaseDocumentRepository });
  container.register(TOKENS.ChatMemoryService, { useClass: ChatMemoryService });
  container.register(TOKENS.AuthService, { useClass: AuthService });
  container.register(TOKENS.ConversationService, { useClass: ConversationService });
  container.register(TOKENS.MessageService, { useClass: MessageService });
  container.register(TOKENS.SummaryService, { useClass: SummaryService });
  container.register(TOKENS.EmbeddingService, { useClass: EmbeddingService });
  container.register(TOKENS.GmailOAuthService, { useClass: GmailOAuthService });
  container.register(TOKENS.GmailMcpService, { useClass: GmailMcpService });

  container.register(TOKENS.ModelName, { useValue: appConfig.chat.defaultModel });

  container.register(TOKENS.JwtSecret, { useValue: requireEnv("JWT_SECRET") });
  container.register(TOKENS.PineconeApiKey, { useValue: requireEnv("PINECONE_API_KEY") });
  container.register(TOKENS.PineconeIndexName, { useValue: requireEnv("PINECONE_INDEX_NAME") });
  container.register(TOKENS.OpenRouterApiKey, { useValue: requireEnv("OPENROUTER_API_KEY") });
  container.register(TOKENS.GoogleClientId, { useValue: requireEnv("GOOGLE_CLIENT_ID") });
  container.register(TOKENS.GoogleClientSecret, { useValue: requireEnv("GOOGLE_CLIENT_SECRET") });
  container.register(TOKENS.GoogleRedirectUri, { useValue: requireEnv("GOOGLE_REDIRECT_URI") });
  container.register(TOKENS.TokenEncryptionKey, { useValue: requireEnv("TOKEN_ENCRYPTION_KEY") });
  container.register(TOKENS.FrontendUrl, { useValue: process.env.FRONTEND_URL ?? "http://localhost:5173" });
  container.register(TOKENS.TavilyApiKey, { useValue: requireEnv("TAVILY_API_KEY") });
}

export { container };
