/**
 * Workspace-level configuration stored as JSON on the workspace row.
 * Every field has a safe default so a fresh workspace is compliant by default.
 */
import { z } from "zod";

export const brandVoiceSchema = z.object({
  agentName: z.string().default("Your agent"),
  teamName: z.string().default(""),
  signature: z.string().default(""),
  tone: z.string().default("Warm, professional, conversational, natural, relationship-focused and non-salesy."),
  phrasesToUse: z.array(z.string()).default([]),
  phrasesToAvoid: z
    .array(z.string())
    .default(["act now", "don't miss out", "hot market", "limited time", "just checking in to see if you're ready"]),
  marketArea: z.string().default(""),
});
export type BrandVoice = z.infer<typeof brandVoiceSchema>;

export const complianceSchema = z.object({
  /** CAN-SPAM: a valid physical postal address must appear in commercial email. */
  physicalAddress: z.string().default(""),
  senderName: z.string().default(""),
  senderEmail: z.string().default(""),
  unsubscribeText: z
    .string()
    .default("You're receiving this because we've worked together or stayed in touch. Reply STOP or click unsubscribe to opt out."),
  /** SMS is designed but disabled until a TCPA / state-law review is recorded. */
  smsEnabled: z.boolean().default(false),
  smsLegalReviewCompletedAt: z.string().nullable().default(null),
  requireApprovalForMilestones: z.boolean().default(true),
});
export type ComplianceSettings = z.infer<typeof complianceSchema>;

export const schedulingSchema = z.object({
  maxRoutinePerMonth: z.number().int().min(0).max(8).default(2),
  milestoneBufferDays: z.number().int().min(0).max(30).default(5),
  seasonalReplacesNewsletter: z.boolean().default(true),
  /** Days either side of a seasonal send within which a routine newsletter is replaced. */
  seasonalReplaceWindowDays: z.number().int().min(0).max(31).default(10),
  routineConflictAction: z.enum(["POSTPONE", "SKIP"]).default("POSTPONE"),
  sendWindowStartHour: z.number().int().min(0).max(23).default(9),
  sendWindowEndHour: z.number().int().min(1).max(24).default(17),
  /** Days marketing may go out (0=Sun). Milestones go out on the day itself. */
  marketingDays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  milestoneLookaheadDays: z.number().int().min(1).max(60).default(14),
  milestoneSendHour: z.number().int().min(0).max(23).default(9),
  leapDayRule: z.enum(["FEB_28", "MAR_1"]).default("FEB_28"),
  reconnectAfterDays: z.number().int().min(30).max(730).default(180),
  newsletterDays: z.array(z.number().int().min(1).max(28)).default([6, 20]),
});
export type SchedulingRules = z.infer<typeof schedulingSchema>;

function parseJson(raw: string | null | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const parseBrandVoice = (raw?: string | null): BrandVoice => brandVoiceSchema.parse(parseJson(raw));
export const parseCompliance = (raw?: string | null): ComplianceSettings => complianceSchema.parse(parseJson(raw));
export const parseScheduling = (raw?: string | null): SchedulingRules => schedulingSchema.parse(parseJson(raw));
export const DEFAULT_SCHEDULING: SchedulingRules = schedulingSchema.parse({});
