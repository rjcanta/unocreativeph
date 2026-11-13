# HighLevel (GoHighLevel) integration

## Status at a glance

| Capability | Mock adapter (Demo) | Live adapter |
| --- | --- | --- |
| Connect / test connection | Simulated | **Implemented** — Private Integration Token, `GET /contacts/?locationId=…&limit=1` |
| Retrieve contacts | Simulated (8 fictional) | **Implemented** — `GET /contacts/` (pagination parameter needs live verification) |
| Map contacts / sync status | Implemented (shared) | Implemented (shared) |
| Respect CRM DND inbound | Implemented | Implemented |
| Update contact (DND/tags) | Simulated | **Disabled — not verified** |
| Send email via Conversations | Never sends | **Disabled — not verified** |
| Create tasks / opportunities | Simulated with mock IDs | **Disabled — not verified** |
| Inbound conversation webhooks | Use "Simulate a reply" | Endpoint implemented; **requires signature config** |

Disabled operations throw `CapabilityNotEnabledError` and are logged as `SKIPPED` /
`FAILED` in the sync log — they never report success.

## What was verified

The official docs host (`marketplace.gohighlevel.com`) was not reachable from the build
environment, so only facts confirmed by the official documentation index were used:

- API base URL `https://services.leadconnectorhq.com`
- `Authorization: Bearer <token>` and a `Version: 2021-07-28` header
- Private Integration Tokens are created per sub-account in **Settings → Private
  Integrations** and are limited to the scopes selected
- `GET /contacts/` with `locationId` returns contacts (`contacts.readonly` scope)
- Published API versions include v3 (latest), 2023-02-21, 2021-07-28, 2021-04-15;
  endpoints from different versions must not be mixed

## Enabling a live connection

1. Set `APP_MODE=live` and a 32-byte `CREDENTIALS_ENCRYPTION_KEY`.
2. Use a **non-demo workspace** (the demo workspace refuses real CRM connections).
   Create one with `npm run workspace:create -- --name … --slug … --owner … --email …`
   and set `WORKSPACE_SLUG` to its slug (local only — demo authentication still applies).
3. In HighLevel, create a Private Integration Token for the sub-account with
   `contacts.readonly`. Enter it plus the Location ID on **Integrations**.
4. Click **Test & connect**, then **Sync contacts now**. Sync is idempotent: mappings
   are keyed by external ID and a content hash. Imported contacts get **no assumed
   consent** and unverified birthdays.

## Verification checklist before enabling writes

For each item, confirm against the current official docs (and your plan/scopes), add the
endpoint to `src/lib/crm/highlevel.ts`, flip its capability to `AVAILABLE`, and add a
contract test with recorded fixtures:

- [ ] Contacts pagination parameters (`startAfterId` / `startAfter` vs. `POST /contacts/search`) and rate limits
- [ ] Contact update endpoint and the DND field shape (per-channel DND)
- [ ] Conversations send-message endpoint for **Email**, required scopes, sender identity,
      and whether HighLevel appends its own unsubscribe handling
- [ ] Contact tasks endpoint
- [ ] Opportunities endpoint, pipeline and stage mapping
- [ ] Webhook event schema for inbound messages (field names used: `type`,
      `locationId`, `contactId`, `messageId`, `body`, `messageType`, `direction`)
- [ ] Webhook signature header name and public key / algorithm → set
      `GHL_WEBHOOK_SIGNATURE_HEADER` and `GHL_WEBHOOK_PUBLIC_KEY`
- [ ] Whether to migrate to v3 endpoints
- [ ] OAuth 2.0 marketplace app flow for multi-location SaaS customers (PITs are bound to
      one sub-account)

## Webhooks

`POST /api/webhooks/highlevel`:

- returns 503 until `GHL_WEBHOOK_PUBLIC_KEY` is set; 401 on a bad signature;
- ignores non-inbound events and unknown locations/contacts (202);
- deduplicates by `messageId` via the `(workspaceId, source, externalId)` unique index;
- routes the reply into the same `INBOUND_REPLY_RECEIVED` pipeline as simulated replies.

## Security

- Tokens are encrypted at rest (AES-256-GCM) and never sent to the browser.
- Disconnect deletes stored credentials; contact mappings are kept to avoid duplicates
  on reconnect.
