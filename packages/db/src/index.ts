import { drizzle } from "drizzle-orm/node-postgres";

import type { DatabaseConfig } from "./config.js";
import { relations } from "./relations.js";

export function createDb(env: DatabaseConfig) {
  return drizzle(env.DATABASE_URL, { relations });
}

export type Database = ReturnType<typeof createDb>;
