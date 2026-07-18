import { z } from "zod";
import { objectIdSchema } from "./common.dto.js";

export const listMessagesQuerySchema = z.object({
  conversationId: objectIdSchema,
});
export type ListMessagesQueryDto = z.infer<typeof listMessagesQuerySchema>;
