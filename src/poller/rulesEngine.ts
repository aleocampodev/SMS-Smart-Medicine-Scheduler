import { QantySlot, RuleEvaluationResult } from "../types/index.js";
import {
  evaluateRules,
  filterUnnotified,
  todayLocalString,
} from "../../packages/poller/src/rules.js";

// Thin OOP adapter over the functional core in packages/poller.
// New code must use evaluateRules/filterUnnotified directly; this class
// remains only for backward compatibility with bot/tests.
export class RulesEngine {
  private notifiedSlots: Set<string> = new Set();

  public evaluate(
    rawItems: any[],
    context?: { branchId?: string; branchName?: string },
  ): RuleEvaluationResult {
    return evaluateRules(rawItems, todayLocalString(), context);
  }

  public filterUnnotifiedSlots(slots: QantySlot[]): QantySlot[] {
    const { newSlots, seen } = filterUnnotified(slots, this.notifiedSlots);
    this.notifiedSlots = seen;
    return newSlots;
  }
}
