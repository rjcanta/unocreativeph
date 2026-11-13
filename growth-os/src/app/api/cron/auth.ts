/** Shared-secret check for scheduler endpoints (e.g. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export function cronAuthorized(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return { ok: true };
    return { ok: false, status: 503, error: "CRON_SECRET is not configured." };
  }
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}` ? { ok: true } : { ok: false, status: 401, error: "Unauthorized" };
}
