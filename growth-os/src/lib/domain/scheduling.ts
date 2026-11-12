/**
 * Deterministic nurture scheduling. Given everything that *wants* to reach a
 * contact, decide what is actually sent, when, and why.
 *
 * Rule order (highest priority first):
 *  1. Never prepare the same message twice (idempotency key).
 *  2. Consent, preferences and suppression (see eligibility.ts).
 *  3. Personal milestone greetings take priority and keep their date.
 *  4. Seasonal campaigns yield to milestone windows (postponed past the window).
 *  5. A seasonal campaign replaces a routine newsletter sent near it.
 *  6. Routine newsletters inside a milestone window are postponed (or skipped).
 *  7. A monthly cap on routine marketing (newsletters + seasonal).
 *  8. Marketing goes out only on allowed weekdays, inside the sending window.
 *
 * Every decision carries human-readable reasons shown in the interface.
 */
import { addDays, dayOfWeek, diffDays, formatLocalDate, monthKey, type LocalDate, zonedTimeToUtc, toLocalDate, localHour } from "./dates";
import type { EligibilityResult, MessageCategory } from "./eligibility";
import type { SchedulingRules } from "./settings";

export type CandidateMessage = {
  key: string;
  category: MessageCategory;
  date: LocalDate;
  label: string;
  replacesNewsletter?: boolean;
};

export type CommittedMessage = {
  key: string;
  category: MessageCategory;
  date: LocalDate;
  label: string;
  replacesNewsletter?: boolean;
};

export type ScheduleAction = "SCHEDULE" | "POSTPONE" | "SKIP" | "SUPPRESS";

export type ScheduleDecision = {
  key: string;
  category: MessageCategory;
  label: string;
  action: ScheduleAction;
  requestedDate: LocalDate;
  date: LocalDate | null;
  reasons: string[];
};

export type PlanInput = {
  candidates: CandidateMessage[];
  /** Messages already scheduled or sent to this contact (not cancelled/skipped). */
  committed: CommittedMessage[];
  eligibility: (category: MessageCategory) => EligibilityResult;
  rules: SchedulingRules;
  /** REDUCED frequency preference halves the routine cap. */
  frequency?: string;
};

const fmt = (d: LocalDate) => formatLocalDate(d, { month: "short", day: "numeric", year: "numeric" });

const isRoutine = (c: MessageCategory) => c === "NEWSLETTER" || c === "SEASONAL";

function nearestMilestone(date: LocalDate, milestones: { date: LocalDate; label: string }[], buffer: number) {
  let best: { date: LocalDate; label: string; distance: number } | null = null;
  for (const m of milestones) {
    const distance = Math.abs(diffDays(m.date, date));
    if (distance <= buffer && (!best || distance < best.distance)) best = { ...m, distance };
  }
  return best;
}

function nextMarketingDay(date: LocalDate, rules: SchedulingRules): LocalDate {
  if (rules.marketingDays.length === 0) return date;
  let d = date;
  for (let i = 0; i < 7 && !rules.marketingDays.includes(dayOfWeek(d)); i++) d = addDays(d, 1);
  return d;
}

/**
 * Find the first marketing-eligible date on/after `start` that is clear of every
 * milestone window. Returns null if none exists before `limit` (exclusive month).
 */
function findClearDate(
  start: LocalDate,
  milestones: { date: LocalDate; label: string }[],
  rules: SchedulingRules,
  sameMonthAs: LocalDate,
): LocalDate | null {
  let d = nextMarketingDay(start, rules);
  for (let guard = 0; guard < 62; guard++) {
    if (monthKey(d) !== monthKey(sameMonthAs)) return null;
    const conflict = nearestMilestone(d, milestones, rules.milestoneBufferDays);
    if (!conflict) return d;
    d = nextMarketingDay(addDays(conflict.date, rules.milestoneBufferDays + 1), rules);
  }
  return null;
}

