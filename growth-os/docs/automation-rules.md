# Automation & scheduling rules

All rules are deterministic code in `src/lib/domain/` and covered by tests in `tests/`.
Defaults are editable in **Settings → Scheduling rules** (per workspace).

## Events and jobs

| Event | Handler |
| --- | --- |
| `CONTACT_CREATED` / `CONTACT_UPDATED` / `CONTACT_IMPORTED` | Sync milestones, regenerate insights, queue upcoming milestones |
| `BIRTHDAY_UPCOMING` / `HOME_ANNIVERSARY_UPCOMING` / `MILESTONE_UPCOMING` | Prepare milestone outreach (below) |
| `CAMPAIGN_APPROVED` / `CAMPAIGN_SCHEDULED` | Materialize per-contact messages once approved **and** dated |
| `CAMPAIGN_DUE` | Deliver one prepared message after final checks |
| `INBOUND_REPLY_RECEIVED` | Classify, summarize, honor opt-out, create opportunities and tasks |
| `OPPORTUNITY_DETECTED` | Follow-up task, insight, CRM push if supported |
| `CONTACT_UNSUBSCRIBED` | Propagate opt-out to CRM if supported |

Reliability: idempotency keys unique per workspace; claim via optimistic lock;
exponential backoff (2, 4, 8… min, max 60); non-retryable errors (policy blocks,
missing capability, validation) fail immediately with the reason; stale `RUNNING` jobs
recover after 10 minutes; jobs can be paused, resumed, rescheduled, cancelled, retried.

The **daily review** (`runDailyPlanner`, `/api/cron/daily`) queues milestones within the
lookahead (default 14 days), regenerates insights, drafts upcoming newsletters ~3
weeks ahead, creates approval tasks, and re-ranks the action queue.

## Eligibility (who may receive what)

Evaluated when scheduling **and again at send time**:

1. Do-not-contact → nothing, including tasks.
2. Unsubscribed → no email of any kind.
3. Missing email → no email.
4. Preferences: newsletters / seasonal / milestones toggles; "milestones only".
5. Consent (latest record wins):
   - Newsletters & seasonal require **email marketing consent = GRANTED**.
   - Milestone greetings require marketing **or** relationship consent.
   - Past-client or sphere status is never treated as consent.
6. SMS is blocked until the workspace records a TCPA / state-law review date (SMS
   delivery itself is not implemented in this module).

## Scheduling decisions (per contact)

Order of precedence:

1. **Duplicate prevention** — the same idempotency key is never prepared twice.
2. **Eligibility** (above) → `SUPPRESS` with the reason.
3. **Milestones take priority** and keep their date (sent at 9:00 local by default).
4. **Seasonal replaces newsletter** — a routine newsletter within ±10 days of a seasonal
   campaign the contact receives is `SKIP`ped.
5. **Milestone quiet window** — routine marketing within ±5 days of a milestone is
   `POSTPONE`d to the first clear allowed day in the same month, or `SKIP`ped if none
   (or always skipped if the rule is set to *skip*). Verified upcoming milestones count
   even before their greeting is drafted, and newsletters already scheduled are
   re-planned when a milestone message is prepared later.
6. **Monthly cap** — at most 2 routine messages (newsletters + seasonal) per calendar
   month (1 for "reduced frequency" contacts) → `SKIP`.
7. **Send days & window** — marketing only on allowed weekdays (Mon–Fri default),
   between 9:00 and 17:00 in the workspace IANA time zone (default `America/Phoenix`).

Every decision stores human-readable reasons (shown on the campaign page and message page).

## Milestones

- Birthdays need month and day only. Feb 29 is observed on Feb 28 (or Mar 1, configurable)
  in non-leap years.
- Home anniversaries use the closing date; the ordinal (e.g. "5th") comes from the
  closing year.
- **Unverified dates never produce automated messages** — a verification task is created.
- Standard contact with consent → personalized email prepared for approval.
- VIP → email (if consent) **plus** a call / gift task.
- No consent → personal-touch task instead of email.

## Approvals

- Campaigns: agent approval required; approval pins `approvedContentVersion`. Any later
  edit to content, audience or date resets approval and cancels unsent messages.
  Approval is refused while content contains unknown merge tags or unverified statistics.
  AI and automations cannot approve (`ctx.userId` required).
- Milestone messages: approval required by default (workspace setting).

## Delivery gates (send time)

`deliverMessage` re-checks: scheduled & due, workspace not paused, campaign not
paused/cancelled, content still approved, contact not archived and still eligible,
not already delivered, inside the sending window. Then:

- **Live** only if *all* hold: `APP_MODE=live`, non-demo workspace, workspace live
  sending on, live CRM connection with live send enabled, verified `SEND_EMAIL`
  capability, and complete CAN-SPAM settings (physical address, sender name/email,
  opt-out text).
- Otherwise **simulated**: recorded as `SIMULATED` with a `SIMULATED_SEND` event. Nothing
  leaves the app.

## Reply intelligence

Classes: general friendly, potential buyer/seller/investor, referral, future
opportunity, appointment request, negative, opt-out, requires attention. Opt-out
language is always honored deterministically. Opportunities are created as `POTENTIAL`
with the stated timeframe and verbatim evidence; only the agent can confirm them.
Suggested replies are drafts; nothing is sent automatically.
