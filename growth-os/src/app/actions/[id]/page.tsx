import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { snoozeTaskAction, taskStatusAction } from "@/actions/work";
import { ActionButton } from "@/components/action-form";
import { ClassificationBadge, StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KeyValue, PageHeader, Reasons } from "@/components/ui/misc";
import { formatPhone } from "@/lib/domain/normalize";
import { prisma } from "@/lib/server/db";
import { parseJsonArray } from "@/lib/server/json";
import { orNotFound, session } from "@/lib/server/page";
import { parseClassification } from "@/lib/server/replies";
import { getTask } from "@/lib/server/tasks";
import { CopyButton } from "@/components/copy-button";
import { formatDate, formatDateTime, humanize, timeAgo } from "@/lib/utils";

export const metadata = { title: "Task" };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  const { id } = await params;
  const t = await orNotFound(getTask(s, id));
  const reply =
    t.sourceType === "REPLY" && t.sourceId
      ? await prisma.communicationEvent.findFirst({ where: { id: t.sourceId, workspaceId: s.workspaceId } })
      : t.sourceType === "OPPORTUNITY" && t.sourceId
        ? await prisma.opportunity.findFirst({ where: { id: t.sourceId, workspaceId: s.workspaceId }, include: { sourceEvent: true } }).then((o) => o?.sourceEvent ?? null)
        : null;
  const cls = reply ? parseClassification(reply.classificationJson) : null;
  const message = t.sourceType === "MESSAGE" && t.sourceId ? await prisma.scheduledMessage.findFirst({ where: { id: t.sourceId, workspaceId: s.workspaceId } }) : null;
  const campaign = t.sourceType === "CAMPAIGN" && t.sourceId ? await prisma.campaign.findFirst({ where: { id: t.sourceId, workspaceId: s.workspaceId } }) : null;

  return (
    <>
      <Link href="/actions" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Action queue
      </Link>
      <PageHeader
        title={t.title}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={t.status} /> <Badge>{humanize(t.type)}</Badge> <span>Priority {t.priority}</span>
            {t.dueAt ? <span>· due {formatDate(t.dueAt, s.timezone)}</span> : null}
          </span>
        }
        actions={
          t.status === "OPEN" ? (
            <>
              <ActionButton action={taskStatusAction} fields={{ id: t.id, status: "DONE" }} variant="primary" size="md">
                <CheckCircle2 /> Mark done
              </ActionButton>
              <ActionButton action={snoozeTaskAction} fields={{ id: t.id, days: "7" }} size="md">
                Snooze a week
              </ActionButton>
              <ActionButton action={taskStatusAction} fields={{ id: t.id, status: "DISMISSED" }} variant="ghost" size="md">
                Dismiss
              </ActionButton>
            </>
          ) : (
            <ActionButton action={taskStatusAction} fields={{ id: t.id, status: "OPEN" }} size="md">
              Reopen
            </ActionButton>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="What to do" />
            <CardBody className="space-y-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{t.description || "No additional details."}</p>
              <div>
                <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-faint">Why this was recommended</div>
                <Reasons reasons={parseJsonArray<string>(t.reasonsJson)} />
              </div>
            </CardBody>
          </Card>
          {reply ? (
            <Card>
              <CardHeader title="Their reply" description={`${formatDateTime(reply.occurredAt, s.timezone)} · ${reply.source === "SIMULATION" || reply.source === "DEMO" ? "fictional demo reply" : reply.source}`} action={<ClassificationBadge c={reply.classification} />} />
              <CardBody className="space-y-4">
                <blockquote className="rounded-lg border-l-2 border-sage-400 bg-subtle px-4 py-3 text-sm italic text-ink">{reply.body}</blockquote>
                {cls ? (
                  <>
                    <KeyValue
                      items={[
                        ["AI summary", cls.summary],
                        ["Stated timeframe", cls.timeframe ?? "Not mentioned"],
                        ["Recommended", cls.recommendedAction],
                        ["Confidence", `${Math.round(cls.confidence * 100)}% · ${cls.source === "AI_OPENAI" ? "OpenAI" : "rules-based demo model"}`],
                      ]}
                    />
                    {cls.suggestedReply ? (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Suggested reply (draft — never sent automatically)</span>
                          <CopyButton text={cls.suggestedReply} />
                        </div>
                        <pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface p-3 font-sans text-sm text-ink">{cls.suggestedReply}</pre>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <LinkButton href={`/inbox#${reply.id}`} variant="secondary" size="sm">
                  Open in Replies <ExternalLink />
                </LinkButton>
              </CardBody>
            </Card>
          ) : null}
          {message ? (
            <Card>
              <CardHeader title="Prepared message" action={<StatusBadge status={message.status} />} />
              <CardBody>
                <div className="text-sm font-medium">{message.subject}</div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-muted">{message.body}</pre>
                <LinkButton href={`/messages/${message.id}`} className="mt-3" size="sm">
                  Review & approve
                </LinkButton>
              </CardBody>
            </Card>
          ) : null}
          {campaign ? (
            <Card>
              <CardHeader title="Campaign" action={<StatusBadge status={campaign.status} />} />
              <CardBody>
                <div className="text-sm font-medium">{campaign.name}</div>
                <LinkButton href={`/campaigns/${campaign.id}`} className="mt-3" size="sm">
                  Open campaign
                </LinkButton>
              </CardBody>
            </Card>
          ) : null}
        </div>
        {t.contact ? (
          <Card className="h-fit">
            <CardHeader title={`${t.contact.firstName} ${t.contact.lastName}`} action={<TierBadge tier={t.contact.tier} />} />
            <CardBody>
              <div className="mb-3">
                <TypeBadge type={t.contact.contactType} />
              </div>
              <KeyValue
                items={[
                  ["Phone", t.contact.phone ? <a href={`tel:${t.contact.phone}`} className="text-sage-700 hover:underline">{formatPhone(t.contact.phone)}</a> : "—"],
                  ["Email", t.contact.email ?? "—"],
                  ["Prefers", humanize(t.contact.preferredChannel)],
                  ["Last touch", timeAgo(t.contact.lastCommunicationAt)],
                  ["Area", t.contact.neighborhood ?? "—"],
                ]}
              />
              <LinkButton href={`/contacts/${t.contact.id}`} variant="secondary" className="mt-4 w-full">
                Open full profile
              </LinkButton>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
