import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/lead-form";
import { Faq } from "@/components/faq";
import { ProcessSteps } from "@/components/process-steps";
import {
  ButtonLink,
  CtaBand,
  Eyebrow,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Sell Your Phoenix Home",
  description:
    "Strategic pricing, professional marketing and hard negotiation for Phoenix-area sellers. Start with a free written home valuation.",
};

const steps = [
  {
    title: "Valuation and strategy",
    body: "I walk the property, pull the comparable sales and build a pricing strategy around your timeline — not around whatever number sounds best in a listing appointment.",
  },
  {
    title: "Prep that pays for itself",
    body: "A specific, prioritized list of what to fix and what to leave. I'll tell you plainly when something isn't worth the money. Paint, landscaping and decluttering return; a kitchen remodel two months before listing rarely does.",
  },
  {
    title: "Professional marketing",
    body: "Architectural photography, twilight exteriors, drone where the lot justifies it, floor plans, and a 3D tour. Listings with full media packages measurably outperform phone photos — that difference is on my dime, not yours.",
  },
  {
    title: "Launch and exposure",
    body: "Syndicated to the ARMLS, Zillow, Realtor.com and Redfin, plus targeted paid social to buyers in your price band, an email push to my agent network, and a broker preview where it makes sense.",
  },
  {
    title: "Showings and feedback",
    body: "Every showing gets followed up for feedback, and you get a weekly report with traffic, saves and where we sit against the competing inventory. If something isn't working, we adjust in week two — not week eight.",
  },
  {
    title: "Offers, escrow, close",
    body: "I evaluate offers on total strength, not just top-line price: financing type, appraisal risk, inspection posture, and how the buyer's agent has behaved so far. Then I manage the escrow to closing.",
  },
];

const marketing = [
  { title: "Architectural photography", body: "Wide-angle interiors, twilight exteriors, corrected verticals." },
  { title: "3D tour and floor plan", body: "Out-of-state buyers shortlist from these before they ever fly in." },
  { title: "Drone and video", body: "For lots, acreage and views that photos alone undersell." },
  { title: "Full MLS syndication", body: "ARMLS, Zillow, Realtor.com, Redfin and 100+ partner sites." },
  { title: "Targeted paid social", body: "Meta and Instagram campaigns aimed at buyers in your price band." },
  { title: "Agent network push", body: "Direct outreach to the agents already working buyers in your area." },
];

const faqs = [
  {
    question: "What's my home actually worth?",
    answer:
      "That's the right first question, and it deserves a real answer rather than a range from an algorithm. The valuation request takes about two minutes and you'll have a written analysis with the supporting comps within one business day.",
  },
  {
    question: "What does it cost to sell?",
    answer:
      "Commission is negotiable and always has been. Beyond that, budget roughly 1% to 1.5% for title, escrow and recording fees, plus any repairs negotiated after inspection. I give you a written net-proceeds estimate before you list, so you know your number going in.",
  },
  {
    question: "Should I sell before I buy?",
    answer:
      "Usually, in a balanced market — a non-contingent offer is far stronger, and carrying two mortgages is expensive. There are workarounds: a rent-back from your buyer, a bridge loan, or an extended close. We'll map the sequence to your finances before either side starts.",
  },
  {
    question: "How long will it take?",
    answer:
      "The Greater Phoenix median has been running 43 to 52 days on market depending on submarket and price band, plus roughly 30 days to close. Correctly priced homes in the lower bands move considerably faster. Overpriced homes in any band sit and then sell for less than they would have.",
  },
  {
    question: "Do I need to make repairs first?",
    answer:
      "Some, not all. I'll give you a prioritized list separating what genuinely affects offers from what buyers won't notice or will want to change anyway. I'd rather you keep the money than spend it on the wrong things.",
  },
  {
    question: "What about iBuyers and cash offers?",
    answer:
      "They're a legitimate option when speed and certainty matter more than price — and they typically cost 8% to 13% versus market value once fees and repair deductions are counted. I'll get you a cash offer to compare against the open-market number so you can decide with both figures in front of you.",
  },
];

