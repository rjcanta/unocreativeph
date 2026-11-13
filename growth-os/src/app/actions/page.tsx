import { CheckCircle2, ListChecks } from "lucide-react";
import Link from "next/link";
import { createTaskAction, snoozeTaskAction, taskStatusAction } from "@/actions/work";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { PriorityDot, TierBadge, TypeBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader, Reasons, Tabs } from "@/components/ui/misc";
import { TASK_TYPES } from "@/lib/domain/types";
import { prisma } from "@/lib/server/db";
import { parseJsonArray } from "@/lib/server/json";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { listTasks } from "@/lib/server/tasks";
import { formatDate, humanize } from "@/lib/utils";

export const metadata = { title: "Action Queue" };

export default async function ActionsPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const status = sp(q.status) || "OPEN";
  const type = sp(q.type);
  const [tasks, counts, contacts] = await Promise.all([
    listTasks(s, { status, type: type || undefined }),
    prisma.agentTask.groupBy({ by: ["status"], where: { workspaceId: s.workspaceId }, _count: true }),
    prisma.contact.findMany({ where: { workspaceId: s.workspaceId, deletedAt: null }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
  ]);
  const count = (st: string) => counts.find((c) => c.status === st)?._count ?? 0;

  return (
    <>
      <PageHeader title="Action Queue" description="Your daily relationship to-do list. Each action shows why it was recommended — urgency, what the person told you, and how important the relationship is." />
      <Tabs
        current={status}
        items={[
          { key: "OPEN", label: "Open", href: "/actions", count: count("OPEN") },
          { key: "DONE", label: "Done", href: "/actions?status=DONE", count: count("DONE") },
          { key: "DISMISSED", label: "Dismissed", href: "/actions?status=DISMISSED", count: count("DISMISSED") },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <form className="mb-3 flex flex-wrap items-center gap-2">
            {status !== "OPEN" ? <input type="hidden" name="status" value={status} /> : null}
            <Select name="type" defaultValue={type} className="w-auto">
              <option value="">All action types</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </Select>
            <button className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-subtle">Filter</button>
            {type ? (
              <Link href={`/actions${status !== "OPEN" ? `?status=${status}` : ""}`} className="text-sm text-ink-muted hover:underline">
                Clear
              </Link>
            ) : null}
          </form>
          <Card>
            {tasks.length ? (
              <ul className="divide-y divide-line">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="pt-1.5">
                        <PriorityDot priority={t.priority} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/actions/${t.id}`} className="text-sm font-medium text-ink hover:underline">
                          {t.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge>{humanize(t.type)}</Badge>
                          {t.contact ? (
                            <>
                              <TierBadge tier={t.contact.tier} />
                              <TypeBadge type={t.contact.contactType} />
                            </>
                          ) : null}
                          {t.dueAt ? <span className="text-[12px] text-ink-faint">Due {formatDate(t.dueAt, s.timezone, { month: "short", day: "numeric" })}</span> : null}
                          <span className="tabular text-[12px] text-ink-faint">· priority {t.priority}</span>
                        </div>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[12.5px] text-sage-700">Why this was recommended</summary>
                          <Reasons className="mt-1.5" reasons={parseJsonArray<string>(t.reasonsJson)} />
                        </details>
                      </div>
                    </div>
                    {t.status === "OPEN" ? (
                      <div className="flex shrink-0 flex-wrap gap-1.5 pl-5 sm:pl-0">
                        <ActionButton action={taskStatusAction} fields={{ id: t.id, status: "DONE" }} variant="primary" showResult={false}>
                          <CheckCircle2 /> Done
                        </ActionButton>
                        <ActionButton action={snoozeTaskAction} fields={{ id: t.id, days: "3" }} showResult={false}>
                          Snooze 3d
                        </ActionButton>
                        <ActionButton action={taskStatusAction} fields={{ id: t.id, status: "DISMISSED" }} variant="ghost" showResult={false}>
                          Dismiss
                        </ActionButton>
                      </div>
                    ) : (
                      <ActionButton action={taskStatusAction} fields={{ id: t.id, status: "OPEN" }} variant="ghost" showResult={false}>
                        Reopen
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<ListChecks />} title={status === "OPEN" ? "No open actions" : "Nothing here yet"} description="The daily review adds actions as milestones approach, replies arrive, and relationships need a personal touch." />
            )}
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader title="Add a task" description="Anything you want to remember to do personally." />
          <CardBody>
            <ActionForm action={createTaskAction} resetOnSuccess className="space-y-3">
              <Field label="What needs doing?">
                <Input name="title" required placeholder="Drop off a housewarming gift" />
              </Field>
              <Field label="Contact" hint="optional">
                <Select name="contactId" defaultValue="">
                  <option value="">No contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Type">
                  <Select name="type" defaultValue="FOLLOW_UP">
                    {["FOLLOW_UP", "CALL", "PERSONAL_MESSAGE", "GIFT", "RECONNECT"].map((t) => (
                      <option key={t} value={t}>
                        {humanize(t)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Due">
                  <Input type="date" name="dueDate" />
                </Field>
              </div>
              <SubmitButton className="w-full">Add task</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
