import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";

export class NotFoundError extends AppError {
  constructor(message: string = ERROR_CODES.NOT_FOUND.message) {
    super(ERROR_CODES.NOT_FOUND.code, ERROR_CODES.NOT_FOUND.status, message);
  }
}
