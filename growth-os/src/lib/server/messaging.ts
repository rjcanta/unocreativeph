/**
 * Message orchestration: preparing milestone outreach, materializing approved
 * campaigns into per-contact scheduled messages, reconciling conflicts, and
 * the approval workflow for individual messages.
 *
 * Preparing a message never sends it. Delivery happens only in delivery.ts.
 */
import { getAiProvider } from "@/lib/ai/provider";
import { anniversaryNumber, addDays, dateOnlyToLocal, diffDays, formatLocalDate, nextOccurrence, toLocalDate, type LocalDate } from "@/lib/domain/dates";
import { checkEligibility, type MessageCategory } from "@/lib/domain/eligibility";
import { planContactSchedule, resolveSendInstant, type CommittedMessage } from "@/lib/domain/scheduling";
import { matchesSegment, parseSegment } from "@/lib/domain/segmentation";
import { MILESTONE_LABEL, type MilestoneType } from "@/lib/domain/types";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { toEligibilityContact } from "./contacts";
import { prisma } from "./db";
import { NotFoundError, PolicyError, ValidationError } from "./errors";
import { parseJsonArray } from "./json";
import { enqueueJob } from "./jobs-queue";
import { upsertTask } from "./tasks";
import { getWorkspace, type WorkspaceWithSettings } from "./workspace";

const ACTIVE_MESSAGE_STATUSES = ["PENDING_APPROVAL", "SCHEDULED", "SENT", "SIMULATED"];

const fmt = (d: LocalDate) => formatLocalDate(d, { weekday: "short", month: "short", day: "numeric" });

export const messageKey = {
  campaign: (ws: string, campaignId: string, contactId: string) => `${ws}:campaign:${campaignId}:${contactId}`,
  milestone: (ws: string, milestoneId: string, occurrence: string) => `${ws}:milestone:${milestoneId}:${occurrence}`,
};

