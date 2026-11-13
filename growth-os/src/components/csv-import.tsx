"use client";

import { Download, FileUp } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { commitImportAction, previewImportAction } from "@/actions/contacts";
import type { ActionResult } from "@/lib/server/action";
import type { ImportPreview } from "@/lib/server/contacts";
import { CSV_TEMPLATE_HEADERS } from "@/lib/domain/csv";
import { ActionForm, ResultMessage, SubmitButton } from "./action-form";
import { Badge, type Tone } from "./ui/badge";
import { Card, CardBody, CardHeader } from "./ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "./ui/form";
import { Notice } from "./ui/misc";

const SAMPLE = [
  CSV_TEMPLATE_HEADERS.join(","),
  'Jordan,Sample,jordan.sample@example.com,(602) 555-0190,Past Client,Buyer,Active,04/12,2021-06-18,"123 Example Ave, Phoenix, AZ",Arcadia,Phoenix,Email,yes,Closing paperwork opt-in,2021-06-18,2025-12-01,Loves hiking,Golf;Referral source',
  "Riley,Example,riley.example@example.net,480-555-0191,Sphere,,Standard,March 3,,,Tempe,Tempe,Email,,,,,,Neighbor",
].join("\n");

const STATUS: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "sage" },
  DUPLICATE: { label: "Already exists", tone: "sky" },
  DUPLICATE_IN_FILE: { label: "Duplicate in file", tone: "neutral" },
  CONFLICT: { label: "Conflict", tone: "amber" },
  INVALID: { label: "Error", tone: "rose" },
};

const FIELD_LABEL: Record<string, string> = {
  firstName: "First name", lastName: "Last name", fullName: "Full name", email: "Email", phone: "Phone", contactType: "Contact type", clientRole: "Client role", tier: "Tier", birthday: "Birthday", closingDate: "Closing date", propertyAddress: "Property address", neighborhood: "Neighborhood", city: "City", preferredChannel: "Preferred channel", emailConsent: "Email consent", consentSource: "Consent source", consentDate: "Consent date", lastCommunication: "Last communication", notes: "Notes", tags: "Tags",
};

