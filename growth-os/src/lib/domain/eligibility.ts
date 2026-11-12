/**
 * Deterministic communication eligibility. AI never decides who may be contacted.
 *
 * Principles
 * - Being a past client or sphere contact is NOT consent.
 * - Do-not-contact suppresses every channel, including agent tasks to reach out.
 * - An unsubscribe suppresses all email.
 * - Marketing (newsletters, seasonal) needs explicit marketing consent for the channel.
 * - Personal milestone greetings need marketing OR relationship consent.
 * - SMS stays disabled until the workspace records a TCPA / state-law review.
 */
import type { ComplianceSettings } from "./settings";

export type ConsentSnapshot = {
  channel: string;
  purpose: string;
  status: string;
  source: string;
  capturedAt: Date;
};

export type EligibilityContact = {
  email: string | null;
  phone: string | null;
  doNotContact: boolean;
  unsubscribedAt: Date | null;
  consents: ConsentSnapshot[];
  preference?: {
    receiveNewsletters: boolean;
    receiveSeasonal: boolean;
    receiveMilestones: boolean;
    frequency: string;
  } | null;
};

export type MessageCategory = "NEWSLETTER" | "SEASONAL" | "MILESTONE";
export type SendChannel = "EMAIL" | "SMS";

export type EligibilityCode =
  | "OK"
  | "DO_NOT_CONTACT"
  | "UNSUBSCRIBED"
  | "MISSING_ADDRESS"
  | "NO_CONSENT"
  | "CONSENT_REVOKED"
  | "PREFERENCE_OPT_OUT"
  | "CHANNEL_DISABLED";

export type EligibilityResult = {
  eligible: boolean;
  code: EligibilityCode;
  reason: string;
};

/** Latest consent record for a channel/purpose, or null. */
export function latestConsent(consents: ConsentSnapshot[], channel: string, purpose: string): ConsentSnapshot | null {
  let latest: ConsentSnapshot | null = null;
  for (const c of consents) {
    if (c.channel !== channel || c.purpose !== purpose) continue;
    if (!latest || c.capturedAt.getTime() >= latest.capturedAt.getTime()) latest = c;
  }
  return latest;
}

export function consentStatus(consents: ConsentSnapshot[], channel: string, purpose: string): "GRANTED" | "REVOKED" | "UNKNOWN" {
  const c = latestConsent(consents, channel, purpose);
  if (!c) return "UNKNOWN";
  return c.status === "GRANTED" ? "GRANTED" : c.status === "REVOKED" ? "REVOKED" : "UNKNOWN";
}

const fail = (code: EligibilityCode, reason: string): EligibilityResult => ({ eligible: false, code, reason });

export function checkEligibility(
  contact: EligibilityContact,
  category: MessageCategory,
  channel: SendChannel,
  compliance: Pick<ComplianceSettings, "smsEnabled" | "smsLegalReviewCompletedAt">,
): EligibilityResult {
  if (contact.doNotContact) return fail("DO_NOT_CONTACT", "Contact is marked do-not-contact.");

  if (channel === "SMS") {
    if (!compliance.smsEnabled || !compliance.smsLegalReviewCompletedAt) {
      return fail("CHANNEL_DISABLED", "SMS is disabled until a TCPA and state-law review is recorded for this workspace.");
    }
    if (!contact.phone) return fail("MISSING_ADDRESS", "No phone number on file.");
  } else {
    if (contact.unsubscribedAt) return fail("UNSUBSCRIBED", "Contact unsubscribed from email.");
    if (!contact.email) return fail("MISSING_ADDRESS", "No email address on file.");
  }

  const pref = contact.preference;
  if (pref) {
    if (category === "NEWSLETTER" && (!pref.receiveNewsletters || pref.frequency === "MILESTONES_ONLY")) {
      return fail("PREFERENCE_OPT_OUT", "Contact prefers not to receive newsletters.");
    }
    if (category === "SEASONAL" && (!pref.receiveSeasonal || pref.frequency === "MILESTONES_ONLY")) {
      return fail("PREFERENCE_OPT_OUT", "Contact prefers not to receive seasonal outreach.");
    }
    if (category === "MILESTONE" && !pref.receiveMilestones) {
      return fail("PREFERENCE_OPT_OUT", "Contact prefers not to receive milestone greetings.");
    }
  }

  const marketing = consentStatus(contact.consents, channel, "MARKETING");
  if (category === "MILESTONE") {
    const relationship = consentStatus(contact.consents, channel, "RELATIONSHIP");
    if (marketing === "GRANTED" || relationship === "GRANTED") return { eligible: true, code: "OK", reason: "Consent on file." };
    if (relationship === "REVOKED" || marketing === "REVOKED") {
      return fail("CONSENT_REVOKED", `${channel} consent was revoked.`);
    }
    return fail("NO_CONSENT", `No recorded ${channel.toLowerCase()} consent. Reach out personally instead.`);
  }

  if (marketing === "GRANTED") return { eligible: true, code: "OK", reason: "Marketing consent on file." };
  if (marketing === "REVOKED") return fail("CONSENT_REVOKED", `${channel} marketing consent was revoked.`);
  return fail("NO_CONSENT", `No recorded ${channel.toLowerCase()} marketing consent.`);
}
