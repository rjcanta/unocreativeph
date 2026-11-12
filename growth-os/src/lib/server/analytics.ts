/**
 * Reporting. Metrics a provider does not supply are returned as null and shown
 * as "Unavailable" — never as zero.
 */
import type { Prisma } from "@/generated/prisma/client";
import { toLocalDate } from "@/lib/domain/dates";
import type { Ctx } from "./context";
import { REACH_TYPES } from "./dashboard";
import { prisma } from "./db";
import { getWorkspace } from "./workspace";

export type AnalyticsFilters = { from: Date; to: Date; contactType?: string; tier?: string; agentId?: string; campaignId?: string };

const POSITIVE = ["GENERAL_FRIENDLY", "POTENTIAL_BUYER", "POTENTIAL_SELLER", "POTENTIAL_INVESTOR", "REFERRAL_OPPORTUNITY", "FUTURE_OPPORTUNITY", "APPOINTMENT_REQUEST"];

export async function getAnalytics(ctx: Ctx, f: AnalyticsFilters) {
  const ws = await getWorkspace(ctx);
  const w = { workspaceId: ctx.workspaceId };
  const contactWhere: Prisma.ContactWhereInput = {
    ...w,
    ...(f.contactType ? { contactType: f.contactType } : {}),
    ...(f.tier ? { tier: f.tier } : {}),
    ...(f.agentId ? { assignedAgentId: f.agentId } : {}),
  };
  const range = { gte: f.from, lte: f.to };
  const campaignFilter = f.campaignId ? { scheduledMessage: { campaignId: f.campaignId } } : {};

  const [contacts, outbound, inbound, messages, providerEvents, tasksDone, milestoneTasksDone, opps, unsubscribed, dnc, allActive] = await Promise.all([
    prisma.contact.findMany({ where: { ...contactWhere, deletedAt: null }, select: { createdAt: true, contactType: true } }),
    prisma.communicationEvent.findMany({ where: { ...w, direction: "OUTBOUND", type: { in: REACH_TYPES }, occurredAt: range, contact: contactWhere, ...campaignFilter }, select: { contactId: true, contact: { select: { contactType: true } } } }),
    prisma.communicationEvent.findMany({ where: { ...w, direction: "INBOUND", occurredAt: range, contact: contactWhere }, select: { contactId: true, classification: true, contact: { select: { contactType: true } } } }),
    prisma.scheduledMessage.findMany({
      where: { ...w, status: { in: ["SENT", "SIMULATED"] }, sentAt: range, contact: contactWhere, ...(f.campaignId ? { campaignId: f.campaignId } : {}) },
      select: { sentAt: true, category: true, status: true },
    }),
    prisma.communicationEvent.groupBy({ by: ["type"], where: { ...w, type: { in: ["DELIVERED", "OPENED", "CLICKED", "BOUNCED"] }, occurredAt: range, contact: contactWhere, ...campaignFilter }, _count: true }),
    prisma.agentTask.count({ where: { ...w, status: "DONE", completedAt: range, ...(f.contactType || f.tier || f.agentId ? { contact: contactWhere } : {}) } }),
    prisma.agentTask.count({ where: { ...w, status: "DONE", sourceType: "MILESTONE", completedAt: range, ...(f.contactType || f.tier || f.agentId ? { contact: contactWhere } : {}) } }),
    prisma.opportunity.findMany({ where: { ...w, createdAt: range, contact: contactWhere, ...(f.campaignId ? { attributedCampaignId: f.campaignId } : {}) }, select: { type: true, status: true, appointmentAt: true } }),
    prisma.contact.count({ where: { ...contactWhere, unsubscribedAt: range } }),
    prisma.contact.count({ where: { ...contactWhere, deletedAt: null, doNotContact: true } }),
    prisma.contact.findMany({ where: { ...contactWhere, deletedAt: null }, select: { unsubscribedAt: true, doNotContact: true, consentRecords: { where: { channel: "EMAIL", purpose: "MARKETING" }, orderBy: { capturedAt: "desc" }, take: 1, select: { status: true } } } }),
  ]);

  // Contact growth: cumulative count by month for the last 12 months of data.
  const months = new Map<string, number>();
  for (const c of contacts) {
    const k = toLocalDate(c.createdAt, ws.timezone).slice(0, 7);
    months.set(k, (months.get(k) ?? 0) + 1);
  }
  const sorted = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
  let running = 0;
  const growth = sorted.map(([month, added]) => ({ month, added, total: (running += added) })).slice(-12);

  const engagement = (["PAST_CLIENT", "SPHERE"] as const).map((type) => {
    const size = contacts.filter((c) => c.contactType === type).length;
    const reached = new Set(outbound.filter((o) => o.contact.contactType === type).map((o) => o.contactId)).size;
    const replies = inbound.filter((i) => i.contact.contactType === type);
    const positive = replies.filter((r) => r.classification && POSITIVE.includes(r.classification)).length;
    return { type, label: type === "PAST_CLIENT" ? "Past Clients" : "Sphere", contacts: size, reached, replies: replies.length, positive, replyRate: reached ? Math.round((new Set(replies.map((r) => r.contactId)).size / reached) * 100) : null };
  });

  const volume = new Map<string, { month: string; NEWSLETTER: number; SEASONAL: number; MILESTONE: number }>();
  for (const m of messages) {
    const k = toLocalDate(m.sentAt!, ws.timezone).slice(0, 7);
    const row = volume.get(k) ?? { month: k, NEWSLETTER: 0, SEASONAL: 0, MILESTONE: 0 };
    row[m.category as "NEWSLETTER" | "SEASONAL" | "MILESTONE"]++;
    volume.set(k, row);
  }
  const provider = Object.fromEntries(providerEvents.map((e) => [e.type, e._count])) as Record<string, number>;
  const hasProviderData = providerEvents.length > 0;
  const delivered = messages.filter((m) => m.status === "SENT").length;

  const noConsent = allActive.filter((c) => !c.unsubscribedAt && !c.doNotContact && c.consentRecords[0]?.status !== "GRANTED").length;

  return {
    growth,
    engagement,
    volume: [...volume.values()].sort((a, b) => a.month.localeCompare(b.month)),
    delivery: {
      liveSent: delivered,
      simulated: messages.filter((m) => m.status === "SIMULATED").length,
      delivered: hasProviderData ? (provider.DELIVERED ?? 0) : null,
      opened: hasProviderData ? (provider.OPENED ?? 0) : null,
      clicked: hasProviderData ? (provider.CLICKED ?? 0) : null,
      bounced: hasProviderData ? (provider.BOUNCED ?? 0) : null,
      note: hasProviderData ? null : "Delivery, open and click data come from a connected email provider. None has reported events for this period, so these metrics are unavailable.",
    },
    positiveResponses: inbound.filter((r) => r.classification && POSITIVE.includes(r.classification)).length,
    totalReplies: inbound.length,
    milestonesCompleted: messages.filter((m) => m.category === "MILESTONE").length + milestoneTasksDone,
    tasksCompleted: tasksDone,
    referrals: opps.filter((o) => o.type === "REFERRAL").length,
    qualifiedConversations: opps.filter((o) => ["CONFIRMED", "APPOINTMENT_SET", "WON"].includes(o.status)).length,
    potentialOpportunities: opps.filter((o) => o.status === "POTENTIAL").length,
    appointments: opps.filter((o) => o.appointmentAt).length,
    suppression: { unsubscribedInPeriod: unsubscribed, unsubscribedTotal: allActive.filter((c) => c.unsubscribedAt).length, doNotContact: dnc, noConsent },
  };
}
