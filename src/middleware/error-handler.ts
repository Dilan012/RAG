import type { NextFunction, Request, Response } from "express";
import { AppError, ERROR_CODES } from "../errors/index.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(ERROR_CODES.INTERNAL_ERROR.status).json({
    success: false,
    error: ERROR_CODES.INTERNAL_ERROR.message,
    code: ERROR_CODES.INTERNAL_ERROR.code,
  });
}
