import type { Metadata } from "next";
import Image from "next/image";
import {
  ButtonLink,
  CtaBand,
  Eyebrow,
  Section,
  SectionHeading,
  StatBand,
} from "@/components/ui";
import { RecentTransactions } from "@/components/recent-transactions";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "About Kelly Rojas",
  description:
    "A decade in Phoenix real estate, 100+ transactions and $50M+ in sales — with a focus on helping clients build long-term wealth through property.",
};

const values = [
  {
    title: "Straight answers",
    body: "If a property is wrong for you, I'll say so — even when saying so costs me the sale. My business runs on repeat clients and referrals, and neither survives a bad recommendation.",
  },
  {
    title: "Numbers first",
    body: "Every recommendation comes with the math behind it: comparable sales, carrying costs, cap rates, what the monthly really looks like once taxes and insurance are counted.",
  },
  {
    title: "Long-horizon thinking",
    body: "The question isn't only whether you can buy this house. It's what this purchase does to your position three, five and ten years out.",
  },
  {
    title: "Both sides of the market",
    body: "Residential and commercial are usually two different agents. Working across both means the same person can guide your first home and your first commercial acquisition.",
  },
];

const testimonials = [
  {
    quote:
      "Kelly talked us out of a house we were emotionally attached to. She was right — the one we bought two months later has appreciated far more, and we'd have overpaid for the first.",
    name: "Marcus & Elena T.",
    detail: "Buyers · Arcadia",
  },
  {
    quote:
      "She priced our home $40,000 above what two other agents recommended and it sold in nine days at asking. She had the comps to back it up from the first meeting.",
    name: "Diane R.",
    detail: "Seller · Scottsdale",
  },
  {
    quote:
      "I came to Kelly for a rental and left with an actual acquisition strategy. Three properties later, the plan is still the one she sketched out on the first call.",
    name: "James O.",
    detail: "Investor · West Valley",
  },
];

const timeline = [
  { year: "2016", body: "Licensed in Arizona and closed a first full year focused on West Valley residential." },
  { year: "2019", body: "Expanded into investment property, helping clients build small rental portfolios." },
  { year: "2021", body: "Added commercial representation — office, retail and industrial across the metro." },
  { year: "2024", body: "Passed $50M in career sales volume across 100+ closed transactions." },
  { year: "Today", body: "Working with buyers, sellers and investors across residential and commercial Greater Phoenix." },
];

export default function AboutPage() {
  return (
    <>
      <Section className="pb-0">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative aspect-[4/5] w-full">
            <Image
              src="/kelly/headshot.jpg"
              alt="Kelly Rojas, Phoenix residential and commercial real estate consultant"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
          </div>
          <div>
            <Eyebrow tone="ink">Meet Kelly Rojas</Eyebrow>
            <h1 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">
              Real estate with a bigger purpose.
            </h1>
            <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
              <p>
                I got into real estate because I watched my own family make property
                decisions without anyone in the room who could explain the long-term
                consequences. Some of those decisions worked out. Several didn&apos;t,
                and the difference between them usually came down to information nobody
                had bothered to share.
              </p>
              <p>
                That&apos;s the gap I try to close. Over the last decade — 100+
                transactions since 2016 and more than $50M in sales volume — I&apos;ve
                worked with first-time buyers, families moving up, out-of-state
                relocations, investors building rental portfolios and business owners
                buying their first commercial building.
              </p>
              <p>
                What connects them is a way of working: understand the goal first, run
                the numbers honestly, and treat every property decision as one move in
                a longer game.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/contact">Book a consultation</ButtonLink>
              <ButtonLink href={site.phoneHref} variant="outline">
                Call {site.phone}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <div className="mt-20">
        <StatBand stats={site.stats} />
      </div>

      <Section>
        <SectionHeading
          eyebrow="How I work"
          title="Four things you can count on"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {values.map((value) => (
            <div key={value.title} className="border border-line bg-white p-7">
              <h3 className="text-2xl">{value.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{value.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-sand">
        <SectionHeading
          eyebrow="Track record"
          title="Recently closed"
          intro="A sample of recent transactions. Buyer-side representation is labeled as such — the work of finding the right property and negotiating for it is different from listing one."
        />
        <RecentTransactions />
      </Section>

      <Section className="bg-charcoal text-white">
        <SectionHeading
          eyebrow="Client experiences"
          title="In their words"
          tone="light"
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {testimonials.map((item) => (
            <figure key={item.name} className="border border-white/15 p-7">
              <blockquote className="font-serif text-lg leading-relaxed text-white/90">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 border-t border-white/15 pt-4 text-sm">
                <span className="block text-white">{item.name}</span>
                <span className="text-white/50">{item.detail}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Background" title="The path here" align="left" />
        <div className="grid gap-px border border-line bg-line md:grid-cols-5">
          {timeline.map((item) => (
            <div key={item.year} className="bg-white p-6">
              <p className="font-serif text-2xl text-gold">{item.year}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand
        eyebrow="Let's talk"
        title="Tell me what you're working toward."
        intro="Whether that's a first home, a portfolio, or just an honest read on what your property is worth."
      />
    </>
  );
}
