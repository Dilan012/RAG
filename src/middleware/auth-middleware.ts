import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/index.js";

export function createAuthMiddleware(jwtSecret: string) {
  return function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or malformed Authorization header");
    }

    const token = header.slice("Bearer ".length);

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    if (typeof payload.sub !== "string") {
      throw new UnauthorizedError("Invalid token payload");
    }

    req.userId = payload.sub;
    next();
  };
}
