/**
 * Mock HighLevel adapter for Demo Mode. Deterministic fictional data; it never
 * contacts any external service. Writes are recorded in-memory only.
 */
import type { Capability, CapabilityStatus, CrmContact, CrmProvider } from "./types";

// Fictional records. Several share emails with the seeded demo contacts so the
// sync can demonstrate matching, mapping and conflict reporting.
export const MOCK_GHL_CONTACTS: CrmContact[] = [
  { externalId: "ghl_mock_001", firstName: "Elena", lastName: "Marquez", email: "elena.marquez@example.com", phone: "+16025550101", tags: ["past-client"], dateOfBirth: null, dnd: false },
  { externalId: "ghl_mock_002", firstName: "Marcus", lastName: "Bell", email: "marcus.bell@example.net", phone: "+16025550102", tags: ["sphere"], dateOfBirth: null, dnd: false },
  { externalId: "ghl_mock_003", firstName: "Priya", lastName: "Natarajan", email: "priya.natarajan@example.com", phone: "+16025550103", tags: ["vip"], dateOfBirth: null, dnd: false },
  { externalId: "ghl_mock_004", firstName: "Owen", lastName: "Fitzgerald", email: "owen.fitzgerald@example.org", phone: "+16025550104", tags: [], dateOfBirth: null, dnd: true },
  { externalId: "ghl_mock_101", firstName: "Harper", lastName: "Quinlan", email: "harper.quinlan@example.com", phone: "+14805550161", tags: ["open-house-2025"], dateOfBirth: "1988-04-12", dnd: false },
  { externalId: "ghl_mock_102", firstName: "Desmond", lastName: "Achebe", email: "desmond.achebe@example.net", phone: "+14805550162", tags: ["neighbor"], dateOfBirth: null, dnd: false },
  { externalId: "ghl_mock_103", firstName: "Lucia", lastName: "Ferraro", email: "lucia.ferraro@example.org", phone: "+16235550163", tags: [], dateOfBirth: null, dnd: false },
  { externalId: "ghl_mock_104", firstName: "Trent", lastName: "Okafor", email: null, phone: "+16235550164", tags: ["gym"], dateOfBirth: null, dnd: false },
];

const PAGE = 5;

export class MockCrmProvider implements CrmProvider {
  readonly kind = "MOCK" as const;
  readonly writes: { op: string; payload: unknown }[] = [];

  capabilities(): Record<Capability, CapabilityStatus> {
    const sim = (note: string): CapabilityStatus => ({ state: "SIMULATED", note });
    return {
      CONTACTS_READ: sim("Reads a fixed set of fictional contacts."),
      CONTACTS_WRITE: sim("Recorded locally; nothing leaves the app."),
      SEND_EMAIL: sim("Demo Mode never sends. Messages are marked as simulated."),
      CREATE_TASK: sim("Recorded locally with a mock ID."),
      CREATE_OPPORTUNITY: sim("Recorded locally with a mock ID."),
      WEBHOOK_INBOUND: sim("Use “Simulate reply” in Replies to inject fictional inbound messages."),
    };
  }

  async testConnection() {
    return { accountName: "KM Rojas Group — Demo Sub-account (mock)", locationId: "mock-location-001" };
  }

  async listContacts(cursor?: string | null) {
    const start = cursor ? Number(cursor) : 0;
    const contacts = MOCK_GHL_CONTACTS.slice(start, start + PAGE);
    const next = start + PAGE < MOCK_GHL_CONTACTS.length ? String(start + PAGE) : null;
    return { contacts, nextCursor: next };
  }

  async updateContact(externalId: string, patch: { dnd?: boolean; tags?: string[] }) {
    this.writes.push({ op: "updateContact", payload: { externalId, patch } });
  }

  async sendEmail(): Promise<{ providerMessageId: string }> {
    throw new Error("The mock CRM adapter never sends email. Delivery in Demo Mode is simulated by the delivery service.");
  }

  async createTask(input: { externalContactId: string; title: string }) {
    this.writes.push({ op: "createTask", payload: input });
    return { externalId: `mock_task_${input.externalContactId}_${this.writes.length}` };
  }

  async createOpportunity(input: { externalContactId: string; name: string; type: string }) {
    this.writes.push({ op: "createOpportunity", payload: input });
    return { externalId: `mock_opp_${input.externalContactId}_${this.writes.length}` };
  }
}
