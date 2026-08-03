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
import { GmailController } from "./src/controllers/gmail-controller.js";
import { createGmailRouter } from "./src/routes/gmail-routes.js";
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
const gmailController = container.resolve(GmailController);
const authMiddleware = createAuthMiddleware(container.resolve<string>(TOKENS.JwtSecret));

// Every route is mounted under this one prefix so a reverse proxy can route
// a single path (e.g. /api/*) to this service without touching individual
// route paths here.
const api = express.Router();

api.use("/auth", createAuthRouter(authController));
api.use("/conversations", createConversationRouter(conversationController, authMiddleware));
api.use("/messages", createMessageRouter(messageController, authMiddleware));
api.use("/embeddings", createEmbeddingRouter(embeddingController, authMiddleware));
api.use("/integrations/gmail", createGmailRouter(gmailController, authMiddleware));

// Streams the reply as raw text chunks instead of the usual { success, data } JSON
// envelope — there's no single point to attach a JSON response to once the model
// starts streaming tokens. This is the one route allowed to bypass res.success for
// that reason (see CLAUDE.md's Response envelope section).
api.post("/chat", authMiddleware, validateBody(chatSchema), async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { message, conversationId } = req.body as ChatDto;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  // Tell any reverse proxy in front of this (nginx, etc.) not to buffer the whole
  // response before forwarding it — proxy_buffering defaults to "on" in nginx, which
  // silently turns this into a fake stream (nothing reaches the client until the model
  // finishes) even though this handler itself is writing incrementally.
  res.setHeader("X-Accel-Buffering", "no");
  // Node doesn't disable Nagle's algorithm on response sockets by default, which can
  // coalesce/delay the small, frequent writes a token-by-token stream produces —
  // flushing headers immediately and disabling Nagle here is what actually gets each
  // chunk onto the wire as soon as res.write() is called, instead of batched later.
  res.flushHeaders();
  req.socket.setNoDelay(true);

  try {
    for await (const chunk of chatService.chatStream(userId, message, conversationId)) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("Chat stream failed:", error);
    if (!res.headersSent) {
      throw error;
    }
    // Headers/chunks are already on the wire, so a normal JSON error response isn't
    // possible anymore — end the stream with a sentinel the frontend strips out and
    // treats as a failure instead of silently truncating the reply.
    res.write(appConfig.chat.streamErrorSentinel);
    res.end();
  }
});

// Same turn as POST /chat above, just not streamed — a single { success, data: { reply } }
// response once the model is done. Exists for experimentation/testing where a plain
// request/response is more convenient than consuming a stream (e.g. curl, Postman, quick
// prompt iteration) — ChatService.chat() itself just drains chatStream() internally, so
// there's no separate "non-streaming turn" implementation to keep in sync.
api.post("/chat/invoke", authMiddleware, validateBody(chatSchema), async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { message, conversationId } = req.body as ChatDto;

  const reply = await chatService.chat(userId, message, conversationId);
  res.success({ reply });
});

app.use(appConfig.server.apiPrefix, api);

app.use(errorHandler);

async function start() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
