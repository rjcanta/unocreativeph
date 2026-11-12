/** Recipient segmentation shared by campaign previews, scheduling and analytics. */
import { z } from "zod";
import { CLIENT_ROLES, CONTACT_TYPES, TIERS } from "./types";

export const segmentSchema = z.object({
  contactTypes: z.array(z.enum(CONTACT_TYPES)).default([]),
  tiers: z.array(z.enum(TIERS)).default([]),
  clientRoles: z.array(z.enum(CLIENT_ROLES)).default([]),
  tagsAny: z.array(z.string()).default([]),
  neighborhoods: z.array(z.string()).default([]),
});
export type Segment = z.infer<typeof segmentSchema>;

export type SegmentableContact = {
  contactType: string;
  tier: string;
  clientRole: string | null;
  neighborhood: string | null;
  tags: string[];
  deletedAt?: Date | null;
};

export function parseSegment(raw: string | null | undefined): Segment {
  try {
    return segmentSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return segmentSchema.parse({});
  }
}

export function matchesSegment(c: SegmentableContact, s: Segment): boolean {
  if (c.deletedAt) return false;
  if (s.contactTypes.length && !s.contactTypes.includes(c.contactType as never)) return false;
  if (s.tiers.length && !s.tiers.includes(c.tier as never)) return false;
  if (s.clientRoles.length && (!c.clientRole || !s.clientRoles.includes(c.clientRole as never))) return false;
  if (s.neighborhoods.length) {
    const n = (c.neighborhood ?? "").toLowerCase();
    if (!s.neighborhoods.some((x) => x.toLowerCase() === n)) return false;
  }
  if (s.tagsAny.length) {
    const tags = new Set(c.tags.map((t) => t.toLowerCase()));
    if (!s.tagsAny.some((t) => tags.has(t.toLowerCase()))) return false;
  }
  return true;
}

export function describeSegment(s: Segment): string {
  const parts: string[] = [];
  if (s.contactTypes.length) parts.push(s.contactTypes.map((t) => (t === "PAST_CLIENT" ? "Past Clients" : "Sphere")).join(" + "));
  if (s.tiers.length) parts.push(`tiers: ${s.tiers.join(", ").toLowerCase().replaceAll("_", " ")}`);
  if (s.clientRoles.length) parts.push(`roles: ${s.clientRoles.join(", ").toLowerCase().replaceAll("_", " ")}`);
  if (s.neighborhoods.length) parts.push(`areas: ${s.neighborhoods.join(", ")}`);
  if (s.tagsAny.length) parts.push(`tags: ${s.tagsAny.join(", ")}`);
  return parts.length ? parts.join(" · ") : "All contacts";
}
