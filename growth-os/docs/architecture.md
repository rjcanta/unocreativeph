# Architecture

## Layers

```
src/
  app/                Next.js App Router pages (server components) + API routes
  actions/            Server actions — thin wrappers: resolve session → call service → revalidate
  components/         UI (shadcn-style primitives in components/ui, client widgets)
  lib/
    domain/           PURE business rules — no I/O, fully unit-tested
      dates.ts          time-zone calendar math, leap-day handling, occurrences
      eligibility.ts    consent / suppression decisions
      scheduling.ts     conflict resolution, caps, send windows (explainable decisions)
      dedupe.ts         contact matching
      csv.ts            CSV parsing, header mapping, row validation
      segmentation.ts   recipient segments
      ranking.ts        action-queue priority
      render.ts         merge tags, CAN-SPAM footer
      calendar.ts       market holidays, seasonal default dates
      settings.ts       workspace settings schemas (brand voice, compliance, rules)
    ai/               AI provider abstraction (OpenAI + deterministic mock), schemas, grounding guards
    crm/              CRM provider contract, mock HighLevel adapter, live HighLevel adapter, crypto
    server/           Services (persistence + orchestration), all tenant-scoped
      context.ts        session → Ctx {workspaceId, userId}; demo auth gate
      contacts.ts, campaigns.ts, messaging.ts, delivery.ts, replies.ts,
      insights.ts, tasks.ts, planner.ts, integrations.ts, analytics.ts, dashboard.ts
      jobs-queue.ts     durable enqueue with idempotency
      jobs-runner.ts    job processor + handlers registry
    demo/seed.ts      fictional demo workspace
  generated/prisma    generated Prisma client (not committed)
prisma/schema.prisma
scripts/              seed, job processing, planner CLIs
tests/                unit (domain/AI/CSV) + integration (SQLite) tests
```

## Principles

- **AI drafts; rules decide.** Eligibility, scheduling, frequency caps, suppression and
  delivery are deterministic code. AI only writes drafts, classifies replies and
  summarizes — and every output is validated with zod.
- **Preparing ≠ sending.** Messages are created as `PENDING_APPROVAL`/`SCHEDULED` rows.
  Only the `CAMPAIGN_DUE` job can deliver, and it re-checks every gate at send time.
- **Tenant isolation on the server.** The workspace comes from the server-side session,
  never from request parameters. Every service query filters by `ctx.workspaceId`;
  integration tests assert cross-tenant reads and writes fail.
- **Explainability.** Scheduling decisions, task rankings and insights all carry the
  reasons/evidence shown in the UI.
- **Honest integrations.** Unverified or credential-dependent operations throw
  `CapabilityNotEnabledError`; they never return fake success.

## Request flow

```
Browser form ─▶ server action ─▶ runAction(): getSession() → service(ctx, …)
                                   │  domain errors → friendly message
                                   └▶ processDueJobs(workspace) (inline, bounded) → revalidatePath
Scheduler ─▶ /api/cron/process-jobs (every 5–15 min) and /api/cron/daily (once a day)
HighLevel ─▶ /api/webhooks/highlevel (signature-verified) → ingestInboundReply → job
```

Inline job processing after actions gives instant feedback; the scheduler is still the
source of truth for time-based work (milestone prep, due deliveries, retries).

## AI provider

`getAiProvider()` returns `OpenAiProvider` when `OPENAI_API_KEY` is set, otherwise
`MockAiProvider`. OpenAI calls use Chat Completions with strict JSON-schema structured
outputs; responses are re-validated with zod and then:

- newsletters are rejected if they contain statistics not present in agent-supplied
  verified market data (`findUnverifiedStatistics`),
- reply classifications are overridden to `OPT_OUT` whenever deterministic opt-out
  language is detected,
- on any failure the deterministic output is used and a warning is surfaced.

## Future modules

The schema and service boundaries are shared infrastructure for later modules (lead
database builder, outreach engine, qualification, referral partners, appointment
setting, pipeline intelligence, multi-agent onboarding). Workspaces, users, contacts,
consent, jobs, integrations and audit logs are module-agnostic; new modules add their
own services and job types to the handlers registry.
