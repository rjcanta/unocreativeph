/**
 * Create an empty, NON-demo workspace for a real agent (no seeded data).
 *   npm run workspace:create -- --name "Team Name" --slug team-name --owner "Agent Name" --email agent@yourdomain.com [--tz America/Phoenix]
 * Then set WORKSPACE_SLUG=team-name to use it locally (demo authentication still applies —
 * do not expose this to the internet until production auth is implemented).
 */
import { DEFAULT_SCHEDULING } from "@/lib/domain/settings";
import { prisma } from "@/lib/server/db";

const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const name = arg("name");
  const slug = arg("slug");
  const owner = arg("owner");
  const email = arg("email");
  const tz = arg("tz") ?? "America/Phoenix";
  if (!name || !slug || !owner || !email) throw new Error("Required: --name --slug --owner --email");
  new Intl.DateTimeFormat("en-US", { timeZone: tz });
  const ws = await prisma.workspace.create({
    data: { name, slug, timezone: tz, isDemo: false, schedulingJson: JSON.stringify(DEFAULT_SCHEDULING), brandVoiceJson: JSON.stringify({ agentName: owner, teamName: name }) },
  });
  await prisma.user.create({ data: { workspaceId: ws.id, name: owner, email, role: "OWNER" } });
  for (const t of await prisma.campaignTemplate.findMany({ where: { workspace: { isDemo: true } }, distinct: ["key"] })) {
    await prisma.campaignTemplate.create({ data: { workspaceId: ws.id, key: t.key, category: t.category, name: t.name, description: t.description, subjectTemplate: t.subjectTemplate, bodyTemplate: t.bodyTemplate.replaceAll("Kelly", owner.split(" ")[0]) } });
  }
  console.log(`Created workspace "${name}" (${slug}). Set WORKSPACE_SLUG=${slug} to use it.`);
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
