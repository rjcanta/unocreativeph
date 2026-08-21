import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink, Eyebrow, Section, SectionHeading } from "@/components/ui";
import { getNeighborhood, neighborhoods } from "@/data/neighborhoods";
import { listings } from "@/data/listings";

export function generateStaticParams() {
  return neighborhoods.map((area) => ({ slug: area.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const area = getNeighborhood(slug);
  if (!area) return { title: "Neighborhood not found" };

  return {
    title: `${area.name} Real Estate Guide`,
    description: area.intro,
  };
}

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = getNeighborhood(slug);
  if (!area) notFound();

  const areaListings = listings
    .filter((l) => l.city.toLowerCase() === area.name.toLowerCase())
    .slice(0, 3);

  const others = neighborhoods.filter((n) => n.slug !== area.slug);

  return (
    <>
      <section
        className="relative flex min-h-[420px] items-end px-6 py-16 md:px-10 lg:px-16"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0.25)), url('${area.image}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto w-full max-w-6xl text-white">
          <Link
            href="/neighborhoods"
            className="text-sm text-white/70 hover:text-gold-light"
          >
            ← All neighborhoods
          </Link>
          <h1 className="mt-4 font-serif text-5xl md:text-6xl">{area.name}</h1>
          <p className="mt-2 max-w-2xl text-gold-light">{area.tagline}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 border-b border-line bg-white lg:grid-cols-4">
        {[
          { label: "Median sale price", value: area.medianPrice },
          { label: "Median price / sqft", value: area.medianPricePerSqft },
          { label: "Avg. days on market", value: area.avgDaysOnMarket },
          { label: "Market conditions", value: area.inventoryTrend },
        ].map((stat) => (
          <div key={stat.label} className="border-b border-line p-6 text-center lg:border-b-0">
            <p className="font-serif text-3xl">{stat.value}</p>
            <p className="mt-2 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr] lg:items-start">
          <div>
            <Eyebrow tone="ink">The honest read</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl">
              What to know about {area.name}
            </h2>
            <p className="mt-5 text-lg leading-relaxed">{area.intro}</p>
            <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
              {area.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10">
              <h3 className="text-2xl">Especially good for</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {area.goodFor.map((item) => (
                  <span
                    key={item}
                    className="border border-line bg-white px-4 py-2 text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <dl className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-3">
              {area.highlights.map((highlight) => (
                <div key={highlight.label} className="bg-white p-5">
                  <dt className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                    {highlight.label}
                  </dt>
                  <dd className="mt-1 font-serif text-xl">{highlight.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="border border-line bg-white p-6">
              <p className="eyebrow text-gold">{area.name} questions</p>
              <h3 className="mt-2 text-2xl">Ask about this area</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Schools, commutes, HOAs, which streets to avoid — ask anything.
                I&apos;ll answer straight.
              </p>
              <div className="mt-6">
                <LeadForm
                  type="contact"
                  compact
                  submitLabel="Send question"
                  successTitle="Question received."
                  successBody="Kelly will get back to you within one business day."
                  messageLabel="Your question"
                  messagePlaceholder={`What should I know about buying in ${area.name}?`}
                  hidden={{ neighborhood: area.name }}
                />
              </div>
            </div>
          </aside>
        </div>
      </Section>

      {areaListings.length ? (
        <Section className="bg-sand">
          <SectionHeading
            eyebrow="Available now"
            title={`Listings in ${area.name}`}
            align="left"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {areaListings.map((listing) => (
              <PropertyCard key={listing.slug} listing={listing} />
            ))}
          </div>
          <div className="mt-10">
            <ButtonLink href="/listings" variant="outline">
              See all listings
            </ButtonLink>
          </div>
        </Section>
      ) : null}

      <Section>
        <SectionHeading eyebrow="Keep exploring" title="Other areas" align="left" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((other) => (
            <Link
              key={other.slug}
              href={`/neighborhoods/${other.slug}`}
              className="flex min-h-[180px] items-end p-6 text-white transition-opacity hover:opacity-90"
              style={{
                backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.1)), url('${other.image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div>
                <h3 className="font-serif text-2xl text-white">{other.name}</h3>
                <p className="mt-1 text-xs text-white/70">Median {other.medianPrice}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