/** Messages already committed to a contact, as scheduling inputs. */
async function committedFor(ctx: Ctx, contactId: string, tz: string, excludeId?: string): Promise<CommittedMessage[]> {
  const msgs = await prisma.scheduledMessage.findMany({
    where: { workspaceId: ctx.workspaceId, contactId, status: { in: ACTIVE_MESSAGE_STATUSES }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    include: { campaign: { select: { replacesNewsletter: true, name: true } } },
  });
  return msgs.map((m) => ({
    key: m.idempotencyKey,
    category: m.category as MessageCategory,
    date: toLocalDate(m.scheduledFor, tz),
    label: m.category === "MILESTONE" ? (MILESTONE_LABEL[m.kind as MilestoneType] ?? "Milestone") : (m.campaign?.name ?? m.subject),
    replacesNewsletter: m.campaign?.replacesNewsletter ?? false,
  }));
}

/**
 * Verified milestones near a date that have not been prepared yet. Routine
 * marketing yields to them even before the greeting itself is drafted.
 */
async function upcomingMilestonesNear(ctx: Ctx, contactId: string, around: LocalDate, ws: WorkspaceWithSettings): Promise<CommittedMessage[]> {
  const milestones = await prisma.contactMilestone.findMany({ where: { workspaceId: ctx.workspaceId, contactId, active: true, verified: true } });
  const out: CommittedMessage[] = [];
  const from = addDays(around, -(ws.rules.milestoneBufferDays + 1));
  for (const m of milestones) {
    const occ = nextOccurrence(m.month, m.day, from, ws.rules.leapDayRule);
    if (Math.abs(diffDays(occ, around)) <= ws.rules.milestoneBufferDays) {
      out.push({ key: messageKey.milestone(ctx.workspaceId, m.id, occ), category: "MILESTONE", date: occ, label: MILESTONE_LABEL[m.type as MilestoneType] ?? m.label });
    }
  }
  return out;
}

function mergeCommitted(a: CommittedMessage[], b: CommittedMessage[]) {
  const keys = new Set(a.map((x) => x.key));
  return [...a, ...b.filter((x) => !keys.has(x.key))];
}

async function scheduleDueJob(ctx: Ctx, messageId: string, runAt: Date) {
  const key = `due:${messageId}`;
  const { job, created } = await enqueueJob(ctx, { type: "CAMPAIGN_DUE", payload: { messageId }, idempotencyKey: key, runAt, maxAttempts: 4 });
  if (!created && job.status === "PENDING" && job.runAt.getTime() !== runAt.getTime()) {
    await prisma.automationJob.update({ where: { id: job.id }, data: { runAt } });
  }
}

async function cancelDueJob(ctx: Ctx, messageId: string) {
  await prisma.automationJob.updateMany({
    where: { workspaceId: ctx.workspaceId, idempotencyKey: `due:${messageId}`, status: "PENDING" },
    data: { status: "CANCELLED", lastError: "Message no longer scheduled" },
  });
}

// ── Milestone outreach ───────────────────────────────────────────────────────

export type MilestonePrepResult =
  | { outcome: "PREPARED"; messageId: string; tasks: number }
  | { outcome: "TASK_ONLY" | "VERIFY_REQUESTED" | "SKIPPED"; reason: string; tasks: number };

export async function prepareMilestoneOutreach(ctx: Ctx, input: { contactId: string; milestoneId: string; occurrence: LocalDate }, now = new Date()): Promise<MilestonePrepResult> {
  const ws = await getWorkspace(ctx);
  const tz = ws.timezone;
  const contact = await prisma.contact.findFirst({
    where: { id: input.contactId, workspaceId: ctx.workspaceId, deletedAt: null },
    include: { consentRecords: true, preference: true, notes: { where: { deletedAt: null }, take: 5, orderBy: { createdAt: "desc" } } },
  });
  if (!contact) return { outcome: "SKIPPED", reason: "Contact not found or archived.", tasks: 0 };
  const milestone = await prisma.contactMilestone.findFirst({ where: { id: input.milestoneId, workspaceId: ctx.workspaceId, contactId: contact.id, active: true } });
  if (!milestone) return { outcome: "SKIPPED", reason: "Milestone no longer active.", tasks: 0 };
  if (contact.doNotContact) return { outcome: "SKIPPED", reason: "Contact is do-not-contact.", tasks: 0 };

  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const label = (MILESTONE_LABEL[milestone.type as MilestoneType] ?? milestone.label).toLowerCase();
  const dueAt = resolveSendInstant(input.occurrence, "MILESTONE", ws.rules, tz, now);
  const isVip = contact.tier === "VIP";
  let tasks = 0;

  if (!milestone.verified) {
    const r = await upsertTask(
      ctx,
      {
        dedupeKey: `verify:${milestone.id}:${input.occurrence}`,
        type: "VERIFY_DATA",
        title: `Verify ${name}'s ${label} (${fmt(input.occurrence)})`,
        description: `The ${label} on file has not been verified, so no greeting will be prepared. Confirm the date to enable automated outreach.`,
        contactId: contact.id,
        dueAt: new Date(dueAt.getTime() - 3 * 86_400_000),
        sourceType: "MILESTONE",
        sourceId: milestone.id,
        extraReasons: ["Unverified dates are never used for automatic messages"],
      },
      tz,
    );
    return { outcome: "VERIFY_REQUESTED", reason: "Date not verified.", tasks: r.created ? 1 : 0 };
  }

  if (contact.preference && !contact.preference.receiveMilestones) {
    return { outcome: "SKIPPED", reason: "Contact prefers not to receive milestone greetings.", tasks: 0 };
  }

  if (isVip) {
    const r = await upsertTask(
      ctx,
      {
        dedupeKey: `vip-touch:${milestone.id}:${input.occurrence}`,
        type: milestone.type === "HOME_ANNIVERSARY" ? "GIFT" : "CALL",
        title: milestone.type === "HOME_ANNIVERSARY" ? `${name}'s home anniversary — call or send a small gift` : `Call ${name} on their ${label}`,
        description: `VIP relationship. A personal call, handwritten note, or optional small gift is recommended for ${fmt(input.occurrence)}.`,
        contactId: contact.id,
        dueAt,
        sourceType: "MILESTONE",
        sourceId: milestone.id,
        extraReasons: [`${MILESTONE_LABEL[milestone.type as MilestoneType] ?? "Milestone"} on ${fmt(input.occurrence)}`],
      },
      tz,
    );
    if (r.created) tasks++;
  }

  const elig = checkEligibility(toEligibilityContact(contact), "MILESTONE", "EMAIL", ws.compliance);
  if (!elig.eligible) {
    if (!isVip) {
      const r = await upsertTask(
        ctx,
        {
          dedupeKey: `personal-touch:${milestone.id}:${input.occurrence}`,
          type: "PERSONAL_MESSAGE",
          title: `Send ${name} a personal ${label} note`,
          description: `No automated email: ${elig.reason} A personal text, call or card is the best way to mark the day.`,
          contactId: contact.id,
          dueAt,
          sourceType: "MILESTONE",
          sourceId: milestone.id,
          extraReasons: [elig.reason],
        },
        tz,
      );
      if (r.created) tasks++;
    }
    return { outcome: "TASK_ONLY", reason: elig.reason, tasks };
  }

  const key = messageKey.milestone(ctx.workspaceId, milestone.id, input.occurrence);
  const existing = await prisma.scheduledMessage.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { outcome: "SKIPPED", reason: "Already prepared (duplicate prevented).", tasks };

  const years = milestone.year && milestone.type !== "BIRTHDAY" ? anniversaryNumber(milestone.year, input.occurrence) : null;
  const ai = await getAiProvider().generateGreeting({
    type: milestone.type as "BIRTHDAY" | "HOME_ANNIVERSARY" | "RELATIONSHIP_ANNIVERSARY" | "CUSTOM",
    firstName: contact.firstName,
    isVip,
    years,
    propertyLabel: milestone.type === "HOME_ANNIVERSARY" ? (contact.neighborhood ?? null) : null,
    customLabel: milestone.type === "CUSTOM" ? milestone.label : null,
    verifiedNotes: [],
    brand: ws.brand,
  });

  const needsApproval = ws.compliance.requireApprovalForMilestones;
  const reasons = [
    `${MILESTONE_LABEL[milestone.type as MilestoneType] ?? milestone.label} on ${fmt(input.occurrence)} (verified date).`,
    "Personal milestone greetings take priority over routine marketing.",
    needsApproval ? "Waiting for your approval before it can be scheduled." : "Auto-approval for milestones is enabled in compliance settings.",
    ...ai.warnings,
  ];
  const msg = await prisma.scheduledMessage.create({
    data: {
      workspaceId: ctx.workspaceId,
      contactId: contact.id,
      milestoneId: milestone.id,
      category: "MILESTONE",
      kind: milestone.type,
      channel: "EMAIL",
      subject: ai.data.subject,
      body: ai.data.body,
      status: needsApproval ? "PENDING_APPROVAL" : "SCHEDULED",
      scheduledFor: dueAt,
      occurrenceKey: input.occurrence,
      idempotencyKey: key,
      contentSource: ai.source,
      reasonsJson: JSON.stringify(reasons),
      approvedAt: needsApproval ? null : now,
    },
  });
  await audit(ctx, { action: "MESSAGE_PREPARED", entityType: "ScheduledMessage", entityId: msg.id, toStatus: msg.status, actorType: "AI", details: { contactId: contact.id, kind: milestone.type, occurrence: input.occurrence, source: ai.source } });

  if (needsApproval) {
    const r = await upsertTask(
      ctx,
      {
        dedupeKey: `review-message:${msg.id}`,
        type: "REVIEW_MESSAGE",
        title: `Review ${name}'s ${label} message`,
        description: `Drafted for ${fmt(input.occurrence)}. Approve it to schedule delivery, or edit it first.`,
        contactId: contact.id,
        dueAt: new Date(dueAt.getTime() - 86_400_000),
        sourceType: "MESSAGE",
        sourceId: msg.id,
      },
      tz,
    );
    if (r.created) tasks++;
  } else {
    await scheduleDueJob(ctx, msg.id, dueAt);
  }

  await reconcileRoutineAround(ctx, contact.id, input.occurrence, ws, now);
  return { outcome: "PREPARED", messageId: msg.id, tasks };
}

/**
 * After a higher-priority message lands (milestone, or a seasonal campaign that
 * replaces newsletters), re-plan this contact's scheduled routine messages.
 */
export async function reconcileRoutineAround(ctx: Ctx, contactId: string, date: LocalDate, ws: WorkspaceWithSettings, now = new Date()) {
  const tz = ws.timezone;
  const routine = await prisma.scheduledMessage.findMany({
    where: { workspaceId: ctx.workspaceId, contactId, status: "SCHEDULED", category: { in: ["NEWSLETTER", "SEASONAL"] } },
    include: { campaign: { select: { replacesNewsletter: true, name: true } } },
  });
  const contact = await prisma.contact.findFirstOrThrow({ where: { id: contactId }, include: { consentRecords: true, preference: true } });
  let changed = 0;
  for (const m of routine) {
    const local = toLocalDate(m.scheduledFor, tz);
    if (Math.abs(diffDays(local, date)) > Math.max(ws.rules.milestoneBufferDays, ws.rules.seasonalReplaceWindowDays)) continue;
    const committed = await committedFor(ctx, contactId, tz, m.id);
    const [d] = planContactSchedule({
      candidates: [{ key: `${m.idempotencyKey}#replan`, category: m.category as MessageCategory, date: local, label: m.campaign?.name ?? m.subject, replacesNewsletter: m.campaign?.replacesNewsletter }],
      committed,
      eligibility: (cat) => checkEligibility(toEligibilityContact(contact), cat, "EMAIL", ws.compliance),
      rules: ws.rules,
      frequency: contact.preference?.frequency,
    });
    if (d.action === "SCHEDULE") continue;
    const reasons = [...parseJsonArray<string>(m.reasonsJson), ...d.reasons];
    if (d.action === "POSTPONE" && d.date) {
      const at = resolveSendInstant(d.date, m.category as MessageCategory, ws.rules, tz, now);
      await prisma.scheduledMessage.update({ where: { id: m.id }, data: { scheduledFor: at, reasonsJson: JSON.stringify(reasons) } });
      await scheduleDueJob(ctx, m.id, at);
      if (m.campaignId) await prisma.campaignRecipient.updateMany({ where: { campaignId: m.campaignId, contactId }, data: { status: "POSTPONED", plannedFor: at, reasonsJson: JSON.stringify(d.reasons) } });
      await audit(ctx, { action: "MESSAGE_POSTPONED", entityType: "ScheduledMessage", entityId: m.id, details: { from: local, to: d.date, reasons: d.reasons } });
    } else {
      await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "SKIPPED", blockedReason: d.reasons.join(" "), reasonsJson: JSON.stringify(reasons) } });
      await cancelDueJob(ctx, m.id);
      if (m.campaignId) await prisma.campaignRecipient.updateMany({ where: { campaignId: m.campaignId, contactId }, data: { status: d.action === "SUPPRESS" ? "SUPPRESSED" : "SKIPPED", plannedFor: null, reasonsJson: JSON.stringify(d.reasons) } });
      await audit(ctx, { action: "MESSAGE_SKIPPED", entityType: "ScheduledMessage", entityId: m.id, toStatus: "SKIPPED", details: { reasons: d.reasons } });
    }
    changed++;
  }
  return changed;
}

