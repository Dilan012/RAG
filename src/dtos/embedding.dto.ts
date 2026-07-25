import { z } from "zod";
import { appConfig } from "../config/app-config.js";

export const ingestTextSchema = z.object({
  text: z
    .string()
    .min(1, "text is required")
    .max(
      appConfig.embedding.maxTextInputLength,
      `text must be at most ${appConfig.embedding.maxTextInputLength.toLocaleString()} characters`
    ),
});
export type IngestTextDto = z.infer<typeof ingestTextSchema>;
