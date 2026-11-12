/**
 * Contact deduplication for manual entry, CSV import and CRM sync.
 *
 * Strong matches (treated as the same person):
 *   - identical normalized email
 *   - identical normalized phone AND identical last name
 * Conflicts (reported, never auto-merged):
 *   - identical phone with a different last name (shared household line?)
 *   - identical full name with different email/phone
 */
import { normalizeEmail, normalizeName, normalizePhone } from "./normalize";

export type MatchableContact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

export type IncomingContact = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
};

export type DedupeResult =
  | { status: "NEW" }
  | { status: "DUPLICATE"; matchId: string; matchedOn: "email" | "phone+lastName" }
  | { status: "DUPLICATE_IN_FILE"; firstRow: number; matchedOn: "email" | "phone+lastName" }
  | { status: "CONFLICT"; matchId: string; reason: string };

type Index = {
  byEmail: Map<string, MatchableContact>;
  byPhone: Map<string, MatchableContact[]>;
  byName: Map<string, MatchableContact[]>;
};

export function buildIndex(existing: MatchableContact[]): Index {
  const idx: Index = { byEmail: new Map(), byPhone: new Map(), byName: new Map() };
  for (const c of existing) addToIndex(idx, c);
  return idx;
}

function addToIndex(idx: Index, c: MatchableContact) {
  const e = normalizeEmail(c.email);
  if (e && !idx.byEmail.has(e)) idx.byEmail.set(e, c);
  const p = normalizePhone(c.phone);
  if (p) idx.byPhone.set(p, [...(idx.byPhone.get(p) ?? []), c]);
  const n = `${normalizeName(c.firstName)}|${normalizeName(c.lastName)}`;
  idx.byName.set(n, [...(idx.byName.get(n) ?? []), c]);
}

export function matchContact(incoming: IncomingContact, idx: Index): DedupeResult {
  const email = normalizeEmail(incoming.email);
  if (email) {
    const hit = idx.byEmail.get(email);
    if (hit) return { status: "DUPLICATE", matchId: hit.id, matchedOn: "email" };
  }
  const phone = normalizePhone(incoming.phone);
  if (phone) {
    const hits = idx.byPhone.get(phone) ?? [];
    const same = hits.find((h) => normalizeName(h.lastName) === normalizeName(incoming.lastName));
    if (same) return { status: "DUPLICATE", matchId: same.id, matchedOn: "phone+lastName" };
    if (hits.length) {
      return {
        status: "CONFLICT",
        matchId: hits[0].id,
        reason: `Phone number already belongs to ${hits[0].firstName} ${hits[0].lastName}.`,
      };
    }
  }
  const nameHits = idx.byName.get(`${normalizeName(incoming.firstName)}|${normalizeName(incoming.lastName)}`) ?? [];
  if (nameHits.length && normalizeName(incoming.firstName)) {
    return {
      status: "CONFLICT",
      matchId: nameHits[0].id,
      reason: "A contact with the same name exists with different contact details.",
    };
  }
  return { status: "NEW" };
}

/**
 * Classify a batch (e.g. CSV rows) against existing contacts and against
 * earlier rows in the same batch.
 */
export function dedupeBatch(rows: IncomingContact[], existing: MatchableContact[]): DedupeResult[] {
  const idx = buildIndex(existing);
  const fileIdx = buildIndex([]);
  return rows.map((row, i) => {
    const vsExisting = matchContact(row, idx);
    if (vsExisting.status !== "NEW") return vsExisting;
    const vsFile = matchContact(row, fileIdx);
    if (vsFile.status === "DUPLICATE") {
      return { status: "DUPLICATE_IN_FILE", firstRow: Number(vsFile.matchId), matchedOn: vsFile.matchedOn };
    }
    addToIndex(fileIdx, { id: String(i), ...row });
    return { status: "NEW" };
  });
}

/** Field-level differences between an existing record and an incoming one. */
export function diffFields<T extends Record<string, unknown>>(existing: T, incoming: Partial<T>, fields: (keyof T)[]) {
  const conflicts: { field: string; existing: string; incoming: string }[] = [];
  for (const f of fields) {
    const a = existing[f];
    const b = incoming[f];
    if (b === undefined || b === null || b === "") continue;
    if (a === undefined || a === null || a === "") continue;
    const sa = a instanceof Date ? a.toISOString().slice(0, 10) : String(a);
    const sb = b instanceof Date ? b.toISOString().slice(0, 10) : String(b);
    if (sa.trim().toLowerCase() !== sb.trim().toLowerCase()) conflicts.push({ field: String(f), existing: sa, incoming: sb });
  }
  return conflicts;
}
