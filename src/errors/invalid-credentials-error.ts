import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";

export class InvalidCredentialsError extends AppError {
  constructor(message: string = ERROR_CODES.INVALID_CREDENTIALS.message) {
    super(ERROR_CODES.INVALID_CREDENTIALS.code, ERROR_CODES.INVALID_CREDENTIALS.status, message);
  }
}
