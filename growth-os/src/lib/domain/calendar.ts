/**
 * Market holiday calendars and default seasonal campaign dates.
 * Dates are computed (not hard-coded per year) so they stay correct forever.
 */
import { addDays, dayOfWeek, makeLocalDate, type LocalDate } from "./dates";
import type { SeasonalKind } from "./types";

function nthWeekday(year: number, month: number, weekday: number, n: number): LocalDate {
  let d = makeLocalDate(year, month, 1);
  while (dayOfWeek(d) !== weekday) d = addDays(d, 1);
  return addDays(d, (n - 1) * 7);
}

function lastWeekday(year: number, month: number, weekday: number): LocalDate {
  let d = addDays(makeLocalDate(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1), -1);
  while (dayOfWeek(d) !== weekday) d = addDays(d, -1);
  return d;
}

export type Holiday = { key: string; name: string; date: LocalDate };

export const MARKETS = {
  "US-AZ": { label: "Arizona (America/Phoenix)", timezone: "America/Phoenix" },
  "US-GENERAL": { label: "United States (general)", timezone: "America/Chicago" },
} as const;
export type MarketKey = keyof typeof MARKETS;

export function holidaysFor(year: number, market: string): Holiday[] {
  const list: Holiday[] = [
    { key: "NEW_YEAR", name: "New Year's Day", date: makeLocalDate(year, 1, 1) },
    { key: "MLK", name: "Martin Luther King Jr. Day", date: nthWeekday(year, 1, 1, 3) },
    { key: "VALENTINES", name: "Valentine's Day", date: makeLocalDate(year, 2, 14) },
    { key: "MOTHERS_DAY", name: "Mother's Day", date: nthWeekday(year, 5, 0, 2) },
    { key: "MEMORIAL", name: "Memorial Day", date: lastWeekday(year, 5, 1) },
    { key: "FATHERS_DAY", name: "Father's Day", date: nthWeekday(year, 6, 0, 3) },
    { key: "INDEPENDENCE", name: "Independence Day", date: makeLocalDate(year, 7, 4) },
    { key: "LABOR", name: "Labor Day", date: nthWeekday(year, 9, 1, 1) },
    { key: "VETERANS", name: "Veterans Day", date: makeLocalDate(year, 11, 11) },
    { key: "THANKSGIVING", name: "Thanksgiving", date: nthWeekday(year, 11, 4, 4) },
    { key: "CHRISTMAS", name: "Christmas Day", date: makeLocalDate(year, 12, 25) },
  ];
  if (market === "US-AZ") {
    list.push({ key: "MONSOON_START", name: "Arizona monsoon season begins", date: makeLocalDate(year, 6, 15) });
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export const SEASONAL_DEFAULTS: Record<SeasonalKind, { name: string; quarter: string; describe: string }> = {
  SEASONAL_Q1: { name: "New Year Relationship Check-In", quarter: "Q1", describe: "Second Tuesday of January" },
  SEASONAL_Q2: { name: "Spring Homeowner Appreciation", quarter: "Q2", describe: "Third Tuesday of April" },
  SEASONAL_Q3: { name: "Summer Community Connection", quarter: "Q3", describe: "Tuesday after Independence Day (June in Arizona, before peak heat)" },
  SEASONAL_Q4: { name: "Thanksgiving / Client Appreciation", quarter: "Q4", describe: "Monday of Thanksgiving week" },
};

export function defaultSeasonalDate(kind: SeasonalKind, year: number, market: string): LocalDate {
  switch (kind) {
    case "SEASONAL_Q1":
      return nthWeekday(year, 1, 2, 2);
    case "SEASONAL_Q2":
      return nthWeekday(year, 4, 2, 3);
    case "SEASONAL_Q3":
      return market === "US-AZ" ? nthWeekday(year, 6, 2, 2) : addDays(makeLocalDate(year, 7, 4), ((2 - dayOfWeek(makeLocalDate(year, 7, 4)) + 7) % 7) || 7);
    case "SEASONAL_Q4":
      return addDays(nthWeekday(year, 11, 4, 4), -3);
  }
}
