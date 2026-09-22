import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BatchExportFiles } from "./export.js";

export function writeBatchExport(rootDir: string, built: BatchExportFiles): string {
  const dest = join(rootDir, built.dirName);
  mkdirSync(dest, { recursive: true });
  for (const [name, body] of Object.entries(built.files)) {
    writeFileSync(join(dest, name), body, "utf8");
  }
  return dest;
}
