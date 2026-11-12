/** CRM provider contract. Internal code depends only on this interface. */

export type CrmContact = {
  externalId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  /** YYYY-MM-DD if supplied by the CRM. Imported as UNVERIFIED. */
  dateOfBirth: string | null;
  /** CRM-level do-not-disturb flag. Always respected inbound. */
  dnd: boolean;
};

export type Capability =
  | "CONTACTS_READ"
  | "CONTACTS_WRITE"
  | "SEND_EMAIL"
  | "CREATE_TASK"
  | "CREATE_OPPORTUNITY"
  | "WEBHOOK_INBOUND";

export type CapabilityState = "AVAILABLE" | "SIMULATED" | "NOT_VERIFIED" | "REQUIRES_CONFIGURATION";

export type CapabilityStatus = { state: CapabilityState; note: string };

export const CAPABILITY_LABEL: Record<Capability, string> = {
  CONTACTS_READ: "Retrieve contacts",
  CONTACTS_WRITE: "Update contacts (DND, tags)",
  SEND_EMAIL: "Send email via CRM",
  CREATE_TASK: "Create CRM tasks",
  CREATE_OPPORTUNITY: "Create CRM opportunities",
  WEBHOOK_INBOUND: "Receive conversation webhooks",
};

export interface CrmProvider {
  readonly kind: "MOCK" | "LIVE";
  capabilities(): Record<Capability, CapabilityStatus>;
  testConnection(): Promise<{ accountName: string; locationId: string }>;
  listContacts(cursor?: string | null): Promise<{ contacts: CrmContact[]; nextCursor: string | null }>;
  updateContact(externalId: string, patch: { dnd?: boolean; tags?: string[] }): Promise<void>;
  sendEmail(input: { externalContactId: string; subject: string; body: string; idempotencyKey: string }): Promise<{ providerMessageId: string }>;
  createTask(input: { externalContactId: string; title: string; body: string; dueAt: Date | null }): Promise<{ externalId: string }>;
  createOpportunity(input: { externalContactId: string; name: string; type: string }): Promise<{ externalId: string }>;
}
