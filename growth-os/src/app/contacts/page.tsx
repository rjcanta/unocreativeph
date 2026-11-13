import { Plus, Search, Upload, Users } from "lucide-react";
import Link from "next/link";
import { ContactTable, type ContactRowView } from "@/components/contact-table";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader, Tabs } from "@/components/ui/misc";
import { formatLocalDate } from "@/lib/domain/dates";
import { formatPhone } from "@/lib/domain/normalize";
import { TIERS, TIER_LABEL } from "@/lib/domain/types";
import { listContacts, listTags, type ContactFilters } from "@/lib/server/contacts";
import { prisma } from "@/lib/server/db";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const filters: ContactFilters = {
    q: sp(q.q),
    type: sp(q.type),
    tier: sp(q.tier),
    consent: (sp(q.consent) || undefined) as ContactFilters["consent"],
    tag: sp(q.tag),
    opportunity: sp(q.opportunity),
    milestone: sp(q.milestone) === "UPCOMING_30" ? "UPCOMING_30" : undefined,
    sort: (sp(q.sort) || "name") as ContactFilters["sort"],
    page: Number(sp(q.page) || 1),
  };
  const [result, tags, typeCounts] = await Promise.all([
    listContacts(s, filters, s.timezone),
    listTags(s),
    prisma.contact.groupBy({ by: ["contactType"], where: { workspaceId: s.workspaceId, deletedAt: null }, _count: true }),
  ]);
  const totalAll = typeCounts.reduce((a, b) => a + b._count, 0);
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, sp(v)])), ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const str = p.toString();
    return str ? `/contacts?${str}` : "/contacts";
  };

  const rows: ContactRowView[] = result.rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    email: r.email,
    phone: formatPhone(r.phone),
    contactType: r.contactType,
    tier: r.tier,
    emailConsent: r.emailConsent,
    suppressed: r.suppressed,
    neighborhood: r.neighborhood,
    lastTouch: timeAgo(r.lastCommunicationAt),
    nextMilestone: r.nextMilestone ? `${r.nextMilestone.type === "BIRTHDAY" ? "Birthday" : "Home anniv."} · ${formatLocalDate(r.nextMilestone.date)}` : null,
    tags: r.tagNames,
    opportunity: r.opportunityStatus,
  }));

  const filtered = Object.entries(filters).some(([k, v]) => !["sort", "page", "type"].includes(k) && v);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Your past clients and sphere of influence. Consent is tracked per contact — being a past client is never treated as permission to market."
        actions={
          <>
            <LinkButton href="/contacts/import" variant="secondary">
              <Upload /> Import CSV
            </LinkButton>
            <LinkButton href="/contacts/new">
              <Plus /> Add contact
            </LinkButton>
          </>
        }
      />
      <Tabs
        current={filters.type || "ALL"}
        items={[
          { key: "ALL", label: "All contacts", href: qs({ type: undefined, page: 1 }), count: totalAll },
          { key: "PAST_CLIENT", label: "Past Clients", href: qs({ type: "PAST_CLIENT", page: 1 }), count: typeCounts.find((t) => t.contactType === "PAST_CLIENT")?._count ?? 0 },
          { key: "SPHERE", label: "Sphere of Influence", href: qs({ type: "SPHERE", page: 1 }), count: typeCounts.find((t) => t.contactType === "SPHERE")?._count ?? 0 },
        ]}
      />
      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(5,auto)]">
        {filters.type ? <input type="hidden" name="type" value={filters.type} /> : null}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input name="q" defaultValue={filters.q} placeholder="Search name, email, phone, neighborhood…" className="pl-9" />
        </div>
        <Select name="tier" defaultValue={filters.tier}>
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select name="consent" defaultValue={filters.consent ?? ""}>
          <option value="">Any consent</option>
          <option value="GRANTED">Email consent</option>
          <option value="UNKNOWN">No consent recorded</option>
          <option value="REVOKED">Consent revoked</option>
          <option value="SUPPRESSED">Suppressed (DNC / unsubscribed)</option>
        </Select>
        <Select name="tag" defaultValue={filters.tag}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name} ({t._count.contacts})
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={filters.sort}>
          <option value="name">Sort: name</option>
          <option value="nextMilestone">Sort: next milestone</option>
          <option value="lastContact">Sort: longest since contact</option>
          <option value="recent">Sort: recently added</option>
        </Select>
        <div className="flex gap-2">
          <button className="h-9 flex-1 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink/90">Apply</button>
          {filtered ? (
            <Link href={filters.type ? `/contacts?type=${filters.type}` : "/contacts"} className="flex h-9 items-center rounded-lg px-2 text-sm text-ink-muted hover:bg-subtle">
              Reset
            </Link>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-muted sm:col-span-2 lg:col-span-6">
          <input type="checkbox" name="milestone" value="UPCOMING_30" defaultChecked={filters.milestone === "UPCOMING_30"} className="size-4 accent-sage-600" />
          Only contacts with a birthday or home anniversary in the next 30 days
        </label>
      </form>

      {result.total ? (
        <>
          <ContactTable rows={rows} allIds={result.allIds} total={result.total} tags={tags.map((t) => t.name)} />
          <div className="mt-3 flex items-center justify-between text-[13px] text-ink-muted">
            <span>
              {(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.total)} of {result.total}
            </span>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link href={qs({ page: result.page - 1 })} className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-subtle">
                  Previous
                </Link>
              ) : null}
              {result.page < result.pages ? (
                <Link href={qs({ page: result.page + 1 })} className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-subtle">
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={<Users />}
            title={totalAll ? "No contacts match these filters" : "No contacts yet"}
            description={totalAll ? "Try clearing a filter or searching for something else." : "Import your database from a CSV or add your first contact."}
            action={totalAll ? <LinkButton href="/contacts" variant="secondary">Clear filters</LinkButton> : <LinkButton href="/contacts/import">Import contacts</LinkButton>}
          />
        </Card>
      )}
    </>
  );
}
