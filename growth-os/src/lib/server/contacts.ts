/**
 * Contact service: CRUD, consent, notes, tags, milestones and CSV import.
 * Every query is scoped by ctx.workspaceId.
 */
import { z } from "zod";
import { mapHeaders, parseCsv, validateRows, type ParsedImportRow } from "@/lib/domain/csv";
import { daysUntilNext, nextOccurrence, toLocalDate, dateOnlyToLocal, localToDateOnly, isValidMonthDay } from "@/lib/domain/dates";
import { dedupeBatch, diffFields, type DedupeResult } from "@/lib/domain/dedupe";
import { consentStatus, type EligibilityContact } from "@/lib/domain/eligibility";
import { normalizeEmail, normalizePhone, isValidEmail } from "@/lib/domain/normalize";
import { CHANNELS, CLIENT_ROLES, CONTACT_TYPES, OPPORTUNITY_STATUSES, TIERS, CONSENT_STATUSES } from "@/lib/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "./audit";
import type { Ctx } from "./context";
import { prisma, type Tx } from "./db";
import { NotFoundError, ValidationError } from "./errors";
import { enqueueJob, eventKey } from "./jobs-queue";

// ── Input validation ─────────────────────────────────────────────────────────

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const contactInputSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().default(""),
    email: optionalString,
    phone: optionalString,
    contactType: z.enum(CONTACT_TYPES),
    clientRole: z.enum(CLIENT_ROLES).nullable().optional(),
    tier: z.enum(TIERS).default("STANDARD"),
    birthdayMonth: z.coerce.number().int().min(1).max(12).nullable().optional(),
    birthdayDay: z.coerce.number().int().min(1).max(31).nullable().optional(),
    birthdayYear: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
    birthdayVerified: z.boolean().default(false),
    closingDate: optionalString, // YYYY-MM-DD
    closingDateVerified: z.boolean().default(false),
    propertyAddress: optionalString,
    neighborhood: optionalString,
    city: optionalString,
    preferredChannel: z.enum(CHANNELS).default("EMAIL"),
    opportunityStatus: z.enum(OPPORTUNITY_STATUSES).default("NONE"),
    assignedAgentId: optionalString,
    lastCommunicationAt: optionalString,
    emailConsent: z.enum(CONSENT_STATUSES).optional(),
    consentSource: optionalString,
    tags: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.email && !isValidEmail(v.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "Email address is not valid" });
    if (v.phone && !normalizePhone(v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone number is not valid" });
    if ((v.birthdayMonth == null) !== (v.birthdayDay == null)) {
      ctx.addIssue({ code: "custom", path: ["birthdayDay"], message: "Birthday needs both month and day" });
    }
    if (v.birthdayMonth && v.birthdayDay && !isValidMonthDay(v.birthdayMonth, v.birthdayDay)) {
      ctx.addIssue({ code: "custom", path: ["birthdayDay"], message: "That day does not exist in that month" });
    }
    if (v.closingDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.closingDate)) {
      ctx.addIssue({ code: "custom", path: ["closingDate"], message: "Closing date must be YYYY-MM-DD" });
    }
    if (v.emailConsent === "GRANTED" && !v.consentSource) {
      ctx.addIssue({ code: "custom", path: ["consentSource"], message: "Record where consent came from" });
    }
  });
export type ContactInput = z.input<typeof contactInputSchema>;

// ── Read ─────────────────────────────────────────────────────────────────────

export type ContactFilters = {
  q?: string;
  type?: string;
  tier?: string;
  consent?: "GRANTED" | "REVOKED" | "UNKNOWN" | "SUPPRESSED";
  tag?: string;
  opportunity?: string;
  milestone?: "UPCOMING_30";
  sort?: "name" | "lastContact" | "recent" | "nextMilestone";
  page?: number;
  pageSize?: number;
};

const listInclude = {
  tags: { include: { tag: true } },
  consentRecords: true,
  preference: true,
  assignedAgent: { select: { id: true, name: true } },
} satisfies Prisma.ContactInclude;

type ListedContact = Prisma.ContactGetPayload<{ include: typeof listInclude }>;

export function toEligibilityContact(c: {
  email: string | null;
  phone: string | null;
  doNotContact: boolean;
  unsubscribedAt: Date | null;
  consentRecords: { channel: string; purpose: string; status: string; source: string; capturedAt: Date }[];
  preference?: { receiveNewsletters: boolean; receiveSeasonal: boolean; receiveMilestones: boolean; frequency: string } | null;
}): EligibilityContact {
  return {
    email: c.email,
    phone: c.phone,
    doNotContact: c.doNotContact,
    unsubscribedAt: c.unsubscribedAt,
    consents: c.consentRecords,
    preference: c.preference ?? null,
  };
}

