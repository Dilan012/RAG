import { injectable } from "tsyringe";
import { UserModel, type UserDocument } from "../models/user.js";
import type { UserRepositoryInterface } from "./interfaces/user-repository.interface.js";

@injectable()
export class UserRepository implements UserRepositoryInterface {
  async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).lean();
  }

  async create(document: Omit<UserDocument, "_id" | "createdAt">): Promise<UserDocument> {
    const user = await UserModel.create(document);
    return user.toObject();
  }
}
