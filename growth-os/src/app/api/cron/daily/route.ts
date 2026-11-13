import { NextResponse } from "next/server";
import { systemCtx } from "@/lib/server/context";
import { prisma } from "@/lib/server/db";
import { processDueJobs } from "@/lib/server/jobs-runner";
import { runDailyPlanner } from "@/lib/server/planner";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const auth = cronAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const workspaces = await prisma.workspace.findMany({ select: { id: true } });
  const results = [];
  for (const w of workspaces) {
    try {
      results.push({ workspaceId: w.id, ...(await runDailyPlanner(systemCtx(w.id))) });
    } catch (err) {
      results.push({ workspaceId: w.id, error: (err as Error).message });
    }
  }
  const jobs = await processDueJobs({ limit: 1000, workerId: "cron-daily" });
  return NextResponse.json({ workspaces: results, jobs: { processed: jobs.processed, failed: jobs.failed } });
}

export const GET = handle;
export const POST = handle;
