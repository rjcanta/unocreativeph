import { describe, expect, it } from "vitest";
import { classifyReplyWithRules } from "@/lib/ai/rules-classifier";
import { replyClassificationSchema, newsletterDraftSchema } from "@/lib/ai/schemas";
import { findUnverifiedStatistics } from "@/lib/ai/grounding";
import { MockAiProvider, OpenAiProvider } from "@/lib/ai/provider";
import { brandVoiceSchema } from "@/lib/domain/settings";
import { mapHeaders, parseCsv, parseMonthDay, validateRows } from "@/lib/domain/csv";
import { rankAction } from "@/lib/domain/ranking";

const cls = (text: string) => classifyReplyWithRules({ text, firstName: "Sam" });

describe("AI classification validation", () => {
  it("classifies the potential-seller example with timeframe", () => {
    const r = cls("We may sell next year because we're planning to move.");
    expect(r.classification).toBe("POTENTIAL_SELLER");
    expect(r.timeframe).toBe("next year");
    expect(replyClassificationSchema.safeParse(r).success).toBe(true);
  });

  it("detects referrals, buyers, investors, appointments and opt-outs", () => {
    expect(cls("My sister is relocating to Phoenix this spring and needs an agent.").classification).toBe("REFERRAL_OPPORTUNITY");
    expect(cls("We're starting to look for a bigger home.").classification).toBe("POTENTIAL_BUYER");
    expect(cls("Thinking about buying a rental property.").classification).toBe("POTENTIAL_INVESTOR");
    expect(cls("Can we grab coffee next week?").classification).toBe("APPOINTMENT_REQUEST");
    expect(cls("Please unsubscribe me.").classification).toBe("OPT_OUT");
    expect(cls("STOP").classification).toBe("OPT_OUT");
    expect(cls("Thank you so much, this made my day!").classification).toBe("GENERAL_FRIENDLY");
  });

  it("puts sensitive personal news ahead of opportunity language", () => {
    expect(cls("My father passed away and we may need to sell his house.").classification).toBe("REQUIRES_ATTENTION");
  });

  it("rejects malformed model output", () => {
    expect(replyClassificationSchema.safeParse({ classification: "DEFINITELY_BUYING", confidence: 2 }).success).toBe(false);
  });

  it("flags statistics that are not in verified data", () => {
    expect(findUnverifiedStatistics("Prices rose 7.5% and the median is $480,000.", null)).toEqual(["7.5%", "$480,000"]);
    expect(findUnverifiedStatistics("Prices rose 7.5% this year.", "Per ARMLS, prices rose 7.5% year over year.")).toEqual([]);
  });

  it("produces valid evergreen mock newsletters without statistics", async () => {
    const r = await new MockAiProvider().generateNewsletter({ kind: "MARKET_INSIGHTS", month: 11, monthLabel: "November 2026", brand: brandVoiceSchema.parse({}), topics: [] });
    expect(newsletterDraftSchema.safeParse(r.data).success).toBe(true);
    expect(findUnverifiedStatistics(r.data.body, null)).toEqual([]);
  });

  it("falls back to deterministic output when the model returns invalid JSON or fabricated stats", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ subject: "Hi", previewText: "", body: "Homes sold 12% faster this month and the median hit $500,000, a record for the area overall.", topicsCovered: [], notes: [] }) } }] }), { status: 200 })) as unknown as typeof fetch;
    const p = new OpenAiProvider("test", "test-model", fakeFetch);
    const r = await p.generateNewsletter({ kind: "MARKET_INSIGHTS", month: 11, monthLabel: "November 2026", brand: brandVoiceSchema.parse({}), topics: [] });
    expect(r.source).toBe("AI_MOCK");
    expect(r.warnings[0]).toMatch(/rejected/);
  });

  it("enforces opt-out even when the model disagrees", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ classification: "GENERAL_FRIENDLY", secondary: [], confidence: 0.9, summary: "Friendly", timeframe: null, mentionedPerson: null, evidenceQuote: "Thanks", recommendedAction: "Say thanks", suggestedReply: "Thanks!" }) } }] }), { status: 200 })) as unknown as typeof fetch;
    const r = await new OpenAiProvider("k", "m", fakeFetch).classifyReply({ text: "Thanks, but please remove me from your list.", firstName: "Sam", contactType: "SPHERE", tier: "STANDARD", brand: brandVoiceSchema.parse({}) });
    expect(r.data.classification).toBe("OPT_OUT");
  });
});

describe("CSV import parsing", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });

  it("maps common header variants and validates rows", () => {
    const rows = parseCsv("First Name,Last Name,E-mail,Type,Birthday,Close Date,Email Consent\nAna,Diaz,ana@example.com,Past Client,02/29,2021-06-15,yes\n,NoFirst,bad-email,friend,13/45,2099-01-01,");
    const mapping = mapHeaders(rows[0]);
    expect(mapping.map((m) => m.field)).toEqual(["firstName", "lastName", "email", "contactType", "birthday", "closingDate", "emailConsent"]);
    const [good, bad] = validateRows(rows.slice(1), mapping, "2026-11-12");
    expect(good.errors).toEqual([]);
    expect(good.row).toMatchObject({ contactType: "PAST_CLIENT", birthdayMonth: 2, birthdayDay: 29, closingDate: "2021-06-15", emailConsent: "GRANTED" });
    expect(bad.errors.length).toBeGreaterThanOrEqual(4);
    expect(bad.row.contactType).toBe("SPHERE");
  });

  it("parses birthday formats", () => {
    expect(parseMonthDay("March 4")).toEqual({ month: 3, day: 4, year: null });
    expect(parseMonthDay("1985-07-09")).toEqual({ month: 7, day: 9, year: 1985 });
    expect(parseMonthDay("02/29/2023")).toBeNull();
  });
});

describe("action ranking", () => {
  it("ranks explicit intent and urgency above routine work", () => {
    const seller = rankAction({ type: "REVIEW_REPLY", tier: "STANDARD", intent: "POTENTIAL_SELLER", daysUntilDue: 0 });
    const verify = rankAction({ type: "VERIFY_DATA", tier: "STANDARD", daysUntilDue: 10 });
    expect(seller.priority).toBeGreaterThan(verify.priority);
    expect(seller.reasons).toContain("Contact mentioned possibly selling");
  });
});

describe("referral precision", () => {
  it("does not treat a destination mention as a referral", () => {
    expect(classifyReplyWithRules({ text: "We may sell next year because we're planning to move closer to my parents in Tucson.", firstName: "A" }).classification).toBe("POTENTIAL_SELLER");
  });
  it("detects a third person doing the real estate activity", () => {
    expect(classifyReplyWithRules({ text: "My coworker is moving to Tempe and asked if I knew a good agent.", firstName: "A" }).classification).toBe("REFERRAL_OPPORTUNITY");
  });
});
