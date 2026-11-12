/**
 * Daily relationship review — the "AI Relationship Manager" sweep.
 * Safe to run any number of times per day: every side effect is idempotent.
 * Production: trigger from a scheduler (e.g. Vercel Cron → /api/cron/daily).
 */
import { addDays, nextOccurrence, toLocalDate, diffDays, parseLocalDate, makeLocalDate } from "@/lib/domain/dates";
import type { AutomationEvent, NewsletterKind } from "@/lib/domain/types";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { createNewsletterDraft } from "./campaigns";
import { prisma } from "./db";
import { generateInsights } from "./insights";
import { enqueueJob } from "./jobs-queue";
import { refreshTaskPriorities, upsertTask } from "./tasks";
import { getWorkspace } from "./workspace";

const EVENT_FOR: Record<string, AutomationEvent> = {
  BIRTHDAY: "BIRTHDAY_UPCOMING",
  HOME_ANNIVERSARY: "HOME_ANNIVERSARY_UPCOMING",
  RELATIONSHIP_ANNIVERSARY: "MILESTONE_UPCOMING",
  CUSTOM: "MILESTONE_UPCOMING",
};

export async function enqueueUpcomingMilestones(ctx: Ctx, now = new Date(), contactIds?: string[]) {
  const ws = await getWorkspace(ctx);
  const today = toLocalDate(now, ws.timezone);
  const milestones = await prisma.contactMilestone.findMany({
    where: { workspaceId: ctx.workspaceId, active: true, contact: { deletedAt: null, doNotContact: false }, ...(contactIds ? { contactId: { in: contactIds } } : {}) },
  });
  let enqueued = 0;
  for (const m of milestones) {
    const occurrence = nextOccurrence(m.month, m.day, today, ws.rules.leapDayRule);
    if (diffDays(today, occurrence) > ws.rules.milestoneLookaheadDays) continue;
    const r = await enqueueJob(ctx, {
      type: EVENT_FOR[m.type] ?? "MILESTONE_UPCOMING",
      payload: { contactId: m.contactId, milestoneId: m.id, occurrence },
      idempotencyKey: `milestone:${m.id}:${occurrence}`,
      runAt: now,
    });
    if (r.created) enqueued++;
  }
  return enqueued;
}

/** Newsletter slots (days of month) in the next `days` days without a campaign. */
async function prepareUpcomingNewsletters(ctx: Ctx, now: Date, days = 21) {
  const ws = await getWorkspace(ctx);
  const today = toLocalDate(now, ws.timezone);
  const horizon = addDays(today, days);
  const slots: { date: string; kind: NewsletterKind }[] = [];
  const { year, month } = parseLocalDate(today);
  for (let i = 0; i < 2; i++) {
    const y = month + i > 12 ? year + 1 : year;
    const m = ((month + i - 1) % 12) + 1;
    ws.rules.newsletterDays.slice(0, ws.rules.maxRoutinePerMonth).forEach((d, idx) => {
      const date = makeLocalDate(y, m, d);
      if (date > today && date <= horizon) slots.push({ date, kind: idx === 0 ? "MARKET_INSIGHTS" : "LIFESTYLE_COMMUNITY" });
    });
  }
  let created = 0;
  for (const s of slots) {
    const dayStart = new Date(`${s.date}T00:00:00Z`);
    const exists = await prisma.campaign.findFirst({
      where: { workspaceId: ctx.workspaceId, category: "NEWSLETTER", kind: s.kind, deletedAt: null, scheduledFor: { gte: new Date(dayStart.getTime() - 4 * 86_400_000), lte: new Date(dayStart.getTime() + 5 * 86_400_000) } },
    });
    if (exists) continue;
    await createNewsletterDraft({ ...ctx, actorType: "AI" }, { kind: s.kind, sendDate: s.date }, now);
    created++;
  }
  return created;
}

export async function runDailyPlanner(ctx: Ctx, now = new Date()) {
  const ws = await getWorkspace(ctx);
  const sys: Ctx = { ...ctx, actorType: "AI" };
  const milestoneJobs = await enqueueUpcomingMilestones(sys, now);
  const insights = await generateInsights(sys, ws.rules, ws.timezone, now);
  const newsletters = await prepareUpcomingNewsletters(sys, now);

  // Campaigns awaiting approval close to their send date.
  const pending = await prisma.campaign.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, status: { in: ["DRAFT", "PENDING_APPROVAL"] }, scheduledFor: { lte: new Date(now.getTime() + 10 * 86_400_000), gte: now } },
  });
  let approvalTasks = 0;
  for (const c of pending) {
    const r = await upsertTask(
      sys,
      {
        dedupeKey: `approve-campaign:${c.id}`,
        type: "APPROVE_CAMPAIGN",
        title: `Review & approve “${c.name}”`,
        description: "Scheduled soon and still waiting for your approval. Nothing is sent until you approve it.",
        dueAt: new Date(c.scheduledFor!.getTime() - 2 * 86_400_000),
        sourceType: "CAMPAIGN",
        sourceId: c.id,
      },
      ws.timezone,
    );
    if (r.created) approvalTasks++;
  }
  await refreshTaskPriorities(sys, ws.timezone, now);

  const summary = { contactsReviewed: insights.reviewed, insightsCreated: insights.created, tasksCreated: insights.tasks + approvalTasks, milestoneJobs, newslettersDrafted: newsletters };
  await audit(sys, { action: "DAILY_REVIEW_COMPLETED", entityType: "Workspace", entityId: ctx.workspaceId, details: summary });
  return summary;
}
