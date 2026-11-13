import { FlaskConical, Play, RefreshCw, Sparkles, Workflow } from "lucide-react";
import { jobControlAction, processJobsAction, runPlannerAction } from "@/actions/work";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { StatusBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, Notice, PageHeader, Tabs } from "@/components/ui/misc";
import { AUTOMATION_EVENTS } from "@/lib/domain/types";
import { prisma } from "@/lib/server/db";
import { listJobs } from "@/lib/server/jobs-runner";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { formatDateTime, humanize, timeAgo } from "@/lib/utils";

export const metadata = { title: "Automation" };

const EVENT_HELP: Record<string, string> = {
  CONTACT_CREATED: "Sync milestones, review the contact, queue upcoming milestones.",
  CONTACT_UPDATED: "Re-sync milestones and insights after edits.",
  CONTACT_IMPORTED: "Review imported contacts in bulk.",
  BIRTHDAY_UPCOMING: "Prepare a greeting (verified dates only), VIP call task, or personal-touch task.",
  HOME_ANNIVERSARY_UPCOMING: "Same as birthdays, using the verified closing date.",
  MILESTONE_UPCOMING: "Relationship anniversaries and agent-defined milestones.",
  CAMPAIGN_SCHEDULED: "Plan recipients for an approved campaign once it has a date.",
  CAMPAIGN_APPROVED: "Prepare per-contact messages using the scheduling rules.",
  CAMPAIGN_DUE: "Final eligibility checks, then deliver (simulated in Demo Mode).",
  INBOUND_REPLY_RECEIVED: "Classify, summarize, route, and honor opt-outs.",
  OPPORTUNITY_DETECTED: "Create a follow-up task, insight, and CRM record if supported.",
  CONTACT_UNSUBSCRIBED: "Propagate the opt-out to the CRM.",
};

