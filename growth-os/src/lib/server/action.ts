/**
 * Server-action wrapper: resolves the session (tenant) server-side, converts
 * domain errors into friendly messages, revalidates pages, and processes any
 * jobs the action enqueued so their effects are visible immediately.
 * (A scheduler still processes jobs in production — see docs/deployment.md.)
 */
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getSession, type Session } from "./context";
import { AppError } from "./errors";
import { processDueJobs } from "./jobs-runner";

export type ActionResult<T = unknown> = { ok: boolean; message: string; data?: T; at: number };

type Out<T> = string | { message: string; data?: T };

export async function runAction<T = unknown>(fn: (s: Session) => Promise<Out<T>>, opts: { revalidate?: string[]; processJobs?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    const out = await fn(session);
    if (opts.processJobs !== false) await processDueJobs({ workspaceId: session.workspaceId, limit: 200, workerId: "inline" });
    for (const p of opts.revalidate ?? ["/"]) revalidatePath(p, "layout");
    return typeof out === "string" ? { ok: true, message: out, at: Date.now() } : { ok: true, message: out.message, data: out.data, at: Date.now() };
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return { ok: false, message: `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`, at: Date.now() };
    }
    if (err instanceof AppError) return { ok: false, message: err.message, at: Date.now() };
    console.error("[action] unexpected error", err);
    return { ok: false, message: `Something went wrong: ${(err as Error).message}`, at: Date.now() };
  }
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const opt = (fd: FormData, key: string) => {
  const v = str(fd, key);
  return v === "" ? null : v;
};
export const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";
export const num = (fd: FormData, key: string) => {
  const v = str(fd, key);
  return v === "" ? null : Number(v);
};
export const list = (fd: FormData, key: string) => fd.getAll(key).map(String).filter(Boolean);
