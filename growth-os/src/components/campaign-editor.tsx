"use client";

import { useState } from "react";
import { saveCampaignAction } from "@/actions/campaigns";
import { renderMergeTags, MERGE_TAGS } from "@/lib/domain/render";
import { ActionForm, SubmitButton } from "./action-form";
import { Card, CardBody, CardHeader } from "./ui/card";
import { Checkbox, Field, Input, Textarea } from "./ui/form";

export type EditorProps = {
  id: string;
  editable: boolean;
  isApproved: boolean;
  name: string;
  subject: string;
  previewText: string;
  body: string;
  sendDate: string;
  minDate: string;
  category: string;
  replacesNewsletter: boolean;
  verifiedMarketData: string;
  segment: { contactTypes: string[]; tiers: string[]; clientRoles: string[]; tagsAny: string[]; neighborhoods: string[] };
  tags: string[];
  neighborhoods: string[];
  sample: { firstName: string; lastName: string; neighborhood: string | null; city: string | null; agentName: string; teamName: string };
  footer: string;
};

function Group({ title, name, options, selected, disabled }: { title: string; name: string; options: [string, string][]; selected: string[]; disabled: boolean }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-ink-muted">{title}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {options.map(([value, label]) => (
          <Checkbox key={value} name={name} value={value} defaultChecked={selected.includes(value)} label={label} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

export function CampaignEditor(p: EditorProps) {
  const [subject, setSubject] = useState(p.subject);
  const [body, setBody] = useState(p.body);
  const ctx = p.sample;
  const dis = !p.editable;

  return (
    <ActionForm action={saveCampaignAction} confirm={p.isApproved ? "This campaign is approved. Saving changes to content, audience or date will reset approval and cancel unsent messages until you approve again." : undefined} confirmLabel="Save & reset approval" className="grid gap-6 xl:grid-cols-2">
      <input type="hidden" name="id" value={p.id} />
      <Card>
        <CardHeader title="Content" description={`Merge tags: ${MERGE_TAGS.map((t) => `{{${t}}}`).join(" ")}`} />
        <CardBody className="space-y-4">
          <Field label="Campaign name">
            <Input name="name" defaultValue={p.name} disabled={dis} />
          </Field>
          <Field label="Subject line">
            <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={dis} required />
          </Field>
          <Field label="Preview text" hint="shown in the inbox after the subject">
            <Input name="previewText" defaultValue={p.previewText} disabled={dis} />
          </Field>
          <Field label="Body">
            <Textarea name="body" rows={16} value={body} onChange={(e) => setBody(e.target.value)} disabled={dis} required />
          </Field>
          {p.category === "NEWSLETTER" ? (
            <Field label="Verified market data" hint="the only source of statistics allowed in this email">
              <Textarea name="verifiedMarketData" rows={3} defaultValue={p.verifiedMarketData} disabled={dis} placeholder="e.g. Per ARMLS (Oct 2026): …" />
            </Field>
          ) : (
            <input type="hidden" name="verifiedMarketData" value={p.verifiedMarketData} />
          )}
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Preview" description={`As ${ctx.firstName} ${ctx.lastName} would see it`} />
          <CardBody>
            <div className="rounded-xl border border-line bg-canvas p-4">
              <div className="text-[12px] text-ink-faint">Subject</div>
              <div className="text-sm font-semibold">{renderMergeTags(subject, ctx)}</div>
              <div className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{renderMergeTags(body, ctx)}</div>
              <div className="mt-4 whitespace-pre-wrap border-t border-line pt-3 text-[11.5px] text-ink-faint">{p.footer}</div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Audience & timing" />
          <CardBody className="space-y-4">
            <Field label="Send date">
              <Input type="date" name="sendDate" defaultValue={p.sendDate} min={p.minDate} disabled={dis} />
            </Field>
            <Group title="Contact type (none = everyone)" name="contactTypes" options={[["PAST_CLIENT", "Past Clients"], ["SPHERE", "Sphere"]]} selected={p.segment.contactTypes} disabled={dis} />
            <Group title="Relationship tier" name="tiers" options={[["VIP", "VIP"], ["ACTIVE", "Active"], ["STANDARD", "Standard"], ["NEEDS_RECONNECTION", "Needs Reconnection"]]} selected={p.segment.tiers} disabled={dis} />
            <Group title="Past client role" name="clientRoles" options={[["BUYER", "Buyers"], ["SELLER", "Sellers"], ["BUYER_SELLER", "Both"]]} selected={p.segment.clientRoles} disabled={dis} />
            {p.tags.length ? <Group title="Tags (any)" name="tagsAny" options={p.tags.map((t) => [t, t])} selected={p.segment.tagsAny} disabled={dis} /> : null}
            {p.neighborhoods.length ? <Group title="Neighborhoods" name="neighborhoods" options={p.neighborhoods.map((n) => [n, n])} selected={p.segment.neighborhoods} disabled={dis} /> : null}
            <Checkbox name="replacesNewsletter" defaultChecked={p.replacesNewsletter} disabled={dis} label="Replaces a nearby routine newsletter" description="Recipients won't also get a regular newsletter within the configured window." />
            {p.editable ? <SubmitButton>Save changes</SubmitButton> : <p className="text-[12.5px] text-ink-faint">This campaign can no longer be edited.</p>}
          </CardBody>
        </Card>
      </div>
    </ActionForm>
  );
}
