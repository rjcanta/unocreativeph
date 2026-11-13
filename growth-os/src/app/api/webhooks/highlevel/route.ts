/**
 * HighLevel conversation webhook receiver.
 *
 * Security: requests are rejected unless the signature verifies against
 * GHL_WEBHOOK_PUBLIC_KEY using the header named by GHL_WEBHOOK_SIGNATURE_HEADER.
 * Take both values from the current official HighLevel webhook documentation.
 *
 * Payload fields used (verify against the official InboundMessage schema before
 * enabling): type, locationId, contactId, messageId, body, messageType, direction.
 * Events are idempotent on messageId.
 */
import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/crm/crypto";
import { systemCtx } from "@/lib/server/context";
import { prisma } from "@/lib/server/db";
import { processDueJobs } from "@/lib/server/jobs-runner";
import { ingestInboundReply } from "@/lib/server/replies";

export const dynamic = "force-dynamic";

type Payload = { type?: string; locationId?: string; contactId?: string; messageId?: string; body?: string; messageType?: string; direction?: string; webhookId?: string };

export async function POST(req: Request) {
  const publicKey = process.env.GHL_WEBHOOK_PUBLIC_KEY?.trim();
  const headerName = process.env.GHL_WEBHOOK_SIGNATURE_HEADER?.trim() || "x-wh-signature";
  if (!publicKey) return NextResponse.json({ error: "Webhook verification is not configured." }, { status: 503 });

  const raw = await req.text();
  const signature = req.headers.get(headerName);
  if (!signature || !verifyWebhookSignature(raw, signature, publicKey.replace(/\\n/g, "\n"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (payload.type !== "InboundMessage" || (payload.direction && payload.direction !== "inbound")) {
    return NextResponse.json({ ignored: true, reason: "Unsupported event type" }, { status: 202 });
  }
  if (!payload.locationId || !payload.contactId || !payload.body) {
    return NextResponse.json({ error: "Missing locationId, contactId or body" }, { status: 400 });
  }

  const integration = await prisma.integration.findFirst({ where: { provider: "GOHIGHLEVEL", mode: "LIVE", status: "CONNECTED", locationId: payload.locationId } });
  if (!integration) return NextResponse.json({ ignored: true, reason: "No connected workspace for this location" }, { status: 202 });
  const mapping = await prisma.integrationMapping.findUnique({ where: { integrationId_externalId: { integrationId: integration.id, externalId: payload.contactId } } });
  if (!mapping) return NextResponse.json({ ignored: true, reason: "Contact not linked; run a contact sync" }, { status: 202 });

  const ctx = { ...systemCtx(integration.workspaceId), actorType: "INTEGRATION" as const };
  const externalId = payload.messageId ?? payload.webhookId;
  if (!externalId) return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
  const { duplicate, event } = await ingestInboundReply(ctx, {
    contactId: mapping.contactId,
    text: payload.body,
    channel: payload.messageType?.toUpperCase().includes("SMS") ? "SMS" : "EMAIL",
    source: "GOHIGHLEVEL",
    externalId,
  });
  await prisma.integrationSyncLog.create({
    data: { workspaceId: integration.workspaceId, integrationId: integration.id, action: "WEBHOOK", status: duplicate ? "SKIPPED" : "SUCCESS", message: duplicate ? `Duplicate event ${externalId} ignored` : `Inbound reply ${externalId} received`, statsJson: "{}" },
  });
  if (!duplicate) await processDueJobs({ workspaceId: integration.workspaceId, limit: 20, workerId: "webhook" });
  return NextResponse.json({ ok: true, duplicate, eventId: event.id });
}
