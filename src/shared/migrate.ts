import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DbDeps } from "./types.js";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);

export async function runMigrations(deps: DbDeps): Promise<void> {
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    return;
  }

  const client = await deps.db.connect();
  try {
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      console.log(`[postgres] migration applied: ${file}`);
    }
  } finally {
    client.release();
  }
}
