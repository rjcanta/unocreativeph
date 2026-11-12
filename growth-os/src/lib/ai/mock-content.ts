/**
 * Deterministic content used when no AI key is configured (and as a fallback).
 * Everything here is evergreen: no market statistics, no named local businesses
 * or events, and no personal details beyond what the caller passes in.
 */
import { ordinal } from "@/lib/domain/dates";
import type { BrandVoice } from "@/lib/domain/settings";
import type { GreetingDraft, NewsletterDraft } from "./schemas";

type SeasonTips = { season: string; tips: string[]; community: string };

const DESERT_SEASONS: Record<number, SeasonTips> = {
  1: {
    season: "winter",
    tips: [
      "Cut back irrigation run times — most desert landscaping needs far less water in the cooler months.",
      "Test smoke and carbon monoxide detectors and note the date on the calendar.",
      "Winter is a comfortable time to tackle exterior projects like painting or patio repairs.",
    ],
    community: "the cooler weather that makes this the best season to get outside",
  },
  2: {
    season: "late winter",
    tips: [
      "Schedule an HVAC tune-up before contractors get busy ahead of the heat.",
      "Check exterior caulking and weatherstripping around doors and windows.",
      "Clean dryer vents — a simple job that reduces fire risk.",
    ],
    community: "spring events starting to pop up around town",
  },
  3: {
    season: "spring",
    tips: [
      "Replace HVAC filters and book a cooling-system check before the first hot week.",
      "Walk the roofline for cracked tiles or lifted shingles left over from winter storms.",
      "Spring is a good time to refresh mulch and check drip emitters.",
    ],
    community: "patio season and longer evenings",
  },
  4: {
    season: "spring",
    tips: [
      "Confirm your irrigation timer is set for warmer temperatures.",
      "Inspect window screens and door sweeps to keep pests outside.",
      "If you have a pool, test the chemistry more often as temperatures rise.",
    ],
    community: "the last stretch of perfect outdoor weather",
  },
  5: {
    season: "early summer",
    tips: [
      "Consider window coverings or solar screens on west-facing windows.",
      "Check attic insulation — it is one of the best defenses against summer cooling costs.",
      "Review pool safety: gates, alarms and covers.",
    ],
    community: "summer plans and staying cool",
  },
  6: {
    season: "summer",
    tips: [
      "Set the thermostat a few degrees higher when you're away and use ceiling fans when you're home.",
      "Keep an eye on outdoor faucets and hoses that can crack in extreme heat.",
      "Never leave pets, children, or electronics in parked cars.",
    ],
    community: "finding indoor spots to beat the heat",
  },
  7: {
    season: "monsoon season",
    tips: [
      "Clear roof drains and gutters before heavy storms arrive.",
      "Trim trees and large shrubs that could damage the house in high winds.",
      "Secure patio furniture and umbrellas when storms are in the forecast.",
    ],
    community: "monsoon evenings and the smell of rain on the desert",
  },
  8: {
    season: "monsoon season",
    tips: [
      "Plug key electronics into surge protectors during storm season.",
      "Check for water stains on ceilings after big storms — small leaks are cheaper to fix early.",
      "Keep a simple storm kit with flashlights and batteries handy.",
    ],
    community: "back-to-school season",
  },
  9: {
    season: "late summer",
    tips: [
      "Look for any storm damage around the roof, fences, and block walls.",
      "Plan fall landscaping — many desert plants do best when planted in autumn.",
      "Have the HVAC system checked after a long summer of heavy use.",
    ],
    community: "the first hints of cooler mornings",
  },
  10: {
    season: "fall",
    tips: [
      "Adjust irrigation timers as temperatures drop.",
      "Fall is a great time to plant trees, shrubs and wildflower seeds.",
      "Test your heating system before the first chilly night.",
    ],
    community: "fall festivals and getting back outside",
  },
  11: {
    season: "fall",
    tips: [
      "Inspect holiday lights for frayed wires before you hang them.",
      "Flush the water heater to remove sediment and keep it running efficiently.",
      "Clean the fireplace or have the chimney inspected if you plan to use it.",
    ],
    community: "gratitude, gatherings and the start of the holidays",
  },
  12: {
    season: "the holidays",
    tips: [
      "Have packages held or delivered to a secure location while you travel.",
      "Use timers on lights to keep the house looking lived-in.",
      "Keep candles and decorations a safe distance from anything flammable.",
    ],
    community: "the holidays and time with the people who matter most",
  },
};

const sign = (b: BrandVoice) => b.signature || [b.agentName, b.teamName].filter(Boolean).join("\n");

