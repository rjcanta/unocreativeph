import { describe, expect, it } from "vitest";
import { planContactSchedule, resolveSendInstant, type CandidateMessage } from "@/lib/domain/scheduling";
import { DEFAULT_SCHEDULING } from "@/lib/domain/settings";
import type { EligibilityResult } from "@/lib/domain/eligibility";

const ok = (): EligibilityResult => ({ eligible: true, code: "OK", reason: "ok" });
const rules = DEFAULT_SCHEDULING;

const nl = (date: string, key = `nl-${date}`): CandidateMessage => ({ key, category: "NEWSLETTER", date, label: "Newsletter" });
const ms = (date: string): CandidateMessage => ({ key: `bd-${date}`, category: "MILESTONE", date, label: "Birthday" });

describe("milestone priority", () => {
  it("postpones a newsletter that falls within 5 days of a birthday", () => {
    // Birthday Fri Nov 20 2026; newsletter Fri Nov 20 → postponed to after Nov 25.
    const out = planContactSchedule({ candidates: [nl("2026-11-20"), ms("2026-11-20")], committed: [], eligibility: ok, rules });
    const birthday = out.find((d) => d.category === "MILESTONE")!;
    const news = out.find((d) => d.category === "NEWSLETTER")!;
    expect(birthday.action).toBe("SCHEDULE");
    expect(birthday.date).toBe("2026-11-20");
    expect(news.action).toBe("POSTPONE");
    expect(news.date).toBe("2026-11-26");
    expect(news.reasons[0]).toMatch(/Postponed/);
  });

  it("considers already-committed milestones", () => {
    const out = planContactSchedule({
      candidates: [nl("2026-11-18")],
      committed: [{ key: "bd", category: "MILESTONE", date: "2026-11-16", label: "Birthday" }],
      eligibility: ok,
      rules,
    });
    expect(out[0].action).toBe("POSTPONE");
    expect(out[0].date).toBe("2026-11-23");
  });

  it("skips when no clear day remains in the month", () => {
    const out = planContactSchedule({ candidates: [nl("2026-11-27"), ms("2026-11-28")], committed: [], eligibility: ok, rules });
    expect(out.find((d) => d.category === "NEWSLETTER")!.action).toBe("SKIP");
  });

  it("supports a skip-instead-of-postpone rule", () => {
    const out = planContactSchedule({ candidates: [nl("2026-11-20"), ms("2026-11-19")], committed: [], eligibility: ok, rules: { ...rules, routineConflictAction: "SKIP" } });
    expect(out.find((d) => d.category === "NEWSLETTER")!.action).toBe("SKIP");
  });
});

describe("frequency caps", () => {
  it("allows at most two routine messages per month", () => {
    const out = planContactSchedule({
      candidates: [nl("2026-12-07", "a"), nl("2026-12-14", "b"), nl("2026-12-21", "c")],
      committed: [],
      eligibility: ok,
      rules: { ...rules, seasonalReplacesNewsletter: false },
    });
    expect(out.map((d) => d.action)).toEqual(["SCHEDULE", "SCHEDULE", "SKIP"]);
    expect(out[2].reasons.at(-1)).toMatch(/Monthly limit/);
  });

  it("counts already scheduled messages against the cap", () => {
    const out = planContactSchedule({
      candidates: [nl("2026-12-21")],
      committed: [
        { key: "x", category: "NEWSLETTER", date: "2026-12-07", label: "N" },
        { key: "y", category: "NEWSLETTER", date: "2026-12-14", label: "N" },
      ],
      eligibility: ok,
      rules,
    });
    expect(out[0].action).toBe("SKIP");
  });

  it("halves the cap for contacts who prefer reduced frequency", () => {
    const out = planContactSchedule({ candidates: [nl("2026-12-07", "a"), nl("2026-12-21", "b")], committed: [], eligibility: ok, rules, frequency: "REDUCED" });
    expect(out.map((d) => d.action)).toEqual(["SCHEDULE", "SKIP"]);
  });

  it("lets a seasonal campaign replace a nearby routine newsletter", () => {
    const out = planContactSchedule({
      candidates: [nl("2026-11-20"), { key: "q4", category: "SEASONAL", date: "2026-11-24", label: "Thanksgiving", replacesNewsletter: true }],
      committed: [],
      eligibility: ok,
      rules,
    });
    expect(out.find((d) => d.category === "SEASONAL")!.action).toBe("SCHEDULE");
    const news = out.find((d) => d.category === "NEWSLETTER")!;
    expect(news.action).toBe("SKIP");
    expect(news.reasons[0]).toMatch(/Replaced by seasonal/);
  });

  it("moves marketing off weekends", () => {
    const out = planContactSchedule({ candidates: [nl("2026-12-05")], committed: [], eligibility: ok, rules }); // Saturday
    expect(out[0].action).toBe("POSTPONE");
    expect(out[0].date).toBe("2026-12-07");
  });
});

describe("duplicate prevention and suppression", () => {
  it("never prepares the same message twice", () => {
    const out = planContactSchedule({
      candidates: [nl("2026-12-07", "same"), nl("2026-12-07", "same")],
      committed: [],
      eligibility: ok,
      rules,
    });
    expect(out.map((d) => d.action)).toEqual(["SCHEDULE", "SKIP"]);
    const again = planContactSchedule({ candidates: [nl("2026-12-07", "same")], committed: [{ key: "same", category: "NEWSLETTER", date: "2026-12-07", label: "N" }], eligibility: ok, rules });
    expect(again[0].action).toBe("SKIP");
  });

  it("suppresses ineligible contacts with the reason", () => {
    const out = planContactSchedule({
      candidates: [nl("2026-12-07")],
      committed: [],
      eligibility: () => ({ eligible: false, code: "UNSUBSCRIBED", reason: "Contact unsubscribed from email." }),
      rules,
    });
    expect(out[0].action).toBe("SUPPRESS");
    expect(out[0].reasons[0]).toMatch(/unsubscribed/);
  });
});

describe("send windows", () => {
  it("sends marketing at the window start in the workspace time zone", () => {
    const at = resolveSendInstant("2026-12-07", "NEWSLETTER", rules, "America/Phoenix", new Date("2026-11-12T00:00:00Z"));
    expect(at.toISOString()).toBe("2026-12-07T16:00:00.000Z");
  });

  it("moves a past slot to the next allowed day", () => {
    // Friday 2026-11-13 at 18:00 Phoenix (window closed) → Monday 9am.
    const at = resolveSendInstant("2026-11-13", "NEWSLETTER", rules, "America/Phoenix", new Date("2026-11-14T01:00:00Z"));
    expect(at.toISOString()).toBe("2026-11-16T16:00:00.000Z");
  });
});
