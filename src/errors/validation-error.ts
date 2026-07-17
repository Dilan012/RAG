import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";

export class ValidationError extends AppError {
  constructor(message: string = ERROR_CODES.VALIDATION_ERROR.message) {
    super(ERROR_CODES.VALIDATION_ERROR.code, ERROR_CODES.VALIDATION_ERROR.status, message);
  }
}