export function nextMilestoneFor(c: { birthdayMonth: number | null; birthdayDay: number | null; closingDate: Date | null }, today: string) {
  const options: { type: "BIRTHDAY" | "HOME_ANNIVERSARY"; date: string; days: number }[] = [];
  if (c.birthdayMonth && c.birthdayDay) {
    options.push({ type: "BIRTHDAY", date: nextOccurrence(c.birthdayMonth, c.birthdayDay, today), days: daysUntilNext(c.birthdayMonth, c.birthdayDay, today) });
  }
  if (c.closingDate) {
    const d = dateOnlyToLocal(c.closingDate);
    const m = Number(d.slice(5, 7));
    const day = Number(d.slice(8, 10));
    options.push({ type: "HOME_ANNIVERSARY", date: nextOccurrence(m, day, today), days: daysUntilNext(m, day, today) });
  }
  return options.sort((a, b) => a.days - b.days)[0] ?? null;
}

function decorate(c: ListedContact, today: string) {
  const emailConsent = consentStatus(c.consentRecords, "EMAIL", "MARKETING");
  return {
    ...c,
    tagNames: c.tags.map((t) => t.tag.name),
    emailConsent,
    suppressed: c.doNotContact || !!c.unsubscribedAt,
    nextMilestone: nextMilestoneFor(c, today),
  };
}
export type ContactRow = ReturnType<typeof decorate>;

export async function listContacts(ctx: Ctx, filters: ContactFilters, timeZone: string) {
  const where: Prisma.ContactWhereInput = { workspaceId: ctx.workspaceId, deletedAt: null };
  if (filters.type) where.contactType = filters.type;
  if (filters.tier) where.tier = filters.tier;
  if (filters.opportunity) where.opportunityStatus = filters.opportunity;
  if (filters.tag) where.tags = { some: { tag: { name: filters.tag } } };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q.toLowerCase() } },
      { phone: { contains: q } },
      { neighborhood: { contains: q } },
      { propertyAddress: { contains: q } },
    ];
  }
  const today = toLocalDate(new Date(), timeZone);
  let rows = (await prisma.contact.findMany({ where, include: listInclude, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] })).map((c) =>
    decorate(c, today),
  );

  if (filters.consent === "SUPPRESSED") rows = rows.filter((r) => r.suppressed);
  else if (filters.consent) rows = rows.filter((r) => r.emailConsent === filters.consent && !r.suppressed);
  if (filters.milestone === "UPCOMING_30") rows = rows.filter((r) => r.nextMilestone && r.nextMilestone.days <= 30);

  if (filters.sort === "lastContact") {
    rows.sort((a, b) => (a.lastCommunicationAt?.getTime() ?? 0) - (b.lastCommunicationAt?.getTime() ?? 0));
  } else if (filters.sort === "recent") {
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (filters.sort === "nextMilestone") {
    rows.sort((a, b) => (a.nextMilestone?.days ?? 999) - (b.nextMilestone?.days ?? 999));
  }

  const pageSize = filters.pageSize ?? 25;
  const page = Math.max(1, filters.page ?? 1);
  return {
    total: rows.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(rows.length / pageSize)),
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    allIds: rows.map((r) => r.id),
  };
}

export async function getContact(ctx: Ctx, id: string) {
  const c = await prisma.contact.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
    include: {
      ...listInclude,
      notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      milestones: { orderBy: [{ month: "asc" }, { day: "asc" }] },
      messages: { orderBy: { scheduledFor: "desc" }, take: 40, include: { campaign: { select: { id: true, name: true } } } },
      communication: { orderBy: { occurredAt: "desc" }, take: 60 },
      insights: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ status: "asc" }, { priority: "desc" }], take: 20 },
      opportunities: { orderBy: { createdAt: "desc" } },
      relationships: { include: { relatedContact: { select: { id: true, firstName: true, lastName: true } } } },
      relatedTo: { include: { contact: { select: { id: true, firstName: true, lastName: true } } } },
      mappings: { include: { integration: { select: { provider: true, mode: true } } } },
    },
  });
  if (!c) throw new NotFoundError("Contact");
  return c;
}

export async function listTags(ctx: Ctx) {
  return prisma.tag.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
}

