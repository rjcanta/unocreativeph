import { Badge, type Tone } from "@/components/ui/badge";
import { CONTACT_TYPE_LABEL, REPLY_CLASSIFICATION_LABEL, TIER_LABEL, type ContactType, type ReplyClassification, type Tier } from "@/lib/domain/types";
import { humanize } from "@/lib/utils";

const TIER_TONE: Record<string, Tone> = { VIP: "sand", ACTIVE: "sage", STANDARD: "neutral", NEEDS_RECONNECTION: "amber" };
export const TierBadge = ({ tier }: { tier: string }) => <Badge tone={TIER_TONE[tier] ?? "neutral"}>{TIER_LABEL[tier as Tier] ?? tier}</Badge>;

export const TypeBadge = ({ type }: { type: string }) => (
  <Badge tone={type === "PAST_CLIENT" ? "sky" : "neutral"}>{type === "PAST_CLIENT" ? "Past Client" : (CONTACT_TYPE_LABEL[type as ContactType] ?? type).replace(" of Influence", "")}</Badge>
);

export function ConsentBadge({ status, suppressed }: { status: string; suppressed?: boolean }) {
  if (suppressed) return <Badge tone="rose">Suppressed</Badge>;
  if (status === "GRANTED") return <Badge tone="sage">Email consent</Badge>;
  if (status === "REVOKED") return <Badge tone="rose">Consent revoked</Badge>;
  return <Badge tone="amber">No consent</Badge>;
}

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "amber",
  APPROVED: "sky",
  SCHEDULED: "sage",
  SENT: "dark",
  SIMULATED: "sky",
  PAUSED: "amber",
  CANCELLED: "neutral",
  BLOCKED: "rose",
  FAILED: "rose",
  SKIPPED: "neutral",
  POSTPONED: "sand",
  SUPPRESSED: "rose",
  PENDING: "neutral",
  RUNNING: "sky",
  SUCCEEDED: "sage",
  DEAD: "rose",
  OPEN: "amber",
  DONE: "sage",
  DISMISSED: "neutral",
  POTENTIAL: "amber",
  CONFIRMED: "sage",
  APPOINTMENT_SET: "sky",
  WON: "dark",
  LOST: "neutral",
  NEW: "sky",
  NEEDS_ATTENTION: "amber",
  REVIEWED: "sage",
  ARCHIVED: "neutral",
  CONNECTED: "sage",
  DISCONNECTED: "neutral",
  ERROR: "rose",
  SUCCESS: "sage",
  PARTIAL: "amber",
};

const STATUS_LABEL: Record<string, string> = { PENDING_APPROVAL: "Awaiting approval", SIMULATED: "Simulated send", APPOINTMENT_SET: "Appointment set", NEEDS_ATTENTION: "Needs attention" };

export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? humanize(status)}</Badge>;

const CLS_TONE: Partial<Record<ReplyClassification, Tone>> = {
  GENERAL_FRIENDLY: "sage",
  POTENTIAL_BUYER: "sky",
  POTENTIAL_SELLER: "sand",
  POTENTIAL_INVESTOR: "sky",
  REFERRAL_OPPORTUNITY: "sand",
  FUTURE_OPPORTUNITY: "neutral",
  APPOINTMENT_REQUEST: "sky",
  NEGATIVE: "rose",
  OPT_OUT: "rose",
  REQUIRES_ATTENTION: "amber",
};
export const ClassificationBadge = ({ c }: { c: string | null }) =>
  c ? <Badge tone={CLS_TONE[c as ReplyClassification] ?? "neutral"}>{REPLY_CLASSIFICATION_LABEL[c as ReplyClassification] ?? c}</Badge> : <Badge>Unclassified</Badge>;

export const SourceBadge = ({ source }: { source: string }) =>
  source === "AI_OPENAI" ? <Badge tone="sky">AI · OpenAI</Badge> : source === "AI_MOCK" ? <Badge tone="neutral">AI · demo model</Badge> : source === "TEMPLATE" ? <Badge>Template</Badge> : <Badge>Edited by you</Badge>;

export function PriorityDot({ priority }: { priority: number }) {
  const tone = priority >= 70 ? "bg-clay-500" : priority >= 45 ? "bg-amber-600/70" : "bg-sage-400";
  return <span title={`Priority ${priority}`} className={`inline-block size-2 shrink-0 rounded-full ${tone}`} />;
}
