import { z } from "zod";
import { objectIdSchema } from "./common.dto.js";

export const conversationIdParamSchema = z.object({
  id: objectIdSchema,
});
export type ConversationIdParamDto = z.infer<typeof conversationIdParamSchema>;

export const createConversationSchema = z.object({
  name: z.string().min(1, "name is required"),
});
export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z.object({
  name: z.string().min(1, "name is required"),
});
export type UpdateConversationDto = z.infer<typeof updateConversationSchema>;
