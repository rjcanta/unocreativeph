/** Dashboard metrics — all computed from real application data. */
import { toLocalDate, zonedTimeToUtc } from "@/lib/domain/dates";
import type { Ctx } from "./context";
import { prisma } from "./db";
import { parseJsonObject } from "./json";
import { upcomingMilestones } from "./messaging";
import { getWorkspace } from "./workspace";

export const REACH_TYPES = ["SIMULATED_SEND", "SENT", "CALL", "MEETING", "MANUAL_REPLY"];

export async function getDashboard(ctx: Ctx, now = new Date()) {
  const ws = await getWorkspace(ctx);
  const today = toLocalDate(now, ws.timezone);
  const monthStart = zonedTimeToUtc(`${today.slice(0, 7)}-01`, 0, 0, ws.timezone);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const w = { workspaceId: ctx.workspaceId };

  const [total, pastClients, sphere, reached, campaignsScheduled, needsAttention, referrals, appointments, pendingNewsletters, review, aiTasks, preparedMilestones, latestReview, milestones] =
    await Promise.all([
      prisma.contact.count({ where: { ...w, deletedAt: null } }),
      prisma.contact.count({ where: { ...w, deletedAt: null, contactType: "PAST_CLIENT" } }),
      prisma.contact.count({ where: { ...w, deletedAt: null, contactType: "SPHERE" } }),
      prisma.communicationEvent.findMany({ where: { ...w, direction: "OUTBOUND", type: { in: REACH_TYPES }, occurredAt: { gte: monthStart } }, distinct: ["contactId"], select: { contactId: true } }),
      prisma.campaign.count({ where: { ...w, deletedAt: null, status: { in: ["SCHEDULED", "APPROVED"] }, scheduledFor: { gte: now } } }),
      prisma.communicationEvent.count({ where: { ...w, direction: "INBOUND", triageStatus: "NEEDS_ATTENTION" } }),
      prisma.opportunity.count({ where: { ...w, type: "REFERRAL", status: { not: "DISMISSED" } } }),
      prisma.opportunity.count({ where: { ...w, appointmentAt: { not: null }, OR: [{ attributedCampaignId: { not: null } }, { sourceEventId: { not: null } }] } }),
      prisma.campaign.count({ where: { ...w, deletedAt: null, category: "NEWSLETTER", status: "PENDING_APPROVAL" } }),
      prisma.scheduledMessage.count({ where: { ...w, status: "PENDING_APPROVAL" } }),
      prisma.auditLog.count({ where: { ...w, action: "TASK_CREATED", actorType: { in: ["AI", "SYSTEM"] }, createdAt: { gte: weekAgo } } }),
      prisma.auditLog.findMany({ where: { ...w, action: "MESSAGE_PREPARED", createdAt: { gte: weekAgo } }, select: { detailsJson: true } }),
      prisma.auditLog.findFirst({ where: { ...w, action: "DAILY_REVIEW_COMPLETED" }, orderBy: { createdAt: "desc" } }),
      upcomingMilestones(ctx, 30, now),
    ]);

  const kinds = preparedMilestones.map((p) => parseJsonObject<{ kind?: string }>(p.detailsJson).kind);
  const reviewDetails = parseJsonObject<{ contactsReviewed?: number }>(latestReview?.detailsJson);

  return {
    isDemo: ws.isDemo,
    workspaceName: ws.name,
    timezone: ws.timezone,
    sendingPaused: ws.sendingPaused,
    stats: {
      total,
      pastClients,
      sphere,
      reachedThisMonth: reached.length,
      upcomingBirthdays: milestones.filter((m) => m.type === "BIRTHDAY").length,
      upcomingAnniversaries: milestones.filter((m) => m.type === "HOME_ANNIVERSARY").length,
      campaignsScheduled,
      needsAttention,
      referrals,
      appointments,
    },
    activity: {
      lastReviewAt: latestReview?.createdAt ?? null,
      contactsReviewed: reviewDetails.contactsReviewed ?? 0,
      birthdayMessages: kinds.filter((k) => k === "BIRTHDAY").length,
      anniversaryMessages: kinds.filter((k) => k === "HOME_ANNIVERSARY").length,
      newslettersAwaitingApproval: pendingNewsletters,
      messagesAwaitingApproval: review,
      tasksCreated: aiTasks,
    },
    milestones: milestones.slice(0, 8),
  };
}
