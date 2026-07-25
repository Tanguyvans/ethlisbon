import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

// better-sqlite3 is synchronous and file-backed, which is perfect for a single-process
// Next.js server holding one Hedera operator/treasury account. Not meant to scale past a
// hackathon demo (no connection pooling / multi-instance story), see README for notes on
// swapping this for a hosted DB in production.

declare global {
  var __tokenizationDb: Database.Database | undefined;
}

function openDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH ?? "./data/tokenization.db";
  const resolved = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(/* turbopackIgnore: true */ process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);

  return db;
}

// Cache the connection on `globalThis` so Next.js dev-mode module reloads (and route handler
// invocations, which each re-import this module) reuse a single open SQLite file handle.
export function getDb(): Database.Database {
  if (!globalThis.__tokenizationDb) {
    globalThis.__tokenizationDb = openDb();
  }
  return globalThis.__tokenizationDb;
}
