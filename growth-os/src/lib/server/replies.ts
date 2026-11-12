/**
 * Reply Intelligence (AI Responsibility 4) and opportunity handling.
 * Classifications are recommendations; detected opportunities start as
 * POTENTIAL and only the agent can confirm them. Replies are never sent
 * automatically.
 */
import { getAiProvider } from "@/lib/ai/provider";
import { replyClassificationSchema, type ReplyClassificationResult } from "@/lib/ai/schemas";
import { REPLY_CLASSIFICATION_LABEL, type OpportunityType, type ReplyClassification } from "@/lib/domain/types";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { unsubscribeContact } from "./contacts";
import { prisma } from "./db";
import { NotFoundError, ValidationError } from "./errors";
import { upsertInsight } from "./insights";
import { pushToCrm } from "./integrations";
import { enqueueJob } from "./jobs-queue";
import { upsertTask } from "./tasks";
import { getWorkspace } from "./workspace";

const OPP_FOR: Partial<Record<ReplyClassification, OpportunityType>> = {
  POTENTIAL_BUYER: "BUYER",
  POTENTIAL_SELLER: "SELLER",
  POTENTIAL_INVESTOR: "INVESTOR",
  REFERRAL_OPPORTUNITY: "REFERRAL",
  FUTURE_OPPORTUNITY: "FUTURE",
};

export type StoredClassification = ReplyClassificationResult & { source: string; warnings: string[]; classifiedAt: string };

export function parseClassification(raw: string | null): StoredClassification | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const parsed = replyClassificationSchema.safeParse(v);
    return parsed.success ? { ...parsed.data, source: v.source ?? "AI_MOCK", warnings: v.warnings ?? [], classifiedAt: v.classifiedAt ?? "" } : null;
  } catch {
    return null;
  }
}

export async function ingestInboundReply(
  ctx: Ctx,
  input: { contactId: string; text: string; subject?: string | null; channel?: string; source: string; externalId: string; occurredAt?: Date },
) {
  const contact = await prisma.contact.findFirst({ where: { id: input.contactId, workspaceId: ctx.workspaceId, deletedAt: null } });
  if (!contact) throw new NotFoundError("Contact");
  if (!input.text.trim()) throw new ValidationError("Reply text is empty.");
  const existing = await prisma.communicationEvent.findUnique({
    where: { workspaceId_source_externalId: { workspaceId: ctx.workspaceId, source: input.source, externalId: input.externalId } },
  });
  if (existing) return { event: existing, duplicate: true };
  const occurredAt = input.occurredAt ?? new Date();
  const event = await prisma.communicationEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      contactId: contact.id,
      direction: "INBOUND",
      channel: input.channel ?? "EMAIL",
      type: "REPLY",
      subject: input.subject ?? null,
      body: input.text.trim(),
      occurredAt,
      source: input.source,
      externalId: input.externalId,
      triageStatus: "NEW",
    },
  });
  await prisma.contact.update({ where: { id: contact.id }, data: { lastCommunicationAt: occurredAt } });
  await audit(ctx, { action: "REPLY_RECEIVED", entityType: "CommunicationEvent", entityId: event.id, details: { source: input.source } });
  await enqueueJob(ctx, { type: "INBOUND_REPLY_RECEIVED", payload: { eventId: event.id }, idempotencyKey: `reply:${event.id}` });
  return { event, duplicate: false };
}

