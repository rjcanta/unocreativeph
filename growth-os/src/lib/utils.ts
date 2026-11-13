import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | null | undefined, tz: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateTime(d: Date | null | undefined, tz: string) {
  return formatDate(d, tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeDays(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export function timeAgo(d: Date | null | undefined, now = new Date()) {
  if (!d) return "never";
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 45) return `${days}d ago`;
  if (days < 730) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export const humanize = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase());
