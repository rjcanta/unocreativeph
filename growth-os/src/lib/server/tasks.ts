/** Agent tasks and the daily relationship action queue. */
import { diffDays, toLocalDate } from "@/lib/domain/dates";
import { rankAction } from "@/lib/domain/ranking";
import type { TaskType } from "@/lib/domain/types";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { prisma, type Tx } from "./db";
import { NotFoundError, ValidationError } from "./errors";
import { parseJsonArray } from "./json";

export type TaskInput = {
  dedupeKey: string;
  type: TaskType;
  title: string;
  description?: string;
  contactId?: string | null;
  dueAt?: Date | null;
  sourceType?: string;
  sourceId?: string | null;
  intent?: string | null;
  extraReasons?: string[];
};

function rank(type: TaskType, tier: string | null | undefined, dueAt: Date | null | undefined, intent: string | null | undefined, timeZone: string, now = new Date()) {
  const days = dueAt ? diffDays(toLocalDate(now, timeZone), toLocalDate(dueAt, timeZone)) : null;
  return rankAction({ type, tier, daysUntilDue: days, intent });
}

/** Create a task once per dedupe key. Never reopens a task the agent closed. */
export async function upsertTask(ctx: Ctx, input: TaskInput, timeZone: string, db: Tx | typeof prisma = prisma) {
  const existing = await db.agentTask.findUnique({ where: { workspaceId_dedupeKey: { workspaceId: ctx.workspaceId, dedupeKey: input.dedupeKey } } });
  if (existing) return { task: existing, created: false };
  const contact = input.contactId
    ? await db.contact.findFirst({ where: { id: input.contactId, workspaceId: ctx.workspaceId }, select: { tier: true, doNotContact: true, assignedAgentId: true } })
    : null;
  if (contact?.doNotContact && input.type !== "VERIFY_DATA") return { task: null, created: false };
  const r = rank(input.type, contact?.tier, input.dueAt, input.intent, timeZone);
  const task = await db.agentTask.create({
    data: {
      workspaceId: ctx.workspaceId,
      contactId: input.contactId ?? null,
      assigneeId: contact?.assignedAgentId ?? null,
      type: input.type,
      title: input.title,
      description: input.description ?? "",
      reasonsJson: JSON.stringify([...(input.extraReasons ?? []), ...r.reasons]),
      intent: input.intent ?? null,
      priority: r.priority,
      dueAt: input.dueAt ?? null,
      sourceType: input.sourceType ?? "SYSTEM",
      sourceId: input.sourceId ?? null,
      dedupeKey: input.dedupeKey,
    },
  });
  await audit(ctx, { action: "TASK_CREATED", entityType: "AgentTask", entityId: task.id, toStatus: "OPEN", details: { type: input.type, title: input.title } }, db);
  return { task, created: true };
}

/** Re-rank open tasks (urgency changes as due dates approach). */
export async function refreshTaskPriorities(ctx: Ctx, timeZone: string, now = new Date()) {
  const tasks = await prisma.agentTask.findMany({
    where: { workspaceId: ctx.workspaceId, status: "OPEN" },
    include: { contact: { select: { tier: true } } },
  });
  for (const t of tasks) {
    const extra = parseJsonArray<string>(t.reasonsJson).filter((r) => !/^(Due|Overdue|VIP|Active|Standard|Relationship needs|Contact (asked|mentioned)|Reply needs|Negative)/.test(r));
    const r = rank(t.type as TaskType, t.contact?.tier, t.dueAt, t.intent, timeZone, now);
    await prisma.agentTask.update({ where: { id: t.id }, data: { priority: r.priority, reasonsJson: JSON.stringify([...extra, ...r.reasons]) } });
  }
  return tasks.length;
}

export async function listTasks(ctx: Ctx, opts: { status?: string; type?: string; contactId?: string; limit?: number } = {}) {
  return prisma.agentTask.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: opts.status ?? "OPEN",
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.contactId ? { contactId: opts.contactId } : {}),
    },
    include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true, contactType: true } } },
    orderBy: opts.status && opts.status !== "OPEN" ? [{ completedAt: "desc" }, { updatedAt: "desc" }] : [{ priority: "desc" }, { dueAt: "asc" }],
    take: opts.limit ?? 200,
  });
}

export async function getTask(ctx: Ctx, id: string) {
  const t = await prisma.agentTask.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { contact: true, assignee: { select: { name: true } } },
  });
  if (!t) throw new NotFoundError("Task");
  return t;
}

export async function setTaskStatus(ctx: Ctx, id: string, status: "DONE" | "DISMISSED" | "OPEN") {
  const t = await prisma.agentTask.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!t) throw new NotFoundError("Task");
  await prisma.agentTask.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  if (status === "DONE" && t.contactId && ["CALL", "PERSONAL_MESSAGE", "GIFT", "RECONNECT", "FOLLOW_UP", "REFERRAL_FOLLOW_UP"].includes(t.type)) {
    await prisma.contact.update({ where: { id: t.contactId }, data: { lastCommunicationAt: new Date() } });
  }
  await audit(ctx, { action: `TASK_${status}`, entityType: "AgentTask", entityId: id, fromStatus: t.status, toStatus: status });
}

export async function snoozeTask(ctx: Ctx, id: string, days: number, timeZone: string) {
  const t = await prisma.agentTask.findFirst({ where: { id, workspaceId: ctx.workspaceId }, include: { contact: { select: { tier: true } } } });
  if (!t) throw new NotFoundError("Task");
  const dueAt = new Date(Date.now() + days * 86_400_000);
  const r = rank(t.type as TaskType, t.contact?.tier, dueAt, t.intent, timeZone);
  await prisma.agentTask.update({ where: { id }, data: { dueAt, priority: r.priority } });
  await audit(ctx, { action: "TASK_SNOOZED", entityType: "AgentTask", entityId: id, details: { days } });
}

export async function createManualTask(ctx: Ctx, input: { title: string; contactId?: string | null; dueDate?: string | null; type?: TaskType; description?: string }, timeZone: string) {
  if (!input.title.trim()) throw new ValidationError("Task title is required.");
  const dueAt = input.dueDate ? new Date(`${input.dueDate}T17:00:00Z`) : null;
  return upsertTask(
    ctx,
    {
      dedupeKey: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
      type: input.type ?? "FOLLOW_UP",
      title: input.title.trim(),
      description: input.description,
      contactId: input.contactId || null,
      dueAt,
      sourceType: "MANUAL",
      extraReasons: ["Created by you"],
    },
    timeZone,
  );
}