export function planContactSchedule(input: PlanInput): ScheduleDecision[] {
  const { rules } = input;
  const decisions: ScheduleDecision[] = [];
  const committedKeys = new Set(input.committed.map((c) => c.key));
  const seen = new Set<string>();

  const cap = input.frequency === "REDUCED" ? Math.min(1, rules.maxRoutinePerMonth) : rules.maxRoutinePerMonth;
  const routineCount = new Map<string, number>();
  for (const c of input.committed) {
    if (isRoutine(c.category)) routineCount.set(monthKey(c.date), (routineCount.get(monthKey(c.date)) ?? 0) + 1);
  }

  const milestones: { date: LocalDate; label: string }[] = input.committed
    .filter((c) => c.category === "MILESTONE")
    .map((c) => ({ date: c.date, label: c.label }));
  const seasonals: { date: LocalDate; label: string }[] = input.committed
    .filter((c) => c.category === "SEASONAL" && c.replacesNewsletter)
    .map((c) => ({ date: c.date, label: c.label }));

  const order: Record<MessageCategory, number> = { MILESTONE: 0, SEASONAL: 1, NEWSLETTER: 2 };
  const candidates = [...input.candidates].sort(
    (a, b) => order[a.category] - order[b.category] || a.date.localeCompare(b.date),
  );

  for (const cand of candidates) {
    const base = { key: cand.key, category: cand.category, label: cand.label, requestedDate: cand.date };

    if (committedKeys.has(cand.key) || seen.has(cand.key)) {
      decisions.push({ ...base, action: "SKIP", date: null, reasons: ["Already prepared for this contact — duplicate prevented."] });
      continue;
    }
    seen.add(cand.key);

    const elig = input.eligibility(cand.category);
    if (!elig.eligible) {
      decisions.push({ ...base, action: "SUPPRESS", date: null, reasons: [elig.reason] });
      continue;
    }

    if (cand.category === "MILESTONE") {
      milestones.push({ date: cand.date, label: cand.label });
      decisions.push({ ...base, action: "SCHEDULE", date: cand.date, reasons: ["Personal milestone greetings take priority and keep their date."] });
      continue;
    }

    const reasons: string[] = [];
    let date = cand.date;

    if (cand.category === "NEWSLETTER" && rules.seasonalReplacesNewsletter) {
      const replacing = seasonals.find((s) => Math.abs(diffDays(s.date, date)) <= rules.seasonalReplaceWindowDays);
      if (replacing) {
        decisions.push({
          ...base,
          action: "SKIP",
          date: null,
          reasons: [`Replaced by seasonal campaign "${replacing.label}" on ${fmt(replacing.date)} to avoid excessive communication.`],
        });
        continue;
      }
    }

    const conflict = nearestMilestone(date, milestones, rules.milestoneBufferDays);
    if (conflict) {
      const window = `${rules.milestoneBufferDays}-day window around the ${conflict.label.toLowerCase()} on ${fmt(conflict.date)}`;
      if (cand.category === "NEWSLETTER" && rules.routineConflictAction === "SKIP") {
        decisions.push({ ...base, action: "SKIP", date: null, reasons: [`Routine newsletter skipped: falls inside the ${window}.`] });
        continue;
      }
      const clear = findClearDate(addDays(conflict.date, rules.milestoneBufferDays + 1), milestones, rules, cand.date);
      if (!clear) {
        decisions.push({
          ...base,
          action: "SKIP",
          date: null,
          reasons: [`Falls inside the ${window}, and no clear sending day remains this month.`],
        });
        continue;
      }
      reasons.push(`Postponed from ${fmt(date)} to ${fmt(clear)}: routine marketing is held during the ${window}.`);
      date = clear;
    }

    const businessDay = nextMarketingDay(date, rules);
    if (businessDay !== date) {
      reasons.push(`Moved to ${fmt(businessDay)}, the next allowed marketing day.`);
      date = businessDay;
    }

    const mk = monthKey(date);
    const used = routineCount.get(mk) ?? 0;
    if (used >= cap) {
      decisions.push({
        ...base,
        action: "SKIP",
        date: null,
        reasons: [...reasons, `Monthly limit reached: ${used} of ${cap} routine messages already planned for ${mk}.`],
      });
      continue;
    }
    routineCount.set(mk, used + 1);
    if (cand.category === "SEASONAL" && cand.replacesNewsletter) seasonals.push({ date, label: cand.label });

    decisions.push({
      ...base,
      action: date === cand.date ? "SCHEDULE" : "POSTPONE",
      date,
      reasons: reasons.length ? reasons : ["No conflicts. Consent, preferences and frequency limits passed."],
    });
  }

  return decisions;
}

/**
 * Place a local send date on the timeline, inside the sending window.
 * If the slot has already passed today, send at the next window opening.
 */
export function resolveSendInstant(
  date: LocalDate,
  category: MessageCategory,
  rules: SchedulingRules,
  timeZone: string,
  now: Date,
): Date {
  const hour = category === "MILESTONE" ? rules.milestoneSendHour : rules.sendWindowStartHour;
  const target = zonedTimeToUtc(date, hour, 0, timeZone);
  if (target.getTime() >= now.getTime()) return target;

  const today = toLocalDate(now, timeZone);
  if (date === today && localHour(now, timeZone) < rules.sendWindowEndHour) {
    // Still inside today's window: send at the next quarter hour.
    const q = 15 * 60_000;
    return new Date(Math.ceil(now.getTime() / q) * q);
  }
  // Date is in the past or today's window has closed: next allowed day.
  let next = addDays(today, 1);
  if (category !== "MILESTONE") next = nextMarketingDay(next, rules);
  return zonedTimeToUtc(next, hour, 0, timeZone);
}

/** Is an instant inside the allowed sending window (local hours)? */
export function insideSendWindow(instant: Date, rules: SchedulingRules, timeZone: string): boolean {
  const h = localHour(instant, timeZone);
  return h >= Math.min(rules.sendWindowStartHour, rules.milestoneSendHour) && h < rules.sendWindowEndHour;
}

/** Newsletter send dates for a month based on configured days-of-month. */
export function newsletterDatesForMonth(year: number, month: number, rules: SchedulingRules): LocalDate[] {
  return rules.newsletterDays
    .slice(0, rules.maxRoutinePerMonth || 2)
    .map((d) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
}