// ── Campaign materialization ─────────────────────────────────────────────────

export type MaterializeResult = { scheduled: number; postponed: number; skipped: number; suppressed: number; alreadyPrepared: number };

async function segmentContacts(ctx: Ctx, segmentJson: string) {
  const segment = parseSegment(segmentJson);
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null },
    include: { consentRecords: true, preference: true, tags: { include: { tag: true } } },
  });
  return contacts.filter((c) => matchesSegment({ ...c, tags: c.tags.map((t) => t.tag.name) }, segment));
}

/**
 * Turn an approved, dated campaign into per-contact scheduled messages.
 * Idempotent: message idempotency keys are unique per campaign × contact.
 */
export async function materializeCampaign(ctx: Ctx, campaignId: string, now = new Date(), dryRun = false) {
  const ws = await getWorkspace(ctx);
  const tz = ws.timezone;
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId: ctx.workspaceId, deletedAt: null } });
  if (!campaign) throw new NotFoundError("Campaign");
  if (!campaign.scheduledFor) throw new ValidationError("Set a send date first.");
  if (!dryRun) {
    if (!["APPROVED", "SCHEDULED"].includes(campaign.status)) throw new PolicyError("Campaign must be approved before it can be scheduled.");
    if (campaign.approvedContentVersion !== campaign.contentVersion) throw new PolicyError("Content changed after approval. Re-approve before scheduling.");
  }
  const category = campaign.category as MessageCategory;
  const date = toLocalDate(campaign.scheduledFor, tz);
  const contacts = await segmentContacts(ctx, campaign.segmentJson);
  const result: MaterializeResult = { scheduled: 0, postponed: 0, skipped: 0, suppressed: 0, alreadyPrepared: 0 };
  const preview: { contactId: string; name: string; action: string; date: LocalDate | null; reasons: string[] }[] = [];

  for (const c of contacts) {
    const key = messageKey.campaign(ctx.workspaceId, campaign.id, c.id);
    const committed = mergeCommitted(await committedFor(ctx, c.id, tz), await upcomingMilestonesNear(ctx, c.id, date, ws));
    const [d] = planContactSchedule({
      candidates: [{ key, category, date, label: campaign.name, replacesNewsletter: campaign.replacesNewsletter }],
      committed,
      eligibility: (cat) => checkEligibility(toEligibilityContact(c), cat, "EMAIL", ws.compliance),
      rules: ws.rules,
      frequency: c.preference?.frequency,
    });
    preview.push({ contactId: c.id, name: `${c.firstName} ${c.lastName}`.trim(), action: d.action, date: d.date, reasons: d.reasons });
    if (d.reasons[0]?.startsWith("Already prepared")) {
      result.alreadyPrepared++;
      continue;
    }
    if (d.action === "SKIP") result.skipped++;
    else if (d.action === "SUPPRESS") result.suppressed++;
    else if (d.action === "POSTPONE") result.postponed++;
    else result.scheduled++;
    if (dryRun) continue;

    const plannedFor = d.date ? resolveSendInstant(d.date, category, ws.rules, tz, now) : null;
    await prisma.campaignRecipient.upsert({
      where: { campaignId_contactId: { campaignId: campaign.id, contactId: c.id } },
      create: { workspaceId: ctx.workspaceId, campaignId: campaign.id, contactId: c.id, status: d.action === "SCHEDULE" ? "SCHEDULED" : d.action === "POSTPONE" ? "POSTPONED" : d.action === "SKIP" ? "SKIPPED" : "SUPPRESSED", plannedFor, reasonsJson: JSON.stringify(d.reasons) },
      update: { status: d.action === "SCHEDULE" ? "SCHEDULED" : d.action === "POSTPONE" ? "POSTPONED" : d.action === "SKIP" ? "SKIPPED" : "SUPPRESSED", plannedFor, reasonsJson: JSON.stringify(d.reasons) },
    });
    if (!plannedFor) continue;
    const msg = await prisma.scheduledMessage.create({
      data: {
        workspaceId: ctx.workspaceId,
        contactId: c.id,
        campaignId: campaign.id,
        category,
        kind: campaign.kind,
        channel: "EMAIL",
        subject: campaign.subject,
        body: campaign.body,
        status: "SCHEDULED",
        scheduledFor: plannedFor,
        occurrenceKey: campaign.id,
        idempotencyKey: key,
        contentSource: campaign.contentSource,
        reasonsJson: JSON.stringify(d.reasons),
        approvedById: campaign.approvedById,
        approvedAt: campaign.approvedAt,
      },
    });
    await scheduleDueJob(ctx, msg.id, plannedFor);
    if (category === "SEASONAL" && campaign.replacesNewsletter) await reconcileRoutineAround(ctx, c.id, d.date!, ws, now);
  }

  if (!dryRun) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SCHEDULED" } });
    await audit(ctx, { action: "CAMPAIGN_MATERIALIZED", entityType: "Campaign", entityId: campaign.id, toStatus: "SCHEDULED", details: { ...result } });
  }
  return { result, preview };
}