export async function listAgents(ctx: Ctx) {
  return prisma.user.findMany({ where: { workspaceId: ctx.workspaceId, deletedAt: null }, orderBy: { name: "asc" } });
}

// ── Milestones ───────────────────────────────────────────────────────────────

type MilestoneSource = {
  id: string;
  workspaceId: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  birthdayVerified: boolean;
  closingDate: Date | null;
  closingDateVerified: boolean;
  relationshipStartDate: Date | null;
};

/** Keep contact_milestones in sync with the contact's date fields. */
export async function syncMilestones(db: Tx | typeof prisma, c: MilestoneSource) {
  const upsert = async (type: string, label: string, month: number, day: number, year: number | null, verified: boolean) =>
    db.contactMilestone.upsert({
      where: { contactId_type_label: { contactId: c.id, type, label } },
      create: { workspaceId: c.workspaceId, contactId: c.id, type, label, month, day, year, verified, source: "CONTACT_FIELD" },
      update: { month, day, year, verified, active: true },
    });
  const deactivate = (type: string, label: string) =>
    db.contactMilestone.updateMany({ where: { contactId: c.id, type, label, source: "CONTACT_FIELD" }, data: { active: false } });

  if (c.birthdayMonth && c.birthdayDay) await upsert("BIRTHDAY", "Birthday", c.birthdayMonth, c.birthdayDay, c.birthdayYear, c.birthdayVerified);
  else await deactivate("BIRTHDAY", "Birthday");

  if (c.closingDate) {
    const d = dateOnlyToLocal(c.closingDate);
    await upsert("HOME_ANNIVERSARY", "Home anniversary", Number(d.slice(5, 7)), Number(d.slice(8, 10)), Number(d.slice(0, 4)), c.closingDateVerified);
  } else await deactivate("HOME_ANNIVERSARY", "Home anniversary");

  if (c.relationshipStartDate) {
    const d = dateOnlyToLocal(c.relationshipStartDate);
    await upsert("RELATIONSHIP_ANNIVERSARY", "Relationship anniversary", Number(d.slice(5, 7)), Number(d.slice(8, 10)), Number(d.slice(0, 4)), true);
  }
}

export async function addCustomMilestone(ctx: Ctx, contactId: string, input: { label: string; month: number; day: number; verified: boolean }) {
  await assertContact(ctx, contactId);
  if (!input.label.trim()) throw new ValidationError("Milestone needs a label.");
  if (!isValidMonthDay(input.month, input.day)) throw new ValidationError("That date does not exist.");
  const m = await prisma.contactMilestone.upsert({
    where: { contactId_type_label: { contactId, type: "CUSTOM", label: input.label.trim() } },
    create: { workspaceId: ctx.workspaceId, contactId, type: "CUSTOM", label: input.label.trim(), month: input.month, day: input.day, verified: input.verified, source: "AGENT" },
    update: { month: input.month, day: input.day, verified: input.verified, active: true },
  });
  await audit(ctx, { action: "MILESTONE_SAVED", entityType: "Contact", entityId: contactId, details: { label: m.label, verified: m.verified } });
  return m;
}

export async function setMilestoneVerified(ctx: Ctx, contactId: string, type: "BIRTHDAY" | "HOME_ANNIVERSARY", verified: boolean) {
  await assertContact(ctx, contactId);
  const data = type === "BIRTHDAY" ? { birthdayVerified: verified } : { closingDateVerified: verified };
  const c = await prisma.contact.update({ where: { id: contactId }, data });
  await syncMilestones(prisma, c);
  await audit(ctx, { action: verified ? "DATE_VERIFIED" : "DATE_UNVERIFIED", entityType: "Contact", entityId: contactId, details: { type } });
  await enqueueJob(ctx, { type: "CONTACT_UPDATED", payload: { contactIds: [contactId] }, idempotencyKey: eventKey(`contact-updated:${contactId}`) });
}

// ── Write ────────────────────────────────────────────────────────────────────

async function assertContact(ctx: Ctx, id: string, db: Tx | typeof prisma = prisma) {
  const c = await db.contact.findFirst({ where: { id, workspaceId: ctx.workspaceId, deletedAt: null } });
  if (!c) throw new NotFoundError("Contact");
  return c;
}

