import { KeyRound, Plug, RefreshCw, Unplug } from "lucide-react";
import { connectLiveAction, connectMockAction, disconnectAction, syncAction } from "@/actions/settings";
import { ActionButton, ActionForm, SubmitButton } from "@/components/action-form";
import { StatusBadge } from "@/components/badges";
import { Badge, type Tone } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { EmptyState, KeyValue, Notice, PageHeader } from "@/components/ui/misc";
import { CAPABILITY_LABEL, type Capability } from "@/lib/crm/types";
import { getIntegrationView } from "@/lib/server/integrations";
import { session } from "@/lib/server/page";
import { formatDateTime, humanize, timeAgo } from "@/lib/utils";

export const metadata = { title: "Integrations" };

const CAP_TONE: Record<string, Tone> = { AVAILABLE: "sage", SIMULATED: "sky", NOT_VERIFIED: "amber", REQUIRES_CONFIGURATION: "neutral" };
const CAP_LABEL: Record<string, string> = { AVAILABLE: "Available", SIMULATED: "Simulated", NOT_VERIFIED: "Disabled — not verified", REQUIRES_CONFIGURATION: "Needs configuration" };

export default async function IntegrationsPage() {
  const s = await session();
  const i = await getIntegrationView(s);
  const liveAllowed = i.appMode === "live" && !s.isDemo;

  return (
    <>
      <PageHeader title="Integrations" description="Connect a HighLevel (GoHighLevel) sub-account. Tokens are encrypted on the server and never sent to the browser." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Plug className="size-4 text-sage-600" /> HighLevel</span>}
              description={i.mode === "MOCK" ? "Mock adapter — fictional data, no external calls" : "Live connection via Private Integration Token"}
              action={<StatusBadge status={i.status} />}
            />
            <CardBody className="space-y-4">
              <KeyValue
                items={[
                  ["Mode", i.status === "DISCONNECTED" ? "—" : i.mode === "MOCK" ? <Badge tone="sky">Mock (Demo Mode)</Badge> : <Badge tone="sage">Live</Badge>],
                  ["Account", i.accountName ?? "—"],
                  ["Location ID", i.locationId ?? "—"],
                  ["Auth method", i.authMethod ? humanize(i.authMethod) : "—"],
                  ["Credentials stored", i.hasCredentials ? "Yes (encrypted)" : "No"],
                  ["Linked contacts", i.mapped],
                  ["Last sync", i.lastSyncAt ? `${formatDateTime(i.lastSyncAt, s.timezone)} (${timeAgo(i.lastSyncAt)})` : "Never"],
                  ["Live sending via CRM", i.liveSendEnabled ? "Enabled" : "Disabled"],
                ]}
              />
              {i.lastError ? <Notice tone="danger" title="Last error">{i.lastError}</Notice> : null}
              <div className="flex flex-wrap gap-2">
                {i.status === "DISCONNECTED" || i.status === "ERROR" ? (
                  <ActionButton action={connectMockAction} variant="primary" size="md">
                    Connect mock adapter
                  </ActionButton>
                ) : (
                  <>
                    <ActionButton action={syncAction} variant="primary" size="md" pendingLabel="Syncing…">
                      <RefreshCw /> Sync contacts now
                    </ActionButton>
                    <ActionButton action={disconnectAction} variant="danger" size="md" confirm="Disconnect HighLevel? Stored credentials will be deleted. Contact links are kept so a reconnect won't duplicate anyone." confirmLabel="Disconnect">
                      <Unplug /> Disconnect
                    </ActionButton>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Capabilities" description="Only verified operations are enabled. Nothing reports success unless it actually happened." />
            <ul className="divide-y divide-line">
              {(Object.keys(i.capabilities) as Capability[]).map((k) => (
                <li key={k} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{CAPABILITY_LABEL[k]}</div>
                    <div className="text-[12.5px] text-ink-muted">{i.capabilities[k].note}</div>
                  </div>
                  <Badge tone={CAP_TONE[i.capabilities[k].state]}>{CAP_LABEL[i.capabilities[k].state]}</Badge>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Sync log" />
            {i.logs.length ? (
              <ul className="divide-y divide-line">
                {i.logs.map((l) => (
                  <li key={l.id} className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-[12px]">{l.action}</code>
                      <StatusBadge status={l.status} />
                      <span className="ml-auto text-[12px] text-ink-faint">{formatDateTime(l.createdAt, s.timezone)}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-muted">{l.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No sync activity yet" />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><KeyRound className="size-4" /> Live connection</span>} description="Private Integration Token for one sub-account" />
            <CardBody className="space-y-3">
              {!liveAllowed ? (
                <Notice tone="info" title="Disabled in Demo Mode">
                  Live connections require APP_MODE=live and a non-demo workspace. See docs/highlevel-integration.md.
                </Notice>
              ) : null}
              {!i.encryptionConfigured ? <Notice tone="warning">CREDENTIALS_ENCRYPTION_KEY is not set, so tokens cannot be stored.</Notice> : null}
              <ActionForm action={connectLiveAction} className="space-y-3">
                <Field label="Private Integration Token">
                  <Input name="token" type="password" autoComplete="off" disabled={!liveAllowed} placeholder="pit-…" />
                </Field>
                <Field label="Location (sub-account) ID">
                  <Input name="locationId" disabled={!liveAllowed} />
                </Field>
                <SubmitButton disabled={!liveAllowed || !i.encryptionConfigured} variant="secondary">
                  Test & connect
                </SubmitButton>
              </ActionForm>
              <p className="text-[12px] text-ink-faint">Create the token in HighLevel → Settings → Private Integrations with the contacts.readonly scope. Write scopes stay unused until those endpoints are verified.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Webhooks" />
            <CardBody className="space-y-2 text-[13px] text-ink-muted">
              <p>
                Endpoint: <code className="text-[12px] text-ink">/api/webhooks/highlevel</code>
              </p>
              <p>Inbound events are accepted only with a valid signature (configure GHL_WEBHOOK_PUBLIC_KEY). Events are deduplicated by their message ID.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
