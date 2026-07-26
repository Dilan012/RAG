import { Schema, model, Types } from "mongoose";

export interface GmailConnectionDocument {
  _id: Types.ObjectId;
  userId: string;
  googleEmail: string;
  /** Encrypted (see src/utils/token-crypto.ts) — never store OAuth tokens in plaintext. */
  accessToken: string;
  /** Encrypted. Long-lived; only re-issued by Google if the user re-consents. */
  refreshToken: string;
  scope: string;
  /** When the current accessToken expires — used to decide whether to refresh before use. */
  expiryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const gmailConnectionSchema = new Schema<GmailConnectionDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    googleEmail: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    scope: { type: String, required: true },
    expiryDate: { type: Date, required: true },
  },
  { timestamps: true }
);

export const GmailConnectionModel = model<GmailConnectionDocument>("GmailConnection", gmailConnectionSchema);
