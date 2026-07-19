import { z } from "zod";

export const ingestTextSchema = z.object({
  text: z.string().min(1, "text is required").max(200_000, "text must be at most 200,000 characters"),
});
export type IngestTextDto = z.infer<typeof ingestTextSchema>;
