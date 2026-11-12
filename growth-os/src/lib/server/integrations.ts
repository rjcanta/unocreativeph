/**
 * CRM integration service: connection lifecycle, idempotent contact sync,
 * outbound pushes and the sync log. Credentials never leave the server.
 */
import crypto from "node:crypto";
import { decryptSecret, encryptSecret, encryptionConfigured } from "@/lib/crm/crypto";
import { HighLevelCrmProvider } from "@/lib/crm/highlevel";
import { MockCrmProvider } from "@/lib/crm/mock";
import type { CrmContact, CrmProvider } from "@/lib/crm/types";
import { buildIndex, matchContact } from "@/lib/domain/dedupe";
import { normalizeEmail, normalizePhone } from "@/lib/domain/normalize";
import { audit } from "./audit";
import { appMode, type Ctx } from "./context";
import { prisma } from "./db";
import { AppError, PolicyError, ValidationError } from "./errors";
import { enqueueJob, eventKey } from "./jobs-queue";

const PROVIDER = "GOHIGHLEVEL";
const mockProvider = new MockCrmProvider();

export async function getIntegration(ctx: Ctx) {
  return prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: ctx.workspaceId, provider: PROVIDER } },
    create: { workspaceId: ctx.workspaceId, provider: PROVIDER },
    update: {},
  });
}

/** Safe view for the browser: never includes credentials. */
export async function getIntegrationView(ctx: Ctx) {
  const i = await getIntegration(ctx);
  const provider = providerFor(i);
  const [logs, mapped] = await Promise.all([
    prisma.integrationSyncLog.findMany({ where: { workspaceId: ctx.workspaceId, integrationId: i.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.integrationMapping.count({ where: { workspaceId: ctx.workspaceId, integrationId: i.id } }),
  ]);
  return {
    id: i.id,
    provider: i.provider,
    mode: i.mode,
    status: i.status,
    authMethod: i.authMethod,
    locationId: i.locationId,
    accountName: i.accountName,
    hasCredentials: !!i.encryptedCredentials,
    liveSendEnabled: i.liveSendEnabled,
    lastSyncAt: i.lastSyncAt,
    lastError: i.lastError,
    connectedAt: i.connectedAt,
    capabilities: provider?.capabilities() ?? mockProvider.capabilities(),
    logs,
    mapped,
    encryptionConfigured: encryptionConfigured(),
    appMode: appMode(),
  };
}

function providerFor(i: { mode: string; status: string; encryptedCredentials: string | null; locationId: string | null }): CrmProvider | null {
  if (i.status === "DISCONNECTED") return null;
  if (i.mode === "MOCK") return mockProvider;
  if (!i.encryptedCredentials || !i.locationId) return null;
  return new HighLevelCrmProvider(decryptSecret(i.encryptedCredentials), i.locationId);
}

export async function getCrmProvider(ctx: Ctx): Promise<{ integration: Awaited<ReturnType<typeof getIntegration>>; provider: CrmProvider | null }> {
  const integration = await getIntegration(ctx);
  return { integration, provider: providerFor(integration) };
}

async function log(ctx: Ctx, integrationId: string, action: string, status: string, message: string, stats: Record<string, unknown> = {}) {
  await prisma.integrationSyncLog.create({
    data: { workspaceId: ctx.workspaceId, integrationId, action, status, message, statsJson: JSON.stringify(stats) },
  });
}

export async function connectMock(ctx: Ctx) {
  const i = await getIntegration(ctx);
  const info = await mockProvider.testConnection();
  await prisma.integration.update({
    where: { id: i.id },
    data: { mode: "MOCK", status: "CONNECTED", authMethod: "MOCK", accountName: info.accountName, locationId: info.locationId, encryptedCredentials: null, liveSendEnabled: false, lastError: null, connectedAt: new Date() },
  });
  await log(ctx, i.id, "CONNECT", "SUCCESS", "Connected the mock HighLevel adapter (Demo Mode — no external calls).");
  await audit(ctx, { action: "INTEGRATION_CONNECTED", entityType: "Integration", entityId: i.id, details: { mode: "MOCK" } });
}

export async function connectLive(ctx: Ctx, input: { token: string; locationId: string }) {
  if (appMode() !== "live") {
    throw new PolicyError("Live HighLevel connections are disabled while APP_MODE=demo. Demo Mode uses the mock adapter.");
  }
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId } });
  if (ws.isDemo) throw new PolicyError("The demo workspace contains fictional data and cannot be connected to a real CRM account.");
  if (!encryptionConfigured()) throw new PolicyError("Set CREDENTIALS_ENCRYPTION_KEY before storing a live token.");
  const token = input.token.trim();
  const locationId = input.locationId.trim();
  if (!token || !locationId) throw new ValidationError("Private Integration Token and Location ID are both required.");

  const i = await getIntegration(ctx);
  const provider = new HighLevelCrmProvider(token, locationId);
  try {
    const info = await provider.testConnection();
    await prisma.integration.update({
      where: { id: i.id },
      data: { mode: "LIVE", status: "CONNECTED", authMethod: "PRIVATE_INTEGRATION_TOKEN", locationId, accountName: info.accountName, encryptedCredentials: encryptSecret(token), liveSendEnabled: false, lastError: null, connectedAt: new Date() },
    });
    await log(ctx, i.id, "CONNECT", "SUCCESS", `Connected to ${info.accountName} with a Private Integration Token.`);
    await audit(ctx, { action: "INTEGRATION_CONNECTED", entityType: "Integration", entityId: i.id, details: { mode: "LIVE", locationId } });
  } catch (err) {
    const message = (err as Error).message;
    await prisma.integration.update({ where: { id: i.id }, data: { status: "ERROR", lastError: message } });
    await log(ctx, i.id, "CONNECT", "FAILED", message);
    throw new AppError(`Connection test failed: ${message}`, "CONNECT_FAILED", false);
  }
}