async function setTags(db: Tx, ctx: Ctx, contactId: string, names: string[]) {
  await db.contactTag.deleteMany({ where: { contactId, workspaceId: ctx.workspaceId } });
  for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
    const tag = await db.tag.upsert({
      where: { workspaceId_name: { workspaceId: ctx.workspaceId, name } },
      create: { workspaceId: ctx.workspaceId, name },
      update: {},
    });
    await db.contactTag.create({ data: { workspaceId: ctx.workspaceId, contactId, tagId: tag.id } });
  }
}

function toData(v: z.output<typeof contactInputSchema>) {
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    email: v.email ?? null,
    emailNormalized: normalizeEmail(v.email),
    phone: v.phone ?? null,
    phoneNormalized: normalizePhone(v.phone),
    contactType: v.contactType,
    clientRole: v.contactType === "PAST_CLIENT" ? (v.clientRole ?? null) : null,
    tier: v.tier,
    birthdayMonth: v.birthdayMonth ?? null,
    birthdayDay: v.birthdayDay ?? null,
    birthdayYear: v.birthdayYear ?? null,
    birthdayVerified: v.birthdayMonth ? v.birthdayVerified : false,
    closingDate: v.closingDate ? localToDateOnly(v.closingDate) : null,
    closingDateVerified: v.closingDate ? v.closingDateVerified : false,
    propertyAddress: v.propertyAddress ?? null,
    neighborhood: v.neighborhood ?? null,
    city: v.city ?? null,
    preferredChannel: v.preferredChannel,
    opportunityStatus: v.opportunityStatus,
    assignedAgentId: v.assignedAgentId ?? null,
    lastCommunicationAt: v.lastCommunicationAt ? localToDateOnly(v.lastCommunicationAt) : null,
  };
}

async function assertNoDuplicate(ctx: Ctx, data: { email: string | null; phone: string | null; firstName: string; lastName: string }, excludeId?: string) {
  const existing = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  const [r] = dedupeBatch([data], existing);
  if (r.status === "DUPLICATE") {
    const m = existing.find((e) => e.id === r.matchId)!;
    throw new ValidationError(`This looks like ${m.firstName} ${m.lastName} (matched on ${r.matchedOn}). Edit that contact instead.`);
  }
}

export async function createContact(ctx: Ctx, input: ContactInput, source = "MANUAL") {
  const v = contactInputSchema.parse(input);
  const data = toData(v);
  await assertNoDuplicate(ctx, data);
  const contact = await prisma.$transaction(async (tx) => {
    const c = await tx.contact.create({ data: { ...data, workspaceId: ctx.workspaceId, source } });
    await tx.contactPreference.create({ data: { workspaceId: ctx.workspaceId, contactId: c.id } });
    if (v.emailConsent && v.emailConsent !== "UNKNOWN") {
      await tx.contactConsentRecord.create({
        data: {
          workspaceId: ctx.workspaceId,
          contactId: c.id,
          channel: "EMAIL",
          purpose: "MARKETING",
          status: v.emailConsent,
          source: v.consentSource ?? "Entered by agent",
          capturedAt: new Date(),
          capturedBy: ctx.userId ?? "system",
        },
      });
    }
    if (v.tags) await setTags(tx, ctx, c.id, v.tags);
    await syncMilestones(tx, c);
    await audit(ctx, { action: "CONTACT_CREATED", entityType: "Contact", entityId: c.id, details: { source } }, tx);
    return c;
  });
  await enqueueJob(ctx, { type: "CONTACT_CREATED", payload: { contactIds: [contact.id] }, idempotencyKey: `contact-created:${contact.id}` });
  return contact;
}

export async function updateContact(ctx: Ctx, id: string, input: ContactInput) {
  const before = await assertContact(ctx, id);
  const v = contactInputSchema.parse(input);
  const data = toData(v);
  await assertNoDuplicate(ctx, data, id);
  const changed = Object.entries(data)
    .filter(([k, val]) => {
      const prev = (before as Record<string, unknown>)[k];
      const a = prev instanceof Date ? prev.toISOString() : prev ?? null;
      const b = val instanceof Date ? val.toISOString() : val ?? null;
      return a !== b;
    })
    .map(([k]) => k);

  const contact = await prisma.$transaction(async (tx) => {
    const c = await tx.contact.update({ where: { id }, data });
    if (v.emailConsent) {
      const current = consentStatus(await tx.contactConsentRecord.findMany({ where: { contactId: id } }), "EMAIL", "MARKETING");
      if (current !== v.emailConsent && v.emailConsent !== "UNKNOWN") {
        await tx.contactConsentRecord.create({
          data: {
            workspaceId: ctx.workspaceId,
            contactId: id,
            channel: "EMAIL",
            purpose: "MARKETING",
            status: v.emailConsent,
            source: v.consentSource ?? "Updated by agent",
            capturedAt: new Date(),
            capturedBy: ctx.userId ?? "system",
          },
        });
        changed.push("emailConsent");
      }
    }
    if (v.tags) await setTags(tx, ctx, id, v.tags);
    await syncMilestones(tx, c);
    await audit(ctx, { action: "CONTACT_UPDATED", entityType: "Contact", entityId: id, details: { changed } }, tx);
    return c;
  });
  await enqueueJob(ctx, { type: "CONTACT_UPDATED", payload: { contactIds: [id], changed }, idempotencyKey: eventKey(`contact-updated:${id}`) });
  return contact;
}

