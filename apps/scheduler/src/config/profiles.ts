import { env } from "./env.js";
import { createDbProfileSource } from "./dbProfileSource.js";
import { createJsonProfileSource } from "./jsonProfileSource.js";
import type { ProfileSource } from "./profileSource.js";

/**
 * Masks sensitive national document IDs for logs and public interfaces (P-SEC-02)
 * Example: 1234567890 -> ******7890
 */
export { maskDocumentNumber as maskDocument } from "@SMS/poller";

export type { ProfileSource };

type ProfileSourceConfig = {
  PROFILES_SOURCE: "json" | "db";
  DATABASE_URL?: string | undefined;
};

/**
 * Selects exactly one profile source. There is no silent fallback: if `db` is
 * requested without a database URL, startup fails loudly instead of serving
 * stale file data.
 */
export function createProfileSource(config: ProfileSourceConfig = env): ProfileSource {
  if (config.PROFILES_SOURCE === "db") {
    if (!config.DATABASE_URL) {
      throw new Error("[Profiles] PROFILES_SOURCE=db requires DATABASE_URL to be configured.");
    }
    return createDbProfileSource(config.DATABASE_URL);
  }

  return createJsonProfileSource();
}
