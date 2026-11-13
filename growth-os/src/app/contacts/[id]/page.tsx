import { ArrowLeft, Ban, Cake, HeartHandshake, Home, Lightbulb, Mail, MessageSquareText, Pencil, Phone, Sparkles, StickyNote } from "lucide-react";
import Link from "next/link";
import { addNoteAction, customMilestoneAction, doNotContactAction, preferencesAction, recordConsentAction, unsubscribeAction, verifyDateAction } from "@/actions/contacts";
import { insightAction } from "@/actions/work";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { ClassificationBadge, ConsentBadge, PriorityDot, StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, KeyValue, Reasons } from "@/components/ui/misc";
import { anniversaryNumber, daysUntilNext, formatLocalDate, nextOccurrence, ordinal, toLocalDate } from "@/lib/domain/dates";
import { consentStatus, latestConsent } from "@/lib/domain/eligibility";
import { formatPhone } from "@/lib/domain/normalize";
import { renderMergeTags } from "@/lib/domain/render";
import { CLIENT_ROLE_LABEL, MILESTONE_LABEL, type ClientRole, type Evidence, type MilestoneType } from "@/lib/domain/types";
import { getContact } from "@/lib/server/contacts";
import { parseJsonArray } from "@/lib/server/json";
import { orNotFound, session } from "@/lib/server/page";
import { parseClassification } from "@/lib/server/replies";
import { getWorkspace } from "@/lib/server/workspace";
import { formatDate, formatDateTime, humanize, relativeDays, timeAgo } from "@/lib/utils";

export const metadata = { title: "Contact" };