export async function softDeleteContacts(ctx: Ctx, ids: string[]) {
  const owned = await prisma.contact.findMany({ where: { id: { in: ids }, workspaceId: ctx.workspaceId, deletedAt: null }, select: { id: true } });
  const ownedIds = owned.map((o) => o.id);
  await prisma.$transaction(async (tx) => {
    await tx.contact.updateMany({ where: { id: { in: ownedIds } }, data: { deletedAt: new Date() } });
    await tx.scheduledMessage.updateMany({
      where: { contactId: { in: ownedIds }, status: { in: ["PENDING_APPROVAL", "SCHEDULED"] } },
      data: { status: "CANCELLED", blockedReason: "Contact archived" },
    });
    await audit(ctx, { action: "CONTACTS_ARCHIVED", entityType: "Contact", details: { ids: ownedIds } }, tx);
  });
  return ownedIds.length;
}

export async function bulkTag(ctx: Ctx, ids: string[], tagName: string, mode: "add" | "remove") {
  const name = tagName.trim();
  if (!name) throw new ValidationError("Tag name is required.");
  const owned = await prisma.contact.findMany({ where: { id: { in: ids }, workspaceId: ctx.workspaceId, deletedAt: null }, select: { id: true } });
  const tag = await prisma.tag.upsert({
    where: { workspaceId_name: { workspaceId: ctx.workspaceId, name } },
    create: { workspaceId: ctx.workspaceId, name },
    update: {},
  });
  let count = 0;
  for (const { id } of owned) {
    if (mode === "add") {
      const r = await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: id, tagId: tag.id } },
        create: { workspaceId: ctx.workspaceId, contactId: id, tagId: tag.id },
        update: {},
      });
      if (r) count++;
    } else {
      count += (await prisma.contactTag.deleteMany({ where: { contactId: id, tagId: tag.id } })).count;
    }
  }
  await audit(ctx, { action: mode === "add" ? "BULK_TAG_ADDED" : "BULK_TAG_REMOVED", entityType: "Tag", entityId: tag.id, details: { tag: name, contacts: count } });
  return count;
}

export async function addNote(ctx: Ctx, contactId: string, body: string, kind = "NOTE") {
  await assertContact(ctx, contactId);
  if (!body.trim()) throw new ValidationError("Note cannot be empty.");
  const note = await prisma.contactNote.create({ data: { workspaceId: ctx.workspaceId, contactId, body: body.trim(), kind, authorId: ctx.userId } });
  if (kind === "CALL_LOG" || kind === "MEETING") {
    await prisma.contact.update({ where: { id: contactId }, data: { lastCommunicationAt: new Date() } });
    await prisma.communicationEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        contactId,
        direction: "OUTBOUND",
        channel: kind === "CALL_LOG" ? "PHONE" : "IN_PERSON",
        type: kind === "CALL_LOG" ? "CALL" : "MEETING",
        body: body.trim(),
        occurredAt: new Date(),
        source: "MANUAL",
      },
    });
  }
  await audit(ctx, { action: "NOTE_ADDED", entityType: "Contact", entityId: contactId, details: { kind } });
  return note;
}