export async function disconnect(ctx: Ctx) {
  const i = await getIntegration(ctx);
  await prisma.integration.update({
    where: { id: i.id },
    data: { status: "DISCONNECTED", encryptedCredentials: null, liveSendEnabled: false, accountName: null, connectedAt: null },
  });
  await log(ctx, i.id, "DISCONNECT", "SUCCESS", "Disconnected. Stored credentials were deleted. Contact mappings were kept.");
  await audit(ctx, { action: "INTEGRATION_DISCONNECTED", entityType: "Integration", entityId: i.id });
}

export async function setIntegrationLiveSend(ctx: Ctx, enabled: boolean) {
  const i = await getIntegration(ctx);
  if (enabled) {
    if (appMode() !== "live" || i.mode !== "LIVE") throw new PolicyError("Live sending can only be enabled for a live connection with APP_MODE=live.");
    const caps = providerFor(i)?.capabilities();
    if (caps?.SEND_EMAIL.state !== "AVAILABLE") throw new PolicyError(`Live sending is unavailable: ${caps?.SEND_EMAIL.note ?? "provider not connected"}`);
  }
  await prisma.integration.update({ where: { id: i.id }, data: { liveSendEnabled: enabled } });
  await audit(ctx, { action: enabled ? "INTEGRATION_LIVE_SEND_ENABLED" : "INTEGRATION_LIVE_SEND_DISABLED", entityType: "Integration", entityId: i.id });
}

const syncHash = (c: CrmContact) =>
  crypto.createHash("sha256").update(JSON.stringify([c.firstName, c.lastName, normalizeEmail(c.email), normalizePhone(c.phone), [...c.tags].sort(), c.dateOfBirth, c.dnd])).digest("hex").slice(0, 24);

/**
 * Pull contacts from the CRM. Idempotent: mappings are keyed by external ID and a
 * content hash, so re-running creates no duplicates and reports "unchanged".
 * Imported contacts never get assumed marketing consent; CRM DND is respected.
 */
