/**
 * Contact Intelligence (AI Responsibility 1).
 *
 * Insights are grounded: each one lists the exact fields or verbatim text it is
 * based on. Nothing here infers personal history that is not in the record.
 */
import { classifyReplyWithRules } from "@/lib/ai/rules-classifier";
import { dateOnlyToLocal, diffDays, formatLocalDate, toLocalDate } from "@/lib/domain/dates";
import { consentStatus } from "@/lib/domain/eligibility";
import type { SchedulingRules } from "@/lib/domain/settings";
import type { Evidence } from "@/lib/domain/types";
import { CONTACT_TYPE_LABEL, TIER_LABEL, type ContactType, type Tier } from "@/lib/domain/types";
import type { Ctx } from "./context";
import { nextMilestoneFor } from "./contacts";
import { prisma } from "./db";
import { upsertTask } from "./tasks";

type InsightDraft = {
  contactId: string;
  type: string;
  title: string;
  summary: string;
  evidence: Evidence[];
  confidence: number;
  dedupeKey: string;
  source?: string;
};

const OPPORTUNITY_CLASSES = new Set(["POTENTIAL_BUYER", "POTENTIAL_SELLER", "POTENTIAL_INVESTOR", "REFERRAL_OPPORTUNITY", "FUTURE_OPPORTUNITY"]);

export async function upsertInsight(ctx: Ctx, d: InsightDraft) {
  return prisma.aiInsight.upsert({
    where: { workspaceId_dedupeKey: { workspaceId: ctx.workspaceId, dedupeKey: d.dedupeKey } },
    create: {
      workspaceId: ctx.workspaceId,
      contactId: d.contactId,
      type: d.type,
      title: d.title,
      summary: d.summary,
      evidenceJson: JSON.stringify(d.evidence),
      confidence: d.confidence,
      source: d.source ?? "RULES",
      dedupeKey: d.dedupeKey,
    },
    update: { title: d.title, summary: d.summary, evidenceJson: JSON.stringify(d.evidence), confidence: d.confidence },
  });
}