export async function recordConsent(
  ctx: Ctx,
  contactId: string,
  input: { channel: "EMAIL" | "SMS" | "PHONE"; purpose: "MARKETING" | "RELATIONSHIP"; status: "GRANTED" | "REVOKED"; source: string; evidence?: string },
) {
  await assertContact(ctx, contactId);
  if (!input.source.trim()) throw new ValidationError("Consent source is required.");
  const rec = await prisma.contactConsentRecord.create({
    data: {
      workspaceId: ctx.workspaceId,
      contactId,
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      source: input.source.trim(),
      evidence: input.evidence?.trim() || null,
      capturedAt: new Date(),
      capturedBy: ctx.userId ?? ctx.actorType,
    },
  });
  await audit(ctx, { action: "CONSENT_RECORDED", entityType: "Contact", entityId: contactId, toStatus: input.status, details: input });
  if (input.status === "REVOKED" && input.channel === "EMAIL") {
    await prisma.scheduledMessage.updateMany({
      where: {
        contactId,
        workspaceId: ctx.workspaceId,
        status: { in: ["PENDING_APPROVAL", "SCHEDULED"] },
        ...(input.purpose === "MARKETING" ? { category: { in: ["NEWSLETTER", "SEASONAL"] } } : {}),
      },
      data: { status: "CANCELLED", blockedReason: `Email ${input.purpose.toLowerCase()} consent revoked` },
    });
  }
  return rec;
}

/** Unsubscribe from all email. Idempotent. */
export async function unsubscribeContact(ctx: Ctx, contactId: string, source: string) {
  const c = await assertContact(ctx, contactId);
  if (c.unsubscribedAt) return { alreadyUnsubscribed: true };
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contactId }, data: { unsubscribedAt: now } });
    for (const purpose of ["MARKETING", "RELATIONSHIP"]) {
      await tx.contactConsentRecord.create({
        data: { workspaceId: ctx.workspaceId, contactId, channel: "EMAIL", purpose, status: "REVOKED", source, capturedAt: now, capturedBy: ctx.userId ?? ctx.actorType },
      });
    }
    await tx.scheduledMessage.updateMany({
      where: { contactId, workspaceId: ctx.workspaceId, channel: "EMAIL", status: { in: ["PENDING_APPROVAL", "SCHEDULED"] } },
      data: { status: "CANCELLED", blockedReason: "Contact unsubscribed" },
    });
    await audit(ctx, { action: "CONTACT_UNSUBSCRIBED", entityType: "Contact", entityId: contactId, details: { source } }, tx);
  });
  await enqueueJob(ctx, { type: "CONTACT_UNSUBSCRIBED", payload: { contactId, source }, idempotencyKey: `unsubscribed:${contactId}:${now.getTime()}` });
  return { alreadyUnsubscribed: false };
}

export async function setDoNotContact(ctx: Ctx, contactId: string, value: boolean, reason: string) {
  await assertContact(ctx, contactId);
  await prisma.$transaction(async (tx) => {
    await tx.contact.update({ where: { id: contactId }, data: { doNotContact: value } });
    if (value) {
      await tx.scheduledMessage.updateMany({
        where: { contactId, workspaceId: ctx.workspaceId, status: { in: ["PENDING_APPROVAL", "SCHEDULED"] } },
        data: { status: "CANCELLED", blockedReason: "Do-not-contact" },
      });
      await tx.agentTask.updateMany({ where: { contactId, workspaceId: ctx.workspaceId, status: "OPEN" }, data: { status: "DISMISSED" } });
    }
    await audit(ctx, { action: value ? "DO_NOT_CONTACT_SET" : "DO_NOT_CONTACT_CLEARED", entityType: "Contact", entityId: contactId, details: { reason } }, tx);
  });
}

export async function updatePreferences(
  ctx: Ctx,
  contactId: string,
  p: { receiveNewsletters: boolean; receiveSeasonal: boolean; receiveMilestones: boolean; frequency: string; preferredChannel: string },
) {
  await assertContact(ctx, contactId);
  await prisma.contactPreference.upsert({
    where: { contactId },
    create: { workspaceId: ctx.workspaceId, contactId, receiveNewsletters: p.receiveNewsletters, receiveSeasonal: p.receiveSeasonal, receiveMilestones: p.receiveMilestones, frequency: p.frequency },
    update: { receiveNewsletters: p.receiveNewsletters, receiveSeasonal: p.receiveSeasonal, receiveMilestones: p.receiveMilestones, frequency: p.frequency },
  });
  await prisma.contact.update({ where: { id: contactId }, data: { preferredChannel: p.preferredChannel } });
  await audit(ctx, { action: "PREFERENCES_UPDATED", entityType: "Contact", entityId: contactId, details: p });
}

// ── CSV import ───────────────────────────────────────────────────────────────

export type ImportRowReport = {
  rowNumber: number;
  name: string;
  email: string | null;
  status: "NEW" | "DUPLICATE" | "DUPLICATE_IN_FILE" | "CONFLICT" | "INVALID";
  errors: string[];
  warnings: string[];
  match?: { id: string; name: string; on?: string; reason?: string; fieldConflicts?: { field: string; existing: string; incoming: string }[] };
  row: ParsedImportRow;
};

