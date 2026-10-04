import { createPool, attachPoolErrorLogging, connectPostgres, disconnectPostgres } from "./postgres.js";
import { runMigrations } from "./migrate.js";

const db = createPool();
attachPoolErrorLogging(db);
const deps = { db };

await connectPostgres(deps);
try {
  await runMigrations(deps);
} finally {
  await disconnectPostgres(deps);
}
