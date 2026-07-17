import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";

export class UnauthorizedError extends AppError {
  constructor(message: string = ERROR_CODES.UNAUTHORIZED.message) {
    super(ERROR_CODES.UNAUTHORIZED.code, ERROR_CODES.UNAUTHORIZED.status, message);
  }
}
