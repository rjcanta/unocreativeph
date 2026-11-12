/** Run the daily relationship review for every workspace, then process due jobs. */
import { systemCtx } from "@/lib/server/context";
import { prisma } from "@/lib/server/db";
import { processDueJobs } from "@/lib/server/jobs-runner";
import { runDailyPlanner } from "@/lib/server/planner";

async function main() {
  const workspaces = await prisma.workspace.findMany({ select: { id: true, name: true } });
  for (const w of workspaces) {
    const summary = await runDailyPlanner(systemCtx(w.id));
    console.log(w.name, summary);
  }
  console.log(await processDueJobs({ limit: 1000, workerId: "planner-cli" }));
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
