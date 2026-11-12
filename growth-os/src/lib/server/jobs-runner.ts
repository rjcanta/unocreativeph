/**
 * Job processor. Claims due jobs with an optimistic lock, runs the handler,
 * and records an auditable outcome. Failures retry with exponential backoff;
 * non-retryable errors (policy blocks, missing capabilities) fail immediately
 * with an actionable message.
 */
import type { AutomationEvent } from "@/lib/domain/types";
import { audit } from "./audit";
import { systemCtx, type Ctx } from "./context";
import { prisma } from "./db";
import { deliverMessage } from "./delivery";
import { AppError } from "./errors";
import { generateInsights } from "./insights";
import { pushToCrm } from "./integrations";
import { materializeCampaign, prepareMilestoneOutreach } from "./messaging";
import { enqueueUpcomingMilestones } from "./planner";
import { classifyAndRouteReply, handleOpportunityDetected } from "./replies";
import { getWorkspace } from "./workspace";

type Handler = (ctx: Ctx, payload: Record<string, unknown>, now: Date) => Promise<unknown>;

class DeferJob extends Error {
  constructor(
    public until: Date,
    public reason: string,
  ) {
    super(reason);
  }
}

const contactsChanged: Handler = async (ctx, p, now) => {
  const ids = (p.contactIds as string[]) ?? [];
  const ws = await getWorkspace(ctx);
  const insights = await generateInsights(ctx, ws.rules, ws.timezone, now, ids);
  const milestoneJobs = await enqueueUpcomingMilestones(ctx, now, ids);
  return { contacts: ids.length, insightsCreated: insights.created, tasksCreated: insights.tasks, milestoneJobs };
};

const milestone: Handler = async (ctx, p, now) =>
  prepareMilestoneOutreach(ctx, { contactId: String(p.contactId), milestoneId: String(p.milestoneId), occurrence: String(p.occurrence) }, now);

const campaignMaterialize: Handler = async (ctx, p, now) => {
  const c = await prisma.campaign.findFirst({ where: { id: String(p.campaignId), workspaceId: ctx.workspaceId } });
  if (!c) return { skipped: "Campaign not found" };
  if (!c.scheduledFor) return { waiting: "Approved — choose a send date to schedule delivery." };
  if (!["APPROVED", "SCHEDULED"].includes(c.status)) return { skipped: `Campaign is ${c.status.toLowerCase()}` };
  const { result } = await materializeCampaign(ctx, c.id, now);
  return result;
};

const due: Handler = async (ctx, p, now) => {
  const r = await deliverMessage(ctx, String(p.messageId), now);
  if (r.outcome === "DEFERRED") throw new DeferJob(r.until, r.detail);
  return r;
};

const unsubscribed: Handler = async (ctx, p) => {
  const crm = await pushToCrm(ctx, String(p.contactId), "UNSUBSCRIBE");
  return { crm: crm.status, detail: crm.message };
};

export const HANDLERS: Record<AutomationEvent, Handler> = {
  CONTACT_CREATED: contactsChanged,
  CONTACT_UPDATED: contactsChanged,
  CONTACT_IMPORTED: contactsChanged,
  BIRTHDAY_UPCOMING: milestone,
  HOME_ANNIVERSARY_UPCOMING: milestone,
  MILESTONE_UPCOMING: milestone,
  CAMPAIGN_SCHEDULED: campaignMaterialize,
  CAMPAIGN_APPROVED: campaignMaterialize,
  CAMPAIGN_DUE: due,
  INBOUND_REPLY_RECEIVED: async (ctx, p) => classifyAndRouteReply(ctx, String(p.eventId)),
  OPPORTUNITY_DETECTED: async (ctx, p) => handleOpportunityDetected(ctx, String(p.opportunityId)),
  CONTACT_UNSUBSCRIBED: unsubscribed,
};

export type ProcessSummary = { processed: number; succeeded: number; retrying: number; failed: number; deferred: number; results: { id: string; type: string; status: string; detail?: string }[] };

