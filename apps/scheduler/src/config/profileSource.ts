import type { Profile } from "../types/index.js";

/**
 * Read boundary for the people the scheduler can book for.
 *
 * Implementations must never expose more than the profile contract in
 * `types/index.ts`; the caller decides how to mask PII when logging.
 */
export interface ProfileSource {
  list(): Promise<Profile[]>;
  getById(id: string): Promise<Profile | undefined>;
}
