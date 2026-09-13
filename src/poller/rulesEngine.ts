import { QantySlot, RuleEvaluationResult } from '../types/index.js';

export class RulesEngine {
  // Stores hashes/IDs of already notified slots to avoid repeating alerts every cycle
  private notifiedSlots: Set<string> = new Set();

  /**
   * Formats today's date as YYYY-MM-DD in local time
   */
  private getTodayString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * Evaluates the 3 business rules from the specification:
   * 1. Multiplicity: Returns more than two items/slots (> 2)
   * 2. Availability: status === 'free' (or 'available')
   * 3. Future Date: date !== current date (excludes same-day slots)
   */
  public evaluate(rawItems: any[], context?: { branchId?: string; branchName?: string }): RuleEvaluationResult {
    const reasons: string[] = [];
    const todayStr = this.getTodayString();

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

      // Rule 2: status is 'free', 'available', 'disponible', or Qanty's 'waiting'
      const isFree =
        status === 'free' ||
        status === 'available' ||
        status === 'disponible' ||
        status === 'waiting';

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
      `Passes Rules 2 & 3: found ${matchingSlots.length} available slots for future dates`,
    );

    return {
      hasAvailability: true,
      matchingSlots,
      reasons,
    };
  }

  /**
   * Filters out slots that have already been notified
   */
  public filterUnnotifiedSlots(slots: QantySlot[]): QantySlot[] {
    const newSlots = slots.filter((slot) => {
      const key = `${slot.date}_${slot.time}_${slot.id}`;
      if (this.notifiedSlots.has(key)) {
        return false;
      }
      this.notifiedSlots.add(key);
      return true;
    });

    // Memory management: purge cache if size exceeds 5000 entries
    if (this.notifiedSlots.size > 5000) {
      this.notifiedSlots.clear();
    }

    return newSlots;
  }
}
