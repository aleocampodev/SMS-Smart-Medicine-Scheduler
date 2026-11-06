import { createDb } from "@SMS/db";
import { createProfileRepository } from "@SMS/db/repositories/profiles";

import { ProfileSchema, type Profile } from "../types/index.js";
import type { ProfileSource } from "./profileSource.js";

/**
 * Postgres-backed source. Reads are installation-wide (decision 2a): the
 * scheduler is a single system process, not a user session.
 */
export function createDbProfileSource(databaseUrl: string): ProfileSource {
  const db = createDb({ DATABASE_URL: databaseUrl });
  const repository = createProfileRepository(db);

  const toProfile = (record: unknown): Profile => ProfileSchema.parse(record);

  return {
    async list(): Promise<Profile[]> {
      const records = await repository.listAll();
      return records.map(toProfile);
    },

    async getById(id: string): Promise<Profile | undefined> {
      const record = await repository.getById(id);
      return record ? toProfile(record) : undefined;
    },
  };
}
