export interface GmailConnectionStatus {
  connected: boolean;
  googleEmail?: string;
}

export interface GmailCallbackResult {
  userId: string;
  googleEmail: string;
}

export interface GmailOAuthServiceInterface {
  /** Builds the Google consent URL the user's browser should be redirected to. */
  getAuthUrl(userId: string): string;
  /** Exchanges the authorization code Google redirected back with, and stores the connection. */
  handleCallback(code: string, state: string): Promise<GmailCallbackResult>;
  getConnectionStatus(userId: string): Promise<GmailConnectionStatus>;
  disconnect(userId: string): Promise<void>;
}
