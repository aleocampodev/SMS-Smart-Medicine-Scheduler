import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "../..");
const repoRoot = path.resolve(packageRoot, "../..");

// Load a package-local .env first, then fill missing values from the monorepo
// root .env. This keeps `bun run dev:scheduler` (cwd = apps/scheduler) working
// without duplicating every variable into apps/scheduler/.env.
const envCandidates = [path.resolve(packageRoot, ".env"), path.resolve(repoRoot, ".env")];
const loadedEnvFiles = new Set<string>();

for (const envPath of envCandidates) {
  if (loadedEnvFiles.has(envPath) || !fs.existsSync(envPath)) continue;
  loadedEnvFiles.add(envPath);
  dotenv.config({ path: envPath, override: false });
}

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().default("mock_token"),
  TELEGRAM_CHAT_ID: z.string().default("mock_chat_id"),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().default(""),
  QANTY_SCHEDULE_URL: z
    .string()
    .url()
    .default("https://qanty.com/p/appointments/list_day_schedule"),
  QANTY_PORTAL_URL: z
    .string()
    .url()
    .default("https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy"),
  QANTY_COMPANY_CODE: z.string().default("Lpds45xBMVIpsXiSxaTy"),
  POLL_INTERVAL_SECONDS: z.coerce.number().min(5).default(45),
  PLAYWRIGHT_HEADLESS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  BROWSER_TIMEOUT_MS: z.coerce.number().default(30000),
  TARGET_START_DATE: z.string().optional(),
  TARGET_END_DATE: z.string().optional(),
  TARGET_BRANCH_ID: z.string().default("6035"),
  TARGET_BRANCH_NAME: z.string().default("Medellin"),
  TARGET_BRANCH_IDS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : ["6035", "118"],
    ),
});

export const env = EnvSchema.parse(process.env);
