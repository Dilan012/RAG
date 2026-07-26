import { google } from "googleapis";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../di/tokens.js";
import { NotFoundError } from "../errors/index.js";
import { decryptToken, encryptToken } from "../utils/token-crypto.js";
import { createGmailMcpServer } from "./gmail-mcp-server.js";
import type { GmailConnectionRepositoryInterface } from "../repositories/interfaces/gmail-connection-repository.interface.js";
import type { GmailMcpServiceInterface } from "./interfaces/gmail-mcp-service.interface.js";

@injectable()
export class GmailMcpService implements GmailMcpServiceInterface {
  constructor(
    @inject(TOKENS.GoogleClientId) private readonly clientId: string,
    @inject(TOKENS.GoogleClientSecret) private readonly clientSecret: string,
    @inject(TOKENS.GoogleRedirectUri) private readonly redirectUri: string,
    @inject(TOKENS.TokenEncryptionKey) private readonly encryptionKey: string,
    @inject(TOKENS.GmailConnectionRepository)
    private readonly gmailConnectionRepository: GmailConnectionRepositoryInterface
  ) {}

  async getClient(userId: string): Promise<Client> {
    const connection = await this.gmailConnectionRepository.findByUserId(userId);
    if (!connection) {
      throw new NotFoundError("Gmail is not connected for this user");
    }

    const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri);
    oauth2Client.setCredentials({
      access_token: decryptToken(connection.accessToken, this.encryptionKey),
      refresh_token: decryptToken(connection.refreshToken, this.encryptionKey),
      expiry_date: connection.expiryDate.getTime(),
    });

    // googleapis auto-refreshes the access token on demand when it's expired; persist
    // the refreshed token so we don't re-refresh (and re-write) on every single call.
    oauth2Client.on("tokens", (tokens) => {
      if (tokens.access_token && tokens.expiry_date) {
        void this.gmailConnectionRepository.updateTokens(
          userId,
          encryptToken(tokens.access_token, this.encryptionKey),
          new Date(tokens.expiry_date)
        );
      }
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const server = createGmailMcpServer(gmail);

    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "rag-app-gmail-client", version: "1.0.0" });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    return client;
  }
}
