import { Handshake } from "lucide-react";
import Link from "next/link";
import { opportunityAction } from "@/actions/work";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { StatusBadge, TierBadge, TypeBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { listOpportunities } from "@/lib/server/replies";
import { formatDate, humanize } from "@/lib/utils";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const status = sp((await searchParams).status);
  const opps = await listOpportunities(s, status || undefined);
  return (
    <>
      <PageHeader title="Opportunities" description="Real estate interest detected from conversations. Every detection starts as “potential” — only you can confirm it after talking with the person." />
      <Tabs
        current={status || "ALL"}
        items={[
          { key: "ALL", label: "Active", href: "/opportunities" },
          { key: "POTENTIAL", label: "Potential", href: "/opportunities?status=POTENTIAL" },
          { key: "CONFIRMED", label: "Confirmed", href: "/opportunities?status=CONFIRMED" },
          { key: "APPOINTMENT_SET", label: "Appointments", href: "/opportunities?status=APPOINTMENT_SET" },
          { key: "DISMISSED", label: "Dismissed", href: "/opportunities?status=DISMISSED" },
        ]}
      />
      <Card>
        {opps.length ? (
          <ul className="divide-y divide-line">
            {opps.map((o) => (
              <li key={o.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/contacts/${o.contact.id}`} className="text-[15px] font-semibold hover:underline">
                      {o.contact.firstName} {o.contact.lastName}
                    </Link>
                    <Badge tone="sand">{humanize(o.type)}</Badge>
                    <StatusBadge status={o.status} />
                    <TypeBadge type={o.contact.contactType} />
                    <TierBadge tier={o.contact.tier} />
                  </div>
                  <p className="mt-1 text-sm text-ink">{o.summary}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[12.5px] text-ink-muted">
                    {o.timeframe ? <span>Timeframe: {o.timeframe}</span> : null}
                    <span>Detected {formatDate(o.createdAt, s.timezone)}</span>
                    {o.appointmentAt ? <span>Appointment {formatDate(o.appointmentAt, s.timezone)}</span> : null}
                    {o.externalId ? <span>CRM: {o.externalId}</span> : null}
                  </div>
                  {o.evidence ? <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-[13px] italic text-ink-muted">“{o.evidence}”</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-start gap-1.5">
                  {o.status === "POTENTIAL" ? (
                    <ActionButton action={opportunityAction} fields={{ id: o.id, action: "CONFIRM" }} variant="primary" showResult={false}>
                      Confirm
                    </ActionButton>
                  ) : null}
                  {["POTENTIAL", "CONFIRMED"].includes(o.status) ? (
                    <details>
                      <summary className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 text-[13px] hover:bg-subtle">Set appointment</summary>
                      <ActionForm action={opportunityAction} className="mt-2 flex gap-1.5">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="action" value="APPOINTMENT" />
                        <Input type="date" name="appointmentAt" required className="h-8 w-40" />
                        <SubmitButton size="sm">Save</SubmitButton>
                      </ActionForm>
                    </details>
                  ) : null}
                  {["CONFIRMED", "APPOINTMENT_SET"].includes(o.status) ? (
                    <>
                      <ActionButton action={opportunityAction} fields={{ id: o.id, action: "WON" }} showResult={false}>
                        Won
                      </ActionButton>
                      <ActionButton action={opportunityAction} fields={{ id: o.id, action: "LOST" }} variant="ghost" showResult={false}>
                        Lost
                      </ActionButton>
                    </>
                  ) : null}
                  {o.status !== "DISMISSED" ? (
                    <ActionButton action={opportunityAction} fields={{ id: o.id, action: "DISMISS" }} variant="ghost" showResult={false}>
                      Dismiss
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Handshake />} title="No opportunities here" description="When someone mentions buying, selling, investing or a referral, it shows up here for you to follow up." />
        )}
      </Card>
    </>
  );
}
