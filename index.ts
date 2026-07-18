import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { connectToDatabase } from "./src/services/db.js";
import { configureContainer, container } from "./src/di/container.js";
import { ChatService } from "./src/services/chat-service.js";
import { AuthController } from "./src/controllers/auth-controller.js";
import { createAuthRouter } from "./src/routes/auth-routes.js";
import { ConversationController } from "./src/controllers/conversation-controller.js";
import { createConversationRouter } from "./src/routes/conversation-routes.js";
import { errorHandler } from "./src/middleware/error-handler.js";
import { responseHandler } from "./src/middleware/response-handler.js";
import { ValidationError } from "./src/errors/index.js";

const PORT = process.env.PORT ?? 3000;

configureContainer();

const app = express();
app.use(cors());
app.use(express.json());
app.use(responseHandler);

const chatService = container.resolve(ChatService);
const authController = container.resolve(AuthController);
const conversationController = container.resolve(ConversationController);
app.use("/auth", createAuthRouter(authController));
app.use("/conversations", createConversationRouter(conversationController));

app.post("/chat", async (req: Request, res: Response) => {
  const { customerId, message } = req.body ?? {};

  if (typeof customerId !== "string" || typeof message !== "string") {
    throw new ValidationError("customerId and message are required strings");
  }

  const reply = await chatService.chat(customerId, message);
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
