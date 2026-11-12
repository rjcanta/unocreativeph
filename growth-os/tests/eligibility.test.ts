import { describe, expect, it } from "vitest";
import { checkEligibility, type EligibilityContact } from "@/lib/domain/eligibility";

const compliance = { smsEnabled: false, smsLegalReviewCompletedAt: null };
const granted = (purpose = "MARKETING", at = "2025-01-01") => ({ channel: "EMAIL", purpose, status: "GRANTED", source: "test", capturedAt: new Date(at) });

const base: EligibilityContact = {
  email: "a@example.com",
  phone: null,
  doNotContact: false,
  unsubscribedAt: null,
  consents: [granted()],
};

describe("consent restrictions", () => {
  it("allows marketing with recorded consent", () => {
    expect(checkEligibility(base, "NEWSLETTER", "EMAIL", compliance).eligible).toBe(true);
  });

  it("does not assume consent for past clients", () => {
    const r = checkEligibility({ ...base, consents: [] }, "NEWSLETTER", "EMAIL", compliance);
    expect(r.eligible).toBe(false);
    expect(r.code).toBe("NO_CONSENT");
  });

  it("uses the latest consent record", () => {
    const revoked = { ...granted(), status: "REVOKED", capturedAt: new Date("2026-01-01") };
    expect(checkEligibility({ ...base, consents: [granted(), revoked] }, "NEWSLETTER", "EMAIL", compliance).code).toBe("CONSENT_REVOKED");
  });

  it("allows milestone greetings with relationship consent but not newsletters", () => {
    const c = { ...base, consents: [granted("RELATIONSHIP")] };
    expect(checkEligibility(c, "MILESTONE", "EMAIL", compliance).eligible).toBe(true);
    expect(checkEligibility(c, "NEWSLETTER", "EMAIL", compliance).eligible).toBe(false);
  });

  it("honors category preferences", () => {
    const c = { ...base, preference: { receiveNewsletters: false, receiveSeasonal: true, receiveMilestones: true, frequency: "NORMAL" } };
    expect(checkEligibility(c, "NEWSLETTER", "EMAIL", compliance).code).toBe("PREFERENCE_OPT_OUT");
    expect(checkEligibility(c, "SEASONAL", "EMAIL", compliance).eligible).toBe(true);
  });

  it("keeps SMS disabled until a legal review is recorded", () => {
    const c = { ...base, phone: "+16025550100", consents: [{ ...granted(), channel: "SMS" }] };
    expect(checkEligibility(c, "NEWSLETTER", "SMS", compliance).code).toBe("CHANNEL_DISABLED");
    expect(checkEligibility(c, "NEWSLETTER", "SMS", { smsEnabled: true, smsLegalReviewCompletedAt: "2026-01-01" }).eligible).toBe(true);
  });
});

describe("opt-out suppression", () => {
  it("suppresses all email after unsubscribe, including milestones", () => {
    const c = { ...base, unsubscribedAt: new Date() };
    expect(checkEligibility(c, "NEWSLETTER", "EMAIL", compliance).code).toBe("UNSUBSCRIBED");
    expect(checkEligibility(c, "MILESTONE", "EMAIL", compliance).code).toBe("UNSUBSCRIBED");
  });

  it("suppresses everything for do-not-contact", () => {
    expect(checkEligibility({ ...base, doNotContact: true }, "MILESTONE", "EMAIL", compliance).code).toBe("DO_NOT_CONTACT");
  });

  it("suppresses when no email exists", () => {
    expect(checkEligibility({ ...base, email: null }, "NEWSLETTER", "EMAIL", compliance).code).toBe("MISSING_ADDRESS");
  });
});
