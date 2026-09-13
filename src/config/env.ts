import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().default('mock_token'),
  TELEGRAM_CHAT_ID: z.string().default('mock_chat_id'),
  QANTY_SCHEDULE_URL: z.string().url().default('https://qanty.com/p/appointments/list_day_schedule'),
  QANTY_PORTAL_URL: z.string().url().default('https://qanty.com/portals/appointments?c=Lpds45xBMVIpsXiSxaTy'),
  QANTY_COMPANY_CODE: z.string().default('Lpds45xBMVIpsXiSxaTy'),
  POLL_INTERVAL_SECONDS: z.coerce.number().min(5).default(45),
  PLAYWRIGHT_HEADLESS: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  BROWSER_TIMEOUT_MS: z.coerce.number().default(30000),
  TARGET_START_DATE: z.string().optional(),
  TARGET_END_DATE: z.string().optional(),
  TARGET_BRANCH_ID: z.string().default('6035'),
  TARGET_BRANCH_NAME: z.string().default('Medellin'),
  TARGET_BRANCH_IDS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()) : ['6035'])),
});

export const env = EnvSchema.parse(process.env);

