/**
 * Deterministic ranking for the daily relationship action queue.
 * Priority = urgency + explicit customer intent + relationship priority.
 */
import type { TaskType } from "./types";

export type RankInput = {
  type: TaskType;
  tier?: string | null;
  /** Days until due (negative = overdue). */
  daysUntilDue?: number | null;
  /** Explicit customer intent from a classified reply, if any. */
  intent?: string | null;
};

export type RankResult = { priority: number; reasons: string[] };

const INTENT_WEIGHT: Record<string, [number, string]> = {
  APPOINTMENT_REQUEST: [45, "Contact asked to meet or talk"],
  POTENTIAL_SELLER: [40, "Contact mentioned possibly selling"],
  POTENTIAL_BUYER: [38, "Contact mentioned possibly buying"],
  REFERRAL_OPPORTUNITY: [36, "Contact mentioned someone who may need an agent"],
  POTENTIAL_INVESTOR: [32, "Contact mentioned investing"],
  FUTURE_OPPORTUNITY: [22, "Contact mentioned a future real estate plan"],
  REQUIRES_ATTENTION: [25, "Reply needs a personal response"],
  NEGATIVE: [15, "Negative response — handle personally"],
};

const TIER_WEIGHT: Record<string, [number, string]> = {
  VIP: [20, "VIP relationship"],
  ACTIVE: [10, "Active relationship"],
  NEEDS_RECONNECTION: [8, "Relationship needs reconnection"],
  STANDARD: [4, "Standard relationship"],
};

const TYPE_WEIGHT: Partial<Record<TaskType, number>> = {
  REVIEW_REPLY: 10,
  REFERRAL_FOLLOW_UP: 10,
  FOLLOW_UP: 8,
  CALL: 8,
  GIFT: 6,
  PERSONAL_MESSAGE: 6,
  APPROVE_CAMPAIGN: 6,
  REVIEW_MESSAGE: 5,
  RECONNECT: 4,
  VERIFY_DATA: 2,
};

export function rankAction(input: RankInput): RankResult {
  const reasons: string[] = [];
  let score = TYPE_WEIGHT[input.type] ?? 4;

  if (input.intent && INTENT_WEIGHT[input.intent]) {
    const [w, r] = INTENT_WEIGHT[input.intent];
    score += w;
    reasons.push(r);
  }

  const d = input.daysUntilDue;
  if (d !== null && d !== undefined) {
    if (d < 0) {
      score += 30;
      reasons.push(`Overdue by ${-d} day${d === -1 ? "" : "s"}`);
    } else if (d === 0) {
      score += 26;
      reasons.push("Due today");
    } else if (d <= 2) {
      score += 20;
      reasons.push(`Due in ${d} day${d === 1 ? "" : "s"}`);
    } else if (d <= 7) {
      score += 12;
      reasons.push(`Due this week (${d} days)`);
    } else {
      score += 4;
    }
  }

  if (input.tier && TIER_WEIGHT[input.tier]) {
    const [w, r] = TIER_WEIGHT[input.tier];
    score += w;
    reasons.push(r);
  }

  return { priority: Math.max(0, Math.min(100, score)), reasons };
}
