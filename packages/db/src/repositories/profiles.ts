import { asc, eq } from "drizzle-orm";

import type { Database } from "../index.js";
import { profile } from "../schema/profiles.js";

export type ProfileRecord = typeof profile.$inferSelect;

/**
 * Data-access boundary for the `profile` table.
 *
 * `listAll` and `getById` are installation-wide reads used by the background
 * scheduler (single-owner model, decision 2a). `listByUser` is the scoped read
 * used by authenticated API procedures.
 */
export function createProfileRepository(db: Database) {
  return {
    async listAll(): Promise<ProfileRecord[]> {
      return db.select().from(profile).orderBy(asc(profile.createdAt));
    },

    async listByUser(userId: string): Promise<ProfileRecord[]> {
      return db
        .select()
        .from(profile)
        .where(eq(profile.userId, userId))
        .orderBy(asc(profile.createdAt));
    },

    async getById(id: string): Promise<ProfileRecord | undefined> {
      const [record] = await db.select().from(profile).where(eq(profile.id, id)).limit(1);
      return record;
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
