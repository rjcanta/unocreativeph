/**
 * Canonical string unions for every "enum" column. The database stores plain
 * strings so the schema stays portable; these constants are the source of truth.
 */
import { z } from "zod";

export const CONTACT_TYPES = ["PAST_CLIENT", "SPHERE"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  PAST_CLIENT: "Past Client",
  SPHERE: "Sphere of Influence",
};

export const CLIENT_ROLES = ["BUYER", "SELLER", "BUYER_SELLER"] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];
export const CLIENT_ROLE_LABEL: Record<ClientRole, string> = {
  BUYER: "Past buyer",
  SELLER: "Past seller",
  BUYER_SELLER: "Bought & sold",
};

export const TIERS = ["VIP", "ACTIVE", "STANDARD", "NEEDS_RECONNECTION"] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_LABEL: Record<Tier, string> = {
  VIP: "VIP",
  ACTIVE: "Active",
  STANDARD: "Standard",
  NEEDS_RECONNECTION: "Needs Reconnection",
};

export const CHANNELS = ["EMAIL", "SMS", "PHONE", "NONE"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = {
  EMAIL: "Email",
  SMS: "Text (SMS)",
  PHONE: "Phone call",
  NONE: "No preference",
};

export const CONSENT_CHANNELS = ["EMAIL", "SMS", "PHONE"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
export const CONSENT_STATUSES = ["GRANTED", "REVOKED", "UNKNOWN"] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

export const OPPORTUNITY_STATUSES = ["NONE", "WATCH", "POTENTIAL", "ACTIVE", "CLOSED"] as const;
export type ContactOpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const CAMPAIGN_CATEGORIES = ["NEWSLETTER", "SEASONAL", "MILESTONE"] as const;
export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];

export const NEWSLETTER_KINDS = ["MARKET_INSIGHTS", "LIFESTYLE_COMMUNITY"] as const;
export type NewsletterKind = (typeof NEWSLETTER_KINDS)[number];
export const SEASONAL_KINDS = ["SEASONAL_Q1", "SEASONAL_Q2", "SEASONAL_Q3", "SEASONAL_Q4"] as const;
export type SeasonalKind = (typeof SEASONAL_KINDS)[number];

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "SENT",
  "PAUSED",
  "CANCELLED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const MILESTONE_TYPES = ["BIRTHDAY", "HOME_ANNIVERSARY", "RELATIONSHIP_ANNIVERSARY", "CUSTOM"] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];
export const MILESTONE_LABEL: Record<MilestoneType, string> = {
  BIRTHDAY: "Birthday",
  HOME_ANNIVERSARY: "Home anniversary",
  RELATIONSHIP_ANNIVERSARY: "Relationship anniversary",
  CUSTOM: "Personal milestone",
};

export const MESSAGE_STATUSES = [
  "PENDING_APPROVAL",
  "SCHEDULED",
  "SENT",
  "SIMULATED",
  "BLOCKED",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const REPLY_CLASSIFICATIONS = [
  "GENERAL_FRIENDLY",
  "POTENTIAL_BUYER",
  "POTENTIAL_SELLER",
  "POTENTIAL_INVESTOR",
  "REFERRAL_OPPORTUNITY",
  "FUTURE_OPPORTUNITY",
  "APPOINTMENT_REQUEST",
  "NEGATIVE",
  "OPT_OUT",
  "REQUIRES_ATTENTION",
] as const;
export type ReplyClassification = (typeof REPLY_CLASSIFICATIONS)[number];
export const REPLY_CLASSIFICATION_LABEL: Record<ReplyClassification, string> = {
  GENERAL_FRIENDLY: "General friendly response",
  POTENTIAL_BUYER: "Potential buyer",
  POTENTIAL_SELLER: "Potential seller",
  POTENTIAL_INVESTOR: "Potential investor",
  REFERRAL_OPPORTUNITY: "Referral opportunity",
  FUTURE_OPPORTUNITY: "Future real estate opportunity",
  APPOINTMENT_REQUEST: "Appointment request",
  NEGATIVE: "Negative response",
  OPT_OUT: "Opt-out request",
  REQUIRES_ATTENTION: "Requires agent attention",
};

export const OPPORTUNITY_TYPES = ["BUYER", "SELLER", "INVESTOR", "REFERRAL", "FUTURE"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const TASK_TYPES = [
  "CALL",
  "PERSONAL_MESSAGE",
  "GIFT",
  "REVIEW_MESSAGE",
  "REVIEW_REPLY",
  "FOLLOW_UP",
  "APPROVE_CAMPAIGN",
  "RECONNECT",
  "REFERRAL_FOLLOW_UP",
  "VERIFY_DATA",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const AUTOMATION_EVENTS = [
  "CONTACT_CREATED",
  "CONTACT_UPDATED",
  "CONTACT_IMPORTED",
  "BIRTHDAY_UPCOMING",
  "HOME_ANNIVERSARY_UPCOMING",
  "MILESTONE_UPCOMING",
  "CAMPAIGN_SCHEDULED",
  "CAMPAIGN_APPROVED",
  "CAMPAIGN_DUE",
  "INBOUND_REPLY_RECEIVED",
  "OPPORTUNITY_DETECTED",
  "CONTACT_UNSUBSCRIBED",
] as const;
export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];

export const JOB_STATUSES = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "DEAD", "PAUSED", "CANCELLED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A grounding fact displayed next to every AI or rules-based insight. */
export const evidenceSchema = z.object({
  label: z.string(),
  value: z.string(),
  source: z.string(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export function isOneOf<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}
