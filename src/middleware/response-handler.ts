import type { NextFunction, Request, Response } from "express";

export function responseHandler(_req: Request, res: Response, next: NextFunction): void {
  res.success = function <T>(data: T, statusCode = 200): void {
    res.status(statusCode).json({ success: true, data });
  };
  next();
}