const MILESTONE_ICON: Record<string, React.ReactNode> = {
  BIRTHDAY: <Cake className="size-4" />,
  HOME_ANNIVERSARY: <Home className="size-4" />,
};

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  const { id } = await params;
  const [c, ws] = await Promise.all([orNotFound(getContact(s, id)), getWorkspace(s)]);
  const today = toLocalDate(new Date(), ws.timezone);
  const name = `${c.firstName} ${c.lastName}`.trim();
  const emailMarketing = consentStatus(c.consentRecords, "EMAIL", "MARKETING");
  const emailRelationship = consentStatus(c.consentRecords, "EMAIL", "RELATIONSHIP");
  const latestEmail = latestConsent(c.consentRecords, "EMAIL", "MARKETING");
  const nextAction = c.tasks.find((t) => t.status === "OPEN");
  const activeMilestones = c.milestones.filter((m) => m.active);
  const consentHistory = [...c.consentRecords].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

  return (
    <>
      <Link href="/contacts" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Contacts
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-sage-100 text-lg font-semibold text-sage-700">
            {c.firstName[0]}
            {c.lastName[0] ?? ""}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <TypeBadge type={c.contactType} />
              <TierBadge tier={c.tier} />
              {c.clientRole ? <Badge>{CLIENT_ROLE_LABEL[c.clientRole as ClientRole]}</Badge> : null}
              <ConsentBadge status={emailMarketing} suppressed={c.doNotContact || !!c.unsubscribedAt} />
              {c.doNotContact ? <Badge tone="rose">Do not contact</Badge> : null}
              {c.opportunityStatus !== "NONE" ? <Badge tone="sand">Opportunity: {humanize(c.opportunityStatus)}</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.phone ? (
            <a href={`tel:${c.phone}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-subtle">
              <Phone className="size-4" /> Call
            </a>
          ) : null}
          <LinkButton href={`/contacts/${c.id}/edit`} variant="secondary">
            <Pencil /> Edit
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          {/* Recommended next action */}
          <Card className="border-sage-200 bg-sage-50/40">
            <CardBody className="flex flex-wrap items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                <Sparkles className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium uppercase tracking-wide text-sage-700">Recommended next action</div>
                {nextAction ? (
                  <>
                    <Link href={`/actions/${nextAction.id}`} className="mt-0.5 block text-[15px] font-medium hover:underline">
                      {nextAction.title}
                    </Link>
                    <Reasons className="mt-1" reasons={parseJsonArray<string>(nextAction.reasonsJson).slice(0, 4)} />
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-ink-muted">Nothing needed right now. The daily review will suggest a touch point when it&apos;s time.</p>
                )}
              </div>
            </CardBody>
          </Card>

          {/* AI insights */}
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Lightbulb className="size-4 text-clay-500" /> Relationship insights</span>} description="Grounded in this record only — every insight shows its evidence." />
            {c.insights.length ? (
              <ul className="divide-y divide-line">
                {c.insights.map((i) => (
                  <li key={i.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{i.title}</div>
                        <p className="mt-0.5 text-[13px] text-ink-muted">{i.summary}</p>
                      </div>
                      <ActionButton action={insightAction} fields={{ id: i.id, status: "DISMISSED" }} variant="ghost" showResult={false}>
                        Dismiss
                      </ActionButton>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {parseJsonArray<Evidence>(i.evidenceJson).map((e, idx) => (
                        <span key={idx} className="rounded-md border border-line bg-subtle px-2 py-1 text-[12px] text-ink-muted">
                          <span className="font-medium text-ink">{e.label}:</span> {e.value} <span className="text-ink-faint">· {e.source}</span>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No active insights" description="Insights appear when a check-in is overdue, a milestone approaches, or a conversation mentions real estate plans." />
            )}
          </Card>

          {/* Scheduled messages */}
          <Card>
            <CardHeader title="Prepared & scheduled messages" description="Preparing a message never sends it. Delivery re-checks consent at send time." />
            {c.messages.length ? (
              <ul className="divide-y divide-line">
                {c.messages.slice(0, 12).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/messages/${m.id}`} className="block truncate text-sm font-medium hover:underline">
                        {renderMergeTags(m.subject, { firstName: c.firstName, lastName: c.lastName, neighborhood: c.neighborhood, city: c.city, agentName: ws.brand.agentName, teamName: ws.brand.teamName })}
                      </Link>
                      <div className="text-[12.5px] text-ink-muted">
                        {m.campaign ? m.campaign.name : MILESTONE_LABEL[m.kind as MilestoneType] ?? humanize(m.category)} · {formatDateTime(m.sentAt ?? m.scheduledFor, ws.timezone)}
                        {m.blockedReason ? ` · ${m.blockedReason}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Mail />} title="No messages yet" />
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Communication timeline" />
            {c.communication.length || c.notes.length ? (
              <ol className="relative space-y-0 px-5 py-4">
                {[
                  ...c.communication.map((e) => ({ kind: "event" as const, at: e.occurredAt, e })),
                  ...c.notes.map((n) => ({ kind: "note" as const, at: n.createdAt, n })),
                ]
                  .sort((a, b) => b.at.getTime() - a.at.getTime())
                  .slice(0, 30)
                  .map((item) => (
                    <li key={item.kind === "event" ? item.e.id : item.n.id} className="relative border-l border-line pb-4 pl-5 last:pb-0">
                      <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-sage-400" />
                      {item.kind === "note" ? (
                        <>
                          <div className="flex items-center gap-2 text-[12px] text-ink-faint">
                            <StickyNote className="size-3.5" /> {humanize(item.n.kind)} · {formatDateTime(item.at, ws.timezone)}
                          </div>
                          <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{item.n.body}</p>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-faint">
                            {item.e.direction === "INBOUND" ? <MessageSquareText className="size-3.5" /> : <Mail className="size-3.5" />}
                            {item.e.direction === "INBOUND" ? "Reply received" : humanize(item.e.type)} · {formatDateTime(item.at, ws.timezone)}
                            {item.e.type === "SIMULATED_SEND" ? <Badge tone="sky">Simulated — not actually sent</Badge> : null}
                            {item.e.direction === "INBOUND" ? <ClassificationBadge c={item.e.classification} /> : null}
                          </div>
                          {item.e.subject ? <div className="mt-0.5 text-sm font-medium">{item.e.subject}</div> : null}
                          {item.e.direction === "INBOUND" ? (
                            <>
                              <p className="mt-0.5 text-sm italic text-ink">“{item.e.body}”</p>
                              {parseClassification(item.e.classificationJson)?.summary ? <p className="mt-1 text-[12.5px] text-ink-muted">AI: {parseClassification(item.e.classificationJson)!.summary}</p> : null}
                            </>
                          ) : item.e.type !== "SIMULATED_SEND" && item.e.body ? (
                            <p className="mt-0.5 text-sm text-ink-muted">{item.e.body}</p>
                          ) : null}
                        </>
                      )}
                    </li>
                  ))}
              </ol>
            ) : (
              <EmptyState title="No history yet" />
            )}
            <div className="border-t border-line px-5 py-4">
              <ActionForm action={addNoteAction} resetOnSuccess className="space-y-2">
                <input type="hidden" name="contactId" value={c.id} />
                <Textarea name="body" rows={2} placeholder={`Add a note, or log a call with ${c.firstName}…`} required />
                <div className="flex flex-wrap items-center gap-2">
                  <Select name="kind" className="w-auto">
                    <option value="NOTE">Note</option>
                    <option value="CALL_LOG">Call log</option>
                    <option value="MEETING">Meeting</option>
                  </Select>
                  <SubmitButton size="sm">Save</SubmitButton>
                  <span className="text-[12px] text-ink-faint">Notes are the only personal details AI may reference.</span>
                </div>
              </ActionForm>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact information" />
            <CardBody className="pt-1">
              <KeyValue
                items={[
                  ["Email", c.email ?? "—"],
                  ["Phone", c.phone ? formatPhone(c.phone) : "—"],
                  ["Property", c.propertyAddress ?? "—"],
                  ["Area", [c.neighborhood, c.city].filter(Boolean).join(", ") || "—"],
                  ["Last communication", c.lastCommunicationAt ? `${formatDate(c.lastCommunicationAt, ws.timezone)} (${timeAgo(c.lastCommunicationAt)})` : "None recorded"],
                  ["Assigned agent", c.assignedAgent?.name ?? "Unassigned"],
                  ["Tags", c.tags.length ? <span className="flex flex-wrap justify-end gap-1">{c.tags.map((t) => <Badge key={t.tagId}>{t.tag.name}</Badge>)}</span> : "—"],
                  ["Source", humanize(c.source)],
                ]}
              />
              {c.mappings.length ? (
                <div className="mt-3 rounded-lg bg-subtle px-3 py-2 text-[12px] text-ink-muted">
                  Linked to {c.mappings.map((m) => `${m.integration.mode === "MOCK" ? "mock " : ""}HighLevel ${m.externalId}`).join(", ")}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Milestones" description="Only verified dates trigger automated messages." />
            <CardBody className="space-y-3">
              {activeMilestones.length ? (
                activeMilestones.map((m) => {
                  const occ = nextOccurrence(m.month, m.day, today, ws.rules.leapDayRule);
                  const days = daysUntilNext(m.month, m.day, today, ws.rules.leapDayRule);
                  const years = m.year && m.type !== "BIRTHDAY" ? anniversaryNumber(m.year, occ) : null;
                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sand-50 text-clay-600">{MILESTONE_ICON[m.type] ?? <HeartHandshake className="size-4" />}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          {m.type === "CUSTOM" ? m.label : MILESTONE_LABEL[m.type as MilestoneType]}
                          {years ? ` · ${ordinal(years)}` : ""}
                        </div>
                        <div className="text-[12.5px] text-ink-muted">
                          {formatLocalDate(occ, { month: "long", day: "numeric" })}
                          {m.month === 2 && m.day === 29 ? " (Feb 29 — observed per leap-day rule)" : ""} · {relativeDays(days)}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          {m.verified ? <Badge tone="sage">Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
                          {m.type === "BIRTHDAY" || m.type === "HOME_ANNIVERSARY" ? (
                            <ActionButton action={verifyDateAction} fields={{ contactId: c.id, type: m.type, verified: String(!m.verified) }} variant="link" showResult={false}>
                              {m.verified ? "Mark unverified" : "Mark verified"}
                            </ActionButton>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-[13px] text-ink-muted">No milestones recorded.</p>
              )}
              <details className="border-t border-line pt-3">
                <summary className="cursor-pointer text-[13px] text-sage-700">Add a personal milestone</summary>
                <ActionForm action={customMilestoneAction} resetOnSuccess className="mt-3 space-y-2">
                  <input type="hidden" name="contactId" value={c.id} />
                  <Input name="label" placeholder="e.g. Wedding anniversary" required />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="month" type="number" min={1} max={12} placeholder="Month" required />
                    <Input name="day" type="number" min={1} max={31} placeholder="Day" required />
                  </div>
                  <Checkbox name="verified" label="Date is verified" />
                  <SubmitButton size="sm">Add milestone</SubmitButton>
                </ActionForm>
              </details>
            </CardBody>
          </Card>

          <Card id="consent">
            <CardHeader title="Consent & preferences" />
            <CardBody className="space-y-4">
              <KeyValue
                items={[
                  ["Email marketing", <ConsentBadge key="m" status={emailMarketing} />],
                  ["Personal notes (relationship)", emailRelationship === "GRANTED" ? <Badge tone="sage">Granted</Badge> : emailRelationship === "REVOKED" ? <Badge tone="rose">Revoked</Badge> : <Badge>Not recorded</Badge>],
                  ["Source", latestEmail ? latestEmail.source : "—"],
                  ["Captured", latestEmail ? formatDateTime(latestEmail.capturedAt, ws.timezone) : "—"],
                  ["Unsubscribed", c.unsubscribedAt ? formatDate(c.unsubscribedAt, ws.timezone) : "No"],
                  ["SMS", <Badge key="sms" tone="neutral">Disabled pending legal review</Badge>],
                ]}
              />
              <details>
                <summary className="cursor-pointer text-[13px] text-sage-700">Record consent</summary>
                <ActionForm action={recordConsentAction} resetOnSuccess className="mt-3 space-y-2">
                  <input type="hidden" name="contactId" value={c.id} />
                  <div className="grid grid-cols-3 gap-2">
                    <Select name="channel" defaultValue="EMAIL">
                      <option value="EMAIL">Email</option>
                      <option value="SMS">SMS</option>
                      <option value="PHONE">Phone</option>
                    </Select>
                    <Select name="purpose" defaultValue="MARKETING">
                      <option value="MARKETING">Marketing</option>
                      <option value="RELATIONSHIP">Personal notes</option>
                    </Select>
                    <Select name="status" defaultValue="GRANTED">
                      <option value="GRANTED">Granted</option>
                      <option value="REVOKED">Revoked</option>
                    </Select>
                  </div>
                  <Input name="source" placeholder="Where did this come from?" required />
                  <Input name="evidence" placeholder="Evidence (optional), e.g. signed form ID" />
                  <SubmitButton size="sm">Record</SubmitButton>
                </ActionForm>
              </details>
              <details>
                <summary className="cursor-pointer text-[13px] text-sage-700">Communication preferences</summary>
                <ActionForm action={preferencesAction} className="mt-3 space-y-2.5">
                  <input type="hidden" name="contactId" value={c.id} />
                  <Checkbox name="receiveNewsletters" defaultChecked={c.preference?.receiveNewsletters ?? true} label="Newsletters" />
                  <Checkbox name="receiveSeasonal" defaultChecked={c.preference?.receiveSeasonal ?? true} label="Seasonal outreach" />
                  <Checkbox name="receiveMilestones" defaultChecked={c.preference?.receiveMilestones ?? true} label="Milestone greetings" />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Frequency">
                      <Select name="frequency" defaultValue={c.preference?.frequency ?? "NORMAL"}>
                        <option value="NORMAL">Normal</option>
                        <option value="REDUCED">Reduced (1/month)</option>
                        <option value="MILESTONES_ONLY">Milestones only</option>
                      </Select>
                    </Field>
                    <Field label="Preferred channel">
                      <Select name="preferredChannel" defaultValue={c.preferredChannel}>
                        <option value="EMAIL">Email</option>
                        <option value="SMS">Text</option>
                        <option value="PHONE">Phone</option>
                        <option value="NONE">None</option>
                      </Select>
                    </Field>
                  </div>
                  <SubmitButton size="sm">Save preferences</SubmitButton>
                </ActionForm>
              </details>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {!c.unsubscribedAt ? (
                  <ActionButton action={unsubscribeAction} fields={{ contactId: c.id }} variant="danger" confirm={`Unsubscribe ${name} from all email? Pending emails will be cancelled.`} confirmLabel="Unsubscribe">
                    Unsubscribe from email
                  </ActionButton>
                ) : null}
                <ActionButton
                  action={doNotContactAction}
                  fields={{ contactId: c.id, value: String(!c.doNotContact) }}
                  variant={c.doNotContact ? "secondary" : "danger"}
                  confirm={c.doNotContact ? undefined : `Mark ${name} as do-not-contact? All pending messages and tasks will be cancelled.`}
                  confirmLabel="Mark do-not-contact"
                >
                  <Ban /> {c.doNotContact ? "Clear do-not-contact" : "Do not contact"}
                </ActionButton>
              </div>
              {consentHistory.length ? (
                <details>
                  <summary className="cursor-pointer text-[13px] text-ink-muted">Consent history ({consentHistory.length})</summary>
                  <ul className="mt-2 space-y-1.5 text-[12.5px] text-ink-muted">
                    {consentHistory.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium text-ink">{r.status.toLowerCase()}</span> · {r.channel.toLowerCase()} {r.purpose.toLowerCase()} · {r.source} · {formatDate(r.capturedAt, ws.timezone)}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardBody>
          </Card>

          {c.opportunities.length ? (
            <Card>
              <CardHeader title="Opportunities" action={<LinkButton href="/opportunities" variant="ghost" size="sm">All</LinkButton>} />
              <ul className="divide-y divide-line">
                {c.opportunities.map((o) => (
                  <li key={o.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{humanize(o.type)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {o.summary}
                      {o.timeframe ? ` · ${o.timeframe}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {c.relationships.length || c.relatedTo.length ? (
            <Card>
              <CardHeader title="Relationships" />
              <ul className="divide-y divide-line text-sm">
                {c.relationships.map((r) => (
                  <li key={r.id} className="flex justify-between px-5 py-2.5">
                    <Link href={`/contacts/${r.relatedContact.id}`} className="hover:underline">
                      {r.relatedContact.firstName} {r.relatedContact.lastName}
                    </Link>
                    <span className="text-ink-muted">{r.relationshipType === "REFERRED_BY" ? "Referred by" : humanize(r.relationshipType)}</span>
                  </li>
                ))}
                {c.relatedTo.map((r) => (
                  <li key={r.id} className="flex justify-between px-5 py-2.5">
                    <Link href={`/contacts/${r.contact.id}`} className="hover:underline">
                      {r.contact.firstName} {r.contact.lastName}
                    </Link>
                    <span className="text-ink-muted">{r.relationshipType === "REFERRED_BY" ? "Referred" : humanize(r.relationshipType)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Open tasks" />
            {c.tasks.filter((t) => t.status === "OPEN").length ? (
              <ul className="divide-y divide-line">
                {c.tasks
                  .filter((t) => t.status === "OPEN")
                  .map((t) => (
                    <li key={t.id}>
                      <Link href={`/actions/${t.id}`} className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-subtle/60">
                        <PriorityDot priority={t.priority} />
                        <span className="truncate">{t.title}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState title="No open tasks" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
