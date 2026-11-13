import { ArrowLeft, CheckCircle2, Pause, Play, Send, Sparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { approveCampaignAction, cancelCampaignAction, pauseCampaignAction, regenerateAction, scheduleCampaignAction, testSendAction } from "@/actions/campaigns";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { CampaignEditor } from "@/components/campaign-editor";
import { SourceBadge, StatusBadge, TierBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/form";
import { Notice, Reasons } from "@/components/ui/misc";
import { complianceFooter } from "@/lib/domain/render";
import { parseSegment, describeSegment } from "@/lib/domain/segmentation";
import { toLocalDate } from "@/lib/domain/dates";
import { campaignNotes, contentWarnings, getCampaign, previewCampaignSchedule } from "@/lib/server/campaigns";
import { prisma } from "@/lib/server/db";
import { parseJsonArray } from "@/lib/server/json";
import { orNotFound, session } from "@/lib/server/page";
import { getWorkspace } from "@/lib/server/workspace";
import { formatDate, formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Campaign" };

const ACTION_LABEL: Record<string, string> = { SCHEDULE: "Scheduled", POSTPONE: "Postponed", SKIP: "Skipped", SUPPRESS: "Suppressed" };
const ACTION_STATUS: Record<string, string> = { SCHEDULE: "SCHEDULED", POSTPONE: "POSTPONED", SKIP: "SKIPPED", SUPPRESS: "SUPPRESSED" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  const { id } = await params;
  const [c, ws] = await Promise.all([orNotFound(getCampaign(s, id)), getWorkspace(s)]);
  const today = toLocalDate(new Date(), ws.timezone);
  const segment = parseSegment(c.segmentJson);
  const warnings = contentWarnings(c);
  const notes = campaignNotes(c);
  const materialized = c.recipients.length > 0 && ["SCHEDULED", "PAUSED", "SENT"].includes(c.status);
  const preview = !materialized && c.scheduledFor && !["CANCELLED", "SENT"].includes(c.status) ? await previewCampaignSchedule(s, c.id) : null;
  const [tags, hoods, sample] = await Promise.all([
    prisma.tag.findMany({ where: { workspaceId: s.workspaceId }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where: { workspaceId: s.workspaceId, deletedAt: null, neighborhood: { not: null } }, distinct: ["neighborhood"], select: { neighborhood: true }, orderBy: { neighborhood: "asc" } }),
    prisma.contact.findFirst({ where: { workspaceId: s.workspaceId, deletedAt: null, ...(segment.contactTypes.length ? { contactType: { in: segment.contactTypes } } : {}) }, orderBy: { lastName: "asc" } }),
  ]);
  const msgCounts = c.messages.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.status]: (acc[m.status] ?? 0) + 1 }), {});
  const editable = !["SENT", "CANCELLED"].includes(c.status);
  const isApproved = ["APPROVED", "SCHEDULED", "PAUSED"].includes(c.status);

  const decisions = preview?.preview ?? c.recipients.map((r) => ({ contactId: r.contactId, name: `${r.contact.firstName} ${r.contact.lastName}`, action: Object.entries(ACTION_STATUS).find(([, v]) => v === r.status)?.[0] ?? r.status, date: r.plannedFor ? toLocalDate(r.plannedFor, ws.timezone) : null, reasons: parseJsonArray<string>(r.reasonsJson), status: r.status }));
  const counts = decisions.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.action]: (acc[d.action] ?? 0) + 1 }), {});

  return (
    <>
      <Link href={`/campaigns?tab=${c.category === "SEASONAL" ? "seasonal" : "newsletters"}`} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Campaigns
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={c.category === "SEASONAL" ? "sand" : "sage"}>{c.category === "SEASONAL" ? "Seasonal" : "Newsletter"}</Badge>
            <StatusBadge status={c.status} />
            <SourceBadge source={c.contentSource} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{c.name}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {c.scheduledFor ? `Sends ${formatDate(c.scheduledFor, ws.timezone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "No send date yet"} · {describeSegment(segment)}
            {c.approvedAt ? ` · approved ${formatDateTime(c.approvedAt, ws.timezone)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["DRAFT", "PENDING_APPROVAL"].includes(c.status) ? (
            <ActionButton action={approveCampaignAction} fields={{ id: c.id }} variant="primary" size="md" disabled={warnings.length > 0} confirm={`Approve “${c.name}”? Messages will be prepared for eligible recipients${c.scheduledFor ? ` and scheduled for ${formatDate(c.scheduledFor, ws.timezone)}` : ""}.`} confirmLabel="Approve">
              <CheckCircle2 /> Approve
            </ActionButton>
          ) : null}
          {c.status === "SCHEDULED" ? (
            <ActionButton action={pauseCampaignAction} fields={{ id: c.id, paused: "true" }} size="md">
              <Pause /> Pause
            </ActionButton>
          ) : null}
          {c.status === "PAUSED" ? (
            <ActionButton action={pauseCampaignAction} fields={{ id: c.id, paused: "false" }} size="md" variant="primary">
              <Play /> Resume
            </ActionButton>
          ) : null}
          {editable ? (
            <ActionButton action={testSendAction} fields={{ id: c.id }} size="md">
              <Send /> Test send
            </ActionButton>
          ) : null}
          {editable ? (
            <ActionButton action={cancelCampaignAction} fields={{ id: c.id }} size="md" variant="danger" confirm="Cancel this campaign? All unsent messages will be cancelled. This cannot be undone." confirmLabel="Cancel campaign">
              <XCircle /> Cancel
            </ActionButton>
          ) : null}
        </div>
      </div>

      <div className="mb-6 space-y-3">
        {warnings.map((w) => (
          <Notice key={w} tone="danger" title="Fix before approving">
            {w}
          </Notice>
        ))}
        {notes.length ? (
          <Notice tone="info" title="Notes from the AI draft">
            <Reasons reasons={notes} />
          </Notice>
        ) : null}
        {c.status === "APPROVED" && !c.scheduledFor ? (
          <Card>
            <CardBody>
              <ActionForm action={scheduleCampaignAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <div>
                  <div className="mb-1 text-[13px] font-medium">Approved — choose a send date</div>
                  <Input type="date" name="sendDate" min={today} required className="w-48" />
                </div>
                <SubmitButton>Schedule</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <CampaignEditor
        id={c.id}
        editable={editable}
        isApproved={isApproved}
        name={c.name}
        subject={c.subject}
        previewText={c.previewText}
        body={c.body}
        sendDate={c.scheduledFor ? toLocalDate(c.scheduledFor, ws.timezone) : ""}
        minDate={today}
        category={c.category}
        replacesNewsletter={c.replacesNewsletter}
        verifiedMarketData={c.verifiedMarketData ?? ""}
        segment={segment}
        tags={tags.map((t) => t.name)}
        neighborhoods={hoods.map((h) => h.neighborhood!).filter(Boolean)}
        sample={{ firstName: sample?.firstName ?? "Alex", lastName: sample?.lastName ?? "Sample", neighborhood: sample?.neighborhood ?? null, city: sample?.city ?? null, agentName: ws.brand.agentName, teamName: ws.brand.teamName }}
        footer={complianceFooter(ws.compliance, ws.brand)}
      />

      {c.category === "NEWSLETTER" && editable ? (
        <Card className="mt-6">
          <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-sage-600" /> Regenerate with AI</span>} description="Replaces subject and body with a fresh draft. Approval resets." />
          <CardBody>
            <ActionForm action={regenerateAction} confirm="Replace the current subject and body with a new AI draft?" confirmLabel="Regenerate" className="space-y-2">
              <input type="hidden" name="id" value={c.id} />
              <Textarea name="verifiedMarketData" rows={3} defaultValue={c.verifiedMarketData ?? ""} placeholder="Optional: paste verified market figures to include." />
              <SubmitButton variant="secondary" pendingLabel="Drafting…">
                Regenerate draft
              </SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader
          title={materialized ? "Recipients & scheduling decisions" : "Scheduling preview"}
          description={
            materialized
              ? `Messages: ${Object.entries(msgCounts).map(([k, v]) => `${v} ${humanize(k).toLowerCase()}`).join(" · ") || "none"}`
              : preview
                ? "What would happen if you approved now. Every decision is explained — nothing is saved yet."
                : "Add a send date to see who will receive this and why."
          }
        />
        {decisions.length ? (
          <>
            <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
              {Object.entries(counts).map(([k, n]) => (
                <span key={k} className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <StatusBadge status={ACTION_STATUS[k] ?? k} /> {n}
                </span>
              ))}
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead className="sticky top-0 bg-subtle text-left text-[12px] text-ink-muted">
                  <tr>
                    <th className="px-5 py-2">Contact</th>
                    <th className="px-3 py-2">Decision</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {decisions
                    .sort((a, b) => ["POSTPONE", "SKIP", "SUPPRESS", "SCHEDULE"].indexOf(a.action) - ["POSTPONE", "SKIP", "SUPPRESS", "SCHEDULE"].indexOf(b.action))
                    .map((d) => {
                      const r = c.recipients.find((x) => x.contactId === d.contactId);
                      return (
                        <tr key={d.contactId} className="align-top">
                          <td className="px-5 py-2.5">
                            <Link href={`/contacts/${d.contactId}`} className="font-medium hover:underline">
                              {d.name}
                            </Link>
                            {r ? <div className="mt-0.5"><TierBadge tier={r.contact.tier} /></div> : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={"status" in d && d.status ? String(d.status) : (ACTION_STATUS[d.action] ?? d.action)} />
                            <span className="sr-only">{ACTION_LABEL[d.action]}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">{d.date ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <Reasons reasons={d.reasons} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>
    </>
  );
}