export async function generateInsights(ctx: Ctx, rules: SchedulingRules, timeZone: string, now = new Date(), contactIds?: string[]) {
  const today = toLocalDate(now, timeZone);
  const quarter = `${today.slice(0, 4)}Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
  const contacts = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null, doNotContact: false, ...(contactIds ? { id: { in: contactIds } } : {}) },
    include: { consentRecords: true, notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10 } },
  });

  let created = 0;
  let tasks = 0;
  const reviewed = contacts.length;

  for (const c of contacts) {
    const name = `${c.firstName} ${c.lastName}`.trim();
    const drafts: InsightDraft[] = [];
    const typeLabel = CONTACT_TYPE_LABEL[c.contactType as ContactType] ?? c.contactType;
    const tierLabel = TIER_LABEL[c.tier as Tier] ?? c.tier;

    // 1. Contacts who have not had a personal check-in recently.
    const threshold = c.tier === "VIP" ? 90 : rules.reconnectAfterDays;
    const last = c.lastCommunicationAt ? toLocalDate(c.lastCommunicationAt, timeZone) : null;
    const since = last ? diffDays(last, today) : null;
    if (since === null || since >= threshold) {
      const lastText = last ? `${formatLocalDate(last, { month: "short", day: "numeric", year: "numeric" })} (${since} days ago)` : "No communication recorded";
      drafts.push({
        contactId: c.id,
        type: "RECONNECT",
        title: since === null ? `No recorded check-in with ${name}` : `${since} days since last check-in with ${name}`,
        summary: `${tierLabel} ${typeLabel.toLowerCase()} without a personal touch within the ${threshold}-day guideline.`,
        evidence: [
          { label: "Last communication", value: lastText, source: "Contact record" },
          { label: "Relationship tier", value: tierLabel, source: "Contact record" },
        ],
        confidence: 1,
        dedupeKey: `RECONNECT:${c.id}:${quarter}`,
      });
      if (c.tier === "VIP" || c.contactType === "PAST_CLIENT" || c.tier === "NEEDS_RECONNECTION") {
        const r = await upsertTask(
          ctx,
          {
            dedupeKey: `reconnect:${c.id}:${quarter}`,
            type: c.tier === "VIP" ? "CALL" : "RECONNECT",
            title: c.tier === "VIP" ? `Call ${name} — VIP check-in` : `Reconnect with ${name}`,
            description: `A personal call or note works best. ${last ? `Last recorded touch: ${lastText}.` : "There is no recorded communication."}`,
            contactId: c.id,
            dueAt: new Date(now.getTime() + (c.tier === "VIP" ? 2 : 7) * 86_400_000),
            sourceType: "INSIGHT",
            extraReasons: [last ? `${since} days since last communication` : "No communication on record"],
          },
          timeZone,
        );
        if (r.created) tasks++;
      }
    }

    // 2. Upcoming milestones (grounded in the date fields).
    const next = nextMilestoneFor(c, today);
    if (next && next.days <= 30) {
      const isBirthday = next.type === "BIRTHDAY";
      const verified = isBirthday ? c.birthdayVerified : c.closingDateVerified;
      drafts.push({
        contactId: c.id,
        type: isBirthday ? "UPCOMING_BIRTHDAY" : "UPCOMING_ANNIVERSARY",
        title: `${name}'s ${isBirthday ? "birthday" : "home anniversary"} is ${next.days === 0 ? "today" : `in ${next.days} day${next.days === 1 ? "" : "s"}`}`,
        summary: verified ? "Date is verified; a greeting can be prepared automatically." : "Date is not verified — no message will be sent until you confirm it.",
        evidence: [
          {
            label: isBirthday ? "Birthday" : "Closing date",
            value: isBirthday ? `${c.birthdayMonth}/${c.birthdayDay}` : dateOnlyToLocal(c.closingDate!),
            source: verified ? "Contact record (verified)" : "Contact record (unverified)",
          },
        ],
        confidence: 1,
        dedupeKey: `${next.type}:${c.id}:${next.date}`,
      });
    }

    // 3. Data quality: past clients without recorded email consent.
    if (c.email && !c.unsubscribedAt && consentStatus(c.consentRecords, "EMAIL", "MARKETING") === "UNKNOWN") {
      drafts.push({
        contactId: c.id,
        type: "DATA_QUALITY",
        title: `Capture email consent for ${name}`,
        summary: "Newsletters and seasonal emails stay suppressed until consent is recorded. Ask personally next time you talk.",
        evidence: [{ label: "Email marketing consent", value: "No record", source: "Consent history" }],
        confidence: 1,
        dedupeKey: `CONSENT:${c.id}`,
      });
    }

    // 4. Real estate interest mentioned in agent-entered notes (verbatim evidence).
    for (const note of c.notes) {
      const cls = classifyReplyWithRules({ text: note.body, firstName: c.firstName });
      if (!OPPORTUNITY_CLASSES.has(cls.classification)) continue;
      drafts.push({
        contactId: c.id,
        type: cls.classification === "REFERRAL_OPPORTUNITY" ? "REFERRAL" : "REAL_ESTATE_INTEREST",
        title: `Possible ${cls.classification === "REFERRAL_OPPORTUNITY" ? "referral" : "real estate interest"} noted for ${name}`,
        summary: `${cls.summary.replace(c.firstName, name)} Speculative until you confirm it with ${c.firstName}.`,
        evidence: [
          { label: "Your note", value: `“${cls.evidenceQuote}”`, source: `Note from ${note.createdAt.toISOString().slice(0, 10)}` },
          ...(cls.timeframe ? [{ label: "Stated timeframe", value: cls.timeframe, source: "Your note" }] : []),
        ],
        confidence: cls.confidence * 0.8,
        dedupeKey: `NOTE_INTEREST:${note.id}`,
      });
    }

    for (const d of drafts) {
      const exists = await prisma.aiInsight.findUnique({ where: { workspaceId_dedupeKey: { workspaceId: ctx.workspaceId, dedupeKey: d.dedupeKey } } });
      await upsertInsight(ctx, d);
      if (!exists) created++;
    }
  }

  return { reviewed, created, tasks };
}

export async function listInsights(ctx: Ctx, limit = 20) {
  return prisma.aiInsight.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE", contact: { deletedAt: null } },
    include: { contact: { select: { id: true, firstName: true, lastName: true, tier: true } } },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
  });
}

export async function setInsightStatus(ctx: Ctx, id: string, status: "DISMISSED" | "ACTED") {
  await prisma.aiInsight.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { status } });
}
