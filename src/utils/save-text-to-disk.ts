import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR, sanitizeFileName } from "./uploads-dir.js";

export async function saveTextToDisk(text: string, fileName = "text-input.txt"): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const savedName = `${randomUUID()}-${sanitizeFileName(fileName)}`;
  const filePath = path.join(UPLOADS_DIR, savedName);

  await writeFile(filePath, text, "utf-8");

  return filePath;
}
