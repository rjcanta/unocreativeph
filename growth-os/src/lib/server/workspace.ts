import { parseBrandVoice, parseCompliance, parseScheduling } from "@/lib/domain/settings";
import type { Ctx } from "./context";
import { prisma } from "./db";
import { NotFoundError } from "./errors";

export async function getWorkspace(ctx: Ctx) {
  const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
  if (!ws) throw new NotFoundError("Workspace");
  return {
    ...ws,
    brand: parseBrandVoice(ws.brandVoiceJson),
    compliance: parseCompliance(ws.complianceJson),
    rules: parseScheduling(ws.schedulingJson),
  };
}
export type WorkspaceWithSettings = Awaited<ReturnType<typeof getWorkspace>>;
