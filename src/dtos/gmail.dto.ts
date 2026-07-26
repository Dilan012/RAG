import { z } from "zod";

export const gmailCallbackQuerySchema = z.object({
  code: z.string().min(1, "code is required"),
  state: z.string().min(1, "state is required"),
});
export type GmailCallbackQueryDto = z.infer<typeof gmailCallbackQuerySchema>;
