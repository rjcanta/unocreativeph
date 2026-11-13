import { FlaskConical, Inbox } from "lucide-react";
import Link from "next/link";
import { logReplyAction, simulateReplyAction, triageReplyAction } from "@/actions/work";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { ClassificationBadge, StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, KeyValue, PageHeader, Tabs } from "@/components/ui/misc";
import { REPLY_CLASSIFICATIONS, REPLY_CLASSIFICATION_LABEL } from "@/lib/domain/types";
import { prisma } from "@/lib/server/db";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { listReplies, parseClassification, SIMULATED_REPLIES } from "@/lib/server/replies";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Replies" };

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const triage = sp(q.triage);
  const classification = sp(q.classification);
  const [replies, counts, contacts] = await Promise.all([
    listReplies(s, { triage: triage || undefined, classification: classification || undefined }),
    prisma.communicationEvent.groupBy({ by: ["triageStatus"], where: { workspaceId: s.workspaceId, direction: "INBOUND" }, _count: true }),
    prisma.contact.findMany({ where: { workspaceId: s.workspaceId, deletedAt: null, doNotContact: false }, select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: "asc" } }),
  ]);
  const count = (t: string) => counts.find((c) => c.triageStatus === t)?._count ?? 0;

  return (
    <>
      <PageHeader title="Replies" description="Incoming replies are classified and summarized by AI. Classifications are suggestions — speculative intent is never treated as confirmed, and nothing is replied to automatically." />
      <Tabs
        current={triage || "ALL"}
        items={[
          { key: "ALL", label: "Inbox", href: "/inbox" },
          { key: "NEEDS_ATTENTION", label: "Needs attention", href: "/inbox?triage=NEEDS_ATTENTION", count: count("NEEDS_ATTENTION") },
          { key: "NEW", label: "Unreviewed", href: "/inbox?triage=NEW", count: count("NEW") },
          { key: "REVIEWED", label: "Reviewed", href: "/inbox?triage=REVIEWED", count: count("REVIEWED") },
          { key: "ARCHIVED", label: "Archived", href: "/inbox?triage=ARCHIVED", count: count("ARCHIVED") },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <form className="flex flex-wrap items-center gap-2">
            {triage ? <input type="hidden" name="triage" value={triage} /> : null}
            <Select name="classification" defaultValue={classification} className="w-auto">
              <option value="">All classifications</option>
              {REPLY_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {REPLY_CLASSIFICATION_LABEL[c]}
                </option>
              ))}
            </Select>
            <button className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-subtle">Filter</button>
          </form>
          {replies.length ? (
            replies.map((r) => {
              const c = parseClassification(r.classificationJson);
              return (
                <Card key={r.id} id={r.id} className="scroll-mt-20">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
                    <div className="min-w-0">
                      <Link href={`/contacts/${r.contact.id}`} className="text-[15px] font-semibold hover:underline">
                        {r.contact.firstName} {r.contact.lastName}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
                        <TypeBadge type={r.contact.contactType} />
                        <TierBadge tier={r.contact.tier} />
                        <span>{formatDateTime(r.occurredAt, s.timezone)}</span>
                        {["SIMULATION", "DEMO"].includes(r.source) ? <Badge tone="sand">Fictional demo reply</Badge> : <Badge>{humanize(r.source)}</Badge>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ClassificationBadge c={r.classification} />
                      {r.triageStatus ? <StatusBadge status={r.triageStatus} /> : null}
                    </div>
                  </div>
                  <CardBody className="space-y-4">
                    <blockquote className="rounded-lg border-l-2 border-sage-400 bg-subtle px-4 py-3 text-sm italic">{r.body}</blockquote>
                    {c ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <KeyValue
                          items={[
                            ["Summary", c.summary],
                            ["Timeframe", c.timeframe ?? "Not stated"],
                            ["Also detected", c.secondary.length ? c.secondary.map((x) => REPLY_CLASSIFICATION_LABEL[x]).join(", ") : "—"],
                            ["Confidence", `${Math.round(c.confidence * 100)}% · ${c.source === "AI_OPENAI" ? "OpenAI" : "demo rules model"}`],
                          ]}
                        />
                        <div className="space-y-3">
                          <div>
                            <div className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Recommended next step</div>
                            <p className="mt-1 text-sm">{c.recommendedAction}</p>
                          </div>
                          {r.opportunities.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {r.opportunities.map((o) => (
                                <Link key={o.id} href="/opportunities">
                                  <Badge tone="sand">
                                    {humanize(o.type)} opportunity · {humanize(o.status).toLowerCase()}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          ) : null}
                          {c.warnings.length ? <p className="text-[12px] text-amber-600">{c.warnings.join(" ")}</p> : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13px] text-ink-muted">Classification pending — it runs in the next automation cycle.</p>
                    )}
                    {c?.suggestedReply ? (
                      <details className="rounded-lg border border-line">
                        <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-sage-700">Suggested reply draft (copy & personalize — never auto-sent)</summary>
                        <div className="border-t border-line px-3 py-3">
                          <pre className="whitespace-pre-wrap font-sans text-sm">{c.suggestedReply}</pre>
                          <div className="mt-2">
                            <CopyButton text={c.suggestedReply} label="Copy draft" />
                          </div>
                        </div>
                      </details>
                    ) : null}
                    <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
                      {r.triageStatus !== "REVIEWED" ? (
                        <ActionButton action={triageReplyAction} fields={{ id: r.id, triage: "REVIEWED" }} variant="primary" showResult={false}>
                          Mark reviewed
                        </ActionButton>
                      ) : null}
                      {r.triageStatus !== "ARCHIVED" ? (
                        <ActionButton action={triageReplyAction} fields={{ id: r.id, triage: "ARCHIVED" }} showResult={false}>
                          Archive
                        </ActionButton>
                      ) : null}
                      {r.classification !== "OPT_OUT" ? (
                        <details className="w-full sm:w-auto">
                          <summary className="inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-[13px] text-ink-muted hover:bg-subtle">I replied personally…</summary>
                          <ActionForm action={logReplyAction} className="mt-2 space-y-2 sm:w-96">
                            <input type="hidden" name="id" value={r.id} />
                            <Textarea name="body" rows={3} placeholder="Paste what you sent (optional) — logged on the timeline" />
                            <SubmitButton size="sm">Log my reply</SubmitButton>
                          </ActionForm>
                        </details>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              );
            })
          ) : (
            <Card>
              <EmptyState icon={<Inbox />} title="No replies here" description="When a connected CRM delivers replies (or you simulate one in Demo Mode), they appear here classified and summarized." />
            </Card>
          )}
        </div>
        {s.isDemo ? (
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader title={<span className="flex items-center gap-2"><FlaskConical className="size-4 text-clay-500" /> Simulate a reply</span>} description="Demo Mode only. Injects a fictional inbound reply through the same pipeline a CRM webhook would use." />
            <CardBody>
              <ActionForm action={simulateReplyAction} resetOnSuccess className="space-y-3">
                <Field label="From contact">
                  <Select name="contactId" required>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Example reply">
                  <Select name="preset" defaultValue="seller">
                    {SIMULATED_REPLIES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}: “{r.text.slice(0, 48)}…”
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Or write your own" hint="optional">
                  <Input name="text" placeholder="Overrides the example" />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Classifying…">
                  Receive reply
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
