import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { connectToDatabase } from "./src/services/db.js";
import { configureContainer, container } from "./src/di/container.js";
import { TOKENS } from "./src/di/tokens.js";
import { ChatService } from "./src/services/chat-service.js";
import { AuthController } from "./src/controllers/auth-controller.js";
import { createAuthRouter } from "./src/routes/auth-routes.js";
import { ConversationController } from "./src/controllers/conversation-controller.js";
import { createConversationRouter } from "./src/routes/conversation-routes.js";
import { MessageController } from "./src/controllers/message-controller.js";
import { createMessageRouter } from "./src/routes/message-routes.js";
import { EmbeddingController } from "./src/controllers/embedding-controller.js";
import { createEmbeddingRouter } from "./src/routes/embedding-routes.js";
import { errorHandler } from "./src/middleware/error-handler.js";
import { responseHandler } from "./src/middleware/response-handler.js";
import { createAuthMiddleware } from "./src/middleware/auth-middleware.js";
import { validateBody } from "./src/middleware/validate-middleware.js";
import { requireUserId } from "./src/controllers/require-user-id.js";
import { chatSchema } from "./src/dtos/chat.dto.js";
import type { ChatDto } from "./src/dtos/chat.dto.js";
import { appConfig } from "./src/config/app-config.js";

const PORT = process.env.PORT ?? appConfig.server.defaultPort;

configureContainer();

const app = express();
app.use(cors());
app.use(express.json());
app.use(responseHandler);

const chatService = container.resolve(ChatService);
const authController = container.resolve(AuthController);
const conversationController = container.resolve(ConversationController);
const messageController = container.resolve(MessageController);
const embeddingController = container.resolve(EmbeddingController);
const authMiddleware = createAuthMiddleware(container.resolve<string>(TOKENS.JwtSecret));

app.use("/auth", createAuthRouter(authController));
app.use("/conversations", createConversationRouter(conversationController, authMiddleware));
app.use("/messages", createMessageRouter(messageController, authMiddleware));
app.use("/embeddings", createEmbeddingRouter(embeddingController, authMiddleware));

app.post("/chat", authMiddleware, validateBody(chatSchema), async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { message, conversationId } = req.body as ChatDto;

  const reply = await chatService.chat(userId, message, conversationId);
  res.success({ reply });
});

app.use(errorHandler);

async function start() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
