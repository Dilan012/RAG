import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "../di/tokens.js";
import { appConfig } from "../config/app-config.js";
import { encryptToken, decryptToken } from "../utils/token-crypto.js";
import { InternalError, ValidationError } from "../errors/index.js";
import type { GmailConnectionRepositoryInterface } from "../repositories/interfaces/gmail-connection-repository.interface.js";
import type {
  GmailCallbackResult,
  GmailConnectionStatus,
  GmailOAuthServiceInterface,
} from "./interfaces/gmail-oauth-service.interface.js";

interface OAuthState {
  userId: string;
}

@injectable()
export class GmailOAuthService implements GmailOAuthServiceInterface {
  private readonly oauth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor(
    @inject(TOKENS.GoogleClientId) clientId: string,
    @inject(TOKENS.GoogleClientSecret) clientSecret: string,
    @inject(TOKENS.GoogleRedirectUri) redirectUri: string,
    @inject(TOKENS.JwtSecret) private readonly jwtSecret: string,
    @inject(TOKENS.TokenEncryptionKey) private readonly encryptionKey: string,
    @inject(TOKENS.GmailConnectionRepository)
    private readonly gmailConnectionRepository: GmailConnectionRepositoryInterface
  ) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  getAuthUrl(userId: string): string {
    const state = jwt.sign({ userId } satisfies OAuthState, this.jwtSecret, {
      expiresIn: appConfig.gmail.oauthStateExpiresIn,
    } as jwt.SignOptions);

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      // Force the consent screen every time so Google re-issues a refresh_token even for
      // a user reconnecting — Google only returns one on a account's *first* authorization
      // otherwise, which would silently break reconnects.
      prompt: "consent",
      scope: [...appConfig.gmail.scopes],
      state,
    });
  }

  async handleCallback(code: string, state: string): Promise<GmailCallbackResult> {
    const { userId } = this.verifyState(state);

    const { tokens } = await this.oauth2Client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new InternalError("Google did not return the expected OAuth tokens");
    }

    this.oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();
    if (!data.email) {
      throw new InternalError("Could not determine the connected Google account's email");
    }

    await this.gmailConnectionRepository.upsert({
      userId,
      googleEmail: data.email,
      accessToken: encryptToken(tokens.access_token, this.encryptionKey),
      refreshToken: encryptToken(tokens.refresh_token, this.encryptionKey),
      scope: tokens.scope ?? appConfig.gmail.scopes.join(" "),
      expiryDate: new Date(tokens.expiry_date),
    });

    return { userId, googleEmail: data.email };
  }

  async getConnectionStatus(userId: string): Promise<GmailConnectionStatus> {
    const connection = await this.gmailConnectionRepository.findByUserId(userId);
    if (!connection) {
      return { connected: false };
    }
    return { connected: true, googleEmail: connection.googleEmail };
  }

  async disconnect(userId: string): Promise<void> {
    const connection = await this.gmailConnectionRepository.findByUserId(userId);
    if (connection) {
      try {
        await this.oauth2Client.revokeToken(decryptToken(connection.accessToken, this.encryptionKey));
      } catch {
        // Best-effort revoke against Google — still remove our stored copy either way,
        // so a user is never left "stuck connected" from their own app's point of view.
      }
    }
    await this.gmailConnectionRepository.deleteByUserId(userId);
  }

  private verifyState(state: string): OAuthState {
    try {
      return jwt.verify(state, this.jwtSecret) as OAuthState;
    } catch {
      throw new ValidationError("Invalid or expired Gmail connection request — please try connecting again");
    }
  }
}
