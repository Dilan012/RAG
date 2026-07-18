import type { ZodType } from "zod";
import { ValidationError } from "../errors/index.js";

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join(", ");
    throw new ValidationError(message);
  }
  return result.data;
}
