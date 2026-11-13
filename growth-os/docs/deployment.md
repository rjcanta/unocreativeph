# Deployment

## Local

```bash
cd growth-os && npm install && npm run setup && npm run dev
```

## Production readiness — what must change first

1. **Authentication.** `AUTH_MODE=demo` signs in a fixed demo user. Replace
   `getSession()` in `src/lib/server/context.ts` with real auth (Supabase Auth or
   Auth.js), resolving `workspaceId` from the user's membership. Keep the rule that the
   workspace always comes from the server-side session.
2. **Database.** SQLite is for local development only (serverless hosts have no
   persistent disk). Move to PostgreSQL — see below.
3. **Scheduler.** Call `/api/cron/process-jobs` every 5–15 minutes and
   `/api/cron/daily` once a day with `Authorization: Bearer $CRON_SECRET`.
4. **Secrets.** Set `CRON_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, and optionally
   `OPENAI_API_KEY`.
5. **Live sending** stays off until a verified sending capability exists and every gate
   in `automation-rules.md` passes. Complete the CAN-SPAM settings first; have SMS
   workflows reviewed for TCPA and state law before enabling SMS.

## Migrating to Supabase PostgreSQL

1. In `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`.
2. Install the Postgres driver adapter and swap it in `src/lib/server/db.ts`:
   ```bash
   npm install @prisma/adapter-pg pg
   ```
   ```ts
   import { PrismaPg } from "@prisma/adapter-pg";
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
   ```
3. Set `DATABASE_URL` to the Supabase connection string (pooled URL for the app, direct
   URL for migrations).
4. Create a baseline migration and deploy:
   ```bash
   npx prisma migrate dev --name init
   npx prisma migrate deploy
   ```
5. Optional hardening: enable Row Level Security keyed on `workspaceId`, convert
   string "enum" columns to native enums, and JSON-text columns to `jsonb`.

String enums and JSON-as-text were chosen so this migration is a provider swap, not a
redesign.

## Vercel

- Create a **separate Vercel project** with Root Directory `growth-os` (the repository
  root is the marketing site).
- Build command `npm run build`; install runs `prisma generate` via `postinstall`.
- Add a `vercel.json` in `growth-os/` for crons once on Postgres:
  ```json
  { "crons": [
      { "path": "/api/cron/process-jobs", "schedule": "*/10 * * * *" },
      { "path": "/api/cron/daily", "schedule": "0 13 * * *" }
  ] }
  ```
  Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
  `CRON_SECRET` is set.

## Other hosts

Any Node 20+ host works: `npm run build && npm start`, plus a system cron calling
`npm run jobs:process` (or the HTTP endpoints). With SQLite on a single persistent VM,
the app runs as-is for a single team.
