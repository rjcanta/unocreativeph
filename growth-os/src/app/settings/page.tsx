import { PauseCircle, PlayCircle, RotateCcw } from "lucide-react";
import { brandVoiceAction, complianceAction, liveSendingAction, pauseSendingAction, resetDemoAction, schedulingAction } from "@/actions/settings";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice, PageHeader } from "@/components/ui/misc";
import { MARKETS } from "@/lib/domain/calendar";
import { appMode } from "@/lib/server/context";
import { liveSendBlockers } from "@/lib/server/delivery";
import { getCrmProvider } from "@/lib/server/integrations";
import { session } from "@/lib/server/page";
import { getWorkspace } from "@/lib/server/workspace";
import { aiStatus } from "@/lib/ai/provider";

export const metadata = { title: "Settings" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hours = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);

export default async function SettingsPage() {
  const s = await session();
  const ws = await getWorkspace(s);
  const { integration, provider } = await getCrmProvider(s);
  const blockers = liveSendBlockers(ws, integration, provider?.capabilities().SEND_EMAIL.state ?? null);
  const b = ws.brand;
  const c = ws.compliance;
  const r = ws.rules;
  const ai = aiStatus();

  return (
    <>
      <PageHeader title="Settings" description={`${ws.name} · ${ws.timezone} · ${appMode() === "demo" ? "Demo Mode" : "Live mode"}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card id="brand">
            <CardHeader title="Brand voice" description={`Every AI draft follows this voice. Provider: ${ai.provider === "AI_OPENAI" ? `OpenAI (${ai.model})` : "deterministic demo model — set OPENAI_API_KEY to use OpenAI"}.`} />
            <CardBody>
              <ActionForm action={brandVoiceAction} className="grid gap-4 sm:grid-cols-2">
                <Field label="Agent name">
                  <Input name="agentName" defaultValue={b.agentName} required />
                </Field>
                <Field label="Team / brokerage">
                  <Input name="teamName" defaultValue={b.teamName} />
                </Field>
                <Field label="Market area" hint="used in newsletters" className="sm:col-span-2">
                  <Input name="marketArea" defaultValue={b.marketArea} placeholder="the Phoenix metro" />
                </Field>
                <Field label="Tone" className="sm:col-span-2">
                  <Textarea name="tone" rows={2} defaultValue={b.tone} />
                </Field>
                <Field label="Signature" className="sm:col-span-2">
                  <Textarea name="signature" rows={3} defaultValue={b.signature} />
                </Field>
                <Field label="Phrases you like" hint="one per line">
                  <Textarea name="phrasesToUse" rows={4} defaultValue={b.phrasesToUse.join("\n")} />
                </Field>
                <Field label="Phrases to avoid" hint="one per line">
                  <Textarea name="phrasesToAvoid" rows={4} defaultValue={b.phrasesToAvoid.join("\n")} />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton>Save brand voice</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>

          <Card id="compliance">
            <CardHeader title="Compliance" description="CAN-SPAM details appear in every marketing email. SMS stays off until a TCPA and state-law review is recorded." />
            <CardBody>
              <ActionForm action={complianceAction} className="grid gap-4 sm:grid-cols-2">
                <Field label="Physical mailing address" hint="required by CAN-SPAM" className="sm:col-span-2">
                  <Input name="physicalAddress" defaultValue={c.physicalAddress} placeholder="Brokerage street address, city, state, ZIP" />
                </Field>
                <Field label="Sender name">
                  <Input name="senderName" defaultValue={c.senderName} />
                </Field>
                <Field label="Sender email">
                  <Input name="senderEmail" type="email" defaultValue={c.senderEmail} />
                </Field>
                <Field label="Opt-out explanation" className="sm:col-span-2">
                  <Textarea name="unsubscribeText" rows={2} defaultValue={c.unsubscribeText} />
                </Field>
                <div className="space-y-3 sm:col-span-2">
                  <Checkbox name="requireApprovalForMilestones" defaultChecked={c.requireApprovalForMilestones} label="Require my approval for every milestone message" description="Recommended. When off, verified milestone greetings are scheduled automatically (consent checks still apply)." />
                  <Checkbox name="smsEnabled" defaultChecked={c.smsEnabled} label="Enable SMS workflows" description="Requires the review date below. SMS delivery is not implemented in this module; this records readiness only." />
                </div>
                <Field label="TCPA / state-law review completed" hint="date">
                  <Input type="date" name="smsLegalReviewCompletedAt" defaultValue={c.smsLegalReviewCompletedAt ?? ""} />
                </Field>
                <div className="sm:col-span-2">
                  <SubmitButton>Save compliance settings</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>

          <Card id="scheduling">
            <CardHeader title="Scheduling rules" description="Deterministic rules decide what is sent and when. Every decision is explained on the campaign page." />
            <CardBody>
              <ActionForm action={schedulingAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Time zone (IANA)">
                  <Input name="timezone" defaultValue={ws.timezone} required />
                </Field>
                <Field label="Market calendar">
                  <Select name="marketRegion" defaultValue={ws.marketRegion}>
                    {Object.entries(MARKETS).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Max routine messages / month">
                  <Input type="number" name="maxRoutinePerMonth" min={0} max={8} defaultValue={r.maxRoutinePerMonth} />
                </Field>
                <Field label="Newsletter day 1">
                  <Input type="number" name="newsletterDay1" min={1} max={28} defaultValue={r.newsletterDays[0] ?? 6} />
                </Field>
                <Field label="Newsletter day 2">
                  <Input type="number" name="newsletterDay2" min={1} max={28} defaultValue={r.newsletterDays[1] ?? 20} />
                </Field>
                <Field label="Milestone quiet window (± days)">
                  <Input type="number" name="milestoneBufferDays" min={0} max={30} defaultValue={r.milestoneBufferDays} />
                </Field>
                <Field label="When a newsletter conflicts">
                  <Select name="routineConflictAction" defaultValue={r.routineConflictAction}>
                    <option value="POSTPONE">Postpone it</option>
                    <option value="SKIP">Skip it</option>
                  </Select>
                </Field>
                <Field label="Seasonal replaces newsletter within (days)">
                  <Input type="number" name="seasonalReplaceWindowDays" min={0} max={31} defaultValue={r.seasonalReplaceWindowDays} />
                </Field>
                <Field label="Milestone prep lookahead (days)">
                  <Input type="number" name="milestoneLookaheadDays" min={1} max={60} defaultValue={r.milestoneLookaheadDays} />
                </Field>
                <Field label="Sending window opens">
                  <Select name="sendWindowStartHour" defaultValue={r.sendWindowStartHour}>
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sending window closes">
                  <Select name="sendWindowEndHour" defaultValue={r.sendWindowEndHour}>
                    {hours.slice(1).map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Milestone greetings send at">
                  <Select name="milestoneSendHour" defaultValue={r.milestoneSendHour}>
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Feb 29 birthdays in other years">
                  <Select name="leapDayRule" defaultValue={r.leapDayRule}>
                    <option value="FEB_28">Observe Feb 28</option>
                    <option value="MAR_1">Observe Mar 1</option>
                  </Select>
                </Field>
                <Field label="Reconnect after (days)">
                  <Input type="number" name="reconnectAfterDays" min={30} max={730} defaultValue={r.reconnectAfterDays} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="mb-1.5 text-[13px] font-medium">Marketing send days</div>
                  <div className="flex flex-wrap gap-4">
                    {DAYS.map((d, i) => (
                      <Checkbox key={d} name="marketingDays" value={String(i)} defaultChecked={r.marketingDays.includes(i)} label={d} />
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Checkbox name="seasonalReplacesNewsletter" defaultChecked={r.seasonalReplacesNewsletter} label="Seasonal campaigns replace a nearby routine newsletter" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <SubmitButton>Save scheduling rules</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={ws.sendingPaused ? "border-rose-600/30" : undefined}>
            <CardHeader title="Pause all sending" description="Immediate. Scheduled messages wait until you resume — nothing is lost." />
            <CardBody>
              {ws.sendingPaused ? (
                <ActionButton action={pauseSendingAction} fields={{ paused: "false" }} variant="primary" size="md">
                  <PlayCircle /> Resume sending
                </ActionButton>
              ) : (
                <ActionButton action={pauseSendingAction} fields={{ paused: "true" }} variant="danger" size="md" confirm="Pause all outbound messages for this workspace right now?" confirmLabel="Pause sending">
                  <PauseCircle /> Pause everything
                </ActionButton>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Live sending" action={ws.liveSendingEnabled ? <Badge tone="sage">On</Badge> : <Badge>Off</Badge>} />
            <CardBody className="space-y-3">
              {blockers.length ? (
                <Notice tone="warning" title="Live sends are blocked">
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {blockers.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </Notice>
              ) : (
                <Notice tone="success" title="All live-send gates pass" />
              )}
              <ActionButton action={liveSendingAction} fields={{ enabled: String(!ws.liveSendingEnabled) }} variant="secondary" disabled={!ws.liveSendingEnabled && (ws.isDemo || appMode() === "demo")}>
                {ws.liveSendingEnabled ? "Turn off live sending" : "Turn on live sending"}
              </ActionButton>
            </CardBody>
          </Card>

          {ws.isDemo ? (
            <Card>
              <CardHeader title="Demo data" description="Recreate the fictional KM Rojas Group workspace with fresh, date-relative data." />
              <CardBody>
                <ActionButton action={resetDemoAction} variant="danger" confirm="Reset the demo workspace? All demo contacts, campaigns, tasks and history will be replaced with fresh fictional data." confirmLabel="Reset demo" pendingLabel="Resetting…">
                  <RotateCcw /> Reset demo data
                </ActionButton>
                <p className="mt-2 text-[12px] text-ink-faint">CLI: npm run demo:reset</p>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
