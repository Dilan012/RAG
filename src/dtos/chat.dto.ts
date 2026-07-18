import { z } from "zod";
import { objectIdSchema } from "./common.dto.js";

export const chatSchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: objectIdSchema.optional(),
});
export type ChatDto = z.infer<typeof chatSchema>;
