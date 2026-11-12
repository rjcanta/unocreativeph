/**
 * Delivery — the only place a prepared message can leave the system.
 *
 * Final gates, re-checked at send time (state may have changed since scheduling):
 *   1. Message is SCHEDULED and due; campaign not paused/cancelled.
 *   2. Workspace sending is not paused (immediate pause capability).
 *   3. Content is approved (campaign content version or message approval).
 *   4. Contact is still eligible (consent, unsubscribe, DNC, preferences).
 *   5. Not already delivered (idempotent on the message's delivery event).
 *   6. Inside the sending window.
 *   7. Live delivery requires ALL of: APP_MODE=live, non-demo workspace,
 *      workspace live toggle, live integration with live send enabled and a
 *      verified SEND_EMAIL capability, and CAN-SPAM footer settings.
 *      Otherwise delivery is SIMULATED: nothing leaves the app.
 */
import { checkEligibility, type MessageCategory } from "@/lib/domain/eligibility";
import { canSpamIssues, complianceFooter, renderMergeTags } from "@/lib/domain/render";
import { insideSendWindow, resolveSendInstant } from "@/lib/domain/scheduling";
import { toLocalDate } from "@/lib/domain/dates";
import { audit } from "./audit";
import { appMode, type Ctx } from "./context";
import { toEligibilityContact } from "./contacts";
import { prisma } from "./db";
import { CapabilityNotEnabledError, PolicyError } from "./errors";
import { getCrmProvider } from "./integrations";
import { getWorkspace, type WorkspaceWithSettings } from "./workspace";

export type DeliveryOutcome =
  | { outcome: "SIMULATED" | "SENT"; messageId: string }
  | { outcome: "ALREADY_DELIVERED" | "NOT_SCHEDULED"; messageId: string; detail: string }
  | { outcome: "DEFERRED"; messageId: string; until: Date; detail: string }
  | { outcome: "BLOCKED"; messageId: string; detail: string };

export function liveSendBlockers(ws: WorkspaceWithSettings, integration: { mode: string; status: string; liveSendEnabled: boolean } | null, sendCapability: string | null): string[] {
  const b: string[] = [];
  if (appMode() !== "live") b.push("APP_MODE is demo — all sends are simulated.");
  if (ws.isDemo) b.push("This is the fictional demo workspace.");
  if (!ws.liveSendingEnabled) b.push("Live sending is turned off in workspace compliance settings.");
  if (!integration || integration.status !== "CONNECTED" || integration.mode !== "LIVE") b.push("No live CRM connection.");
  else if (!integration.liveSendEnabled) b.push("Live sending is not enabled on the integration.");
  if (sendCapability !== "AVAILABLE") b.push("The provider's email sending capability is not verified/enabled.");
  b.push(...canSpamIssues(ws.compliance));
  return b;
}

export function renderForContact(
  m: { subject: string; body: string; category: string },
  c: { firstName: string; lastName: string; neighborhood: string | null; city: string | null },
  ws: WorkspaceWithSettings,
) {
  const ctx = { firstName: c.firstName, lastName: c.lastName, neighborhood: c.neighborhood, city: c.city, agentName: ws.brand.agentName, teamName: ws.brand.teamName };
  return {
    subject: renderMergeTags(m.subject, ctx),
    body: `${renderMergeTags(m.body, ctx)}\n\n${complianceFooter(ws.compliance, ws.brand)}`,
  };
}

