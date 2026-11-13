import { NextResponse } from "next/server";
import { processDueJobs } from "@/lib/server/jobs-runner";
import { cronAuthorized } from "../auth";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const auth = cronAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const r = await processDueJobs({ limit: 500, workerId: "cron" });
  return NextResponse.json({ processed: r.processed, succeeded: r.succeeded, deferred: r.deferred, retrying: r.retrying, failed: r.failed });
}

export const GET = handle;
export const POST = handle;