export async function processDueJobs(opts: { now?: Date; limit?: number; workspaceId?: string; workerId?: string } = {}): Promise<ProcessSummary> {
  const now = opts.now ?? new Date();
  const worker = opts.workerId ?? `worker-${process.pid}`;
  const staleLock = new Date(now.getTime() - 10 * 60_000);
  const summary: ProcessSummary = { processed: 0, succeeded: 0, retrying: 0, failed: 0, deferred: 0, results: [] };

  // Recover jobs whose worker died mid-run.
  await prisma.automationJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: staleLock }, ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}) },
    data: { status: "PENDING", lockedAt: null, lockedBy: null, lastError: "Recovered after worker timeout" },
  });

  for (let round = 0; round < 5; round++) {
    const due = await prisma.automationJob.findMany({
      // Jobs enqueued by earlier handlers in this run (at real time) are picked up too.
      where: { status: "PENDING", runAt: { lte: new Date(Math.max(now.getTime(), Date.now())) }, ...(opts.workspaceId ? { workspaceId: opts.workspaceId } : {}) },
      orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
      take: Math.max(0, (opts.limit ?? 100) - summary.processed),
    });
    if (!due.length) break;
    for (const job of due) {
      const claim = await prisma.automationJob.updateMany({
        where: { id: job.id, status: "PENDING" },
        data: { status: "RUNNING", lockedAt: new Date(), lockedBy: worker, attempts: { increment: 1 } },
      });
      if (claim.count === 0) continue;
      summary.processed++;
      const ctx = systemCtx(job.workspaceId);
      const handler = HANDLERS[job.type as AutomationEvent];
      try {
        if (!handler) throw new AppError(`No handler registered for ${job.type}`, "NO_HANDLER", false);
        const result = await handler(ctx, JSON.parse(job.payloadJson), now);
        await prisma.automationJob.update({
          where: { id: job.id },
          data: { status: "SUCCEEDED", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null, resultJson: JSON.stringify(result ?? {}) },
        });
        summary.succeeded++;
        summary.results.push({ id: job.id, type: job.type, status: "SUCCEEDED" });
      } catch (err) {
        if (err instanceof DeferJob) {
          await prisma.automationJob.update({
            where: { id: job.id },
            data: { status: "PENDING", runAt: err.until, lockedAt: null, lockedBy: null, attempts: { decrement: 1 }, lastError: `Deferred: ${err.reason}` },
          });
          summary.deferred++;
          summary.results.push({ id: job.id, type: job.type, status: "DEFERRED", detail: err.reason });
          continue;
        }
        const e = err as Error;
        const retryable = !(e instanceof AppError) || e.retryable;
        const attempts = job.attempts + 1;
        const giveUp = !retryable || attempts >= job.maxAttempts;
        const backoffMs = Math.min(60, 2 ** attempts) * 60_000;
        await prisma.automationJob.update({
          where: { id: job.id },
          data: {
            status: giveUp ? "FAILED" : "PENDING",
            runAt: giveUp ? job.runAt : new Date(now.getTime() + backoffMs),
            lockedAt: null,
            lockedBy: null,
            lastError: `${e.message}${giveUp ? "" : ` (retry ${attempts}/${job.maxAttempts} scheduled)`}`,
          },
        });
        if (giveUp) {
          summary.failed++;
          await audit(ctx, { action: "JOB_FAILED", entityType: "AutomationJob", entityId: job.id, toStatus: "FAILED", details: { type: job.type, error: e.message } });
        } else summary.retrying++;
        summary.results.push({ id: job.id, type: job.type, status: giveUp ? "FAILED" : "RETRYING", detail: e.message });
      }
    }
  }
  return summary;
}

async function ownJob(ctx: Ctx, id: string) {
  const job = await prisma.automationJob.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!job) throw new AppError("Job not found in this workspace.", "NOT_FOUND", false);
  return job;
}

export async function retryJob(ctx: Ctx, id: string) {
  const job = await ownJob(ctx, id);
  if (!["FAILED", "CANCELLED"].includes(job.status)) throw new AppError("Only failed or cancelled jobs can be retried.", "VALIDATION", false);
  await prisma.automationJob.update({ where: { id }, data: { status: "PENDING", runAt: new Date(), attempts: 0, lastError: null } });
  await audit(ctx, { action: "JOB_RETRIED", entityType: "AutomationJob", entityId: id, fromStatus: job.status, toStatus: "PENDING" });
}

export async function setJobStatus(ctx: Ctx, id: string, status: "PAUSED" | "PENDING" | "CANCELLED") {
  const job = await ownJob(ctx, id);
  const allowed: Record<string, string[]> = { PAUSED: ["PENDING"], PENDING: ["PAUSED"], CANCELLED: ["PENDING", "PAUSED", "FAILED"] };
  if (!allowed[status].includes(job.status)) throw new AppError(`Cannot change a ${job.status.toLowerCase()} job to ${status.toLowerCase()}.`, "VALIDATION", false);
  await prisma.automationJob.update({ where: { id }, data: { status } });
  await audit(ctx, { action: `JOB_${status}`, entityType: "AutomationJob", entityId: id, fromStatus: job.status, toStatus: status });
}

export async function rescheduleJob(ctx: Ctx, id: string, runAt: Date) {
  const job = await ownJob(ctx, id);
  if (!["PENDING", "PAUSED"].includes(job.status)) throw new AppError("Only pending or paused jobs can be rescheduled.", "VALIDATION", false);
  await prisma.automationJob.update({ where: { id }, data: { runAt } });
  if (job.type === "CAMPAIGN_DUE") {
    const { messageId } = JSON.parse(job.payloadJson) as { messageId: string };
    await prisma.scheduledMessage.updateMany({ where: { id: messageId, workspaceId: ctx.workspaceId, status: "SCHEDULED" }, data: { scheduledFor: runAt } });
  }
  await audit(ctx, { action: "JOB_RESCHEDULED", entityType: "AutomationJob", entityId: id, details: { runAt: runAt.toISOString() } });
}

export async function listJobs(ctx: Ctx, opts: { status?: string; type?: string; limit?: number } = {}) {
  return prisma.automationJob.findMany({
    where: { workspaceId: ctx.workspaceId, ...(opts.status ? { status: opts.status } : {}), ...(opts.type ? { type: opts.type } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take: opts.limit ?? 100,
  });
}
