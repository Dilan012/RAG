import { z } from "zod";
import { objectIdSchema } from "./common.schema.js";

export const conversationIdParamSchema = z.object({
  id: objectIdSchema,
});
export type ConversationIdParam = z.infer<typeof conversationIdParamSchema>;

export const createConversationSchema = z.object({
  name: z.string().min(1, "name is required"),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z.object({
  name: z.string().min(1, "name is required"),
});
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
