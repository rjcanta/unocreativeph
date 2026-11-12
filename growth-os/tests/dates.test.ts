import { describe, expect, it } from "vitest";
import {
  addDays, anniversaryNumber, daysUntilNext, isLeapYear, nextOccurrence, occurrenceInYear, toLocalDate, zonedTimeToUtc, diffDays,
} from "@/lib/domain/dates";

describe("birthday scheduling", () => {
  it("finds the next birthday without needing a birth year", () => {
    expect(nextOccurrence(11, 18, "2026-11-12")).toBe("2026-11-18");
    expect(nextOccurrence(3, 4, "2026-11-12")).toBe("2027-03-04");
    expect(daysUntilNext(11, 12, "2026-11-12")).toBe(0);
  });

  it("rolls into next year once the day has passed", () => {
    expect(nextOccurrence(11, 11, "2026-11-12")).toBe("2027-11-11");
  });
});

describe("leap-year birthdays", () => {
  it("knows leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it("observes Feb 29 on Feb 28 in non-leap years by default", () => {
    expect(occurrenceInYear(2, 29, 2027)).toBe("2027-02-28");
    expect(occurrenceInYear(2, 29, 2028)).toBe("2028-02-29");
    expect(nextOccurrence(2, 29, "2026-11-12")).toBe("2027-02-28");
  });

  it("supports a March 1 observance rule", () => {
    expect(occurrenceInYear(2, 29, 2027, "MAR_1")).toBe("2027-03-01");
    expect(nextOccurrence(2, 29, "2027-03-01", "MAR_1")).toBe("2027-03-01");
  });

  it("does not skip Feb 28 birthdays", () => {
    expect(occurrenceInYear(2, 28, 2027)).toBe("2027-02-28");
  });
});

describe("home anniversaries", () => {
  it("computes the anniversary number from the closing year", () => {
    const occ = nextOccurrence(11, 20, "2026-11-12");
    expect(occ).toBe("2026-11-20");
    expect(anniversaryNumber(2021, occ)).toBe(5);
  });
});

describe("time zones", () => {
  it("places 9am Phoenix at 16:00 UTC (no DST)", () => {
    expect(zonedTimeToUtc("2026-07-01", 9, 0, "America/Phoenix").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-15", 9, 0, "America/Phoenix").toISOString()).toBe("2026-01-15T16:00:00.000Z");
  });

  it("handles DST zones", () => {
    expect(zonedTimeToUtc("2026-07-01", 9, 0, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-15", 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("reads the local calendar date of an instant", () => {
    expect(toLocalDate(new Date("2026-11-13T05:00:00Z"), "America/Phoenix")).toBe("2026-11-12");
  });

  it("does date arithmetic across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(diffDays("2026-11-12", "2026-11-18")).toBe(6);
  });
});
