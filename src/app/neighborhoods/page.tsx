import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, PageHero, Section, SectionHeading } from "@/components/ui";
import { neighborhoods } from "@/data/neighborhoods";

export const metadata: Metadata = {
  title: "Greater Phoenix Neighborhood Guides",
  description:
    "Median prices, days on market and honest notes on Phoenix, Scottsdale, Glendale, Peoria and the West Valley.",
};

export default function NeighborhoodsPage() {
  return (
    <>
      <PageHero
        eyebrow="Local knowledge"
        title={
          <>
            Every submarket
            <span className="block text-gold-light">behaves differently.</span>
          </>
        }
        intro="What you pay, how fast you have to move and whether the numbers work depends entirely on where you're shopping. These are my honest notes on the areas I work every week."
        image="https://images.unsplash.com/photo-1558645836-e44122a743ee?auto=format&fit=crop&w=1800&q=85"
      />

      <Section>
        <SectionHeading
          eyebrow="Choose an area"
          title="Greater Phoenix, submarket by submarket"
          intro="Figures reflect recent ARMLS activity and are refreshed regularly. They describe the market, not any single property."
        />

        <div className="space-y-5">
          {neighborhoods.map((area) => (
            <Link
              key={area.slug}
              href={`/neighborhoods/${area.slug}`}
              className="group grid overflow-hidden border border-line bg-white transition-colors hover:border-gold md:grid-cols-[0.85fr_1.15fr]"
            >
              <div
                className="min-h-[220px]"
                style={{
                  backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.35), rgba(0,0,0,0.05)), url('${area.image}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="p-7 md:p-9">
                <h2 className="text-3xl">{area.name}</h2>
                <p className="mt-1 text-sm text-gold">{area.tagline}</p>
                <p className="mt-4 leading-relaxed text-ink-soft">{area.intro}</p>

                <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5 sm:grid-cols-4">
                  {[
                    { label: "Median price", value: area.medianPrice },
                    { label: "Price / sqft", value: area.medianPricePerSqft },
                    { label: "Days on market", value: area.avgDaysOnMarket },
                    { label: "Conditions", value: area.inventoryTrend },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                        {stat.label}
                      </dt>
                      <dd className="mt-1 font-serif text-lg">{stat.value}</dd>
                    </div>
                  ))}
                </dl>

                <span className="mt-6 inline-block text-[0.688rem] font-bold uppercase tracking-[0.14em] text-gold">
                  Read the guide →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <CtaBand
        eyebrow="Relocating?"
        title="Not sure which area fits?"
        intro="Tell me how you live — commute, schools, walkability, budget — and I'll narrow it to two or three areas worth your time."
        primary={{ href: "/contact", label: "Ask Kelly" }}
        secondary={{ href: "/listings", label: "Browse listings" }}
      />
    </>
  );
}