// ── Individual message approval ──────────────────────────────────────────────

async function getMessage(ctx: Ctx, id: string) {
  const m = await prisma.scheduledMessage.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!m) throw new NotFoundError("Message");
  return m;
}

export async function approveMessage(ctx: Ctx, id: string, now = new Date()) {
  const m = await getMessage(ctx, id);
  if (m.status !== "PENDING_APPROVAL") throw new ValidationError(`Only messages awaiting approval can be approved (this one is ${m.status.toLowerCase()}).`);
  const ws = await getWorkspace(ctx);
  const scheduledFor = m.scheduledFor.getTime() < now.getTime() ? resolveSendInstant(toLocalDate(now, ws.timezone), m.category as MessageCategory, ws.rules, ws.timezone, now) : m.scheduledFor;
  await prisma.scheduledMessage.update({ where: { id }, data: { status: "SCHEDULED", approvedById: ctx.userId, approvedAt: now, scheduledFor } });
  await scheduleDueJob(ctx, id, scheduledFor);
  await prisma.agentTask.updateMany({ where: { workspaceId: ctx.workspaceId, dedupeKey: `review-message:${id}`, status: "OPEN" }, data: { status: "DONE", completedAt: now } });
  await audit(ctx, { action: "MESSAGE_APPROVED", entityType: "ScheduledMessage", entityId: id, fromStatus: m.status, toStatus: "SCHEDULED" });
}