export function CsvImport() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, previewAction] = useActionState<ActionResult | null, FormData>(previewImportAction, null);
  const [report, setReport] = useState<ActionResult | null>(null);
  const data = preview?.ok ? (preview.data as ImportPreview) : null;
  const [filter, setFilter] = useState<string>("ALL");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="1. Choose your file"
          description="Export contacts from your CRM or spreadsheet as CSV. Nothing is saved until you confirm the import."
          action={
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`} download="growth-os-contact-template.csv" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] hover:bg-subtle">
              <Download className="size-4" /> Template
            </a>
          }
        />
        <CardBody>
          <form action={previewAction} className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line-strong bg-subtle/50 px-6 py-8 text-center hover:border-sage-400 hover:bg-sage-50/40">
              <FileUp className="mb-2 size-6 text-sage-600" />
              <span className="text-sm font-medium">{fileName || "Select a .csv file"}</span>
              <span className="mt-1 text-[12.5px] text-ink-muted">Up to 5,000 contacts. Common column names are detected automatically.</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setFileName(f.name);
                  setCsv(await f.text());
                  setReport(null);
                }}
              />
            </label>
            <details>
              <summary className="cursor-pointer text-[13px] text-sage-700">Or paste CSV text</summary>
              <Textarea className="mt-2 font-mono text-[12px]" rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={SAMPLE} />
            </details>
            <input type="hidden" name="csv" value={csv} />
            <input type="hidden" name="fileName" value={fileName || "pasted.csv"} />
            <SubmitButton disabled={!csv.trim()} pendingLabel="Checking…">
              Validate & preview
            </SubmitButton>
            {!preview?.ok ? <ResultMessage result={preview} /> : null}
          </form>
        </CardBody>
      </Card>

      {data && !report?.ok ? (
        <>
          <Card>
            <CardHeader title="2. Review" description={`${data.fileName} · ${data.rows.length} rows`} />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Object.entries(data.counts).map(([k, n]) => (
                  <button key={k} type="button" onClick={() => setFilter(filter === k ? "ALL" : k)} className={`rounded-xl border px-3 py-2 text-left ${filter === k ? "border-sage-400 bg-sage-50" : "border-line bg-surface hover:bg-subtle"}`}>
                    <div className="tabular text-xl font-semibold">{n}</div>
                    <div className="text-[12px] text-ink-muted">{STATUS[k].label}</div>
                  </button>
                ))}
              </div>
              <div>
                <div className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-ink-faint">Column mapping</div>
                <div className="flex flex-wrap gap-1.5">
                  {data.headers.map((h) => (
                    <span key={h.header} className={`rounded-md border px-2 py-1 text-[12px] ${h.field ? "border-sage-200 bg-sage-50 text-sage-800" : "border-line bg-subtle text-ink-faint line-through"}`}>
                      {h.header} {h.field ? `→ ${FIELD_LABEL[h.field] ?? h.field}` : "(ignored)"}
                    </span>
                  ))}
                </div>
                {data.missingRecommended.length ? (
                  <Notice tone="warning" className="mt-3" title="Recommended columns not found">
                    {data.missingRecommended.map((f) => FIELD_LABEL[f] ?? f).join(", ")}. Contacts will still import; you can fill these in later.
                  </Notice>
                ) : null}
              </div>
              <div className="max-h-[440px] overflow-auto rounded-xl border border-line">
                <table className="w-full min-w-[720px] text-[13px]">
                  <thead className="sticky top-0 bg-subtle text-left text-[12px] text-ink-muted">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.rows
                      .filter((r) => filter === "ALL" || r.status === filter)
                      .map((r) => (
                        <tr key={r.rowNumber} className="align-top">
                          <td className="tabular px-3 py-2 text-ink-faint">{r.rowNumber}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.name || "—"}</div>
                            <div className="text-[12px] text-ink-faint">{r.email ?? r.row.phone ?? ""}</div>
                          </td>
                          <td className="px-3 py-2 text-ink-muted">{r.row.contactType === "PAST_CLIENT" ? "Past Client" : "Sphere"}</td>
                          <td className="px-3 py-2">
                            <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                          </td>
                          <td className="space-y-1 px-3 py-2 text-[12.5px]">
                            {r.errors.map((e, i) => (
                              <div key={i} className="text-rose-600">{e}</div>
                            ))}
                            {r.match ? (
                              <div className="text-ink-muted">
                                {r.match.reason ?? `Matches `}
                                <Link className="text-sage-700 underline" href={`/contacts/${r.match.id}`} target="_blank">
                                  {r.match.name}
                                </Link>
                                {r.match.on ? ` (by ${r.match.on})` : ""}
                                {r.match.fieldConflicts?.map((f) => (
                                  <div key={f.field} className="text-amber-600">
                                    {FIELD_LABEL[f.field] ?? f.field}: existing “{f.existing}” vs file “{f.incoming}”
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {r.warnings.map((w, i) => (
                              <div key={i} className="text-ink-faint">{w}</div>
                            ))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="3. Import" />
            <CardBody>
              <ActionForm
                action={commitImportAction}
                confirm={`Import ${data.counts.NEW} new contact${data.counts.NEW === 1 ? "" : "s"}? Rows with errors or conflicts are skipped.`}
                confirmLabel="Import"
                onResult={setReport}
                className="space-y-4"
              >
                <input type="hidden" name="csv" value={csv} />
                <input type="hidden" name="fileName" value={data.fileName} />
                <Checkbox name="datesVerified" label="Birthdays and closing dates in this file are verified" description="Leave unchecked unless the dates come from reliable records. Unverified dates create verification tasks instead of automated greetings." />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Existing contacts (duplicates)">
                    <Select name="duplicateStrategy" defaultValue="SKIP">
                      <option value="SKIP">Skip — leave existing records untouched</option>
                      <option value="FILL_EMPTY">Fill empty fields only — never overwrite</option>
                    </Select>
                  </Field>
                  <Field label="Tag imported contacts" hint="optional">
                    <Input name="tag" placeholder={`Import ${new Date().toLocaleDateString("en-US")}`} />
                  </Field>
                </div>
                <SubmitButton disabled={data.counts.NEW + data.counts.DUPLICATE === 0} pendingLabel="Importing…">
                  Import contacts
                </SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </>
      ) : null}

      {report?.ok ? (
        <Card>
          <CardHeader title="Import complete" />
          <CardBody className="space-y-3">
            <ResultMessage result={report} />
            {(report.data as { skipped: { rowNumber: number; reason: string }[] }).skipped.length ? (
              <ul className="max-h-60 space-y-1 overflow-auto text-[12.5px] text-ink-muted">
                {(report.data as { skipped: { rowNumber: number; reason: string }[] }).skipped.map((s) => (
                  <li key={s.rowNumber}>
                    Row {s.rowNumber}: {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[13px] text-ink-muted">Milestones, consent records and insights were created. The AI Relationship Manager already reviewed the new contacts.</p>
            <div className="flex gap-2">
              <Link href="/contacts?sort=recent" className="inline-flex h-9 items-center rounded-lg bg-sage-600 px-4 text-sm font-medium text-white hover:bg-sage-700">
                View contacts
              </Link>
              <button type="button" onClick={() => location.reload()} className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-4 text-sm hover:bg-subtle">
                Import another file
              </button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
