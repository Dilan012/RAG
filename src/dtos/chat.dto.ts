import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1, "message is required"),
});
export type ChatDto = z.infer<typeof chatSchema>;