export async function classifyAndRouteReply(ctx: Ctx, eventId: string) {
  const ws = await getWorkspace(ctx);
  const event = await prisma.communicationEvent.findFirst({ where: { id: eventId, workspaceId: ctx.workspaceId, direction: "INBOUND" }, include: { contact: true } });
  if (!event) throw new NotFoundError("Reply");
  if (event.classification) return { classification: event.classification, alreadyClassified: true };
  const c = event.contact;
  const name = `${c.firstName} ${c.lastName}`.trim();

  const ai = await getAiProvider().classifyReply({ text: event.body ?? "", firstName: c.firstName, contactType: c.contactType, tier: c.tier, brand: ws.brand });
  const cls = ai.data;
  const stored: StoredClassification = { ...cls, source: ai.source, warnings: ai.warnings, classifiedAt: new Date().toISOString() };
  const triage = cls.classification === "OPT_OUT" ? "REVIEWED" : cls.classification === "GENERAL_FRIENDLY" ? "NEW" : "NEEDS_ATTENTION";
  await prisma.communicationEvent.update({
    where: { id: event.id },
    data: { classification: cls.classification, classificationJson: JSON.stringify(stored), triageStatus: triage },
  });
  await audit(ctx, { action: "REPLY_CLASSIFIED", entityType: "CommunicationEvent", entityId: event.id, actorType: "AI", toStatus: cls.classification, details: { confidence: cls.confidence, source: ai.source } });

  if (cls.classification === "OPT_OUT") {
    await unsubscribeContact(ctx, c.id, `Reply requested opt-out: “${cls.evidenceQuote.slice(0, 120)}”`);
    return { classification: cls.classification, alreadyClassified: false };
  }

  const today = new Date();
  const opportunityTypes = [cls.classification, ...cls.secondary].map((x) => OPP_FOR[x]).filter((x): x is OpportunityType => !!x);
  for (const type of [...new Set(opportunityTypes)]) {
    const opp = await prisma.opportunity.upsert({
      where: { workspaceId_sourceEventId_type: { workspaceId: ctx.workspaceId, sourceEventId: event.id, type } },
      create: {
        workspaceId: ctx.workspaceId,
        contactId: c.id,
        type,
        status: "POTENTIAL",
        timeframe: cls.timeframe,
        summary: cls.summary,
        evidence: cls.evidenceQuote,
        sourceEventId: event.id,
        attributedCampaignId: await lastCampaignFor(ctx, c.id, event.occurredAt),
      },
      update: {},
    });
    await enqueueJob(ctx, { type: "OPPORTUNITY_DETECTED", payload: { opportunityId: opp.id }, idempotencyKey: `opportunity:${opp.id}` });
  }
  if (opportunityTypes.length && ["NONE", "WATCH"].includes(c.opportunityStatus)) {
    await prisma.contact.update({ where: { id: c.id }, data: { opportunityStatus: "POTENTIAL" } });
  }

  if (cls.classification !== "GENERAL_FRIENDLY") {
    const label = REPLY_CLASSIFICATION_LABEL[cls.classification];
    await upsertTask(
      ctx,
      {
        dedupeKey: `review-reply:${event.id}`,
        type: cls.classification === "APPOINTMENT_REQUEST" ? "FOLLOW_UP" : "REVIEW_REPLY",
        title: cls.classification === "APPOINTMENT_REQUEST" ? `${name} asked to meet — reply today` : `Review ${name}'s reply (${label.toLowerCase()})`,
        description: `${cls.summary}\n\nRecommended: ${cls.recommendedAction}`,
        contactId: c.id,
        dueAt: today,
        sourceType: "REPLY",
        sourceId: event.id,
        intent: cls.classification,
      },
      ws.timezone,
    );
  }
  return { classification: cls.classification, alreadyClassified: false };
}

