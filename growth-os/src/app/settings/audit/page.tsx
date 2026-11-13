import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { session, sp, type SearchParams } from "@/lib/server/page";
import { listAuditLogs } from "@/lib/server/settings";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Audit log" };

const ENTITIES = ["Contact", "Campaign", "ScheduledMessage", "CommunicationEvent", "AgentTask", "Opportunity", "AutomationJob", "Integration", "Workspace", "Import", "Tag"];

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const s = await session();
  const q = await searchParams;
  const logs = await listAuditLogs(s, { entityType: sp(q.entity) || undefined, action: sp(q.action) || undefined, limit: 300 });
  return (
    <>
      <PageHeader title="Audit log" description="Every outbound communication, approval, consent change and automation outcome — who or what did it, and when." />
      <form className="mb-4 flex flex-wrap gap-2">
        <Select name="entity" defaultValue={sp(q.entity)} className="w-auto">
          <option value="">All records</option>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>
        <Input name="action" defaultValue={sp(q.action)} placeholder="Action contains… (e.g. CONSENT)" className="w-64" />
        <button className="h-9 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-subtle">Filter</button>
      </form>
      <Card>
        {logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="bg-subtle text-left text-[12px] text-ink-muted">
                <tr>
                  <th className="px-5 py-2">When</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">Status change</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-2 text-ink-muted">{formatDateTime(l.createdAt, s.timezone)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={l.actorType === "USER" ? "sage" : l.actorType === "AI" ? "sky" : "neutral"}>{humanize(l.actorType)}</Badge>
                    </td>
                    <td className="px-3 py-2 font-medium">{humanize(l.action)}</td>
                    <td className="px-3 py-2 text-ink-muted">{l.entityType}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-muted">{l.fromStatus || l.toStatus ? `${l.fromStatus ?? "—"} → ${l.toStatus ?? "—"}` : ""}</td>
                    <td className="max-w-[320px] px-3 py-2">
                      {l.detailsJson !== "{}" ? <code className="line-clamp-2 break-all text-[11.5px] text-ink-faint">{l.detailsJson}</code> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ShieldCheck />} title="No audit entries match" />
        )}
      </Card>
    </>
  );
}