export default async function AutomationPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const status = sp(q.status);
  const type = sp(q.type);
  const [jobs, counts] = await Promise.all([
    listJobs(s, { status: status || undefined, type: type || undefined, limit: 150 }),
    prisma.automationJob.groupBy({ by: ["status"], where: { workspaceId: s.workspaceId }, _count: true }),
  ]);
  const count = (st: string) => counts.find((c) => c.status === st)?._count ?? 0;
  const tomorrow = new Date(Date.now() + 86_400_000);
  const defaultSim = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <>
      <PageHeader
        title="Automation"
        description="Durable, retryable jobs with idempotency keys. Every job runs on the server — no browser needs to be open. In production a scheduler calls /api/cron/process-jobs."
        actions={
          <>
            <ActionButton action={runPlannerAction} size="md" pendingLabel="Reviewing…">
              <Sparkles /> Run daily review
            </ActionButton>
            <ActionButton action={processJobsAction} size="md" variant="primary" pendingLabel="Processing…">
              <Play /> Process due jobs
            </ActionButton>
          </>
        }
      />
      {count("FAILED") ? (
        <Notice tone="danger" className="mb-5" title={`${count("FAILED")} job${count("FAILED") === 1 ? "" : "s"} failed`}>
          Each failed job shows the error and can be retried once the cause is fixed.
        </Notice>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Tabs
            current={status || "ALL"}
            items={[
              { key: "ALL", label: "All", href: "/automation" },
              { key: "PENDING", label: "Pending", href: "/automation?status=PENDING", count: count("PENDING") },
              { key: "SUCCEEDED", label: "Succeeded", href: "/automation?status=SUCCEEDED", count: count("SUCCEEDED") },
              { key: "FAILED", label: "Failed", href: "/automation?status=FAILED", count: count("FAILED") },
              { key: "PAUSED", label: "Paused", href: "/automation?status=PAUSED", count: count("PAUSED") },
              { key: "CANCELLED", label: "Cancelled", href: "/automation?status=CANCELLED", count: count("CANCELLED") },
            ]}
          />
          <form className="mb-3 flex gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <Select name="type" defaultValue={type} className="w-auto">
              <option value="">All event types</option>
              {AUTOMATION_EVENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            <button className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-subtle">Filter</button>
          </form>
          <Card>
            {jobs.length ? (
              <ul className="divide-y divide-line">
                {jobs.map((j) => (
                  <li key={j.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-subtle px-1.5 py-0.5 text-[12px] text-ink">{j.type}</code>
                      <StatusBadge status={j.status} />
                      {j.attempts > 0 ? <span className="text-[12px] text-ink-faint">attempt {j.attempts}/{j.maxAttempts}</span> : null}
                      <span className="ml-auto text-[12px] text-ink-faint">{j.status === "PENDING" || j.status === "PAUSED" ? `runs ${formatDateTime(j.runAt, s.timezone)}` : `updated ${timeAgo(j.updatedAt)}`}</span>
                    </div>
                    <div className="mt-1 truncate text-[12px] text-ink-faint" title={j.idempotencyKey}>
                      key: {j.idempotencyKey}
                    </div>
                    {j.lastError ? <div className={`mt-1 text-[12.5px] ${j.status === "FAILED" ? "text-rose-600" : "text-ink-muted"}`}>{j.lastError}</div> : null}
                    {j.resultJson && j.status === "SUCCEEDED" ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[12px] text-sage-700">Result</summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-subtle p-2 text-[11.5px]">{JSON.stringify(JSON.parse(j.resultJson), null, 2)}</pre>
                      </details>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {j.status === "FAILED" || j.status === "CANCELLED" ? (
                        <ActionButton action={jobControlAction} fields={{ id: j.id, op: "retry" }} showResult>
                          <RefreshCw /> Retry
                        </ActionButton>
                      ) : null}
                      {j.status === "PENDING" ? (
                        <ActionButton action={jobControlAction} fields={{ id: j.id, op: "pause" }} showResult={false}>
                          Pause
                        </ActionButton>
                      ) : null}
                      {j.status === "PAUSED" ? (
                        <ActionButton action={jobControlAction} fields={{ id: j.id, op: "resume" }} showResult={false}>
                          Resume
                        </ActionButton>
                      ) : null}
                      {["PENDING", "PAUSED"].includes(j.status) ? (
                        <>
                          <details>
                            <summary className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-[13px] text-ink-muted hover:bg-subtle">Reschedule</summary>
                            <ActionForm action={jobControlAction} className="mt-1 flex gap-1.5">
                              <input type="hidden" name="id" value={j.id} />
                              <input type="hidden" name="op" value="reschedule" />
                              <Input type="datetime-local" name="runAt" required className="h-8 w-52" />
                              <SubmitButton size="sm">Save</SubmitButton>
                            </ActionForm>
                          </details>
                          <ActionButton action={jobControlAction} fields={{ id: j.id, op: "cancel" }} variant="ghost" confirm="Cancel this job? If it delivers a message, that message will not be sent by this job." confirmLabel="Cancel job" showResult={false}>
                            Cancel
                          </ActionButton>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Workflow />} title="No jobs" description="Jobs are created by contact changes, milestones, campaign approvals and replies." />
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {s.isDemo ? (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-clay-500" /> Simulate time</span>} description="Demo only. Process jobs as if it were a later moment — e.g. to watch scheduled messages deliver (simulated)." />
              <CardBody>
                <ActionForm action={processJobsAction} className="space-y-2">
                  <Input type="datetime-local" name="at" defaultValue={defaultSim} required />
                  <SubmitButton className="w-full" variant="secondary">
                    Process jobs as of this time
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Supported events" />
            <ul className="divide-y divide-line">
              {AUTOMATION_EVENTS.map((e) => (
                <li key={e} className="px-5 py-2.5">
                  <code className="text-[12px] text-ink">{e}</code>
                  <p className="mt-0.5 text-[12px] text-ink-muted">{EVENT_HELP[e]}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Reliability" />
            <CardBody className="space-y-1.5 text-[12.5px] text-ink-muted">
              <p>• Idempotency keys are unique per workspace — the same event never runs twice.</p>
              <p>• Message keys are unique per contact × campaign/milestone occurrence — no duplicate sends.</p>
              <p>• Failures retry with exponential backoff; policy blocks fail immediately with a reason.</p>
              <p>• Stale locks recover after 10 minutes.</p>
              <p>
                • Preparing ≠ sending: only <Badge>CAMPAIGN_DUE</Badge> delivers, after final checks.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
      <p className="mt-6 text-[12px] text-ink-faint">{humanize("all times shown in")} {s.timezone}.</p>
    </>
  );
}
