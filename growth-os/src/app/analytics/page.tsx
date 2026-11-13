import { EngagementChart, GrowthChart, VolumeChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, Notice, PageHeader, Stat } from "@/components/ui/misc";
import { addDays, toLocalDate, zonedTimeToUtc } from "@/lib/domain/dates";
import { TIERS, TIER_LABEL } from "@/lib/domain/types";
import { getAnalytics } from "@/lib/server/analytics";
import { prisma } from "@/lib/server/db";
import { session, sp, type SearchParams } from "@/lib/server/page";

export const metadata = { title: "Analytics" };

function Unavailable() {
  return <span className="text-base font-medium text-ink-faint">Unavailable</span>;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const today = toLocalDate(new Date(), s.timezone);
  const range = sp(q.range) || "90";
  const from = range === "custom" && sp(q.from) ? sp(q.from) : addDays(today, -Number(range === "custom" ? 90 : range));
  const to = range === "custom" && sp(q.to) ? sp(q.to) : today;
  const filters = { contactType: sp(q.type), tier: sp(q.tier), agentId: sp(q.agent), campaignId: sp(q.campaign) };
  const [a, agents, campaigns] = await Promise.all([
    getAnalytics(s, { from: zonedTimeToUtc(from, 0, 0, s.timezone), to: zonedTimeToUtc(addDays(to, 1), 0, 0, s.timezone), ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, v || undefined])) }),
    prisma.user.findMany({ where: { workspaceId: s.workspaceId }, select: { id: true, name: true } }),
    prisma.campaign.findMany({ where: { workspaceId: s.workspaceId, deletedAt: null, status: { in: ["SENT", "SCHEDULED"] } }, select: { id: true, name: true }, orderBy: { scheduledFor: "desc" } }),
  ]);
  const replyRate = (n: number | null) => (n === null ? "—" : `${n}%`);

  return (
    <>
      <PageHeader title="Analytics" description="Nurture performance from your own data. Metrics a provider hasn't reported are shown as unavailable — never as zero." actions={s.isDemo ? <Badge tone="sand">Demo data · sends are simulated</Badge> : null} />

      <form className="mb-6 grid gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <Select name="range" defaultValue={range}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 6 months</option>
          <option value="365">Last 12 months</option>
          <option value="custom">Custom range</option>
        </Select>
        <Input type="date" name="from" defaultValue={from} aria-label="From" />
        <Input type="date" name="to" defaultValue={to} aria-label="To" />
        <Select name="type" defaultValue={filters.contactType}>
          <option value="">All contact types</option>
          <option value="PAST_CLIENT">Past Clients</option>
          <option value="SPHERE">Sphere</option>
        </Select>
        <Select name="tier" defaultValue={filters.tier}>
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select name="agent" defaultValue={filters.agentId}>
          <option value="">All agents</option>
          {agents.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <button className="h-9 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink/90">Apply</button>
        <Select name="campaign" defaultValue={filters.campaignId} className="sm:col-span-3 lg:col-span-3">
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <p className="self-center text-[12px] text-ink-faint sm:col-span-3 lg:col-span-4">Custom dates apply when “Custom range” is selected.</p>
      </form>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Positive responses" value={a.positiveResponses} hint={`${a.totalReplies} replies total`} />
        <Stat label="Milestones completed" value={a.milestonesCompleted} hint="Greetings delivered + personal touches" />
        <Stat label="Follow-up tasks completed" value={a.tasksCompleted} />
        <Stat label="Referral opportunities" value={a.referrals} />
        <Stat label="Qualified conversations" value={a.qualifiedConversations} hint={`${a.potentialOpportunities} still potential`} />
        <Stat label="Appointments generated" value={a.appointments} />
        <Stat label="Unsubscribes (period)" value={a.suppression.unsubscribedInPeriod} />
        <Stat label="Suppressed contacts" value={a.suppression.unsubscribedTotal + a.suppression.doNotContact} hint={`${a.suppression.unsubscribedTotal} unsubscribed · ${a.suppression.doNotContact} DNC · ${a.suppression.noConsent} no consent`} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contact database growth" description="Total contacts, by month added" />
          <CardBody>{a.growth.length ? <GrowthChart data={a.growth} /> : <EmptyState title="No contacts match these filters" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Past Client vs Sphere engagement" description="Contacts reached, replies and positive replies in this period" />
          <CardBody>
            <EngagementChart data={a.engagement.map((e) => ({ label: e.label, reached: e.reached, replies: e.replies, positive: e.positive }))} />
            <table className="mt-3 w-full text-[12.5px]">
              <thead className="text-left text-ink-faint">
                <tr>
                  <th className="py-1 font-medium">Segment</th>
                  <th className="py-1 text-right font-medium">Contacts</th>
                  <th className="py-1 text-right font-medium">Reached</th>
                  <th className="py-1 text-right font-medium">Replies</th>
                  <th className="py-1 text-right font-medium">Reply rate</th>
                </tr>
              </thead>
              <tbody className="tabular text-ink-muted">
                {a.engagement.map((e) => (
                  <tr key={e.type} className="border-t border-line">
                    <td className="py-1.5 text-ink">{e.label}</td>
                    <td className="py-1.5 text-right">{e.contacts}</td>
                    <td className="py-1.5 text-right">{e.reached}</td>
                    <td className="py-1.5 text-right">{e.replies}</td>
                    <td className="py-1.5 text-right">{replyRate(e.replyRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Campaign volume" description="Messages delivered (or simulated) per month" />
          <CardBody>{a.volume.length ? <VolumeChart data={a.volume} /> : <EmptyState title="No messages delivered in this period" />}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Email delivery performance" description="Reported by the connected email provider" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Sent live" value={a.delivery.liveSent} />
              <Stat label="Simulated (demo)" value={a.delivery.simulated} />
              <Stat label="Delivered" value={a.delivery.delivered ?? <Unavailable />} />
              <Stat label="Opened" value={a.delivery.opened ?? <Unavailable />} />
              <Stat label="Clicked" value={a.delivery.clicked ?? <Unavailable />} />
              <Stat label="Bounced" value={a.delivery.bounced ?? <Unavailable />} />
            </div>
            {a.delivery.note ? <Notice tone="info">{a.delivery.note}</Notice> : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
