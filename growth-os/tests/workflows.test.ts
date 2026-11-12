/**
 * Integration tests for critical workflows, run against a throwaway SQLite DB.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/db";
import type { Ctx } from "@/lib/server/context";
import { addNote, bulkTag, commitImport, createContact, getContact, listContacts, previewImport, unsubscribeContact, updateContact } from "@/lib/server/contacts";
import { approveCampaign, createNewsletterDraft, scheduleCampaign, updateCampaign } from "@/lib/server/campaigns";
import { materializeCampaign, prepareMilestoneOutreach, approveMessage } from "@/lib/server/messaging";
import { deliverMessage } from "@/lib/server/delivery";
import { processDueJobs } from "@/lib/server/jobs-runner";
import { ingestInboundReply } from "@/lib/server/replies";
import { connectMock, syncContacts } from "@/lib/server/integrations";
import { setLiveSending } from "@/lib/server/settings";
import { DEFAULT_SCHEDULING } from "@/lib/domain/settings";
import { segmentSchema } from "@/lib/domain/segmentation";
import { NotFoundError, PolicyError, ValidationError } from "@/lib/server/errors";

const NOW = new Date("2026-11-12T18:00:00Z"); // 11:00 Phoenix, Thursday

async function makeWorkspace(slug: string): Promise<Ctx> {
  const ws = await prisma.workspace.create({
    data: {
      name: slug,
      slug,
      isDemo: true,
      timezone: "America/Phoenix",
      schedulingJson: JSON.stringify(DEFAULT_SCHEDULING),
      brandVoiceJson: JSON.stringify({ agentName: "Test Agent" }),
      complianceJson: JSON.stringify({ physicalAddress: "1 Test St", senderName: "Test", senderEmail: "t@example.com" }),
    },
  });
  const user = await prisma.user.create({ data: { workspaceId: ws.id, email: `${slug}@example.com`, name: "Owner", role: "OWNER" } });
  return { workspaceId: ws.id, userId: user.id, actorType: "USER" };
}

const consented = (over: Record<string, unknown> = {}) => ({
  firstName: "Pat",
  lastName: "Doe",
  email: `pat.${Math.random().toString(36).slice(2, 8)}@example.com`,
  contactType: "PAST_CLIENT" as const,
  tier: "STANDARD" as const,
  emailConsent: "GRANTED" as const,
  consentSource: "Test opt-in",
  ...over,
});

let A: Ctx;
let B: Ctx;

beforeAll(async () => {
  A = await makeWorkspace("ws-a");
  B = await makeWorkspace("ws-b");
});

describe("tenant isolation", () => {
  it("never returns or mutates another workspace's records", async () => {
    const bContact = await createContact(B, consented({ firstName: "Bea" }));
    await expect(getContact(A, bContact.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateContact(A, bContact.id, consented({ firstName: "Hacked" }))).rejects.toBeInstanceOf(NotFoundError);
    await expect(addNote(A, bContact.id, "x")).rejects.toBeInstanceOf(NotFoundError);
    expect(await bulkTag(A, [bContact.id], "Leak", "add")).toBe(0);
    const listA = await listContacts(A, {}, "America/Phoenix");
    expect(listA.rows.find((r) => r.id === bContact.id)).toBeUndefined();

    const bCampaign = await createNewsletterDraft(B, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await expect(approveCampaign(A, bCampaign.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getContact(B, bContact.id)).firstName).toBe("Bea");
  });
});

describe("contact deduplication on create", () => {
  it("rejects a duplicate email in the same workspace but allows it in another", async () => {
    const email = "dup.person@example.com";
    await createContact(A, consented({ email }));
    await expect(createContact(A, consented({ email: "DUP.person@example.com", firstName: "Other" }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createContact(B, consented({ email }))).resolves.toBeTruthy();
  });
});

describe("campaign approval", () => {
  it("requires agent approval before any message is scheduled", async () => {
    const ctx = await makeWorkspace("ws-approval");
    await createContact(ctx, consented());
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    expect(c.status).toBe("PENDING_APPROVAL");
    await expect(materializeCampaign(ctx, c.id, NOW)).rejects.toBeInstanceOf(PolicyError);
    expect(await prisma.scheduledMessage.count({ where: { campaignId: c.id } })).toBe(0);

    await expect(approveCampaign({ ...ctx, userId: null, actorType: "AI" }, c.id)).rejects.toBeInstanceOf(PolicyError);

    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    expect(await prisma.scheduledMessage.count({ where: { campaignId: c.id, status: "SCHEDULED" } })).toBe(1);
    expect((await prisma.campaign.findUnique({ where: { id: c.id } }))!.status).toBe("SCHEDULED");
  });

  it("resets approval and cancels unsent messages when content is edited", async () => {
    const ctx = await makeWorkspace("ws-edit");
    await createContact(ctx, consented());
    const c = await createNewsletterDraft(ctx, { kind: "LIFESTYLE_COMMUNITY", sendDate: "2026-12-21" }, NOW);
    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    const row = (await prisma.campaign.findUnique({ where: { id: c.id } }))!;
    await updateCampaign(ctx, c.id, { name: row.name, subject: "Edited subject", previewText: "", body: row.body, sendDate: "2026-12-21", segment: segmentSchema.parse({}), replacesNewsletter: false, verifiedMarketData: null }, NOW);
    const after = (await prisma.campaign.findUnique({ where: { id: c.id } }))!;
    expect(after.status).toBe("PENDING_APPROVAL");
    expect(after.approvedContentVersion).not.toBe(after.contentVersion);
    expect(await prisma.scheduledMessage.count({ where: { campaignId: c.id, status: "SCHEDULED" } })).toBe(0);
  });

  it("blocks approval when content contains unverified statistics", async () => {
    const ctx = await makeWorkspace("ws-stats");
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await updateCampaign(ctx, c.id, { name: c.name, subject: c.subject, previewText: "", body: `${c.body}\nPrices rose 12% this year.`, sendDate: "2026-12-07", segment: segmentSchema.parse({}), replacesNewsletter: false, verifiedMarketData: null }, NOW);
    await expect(approveCampaign(ctx, c.id)).rejects.toThrow(/Statistics not found/);
  });
});

describe("duplicate-send prevention", () => {
  it("materializes once and delivers once", async () => {
    const ctx = await makeWorkspace("ws-dupe");
    const contact = await createContact(ctx, consented());
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    const again = await materializeCampaign(ctx, c.id, NOW);
    expect(again.result.alreadyPrepared).toBe(1);
    expect(await prisma.scheduledMessage.count({ where: { campaignId: c.id } })).toBe(1);

    const msg = (await prisma.scheduledMessage.findFirst({ where: { campaignId: c.id } }))!;
    const sendAt = new Date("2026-12-07T17:00:00Z");
    expect((await deliverMessage(ctx, msg.id, sendAt)).outcome).toBe("SIMULATED");
    expect((await deliverMessage(ctx, msg.id, sendAt)).outcome).toBe("ALREADY_DELIVERED");
    expect(await prisma.communicationEvent.count({ where: { scheduledMessageId: msg.id } })).toBe(1);

    await expect(
      prisma.scheduledMessage.create({
        data: { workspaceId: ctx.workspaceId, contactId: contact.id, category: "NEWSLETTER", kind: "X", subject: "s", body: "b", status: "SCHEDULED", scheduledFor: sendAt, occurrenceKey: "x", idempotencyKey: msg.idempotencyKey },
      }),
    ).rejects.toThrow();
  });
});

describe("consent restrictions and opt-out suppression end to end", () => {
  it("blocks delivery if the contact unsubscribes after scheduling", async () => {
    const ctx = await makeWorkspace("ws-optout");
    const contact = await createContact(ctx, consented());
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    const msg = (await prisma.scheduledMessage.findFirst({ where: { campaignId: c.id } }))!;
    // Simulate a race: consent revoked directly, bypassing the cancellation path.
    await prisma.contact.update({ where: { id: contact.id }, data: { unsubscribedAt: new Date() } });
    const r = await deliverMessage(ctx, msg.id, new Date("2026-12-07T17:00:00Z"));
    expect(r.outcome).toBe("BLOCKED");
    expect((await prisma.scheduledMessage.findUnique({ where: { id: msg.id } }))!.status).toBe("BLOCKED");
  });

  it("suppresses contacts without consent when scheduling", async () => {
    const ctx = await makeWorkspace("ws-noconsent");
    await createContact(ctx, consented({ emailConsent: undefined, consentSource: undefined }));
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    expect(await prisma.scheduledMessage.count({ where: { campaignId: c.id } })).toBe(0);
    expect((await prisma.campaignRecipient.findFirst({ where: { campaignId: c.id } }))!.status).toBe("SUPPRESSED");
  });

  it("honors an opt-out reply automatically and cancels pending email", async () => {
    const ctx = await makeWorkspace("ws-reply-optout");
    const contact = await createContact(ctx, consented());
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    await ingestInboundReply(ctx, { contactId: contact.id, text: "Please unsubscribe me.", source: "SIMULATION", externalId: "optout-1" });
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    const after = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(after.unsubscribedAt).not.toBeNull();
    expect(await prisma.scheduledMessage.count({ where: { contactId: contact.id, status: "SCHEDULED" } })).toBe(0);
    expect(await prisma.contactConsentRecord.count({ where: { contactId: contact.id, status: "REVOKED" } })).toBeGreaterThan(0);
  });
});

describe("milestone outreach", () => {
  it("prepares a verified birthday once, tasks VIPs, and never auto-sends unverified dates", async () => {
    const ctx = await makeWorkspace("ws-milestone");
    const vip = await createContact(ctx, consented({ tier: "VIP", birthdayMonth: 11, birthdayDay: 15, birthdayVerified: true }));
    const unverified = await createContact(ctx, consented({ birthdayMonth: 11, birthdayDay: 16, birthdayVerified: false }));
    const noConsent = await createContact(ctx, consented({ birthdayMonth: 11, birthdayDay: 17, birthdayVerified: true, emailConsent: undefined, consentSource: undefined }));
    const ms = async (contactId: string) => (await prisma.contactMilestone.findFirstOrThrow({ where: { contactId, type: "BIRTHDAY" } })).id;

    const r1 = await prepareMilestoneOutreach(ctx, { contactId: vip.id, milestoneId: await ms(vip.id), occurrence: "2026-11-15" }, NOW);
    expect(r1.outcome).toBe("PREPARED");
    const r1b = await prepareMilestoneOutreach(ctx, { contactId: vip.id, milestoneId: await ms(vip.id), occurrence: "2026-11-15" }, NOW);
    expect(r1b.outcome).toBe("SKIPPED");
    expect(await prisma.scheduledMessage.count({ where: { contactId: vip.id } })).toBe(1);
    expect(await prisma.agentTask.count({ where: { contactId: vip.id, type: "CALL" } })).toBe(1);
    const msg = await prisma.scheduledMessage.findFirstOrThrow({ where: { contactId: vip.id } });
    expect(msg.status).toBe("PENDING_APPROVAL");
    expect(msg.scheduledFor.toISOString()).toBe("2026-11-15T16:00:00.000Z");

    const r2 = await prepareMilestoneOutreach(ctx, { contactId: unverified.id, milestoneId: await ms(unverified.id), occurrence: "2026-11-16" }, NOW);
    expect(r2.outcome).toBe("VERIFY_REQUESTED");
    expect(await prisma.scheduledMessage.count({ where: { contactId: unverified.id } })).toBe(0);

    const r3 = await prepareMilestoneOutreach(ctx, { contactId: noConsent.id, milestoneId: await ms(noConsent.id), occurrence: "2026-11-17" }, NOW);
    expect(r3.outcome).toBe("TASK_ONLY");
    expect(await prisma.agentTask.count({ where: { contactId: noConsent.id, type: "PERSONAL_MESSAGE" } })).toBe(1);
  });

  it("postpones an already-scheduled newsletter when a milestone lands nearby", async () => {
    const ctx = await makeWorkspace("ws-priority");
    const contact = await createContact(ctx, consented({ birthdayMonth: 12, birthdayDay: 8, birthdayVerified: true }));
    const c = await createNewsletterDraft(ctx, { kind: "MARKET_INSIGHTS", sendDate: "2026-12-07" }, NOW);
    await approveCampaign(ctx, c.id);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    // Newsletter yields to the birthday even before the greeting is drafted.
    const msg = await prisma.scheduledMessage.findFirstOrThrow({ where: { campaignId: c.id } });
    expect(msg.scheduledFor.toISOString()).toBe("2026-12-14T16:00:00.000Z");
    expect(msg.reasonsJson).toMatch(/Postponed/);
    const recipient = await prisma.campaignRecipient.findFirstOrThrow({ where: { campaignId: c.id, contactId: contact.id } });
    expect(recipient.status).toBe("POSTPONED");
  });
});

describe("live sending is impossible in demo mode", () => {
  it("simulates delivery and refuses to enable live sending", async () => {
    const ctx = await makeWorkspace("ws-live");
    const contact = await createContact(ctx, consented({ birthdayMonth: 11, birthdayDay: 14, birthdayVerified: true }));
    const milestoneId = (await prisma.contactMilestone.findFirstOrThrow({ where: { contactId: contact.id } })).id;
    const r = await prepareMilestoneOutreach(ctx, { contactId: contact.id, milestoneId, occurrence: "2026-11-14" }, NOW);
    if (r.outcome !== "PREPARED") throw new Error("expected prepared");
    // Awaiting approval: delivery refuses to send it.
    expect((await deliverMessage(ctx, r.messageId, new Date("2026-11-14T17:00:00Z"))).outcome).toBe("NOT_SCHEDULED");
    await approveMessage(ctx, r.messageId, NOW);
    expect((await deliverMessage(ctx, r.messageId, new Date("2026-11-14T17:00:00Z"))).outcome).toBe("SIMULATED");
    expect(await prisma.communicationEvent.count({ where: { scheduledMessageId: r.messageId, type: "SENT" } })).toBe(0);
    await expect(setLiveSending(ctx, true)).rejects.toBeInstanceOf(PolicyError);
  });
});

describe("CRM sync idempotency", () => {
  it("re-running a sync creates no duplicates and reports unchanged records", async () => {
    const ctx = await makeWorkspace("ws-crm");
    await createContact(ctx, consented({ firstName: "Elena", lastName: "Marquez", email: "elena.marquez@example.com" }));
    await connectMock(ctx);
    const first = await syncContacts(ctx);
    expect(first.fetched).toBe(8);
    expect(first.linked).toBe(1);
    expect(first.created).toBe(7);
    const countAfterFirst = await prisma.contact.count({ where: { workspaceId: ctx.workspaceId } });
    const second = await syncContacts(ctx);
    expect(second.created).toBe(0);
    expect(second.linked).toBe(0);
    expect(second.unchanged).toBe(8);
    expect(await prisma.contact.count({ where: { workspaceId: ctx.workspaceId } })).toBe(countAfterFirst);
    expect(await prisma.integrationMapping.count({ where: { workspaceId: ctx.workspaceId } })).toBe(8);
    const dnd = await prisma.contact.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId, email: "owen.fitzgerald@example.org" } });
    expect(dnd.doNotContact).toBe(true);
    const imported = await prisma.contact.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId, email: "harper.quinlan@example.com" }, include: { consentRecords: true } });
    expect(imported.consentRecords).toHaveLength(0); // never assume consent
    expect(imported.birthdayVerified).toBe(false);
  });
});

describe("reply intelligence", () => {
  it("classifies a potential seller, records the timeframe, and creates a follow-up task", async () => {
    const ctx = await makeWorkspace("ws-reply");
    const contact = await createContact(ctx, consented());
    const { duplicate } = await ingestInboundReply(ctx, { contactId: contact.id, text: "We may sell next year because we're planning to move.", source: "SIMULATION", externalId: "r-1" });
    expect(duplicate).toBe(false);
    expect((await ingestInboundReply(ctx, { contactId: contact.id, text: "same", source: "SIMULATION", externalId: "r-1" })).duplicate).toBe(true);
    await processDueJobs({ workspaceId: ctx.workspaceId, now: NOW });
    const opp = await prisma.opportunity.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(opp).toMatchObject({ type: "SELLER", status: "POTENTIAL", timeframe: "next year" });
    expect(await prisma.agentTask.count({ where: { contactId: contact.id, status: "OPEN" } })).toBeGreaterThanOrEqual(1);
    const event = await prisma.communicationEvent.findFirstOrThrow({ where: { externalId: "r-1" } });
    expect(event.triageStatus).toBe("NEEDS_ATTENTION");
    // Nothing was sent back automatically.
    expect(await prisma.communicationEvent.count({ where: { contactId: contact.id, direction: "OUTBOUND" } })).toBe(0);
  });
});

describe("CSV import", () => {
  it("previews, deduplicates, and imports with unverified dates by default", async () => {
    const ctx = await makeWorkspace("ws-csv");
    await createContact(ctx, consented({ firstName: "Existing", lastName: "Person", email: "existing@example.com" }));
    const csv = [
      "First Name,Last Name,Email,Phone,Contact Type,Birthday,Closing Date,Email Consent,Consent Source",
      "New,Client,new.client@example.com,602-555-0177,Past Client,03/14,2020-05-01,yes,Closing docs",
      "Existing,Person,EXISTING@example.com,,Sphere,,,,",
      "Bad,Row,not-an-email,,Sphere,,,,",
      "New,Client,new.client@example.com,,Past Client,,,,",
    ].join("\n");
    const preview = await previewImport(ctx, csv, "test.csv", "America/Phoenix");
    expect(preview.counts).toEqual({ NEW: 1, DUPLICATE: 1, DUPLICATE_IN_FILE: 1, CONFLICT: 0, INVALID: 1 });
    const result = await commitImport(ctx, csv, "test.csv", "America/Phoenix", { datesVerified: false, duplicateStrategy: "SKIP" });
    expect(result.created).toBe(1);
    expect(result.skipped).toHaveLength(3);
    const c = await prisma.contact.findFirstOrThrow({ where: { workspaceId: ctx.workspaceId, email: "new.client@example.com" }, include: { consentRecords: true } });
    expect(c.birthdayVerified).toBe(false);
    expect(c.closingDateVerified).toBe(false);
    expect(c.consentRecords[0]).toMatchObject({ status: "GRANTED", source: "Closing docs" });
  });

  it("unsubscribe is idempotent", async () => {
    const ctx = await makeWorkspace("ws-unsub");
    const c = await createContact(ctx, consented());
    expect((await unsubscribeContact(ctx, c.id, "test")).alreadyUnsubscribed).toBe(false);
    expect((await unsubscribeContact(ctx, c.id, "test")).alreadyUnsubscribed).toBe(true);
  });
});
