import { describe, expect, it } from "vitest";
import { dedupeBatch, diffFields } from "@/lib/domain/dedupe";
import { matchesSegment, segmentSchema } from "@/lib/domain/segmentation";
import { normalizePhone } from "@/lib/domain/normalize";

const existing = [
  { id: "c1", firstName: "Maria", lastName: "Lopez", email: "Maria.Lopez@Example.com", phone: "(602) 555-0101" },
  { id: "c2", firstName: "Dan", lastName: "Reed", email: null, phone: "602-555-0102" },
];

describe("contact deduplication", () => {
  it("matches by normalized email", () => {
    const [r] = dedupeBatch([{ firstName: "M", lastName: "L", email: " maria.lopez@example.com " }], existing);
    expect(r).toMatchObject({ status: "DUPLICATE", matchId: "c1", matchedOn: "email" });
  });

  it("matches by phone plus last name", () => {
    const [r] = dedupeBatch([{ firstName: "Daniel", lastName: "Reed", phone: "+1 602 555 0102" }], existing);
    expect(r).toMatchObject({ status: "DUPLICATE", matchId: "c2", matchedOn: "phone+lastName" });
  });

  it("reports a conflict when a phone belongs to someone else", () => {
    const [r] = dedupeBatch([{ firstName: "Ann", lastName: "Kim", phone: "6025550102" }], existing);
    expect(r.status).toBe("CONFLICT");
  });

  it("reports same-name records with different details as conflicts", () => {
    const [r] = dedupeBatch([{ firstName: "maria", lastName: "lopez", email: "other@example.com" }], existing);
    expect(r.status).toBe("CONFLICT");
  });

  it("detects duplicates within the same file", () => {
    const out = dedupeBatch(
      [
        { firstName: "New", lastName: "Person", email: "new@example.com" },
        { firstName: "New", lastName: "Person", email: "NEW@example.com" },
      ],
      existing,
    );
    expect(out[0].status).toBe("NEW");
    expect(out[1]).toMatchObject({ status: "DUPLICATE_IN_FILE", firstRow: 0 });
  });

  it("lists conflicting field values", () => {
    expect(diffFields({ city: "Phoenix", tier: "VIP" }, { city: "Mesa", tier: "" }, ["city", "tier"])).toEqual([
      { field: "city", existing: "Phoenix", incoming: "Mesa" },
    ]);
  });

  it("normalizes US phone numbers", () => {
    expect(normalizePhone("1 (602) 555-0199")).toBe("+16025550199");
    expect(normalizePhone("555")).toBeNull();
  });
});

describe("contact segmentation", () => {
  const c = { contactType: "PAST_CLIENT", tier: "VIP", clientRole: "SELLER", neighborhood: "Arcadia", tags: ["Golf"] };

  it("matches everyone with an empty segment", () => {
    expect(matchesSegment(c, segmentSchema.parse({}))).toBe(true);
  });

  it("separates past clients from sphere", () => {
    expect(matchesSegment(c, segmentSchema.parse({ contactTypes: ["SPHERE"] }))).toBe(false);
    expect(matchesSegment(c, segmentSchema.parse({ contactTypes: ["PAST_CLIENT"] }))).toBe(true);
  });

  it("combines tier, role, neighborhood and tag filters", () => {
    expect(matchesSegment(c, segmentSchema.parse({ tiers: ["VIP"], clientRoles: ["SELLER"], neighborhoods: ["arcadia"], tagsAny: ["golf"] }))).toBe(true);
    expect(matchesSegment(c, segmentSchema.parse({ tagsAny: ["Pickleball"] }))).toBe(false);
  });

  it("excludes soft-deleted contacts", () => {
    expect(matchesSegment({ ...c, deletedAt: new Date() }, segmentSchema.parse({}))).toBe(false);
  });
});
