import type { SupportedModelName } from "../services/model-provider.js";

/**
 * Every tunable constant in the app, grouped by feature/domain so a value's
 * location matches where you'd instinctively look for it. Secrets and
 * per-environment values (API keys, connection strings, JWT_SECRET, PORT,
 * Pinecone/Azure config) do NOT belong here — those stay in `.env`, read via
 * `configureContainer()`'s `requireEnv()`. This file is only for values that
 * are the same across environments and would otherwise be a magic number/string
 * buried in whichever file happens to use it.
 */
export const appConfig = {
  server: {
    defaultPort: 3000,
  },

  auth: {
    bcryptSaltRounds: 10,
    jwtExpiresIn: "7d",
  },

  chat: {
    defaultModel: "gpt-4o-mini" as SupportedModelName,
    baseSystemPrompt:
      "You are the customer support assistant for a logistics company. You help users with " +
      "questions about shipments, deliveries, tracking, freight, warehousing, and related logistics " +
      "services. Only answer questions related to logistics and this company's services — if a user " +
      "asks about something unrelated, politely explain that you can only help with logistics-related " +
      "questions and steer the conversation back on topic.",
  },

  memory: {
    /** How many recent messages ChatMemoryService.getHistory()/findByConversationId fetch by default. */
    defaultMessageLimit: 50,
    /** Once a conversation has this many messages since its last summary, appendMessage() triggers a new one. */
    summarizationMessageThreshold: 10,
  },

  summary: {
    systemPrompt:
      "You summarize conversations between a user and an assistant. Write a concise summary " +
      "that captures the key points, questions, and any decisions or conclusions reached. " +
      "Do not include a preamble like 'Here is a summary' — just output the summary itself.",
  },

  embedding: {
    model: "openai/text-embedding-3-small",
    // text-embedding-3 models support a custom output size via Matryoshka representation
    // learning — this must match the Pinecone index's configured dimension.
    dimensions: 1024,
    chunkSize: 1000,
    chunkOverlap: 200,
    defaultTopK: 5,
    openRouterBaseUrl: "https://openrouter.ai/api/v1",
    maxTextInputLength: 200_000,
  },

  uploads: {
    maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  },
} as const;
