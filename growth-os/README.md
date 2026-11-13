# Realtor Growth OS — Module 01: AI Relationship Manager

An AI relationship manager for a real estate agent's **past clients and sphere of
influence**. It handles the routine nurture work: twice-monthly newsletters,
seasonal outreach, birthday and home-anniversary greetings, reply triage and the
daily action queue. The agent keeps control of every message and every personal
conversation.

> *Build relationships first. Real estate opportunities follow.*

This folder is a standalone Next.js app. The marketing website at the repository
root is a separate project and is unaffected by it.

---

## Quick start (Demo Mode — no credentials needed)

```bash
cd growth-os
npm install          # also generates the Prisma client
npm run setup        # creates the SQLite DB and seeds the fictional demo workspace
npm run dev          # http://localhost:3100
```

Reset the demo at any time with either:

```bash
npm run demo:reset
```

or **Settings → Reset demo data**.

Demo Mode guarantees:

- **No real email, SMS or other outbound message is ever sent.** Delivery is recorded
  as *simulated* and labelled that way everywhere.
- All contacts are fictional. They use `example.com/.net/.org` addresses and phone
  numbers in the reserved 555-01xx range.
- Demo sign-in is **not production authentication**. A banner says so on every page.

## Suggested walkthrough (the 12-step realtor flow)

1. **Dashboard:** live metrics and what the AI Relationship Manager did.
2. **Contacts:** database health: consent badges, tiers, tabs for Past Clients and Sphere.
3. **Contacts → Import CSV:** download the template, upload it, review the validation,
   duplicates and conflicts, then import.
4. **Contacts filters:** segment by type, tier, consent, tag or upcoming milestone.
5. **Campaigns → Milestones:** upcoming birthdays and anniversaries, plus messages
   awaiting approval.
6. **Campaigns → Newsletters → Generate draft:** AI writes it. No invented statistics.
7. **Edit and Approve** the newsletter. The live preview uses real merge tags.
8. Read the **scheduling preview / recipients table**. Every postponement, skip and
   suppression has a reason (for example, *"Postponed … birthday on Nov 18"*).
9. **Replies:** classified fictional replies. Use **Simulate a reply** to add more.
10. **Opportunities:** the AI-flagged referral, marked *potential* until you confirm it.
11. **Action Queue:** open a follow-up task to see why it was recommended, the reply
    and a suggested response.
12. **Analytics:** engagement, volume and suppression counts. Provider-only metrics
    show as *Unavailable*.

To watch scheduled messages "deliver", use **Automation → Simulate time**. It
processes jobs as if it were a later date. Delivery is still simulated.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3100 |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest suite (uses a throwaway `test.db`) |
| `npm run setup` | Create schema and seed the demo |
| `npm run demo:reset` | Recreate the demo workspace (only deletes the workspace flagged `isDemo`) |
| `npm run jobs:process` | Process due automation jobs once. Add `-- --at <ISO>` to simulate a later time |
| `npm run jobs:plan` | Run the daily relationship review for every workspace, then process jobs |

## Environment variables

Everything is optional for Demo Mode. See [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file (`file:./dev.db`) |
| `APP_MODE` | `demo` (default) or `live`. Live sending also needs every gate in `docs/automation-rules.md` |
| `AUTH_MODE` | `demo` (default). Production auth is not implemented yet — see `docs/deployment.md` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Turns on OpenAI structured outputs. Without a key, deterministic mock AI is used |
| `CREDENTIALS_ENCRYPTION_KEY` | 32-byte key for AES-256-GCM encryption of CRM tokens |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` (required in production) |
| `GHL_WEBHOOK_PUBLIC_KEY`, `GHL_WEBHOOK_SIGNATURE_HEADER` | HighLevel webhook signature verification |

## What's implemented vs. what needs credentials

**Working without any credentials:**

- **Contacts:** CRUD, search, filters, bulk tag and archive with confirmation, and CSV
  import with validation, preview, dedupe and conflict reporting.
- **Consent:** append-only consent history, per-channel and per-purpose permissions,
  unsubscribe, do-not-contact, preferences.
- **Milestones:** birthdays (no year needed, with a Feb 29 rule), home anniversaries
  from verified closing dates, relationship and custom milestones.
- **Campaigns:** newsletters (AI drafts, editor, approval, scheduling, pause, cancel,
  test send simulated) and four configurable seasonal campaigns with a market holiday
  calendar.
- **Scheduling:** a deterministic engine covering milestone priority, the ±5-day quiet
  window, seasonal replacement, the monthly cap, send windows and weekdays, time zones,
  and idempotent duplicate prevention. Every decision is explained in the UI.
- **Automation:** a durable job queue with idempotency keys, retries with backoff,
  pause/cancel/reschedule, stale-lock recovery and an audit trail.
- **AI (mock):** newsletter drafts, greetings, reply classification, grounded insights
  with evidence, and the ranked action queue.
- **Mock HighLevel adapter:** connect, idempotent contact sync with mapping, DND
  respected, and simulated task/opportunity pushes.
- **Compliance:** CAN-SPAM footer and readiness checks, immediate global pause,
  live-send gates, and SMS locked pending a legal review.
- **Reporting:** dashboard, analytics with filters, audit log.

**Needs credentials or account authorization:**

- **OpenAI:** set `OPENAI_API_KEY`. Outputs are validated and fall back to the
  deterministic drafts if invalid.
- **HighLevel live:** contact reads are implemented against the documented
  `GET /contacts/`. Sending, contact updates, tasks, opportunities and webhook signature
  details are **disabled until verified** against current official docs. See
  `docs/highlevel-integration.md`.
- **Real email delivery:** no live sender is enabled in this build, by design.
- **Production authentication and multi-user onboarding:** not implemented. See
  `docs/deployment.md`.

## Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/database-schema.md](docs/database-schema.md)
- [docs/automation-rules.md](docs/automation-rules.md)
- [docs/highlevel-integration.md](docs/highlevel-integration.md)
- [docs/deployment.md](docs/deployment.md)
