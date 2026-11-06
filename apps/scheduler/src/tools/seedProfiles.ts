import fs from "fs";
import path from "path";

import { createDb } from "@SMS/db";
import { user } from "@SMS/db/schema/auth";
import { profile } from "@SMS/db/schema/profiles";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { env } from "../config/env.js";
import { maskDocument } from "../config/profiles.js";
import { ProfileSchema } from "../types/index.js";

const ProfilesArraySchema = z.array(ProfileSchema);

async function seedProfiles() {
  const fileName = process.argv[2] ?? "profiles.json";
  const filePath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Profiles file not found: ${filePath}`);
  }

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed profiles.");
  }

  if (!env.PROFILES_OWNER_EMAIL) {
    throw new Error("PROFILES_OWNER_EMAIL is required to assign profile ownership.");
  }

  const profiles = ProfilesArraySchema.parse(JSON.parse(fs.readFileSync(filePath, "utf8")));
  const db = createDb({ DATABASE_URL: env.DATABASE_URL });

  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.email, env.PROFILES_OWNER_EMAIL))
    .limit(1);

  if (!owner) {
    throw new Error(
      `No user found for PROFILES_OWNER_EMAIL=${env.PROFILES_OWNER_EMAIL}. Create the account first.`,
    );
  }

  for (const record of profiles) {
    const { id, ...fields } = record;
    const values = { id, userId: owner.id, ...fields };

    await db
      .insert(profile)
      .values(values)
      .onConflictDoUpdate({
        target: profile.id,
        set: { userId: owner.id, ...fields },
      });

    console.log(
      `[SeedProfiles] Upserted ${record.displayName} (${record.documentType} ${maskDocument(record.documentNumber)})`,
    );
  }

  console.log(
    `[SeedProfiles] ${profiles.length} profiles assigned to ${owner.email} from ${filePath}`,
  );
}

seedProfiles().catch((error) => {
  console.error("[SeedProfiles] Failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
