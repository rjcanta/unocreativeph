import type { Ctx } from "./context";
import { prisma, type Tx } from "./db";

export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  details?: Record<string, unknown>;
  actorType?: Ctx["actorType"];
};

export async function audit(ctx: Ctx, input: AuditInput, db: Tx | typeof prisma = prisma) {
  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      actorType: input.actorType ?? ctx.actorType,
      actorId: ctx.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      detailsJson: JSON.stringify(input.details ?? {}),
    },
  });
}
