/**
 * AI provider abstraction.
 *
 * - With OPENAI_API_KEY: OpenAI Chat Completions with strict JSON-schema
 *   structured outputs, validated again with zod, plus grounding checks.
 * - Without a key (or if a response fails validation): deterministic mock
 *   outputs. The result always says which path produced it.
 *
 * The AI drafts and classifies. It never decides eligibility, scheduling,
 * or whether anything is sent — those are deterministic business rules.
 */
import type { BrandVoice } from "@/lib/domain/settings";
import { findAvoidedPhrases, findUnverifiedStatistics } from "./grounding";
import { mockGreeting, mockNewsletter } from "./mock-content";
import { classifyReplyWithRules, detectOptOut } from "./rules-classifier";
import {
  greetingDraftSchema,
  jsonSchemas,
  newsletterDraftSchema,
  replyClassificationSchema,
  type GreetingDraft,
  type NewsletterDraft,
  type ReplyClassificationResult,
} from "./schemas";

export type AiSource = "AI_OPENAI" | "AI_MOCK";
export type AiResult<T> = { data: T; source: AiSource; warnings: string[] };

export type NewsletterInput = {
  kind: "MARKET_INSIGHTS" | "LIFESTYLE_COMMUNITY";
  month: number;
  monthLabel: string;
  brand: BrandVoice;
  verifiedMarketData?: string | null;
  topics: string[];
};

export type GreetingInput = {
  type: "BIRTHDAY" | "HOME_ANNIVERSARY" | "RELATIONSHIP_ANNIVERSARY" | "CUSTOM";
  firstName: string;
  isVip: boolean;
  years?: number | null;
  propertyLabel?: string | null;
  customLabel?: string | null;
  /** Only verified, agent-entered notes. Never inferred facts. */
  verifiedNotes?: string[];
  brand: BrandVoice;
};

export type ReplyInput = {
  text: string;
  firstName: string;
  contactType: string;
  tier: string;
  brand: BrandVoice;
};

export interface AiProvider {
  readonly name: AiSource;
  generateNewsletter(input: NewsletterInput): Promise<AiResult<NewsletterDraft>>;
  generateGreeting(input: GreetingInput): Promise<AiResult<GreetingDraft>>;
  classifyReply(input: ReplyInput): Promise<AiResult<ReplyClassificationResult>>;
}

export class MockAiProvider implements AiProvider {
  readonly name = "AI_MOCK" as const;
  async generateNewsletter(input: NewsletterInput) {
    return { data: newsletterDraftSchema.parse(mockNewsletter(input)), source: this.name, warnings: [] };
  }
  async generateGreeting(input: GreetingInput) {
    return { data: greetingDraftSchema.parse(mockGreeting(input)), source: this.name, warnings: [] };
  }
  async classifyReply(input: ReplyInput) {
    const data = replyClassificationSchema.parse(
      classifyReplyWithRules({ text: input.text, firstName: input.firstName, agentName: input.brand.agentName }),
    );
    return { data, source: this.name, warnings: [] };
  }
}

const voiceBlock = (b: BrandVoice) =>
  [
    `Agent: ${b.agentName}${b.teamName ? ` (${b.teamName})` : ""}`,
    `Voice: ${b.tone}`,
    b.phrasesToUse.length ? `Phrases the agent likes: ${b.phrasesToUse.join("; ")}` : "",
    b.phrasesToAvoid.length ? `Never use: ${b.phrasesToAvoid.join("; ")}` : "",
    `Sign-off:\n${b.signature || b.agentName}`,
  ]
    .filter(Boolean)
    .join("\n");

const GROUNDING_RULES = `Hard rules:
- Never invent statistics, prices, percentages, rates, days-on-market, or sales counts. Only use numbers that appear verbatim in VERIFIED DATA.
- Never invent personal history, family members, property details, events, or local businesses.
- Never claim a conversation happened unless it is in the provided notes.
- Warm, natural, non-salesy. No urgency or pressure language.`;

