import { Cake, CalendarDays, HeartHandshake, Home, Leaf, Mail, Sparkles } from "lucide-react";
import Link from "next/link";
import { approveMessageAction, createNewsletterAction, createSeasonalAction } from "@/actions/campaigns";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { SourceBadge, StatusBadge, TierBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Notice, PageHeader, Tabs } from "@/components/ui/misc";
import { defaultSeasonalDate, holidaysFor, SEASONAL_DEFAULTS } from "@/lib/domain/calendar";
import { addDays, dayOfWeek, formatLocalDate, makeLocalDate, parseLocalDate, toLocalDate, daysInMonth } from "@/lib/domain/dates";
import { describeSegment, parseSegment } from "@/lib/domain/segmentation";
import { MILESTONE_LABEL, type MilestoneType, type SeasonalKind } from "@/lib/domain/types";
import { listCampaigns } from "@/lib/server/campaigns";
import { listMessages, upcomingMilestones } from "@/lib/server/messaging";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { getWorkspace } from "@/lib/server/workspace";
import { aiStatus } from "@/lib/ai/provider";
import { cn, formatDate, relativeDays } from "@/lib/utils";

export const metadata = { title: "Nurture Campaigns" };

type CalItem = { date: string; label: string; href: string; tone: string };

function MonthCalendar({ month, items, today }: { month: string; items: CalItem[]; today: string }) {
  const { year, month: m } = parseLocalDate(`${month}-01`);
  const first = makeLocalDate(year, m, 1);
  const lead = dayOfWeek(first);
  const days = daysInMonth(year, m);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => makeLocalDate(year, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{formatLocalDate(first, { month: "long", year: "numeric" })}</div>
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line bg-line text-[12px]" style={{ gap: 1 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-subtle px-2 py-1.5 text-center font-medium text-ink-muted">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const dayItems = d ? items.filter((it) => it.date === d) : [];
          return (
            <div key={i} className={cn("min-h-[84px] bg-surface p-1.5", !d && "bg-subtle/40")}>
              {d ? (
                <>
                  <div className={cn("mb-1 flex size-5 items-center justify-center rounded-full text-[11px]", d === today ? "bg-sage-600 font-semibold text-white" : "text-ink-faint")}>{Number(d.slice(8))}</div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((it, idx) => (
                      <Link key={idx} href={it.href} className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] leading-4", it.tone)}>
                        {it.label}
                      </Link>
                    ))}
                    {dayItems.length > 3 ? <div className="px-1 text-[10.5px] text-ink-faint">+{dayItems.length - 3} more</div> : null}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function CampaignsPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const tab = sp(q.tab) || "overview";
  const ws = await getWorkspace(s);
  const today = toLocalDate(new Date(), ws.timezone);
  const [campaigns, milestones, pendingMessages, ai] = await Promise.all([
    listCampaigns(s),
    upcomingMilestones(s, 45),
    listMessages(s, { status: ["PENDING_APPROVAL"], category: "MILESTONE" }),
    Promise.resolve(aiStatus()),
  ]);
  const newsletters = campaigns.filter((c) => c.category === "NEWSLETTER");
  const seasonal = campaigns.filter((c) => c.category === "SEASONAL");
  const awaiting = campaigns.filter((c) => c.status === "PENDING_APPROVAL").length;

  const thisMonth = today.slice(0, 7);
  const nextMonth = addDays(`${thisMonth}-01`, 32).slice(0, 7);
  const scheduledMsgs = await listMessages(s, { status: ["SCHEDULED", "PENDING_APPROVAL"], category: "MILESTONE", from: new Date(`${thisMonth}-01T00:00:00Z`) });
  const calItems: CalItem[] = [
    ...campaigns
      .filter((c) => c.scheduledFor && !["CANCELLED"].includes(c.status))
      .map((c) => ({ date: toLocalDate(c.scheduledFor!, ws.timezone), label: c.name.split(" — ")[0], href: `/campaigns/${c.id}`, tone: c.category === "SEASONAL" ? "bg-sand-100 text-clay-600" : c.status === "SENT" ? "bg-subtle text-ink-muted" : "bg-sage-50 text-sage-800" })),
    ...scheduledMsgs.map((m) => ({ date: toLocalDate(m.scheduledFor, ws.timezone), label: `${m.kind === "BIRTHDAY" ? "🎂" : "🏡"} ${m.contact.firstName} ${m.contact.lastName[0] ?? ""}.`, href: `/messages/${m.id}`, tone: "bg-sky-50 text-sky-600" })),
  ];
  const nextNewsletterDate = (() => {
    const { year, month } = parseLocalDate(today);
    for (let i = 0; i < 3; i++) {
      const y = month + i > 12 ? year + 1 : year;
      const mm = ((month + i - 1) % 12) + 1;
      for (const d of ws.rules.newsletterDays) {
        const date = makeLocalDate(y, mm, d);
        if (date > today) return date;
      }
    }
    return addDays(today, 7);
  })();
  const year = parseLocalDate(today).year;

  return (
    <>
      <PageHeader
        title="Nurture Campaigns"
        description="Twice-monthly newsletters, four seasonal touch points, and personal milestone outreach — coordinated so nobody hears from you too often."
        actions={<Badge tone={ai.provider === "AI_OPENAI" ? "sky" : "neutral"}>{ai.provider === "AI_OPENAI" ? `AI: OpenAI ${ai.model}` : "AI: deterministic demo model (no API key)"}</Badge>}
      />
      <Tabs
        current={tab}
        items={[
          { key: "overview", label: "Calendar", href: "/campaigns" },
          { key: "newsletters", label: "Newsletters", href: "/campaigns?tab=newsletters", count: newsletters.filter((c) => !["SENT", "CANCELLED"].includes(c.status)).length },
          { key: "seasonal", label: "Seasonal", href: "/campaigns?tab=seasonal", count: seasonal.filter((c) => !["SENT", "CANCELLED"].includes(c.status)).length },
          { key: "milestones", label: "Milestones", href: "/campaigns?tab=milestones", count: pendingMessages.length },
        ]}
      />

      {tab === "overview" ? (
        <div className="space-y-6">
          {awaiting || pendingMessages.length ? (
            <Notice tone="warning" title="Waiting on your approval">
              {awaiting ? `${awaiting} campaign${awaiting === 1 ? "" : "s"}` : ""}
              {awaiting && pendingMessages.length ? " and " : ""}
              {pendingMessages.length ? `${pendingMessages.length} personal milestone message${pendingMessages.length === 1 ? "" : "s"}` : ""}. Nothing is sent until you approve it.
            </Notice>
          ) : null}
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><CalendarDays className="size-4 text-sage-600" /> Campaign calendar</span>}
              description={`Times shown in ${ws.timezone}. Green = newsletter · tan = seasonal · blue = milestone greeting.`}
            />
            <CardBody className="grid gap-6 xl:grid-cols-2">
              <MonthCalendar month={thisMonth} items={calItems} today={today} />
              <MonthCalendar month={nextMonth} items={calItems} today={today} />
            </CardBody>
          </Card>
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              { title: "Email newsletters", icon: <Mail className="size-4" />, text: `Twice monthly on the ${ws.rules.newsletterDays.map((d) => `${d}${d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}`).join(" and ")}: Market Insights, then Lifestyle & Community.`, href: "/campaigns?tab=newsletters" },
              { title: "Seasonal outreach", icon: <Leaf className="size-4" />, text: "Four per year. A seasonal send replaces a nearby routine newsletter to avoid over-communicating.", href: "/campaigns?tab=seasonal" },
              { title: "Personal milestones", icon: <Cake className="size-4" />, text: `Birthdays and home anniversaries take priority. Routine marketing is held ${ws.rules.milestoneBufferDays} days either side.`, href: "/campaigns?tab=milestones" },
            ].map((b) => (
              <Link key={b.title} href={b.href} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] hover:border-sage-200">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-sage-600">{b.icon}</span> {b.title}
                </div>
                <p className="mt-1.5 text-[13px] text-ink-muted">{b.text}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "newsletters" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader title="Newsletters" description="AI drafts are prepared automatically ~3 weeks ahead. You edit and approve every one." />
            {newsletters.length ? (
              <ul className="divide-y divide-line">
                {newsletters
                  .sort((a, b) => (b.scheduledFor?.getTime() ?? 0) - (a.scheduledFor?.getTime() ?? 0))
                  .map((c) => (
                    <li key={c.id}>
                      <Link href={`/campaigns/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="truncate text-[12.5px] text-ink-muted">
                            {c.subject} · {describeSegment(parseSegment(c.segmentJson))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <SourceBadge source={c.contentSource} />
                          <StatusBadge status={c.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
              </ul>
            ) : (
              <EmptyState icon={<Mail />} title="No newsletters yet" description="Create one, or run the daily review to have AI draft the next one." />
            )}
          </Card>
          <Card className="h-fit">
            <CardHeader title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-sage-600" /> Generate a newsletter</span>} description="AI never invents market statistics." />
            <CardBody>
              <ActionForm action={createNewsletterAction} redirectTo="/campaigns/{id}" className="space-y-3">
                <Field label="Type">
                  <Select name="kind" defaultValue="MARKET_INSIGHTS">
                    <option value="MARKET_INSIGHTS">Market Insights</option>
                    <option value="LIFESTYLE_COMMUNITY">Lifestyle & Community</option>
                  </Select>
                </Field>
                <Field label="Send date">
                  <Input type="date" name="sendDate" defaultValue={nextNewsletterDate} min={today} required />
                </Field>
                <Field label="Audience">
                  <div className="space-y-1.5 pt-1">
                    <Checkbox name="contactTypes" value="PAST_CLIENT" defaultChecked label="Past Clients" />
                    <Checkbox name="contactTypes" value="SPHERE" defaultChecked label="Sphere of Influence" />
                  </div>
                </Field>
                <Field label="Verified market data" hint="optional">
                  <Textarea name="verifiedMarketData" rows={4} placeholder="Paste figures from a source you trust (e.g. your MLS report). Only numbers you paste here may appear in the newsletter." />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Drafting…">
                  <Sparkles /> Generate draft
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "seasonal" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader
                title="Seasonal campaigns"
                description="Edit dates, content and recipients for each. Defaults follow your market calendar."
                action={
                  <ActionForm action={createSeasonalAction} showResult={false}>
                    <input type="hidden" name="year" value={year + 1} />
                    <SubmitButton size="sm" variant="secondary">
                      Prepare {year + 1}
                    </SubmitButton>
                  </ActionForm>
                }
              />
              {seasonal.length ? (
                <ul className="divide-y divide-line">
                  {seasonal.map((c) => (
                    <li key={c.id}>
                      <Link href={`/campaigns/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-sand-50 text-[12px] font-semibold text-clay-600">{SEASONAL_DEFAULTS[c.kind as SeasonalKind]?.quarter ?? "—"}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="text-[12.5px] text-ink-muted">
                            {c.scheduledFor ? formatDate(c.scheduledFor, ws.timezone, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "No date"} · {describeSegment(parseSegment(c.segmentJson))}
                            {c.replacesNewsletter ? " · replaces nearby newsletter" : ""}
                          </div>
                        </div>
                        <StatusBadge status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<Leaf />} title="No seasonal campaigns" action={<ActionButton action={createSeasonalAction} fields={{ year: String(year) }} variant="primary">Create {year} seasonal campaigns</ActionButton>} />
              )}
            </Card>
          </div>
          <Card className="h-fit">
            <CardHeader title="Market holiday calendar" description={`${ws.marketRegion === "US-AZ" ? "Arizona" : "United States"} · change in Settings`} />
            <CardBody className="space-y-4">
              <div>
                <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-faint">Default seasonal dates · {year + (parseLocalDate(today).month >= 11 ? 1 : 0)}</div>
                <ul className="space-y-1.5 text-[13px]">
                  {(Object.keys(SEASONAL_DEFAULTS) as SeasonalKind[]).map((k) => {
                    const y = year + (parseLocalDate(today).month >= 11 ? 1 : 0);
                    return (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="text-ink">{SEASONAL_DEFAULTS[k].name}</span>
                        <span className="shrink-0 text-ink-muted">{formatLocalDate(defaultSeasonalDate(k, y, ws.marketRegion))}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-faint">Upcoming holidays</div>
                <ul className="space-y-1 text-[13px]">
                  {[...holidaysFor(year, ws.marketRegion), ...holidaysFor(year + 1, ws.marketRegion)]
                    .filter((h) => h.date >= today)
                    .slice(0, 8)
                    .map((h) => (
                      <li key={h.key + h.date} className="flex justify-between gap-3">
                        <span className="text-ink-muted">{h.name}</span>
                        <span className="shrink-0 text-ink-faint">{formatLocalDate(h.date, { month: "short", day: "numeric", year: "numeric" })}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "milestones" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Messages awaiting approval" description="AI prepared these from verified dates. Approve to schedule, or edit first." />
            {pendingMessages.length ? (
              <ul className="divide-y divide-line">
                {pendingMessages.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/messages/${m.id}`} className="block truncate text-sm font-medium hover:underline">
                        {m.contact.firstName} {m.contact.lastName} — {MILESTONE_LABEL[m.kind as MilestoneType]?.toLowerCase()}
                      </Link>
                      <div className="truncate text-[12.5px] text-ink-muted">
                        {m.subject} · sends {formatDate(m.scheduledFor, ws.timezone, { weekday: "short", month: "short", day: "numeric", hour: "numeric" })}
                      </div>
                    </div>
                    <TierBadge tier={m.contact.tier} />
                    <div className="flex gap-1.5">
                      <LinkButton href={`/messages/${m.id}`} variant="secondary" size="sm">
                        Review
                      </LinkButton>
                      <ActionButton action={approveMessageAction} fields={{ id: m.id }} variant="primary" showResult={false}>
                        Approve
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Cake />} title="Nothing waiting" description="Greetings are prepared about two weeks ahead of each verified milestone." />
            )}
          </Card>
          <Card>
            <CardHeader title="Upcoming milestones" description="Next 45 days — birthdays never need a birth year; Feb 29 follows your leap-day rule." />
            {milestones.length ? (
              <ul className="divide-y divide-line">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sand-50 text-clay-600">{m.type === "BIRTHDAY" ? <Cake className="size-4" /> : m.type === "HOME_ANNIVERSARY" ? <Home className="size-4" /> : <HeartHandshake className="size-4" />}</div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/contacts/${m.contact.id}`} className="block truncate text-sm font-medium hover:underline">
                        {m.contact.firstName} {m.contact.lastName}
                      </Link>
                      <div className="text-[12.5px] text-ink-muted">
                        {m.type === "CUSTOM" ? m.label : MILESTONE_LABEL[m.type as MilestoneType]}
                        {m.years ? ` · ${m.years} yr${m.years === 1 ? "" : "s"}` : ""} · {formatLocalDate(m.date, { weekday: "short", month: "short", day: "numeric" })} · {relativeDays(m.daysAway)}
                      </div>
                    </div>
                    {m.contact.doNotContact ? (
                      <Badge tone="rose">Do not contact</Badge>
                    ) : !m.verified ? (
                      <Badge tone="amber">Needs verification</Badge>
                    ) : m.message ? (
                      <Link href={`/messages/${m.message.id}`}>
                        <StatusBadge status={m.message.status} />
                      </Link>
                    ) : m.daysAway <= ws.rules.milestoneLookaheadDays ? (
                      <Badge>Personal touch</Badge>
                    ) : (
                      <Badge>Prepares {relativeDays(m.daysAway - ws.rules.milestoneLookaheadDays).toLowerCase()}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No upcoming milestones" />
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
