import type { Metadata } from "next";
import { LeadForm } from "@/components/lead-form";
import { Faq } from "@/components/faq";
import { ProcessSteps } from "@/components/process-steps";
import { RecentTransactions } from "@/components/recent-transactions";
import {
  ButtonLink,
  Card,
  CtaBand,
  Eyebrow,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Buy a Home in Phoenix",
  description:
    "Buyer representation across Greater Phoenix — from first homes to luxury and new construction. Get a clear plan, honest pricing guidance and a negotiator on your side.",
};

const steps = [
  {
    title: "Strategy conversation",
    body: "Before we look at a single house, we get clear on budget, timeline, must-haves and what you're actually optimizing for — payment, location, resale, or space. Thirty minutes here saves months of wandering.",
  },
  {
    title: "Financing lined up",
    body: "A verified pre-approval, not a pre-qualification. I'll introduce you to two or three lenders worth comparing and help you read the loan estimates side by side. In a competitive offer, your lender matters as much as your price.",
  },
  {
    title: "Focused search",
    body: "You get a live MLS feed filtered to your actual criteria, plus anything I hear about before it lists. We tour in batches so you can compare properly instead of falling for the first one.",
  },
  {
    title: "Offer and negotiation",
    body: "We look at what comparable homes really sold for, what the seller's situation likely is, and where the leverage sits. Terms often win over price — I'll show you which levers cost you nothing.",
  },
  {
    title: "Inspection and due diligence",
    body: "Inspection, and where warranted a sewer scope, roof certification or pool inspection. Then we decide what's worth asking for. Arizona's inspection period is real leverage and most buyers under-use it.",
  },
  {
    title: "Appraisal to close",
    body: "I stay on the lender, the title company and the appraiser so nothing quietly slips. You get a weekly status note and a call the moment anything needs a decision.",
  },
];

const faqs = [
  {
    question: "Do I pay you as a buyer?",
    answer:
      "Buyer representation is now covered by a written buyer-broker agreement, and compensation is negotiable in every transaction. In many cases the seller still offers compensation to the buyer's agent; where they don't, we discuss it up front before you tour anything, so there are no surprises at closing.",
  },
  {
    question: "How much do I need for a down payment?",
    answer:
      "Less than most people assume. Conventional loans start at 3% down, FHA at 3.5%, and VA and USDA at zero for qualifying buyers. Arizona also has down payment assistance programs — Home Plus among them — that many buyers in the metro qualify for and never hear about.",
  },
  {
    question: "Should I buy new construction or resale?",
    answer:
      "It depends on your timeline and how much you value certainty. New construction offers warranties and incentives — currently $25,000 to $60,000 in the West Valley — but you're waiting and you're competing on the builder's terms. Bring me to your first builder visit: representation costs you nothing and the sales office is working for the builder.",
  },
  {
    question: "How competitive is the Phoenix market right now?",
    answer:
      "It's genuinely balanced for the first time in years, and it varies by price band. Under $500,000 still moves quickly. Above $1.5M, buyers have real negotiating room and time to think. I'll show you the current absorption rate for your specific price range and area rather than a headline.",
  },
  {
    question: "Can you help if I'm relocating from out of state?",
    answer:
      "Yes, and a lot of my business is exactly that. We start with video tours and neighborhood walkthroughs so you can narrow things down before you fly in, then use your trip efficiently. See the neighborhood guides for an honest read on each area.",
  },
];

export default function BuyPage() {
  return (
    <>
      <PageHero
        eyebrow="Buyer representation"
        title={
          <>
            Buy well.
            <span className="block text-gold-light">Build equity from day one.</span>
          </>
        }
        intro="The purchase price is only part of the equation. What you pay, how you finance it and what you negotiate all compound over the years you own it."
        image="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=85"
      >
        <ButtonLink href="#start">Start your search</ButtonLink>
        <ButtonLink href="/calculators" variant="light">
          Run the numbers
        </ButtonLink>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Who I work with"
          title="Different buyers, different playbooks."
          intro="What makes a good purchase depends entirely on why you're buying. These are the four situations I handle most."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card title="First-time buyers" index="01">
            Down payment assistance, program eligibility and an honest read on what
            your monthly number really looks like once taxes and insurance are in.
          </Card>
          <Card title="Move-up buyers" index="02">
            Sequencing the sale and the purchase so you aren&apos;t homeless or
            double-carrying two mortgages. This is mostly a timing problem.
          </Card>
          <Card title="Luxury buyers" index="03">
            Off-market access, discretion, and due diligence that matches the price
            point — including guest houses, wells and unpermitted work.
          </Card>
          <Card title="Relocating buyers" index="04">
            Video tours, neighborhood context and a compressed in-person trip that
            actually accomplishes something.
          </Card>
        </div>
      </Section>

      <Section className="bg-sand">
        <SectionHeading
          eyebrow="Recently closed"
          title="Buyers I've represented"
          intro="Recent purchases closed on the buyer's side, from a multigenerational property in west Phoenix to a corner lot in Flagstaff."
        />
        <RecentTransactions />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="The process"
          title="What buying with me looks like"
          align="left"
          intro="Six stages, roughly 30 to 90 days from strategy call to keys."
        />
        <ProcessSteps steps={steps} />
      </Section>

      <Section id="start" className="bg-sand">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow tone="ink">Get started</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl">
              Tell me what you&apos;re looking for.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              Fill this out and I&apos;ll send a curated set of properties matching your
              criteria — including anything I know about that hasn&apos;t hit the MLS
              yet. No automated drip, no call center.
            </p>
            <div className="mt-8 border border-line bg-white p-6">
              <p className="eyebrow text-gold">Prefer to browse first?</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                The public listings page shows a curated selection with live filters
                for price, type and bedrooms.
              </p>
              <div className="mt-5">
                <ButtonLink href="/listings" variant="outline">
                  Browse listings
                </ButtonLink>
              </div>
            </div>
          </div>

          <LeadForm
            type="buyer"
            submitLabel="Send my criteria"
            successTitle="Got it — your search is starting."
            successBody="I'll put together a set of matching properties and send them over within one business day, along with a few notes on the current market in your target areas."
            messageLabel="What matters most in your next home?"
            messagePlaceholder="Single story, RV gate, good schools, walkable to Old Town…"
            extraFields={[
              {
                name: "priceRange",
                label: "Price range",
                type: "select",
                options: [
                  "Under $400,000",
                  "$400,000 – $600,000",
                  "$600,000 – $900,000",
                  "$900,000 – $1.5M",
                  "$1.5M – $3M",
                  "$3M+",
                ],
              },
              {
                name: "timeline",
                label: "Timeline",
                type: "select",
                options: [
                  "ASAP — pre-approved and ready",
                  "1–3 months",
                  "3–6 months",
                  "6–12 months",
                  "Just starting to research",
                ],
              },
              {
                name: "areas",
                label: "Areas of interest",
                placeholder: "Arcadia, Scottsdale, Peoria…",
              },
              {
                name: "financing",
                label: "Financing",
                type: "select",
                options: [
                  "Pre-approved",
                  "Need a lender referral",
                  "Cash",
                  "VA loan",
                  "Not sure yet",
                ],
              },
            ]}
          />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Buyer questions" title="What people ask me" align="left" />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        eyebrow="Next step"
        title="Let's find the right one."
        intro="A thirty-minute strategy call will tell you more than three weekends of open houses."
        primary={{ href: "/contact", label: "Book a consultation" }}
        secondary={{ href: "/calculators", label: "Calculate my payment" }}
      />
    </>
  );
}