async function lastCampaignFor(ctx: Ctx, contactId: string, before: Date) {
  const m = await prisma.scheduledMessage.findFirst({
    where: { workspaceId: ctx.workspaceId, contactId, status: { in: ["SENT", "SIMULATED"] }, sentAt: { lte: before }, campaignId: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { campaignId: true },
  });
  return m?.campaignId ?? null;
}

export async function handleOpportunityDetected(ctx: Ctx, opportunityId: string) {
  const ws = await getWorkspace(ctx);
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, workspaceId: ctx.workspaceId }, include: { contact: true } });
  if (!opp) throw new NotFoundError("Opportunity");
  const name = `${opp.contact.firstName} ${opp.contact.lastName}`.trim();
  const typeLabel: Record<string, string> = { BUYER: "buyer", SELLER: "seller", INVESTOR: "investor", REFERRAL: "referral", FUTURE: "future move" };
  const intentFor: Record<string, string> = { BUYER: "POTENTIAL_BUYER", SELLER: "POTENTIAL_SELLER", INVESTOR: "POTENTIAL_INVESTOR", REFERRAL: "REFERRAL_OPPORTUNITY", FUTURE: "FUTURE_OPPORTUNITY" };

  await upsertTask(
    ctx,
    {
      dedupeKey: `opportunity:${opp.id}`,
      type: opp.type === "REFERRAL" ? "REFERRAL_FOLLOW_UP" : "FOLLOW_UP",
      title: opp.type === "REFERRAL" ? `Follow up on ${name}'s referral` : `Follow up with ${name} — possible ${typeLabel[opp.type]}`,
      description: `${opp.summary}${opp.timeframe ? `\nStated timeframe: ${opp.timeframe}` : ""}\nEvidence: “${opp.evidence ?? ""}”\n\nThis is a potential opportunity based on their words — confirm before treating it as real intent.`,
      contactId: opp.contactId,
      dueAt: new Date(Date.now() + 86_400_000),
      sourceType: "OPPORTUNITY",
      sourceId: opp.id,
      intent: intentFor[opp.type],
    },
    ws.timezone,
  );
  await upsertInsight(ctx, {
    contactId: opp.contactId,
    type: opp.type === "REFERRAL" ? "REFERRAL" : "REAL_ESTATE_INTEREST",
    title: `Possible ${typeLabel[opp.type]} opportunity: ${name}`,
    summary: `${opp.summary} Detected from a reply; not confirmed.`,
    evidence: [
      { label: "Their words", value: `“${opp.evidence ?? ""}”`, source: "Inbound reply" },
      ...(opp.timeframe ? [{ label: "Stated timeframe", value: opp.timeframe, source: "Inbound reply" }] : []),
    ],
    confidence: 0.75,
    dedupeKey: `OPPORTUNITY:${opp.id}`,
    source: "AI_MOCK",
  });
  const crm = await pushToCrm(ctx, opp.contactId, "OPPORTUNITY", { name: `${name} — ${typeLabel[opp.type]} (potential)`, type: opp.type });
  if (crm.externalId) await prisma.opportunity.update({ where: { id: opp.id }, data: { externalId: crm.externalId } });
  await audit(ctx, { action: "OPPORTUNITY_DETECTED", entityType: "Opportunity", entityId: opp.id, actorType: "AI", toStatus: "POTENTIAL", details: { type: opp.type, crm: crm.status } });
  return { crm: crm.status };
}

export async function listReplies(ctx: Ctx, opts: { triage?: string; classification?: string } = {}) {
  return prisma.communicationEvent.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      direction: "INBOUND",
      ...(opts.triage ? { triageStatus: opts.triage } : { triageStatus: { not: "ARCHIVED" } }),
      ...(opts.classification ? { classification: opts.classification } : {}),
      contact: { deletedAt: null },
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true, contactType: true } }, opportunities: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}

export async function setReplyTriage(ctx: Ctx, eventId: string, triage: "REVIEWED" | "ARCHIVED" | "NEEDS_ATTENTION") {
  const e = await prisma.communicationEvent.findFirst({ where: { id: eventId, workspaceId: ctx.workspaceId, direction: "INBOUND" } });
  if (!e) throw new NotFoundError("Reply");
  await prisma.communicationEvent.update({ where: { id: eventId }, data: { triageStatus: triage } });
  if (triage !== "NEEDS_ATTENTION") {
    await prisma.agentTask.updateMany({ where: { workspaceId: ctx.workspaceId, dedupeKey: `review-reply:${eventId}`, status: "OPEN" }, data: { status: "DONE", completedAt: new Date() } });
  }
  await audit(ctx, { action: "REPLY_TRIAGED", entityType: "CommunicationEvent", entityId: eventId, fromStatus: e.triageStatus, toStatus: triage });
}