export async function syncContacts(ctx: Ctx) {
  const { integration, provider } = await getCrmProvider(ctx);
  if (!provider) throw new ValidationError("Connect the integration before syncing.");
  const stats = { fetched: 0, created: 0, linked: 0, updated: 0, unchanged: 0, conflicts: 0, dndApplied: 0 };
  const conflicts: string[] = [];
  const createdIds: string[] = [];

  try {
    const existing = await prisma.contact.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    });
    const idx = buildIndex(existing);
    let cursor: string | null = null;
    for (let page = 0; page < 20; page++) {
      const res = await provider.listContacts(cursor);
      for (const ext of res.contacts) {
        stats.fetched++;
        const hash = syncHash(ext);
        const mapping = await prisma.integrationMapping.findUnique({ where: { integrationId_externalId: { integrationId: integration.id, externalId: ext.externalId } } });
        if (mapping) {
          if (mapping.syncHash === hash) {
            stats.unchanged++;
            continue;
          }
          await applyInbound(ctx, mapping.contactId, ext, stats);
          await prisma.integrationMapping.update({ where: { id: mapping.id }, data: { syncHash: hash, lastSyncedAt: new Date(), syncStatus: "SYNCED" } });
          stats.updated++;
          continue;
        }
        const match = matchContact(ext, idx);
        if (match.status === "DUPLICATE") {
          await prisma.integrationMapping.create({
            data: { workspaceId: ctx.workspaceId, integrationId: integration.id, contactId: match.matchId, externalId: ext.externalId, syncHash: hash, lastSyncedAt: new Date() },
          });
          await applyInbound(ctx, match.matchId, ext, stats);
          stats.linked++;
        } else if (match.status === "CONFLICT") {
          stats.conflicts++;
          conflicts.push(`${ext.firstName} ${ext.lastName} (${ext.externalId}): ${match.reason}`);
        } else {
          const c = await prisma.contact.create({
            data: {
              workspaceId: ctx.workspaceId,
              firstName: ext.firstName || "Unknown",
              lastName: ext.lastName,
              email: ext.email,
              emailNormalized: normalizeEmail(ext.email),
              phone: ext.phone,
              phoneNormalized: normalizePhone(ext.phone),
              contactType: "SPHERE",
              tier: "STANDARD",
              birthdayMonth: ext.dateOfBirth ? Number(ext.dateOfBirth.slice(5, 7)) : null,
              birthdayDay: ext.dateOfBirth ? Number(ext.dateOfBirth.slice(8, 10)) : null,
              birthdayVerified: false,
              doNotContact: ext.dnd,
              source: "CRM",
              preference: { create: { workspaceId: ctx.workspaceId } },
            },
          });
          await prisma.integrationMapping.create({
            data: { workspaceId: ctx.workspaceId, integrationId: integration.id, contactId: c.id, externalId: ext.externalId, syncHash: hash, lastSyncedAt: new Date() },
          });
          const tag = await prisma.tag.upsert({
            where: { workspaceId_name: { workspaceId: ctx.workspaceId, name: "From HighLevel" } },
            create: { workspaceId: ctx.workspaceId, name: "From HighLevel" },
            update: {},
          });
          await prisma.contactTag.create({ data: { workspaceId: ctx.workspaceId, contactId: c.id, tagId: tag.id } });
          if (ext.dnd) stats.dndApplied++;
          createdIds.push(c.id);
          stats.created++;
          idx.byEmail.set(normalizeEmail(ext.email) ?? `__${c.id}`, { id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone });
        }
      }
      cursor = res.nextCursor;
      if (!cursor) break;
    }

    const status = stats.conflicts ? "PARTIAL" : "SUCCESS";
    await prisma.integration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" } });
    await log(
      ctx,
      integration.id,
      "CONTACT_PULL",
      status,
      `Fetched ${stats.fetched}: ${stats.created} new, ${stats.linked} matched to existing, ${stats.updated} updated, ${stats.unchanged} unchanged, ${stats.conflicts} conflicts.${integration.mode === "MOCK" ? " (mock data)" : ""}`,
      { ...stats, conflicts },
    );
    await audit(ctx, { action: "CRM_SYNC", entityType: "Integration", entityId: integration.id, actorType: "INTEGRATION", details: stats });
    if (createdIds.length) {
      await enqueueJob(ctx, { type: "CONTACT_IMPORTED", payload: { contactIds: createdIds, source: "CRM" }, idempotencyKey: eventKey("crm-import") });
    }
    return { ...stats, conflictDetails: conflicts };
  } catch (err) {
    const message = (err as Error).message;
    await prisma.integration.update({ where: { id: integration.id }, data: { lastError: message, status: "ERROR" } });
    await log(ctx, integration.id, "CONTACT_PULL", "FAILED", message, stats);
    throw err;
  }
}