export type ImportPreview = {
  fileName: string;
  headers: { header: string; field: string | null }[];
  missingRecommended: string[];
  rows: ImportRowReport[];
  counts: Record<ImportRowReport["status"], number>;
};

export async function previewImport(ctx: Ctx, csvText: string, fileName: string, timeZone: string): Promise<ImportPreview> {
  const records = parseCsv(csvText);
  if (records.length < 2) throw new ValidationError("The file needs a header row and at least one contact.");
  if (records.length > 5001) throw new ValidationError("Import up to 5,000 contacts at a time.");
  const mapping = mapHeaders(records[0]);
  if (!mapping.some((m) => m.field === "firstName" || m.field === "fullName")) {
    throw new ValidationError('No "First Name" (or "Name") column was found. Download the template to see supported columns.');
  }
  const today = toLocalDate(new Date(), timeZone);
  const validated = validateRows(records.slice(1), mapping, today);
  const existing = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, city: true, neighborhood: true, tier: true, contactType: true, closingDate: true },
  });
  const dedupe: DedupeResult[] = dedupeBatch(
    validated.map((v) => v.row),
    existing,
  );
  const rows: ImportRowReport[] = validated.map((v, i) => {
    const d = dedupe[i];
    const base = { rowNumber: v.row.rowNumber, name: `${v.row.firstName} ${v.row.lastName}`.trim(), email: v.row.email, errors: v.errors, warnings: v.warnings, row: v.row };
    if (v.errors.length) return { ...base, status: "INVALID" as const };
    if (d.status === "DUPLICATE" || d.status === "CONFLICT") {
      const m = existing.find((e) => e.id === d.matchId)!;
      const fieldConflicts = diffFields(
        { city: m.city, neighborhood: m.neighborhood, tier: m.tier, contactType: m.contactType, closingDate: m.closingDate ? dateOnlyToLocal(m.closingDate) : null },
        { city: v.row.city, neighborhood: v.row.neighborhood, tier: v.row.tier, contactType: v.row.contactType, closingDate: v.row.closingDate },
        ["city", "neighborhood", "contactType", "closingDate"],
      );
      return {
        ...base,
        status: d.status,
        match: { id: m.id, name: `${m.firstName} ${m.lastName}`, on: d.status === "DUPLICATE" ? d.matchedOn : undefined, reason: d.status === "CONFLICT" ? d.reason : undefined, fieldConflicts },
      };
    }
    if (d.status === "DUPLICATE_IN_FILE") {
      return { ...base, status: "DUPLICATE_IN_FILE" as const, warnings: [...v.warnings, `Same person as row ${validated[d.firstRow].row.rowNumber} in this file.`] };
    }
    return { ...base, status: "NEW" as const };
  });
  const counts = { NEW: 0, DUPLICATE: 0, DUPLICATE_IN_FILE: 0, CONFLICT: 0, INVALID: 0 };
  for (const r of rows) counts[r.status]++;
  const recommended = ["email", "contactType", "birthday", "closingDate", "emailConsent"];
  return {
    fileName,
    headers: mapping.map((m) => ({ header: m.header, field: m.field })),
    missingRecommended: recommended.filter((f) => !mapping.some((m) => m.field === f)),
    rows,
    counts,
  };
}

export type ImportOptions = {
  datesVerified: boolean;
  duplicateStrategy: "SKIP" | "FILL_EMPTY";
  tag?: string;
};