/** Agent confirms they replied personally (outside the app). Nothing is sent by the app. */
export async function logManualReply(ctx: Ctx, eventId: string, body: string) {
  const e = await prisma.communicationEvent.findFirst({ where: { id: eventId, workspaceId: ctx.workspaceId, direction: "INBOUND" } });
  if (!e) throw new NotFoundError("Reply");
  await prisma.communicationEvent.create({
    data: { workspaceId: ctx.workspaceId, contactId: e.contactId, direction: "OUTBOUND", channel: e.channel, type: "MANUAL_REPLY", body: body.trim() || "(replied personally)", occurredAt: new Date(), source: "MANUAL" },
  });
  await prisma.contact.update({ where: { id: e.contactId }, data: { lastCommunicationAt: new Date() } });
  await setReplyTriage(ctx, eventId, "REVIEWED");
}

// ── Opportunities ────────────────────────────────────────────────────────────

export async function listOpportunities(ctx: Ctx, status?: string) {
  return prisma.opportunity.findMany({
    where: { workspaceId: ctx.workspaceId, ...(status ? { status } : { status: { not: "DISMISSED" } }), contact: { deletedAt: null } },
    include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true, contactType: true } }, sourceEvent: { select: { id: true, body: true, occurredAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateOpportunity(ctx: Ctx, id: string, action: "CONFIRM" | "DISMISS" | "APPOINTMENT" | "WON" | "LOST", appointmentAt?: string) {
  const opp = await prisma.opportunity.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!opp) throw new NotFoundError("Opportunity");
  const data: Record<string, unknown> = {};
  if (action === "CONFIRM") Object.assign(data, { status: "CONFIRMED", confirmedById: ctx.userId, confirmedAt: new Date() });
  if (action === "DISMISS") data.status = "DISMISSED";
  if (action === "WON") data.status = "WON";
  if (action === "LOST") data.status = "LOST";
  if (action === "APPOINTMENT") {
    if (!appointmentAt) throw new ValidationError("Choose the appointment date.");
    Object.assign(data, { status: "APPOINTMENT_SET", appointmentAt: new Date(`${appointmentAt}T17:00:00Z`), confirmedById: opp.confirmedById ?? ctx.userId, confirmedAt: opp.confirmedAt ?? new Date() });
  }
  await prisma.opportunity.update({ where: { id }, data });
  if (action === "CONFIRM" || action === "APPOINTMENT") {
    await prisma.contact.update({ where: { id: opp.contactId }, data: { opportunityStatus: "ACTIVE" } });
  }
  await audit(ctx, { action: `OPPORTUNITY_${action}`, entityType: "Opportunity", entityId: id, fromStatus: opp.status, toStatus: String(data.status ?? opp.status) });
}

/** Fictional replies for the demo flow. */
export const SIMULATED_REPLIES = [
  { key: "seller", label: "Potential seller", text: "Thanks for the newsletter! We may sell next year because we're planning to move closer to the grandkids." },
  { key: "referral", label: "Referral", text: "Loved this month's tips. My coworker is relocating to Phoenix this spring and asked if I knew a good agent — can I pass along your info?" },
  { key: "buyer", label: "Potential buyer", text: "We're starting to look for a bigger home now that baby number two is on the way. No rush, but maybe this summer." },
  { key: "investor", label: "Investor", text: "Interesting read. I've been thinking about buying a rental property as an investment — is that something you help with?" },
  { key: "appointment", label: "Appointment request", text: "Can we grab coffee next week? I have a few questions about refinancing versus moving." },
  { key: "friendly", label: "Friendly", text: "Thank you so much for the birthday wishes, that really made my day!" },
  { key: "optout", label: "Opt-out", text: "Please unsubscribe me from these emails. Thanks." },
  { key: "attention", label: "Needs attention", text: "We have a leak under the kitchen sink and the warranty company isn't calling back. Any advice on who to call?" },
] as const;
