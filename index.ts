import dotenv from "dotenv";
dotenv.config();

import express from "express";
import type { Request, Response } from "express";
import { connectToDatabase } from "./src/services/db.js";
import { ConversationService } from "./src/services/conversation-service.js";
import { ChatService } from "./src/services/chat-service.js";
import type { SupportedModelName } from "./src/services/model-provider.js";

const PORT = process.env.PORT ?? 3000;
const MODEL_NAME: SupportedModelName = "gpt-4o-mini";

const app = express();
app.use(express.json());

const chatService = new ChatService(MODEL_NAME, new ConversationService());

app.post("/chat", async (req: Request, res: Response) => {
  const { customerId, message } = req.body ?? {};

  if (typeof customerId !== "string" || typeof message !== "string") {
    return res.status(400).json({ error: "customerId and message are required strings" });
  }

  try {
    const reply = await chatService.chat(customerId, message);
    res.json({ reply });
  } catch (error) {
    console.error("Error handling /chat:", error);
    res.status(500).json({ error: "Failed to generate a response" });
  }
});

async function start() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();
