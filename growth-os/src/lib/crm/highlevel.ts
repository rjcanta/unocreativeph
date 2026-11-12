/**
 * HighLevel (LeadConnector) API v2 adapter — live connection.
 *
 * VERIFIED (official HighLevel docs, 2021-07-28 API version):
 *   - Base URL https://services.leadconnectorhq.com
 *   - Authorization: Bearer <token>; header Version: 2021-07-28
 *   - Private Integration Tokens are generated per sub-account
 *     (Settings → Private Integrations) and are scoped to the selected scopes.
 *   - GET /contacts/ (with locationId) returns contacts.
 *
 * NOT YET VERIFIED in this build (the official docs host was unreachable from the
 * build environment): exact pagination parameters, contact update, sending
 * messages, tasks, opportunities and webhook signatures. Those methods throw
 * CapabilityNotEnabledError rather than guess at endpoints. See
 * docs/highlevel-integration.md for the verification checklist.
 */
import { CapabilityNotEnabledError } from "@/lib/server/errors";
import type { Capability, CapabilityStatus, CrmContact, CrmProvider } from "./types";

export const HIGHLEVEL_BASE_URL = "https://services.leadconnectorhq.com";
export const HIGHLEVEL_API_VERSION = "2021-07-28";

type RawContact = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[] | null;
  dateOfBirth?: string | null;
  dnd?: boolean | null;
};

export class HighLevelCrmProvider implements CrmProvider {
  readonly kind = "LIVE" as const;

  constructor(
    private token: string,
    private locationId: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  capabilities(): Record<Capability, CapabilityStatus> {
    const unverified = (note: string): CapabilityStatus => ({ state: "NOT_VERIFIED", note });
    return {
      CONTACTS_READ: { state: "AVAILABLE", note: "GET /contacts/ with your Private Integration Token (contacts.readonly scope)." },
      CONTACTS_WRITE: unverified("Disabled until the contact update endpoint is verified against current official docs."),
      SEND_EMAIL: unverified("Disabled until the Conversations send-message endpoint, scopes and plan availability are verified."),
      CREATE_TASK: unverified("Disabled until the contact tasks endpoint is verified."),
      CREATE_OPPORTUNITY: unverified("Disabled until the opportunities endpoint and pipeline mapping are verified."),
      WEBHOOK_INBOUND: {
        state: process.env.GHL_WEBHOOK_PUBLIC_KEY ? "AVAILABLE" : "REQUIRES_CONFIGURATION",
        note: "Requires GHL_WEBHOOK_PUBLIC_KEY and the signature header name from the official webhook docs.",
      },
    };
  }

  private async get(path: string, params: Record<string, string>) {
    const url = new URL(path, HIGHLEVEL_BASE_URL);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      headers: { Authorization: `Bearer ${this.token}`, Version: HIGHLEVEL_API_VERSION, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error(`HighLevel rejected the token (${res.status}). Check the token, its scopes (contacts.readonly) and the location ID.`);
    }
    if (res.status === 429) throw new Error("HighLevel rate limit reached (429). The sync will retry later.");
    if (!res.ok) throw new Error(`HighLevel request failed (${res.status}).`);
    return (await res.json()) as Record<string, unknown>;
  }

  async testConnection() {
    await this.get("/contacts/", { locationId: this.locationId, limit: "1" });
    return { accountName: `HighLevel location ${this.locationId}`, locationId: this.locationId };
  }

  async listContacts(cursor?: string | null) {
    const params: Record<string, string> = { locationId: this.locationId, limit: "100" };
    if (cursor) params.startAfterId = cursor; // pagination parameter: verify with a live account
    const json = await this.get("/contacts/", params);
    const raw = (Array.isArray(json.contacts) ? json.contacts : []) as RawContact[];
    const contacts: CrmContact[] = raw
      .filter((c) => c.id)
      .map((c) => ({
        externalId: String(c.id),
        firstName: c.firstName ?? c.contactName?.split(" ")[0] ?? "",
        lastName: c.lastName ?? "",
        email: c.email ?? null,
        phone: c.phone ?? null,
        tags: c.tags ?? [],
        dateOfBirth: c.dateOfBirth ? String(c.dateOfBirth).slice(0, 10) : null,
        dnd: !!c.dnd,
      }));
    const meta = (json.meta ?? {}) as { startAfterId?: string; nextPageUrl?: string | null };
    const next = meta.nextPageUrl && meta.startAfterId && raw.length > 0 ? String(meta.startAfterId) : null;
    return { contacts, nextCursor: next };
  }

  async updateContact(): Promise<void> {
    throw new CapabilityNotEnabledError("Updating HighLevel contacts is not enabled in this build (endpoint not yet verified).");
  }
  async sendEmail(): Promise<{ providerMessageId: string }> {
    throw new CapabilityNotEnabledError("Sending email through HighLevel is not enabled in this build. Verify the Conversations API endpoint, scopes and plan availability first.");
  }
  async createTask(): Promise<{ externalId: string }> {
    throw new CapabilityNotEnabledError("Creating HighLevel tasks is not enabled in this build (endpoint not yet verified).");
  }
  async createOpportunity(): Promise<{ externalId: string }> {
    throw new CapabilityNotEnabledError("Creating HighLevel opportunities is not enabled in this build (endpoint not yet verified).");
  }
}
