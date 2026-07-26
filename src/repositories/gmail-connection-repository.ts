import { injectable } from "tsyringe";
import { GmailConnectionModel, type GmailConnectionDocument } from "../models/gmail-connection.js";
import type {
  GmailConnectionRepositoryInterface,
  UpsertGmailConnectionInput,
} from "./interfaces/gmail-connection-repository.interface.js";

@injectable()
export class GmailConnectionRepository implements GmailConnectionRepositoryInterface {
  async findByUserId(userId: string): Promise<GmailConnectionDocument | null> {
    return GmailConnectionModel.findOne({ userId }).lean();
  }

  async upsert(input: UpsertGmailConnectionInput): Promise<GmailConnectionDocument> {
    const connection = await GmailConnectionModel.findOneAndUpdate(
      { userId: input.userId },
      {
        $set: {
          googleEmail: input.googleEmail,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          scope: input.scope,
          expiryDate: input.expiryDate,
        },
      },
      { returnDocument: "after", upsert: true }
    ).lean();

    return connection as GmailConnectionDocument;
  }

  async updateTokens(userId: string, accessToken: string, expiryDate: Date): Promise<void> {
    await GmailConnectionModel.updateOne({ userId }, { $set: { accessToken, expiryDate } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await GmailConnectionModel.deleteOne({ userId });
  }
}
