import { brandVoiceSchema, complianceSchema, schedulingSchema, type BrandVoice, type ComplianceSettings, type SchedulingRules } from "@/lib/domain/settings";
import { canSpamIssues } from "@/lib/domain/render";
import { audit } from "./audit";
import { appMode, type Ctx } from "./context";
import { prisma } from "./db";
import { PolicyError } from "./errors";
import { getWorkspace } from "./workspace";

export async function updateBrandVoice(ctx: Ctx, v: BrandVoice) {
  const parsed = brandVoiceSchema.parse(v);
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { brandVoiceJson: JSON.stringify(parsed) } });
  await audit(ctx, { action: "BRAND_VOICE_UPDATED", entityType: "Workspace", entityId: ctx.workspaceId });
}

export async function updateCompliance(ctx: Ctx, v: ComplianceSettings) {
  const parsed = complianceSchema.parse(v);
  if (parsed.smsEnabled && !parsed.smsLegalReviewCompletedAt) {
    throw new PolicyError("SMS cannot be enabled until a TCPA / state-law review date is recorded.");
  }
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { complianceJson: JSON.stringify(parsed) } });
  await audit(ctx, { action: "COMPLIANCE_UPDATED", entityType: "Workspace", entityId: ctx.workspaceId, details: { smsEnabled: parsed.smsEnabled } });
}

export async function updateScheduling(ctx: Ctx, v: SchedulingRules, timezone: string, marketRegion: string) {
  const parsed = schedulingSchema.parse(v);
  if (parsed.sendWindowEndHour <= parsed.sendWindowStartHour) throw new PolicyError("Sending window must end after it starts.");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new PolicyError(`"${timezone}" is not a valid IANA time zone.`);
  }
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { schedulingJson: JSON.stringify(parsed), timezone, marketRegion } });
  await audit(ctx, { action: "SCHEDULING_RULES_UPDATED", entityType: "Workspace", entityId: ctx.workspaceId, details: parsed });
}

export async function setSendingPaused(ctx: Ctx, paused: boolean) {
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { sendingPaused: paused } });
  await audit(ctx, { action: paused ? "SENDING_PAUSED" : "SENDING_RESUMED", entityType: "Workspace", entityId: ctx.workspaceId });
}

export async function setLiveSending(ctx: Ctx, enabled: boolean) {
  const ws = await getWorkspace(ctx);
  if (enabled) {
    if (appMode() !== "live") throw new PolicyError("Live sending cannot be enabled while APP_MODE=demo.");
    if (ws.isDemo) throw new PolicyError("The demo workspace can never send live messages.");
    const issues = canSpamIssues(ws.compliance);
    if (issues.length) throw new PolicyError(`Complete CAN-SPAM settings first: ${issues.join(" ")}`);
  }
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { liveSendingEnabled: enabled } });
  await audit(ctx, { action: enabled ? "LIVE_SENDING_ENABLED" : "LIVE_SENDING_DISABLED", entityType: "Workspace", entityId: ctx.workspaceId });
}

export async function listAuditLogs(ctx: Ctx, opts: { entityType?: string; action?: string; limit?: number } = {}) {
  return prisma.auditLog.findMany({
    where: { workspaceId: ctx.workspaceId, ...(opts.entityType ? { entityType: opts.entityType } : {}), ...(opts.action ? { action: { contains: opts.action } } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
  });
}
