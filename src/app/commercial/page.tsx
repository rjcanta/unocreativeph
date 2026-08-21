import type { Metadata } from "next";
import { LeadForm } from "@/components/lead-form";
import { Faq } from "@/components/faq";
import { PropertyCard } from "@/components/property-card";
import {
  ButtonLink,
  Card,
  CtaBand,
  Eyebrow,
  PageHero,
  Section,
  SectionHeading,
} from "@/components/ui";
import { listings } from "@/data/listings";

export const metadata: Metadata = {
  title: "Phoenix Commercial Real Estate",
  description:
    "Commercial acquisitions, dispositions, leasing and 1031 exchanges across office, retail, industrial and multi-family in Greater Phoenix.",
};

const sectors = [
  {
    title: "Office",
    body: "Owner-user buildings, medical office and stabilized investment product across the metro's submarkets.",
  },
  {
    title: "Retail",
    body: "Strip centers, pad sites and single-tenant net lease with credit tenants.",
  },
  {
    title: "Industrial",
    body: "Flex, warehouse and distribution — the strongest fundamentals in the Valley right now.",
  },
  {
    title: "Multi-family",
    body: "Small to mid-size apartment assets, from fourplexes to 50-unit communities.",
  },
  {
    title: "Land & development",
    body: "Entitled and raw parcels in the West Valley and outer growth corridors.",
  },
  {
    title: "Owner-user",
    body: "Buying the building your business already occupies — often cheaper than the lease.",
  },
];

const services = [
  {
    title: "Acquisitions",
    body: "Sourcing, underwriting and negotiating — including off-market deals that never reach a listing service.",
  },
  {
    title: "Dispositions",
    body: "Positioning and marketing an asset to the buyer pool most likely to pay for it.",
  },
  {
    title: "Leasing",
    body: "Landlord and tenant representation, lease structuring and renewal negotiation.",
  },
  {
    title: "1031 exchanges",
    body: "Identifying replacement property inside the 45-day window with the deadline schedule mapped from day one.",
  },
];

const faqs = [
  {
    question: "What's the minimum deal size you work on?",
    answer:
      "There isn't a hard floor. I've represented buyers on $400,000 fourplexes and $4M+ office buildings. What matters more is whether the deal makes sense for you — I'd rather tell you a small deal is wrong than close it.",
  },
  {
    question: "How does commercial differ from residential for a first-time buyer?",
    answer:
      "Three things: valuation is driven by income rather than comparable sales, due diligence is longer and more technical (environmental, zoning, estoppels, service contracts), and financing typically means 25–35% down with a shorter term and a balloon. I walk owner-users through each of those before we tour anything.",
  },
  {
    question: "Can you help with a 1031 exchange?",
    answer:
      "Yes, and timing is everything. You have 45 days to identify replacement property and 180 to close. I start building the identification list before your relinquished property closes, so day one of the window isn't day one of the search. I'll also coordinate with your qualified intermediary and CPA.",
  },
  {
    question: "Should my business buy or keep leasing?",
    answer:
      "Run the numbers rather than the instinct. With an SBA 504 loan, a business can often buy at 10% down and land at a monthly cost comparable to its current lease — while building equity instead of paying someone else's. I'll model both scenarios side by side against your actual lease terms.",
  },
  {
    question: "What are Phoenix commercial cap rates right now?",
    answer:
      "It depends heavily on asset class and location. Industrial has been the tightest, quality retail with credit tenants trades in a narrow band, and office is the widest spread in the market — where the risk is, and where the opportunity is. I'll pull current comparable trades for whatever class you're considering.",
  },
];

export default function CommercialPage() {
  const commercialListings = listings.filter(
    (l) => l.type === "Commercial" || l.type === "Investment" || l.type === "Land",
  );

  return (
    <>
      <PageHero
        eyebrow="Commercial real estate"
        title={
          <>
            Build. Grow.
            <span className="block text-gold-light">Invest.</span>
          </>
        }
        intro="Office, retail, industrial, multi-family and land — acquisition, disposition, leasing and 1031 exchange representation across Greater Phoenix."
        image="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=85"
      >
        <ButtonLink href="#commercial-contact">Discuss a deal</ButtonLink>
        <ButtonLink href="#inventory" variant="light">
          See current inventory
        </ButtonLink>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Sectors"
          title="Where I work"
          intro="Greater Phoenix commercial is not one market either — each asset class has its own buyer pool, financing profile and risk."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sectors.map((sector) => (
            <Card key={sector.title} title={sector.title}>
              {sector.body}
            </Card>
          ))}
        </div>
      </Section>

      <Section className="bg-charcoal text-white">
        <SectionHeading
          eyebrow="Services"
          title="What representation looks like"
          tone="light"
          align="left"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <div key={service.title} className="border border-white/15 p-7">
              <h3 className="text-2xl text-white">{service.title}</h3>
              <p className="mt-3 leading-relaxed text-white/65">{service.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="inventory">
        <SectionHeading
          eyebrow="Available"
          title="Commercial & investment inventory"
          align="left"
          intro="A sample of current opportunities. Much of what I transact never reaches a public listing — ask what's not shown."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {commercialListings.map((listing) => (
            <PropertyCard key={listing.slug} listing={listing} />
          ))}
        </div>
      </Section>

      <Section id="commercial-contact" className="bg-sand">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <Eyebrow tone="ink">Start a conversation</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl">
              Tell me about the deal.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              Whether you&apos;re acquiring, disposing, in a 1031 window or weighing
              buying against renewing your lease — send the parameters and I&apos;ll
              come back with a real read, not a pitch.
            </p>
          </div>

          <LeadForm
            type="commercial"
            submitLabel="Send deal details"
            successTitle="Received."
            successBody="Kelly will review the parameters and follow up within one business day — sooner if you're inside a 1031 identification window."
            messageLabel="Deal parameters"
            messagePlaceholder="Asset class, target return, market, timing, financing…"
            extraFields={[
              {
                name: "objective",
                label: "Objective",
                type: "select",
                options: [
                  "Acquire an asset",
                  "Dispose of an asset",
                  "1031 exchange",
                  "Lease space (tenant rep)",
                  "Lease out space (landlord rep)",
                  "Owner-user purchase",
                ],
              },
              {
                name: "assetClass",
                label: "Asset class",
                type: "select",
                options: [
                  "Office",
                  "Retail",
                  "Industrial",
                  "Multi-family",
                  "Land / development",
                  "Mixed use",
                  "Undecided",
                ],
              },
              {
                name: "budget",
                label: "Budget / price range",
                placeholder: "$1M – $3M",
              },
              {
                name: "timing",
                label: "Timing",
                type: "select",
                options: [
                  "Immediate",
                  "1–3 months",
                  "3–6 months",
                  "6–12 months",
                  "In a 1031 window",
                ],
              },
            ]}
          />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Commercial questions" title="What people ask me" align="left" />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        eyebrow="Commercial + residential"
        title="One advisor, both sides of the market."
        intro="Most clients start on the residential side and end up here. The strategy carries across."
        primary={{ href: "/contact", label: "Book a consultation" }}
        secondary={{ href: "/invest", label: "Investment strategy" }}
      />
    </>
  );
}
