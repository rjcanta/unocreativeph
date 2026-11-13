# Database schema

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). SQLite locally;
PostgreSQL (Supabase) in production — see `deployment.md`.

Conventions: every tenant-owned table has `workspaceId` (cascade on workspace delete),
`createdAt`/`updatedAt`; "enum" columns are strings validated by
`src/lib/domain/types.ts`; JSON is stored as text and validated with zod.

| Table (model) | Purpose | Key constraints |
| --- | --- | --- |
| `Workspace` | Tenant. Time zone (IANA), market, `isDemo`, `sendingPaused`, `liveSendingEnabled`, brand voice / compliance / scheduling JSON | `slug` unique |
| `User` | Agent / assistant / owner | `(workspaceId, email)` unique |
| `Contact` | Past client or sphere contact; birthday (month/day, optional year, verified flag), closing date (verified flag), DNC, unsubscribe, opportunity status, assigned agent, soft delete | `(workspaceId, emailNormalized)` unique; indexes on type/tier/phone |
| `ContactRelationship` | Spouse, family, referred-by… between contacts | `(contactId, relatedContactId, type)` unique |
| `ContactPreference` | Category opt-outs, frequency (normal / reduced / milestones only) | `contactId` unique |
| `ContactConsentRecord` | **Append-only** consent history per channel & purpose with source, evidence, timestamp, actor | latest record wins |
| `ContactNote` | Notes, call logs, meetings (the only personal context AI may cite) | soft delete |
| `ContactMilestone` | Birthday / home anniversary / relationship / custom; month, day, year, verified | `(contactId, type, label)` unique |
| `Tag`, `ContactTag` | Tagging for segmentation and bulk actions | `(workspaceId, name)` unique |
| `CampaignTemplate` | Newsletter, seasonal and milestone templates | `(workspaceId, key)` unique |
| `Campaign` | Newsletter or seasonal campaign; content, segment, status, `contentVersion` vs `approvedContentVersion`, verified market data | |
| `CampaignRecipient` | Per-contact scheduling decision with reasons | `(campaignId, contactId)` unique |
| `ScheduledMessage` | One prepared message for one contact | **`idempotencyKey` unique** (`ws:campaign:<id>:<contact>` or `ws:milestone:<id>:<YYYY-MM-DD>`) |
| `CommunicationEvent` | Outbound sends (simulated or live), calls, inbound replies + AI classification and triage | `(workspaceId, source, externalId)` unique — event-source idempotency |
| `AiInsight` | Grounded insights with evidence JSON | `(workspaceId, dedupeKey)` unique |
| `AgentTask` | Action queue items with ranked priority, reasons, intent | `(workspaceId, dedupeKey)` unique |
| `Opportunity` | Detected buyer/seller/investor/referral/future interest; starts `POTENTIAL` | `(workspaceId, sourceEventId, type)` unique |
| `AutomationJob` | Durable jobs: type, payload, status, runAt, attempts, lastError, lock | **`(workspaceId, idempotencyKey)` unique** |
| `Integration` | CRM connection: mode (MOCK/LIVE), status, encrypted credentials, live-send flag | `(workspaceId, provider)` unique |
| `IntegrationMapping` | Internal contact ↔ CRM ID, sync hash, sync status | `(integrationId, externalId)` and `(integrationId, contactId)` unique |
| `IntegrationSyncLog` | Sync / push / webhook outcomes | |
| `AuditLog` | Who/what (user, system, AI, integration) did what, status transitions | indexed by workspace + time |

## Sensitive data

- CRM tokens are encrypted with AES-256-GCM (`CREDENTIALS_ENCRYPTION_KEY`) and never
  serialized to the browser (`getIntegrationView` omits them).
- Birth year is optional and never required for greetings.
- Production should add database-level row security (Supabase RLS) as defense in depth.
