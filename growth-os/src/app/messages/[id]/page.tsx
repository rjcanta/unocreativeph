import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveMessageAction, cancelMessageAction, editMessageAction } from "@/actions/campaigns";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { SourceBadge, StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Notice, Reasons } from "@/components/ui/misc";
import { MILESTONE_LABEL, type MilestoneType } from "@/lib/domain/types";
import { renderForContact } from "@/lib/server/delivery";
import { prisma } from "@/lib/server/db";
import { parseJsonArray } from "@/lib/server/json";
import { session } from "@/lib/server/page";
import { getWorkspace } from "@/lib/server/workspace";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Message" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  const { id } = await params;
  const m = await prisma.scheduledMessage.findFirst({ where: { id, workspaceId: s.workspaceId }, include: { contact: true, campaign: true, events: true } });
  if (!m) notFound();
  const ws = await getWorkspace(s);
  const rendered = renderForContact(m, m.contact, ws);
  const editable = ["PENDING_APPROVAL", "SCHEDULED"].includes(m.status);
  const label = m.category === "MILESTONE" ? (MILESTONE_LABEL[m.kind as MilestoneType] ?? "Milestone") : m.campaign?.name ?? humanize(m.category);

  return (
    <>
      <Link href={m.campaign ? `/campaigns/${m.campaign.id}` : "/campaigns?tab=milestones"} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> {m.campaign ? "Campaign" : "Milestones"}
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={m.status} />
            <SourceBadge source={m.contentSource} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {label} for{" "}
            <Link href={`/contacts/${m.contact.id}`} className="hover:underline">
              {m.contact.firstName} {m.contact.lastName}
            </Link>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {m.status === "SIMULATED" || m.status === "SENT" ? `Delivered ${formatDateTime(m.sentAt, ws.timezone)}` : `Scheduled for ${formatDateTime(m.scheduledFor, ws.timezone)}`} · {ws.timezone}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status === "PENDING_APPROVAL" ? (
            <ActionButton action={approveMessageAction} fields={{ id: m.id }} variant="primary" size="md">
              <CheckCircle2 /> Approve & schedule
            </ActionButton>
          ) : null}
          {editable ? (
            <ActionButton action={cancelMessageAction} fields={{ id: m.id }} variant="danger" size="md" confirm="Cancel this message? It will not be sent." confirmLabel="Cancel message">
              <XCircle /> Cancel
            </ActionButton>
          ) : null}
        </div>
      </div>
      {m.status === "SIMULATED" ? (
        <Notice tone="info" className="mb-5" title="Simulated delivery">
          Demo Mode recorded this as delivered without sending anything.
        </Notice>
      ) : null}
      {m.blockedReason ? (
        <Notice tone={m.status === "BLOCKED" || m.status === "FAILED" ? "danger" : "warning"} className="mb-5" title={humanize(m.status)}>
          {m.blockedReason}
        </Notice>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {editable && !m.campaign ? (
            <Card>
              <CardHeader title="Edit message" description="Saving returns the message to “awaiting approval”." />
              <CardBody>
                <ActionForm action={editMessageAction} className="space-y-3">
                  <input type="hidden" name="id" value={m.id} />
                  <Field label="Subject">
                    <Input name="subject" defaultValue={m.subject} required />
                  </Field>
                  <Field label="Message">
                    <Textarea name="body" rows={10} defaultValue={m.body} required />
                  </Field>
                  <SubmitButton variant="secondary">Save edits</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="What the recipient sees" description={m.campaign ? "Edit campaign content from the campaign page." : undefined} />
            <CardBody>
              <div className="rounded-xl border border-line bg-canvas p-4">
                <div className="text-[12px] text-ink-faint">To: {m.contact.email ?? "no email on file"}</div>
                <div className="mt-1 text-sm font-semibold">{rendered.subject}</div>
                <div className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed">{rendered.body}</div>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Why this message exists" />
            <CardBody>
              <Reasons reasons={parseJsonArray<string>(m.reasonsJson)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recipient" />
            <CardBody className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <TypeBadge type={m.contact.contactType} />
                <TierBadge tier={m.contact.tier} />
              </div>
              <div className="text-[12.5px] text-ink-muted">Idempotency key: <code className="break-all text-[11px]">{m.idempotencyKey}</code></div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
