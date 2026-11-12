/**
 * Guards against fabricated facts in AI content.
 *
 * Market content may only contain statistics that appear in agent-verified data.
 * We flag percentages, dollar figures, and "N days on market"-style figures that
 * cannot be traced to the verified text supplied by the agent.
 */

const STAT_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s?%/g, // 4.2%  12 %
  /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|million|thousand|b|billion)?\b/gi, // $450,000  $1.2M
  /\b\d[\d,]*(?:\.\d+)?\s+(?:days? on market|homes? sold|listings?|sales|transactions)\b/gi,
  /\b(?:median|average)\s+(?:sale|sales|home|list|listing)?\s*price\s+(?:of|is|was|at|rose|fell|hit)\s+[^\s.]+/gi,
];

export function extractStatistics(text: string): string[] {
  const out = new Set<string>();
  for (const re of STAT_PATTERNS) for (const m of text.matchAll(re)) out.add(m[0].trim());
  return [...out];
}

const canon = (s: string) => s.toLowerCase().replace(/[\s,$]/g, "");

/** Statistics present in `text` that are not present in `verifiedData`. */
export function findUnverifiedStatistics(text: string, verifiedData: string | null | undefined): string[] {
  const verified = canon(verifiedData ?? "");
  return extractStatistics(text).filter((stat) => {
    const numbers = stat.match(/\d[\d,.]*/g) ?? [];
    return !numbers.every((n) => verified.includes(canon(n)));
  });
}

export function findAvoidedPhrases(text: string, phrasesToAvoid: string[]): string[] {
  const lower = text.toLowerCase();
  return phrasesToAvoid.filter((p) => p.trim() && lower.includes(p.toLowerCase()));
}
