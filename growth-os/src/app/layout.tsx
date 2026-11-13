import type { Metadata, Viewport } from "next";
import { FlaskConical, PauseCircle } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { appMode, getSession, type Session } from "@/lib/server/context";
import { prisma } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Realtor Growth OS", template: "%s · Realtor Growth OS" },
  description: "AI Relationship Manager for past clients and sphere of influence.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f7f6f2" };
export const dynamic = "force-dynamic";

async function navCounts(s: Session) {
  const w = { workspaceId: s.workspaceId };
  const [tasks, approvals, replies, failed, ws] = await Promise.all([
    prisma.agentTask.count({ where: { ...w, status: "OPEN" } }),
    prisma.campaign.count({ where: { ...w, deletedAt: null, status: { in: ["PENDING_APPROVAL"] } } }).then(async (c) => c + (await prisma.scheduledMessage.count({ where: { ...w, status: "PENDING_APPROVAL" } }))),
    prisma.communicationEvent.count({ where: { ...w, direction: "INBOUND", triageStatus: "NEEDS_ATTENTION" } }),
    prisma.automationJob.count({ where: { ...w, status: "FAILED" } }),
    prisma.workspace.findUnique({ where: { id: s.workspaceId }, select: { sendingPaused: true } }),
  ]);
  return { counts: { tasks, approvals, replies, failed }, paused: !!ws?.sendingPaused };
}

function SetupScreen({ error }: { error: AppError | Error }) {
  return (
    <div className="mx-auto mt-24 max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-sm">
      <div className="text-lg font-semibold">Realtor Growth OS isn’t set up yet</div>
      <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-subtle p-3 text-[12.5px]">cd growth-os{"\n"}npm install{"\n"}npm run setup{"\n"}npm run dev</pre>
    </div>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let session: Session | null = null;
  let setupError: Error | null = null;
  try {
    session = await getSession();
  } catch (err) {
    if (err instanceof AppError) setupError = err;
    else throw err;
  }

  if (!session) {
    return (
      <html lang="en">
        <body>
          <SetupScreen error={setupError!} />
        </body>
      </html>
    );
  }
  const { counts, paused } = await navCounts(session);
  const demo = session.isDemo || appMode() === "demo";

  return (
    <html lang="en">
      <body>
        <Sidebar counts={counts} workspaceName={session.workspaceName} userName={session.userName} isDemo={session.authMode === "demo"} />
        <div className="lg:pl-60">
          {demo ? (
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 border-b border-sand-200 bg-sand-50 px-4 py-1.5 text-center text-[12.5px] text-clay-600">
              <FlaskConical className="size-3.5" />
              <span className="font-medium">Demo Mode</span>
              <span className="text-ink-muted">Fictional data · no real emails or texts are ever sent · demo sign-in is not production authentication</span>
            </div>
          ) : null}
          {paused ? (
            <div className="flex items-center justify-center gap-2 border-b border-rose-600/20 bg-rose-50 px-4 py-1.5 text-[12.5px] text-rose-600">
              <PauseCircle className="size-3.5" />
              <span className="font-medium">All sending is paused.</span>
              <Link href="/settings#compliance" className="underline underline-offset-2">
                Resume in settings
              </Link>
            </div>
          ) : null}
          <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
