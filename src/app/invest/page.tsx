import type { Metadata } from "next";
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
  title: "Real Estate Investing in Phoenix",
  description:
    "Build a Phoenix rental portfolio with a disciplined acquisition strategy — underwriting, cash flow analysis, 1031 exchanges and long-term wealth planning.",
};

const stages = [
  {
    n: "01",
    title: "Own",
    body: "Your primary residence is the first asset. Buy it right, finance it well, and it becomes the foundation everything else is built on — including, often, the equity that funds the next purchase.",
  },
  {
    n: "02",
    title: "Grow",
    body: "The first rental is the hardest. We underwrite conservatively, buy for cash flow rather than hope, and structure it so a vacancy or a water heater doesn't derail you.",
  },
  {
    n: "03",
    title: "Expand",
    body: "Once the portfolio produces, the questions change: scale into multi-family, trade up through a 1031, or move into commercial where the leases are longer and the tenants are businesses.",
  },
];

const steps = [
  {
    title: "Define the objective",
    body: "Monthly cash flow, long-term appreciation, a tax position, or something to hand your kids? These lead to genuinely different properties. Most investors skip this and buy whatever looked good on a listing site.",
  },
  {
    title: "Set the buy box",
    body: "Price range, submarket, property type, condition tolerance and minimum returns — written down. A clear buy box is what lets you move fast on the right deal and pass on the wrong one without agonizing.",
  },
  {
    title: "Underwrite honestly",
    body: "Real rents from real comparable leases, not the pro forma. Vacancy, management, maintenance, capex reserves, taxes and insurance — all in. If it only works with 3% vacancy and no capex, it doesn't work.",
  },
  {
    title: "Finance strategically",
    body: "Conventional investor loans, DSCR products, portfolio lenders, or a HELOC on existing equity. The financing structure often matters more to your return than the purchase price does.",
  },
  {
    title: "Acquire and stabilize",
    body: "Offer, inspect, close, and get it rented or repositioned. I stay involved through lease-up and can introduce property managers I actually trust.",
  },
  {
    title: "Review annually",
    body: "Every year we look at whether each asset still earns its place: refinance, hold, sell, or trade up through a 1031. Portfolios rot when nobody revisits them.",
  },
];

const metrics = [
  { term: "Cap rate", def: "Net operating income ÷ purchase price. The clean way to compare unlevered returns across properties." },
  { term: "Cash-on-cash", def: "Annual pre-tax cash flow ÷ total cash invested. What your actual money is earning, financing included." },
  { term: "DSCR", def: "Net operating income ÷ debt service. Lenders generally want 1.20 or better; so should you." },
  { term: "1% rule", def: "A screening heuristic — monthly rent near 1% of price. Rare in Phoenix today; useful for filtering, not for deciding." },
  { term: "Capex reserve", def: "Money set aside for roofs, HVAC and water heaters. Budget 5–10% of rent or the first big repair becomes a crisis." },
  { term: "Depreciation", def: "A non-cash deduction that shelters rental income. One of the real advantages of owning property directly." },
];

const faqs = [
  {
    question: "How much do I need to start?",
    answer:
      "Investment property generally requires 20–25% down plus closing costs and reserves. On a $400,000 Phoenix rental that's roughly $100,000 to $115,000 all in. There are lower-entry paths — house hacking a duplex with an owner-occupied loan at 3–5% down is the most common one, and it's how a lot of good portfolios started.",
  },
  {
    question: "Does Phoenix rental property still cash flow?",
    answer:
      "In specific corridors, yes — and it takes work to find them. Broad-market metro numbers have been tight since rates moved. What still pencils tends to be small multi-family in West Valley growth corridors, properties near employment centers, and value-add situations where the rent is below market. I'll show you actual underwriting rather than a headline.",
  },
  {
    question: "Short-term rental or long-term?",
    answer:
      "Scottsdale and Old Town still support strong short-term numbers, but municipal regulation has tightened, seasonality is severe, and operating costs run far higher than owners expect. Long-term rentals are less exciting and more predictable. For a first investment property, I usually steer people to long-term.",
  },
  {
    question: "Should I use an LLC?",
    answer:
      "Often yes for liability separation, but it has real financing implications — conventional lending generally requires you personally on title, and moving a property into an LLC afterward can trigger a due-on-sale clause. That's a conversation with your CPA and attorney, and I'll flag the real estate side of it.",
  },
  {
    question: "How does a 1031 exchange work?",
    answer:
      "You defer capital gains by exchanging into like-kind replacement property. The deadlines are hard: 45 days to identify, 180 to close, and a qualified intermediary must hold the proceeds — you can never touch them. The practical answer is to start the replacement search before your relinquished property closes.",
  },
];

