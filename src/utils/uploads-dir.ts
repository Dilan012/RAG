import path from "node:path";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export function sanitizeFileName(fileName: string): string {
  // Strip path separators and anything else that could turn this into a path-traversal
  // attempt — only the base name, with a safe character set, survives.
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
}
