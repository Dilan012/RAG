import { AppError } from "./app-error.js";
import { ERROR_CODES } from "./error-codes.js";

export class InternalError extends AppError {
  constructor(message: string = ERROR_CODES.INTERNAL_ERROR.message) {
    super(ERROR_CODES.INTERNAL_ERROR.code, ERROR_CODES.INTERNAL_ERROR.status, message);
  }
}
