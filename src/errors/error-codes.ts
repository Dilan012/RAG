export const ERROR_CODES = {
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", status: 400, message: "Invalid request data" },
  EMAIL_ALREADY_EXISTS: {
    code: "EMAIL_ALREADY_EXISTS",
    status: 409,
    message: "A user with this email already exists",
  },
  INVALID_CREDENTIALS: { code: "INVALID_CREDENTIALS", status: 401, message: "Invalid email or password" },
  UNAUTHORIZED: { code: "UNAUTHORIZED", status: 401, message: "Authentication required" },
  NOT_FOUND: { code: "NOT_FOUND", status: 404, message: "Resource not found" },
  INTERNAL_ERROR: { code: "INTERNAL_ERROR", status: 500, message: "Something went wrong" },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
