import { z } from "zod";
import type { gmail_v1 } from "googleapis";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { appConfig } from "../config/app-config.js";
import { extractPlainTextBody, buildRawMessage } from "../utils/gmail-mime.js";

/**
 * Builds an MCP server exposing Gmail tools backed by the given, already-authenticated
 * Gmail API client. One of these is built fresh per user connection (see
 * GmailMcpService) — the `gmail` client passed in is what scopes every tool call to
 * that specific user's mailbox, since it carries their OAuth credentials.
 */
export function createGmailMcpServer(gmail: gmail_v1.Gmail): McpServer {
  const server = new McpServer({
    name: appConfig.gmail.mcpServerName,
    version: appConfig.gmail.mcpServerVersion,
  });

  server.registerTool(
    "search_emails",
    {
      description: "Search the connected Gmail account for messages matching a Gmail search query.",
      inputSchema: {
        query: z.string().describe("Gmail search syntax, e.g. 'from:someone@example.com is:unread'"),
        maxResults: z.number().int().min(1).max(50).optional().describe("Maximum number of results (default 10)"),
      },
    },
    async ({ query, maxResults }) => {
      const { data } = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults ?? 10,
      });

      const messages = (data.messages ?? []).map((message) => ({
        id: message.id,
        threadId: message.threadId,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(messages) }],
      };
    }
  );

  server.registerTool(
    "read_email",
    {
      description: "Fetch the full content (headers, snippet, plain-text body) of a Gmail message by id.",
      inputSchema: {
        messageId: z.string().describe("A Gmail message id, e.g. from search_emails results"),
      },
    },
    async ({ messageId }) => {
      const { data } = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });

      const headers = data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const result = {
        id: data.id,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: data.snippet,
        body: extractPlainTextBody(data.payload),
      };

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }
  );

  server.registerTool(
    "send_email",
    {
      description: "Send a plain-text email from the connected Gmail account.",
      inputSchema: {
        to: z.string().describe("Recipient email address"),
        subject: z.string(),
        body: z.string().describe("Plain text email body"),
      },
    },
    async ({ to, subject, body }) => {
      const { data } = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: buildRawMessage({ to, subject, body }) },
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ id: data.id, status: "sent" }) }],
      };
    }
  );

  return server;
}
