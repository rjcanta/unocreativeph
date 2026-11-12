/**
 * Campaign management: newsletters (twice monthly) and seasonal outreach.
 * Workflow: DRAFT/PENDING_APPROVAL → APPROVED → SCHEDULED → SENT.
 * Editing content after approval resets approval and cancels unsent messages.
 */
import { findUnverifiedStatistics } from "@/lib/ai/grounding";
import { getAiProvider } from "@/lib/ai/provider";
import { defaultSeasonalDate, SEASONAL_DEFAULTS } from "@/lib/domain/calendar";
import { formatLocalDate, parseLocalDate, toLocalDate, type LocalDate } from "@/lib/domain/dates";
import { resolveSendInstant } from "@/lib/domain/scheduling";
import { segmentSchema, type Segment } from "@/lib/domain/segmentation";
import { unknownMergeTags } from "@/lib/domain/render";
import type { NewsletterKind, SeasonalKind } from "@/lib/domain/types";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { prisma } from "./db";
import { NotFoundError, PolicyError, ValidationError } from "./errors";
import { parseJsonArray } from "./json";
import { enqueueJob } from "./jobs-queue";
import { materializeCampaign } from "./messaging";
import { upsertTask } from "./tasks";
import { getWorkspace } from "./workspace";

const NEWSLETTER_NAMES: Record<NewsletterKind, string> = {
  MARKET_INSIGHTS: "Market Insights",
  LIFESTYLE_COMMUNITY: "Lifestyle & Community",
};
export const NEWSLETTER_TOPICS: Record<NewsletterKind, string[]> = {
  MARKET_INSIGHTS: ["Local real estate trends", "Housing market updates", "Homeowner tips", "Neighborhood insights"],
  LIFESTYLE_COMMUNITY: ["Community happenings", "Local business highlights", "Seasonal homeowner advice", "Relationship-driven stories"],
};

async function getCampaignRow(ctx: Ctx, id: string) {
  const c = await prisma.campaign.findFirst({ where: { id, workspaceId: ctx.workspaceId, deletedAt: null } });
  if (!c) throw new NotFoundError("Campaign");
  return c;
}

export async function listCampaigns(ctx: Ctx, opts: { category?: string } = {}) {
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, ...(opts.category ? { category: opts.category } : {}) },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { messages: true, recipients: true } } },
  });
  const statuses = await prisma.scheduledMessage.groupBy({
    by: ["campaignId", "status"],
    where: { workspaceId: ctx.workspaceId, campaignId: { in: campaigns.map((c) => c.id) } },
    _count: true,
  });
  return campaigns.map((c) => ({
    ...c,
    messageCounts: Object.fromEntries(statuses.filter((s) => s.campaignId === c.id).map((s) => [s.status, s._count])) as Record<string, number>,
  }));
}

export async function getCampaign(ctx: Ctx, id: string) {
  const c = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      recipients: { include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true, contactType: true } } }, orderBy: { status: "asc" } },
      messages: { select: { id: true, status: true, scheduledFor: true, contactId: true, sentAt: true, blockedReason: true } },
    },
  });
  if (!c) throw new NotFoundError("Campaign");
  return c;
}

export function contentWarnings(c: { subject: string; body: string; verifiedMarketData: string | null; category: string }) {
  const warnings: string[] = [];
  const unknown = unknownMergeTags(`${c.subject}\n${c.body}`);
  if (unknown.length) warnings.push(`Unknown merge tags: ${unknown.map((t) => `{{${t}}}`).join(", ")}`);
  const stats = findUnverifiedStatistics(`${c.subject}\n${c.body}`, c.verifiedMarketData);
  if (stats.length) warnings.push(`Statistics not found in your verified market data: ${stats.join(", ")}. Add the source data or remove them before approving.`);
  return warnings;
}

const monthLabel = (d: LocalDate) => formatLocalDate(d, { month: "long", year: "numeric" });

