import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const listMessagesQuerySchema = z.object({
  conversationId: objectIdSchema,
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