export default function InvestPage() {
  return (
    <>
      <PageHero
        eyebrow="Investment strategy"
        title={
          <>
            Property as a system
            <span className="block text-gold-light">for building wealth.</span>
          </>
        }
        intro="A disciplined acquisition strategy, honest underwriting and a plan that looks past the next closing to what the portfolio does over a decade."
        image="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=85"
      >
        <ButtonLink href="#investor-contact">Build my strategy</ButtonLink>
        <ButtonLink href="/listings" variant="light">
          See investment inventory
        </ButtonLink>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Three stages"
          title="Own. Grow. Expand."
          intro="Most people arrive at real estate investing sideways — they bought a house, it appreciated, and they started wondering what else was possible. That's a fine place to start."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {stages.map((stage) => (
            <div key={stage.n} className="border border-line bg-white p-7">
              <span className="eyebrow text-gold">{stage.n}</span>
              <h3 className="mt-2 text-3xl">{stage.title}</h3>
              <p className="mt-4 leading-relaxed text-ink-soft">{stage.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-sand">
        <SectionHeading
          eyebrow="The method"
          title="How an acquisition actually runs"
          align="left"
        />
        <ProcessSteps steps={steps} />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Know the language"
          title="The numbers that matter"
          intro="You don't need a finance background — but you should understand these six before you buy anything."
        />
        <dl className="grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.term} className="bg-white p-6">
              <dt className="font-serif text-xl text-gold">{metric.term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{metric.def}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="investor-contact" className="bg-charcoal text-white">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>Investor intake</Eyebrow>
            <h2 className="mt-3 text-3xl text-white md:text-4xl">
              Let&apos;s underwrite your next move.
            </h2>
            <p className="mt-4 leading-relaxed text-white/70">
              Tell me where you are — first rental, third, or sitting on equity you
              want to redeploy — and I&apos;ll come back with a realistic read on what
              your capital can do in this market.
            </p>
          </div>
          <div className="bg-cream p-6 md:p-8">
            <LeadForm
              type="investor"
              compact
              submitLabel="Send my parameters"
              successTitle="Received."
              successBody="Kelly will put together an initial read on your parameters and follow up within one business day."
              messageLabel="What are you working toward?"
              messagePlaceholder="Goals, current holdings, target returns, timeline…"
              extraFields={[
                {
                  name: "experience",
                  label: "Experience",
                  type: "select",
                  options: [
                    "First investment property",
                    "1–2 properties owned",
                    "3–5 properties owned",
                    "6+ properties owned",
                  ],
                },
                {
                  name: "capital",
                  label: "Capital available",
                  type: "select",
                  options: [
                    "Under $100,000",
                    "$100,000 – $250,000",
                    "$250,000 – $500,000",
                    "$500,000 – $1M",
                    "$1M+",
                  ],
                },
                {
                  name: "strategy",
                  label: "Preferred strategy",
                  type: "select",
                  options: [
                    "Long-term rental",
                    "Short-term rental",
                    "Small multi-family",
                    "Value-add / BRRRR",
                    "Commercial",
                    "Not sure yet",
                  ],
                },
                {
                  name: "priority",
                  label: "Primary objective",
                  type: "select",
                  options: [
                    "Monthly cash flow",
                    "Long-term appreciation",
                    "Tax advantages",
                    "1031 exchange",
                    "Balanced",
                  ],
                },
              ]}
            />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Investor questions" title="What people ask me" align="left" />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        eyebrow="Ready when you are"
        title="Start with the numbers."
        intro="Bring me a property you're considering and I'll underwrite it with you — no obligation either way."
        primary={{ href: "/contact", label: "Book a strategy call" }}
        secondary={{ href: "/calculators", label: "Run a scenario" }}
      />
    </>
  );
}