async function applyInbound(ctx: Ctx, contactId: string, ext: CrmContact, stats: { dndApplied: number }) {
  const c = await prisma.contact.findFirst({ where: { id: contactId, workspaceId: ctx.workspaceId } });
  if (!c) return;
  const data: Record<string, unknown> = {};
  if (!c.phone && ext.phone) Object.assign(data, { phone: ext.phone, phoneNormalized: normalizePhone(ext.phone) });
  if (!c.email && ext.email) Object.assign(data, { email: ext.email, emailNormalized: normalizeEmail(ext.email) });
  if (ext.dnd && !c.doNotContact) {
    data.doNotContact = true;
    stats.dndApplied++;
    await prisma.scheduledMessage.updateMany({
      where: { contactId, status: { in: ["PENDING_APPROVAL", "SCHEDULED"] } },
      data: { status: "CANCELLED", blockedReason: "Do-not-disturb set in HighLevel" },
    });
  }
  if (Object.keys(data).length) await prisma.contact.update({ where: { id: contactId }, data });
}

/** Push a change to the CRM if mapped and supported; always logs the outcome honestly. */
export async function pushToCrm(
  ctx: Ctx,
  contactId: string,
  action: "UNSUBSCRIBE" | "TASK" | "OPPORTUNITY",
  payload: { title?: string; body?: string; dueAt?: Date | null; name?: string; type?: string } = {},
): Promise<{ status: "SUCCESS" | "SKIPPED" | "FAILED"; externalId?: string; message: string }> {
  const { integration, provider } = await getCrmProvider(ctx);
  if (!provider) return { status: "SKIPPED", message: "No CRM connected." };
  const mapping = await prisma.integrationMapping.findUnique({ where: { integrationId_contactId: { integrationId: integration.id, contactId } } });
  if (!mapping) return { status: "SKIPPED", message: "Contact is not linked to a CRM record." };
  const cap = provider.capabilities()[action === "UNSUBSCRIBE" ? "CONTACTS_WRITE" : action === "TASK" ? "CREATE_TASK" : "CREATE_OPPORTUNITY"];
  if (cap.state !== "AVAILABLE" && cap.state !== "SIMULATED") {
    const message = `${action} not pushed: ${cap.note}`;
    await log(ctx, integration.id, "CONTACT_PUSH", "SKIPPED", message, { contactId, action });
    return { status: "SKIPPED", message };
  }
  try {
    let externalId: string | undefined;
    if (action === "UNSUBSCRIBE") await provider.updateContact(mapping.externalId, { dnd: true });
    else if (action === "TASK") externalId = (await provider.createTask({ externalContactId: mapping.externalId, title: payload.title ?? "Follow up", body: payload.body ?? "", dueAt: payload.dueAt ?? null })).externalId;
    else externalId = (await provider.createOpportunity({ externalContactId: mapping.externalId, name: payload.name ?? "Opportunity", type: payload.type ?? "FUTURE" })).externalId;
    const message = `${action} pushed to ${integration.mode === "MOCK" ? "mock CRM (simulated)" : "HighLevel"}${externalId ? ` as ${externalId}` : ""}.`;
    await log(ctx, integration.id, "CONTACT_PUSH", "SUCCESS", message, { contactId, action, externalId });
    return { status: "SUCCESS", externalId, message };
  } catch (err) {
    const message = (err as Error).message;
    await log(ctx, integration.id, "CONTACT_PUSH", "FAILED", message, { contactId, action });
    return { status: "FAILED", message };
  }
}
