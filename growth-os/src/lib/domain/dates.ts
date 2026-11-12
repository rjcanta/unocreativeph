/**
 * Calendar math in a workspace's IANA time zone.
 *
 * Calendar days are represented as "YYYY-MM-DD" strings (LocalDate) so that a
 * birthday is always "the 18th" for the agent, regardless of server time zone.
 * Instants (Date) are only produced when a message is placed on the timeline.
 */

export type LocalDate = string; // YYYY-MM-DD

export type LeapDayRule = "FEB_28" | "MAR_1";

const pad = (n: number) => String(n).padStart(2, "0");

export function makeLocalDate(year: number, month: number, day: number): LocalDate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseLocalDate(d: LocalDate): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid local date "${d}"`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  // Feb 29 is a valid birthday even though it is not valid every year.
  return day <= daysInMonth(2024, month);
}

/** Local calendar date of an instant in a time zone. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Local wall-clock hour (0–23) of an instant in a time zone. */
export function localHour(instant: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(instant);
  return Number(h) % 24;
}

function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` reads `date hour:minute`. */
export function zonedTimeToUtc(date: LocalDate, hour: number, minute: number, timeZone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let result = guess - tzOffsetMs(new Date(guess), timeZone);
  // Second pass handles DST transitions between guess and result.
  result = guess - tzOffsetMs(new Date(result), timeZone);
  return new Date(result);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return makeLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** b − a in whole days. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  const pa = parseLocalDate(a);
  const pb = parseLocalDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000,
  );
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function monthKey(date: LocalDate): string {
  return date.slice(0, 7);
}

/**
 * The calendar date a recurring month/day falls on in a given year.
 * Feb 29 observes on Feb 28 (default) or Mar 1 in non-leap years.
 */
export function occurrenceInYear(month: number, day: number, year: number, rule: LeapDayRule = "FEB_28"): LocalDate {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return rule === "FEB_28" ? makeLocalDate(year, 2, 28) : makeLocalDate(year, 3, 1);
  }
  return makeLocalDate(year, month, day);
}

/** Next occurrence on or after `from`. */
export function nextOccurrence(month: number, day: number, from: LocalDate, rule: LeapDayRule = "FEB_28"): LocalDate {
  const { year } = parseLocalDate(from);
  const thisYear = occurrenceInYear(month, day, year, rule);
  return diffDays(from, thisYear) >= 0 ? thisYear : occurrenceInYear(month, day, year + 1, rule);
}

/** Days until the next occurrence (0 = today). */
export function daysUntilNext(month: number, day: number, from: LocalDate, rule: LeapDayRule = "FEB_28"): number {
  return diffDays(from, nextOccurrence(month, day, from, rule));
}

/** Whole years between a start year and an occurrence (e.g. "3rd home anniversary"). */
export function anniversaryNumber(startYear: number, occurrence: LocalDate): number {
  return parseLocalDate(occurrence).year - startYear;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function formatLocalDate(date: LocalDate, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  const { year, month, day } = parseLocalDate(date);
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Date-only DB values are stored at UTC midnight; read them back as LocalDate. */
export function dateOnlyToLocal(d: Date): LocalDate {
  return makeLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function localToDateOnly(d: LocalDate): Date {
  const { year, month, day } = parseLocalDate(d);
  return new Date(Date.UTC(year, month - 1, day));
}
