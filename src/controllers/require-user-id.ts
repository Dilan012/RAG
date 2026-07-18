import type { Request } from "express";
import { UnauthorizedError } from "../errors/index.js";

/** Reads the user id attached by `authMiddleware`; throws if the route somehow ran without it. */
export function requireUserId(req: Request): string {
  if (!req.userId) {
    throw new UnauthorizedError();
  }
  return req.userId;
}
