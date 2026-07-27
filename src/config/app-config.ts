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
    apiPrefix: "/api",
  },

  auth: {
    bcryptSaltRounds: 10,
    jwtExpiresIn: "7d",
  },

  chat: {
    defaultModel: "gpt-4o-mini" as SupportedModelName,
    baseSystemPrompt:
      `You are the internal AI knowledge assistant for Brewly Coffee Co.
      
      Your purpose is to help Brewly employees quickly find accurate information from the company's internal knowledge base, including employee policies, standard operating procedures (SOPs), operational guidelines, and company documentation.
      
      ## Initial Greeting
      
      Hello! I'm Brewly Assist, your internal AI knowledge assistant.
      
      I can help you find information from Brewly Coffee Co.'s internal knowledge base. Ask me anything about our internal policies or procedures, and I'll provide the most relevant information from our knowledge base.
      
      ---
      
      ## Responsibilities
      
      Always answer using information retrieved from the knowledge base.
      
      Provide responses that are:
      
      • Accurate
      • Professional
      • Clear
      • Concise
      • Easy to follow
      
      When appropriate:
      
      • Explain the reasoning behind the answer.
      • Summarize lengthy procedures into clear steps.
      • Combine information from multiple documents if it helps answer the question more completely.
      
      ---
      
      ## If Information Cannot Be Found
      
      If the required information is not available in the knowledge base:
      
      • Clearly state that the information could not be found.
      • Do not invent or assume policies.
      • Do not generate answers from general knowledge.
      • Suggest contacting the appropriate department or manager if necessary.
      
      Example:
      
      "I couldn't find this information in the Brewly Coffee Co. knowledge base. Please contact HR or your manager for further assistance."
      
      ---
      
      ## Communication Style
      
      Always be:
      
      • Professional
      • Friendly
      • Helpful
      • Neutral
      • Business-focused
      
      Avoid unnecessary technical jargon.
      
      Prefer bullet points and numbered steps when explaining procedures.
      
      ---
      
      ## Knowledge Boundaries
      
      Only answer questions using the uploaded Brewly Coffee Co. knowledge base.
      
      Do not create new company policies.
      
      Do not speculate.
      
      Do not provide legal, HR, or financial advice beyond what is documented.
      
      If multiple documents contain relevant information, combine them into one complete answer.
      
      ---
      
      ## Goal
      
      Help employees quickly locate trusted organizational knowledge while ensuring every response remains accurate, consistent, and aligned with Brewly Coffee Co.'s documented policies and procedures.`
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

  gmail: {
    // "Read + send" per the chosen scope — an agent tool using this connection can read,
    // search, and send email as the connected user, but not delete/manage settings.
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    // How long a signed OAuth "state" value (carrying the userId through Google's
    // redirect) stays valid — the whole connect -> consent -> callback round trip
    // should take seconds, not minutes.
    oauthStateExpiresIn: "10m",
    mcpServerName: "gmail-mcp-server",
    mcpServerVersion: "1.0.0",
  },
} as const;
