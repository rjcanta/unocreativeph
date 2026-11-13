import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/provider";
import { appMode, authMode } from "@/lib/server/context";
import { prisma } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaces = await prisma.workspace.count();
  return NextResponse.json({ ok: true, appMode: appMode(), authMode: authMode(), ai: aiStatus().provider, workspaces });
}