export async function createNewsletterDraft(ctx: Ctx, input: { kind: NewsletterKind; sendDate: LocalDate; verifiedMarketData?: string | null; segment?: Partial<Segment> }, now = new Date()) {
  const ws = await getWorkspace(ctx);
  const { month } = parseLocalDate(input.sendDate);
  const ai = await getAiProvider().generateNewsletter({
    kind: input.kind,
    month,
    monthLabel: monthLabel(input.sendDate),
    brand: ws.brand,
    verifiedMarketData: input.verifiedMarketData,
    topics: NEWSLETTER_TOPICS[input.kind],
  });
  const scheduledFor = resolveSendInstant(input.sendDate, "NEWSLETTER", ws.rules, ws.timezone, now);
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: ctx.workspaceId,
      category: "NEWSLETTER",
      kind: input.kind,
      name: `${NEWSLETTER_NAMES[input.kind]} — ${formatLocalDate(input.sendDate, { month: "long", day: "numeric", year: "numeric" })}`,
      subject: ai.data.subject,
      previewText: ai.data.previewText,
      body: ai.data.body,
      status: "PENDING_APPROVAL",
      scheduledFor,
      segmentJson: JSON.stringify(segmentSchema.parse(input.segment ?? {})),
      contentSource: ai.source,
      aiNotesJson: JSON.stringify([...ai.data.notes, ...ai.warnings]),
      verifiedMarketData: input.verifiedMarketData?.trim() || null,
      createdById: ctx.userId,
    },
  });
  await audit(ctx, { action: "CAMPAIGN_DRAFTED", entityType: "Campaign", entityId: campaign.id, toStatus: "PENDING_APPROVAL", actorType: ctx.userId ? "USER" : "AI", details: { kind: input.kind, source: ai.source } });
  await upsertTask(
    ctx,
    {
      dedupeKey: `approve-campaign:${campaign.id}`,
      type: "APPROVE_CAMPAIGN",
      title: `Review & approve “${campaign.name}”`,
      description: "AI drafted this newsletter. Edit anything you like, then approve it to schedule delivery.",
      dueAt: new Date(scheduledFor.getTime() - 2 * 86_400_000),
      sourceType: "CAMPAIGN",
      sourceId: campaign.id,
    },
    ws.timezone,
  );
  return campaign;
}

export async function createSeasonalCampaign(ctx: Ctx, input: { kind: SeasonalKind; year: number; sendDate?: LocalDate }, now = new Date()) {
  const ws = await getWorkspace(ctx);
  const template = await prisma.campaignTemplate.findUnique({ where: { workspaceId_key: { workspaceId: ctx.workspaceId, key: input.kind } } });
  if (!template) throw new NotFoundError("Seasonal template");
  const date = input.sendDate ?? defaultSeasonalDate(input.kind, input.year, ws.marketRegion);
  const existing = await prisma.campaign.findFirst({
    where: { workspaceId: ctx.workspaceId, kind: input.kind, deletedAt: null, scheduledFor: { gte: new Date(`${input.year}-01-01T00:00:00Z`), lt: new Date(`${input.year + 1}-01-01T00:00:00Z`) } },
  });
  if (existing) return existing;
  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: ctx.workspaceId,
      templateId: template.id,
      category: "SEASONAL",
      kind: input.kind,
      name: `${template.name} ${input.year}`,
      subject: template.subjectTemplate,
      body: template.bodyTemplate,
      status: "DRAFT",
      scheduledFor: resolveSendInstant(date, "SEASONAL", ws.rules, ws.timezone, now),
      replacesNewsletter: true,
      contentSource: "TEMPLATE",
      createdById: ctx.userId,
    },
  });
  await audit(ctx, { action: "CAMPAIGN_DRAFTED", entityType: "Campaign", entityId: campaign.id, toStatus: "DRAFT", details: { kind: input.kind, year: input.year } });
  return campaign;
}

export async function ensureSeasonalCampaigns(ctx: Ctx, year: number) {
  const out = [];
  for (const kind of Object.keys(SEASONAL_DEFAULTS) as SeasonalKind[]) out.push(await createSeasonalCampaign(ctx, { kind, year }));
  return out;
}

export type CampaignUpdate = {
  name: string;
  subject: string;
  previewText: string;
  body: string;
  sendDate: LocalDate | null;
  segment: Segment;
  replacesNewsletter: boolean;
  verifiedMarketData: string | null;
};