export async function editMessage(ctx: Ctx, id: string, input: { subject: string; body: string }) {
  const m = await getMessage(ctx, id);
  if (!["PENDING_APPROVAL", "SCHEDULED"].includes(m.status)) throw new ValidationError("This message can no longer be edited.");
  if (!input.subject.trim() || !input.body.trim()) throw new ValidationError("Subject and body are required.");
  await prisma.scheduledMessage.update({
    where: { id },
    data: { subject: input.subject.trim(), body: input.body.trim(), status: "PENDING_APPROVAL", approvedAt: null, approvedById: null, contentSource: "MANUAL" },
  });
  await cancelDueJob(ctx, id);
  await audit(ctx, { action: "MESSAGE_EDITED", entityType: "ScheduledMessage", entityId: id, fromStatus: m.status, toStatus: "PENDING_APPROVAL" });
}

export async function cancelMessage(ctx: Ctx, id: string, reason = "Cancelled by agent") {
  const m = await getMessage(ctx, id);
  if (!["PENDING_APPROVAL", "SCHEDULED"].includes(m.status)) throw new ValidationError("Only pending or scheduled messages can be cancelled.");
  await prisma.scheduledMessage.update({ where: { id }, data: { status: "CANCELLED", blockedReason: reason } });
  await cancelDueJob(ctx, id);
  await prisma.agentTask.updateMany({ where: { workspaceId: ctx.workspaceId, dedupeKey: `review-message:${id}`, status: "OPEN" }, data: { status: "DISMISSED" } });
  await audit(ctx, { action: "MESSAGE_CANCELLED", entityType: "ScheduledMessage", entityId: id, fromStatus: m.status, toStatus: "CANCELLED", details: { reason } });
}

