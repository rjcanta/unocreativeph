/**
 * Deterministic reply classifier.
 *
 * Used (1) as the full classifier when no AI key is configured, and (2) as a
 * safety net that ALWAYS runs: opt-out language is honored even if an AI model
 * says otherwise.
 */
import type { ReplyClassification } from "@/lib/domain/types";
import type { ReplyClassificationResult } from "./schemas";

const RE = {
  optOut:
    /(^\s*stop\s*\.?\s*$)|\b(unsubscribe|stop (?:emailing|sending|contacting)|remove me|take me off|opt(?:\s|-)?out|do not (?:email|contact)|don'?t (?:email|contact) me|no more emails?)\b/i,
  negative: /\b(not interested|annoying|spam|leave me alone|no thanks|not happy|disappointed|waste of)\b/i,
  thirdParty:
    /\b(?:my|our)\s+(friend|best friend|sister|brother|mom|mother|dad|father|parents|son|daughter|coworker|co-worker|neighbor|neighbour|cousin|boss|colleague|in-laws?|aunt|uncle|niece|nephew|roommate)\b/i,
  thirdPartyActivity: /^\s*(?:and (?:her|his|their) \w+\s+)?(?:is|are|'s|was|were|wants?|needs?|might|may|will|plans?|planning|thinking|looking|asked|has been|have been|just)\b[^.!?]*\b(buy\w*|sell\w*|mov(?:e|ing)|relocat\w*|house hunting|look(?:ing)? for (?:a )?(?:home|house|place|agent|realtor)|agent|realtor)\b/i,
  referralAsk: /\b(recommend (?:an? )?(?:agent|realtor|you)|who (?:could|can) help|pass (?:your|along your) (?:info|name|number)|give (?:them|her|him) your (?:info|number))\b/i,
  appointment:
    /\b(can we (?:meet|talk|chat|get together|set up|hop on)|schedule (?:a|some) (?:time|call|meeting)|grab (?:a )?coffee|are you free|set up a (?:call|time|meeting)|walk ?through|come (?:by|over)|give (?:me|us) a call|call (?:me|us)|let'?s (?:meet|talk|chat))\b/i,
  seller:
    /\b(sell(?:ing)? (?:our|my|the)?\s*(?:home|house|place|condo|property)?|may sell|might sell|thinking (?:of|about) selling|list(?:ing)? (?:our|my|the) (?:home|house|place)|put (?:our|the|my) (?:house|home) on the market|what(?:'s| is) (?:our|my) (?:home|house|place) worth|downsiz\w*)\b/i,
  buyer:
    /\b(buy(?:ing)? (?:a|our|another)?\s*(?:home|house|condo|place|property)|looking (?:for|at) (?:a )?(?:new |bigger |smaller )?(?:home|house|condo|place|property)|bigger (?:home|house|place)|house hunting|move up|first home|purchase (?:a|another))\b/i,
  investor: /\b(invest\w*|rental (?:property|properties|home|unit)|airbnb|short[- ]term rental|cash flow|duplex|triplex|fourplex|1031)\b/i,
  future: /\b(someday|eventually|in a few years|down the road|retire\w*|thinking about moving|might move|planning to move|plan to move|when the kids)\b/i,
  attention:
    /\b(passed away|funeral|divorce|lost (?:my|our) job|hospital|surgery|complain\w*|upset|problem with|issue with|leak\w*|warranty|repair|urgent|asap)\b/i,
  friendly: /\b(thank(?:s| you)|appreciate|love(?:d)?|great to hear|happy (?:holidays|thanksgiving|new year|birthday)|so sweet|made my day|hope you)\b/i,
  timeframe:
    /\b(next (?:year|spring|summer|fall|autumn|winter|month|few months)|this (?:year|spring|summer|fall|autumn|winter|month)|in (?:a few|a couple(?: of)?|\d+|two|three|four|six|several) (?:months?|years?|weeks?)|(?:early|late|mid)[- ](?:\d{4}|next year)|by (?:the )?(?:end of (?:the |this )?year|summer|spring|fall)|in \d{4}|within (?:a|the next) (?:year|few months)|after (?:the )?(?:holidays|school year|new year))\b/i,
};

const ACTIONS: Record<ReplyClassification, string> = {
  GENERAL_FRIENDLY: "Send a short personal thank-you when convenient. No sales follow-up needed.",
  POTENTIAL_BUYER: "Call to understand their timing and needs before suggesting anything.",
  POTENTIAL_SELLER: "Call to learn their plans and timeline; offer a no-pressure conversation about their options.",
  POTENTIAL_INVESTOR: "Reach out personally to learn their investment goals.",
  REFERRAL_OPPORTUNITY: "Thank them, then ask permission before contacting the person they mentioned.",
  FUTURE_OPPORTUNITY: "Note the stated plan and set a reminder to check in ahead of their timeframe.",
  APPOINTMENT_REQUEST: "Reply personally today to find a time that works.",
  NEGATIVE: "Respond personally and respectfully; consider reducing communication frequency.",
  OPT_OUT: "Contact has been unsubscribed. Do not send further marketing email.",
  REQUIRES_ATTENTION: "Read the full message and respond personally.",
};

function suggestedReply(cls: ReplyClassification, firstName: string, agentName: string, timeframe: string | null, person: string | null): string {
  const sign = agentName ? `\n\n${agentName}` : "";
  switch (cls) {
    case "OPT_OUT":
      return "";
    case "POTENTIAL_SELLER":
      return `Hi ${firstName}, thanks so much for letting me know${timeframe ? ` — ${timeframe} will be here before we know it` : ""}. Whenever it's helpful, I'm happy to talk through options and timing with no pressure at all. Would a quick call sometime in the next couple of weeks work?${sign}`;
    case "POTENTIAL_BUYER":
      return `Hi ${firstName}, how exciting! I'd love to hear more about what you're looking for and your timing. Would a quick call this week work?${sign}`;
    case "POTENTIAL_INVESTOR":
      return `Hi ${firstName}, thanks for sharing that. I'd be glad to talk through what you have in mind and what's worked for other clients. Want to set up a time to chat?${sign}`;
    case "REFERRAL_OPPORTUNITY":
      return `Hi ${firstName}, thank you for thinking of me — that means a lot. If ${person ?? "they"} would like to talk, I'd be happy to help. Is it okay if I reach out, or would you prefer to share my number with them?${sign}`;
    case "APPOINTMENT_REQUEST":
      return `Hi ${firstName}, absolutely — I'd love to. What days and times work best for you?${sign}`;
    case "FUTURE_OPPORTUNITY":
      return `Hi ${firstName}, thanks for sharing your plans! Whenever you're ready to start thinking it through, I'm here to help.${sign}`;
    case "NEGATIVE":
      return `Hi ${firstName}, thank you for the honest feedback — I appreciate it. I'll make sure you only hear from me when it's truly useful.${sign}`;
    case "REQUIRES_ATTENTION":
      return `Hi ${firstName}, thank you for reaching out. I want to make sure I give this the attention it deserves — I'll follow up personally shortly.${sign}`;
    default:
      return `Hi ${firstName}, it was so good to hear from you! Thanks for the kind note.${sign}`;
  }
}

function firstSentenceMatching(text: string, re: RegExp): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return (sentences.find((s) => re.test(s)) ?? text).trim().slice(0, 300);
}

export type ClassifyInput = { text: string; firstName: string; agentName?: string };

export function classifyReplyWithRules({ text, firstName, agentName = "" }: ClassifyInput): ReplyClassificationResult {
  const hits: { cls: ReplyClassification; re: RegExp }[] = [];
  // A referral needs a third person who is the subject of the real estate
  // activity ("my sister is relocating"), not just mentioned ("move near my parents").
  const third = RE.thirdParty.exec(text);
  const afterThird = third ? text.slice(third.index + third[0].length, third.index + third[0].length + 70) : "";
  const isReferral = (!!third && RE.thirdPartyActivity.test(afterThird)) || RE.referralAsk.test(text);

  if (RE.optOut.test(text)) hits.push({ cls: "OPT_OUT", re: RE.optOut });
  if (RE.negative.test(text)) hits.push({ cls: "NEGATIVE", re: RE.negative });
  if (isReferral) hits.push({ cls: "REFERRAL_OPPORTUNITY", re: third ? RE.thirdParty : RE.referralAsk });
  if (RE.appointment.test(text)) hits.push({ cls: "APPOINTMENT_REQUEST", re: RE.appointment });
  if (!isReferral && RE.seller.test(text)) hits.push({ cls: "POTENTIAL_SELLER", re: RE.seller });
  if (!isReferral && RE.buyer.test(text)) hits.push({ cls: "POTENTIAL_BUYER", re: RE.buyer });
  if (RE.investor.test(text)) hits.push({ cls: "POTENTIAL_INVESTOR", re: RE.investor });
  if (!isReferral && RE.future.test(text) && !hits.some((h) => h.cls === "POTENTIAL_SELLER" || h.cls === "POTENTIAL_BUYER")) {
    hits.push({ cls: "FUTURE_OPPORTUNITY", re: RE.future });
  }
  if (RE.attention.test(text)) hits.push({ cls: "REQUIRES_ATTENTION", re: RE.attention });
  if (!hits.length && RE.friendly.test(text)) hits.push({ cls: "GENERAL_FRIENDLY", re: RE.friendly });
  if (!hits.length) hits.push({ cls: text.includes("?") ? "REQUIRES_ATTENTION" : "GENERAL_FRIENDLY", re: /./ });

  // Opt-out always wins. Sensitive personal news outranks opportunity language.
  const primary =
    hits.find((h) => h.cls === "OPT_OUT") ??
    hits.find((h) => h.cls === "REQUIRES_ATTENTION" && RE.attention.test(text) && /passed away|funeral|divorce|hospital|lost (?:my|our) job/i.test(text)) ??
    hits[0];

  const timeframe = RE.timeframe.exec(text)?.[0] ?? null;
  const person = third ? `their ${third[1].toLowerCase()}` : null;
  const secondary = [...new Set(hits.map((h) => h.cls).filter((c) => c !== primary.cls))].slice(0, 3);

  const summaries: Record<ReplyClassification, string> = {
    GENERAL_FRIENDLY: `${firstName} sent a friendly reply.`,
    POTENTIAL_BUYER: `${firstName} mentioned possibly buying${timeframe ? ` (${timeframe})` : ""}.`,
    POTENTIAL_SELLER: `${firstName} mentioned they may sell${timeframe ? ` (${timeframe})` : ""}.`,
    POTENTIAL_INVESTOR: `${firstName} mentioned interest in investment property${timeframe ? ` (${timeframe})` : ""}.`,
    REFERRAL_OPPORTUNITY: `${firstName} mentioned ${person ?? "someone"} who may need real estate help${timeframe ? ` (${timeframe})` : ""}.`,
    FUTURE_OPPORTUNITY: `${firstName} mentioned a possible future move${timeframe ? ` (${timeframe})` : ""}.`,
    APPOINTMENT_REQUEST: `${firstName} asked to meet or talk.`,
    NEGATIVE: `${firstName} replied negatively.`,
    OPT_OUT: `${firstName} asked to stop receiving emails.`,
    REQUIRES_ATTENTION: `${firstName}'s reply needs a personal response.`,
  };

  return {
    classification: primary.cls,
    secondary,
    confidence: primary.cls === "OPT_OUT" ? 0.95 : primary.cls === "GENERAL_FRIENDLY" ? 0.7 : 0.75,
    summary: summaries[primary.cls],
    timeframe,
    mentionedPerson: person,
    evidenceQuote: firstSentenceMatching(text, primary.re),
    recommendedAction: ACTIONS[primary.cls],
    suggestedReply: suggestedReply(primary.cls, firstName, agentName, timeframe, person),
  };
}

export function detectOptOut(text: string): boolean {
  return RE.optOut.test(text);
}
