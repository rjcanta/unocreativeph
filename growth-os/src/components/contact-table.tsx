"use client";

import { Archive, Tag } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { archiveContactsAction, bulkTagAction } from "@/actions/contacts";
import { ActionForm, SubmitButton } from "./action-form";
import { ConsentBadge, TierBadge, TypeBadge } from "./badges";
import { Badge } from "./ui/badge";
import { Input, Select } from "./ui/form";

export type ContactRowView = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  contactType: string;
  tier: string;
  emailConsent: string;
  suppressed: boolean;
  neighborhood: string | null;
  lastTouch: string;
  nextMilestone: string | null;
  tags: string[];
  opportunity: string;
};

export function ContactTable({ rows, allIds, total, tags }: { rows: ContactRowView[]; allIds: string[]; total: number; tags: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const ids = [...selected];
  const hidden = ids.map((id) => <input key={id} type="hidden" name="ids" value={id} />);

  return (
    <div>
      {selected.size > 0 ? (
        <div className="sticky top-12 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 lg:top-2">
          <span className="text-sm font-medium text-sage-800">{selected.size} selected</span>
          {selected.size < total ? (
            <button type="button" className="text-[13px] text-sage-700 underline" onClick={() => setSelected(new Set(allIds))}>
              Select all {total} matching
            </button>
          ) : null}
          <button type="button" className="text-[13px] text-ink-muted underline" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ActionForm action={bulkTagAction} confirm={`Apply this tag change to ${selected.size} contact${selected.size === 1 ? "" : "s"}?`} confirmLabel="Apply" className="flex items-center gap-1.5" onResult={(r) => r.ok && setSelected(new Set())}>
              {hidden}
              <Input name="tag" list="tag-options" placeholder="Tag name" required className="h-8 w-36" />
              <datalist id="tag-options">
                {tags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Select name="mode" className="h-8 w-auto">
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </Select>
              <SubmitButton size="sm" variant="secondary">
                <Tag /> Apply
              </SubmitButton>
            </ActionForm>
            <ActionForm action={archiveContactsAction} confirm={`Archive ${selected.size} contact${selected.size === 1 ? "" : "s"}? Their pending messages will be cancelled. This removes them from all campaigns.`} confirmLabel="Archive" onResult={(r) => r.ok && setSelected(new Set())}>
              {hidden}
              <SubmitButton size="sm" variant="danger">
                <Archive /> Archive
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line bg-subtle/60 text-left text-[12px] font-medium text-ink-muted">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  className="size-4 accent-sage-600"
                  checked={allOnPage}
                  onChange={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (allOnPage) pageIds.forEach((id) => n.delete(id));
                      else pageIds.forEach((id) => n.add(id));
                      return n;
                    })
                  }
                />
              </th>
              <th className="px-2 py-2.5">Name</th>
              <th className="px-2 py-2.5">Relationship</th>
              <th className="px-2 py-2.5">Consent</th>
              <th className="px-2 py-2.5">Next milestone</th>
              <th className="px-2 py-2.5">Last touch</th>
              <th className="px-2 py-2.5">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-sage-50/60" : "hover:bg-subtle/50"}>
                <td className="px-4 py-2.5">
                  <input type="checkbox" aria-label={`Select ${r.name}`} className="size-4 accent-sage-600" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                </td>
                <td className="px-2 py-2.5">
                  <Link href={`/contacts/${r.id}`} className="font-medium text-ink hover:underline">
                    {r.name}
                  </Link>
                  <div className="truncate text-[12px] text-ink-faint">{r.email ?? r.phone ?? "No contact details"}</div>
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    <TypeBadge type={r.contactType} />
                    <TierBadge tier={r.tier} />
                    {r.opportunity !== "NONE" ? <Badge tone="sand">{r.opportunity === "POTENTIAL" ? "Potential opp." : r.opportunity.toLowerCase()}</Badge> : null}
                  </div>
                  {r.neighborhood ? <div className="mt-0.5 text-[12px] text-ink-faint">{r.neighborhood}</div> : null}
                </td>
                <td className="px-2 py-2.5">
                  <ConsentBadge status={r.emailConsent} suppressed={r.suppressed} />
                </td>
                <td className="px-2 py-2.5 text-[13px] text-ink-muted">{r.nextMilestone ?? "—"}</td>
                <td className="px-2 py-2.5 text-[13px] text-ink-muted">{r.lastTouch}</td>
                <td className="px-2 py-2.5">
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {r.tags.slice(0, 3).map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                    {r.tags.length > 3 ? <span className="text-[11px] text-ink-faint">+{r.tags.length - 3}</span> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