export async function updateCampaign(ctx: Ctx, id: string, input: CampaignUpdate, now = new Date()) {
  const c = await getCampaignRow(ctx, id);
  if (["SENT", "CANCELLED"].includes(c.status)) throw new ValidationError(`A ${c.status.toLowerCase()} campaign cannot be edited.`);
  if (!input.subject.trim() || !input.body.trim()) throw new ValidationError("Subject and body are required.");
  const ws = await getWorkspace(ctx);
  const contentChanged =
    c.subject !== input.subject.trim() ||
    c.body !== input.body.trim() ||
    c.previewText !== input.previewText.trim() ||
    c.segmentJson !== JSON.stringify(input.segment) ||
    c.replacesNewsletter !== input.replacesNewsletter ||
    (c.verifiedMarketData ?? "") !== (input.verifiedMarketData?.trim() ?? "");
  const scheduledFor = input.sendDate ? resolveSendInstant(input.sendDate, c.category as "NEWSLETTER" | "SEASONAL", ws.rules, ws.timezone, now) : null;
  const dateChanged = (c.scheduledFor?.getTime() ?? null) !== (scheduledFor?.getTime() ?? null);
  const wasLive = ["APPROVED", "SCHEDULED", "PAUSED"].includes(c.status);

  await prisma.campaign.update({
    where: { id },
    data: {
      name: input.name.trim() || c.name,
      subject: input.subject.trim(),
      previewText: input.previewText.trim(),
      body: input.body.trim(),
      scheduledFor,
      segmentJson: JSON.stringify(input.segment),
      replacesNewsletter: input.replacesNewsletter,
      verifiedMarketData: input.verifiedMarketData?.trim() || null,
      ...(contentChanged ? { contentVersion: { increment: 1 }, contentSource: "MANUAL" } : {}),
      ...(wasLive && (contentChanged || dateChanged) ? { status: "PENDING_APPROVAL" } : c.status === "DRAFT" ? { status: "PENDING_APPROVAL" } : {}),
    },
  });
  if (wasLive && (contentChanged || dateChanged)) {
    const cancelled = await cancelUnsentMessages(ctx, id, contentChanged ? "Content edited after approval — re-approval required" : "Send date changed — re-approval required");
    await audit(ctx, { action: "CAMPAIGN_APPROVAL_RESET", entityType: "Campaign", entityId: id, fromStatus: c.status, toStatus: "PENDING_APPROVAL", details: { cancelledMessages: cancelled, contentChanged, dateChanged } });
  } else {
    await audit(ctx, { action: "CAMPAIGN_EDITED", entityType: "Campaign", entityId: id, details: { contentChanged, dateChanged } });
  }
}

async function cancelUnsentMessages(ctx: Ctx, campaignId: string, reason: string) {
  const msgs = await prisma.scheduledMessage.findMany({ where: { workspaceId: ctx.workspaceId, campaignId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } }, select: { id: true } });
  const ids = msgs.map((m) => m.id);
  await prisma.scheduledMessage.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED", blockedReason: reason } });
  await prisma.automationJob.updateMany({
    where: { workspaceId: ctx.workspaceId, idempotencyKey: { in: ids.map((i) => `due:${i}`) }, status: "PENDING" },
    data: { status: "CANCELLED", lastError: reason },
  });
  // Allow re-materialization after re-approval: cancelled messages free their idempotency keys.
  for (const id of ids) {
    await prisma.scheduledMessage.update({ where: { id }, data: { idempotencyKey: `${id}:cancelled` } });
  }
  await prisma.campaignRecipient.deleteMany({ where: { campaignId, status: { notIn: ["SENT"] } } });
  return ids.length;
}

export async function regenerateNewsletter(ctx: Ctx, id: string, verifiedMarketData: string | null) {
  const c = await getCampaignRow(ctx, id);
  if (c.category !== "NEWSLETTER") throw new ValidationError("Only newsletters can be regenerated with AI.");
  if (["SENT", "CANCELLED"].includes(c.status)) throw new ValidationError("This campaign can no longer be changed.");
  const ws = await getWorkspace(ctx);
  const date = c.scheduledFor ? toLocalDate(c.scheduledFor, ws.timezone) : toLocalDate(new Date(), ws.timezone);
  const ai = await getAiProvider().generateNewsletter({
    kind: c.kind as NewsletterKind,
    month: parseLocalDate(date).month,
    monthLabel: monthLabel(date),
    brand: ws.brand,
    verifiedMarketData,
    topics: NEWSLETTER_TOPICS[c.kind as NewsletterKind] ?? [],
  });
  await updateCampaign(ctx, id, {
    name: c.name,
    subject: ai.data.subject,
    previewText: ai.data.previewText,
    body: ai.data.body,
    sendDate: c.scheduledFor ? toLocalDate(c.scheduledFor, ws.timezone) : null,
    segment: segmentSchema.parse(JSON.parse(c.segmentJson || "{}")),
    replacesNewsletter: c.replacesNewsletter,
    verifiedMarketData,
  });
  await prisma.campaign.update({ where: { id }, data: { contentSource: ai.source, aiNotesJson: JSON.stringify([...ai.data.notes, ...ai.warnings]) } });
}

