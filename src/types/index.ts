import { z } from 'zod';

export const ProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  documentType: z.enum(['CC', 'TI', 'CE', 'PASAPORTE', 'RC']).default('CC'),
  documentNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthDate: z.string(), // YYYY-MM-DD
  phone: z.string(),
  email: z.string().email(),
  healthEntity: z.string().optional(),
  prescriptionCode: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export interface QantySlot {
  id?: string | number;
  date: string; // ej. 2026-09-15
  time?: string; // ej. 08:30
  status: string; // ej. "free", "occupied", etc.
  branch?: string; // sede
  specialty?: string;
  raw?: Record<string, any>;
}

export interface RuleEvaluationResult {
  hasAvailability: boolean;
  matchingSlots: QantySlot[];
  reasons: string[];
}

export interface BookingResult {
  success: boolean;
  profileId: string;
  slotDate: string;
  slotTime?: string;
  message: string;
  screenshotPath?: string;
  confirmationCode?: string;
}
