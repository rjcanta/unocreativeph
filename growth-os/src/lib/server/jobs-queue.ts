/**
 * Durable job queue (enqueue side). Jobs live in the automation_jobs table, so
 * scheduling survives restarts and does not depend on a browser session.
 * Idempotency keys are unique per workspace: enqueueing the same logical job
 * twice returns the existing job.
 */
import type { AutomationEvent } from "@/lib/domain/types";
import type { Ctx } from "./context";
import { prisma, type Tx } from "./db";

export type EnqueueInput = {
  type: AutomationEvent;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  runAt?: Date;
  maxAttempts?: number;
};

export async function enqueueJob(ctx: Ctx, input: EnqueueInput, db: Tx | typeof prisma = prisma) {
  const existing = await db.automationJob.findUnique({
    where: { workspaceId_idempotencyKey: { workspaceId: ctx.workspaceId, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) return { job: existing, created: false };
  try {
    const job = await db.automationJob.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: input.type,
        payloadJson: JSON.stringify(input.payload),
        idempotencyKey: input.idempotencyKey,
        runAt: input.runAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? 3,
      },
    });
    return { job, created: true };
  } catch (err) {
    // Lost a race on the unique key — return the winner.
    const winner = await db.automationJob.findUnique({
      where: { workspaceId_idempotencyKey: { workspaceId: ctx.workspaceId, idempotencyKey: input.idempotencyKey } },
    });
    if (winner) return { job: winner, created: false };
    throw err;
  }
}

/** Unique-ish suffix for events that are allowed to repeat (e.g. every contact edit). */
export const eventKey = (prefix: string) => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