export class OpenAiProvider implements AiProvider {
  readonly name = "AI_OPENAI" as const;
  private fallback = new MockAiProvider();
  constructor(
    private apiKey: string,
    private model: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async complete(system: string, user: string, schemaName: string, schema: object): Promise<unknown> {
    const res = await this.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`OpenAI request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
    const msg = json.choices?.[0]?.message;
    if (msg?.refusal) throw new Error(`OpenAI refused: ${msg.refusal}`);
    if (!msg?.content) throw new Error("OpenAI returned no content");
    return JSON.parse(msg.content);
  }

  async generateNewsletter(input: NewsletterInput): Promise<AiResult<NewsletterDraft>> {
    try {
      const raw = await this.complete(
        `You write twice-monthly relationship newsletters for a US real estate agent's past clients and sphere of influence.\n${voiceBlock(input.brand)}\n${GROUNDING_RULES}\nUse the merge tag {{first_name}} for the greeting. Plain text with short sections in CAPS. Under 350 words.`,
        `Newsletter type: ${input.kind === "MARKET_INSIGHTS" ? "Market Insights (trends, market updates, homeowner tips, neighborhood insights)" : "Lifestyle & Community (community happenings, local highlights, seasonal homeowner advice, relationship stories)"}\nMonth: ${input.monthLabel}\nMarket area: ${input.brand.marketArea || "not specified"}\nTopics: ${input.topics.join(", ") || "default"}\nVERIFIED DATA:\n${input.verifiedMarketData?.trim() || "(none — use evergreen guidance and invite readers to ask for current local data)"}\nIn "notes", tell the agent anything they should verify or add before approving.`,
        "newsletter_draft",
        jsonSchemas.newsletter,
      );
      const data = newsletterDraftSchema.parse(raw);
      const unverified = findUnverifiedStatistics(`${data.subject}\n${data.body}`, input.verifiedMarketData);
      if (unverified.length) throw new Error(`Draft contained unverified statistics: ${unverified.join(", ")}`);
      const avoided = findAvoidedPhrases(data.body, input.brand.phrasesToAvoid);
      return {
        data,
        source: this.name,
        warnings: avoided.length ? [`Contains phrases your brand voice avoids: ${avoided.join(", ")}`] : [],
      };
    } catch (err) {
      const fb = await this.fallback.generateNewsletter(input);
      return { ...fb, warnings: [`OpenAI draft rejected (${(err as Error).message}). A deterministic draft was used instead.`] };
    }
  }

  async generateGreeting(input: GreetingInput): Promise<AiResult<GreetingDraft>> {
    try {
      const raw = await this.complete(
        `You write short personal milestone messages from a real estate agent to someone they know.\n${voiceBlock(input.brand)}\n${GROUNDING_RULES}\nUnder 120 words. Use the contact's actual first name, not merge tags. No selling.`,
        `Milestone: ${input.type}${input.customLabel ? ` (${input.customLabel})` : ""}\nFirst name: ${input.firstName}\nVIP relationship: ${input.isVip ? "yes" : "no"}\n${input.years ? `Years: ${input.years}\n` : ""}${input.propertyLabel ? `Home: ${input.propertyLabel}\n` : ""}Verified notes you may reference:\n${input.verifiedNotes?.length ? input.verifiedNotes.map((n) => `- ${n}`).join("\n") : "(none — do not reference any personal details)"}`,
        "greeting_draft",
        jsonSchemas.greeting,
      );
      const data = greetingDraftSchema.parse(raw);
      const unverified = findUnverifiedStatistics(data.body, "");
      if (unverified.length) throw new Error(`Greeting contained figures: ${unverified.join(", ")}`);
      return { data, source: this.name, warnings: [] };
    } catch (err) {
      const fb = await this.fallback.generateGreeting(input);
      return { ...fb, warnings: [`OpenAI greeting rejected (${(err as Error).message}). Template used instead.`] };
    }
  }

  async classifyReply(input: ReplyInput): Promise<AiResult<ReplyClassificationResult>> {
    const rules = classifyReplyWithRules({ text: input.text, firstName: input.firstName, agentName: input.brand.agentName });
    try {
      const raw = await this.complete(
        `You triage replies that a real estate agent's past clients and sphere send to relationship emails.\nClassify conservatively: real estate intent is only POTENTIAL unless explicitly stated. Never treat speculation as confirmed intent.\nIf the person asks to stop receiving messages, classification must be OPT_OUT.\nevidenceQuote must be copied verbatim from the reply. suggestedReply is a draft for the agent to edit, in this voice:\n${voiceBlock(input.brand)}\nFor OPT_OUT, suggestedReply must be an empty string.`,
        `Contact first name: ${input.firstName}\nContact type: ${input.contactType}\nTier: ${input.tier}\nReply:\n"""${input.text}"""`,
        "reply_classification",
        jsonSchemas.reply,
      );
      const data = replyClassificationSchema.parse(raw);
      if (data.evidenceQuote && !input.text.includes(data.evidenceQuote.slice(0, 40))) {
        data.evidenceQuote = rules.evidenceQuote;
      }
      // Deterministic safety net: explicit opt-out language always wins.
      if (detectOptOut(input.text) && data.classification !== "OPT_OUT") {
        return { data: { ...rules, classification: "OPT_OUT" }, source: this.name, warnings: ["Opt-out language detected by rules; overrode model classification."] };
      }
      return { data, source: this.name, warnings: [] };
    } catch (err) {
      return { data: rules, source: "AI_MOCK", warnings: [`OpenAI classification failed (${(err as Error).message}). Rules-based classification used.`] };
    }
  }
}

let cached: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY?.trim();
  cached = key ? new OpenAiProvider(key, process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini") : new MockAiProvider();
  return cached;
}

export function aiStatus(): { provider: AiSource; model: string | null } {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? { provider: "AI_OPENAI", model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini" } : { provider: "AI_MOCK", model: null };
}
