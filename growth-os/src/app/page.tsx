import { ArrowRight, Bot, Cake, CalendarClock, Handshake, HeartHandshake, Home, Inbox, MailCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/action-form";
import { ClassificationBadge, PriorityDot, TierBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Stat } from "@/components/ui/misc";
import { MILESTONE_LABEL, type MilestoneType } from "@/lib/domain/types";
import { formatLocalDate } from "@/lib/domain/dates";
import { getDashboard } from "@/lib/server/dashboard";
import { session } from "@/lib/server/page";
import { listReplies, parseClassification } from "@/lib/server/replies";
import { listTasks } from "@/lib/server/tasks";
import { parseJsonArray } from "@/lib/server/json";
import { relativeDays, timeAgo } from "@/lib/utils";
import { runPlannerAction } from "@/actions/work";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const s = await session();
  const [d, tasks, replies] = await Promise.all([getDashboard(s), listTasks(s, { limit: 6 }), listReplies(s, { triage: "NEEDS_ATTENTION" })]);
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: d.timezone }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        eyebrow={d.workspaceName}
        title={`${greeting}, ${s.userName.split(" ")[0]}`}
        description="Here's what your AI Relationship Manager has been working on, and where your personal touch matters today."
        actions={
          <>
            <LinkButton href="/contacts/import" variant="secondary">
              Import contacts
            </LinkButton>
            <LinkButton href="/actions">
              Open action queue <ArrowRight />
            </LinkButton>
          </>
        }
      />

      {d.isDemo ? (
        <div className="mb-4 flex items-center gap-2 text-[12.5px] text-ink-muted">
          <Badge tone="sand">Demo metrics</Badge>
          All numbers below are computed live from the fictional KM Rojas Group demo database.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total contacts" value={d.stats.total} href="/contacts" icon={<Users />} />
        <Stat label="Past clients" value={d.stats.pastClients} href="/contacts?type=PAST_CLIENT" />
        <Stat label="Sphere of influence" value={d.stats.sphere} href="/contacts?type=SPHERE" />
        <Stat label="Reached this month" value={d.stats.reachedThisMonth} hint={d.isDemo ? "Includes simulated sends" : undefined} href="/analytics" />
        <Stat label="Campaigns scheduled" value={d.stats.campaignsScheduled} href="/campaigns" icon={<MailCheck />} />
        <Stat label="Upcoming birthdays" value={d.stats.upcomingBirthdays} hint="Next 30 days" href="/campaigns?tab=milestones" icon={<Cake />} />
        <Stat label="Home anniversaries" value={d.stats.upcomingAnniversaries} hint="Next 30 days" href="/campaigns?tab=milestones" icon={<Home />} />
        <Stat label="Replies needing you" value={d.stats.needsAttention} tone={d.stats.needsAttention ? "attention" : "default"} href="/inbox" icon={<Inbox />} />
        <Stat label="Referral opportunities" value={d.stats.referrals} href="/opportunities" icon={<Handshake />} />
        <Stat label="Appointments from nurture" value={d.stats.appointments} href="/opportunities" icon={<CalendarClock />} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Bot className="size-4 text-sage-600" /> AI Relationship Manager
              </span>
            }
            description={d.activity.lastReviewAt ? `Last daily review ${timeAgo(d.activity.lastReviewAt)} · past 7 days` : "No daily review has run yet"}
            action={d.isDemo ? <Badge tone="sand">Demo</Badge> : null}
          />
          <CardBody className="space-y-3">
            {[
              [d.activity.contactsReviewed, "contacts reviewed in the latest daily review", "/contacts"],
              [d.activity.birthdayMessages, "birthday messages prepared", "/campaigns?tab=milestones"],
              [d.activity.anniversaryMessages, "home anniversary messages prepared", "/campaigns?tab=milestones"],
              [d.activity.newslettersAwaitingApproval, `newsletter${d.activity.newslettersAwaitingApproval === 1 ? "" : "s"} awaiting your approval`, "/campaigns?tab=newsletters"],
              [d.activity.messagesAwaitingApproval, "personal messages awaiting approval", "/campaigns?tab=milestones"],
              [d.activity.tasksCreated, "follow-up tasks created for you", "/actions"],
            ].map(([n, label, href]) => (
              <Link key={String(label)} href={String(href)} className="flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-subtle">
                <span className="tabular w-9 text-right text-lg font-semibold text-ink">{n}</span>
                <span className="text-sm text-ink-muted">{label}</span>
              </Link>
            ))}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <ActionButton action={runPlannerAction} variant="secondary" pendingLabel="Reviewing…">
                <Sparkles /> Run daily review now
              </ActionButton>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader title="Today's relationship actions" description="Ranked by urgency, what people told you, and relationship priority." action={<LinkButton href="/actions" variant="ghost" size="sm">View all</LinkButton>} />
          {tasks.length ? (
            <ul className="divide-y divide-line">
              {tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/actions/${t.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-subtle/60">
                    <PriorityDot priority={t.priority} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{t.title}</div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ink-muted">{parseJsonArray<string>(t.reasonsJson).slice(0, 3).join(" · ")}</div>
                    </div>
                    {t.contact ? <TierBadge tier={t.contact.tier} /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="You're all caught up" description="New actions appear as milestones approach and replies arrive." />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming milestones" description="Next 30 days" action={<LinkButton href="/campaigns?tab=milestones" variant="ghost" size="sm">Manage</LinkButton>} />
          {d.milestones.length ? (
            <ul className="divide-y divide-line">
              {d.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand-50 text-clay-600">{m.type === "BIRTHDAY" ? <Cake className="size-4" /> : m.type === "HOME_ANNIVERSARY" ? <Home className="size-4" /> : <HeartHandshake className="size-4" />}</div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/contacts/${m.contact.id}`} className="block truncate text-sm font-medium hover:underline">
                      {m.contact.firstName} {m.contact.lastName}
                    </Link>
                    <div className="text-[12.5px] text-ink-muted">
                      {MILESTONE_LABEL[m.type as MilestoneType]}
                      {m.years ? ` · ${m.years} yr${m.years === 1 ? "" : "s"}` : ""} · {formatLocalDate(m.date, { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[12px] text-ink-faint">{relativeDays(m.daysAway)}</span>
                    {!m.verified ? <Badge tone="amber">Unverified</Badge> : m.message ? <Badge tone="sage">Prepared</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Cake />} title="No milestones in the next 30 days" description="Add birthdays and closing dates to contacts to enable milestone outreach." />
          )}
        </Card>

        <Card>
          <CardHeader title="Replies requiring attention" description="Classified by AI — always your call" action={<LinkButton href="/inbox" variant="ghost" size="sm">Open replies</LinkButton>} />
          {replies.length ? (
            <ul className="divide-y divide-line">
              {replies.slice(0, 5).map((r) => {
                const c = parseClassification(r.classificationJson);
                return (
                  <li key={r.id}>
                    <Link href={`/inbox#${r.id}`} className="block px-5 py-3 hover:bg-subtle/60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {r.contact.firstName} {r.contact.lastName}
                        </span>
                        <ClassificationBadge c={r.classification} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{c?.summary ?? r.body}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<Inbox />} title="No replies need attention" description="When contacts reply, AI summarizes and routes them here." />
          )}
        </Card>
      </div>
    </>
  );
}
