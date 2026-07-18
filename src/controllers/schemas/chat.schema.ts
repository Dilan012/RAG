import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1, "message is required"),
});
export type ChatInput = z.infer<typeof chatSchema>;
