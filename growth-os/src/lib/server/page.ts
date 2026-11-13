/** Helpers for server components. */
import { notFound } from "next/navigation";
import { getSession } from "./context";
import { NotFoundError } from "./errors";

export async function session() {
  return getSession();
}

export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export const sp = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
