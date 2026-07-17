import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";

export class EmailAlreadyExistsError extends AppError {
  constructor(message: string = ERROR_CODES.EMAIL_ALREADY_EXISTS.message) {
    super(ERROR_CODES.EMAIL_ALREADY_EXISTS.code, ERROR_CODES.EMAIL_ALREADY_EXISTS.status, message);
  }
}