export async function commitImport(ctx: Ctx, csvText: string, fileName: string, timeZone: string, opts: ImportOptions) {
  const preview = await previewImport(ctx, csvText, fileName, timeZone);
  const created: string[] = [];
  const merged: string[] = [];
  const skipped: { rowNumber: number; reason: string }[] = [];
  const now = new Date();

  for (const r of preview.rows) {
    const row = r.row;
    if (r.status === "INVALID") {
      skipped.push({ rowNumber: r.rowNumber, reason: r.errors.join(" ") });
      continue;
    }
    if (r.status === "CONFLICT" || r.status === "DUPLICATE_IN_FILE") {
      skipped.push({ rowNumber: r.rowNumber, reason: r.status === "CONFLICT" ? `Conflict: ${r.match?.reason}` : "Duplicate within file" });
      continue;
    }
    if (r.status === "DUPLICATE") {
      if (opts.duplicateStrategy === "SKIP" || !r.match) {
        skipped.push({ rowNumber: r.rowNumber, reason: `Already exists as ${r.match?.name}` });
        continue;
      }
      const existing = await prisma.contact.findFirst({ where: { id: r.match.id, workspaceId: ctx.workspaceId } });
      if (!existing) continue;
      const fill: Prisma.ContactUpdateInput = {};
      if (!existing.phone && row.phone) Object.assign(fill, { phone: row.phone, phoneNormalized: normalizePhone(row.phone) });
      if (!existing.email && row.email) Object.assign(fill, { email: row.email, emailNormalized: normalizeEmail(row.email) });
      if (!existing.birthdayMonth && row.birthdayMonth) Object.assign(fill, { birthdayMonth: row.birthdayMonth, birthdayDay: row.birthdayDay, birthdayYear: row.birthdayYear, birthdayVerified: opts.datesVerified });
      if (!existing.closingDate && row.closingDate) Object.assign(fill, { closingDate: localToDateOnly(row.closingDate), closingDateVerified: opts.datesVerified });
      if (!existing.propertyAddress && row.propertyAddress) fill.propertyAddress = row.propertyAddress;
      if (!existing.neighborhood && row.neighborhood) fill.neighborhood = row.neighborhood;
      if (!existing.city && row.city) fill.city = row.city;
      if (Object.keys(fill).length) {
        const c = await prisma.contact.update({ where: { id: existing.id }, data: fill });
        await syncMilestones(prisma, c);
        merged.push(existing.id);
      } else skipped.push({ rowNumber: r.rowNumber, reason: `No empty fields to fill on ${r.match.name}` });
      continue;
    }

    const c = await prisma.$transaction(async (tx) => {
      const c = await tx.contact.create({
        data: {
          workspaceId: ctx.workspaceId,
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          emailNormalized: normalizeEmail(row.email),
          phone: row.phone,
          phoneNormalized: normalizePhone(row.phone),
          contactType: row.contactType,
          clientRole: row.clientRole,
          tier: row.tier,
          birthdayMonth: row.birthdayMonth,
          birthdayDay: row.birthdayDay,
          birthdayYear: row.birthdayYear,
          birthdayVerified: !!row.birthdayMonth && opts.datesVerified,
          closingDate: row.closingDate ? localToDateOnly(row.closingDate) : null,
          closingDateVerified: !!row.closingDate && opts.datesVerified,
          propertyAddress: row.propertyAddress,
          neighborhood: row.neighborhood,
          city: row.city,
          preferredChannel: row.preferredChannel,
          lastCommunicationAt: row.lastCommunication ? localToDateOnly(row.lastCommunication) : null,
          source: "CSV",
        },
      });
      await tx.contactPreference.create({ data: { workspaceId: ctx.workspaceId, contactId: c.id } });
      if (row.emailConsent !== "UNKNOWN") {
        await tx.contactConsentRecord.create({
          data: {
            workspaceId: ctx.workspaceId,
            contactId: c.id,
            channel: "EMAIL",
            purpose: "MARKETING",
            status: row.emailConsent,
            source: row.consentSource ?? `CSV import: ${fileName}`,
            evidence: `Imported from ${fileName}, row ${row.rowNumber}`,
            capturedAt: row.consentDate ? localToDateOnly(row.consentDate) : now,
            capturedBy: ctx.userId ?? "import",
          },
        });
      }
      if (row.notes) await tx.contactNote.create({ data: { workspaceId: ctx.workspaceId, contactId: c.id, body: row.notes, authorId: ctx.userId } });
      const tags = [...row.tags, ...(opts.tag?.trim() ? [opts.tag.trim()] : [])];
      if (tags.length) await setTags(tx, ctx, c.id, tags);
      await syncMilestones(tx, c);
      return c;
    });
    created.push(c.id);
  }

  await audit(ctx, {
    action: "CONTACTS_IMPORTED",
    entityType: "Import",
    details: { fileName, created: created.length, merged: merged.length, skipped: skipped.length, datesVerified: opts.datesVerified },
  });
  if (created.length || merged.length) {
    await enqueueJob(ctx, {
      type: "CONTACT_IMPORTED",
      payload: { contactIds: [...created, ...merged], fileName },
      idempotencyKey: eventKey(`import:${fileName}`),
    });
  }
  return { created: created.length, merged: merged.length, skipped, total: preview.rows.length };
}
