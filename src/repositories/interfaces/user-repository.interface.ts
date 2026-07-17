import type { UserDocument } from "../../models/user.js";

export interface UserRepositoryInterface {
  findByEmail(email: string): Promise<UserDocument | null>;
  create(document: Omit<UserDocument, "_id" | "createdAt">): Promise<UserDocument>;
}
