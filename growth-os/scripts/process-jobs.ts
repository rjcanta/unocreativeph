/**
 * Process due automation jobs once (all workspaces). Suitable for a system
 * scheduler (cron, systemd timer) when not using the HTTP cron endpoint.
 *   npm run jobs:process            → process jobs due now
 *   npm run jobs:process -- --at 2026-11-20T17:00:00Z   → simulate a later time (demo only)
 */
import { prisma } from "@/lib/server/db";
import { processDueJobs } from "@/lib/server/jobs-runner";

async function main() {
  const idx = process.argv.indexOf("--at");
  const now = idx > 0 ? new Date(process.argv[idx + 1]) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("Invalid --at timestamp");
  const r = await processDueJobs({ now, limit: 1000, workerId: "cli" });
  console.log(JSON.stringify({ now: now.toISOString(), ...r, results: r.results.slice(0, 50) }, null, 2));
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
