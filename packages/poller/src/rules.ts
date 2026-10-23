export interface QantySlot {
  id?: string | number;
  date: string;
  time?: string;
  status: string;
  branch?: string;
  specialty?: string;
  raw?: Record<string, any>;
}

export interface RuleEvaluationResult {
  hasAvailability: boolean;
  matchingSlots: QantySlot[];
  reasons: string[];
}

export function todayLocalString(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Evaluates the 3 business rules from the specification:
 * 1. Multiplicity: Returns more than two items/slots (> 2)
 * 2. Availability: status === 'free' (or 'available' / 'disponible')
 * 3. Future Date: date !== current date (excludes same-day slots)
 */
export function evaluateRules(
  rawItems: any[],
  todayStr: string = todayLocalString(),
  context?: { branchId?: string; branchName?: string }
): RuleEvaluationResult {
  const reasons: string[] = [];

  // Rule 1: Array contains more than 2 items
  if (!Array.isArray(rawItems) || rawItems.length <= 2) {
    return {
      hasAvailability: false,
      matchingSlots: [],
      reasons: [`Fails Rule 1: received ${rawItems?.length || 0} items (expected > 2)`],
    };
  }

  reasons.push(`Passes Rule 1: items count (${rawItems.length}) > 2`);

  // Parse and evaluate Rule 2 and Rule 3
  const matchingSlots: QantySlot[] = [];

  for (const item of rawItems) {
    const status = (item.status || item.state || '').toString().toLowerCase();
    const slotDate = (item.date || item.appointment_date || item.day || '').toString().split('T')[0];
    const slotTime = (item.time || item.hour || item.start_time || '').toString();
    const branchPrefix = context?.branchId ? `${context.branchId}_` : '';
    const slotId = item.id || item.slot_id || `${branchPrefix}${slotDate}_${slotTime}`;

    // Rule 2: status is strictly 'free', 'available', or 'disponible'
    // In Qanty, unallocated slots strictly have status 'FREE'.
    // Statuses 'WAITING', 'RESERVED', 'SERVING', and 'FINISHED' indicate occupied/in-progress slots.
    const isFree =
      status === 'free' ||
      status === 'available' ||
      status === 'disponible';

    // Rule 3: date is different from today (future slot)
    const isDifferentDate = Boolean(slotDate && slotDate !== todayStr);

    if (isFree && isDifferentDate) {
      const branchLabel =
        item.branch ||
        item.location ||
        (context?.branchId ? `Medellin (Branch ${context.branchId})` : 'Main Branch');

      matchingSlots.push({
        id: slotId,
        date: slotDate,
        time: slotTime,
        status,
        branch: branchLabel,
        specialty: item.specialty || item.service || 'Medicine Dispensing',
        raw: { ...item, branch_id: context?.branchId },
      });
    }
  }

  if (matchingSlots.length === 0) {
    return {
      hasAvailability: false,
      matchingSlots: [],
      reasons: [
        ...reasons,
        'Fails Rule 2 or 3: no free slots found for dates different from today',
      ],
    };
  }

  reasons.push(
    `Passes Rules 2 & 3: found ${matchingSlots.length} available slots for future dates`
  );

  return {
    hasAvailability: true,
    matchingSlots,
    reasons,
  };
}

/**
 * Pure function: filters out slots that have already been notified
 */
export function filterUnnotified(
  slots: QantySlot[],
  seenSet: Set<string>
): { newSlots: QantySlot[]; seen: Set<string> } {
  const seen = new Set(seenSet);
  const newSlots = slots.filter((slot) => {
    const key = `${slot.date}_${slot.time}_${slot.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Memory management: purge cache if size exceeds 5000 entries
  if (seen.size > 5000) {
    seen.clear();
  }

  return { newSlots, seen };
}