export default function SellPage() {
  return (
    <>
      <PageHero
        eyebrow="Seller representation"
        title={
          <>
            Sell for what it&apos;s worth.
            <span className="block text-gold-light">Not what it&apos;s listed for.</span>
          </>
        }
        intro="Pricing strategy, a marketing package that actually costs money to produce, and a negotiator who has been on both sides of the table more than a hundred times."
        image="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85"
      >
        <ButtonLink href="/home-value">Get my home value</ButtonLink>
        <ButtonLink href="#consult" variant="light">
          Request a listing consultation
        </ButtonLink>
      </PageHero>

      <Section>
        <div className="grid gap-6 border border-line bg-white p-8 md:grid-cols-3 md:p-10">
          {[
            { value: "43–52", label: "Median days on market, by submarket" },
            { value: "98.4%", label: "Average list-to-sale price ratio" },
            { value: "$50M+", label: "Career sales volume" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-serif text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm text-ink-soft">{stat.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <SectionHeading
          eyebrow="Start here"
          title="Pricing is the whole game."
          intro="Overpricing costs sellers more than any other single decision. A home priced correctly in the first two weeks captures the buyers already watching that price band; a home that has to chase the market down sells later and for less."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Week 1–2",
              body: "Peak buyer attention. Saves, showings and offers cluster here. Price right and this is where you sell.",
              accent: true,
            },
            {
              title: "Week 3–6",
              body: "Traffic drops sharply. The first price reduction usually recovers less momentum than sellers expect.",
              accent: false,
            },
            {
              title: "Week 7+",
              body: "Buyers now ask what's wrong with it. Homes that reach here typically close below where they'd have sold in week one.",
              accent: false,
            },
          ].map((phase) => (
            <div
              key={phase.title}
              className={`border p-7 ${phase.accent ? "border-gold bg-white" : "border-line bg-white/60"}`}
            >
              <p className={`eyebrow ${phase.accent ? "text-gold" : "text-ink-soft"}`}>
                {phase.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{phase.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <ButtonLink href="/home-value">Get my free valuation</ButtonLink>
        </div>
      </Section>

      <Section className="bg-sand">
        <SectionHeading
          eyebrow="The process"
          title="How your sale runs"
          align="left"
        />
        <ProcessSteps steps={steps} />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Marketing package"
          title="Included with every listing"
          intro="Not an upsell menu. This is what every property I list receives, at my expense."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {marketing.map((item) => (
            <div key={item.title} className="border border-line bg-white p-6">
              <h3 className="text-xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="consult" className="bg-sand">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow tone="ink">Listing consultation</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl">
              Let&apos;s talk about your sale.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              A listing consultation is a conversation, not a pitch. We walk the
              property, review the comparable sales together and I give you a
              net-proceeds estimate. You decide afterward, on your own time.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Just want the number first?{" "}
              <Link href="/home-value" className="text-gold underline underline-offset-4">
                Start with the free valuation
              </Link>
              .
            </p>
          </div>

          <LeadForm
            type="seller"
            submitLabel="Request consultation"
            successTitle="Consultation requested."
            successBody="I'll reach out within one business day to schedule a walkthrough and put together your comparable-sales analysis."
            messageLabel="Anything I should know about the property?"
            messagePlaceholder="Recent updates, tenant in place, HOA questions, timing constraints…"
            extraFields={[
              { name: "address", label: "Property address", placeholder: "Street, city", required: true },
              {
                name: "timeline",
                label: "When would you list?",
                type: "select",
                options: [
                  "ASAP",
                  "1–3 months",
                  "3–6 months",
                  "6–12 months",
                  "Exploring options",
                ],
              },
              {
                name: "propertyType",
                label: "Property type",
                type: "select",
                options: [
                  "Single family",
                  "Townhome / condo",
                  "Multi-family",
                  "Commercial",
                  "Land",
                ],
              },
              {
                name: "occupancy",
                label: "Occupancy",
                type: "select",
                options: ["Owner occupied", "Tenant occupied", "Vacant", "Second home"],
              },
            ]}
          />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Seller questions" title="What people ask me" align="left" />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        eyebrow="Start with the number"
        title="Know what your home is worth."
        intro="Free, written, based on real comparable sales, and yours whether or not you ever list."
        primary={{ href: "/home-value", label: "Get my home value" }}
        secondary={{ href: "/contact", label: "Talk to Kelly" }}
      />
    </>
  );
}