export async function listMessages(ctx: Ctx, opts: { status?: string[]; category?: string; from?: Date; to?: Date; limit?: number } = {}) {
  return prisma.scheduledMessage.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(opts.status ? { status: { in: opts.status } } : {}),
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.from || opts.to ? { scheduledFor: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      contact: { deletedAt: null },
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true, contactType: true } }, campaign: { select: { id: true, name: true } } },
    orderBy: { scheduledFor: "asc" },
    take: opts.limit ?? 200,
  });
}

/** Upcoming milestones across the workspace for the milestones view. */
export async function upcomingMilestones(ctx: Ctx, days: number, now = new Date()) {
  const ws = await getWorkspace(ctx);
  const today = toLocalDate(now, ws.timezone);
  const milestones = await prisma.contactMilestone.findMany({
    where: { workspaceId: ctx.workspaceId, active: true, contact: { deletedAt: null } },
    include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true, contactType: true, doNotContact: true, unsubscribedAt: true, closingDate: true } } },
  });
  const out = milestones
    .map((m) => {
      const date = nextOccurrence(m.month, m.day, today, ws.rules.leapDayRule);
      const years = m.year && m.type !== "BIRTHDAY" ? anniversaryNumber(m.year, date) : null;
      return { ...m, date, daysAway: diffDays(today, date), years, key: messageKey.milestone(ctx.workspaceId, m.id, date) };
    })
    .filter((m) => m.daysAway <= days)
    .sort((a, b) => a.daysAway - b.daysAway);
  const prepared = await prisma.scheduledMessage.findMany({ where: { idempotencyKey: { in: out.map((m) => m.key) } }, select: { id: true, idempotencyKey: true, status: true } });
  const byKey = new Map(prepared.map((p) => [p.idempotencyKey, p]));
  return out.map((m) => ({ ...m, message: byKey.get(m.key) ?? null, closing: m.contact.closingDate ? dateOnlyToLocal(m.contact.closingDate) : null }));
}
