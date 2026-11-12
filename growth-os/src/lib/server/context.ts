/**
 * Request context and tenant isolation.
 *
 * Every service function takes a Ctx and scopes every query by ctx.workspaceId.
 * The workspace is resolved on the server from the session — never from a
 * client-supplied parameter.
 *
 * AUTH_MODE=demo signs in a fixed demo user for the seeded demo workspace and
 * is always labelled in the UI. It is NOT production authentication: any other
 * AUTH_MODE refuses to resolve a session until real auth is implemented
 * (see docs/deployment.md).
 */
import { prisma } from "./db";
import { AppError } from "./errors";

export type Ctx = {
  workspaceId: string;
  userId: string | null;
  actorType: "USER" | "SYSTEM" | "AI" | "INTEGRATION";
};

export type Session = Ctx & {
  userName: string;
  userEmail: string;
  role: string;
  workspaceName: string;
  timezone: string;
  isDemo: boolean;
  authMode: "demo";
};

export const DEMO_WORKSPACE_SLUG = "km-rojas-group-demo";

export class NotSetUpError extends AppError {
  constructor() {
    super("The demo workspace has not been created yet. Run `npm run setup` in growth-os/.", "NOT_SET_UP");
  }
}

export class AuthNotConfiguredError extends AppError {
  constructor() {
    super("Production authentication is not configured. Set AUTH_MODE=demo for local exploration.", "AUTH_NOT_CONFIGURED");
  }
}

export function authMode(): string {
  return process.env.AUTH_MODE?.trim() || "demo";
}

export function appMode(): "demo" | "live" {
  return process.env.APP_MODE?.trim() === "live" ? "live" : "demo";
}

export async function getSession(): Promise<Session> {
  if (authMode() !== "demo") throw new AuthNotConfiguredError();
  const ws = await prisma.workspace.findUnique({ where: { slug: DEMO_WORKSPACE_SLUG } });
  if (!ws) throw new NotSetUpError();
  const user = await prisma.user.findFirst({ where: { workspaceId: ws.id, role: "OWNER", deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (!user) throw new NotSetUpError();
  return {
    workspaceId: ws.id,
    userId: user.id,
    actorType: "USER",
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    workspaceName: ws.name,
    timezone: ws.timezone,
    isDemo: ws.isDemo,
    authMode: "demo",
  };
}

export const systemCtx = (workspaceId: string): Ctx => ({ workspaceId, userId: null, actorType: "SYSTEM" });
