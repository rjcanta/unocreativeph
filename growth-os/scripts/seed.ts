/**
 * Seed (or with --reset, recreate) the fictional demo workspace.
 * Only the workspace with the demo slug AND isDemo=true is ever deleted.
 */
import { seedDemoWorkspace } from "@/lib/demo/seed";
import { prisma } from "@/lib/server/db";

async function main() {
  const reset = process.argv.includes("--reset");
  const started = Date.now();
  const result = await seedDemoWorkspace({ reset });
  console.log(`Demo workspace ready in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
