import type { Metadata } from "next";
import Image from "next/image";
import { ValuationWizard } from "@/components/valuation-wizard";
import { Faq } from "@/components/faq";
import { ButtonLink, Eyebrow, PageHero, Section, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "What's My Home Worth? | Free Phoenix Home Valuation",
  description:
    "Get a written home valuation based on real comparable sales in your neighborhood — not an automated estimate. Free, no obligation, delivered within one business day.",
};

const differences = [
  {
    title: "Automated estimates",
    points: [
      "Guesses from tax records and ZIP-level averages",
      "Blind to your renovations, lot position or views",
      "Can be off by 10–20% on non-standard properties",
      "No one to explain the number",
    ],
    tone: "muted" as const,
  },
  {
    title: "Kelly's valuation",
    points: [
      "Built from the actual comparable sales closest to you",
      "Adjusted for your updates, condition and lot",
      "Reflects what's under contract right now, not last quarter",
      "Written, explained, and yours to keep",
    ],
    tone: "gold" as const,
  },
];

const faqs = [
  {
    question: "Is this really free? What's the catch?",
    answer:
      "It's free and there's no obligation. Preparing a valuation takes about 30 minutes of my time, and some of the people I send them to eventually list with me. Most don't, and that's fine — it's how I'd want to be treated.",
  },
  {
    question: "How is this different from Zillow's Zestimate?",
    answer:
      "Automated valuation models work from public records and broad averages. They can't see that you replaced the roof, that your lot backs to a wash instead of an arterial road, or that the comparable sale down the street closed with $20,000 in seller concessions. I pull the actual comps, walk through the adjustments and show my work.",
  },
  {
    question: "How long does it take?",
    answer:
      "You'll have a written valuation within one business day. If your property is unusual — acreage, a guest house, an unpermitted addition, a commercial or mixed-use parcel — I may call first to ask a few questions before finalizing the number.",
  },
  {
    question: "Will I get put on a marketing list?",
    answer:
      "No. Your information is used to prepare and deliver this valuation and to follow up once. It is never sold or handed to third-party lead services.",
  },
  {
    question: "I'm not selling — I just want to know. Is that okay?",
    answer:
      "Completely. Plenty of requests come from owners planning a refinance, settling an estate, deciding whether to rent instead of sell, or just tracking their net worth. Say so on the last step and I'll skip the follow-up.",
  },
  {
    question: "Does this work for commercial or investment property?",
    answer:
      "Yes. Select 'Commercial' or 'Multi-family' as the property type and I'll approach it with an income and cap-rate analysis rather than a residential comp grid.",
  },
];

export default function HomeValuePage() {
  return (
    <>
      <PageHero
        eyebrow="Free home valuation"
        title={
          <>
            What&apos;s my home
            <span className="block text-gold-light">actually worth today?</span>
          </>
        }
        intro="Answer a few questions about your property and I'll send you a written valuation built from the real comparable sales in your neighborhood — usually within one business day."
        image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1800&q=85"
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.55fr_0.95fr] lg:items-start">
          <ValuationWizard />

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="border border-line bg-white p-6">
              <Eyebrow tone="ink">What you&apos;ll receive</Eyebrow>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-soft">
                {[
                  "A suggested price range with the reasoning behind it",
                  "The three to five comparable sales I based it on",
                  "Current competing listings you'd be priced against",
                  "Days-on-market and absorption for your submarket",
                  "Specific, cost-effective prep work worth doing first",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative aspect-[4/5] w-full">
              <Image
                src="/kelly/lounge.jpg"
                alt="Kelly Rojas"
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover"
              />
            </div>

            <div className="bg-ink p-6 text-white">
              <p className="font-serif text-2xl">Would rather just talk?</p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Some properties are easier to discuss than to itemize in a form.
                Call and we&apos;ll cover it in ten minutes.
              </p>
              <div className="mt-5">
                <ButtonLink href="/contact">Book a call instead</ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </Section>

      <Section className="bg-sand">
        <SectionHeading
          eyebrow="Why this is different"
          title="An algorithm has never walked through your house."
          intro="Automated estimates are a fine starting point and a poor decision-making tool. Here's the difference in practice."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {differences.map((column) => (
            <div
              key={column.title}
              className={`border p-7 ${
                column.tone === "gold"
                  ? "border-gold bg-white"
                  : "border-line bg-white/50"
              }`}
            >
              <h3
                className={`text-2xl ${column.tone === "gold" ? "text-ink" : "text-ink-soft"}`}
              >
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-soft">
                {column.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${
                        column.tone === "gold" ? "bg-gold" : "bg-line"
                      }`}
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Common questions"
          title="Before you submit"
          align="left"
        />
        <Faq items={faqs} />
      </Section>
    </>
  );
}
