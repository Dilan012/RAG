import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface GmailMcpServiceInterface {
  /**
   * Returns an MCP Client already connected (in-process, via InMemoryTransport) to a
   * Gmail MCP server authenticated as the given user. Throws NotFoundError if the user
   * hasn't connected Gmail. Callers (e.g. agent/tool-calling code) use the returned
   * Client's `listTools()`/`callTool()` like any other MCP client.
   */
  getClient(userId: string): Promise<Client>;
}