export async function deliverMessage(ctx: Ctx, messageId: string, now = new Date()): Promise<DeliveryOutcome> {
  const ws = await getWorkspace(ctx);
  const m = await prisma.scheduledMessage.findFirst({
    where: { id: messageId, workspaceId: ctx.workspaceId },
    include: { campaign: true, contact: { include: { consentRecords: true, preference: true } } },
  });
  if (!m) return { outcome: "NOT_SCHEDULED", messageId, detail: "Message not found in this workspace." };

  const prior = await prisma.communicationEvent.findFirst({ where: { scheduledMessageId: m.id, type: { in: ["SENT", "SIMULATED_SEND"] } } });
  if (prior) {
    if (!["SENT", "SIMULATED"].includes(m.status)) await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: prior.type === "SENT" ? "SENT" : "SIMULATED" } });
    return { outcome: "ALREADY_DELIVERED", messageId, detail: "Delivery already recorded — duplicate send prevented." };
  }
  if (m.status !== "SCHEDULED") return { outcome: "NOT_SCHEDULED", messageId, detail: `Message is ${m.status.toLowerCase()}.` };
  if (m.scheduledFor.getTime() > now.getTime() + 60_000) return { outcome: "DEFERRED", messageId, until: m.scheduledFor, detail: "Not due yet." };

  if (ws.sendingPaused) {
    return { outcome: "DEFERRED", messageId, until: new Date(now.getTime() + 60 * 60_000), detail: "Workspace sending is paused." };
  }
  if (m.campaign) {
    if (m.campaign.status === "PAUSED") return { outcome: "DEFERRED", messageId, until: new Date(now.getTime() + 60 * 60_000), detail: "Campaign is paused." };
    if (m.campaign.status === "CANCELLED" || m.campaign.deletedAt) {
      await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "CANCELLED", blockedReason: "Campaign cancelled" } });
      return { outcome: "BLOCKED", messageId, detail: "Campaign cancelled." };
    }
    if (m.campaign.approvedContentVersion !== m.campaign.contentVersion) {
      await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "BLOCKED", blockedReason: "Campaign content changed after approval" } });
      return { outcome: "BLOCKED", messageId, detail: "Campaign content changed after approval." };
    }
  } else if (!m.approvedAt) {
    await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "PENDING_APPROVAL" } });
    return { outcome: "BLOCKED", messageId, detail: "Message has not been approved." };
  }

  if (m.contact.deletedAt) {
    await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "CANCELLED", blockedReason: "Contact archived" } });
    return { outcome: "BLOCKED", messageId, detail: "Contact archived." };
  }
  const elig = checkEligibility(toEligibilityContact(m.contact), m.category as MessageCategory, "EMAIL", ws.compliance);
  if (!elig.eligible) {
    await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "BLOCKED", blockedReason: elig.reason } });
    if (m.campaignId) await prisma.campaignRecipient.updateMany({ where: { campaignId: m.campaignId, contactId: m.contactId }, data: { status: "SUPPRESSED", reasonsJson: JSON.stringify([`Blocked at send time: ${elig.reason}`]) } });
    await audit(ctx, { action: "MESSAGE_BLOCKED", entityType: "ScheduledMessage", entityId: m.id, fromStatus: m.status, toStatus: "BLOCKED", actorType: "SYSTEM", details: { reason: elig.reason } });
    return { outcome: "BLOCKED", messageId, detail: elig.reason };
  }

  if (!insideSendWindow(now, ws.rules, ws.timezone)) {
    const until = resolveSendInstant(toLocalDate(now, ws.timezone), m.category as MessageCategory, ws.rules, ws.timezone, now);
    return { outcome: "DEFERRED", messageId, until, detail: "Outside the sending window." };
  }

  const rendered = renderForContact(m, m.contact, ws);
  const { integration, provider } = await getCrmProvider(ctx);
  const sendCap = provider?.capabilities().SEND_EMAIL.state ?? null;
  const blockers = liveSendBlockers(ws, integration, sendCap);

  if (blockers.length) {
    // Simulated delivery: records what WOULD have been sent. No outbound traffic.
    await prisma.$transaction(async (tx) => {
      await tx.scheduledMessage.update({ where: { id: m.id }, data: { status: "SIMULATED", sentAt: now } });
      await tx.communicationEvent.create({
        data: { workspaceId: ctx.workspaceId, contactId: m.contactId, scheduledMessageId: m.id, direction: "OUTBOUND", channel: "EMAIL", type: "SIMULATED_SEND", subject: rendered.subject, body: rendered.body, occurredAt: now, source: "SIMULATION" },
      });
      await tx.contact.update({ where: { id: m.contactId }, data: { lastCommunicationAt: now } });
      if (m.campaignId) await tx.campaignRecipient.updateMany({ where: { campaignId: m.campaignId, contactId: m.contactId }, data: { status: "SENT" } });
    });
    await audit(ctx, { action: "MESSAGE_SIMULATED", entityType: "ScheduledMessage", entityId: m.id, fromStatus: "SCHEDULED", toStatus: "SIMULATED", actorType: "SYSTEM", details: { why: blockers[0] } });
    await maybeCompleteCampaign(m.campaignId);
    return { outcome: "SIMULATED", messageId };
  }

  // Live path — every gate above passed.
  const mapping = await prisma.integrationMapping.findUnique({ where: { integrationId_contactId: { integrationId: integration.id, contactId: m.contactId } } });
  if (!mapping) throw new PolicyError("Contact is not linked to a CRM record, so it cannot be sent through the CRM.");
  try {
    const res = await provider!.sendEmail({ externalContactId: mapping.externalId, subject: rendered.subject, body: rendered.body, idempotencyKey: m.idempotencyKey });
    await prisma.$transaction(async (tx) => {
      await tx.scheduledMessage.update({ where: { id: m.id }, data: { status: "SENT", sentAt: now, providerMessageId: res.providerMessageId } });
      await tx.communicationEvent.create({
        data: { workspaceId: ctx.workspaceId, contactId: m.contactId, scheduledMessageId: m.id, direction: "OUTBOUND", channel: "EMAIL", type: "SENT", subject: rendered.subject, occurredAt: now, source: "GOHIGHLEVEL", externalId: res.providerMessageId },
      });
      await tx.contact.update({ where: { id: m.contactId }, data: { lastCommunicationAt: now } });
    });
    await audit(ctx, { action: "MESSAGE_SENT", entityType: "ScheduledMessage", entityId: m.id, fromStatus: "SCHEDULED", toStatus: "SENT", actorType: "INTEGRATION" });
    await maybeCompleteCampaign(m.campaignId);
    return { outcome: "SENT", messageId };
  } catch (err) {
    if (err instanceof CapabilityNotEnabledError) {
      await prisma.scheduledMessage.update({ where: { id: m.id }, data: { status: "FAILED", blockedReason: err.message } });
    }
    throw err;
  }
}

async function maybeCompleteCampaign(campaignId: string | null) {
  if (!campaignId) return;
  const remaining = await prisma.scheduledMessage.count({ where: { campaignId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } } });
  if (remaining === 0) await prisma.campaign.updateMany({ where: { id: campaignId, status: "SCHEDULED" }, data: { status: "SENT", sentAt: new Date() } });
}