export function mockNewsletter(input: {
  kind: "MARKET_INSIGHTS" | "LIFESTYLE_COMMUNITY";
  month: number;
  monthLabel: string;
  brand: BrandVoice;
  verifiedMarketData?: string | null;
}): NewsletterDraft {
  const s = DESERT_SEASONS[input.month] ?? DESERT_SEASONS[1];
  const area = input.brand.marketArea || "our area";
  const tips = s.tips.map((t) => `• ${t}`).join("\n");
  const notes: string[] = [];

  if (input.kind === "MARKET_INSIGHTS") {
    const market = input.verifiedMarketData?.trim()
      ? `A few verified notes on the ${area} market this month:\n\n${input.verifiedMarketData.trim()}\n\nEvery neighborhood moves a little differently, so if you're curious what this means for your home specifically, just reply — I'm happy to look into it.`
      : `Rather than share numbers that may be out of date by the time this reaches your inbox, here's how I'd suggest reading the market right now:\n\n• Look at what's actually selling near you, not just what's listed.\n• Pay attention to how long homes sit before going under contract — it's one of the clearest signals of demand.\n• Interest rates and prices move together; what matters most is the monthly payment that fits your plans.\n\nIf you'd like a current, neighborhood-level picture for your home, reply and I'll put one together for you.`;
    if (!input.verifiedMarketData?.trim()) {
      notes.push("No verified market data was supplied, so this draft uses evergreen guidance instead of statistics.");
    }
    return {
      subject: `${input.monthLabel}: what's worth knowing about your home`,
      previewText: `A quick read on the market and a few ${s.season} homeowner tips.`,
      body: `Hi {{first_name}},\n\nI hope ${s.season} is treating you well. Here's my short note for ${input.monthLabel}.\n\nWHAT I'M WATCHING\n${market}\n\nHOMEOWNER TIPS FOR ${s.season.toUpperCase()}\n${tips}\n\nAs always, if a question about your home ever comes up — big or small — I'm just a reply away.\n\n${sign(input.brand)}`,
      topicsCovered: ["Housing market perspective", "Homeowner tips", "Neighborhood insights"],
      notes,
    };
  }

  notes.push("Community section avoids naming specific events or businesses; add verified local highlights before approving if you'd like.");
  return {
    subject: `${input.monthLabel} in ${area}: ${s.community.split(" and ")[0]}`,
    previewText: `Seasonal home ideas and a little community news.`,
    body: `Hi {{first_name}},\n\nThis time of year always reminds me of ${s.community}. I hope you and yours are doing well.\n\nAROUND THE COMMUNITY\nI love hearing about the local spots and traditions that make ${area} feel like home. If there's a small business, park or neighborhood event you think everyone should know about, hit reply — I'd love to feature reader favorites in a future note.\n\nSEASONAL HOME IDEAS\n${tips}\n\nTHANK YOU\nSo much of my work comes from people like you who stay in touch and introduce me to friends and family. I'm grateful for that every single month.\n\nWarmly,\n${sign(input.brand)}`,
    topicsCovered: ["Community happenings", "Seasonal homeowner advice", "Relationship-driven story"],
    notes,
  };
}

export function mockGreeting(input: {
  type: "BIRTHDAY" | "HOME_ANNIVERSARY" | "RELATIONSHIP_ANNIVERSARY" | "CUSTOM";
  firstName: string;
  isVip: boolean;
  years?: number | null;
  propertyLabel?: string | null;
  customLabel?: string | null;
  brand: BrandVoice;
}): GreetingDraft {
  const s = sign(input.brand);
  switch (input.type) {
    case "BIRTHDAY":
      return {
        subject: `Happy birthday, ${input.firstName}!`,
        body: `Hi ${input.firstName},\n\nWishing you a very happy birthday! I hope today is full of good food, good people and a little time to relax.${input.isVip ? "\n\nThank you for being such a wonderful part of my world — I'm grateful for you." : ""}\n\nCheers to a great year ahead,\n${s}`,
      };
    case "HOME_ANNIVERSARY": {
      const yrs = input.years && input.years > 0 ? `${ordinal(input.years)} ` : "";
      const home = input.propertyLabel ? ` at ${input.propertyLabel}` : "";
      return {
        subject: `Happy ${yrs}home anniversary, ${input.firstName}!`,
        body: `Hi ${input.firstName},\n\nCan you believe it's your ${yrs}home anniversary? I still remember handing over the keys${home}. I hope the house has been everything you wanted and more.\n\nIf you ever have questions about your home — projects, value, or anything else — I'm always happy to help.${input.isVip ? "\n\nThank you again for trusting me with such a big moment." : ""}\n\nHappy anniversary,\n${s}`,
      };
    }
    case "RELATIONSHIP_ANNIVERSARY":
      return {
        subject: `Thinking of you, ${input.firstName}`,
        body: `Hi ${input.firstName},\n\nIt's been ${input.years && input.years > 0 ? `${input.years} year${input.years === 1 ? "" : "s"}` : "a while"} since we first started working together, and I just wanted to say thank you. Relationships like ours are the best part of what I do.\n\nWarmly,\n${s}`,
      };
    default:
      return {
        subject: `${input.customLabel ?? "Thinking of you"}, ${input.firstName}`,
        body: `Hi ${input.firstName},\n\nJust wanted to send a quick note${input.customLabel ? ` for ${input.customLabel.toLowerCase()}` : ""}. I hope all is well with you.\n\n${s}`,
      };
  }
}
