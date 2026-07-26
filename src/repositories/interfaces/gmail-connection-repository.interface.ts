import type { GmailConnectionDocument } from "../../models/gmail-connection.js";

export interface UpsertGmailConnectionInput {
  userId: string;
  googleEmail: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiryDate: Date;
}

export interface GmailConnectionRepositoryInterface {
  findByUserId(userId: string): Promise<GmailConnectionDocument | null>;
  upsert(input: UpsertGmailConnectionInput): Promise<GmailConnectionDocument>;
  updateTokens(userId: string, accessToken: string, expiryDate: Date): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
