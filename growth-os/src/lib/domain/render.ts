/**
 * Merge-tag rendering and the CAN-SPAM footer. Rendering never invents data:
 * a missing value falls back to a neutral word, never a guess.
 */
import type { BrandVoice, ComplianceSettings } from "./settings";

export type MergeContext = {
  firstName?: string | null;
  lastName?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  agentName?: string | null;
  teamName?: string | null;
};

const FALLBACKS: Record<string, string> = {
  first_name: "there",
  last_name: "",
  neighborhood: "your neighborhood",
  city: "your area",
  agent_name: "",
  team_name: "",
};

export const MERGE_TAGS = Object.keys(FALLBACKS);

export function renderMergeTags(template: string, ctx: MergeContext): string {
  const values: Record<string, string | null | undefined> = {
    first_name: ctx.firstName,
    last_name: ctx.lastName,
    neighborhood: ctx.neighborhood,
    city: ctx.city,
    agent_name: ctx.agentName,
    team_name: ctx.teamName,
  };
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in FALLBACKS)) return match;
    const v = values[key];
    return v && v.trim() ? v.trim() : FALLBACKS[key];
  });
}

/** Unknown merge tags left in content — surfaced as a validation warning before approval. */
export function unknownMergeTags(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)) if (!MERGE_TAGS.includes(m[1])) found.add(m[1]);
  return [...found];
}

export function complianceFooter(compliance: ComplianceSettings, brand: BrandVoice): string {
  const lines = [
    "—",
    [brand.agentName, brand.teamName].filter(Boolean).join(" · "),
    compliance.physicalAddress || "[Physical mailing address required before live sending]",
    compliance.unsubscribeText,
    "Unsubscribe: {{unsubscribe_link}}",
  ];
  return lines.filter(Boolean).join("\n");
}

/** CAN-SPAM readiness for live commercial email. */
export function canSpamIssues(compliance: ComplianceSettings): string[] {
  const issues: string[] = [];
  if (!compliance.physicalAddress.trim()) issues.push("A valid physical postal address is required in every marketing email.");
  if (!compliance.senderName.trim()) issues.push("A sender name that identifies the agent or brokerage is required.");
  if (!compliance.senderEmail.trim()) issues.push("A sender email address is required.");
  if (!compliance.unsubscribeText.trim()) issues.push("A clear opt-out explanation is required.");
  return issues;
}