export async function approveCampaign(ctx: Ctx, id: string) {
  const c = await getCampaignRow(ctx, id);
  if (!["DRAFT", "PENDING_APPROVAL"].includes(c.status)) throw new ValidationError(`Campaign is already ${c.status.toLowerCase()}.`);
  if (!ctx.userId) throw new PolicyError("Campaign approval requires a signed-in agent. AI and automations cannot approve campaigns.");
  const warnings = contentWarnings(c);
  if (warnings.length) throw new ValidationError(`Fix before approving: ${warnings.join(" ")}`);
  const now = new Date();
  await prisma.campaign.update({ where: { id }, data: { status: "APPROVED", approvedContentVersion: c.contentVersion, approvedById: ctx.userId, approvedAt: now } });
  await prisma.agentTask.updateMany({ where: { workspaceId: ctx.workspaceId, dedupeKey: `approve-campaign:${id}`, status: "OPEN" }, data: { status: "DONE", completedAt: now } });
  await audit(ctx, { action: "CAMPAIGN_APPROVED", entityType: "Campaign", entityId: id, fromStatus: c.status, toStatus: "APPROVED", details: { contentVersion: c.contentVersion } });
  await enqueueJob(ctx, { type: "CAMPAIGN_APPROVED", payload: { campaignId: id, contentVersion: c.contentVersion }, idempotencyKey: `campaign-approved:${id}:v${c.contentVersion}` });
}

export async function scheduleCampaign(ctx: Ctx, id: string, sendDate: LocalDate, now = new Date()) {
  const c = await getCampaignRow(ctx, id);
  const ws = await getWorkspace(ctx);
  if (sendDate < toLocalDate(now, ws.timezone)) throw new ValidationError("Choose a date today or later.");
  const scheduledFor = resolveSendInstant(sendDate, c.category as "NEWSLETTER" | "SEASONAL", ws.rules, ws.timezone, now);
  if (["SCHEDULED", "PAUSED"].includes(c.status) && c.scheduledFor?.getTime() !== scheduledFor.getTime()) {
    throw new ValidationError("This campaign is already scheduled. Edit the send date in the editor (it will require re-approval).");
  }
  await prisma.campaign.update({ where: { id }, data: { scheduledFor } });
  await audit(ctx, { action: "CAMPAIGN_DATE_SET", entityType: "Campaign", entityId: id, details: { sendDate } });
  if (c.status === "APPROVED") {
    await enqueueJob(ctx, { type: "CAMPAIGN_SCHEDULED", payload: { campaignId: id }, idempotencyKey: `campaign-scheduled:${id}:v${c.contentVersion}:${scheduledFor.toISOString()}` });
  }
}

export async function previewCampaignSchedule(ctx: Ctx, id: string) {
  return materializeCampaign(ctx, id, new Date(), true);
}

export async function setCampaignPaused(ctx: Ctx, id: string, paused: boolean) {
  const c = await getCampaignRow(ctx, id);
  if (paused && c.status !== "SCHEDULED") throw new ValidationError("Only scheduled campaigns can be paused.");
  if (!paused && c.status !== "PAUSED") throw new ValidationError("Campaign is not paused.");
  await prisma.campaign.update({ where: { id }, data: { status: paused ? "PAUSED" : "SCHEDULED" } });
  await audit(ctx, { action: paused ? "CAMPAIGN_PAUSED" : "CAMPAIGN_RESUMED", entityType: "Campaign", entityId: id, fromStatus: c.status, toStatus: paused ? "PAUSED" : "SCHEDULED" });
}

export async function cancelCampaign(ctx: Ctx, id: string) {
  const c = await getCampaignRow(ctx, id);
  if (["SENT", "CANCELLED"].includes(c.status)) throw new ValidationError(`Campaign is already ${c.status.toLowerCase()}.`);
  const cancelled = await cancelUnsentMessages(ctx, id, "Campaign cancelled");
  await prisma.campaign.update({ where: { id }, data: { status: "CANCELLED" } });
  await prisma.agentTask.updateMany({ where: { workspaceId: ctx.workspaceId, dedupeKey: `approve-campaign:${id}`, status: "OPEN" }, data: { status: "DISMISSED" } });
  await audit(ctx, { action: "CAMPAIGN_CANCELLED", entityType: "Campaign", entityId: id, fromStatus: c.status, toStatus: "CANCELLED", details: { cancelledMessages: cancelled } });
}

/** Test send: in Demo Mode this records a simulated test; it never emails anyone. */
export async function sendCampaignTest(ctx: Ctx, id: string) {
  const c = await getCampaignRow(ctx, id);
  const ws = await getWorkspace(ctx);
  await audit(ctx, { action: "CAMPAIGN_TEST_SIMULATED", entityType: "Campaign", entityId: id, details: { to: ws.compliance.senderEmail || "agent", contentVersion: c.contentVersion } });
  return {
    simulated: true,
    message: "Test send simulated. Demo Mode never sends email — the preview below shows exactly what recipients would see. Live test sends require a verified CRM send capability.",
  };
}

export function campaignNotes(c: { aiNotesJson: string }) {
  return parseJsonArray<string>(c.aiNotesJson);
}
