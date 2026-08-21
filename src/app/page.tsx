import Link from "next/link";
import Image from "next/image";
import { ButtonLink, Card, CtaBand, Eyebrow, Section, SectionHeading, StatBand } from "@/components/ui";
import { HeroMedia } from "@/components/hero-media";
import { PropertyCard } from "@/components/property-card";
import { listings } from "@/data/listings";
import { neighborhoods } from "@/data/neighborhoods";
import { site } from "@/data/site";

const services = [
  {
    title: "Buy a Home",
    body: "Find the right home while keeping equity and long-term value in focus.",
    href: "/buy",
  },
  {
    title: "Sell Your Home",
    body: "Strategic pricing, positioning and negotiation designed around your next move.",
    href: "/sell",
  },
  {
    title: "Invest in Property",
    body: "Build a portfolio with a disciplined acquisition strategy and real numbers.",
    href: "/invest",
  },
  {
    title: "Commercial Properties",
    body: "Purchases, sales and investment opportunities across the commercial market.",
    href: "/commercial",
  },
  {
    title: "Property Valuation",
    body: "Understand exactly where your property sits before you make a decision.",
    href: "/home-value",
  },
  {
    title: "Relocation",
    body: "Navigate Phoenix communities, lifestyle and real estate from out of state.",
    href: "/neighborhoods",
  },
];

/**
 * Hero media. Drop an MP4 at public/hero/hero.mp4 and this picks it up —
 * see docs/HERO-VIDEO.md for encoding settings and what makes a good clip.
 * The poster is what everyone sees first, and all that phones ever see.
 */
const heroPoster =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85";
// Set this to your video path(s) to switch the hero to video, e.g.
//   ["/hero/hero.webm", "/hero/hero.mp4"]
// See docs/HERO-VIDEO.md. Leave undefined to keep the poster image.
const heroVideo: string | string[] | undefined = undefined;

export default function HomePage() {
  const featured = listings.filter((l) => l.featured).slice(0, 4);

  return (
    <>
      {/* Hero — drops in a video automatically once one exists at the path in
          heroVideo below. Until then the poster image carries it. */}
      <HeroMedia poster={heroPoster} videoSrc={heroVideo}>
        <div className="max-w-2xl text-white">
          <Eyebrow>Residential · Commercial · Investment</Eyebrow>
            <h1 className="mt-5 font-serif text-[2.75rem] leading-[1.03] md:text-6xl lg:text-[4.25rem]">
              Real estate is more than a transaction.
              <span className="mt-2 block text-gold-light">
                It&apos;s a path to generational wealth.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80">
              Helping individuals, families and investors make smarter real estate
              decisions throughout Greater Phoenix — from a first home to a commercial
              portfolio.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/home-value">What&apos;s My Home Worth?</ButtonLink>
              <ButtonLink href="/listings" variant="light">
                Browse Listings
              </ButtonLink>
              <ButtonLink href="/contact" variant="light">
                Book a Consultation
              </ButtonLink>
          </div>
        </div>
      </HeroMedia>

      <StatBand stats={site.stats} />

      {/* Services */}
      <Section>
        <SectionHeading
          eyebrow="Strategic real estate guidance"
          title="How can I help you?"
          intro="Every engagement starts with a clear strategy built around your goals, timeline and long-term wealth plan."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.title} title={service.title} href={service.href}>
              {service.body}
            </Card>
          ))}
        </div>
      </Section>

      {/* Residential / Commercial split */}
      <section className="grid lg:grid-cols-2">
        {[
          {
            eyebrow: "Residential",
            title: "Buy. Sell.\nBuild equity.",
            body: "Thoughtful representation for buyers and sellers who want more than a transaction.",
            href: "/buy",
            cta: "Explore residential",
            image:
              "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85",
          },
          {
            eyebrow: "Commercial",
            title: "Build. Grow.\nInvest.",
            body: "Commercial real estate guidance for owners, investors and growing businesses.",
            href: "/commercial",
            cta: "Explore commercial",
            image:
              "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=85",
          },
        ].map((panel) => (
          <article
            key={panel.eyebrow}
            className="flex min-h-[460px] items-end p-10 text-white md:p-14"
            style={{
              backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.85), rgba(0,0,0,0.1)), url('${panel.image}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div>
              <Eyebrow>{panel.eyebrow}</Eyebrow>
              <h2 className="mt-3 whitespace-pre-line text-4xl leading-tight text-white md:text-5xl">
                {panel.title}
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-white/75">{panel.body}</p>
              <div className="mt-7">
                <ButtonLink href={panel.href} variant="light">
                  {panel.cta}
                </ButtonLink>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Featured listings */}
      <Section>
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <Eyebrow tone="ink">Curated inventory</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-[2.75rem]">Featured opportunities</h2>
            <p className="mt-4 leading-relaxed text-ink-soft">
              A selection of current residential, commercial and investment listings.
              Kelly has access to every property on the ARMLS, including off-market
              opportunities.
            </p>
          </div>
          <ButtonLink href="/listings" variant="outline">
            View all listings
          </ButtonLink>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((listing) => (
            <PropertyCard key={listing.slug} listing={listing} />
          ))}
        </div>
      </Section>

      {/* Wealth */}
      <section className="bg-charcoal px-6 py-20 text-white md:px-10 md:py-24 lg:px-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Eyebrow>Real estate with purpose</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight text-white md:text-[2.75rem]">
              Build wealth at every stage of your real estate journey.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-white/70">
              Most agents optimize for the transaction in front of them. I look at how
              each property decision compounds — what it does to your equity position,
              your tax picture and your ability to make the next move.
            </p>
            <div className="mt-8">
              <ButtonLink href="/invest">Build my strategy</ButtonLink>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { n: "01", title: "Own", body: "Build equity through the right home purchase." },
              { n: "02", title: "Grow", body: "Acquire investment property strategically." },
              { n: "03", title: "Expand", body: "Move into commercial when the numbers support it." },
            ].map((item) => (
              <div key={item.n} className="border border-white/15 p-6">
                <span className="eyebrow text-gold-light">{item.n}</span>
                <h3 className="mt-2 text-2xl text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About preview */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="relative aspect-[4/5] w-full">
            <Image
              src="/kelly/portrait-bridge.jpg"
              alt="Kelly Rojas, Phoenix real estate consultant"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <Eyebrow tone="ink">Meet Kelly Rojas</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-[2.75rem]">
              Real estate with a bigger purpose.
            </h2>
            <p className="mt-5 leading-relaxed text-ink-soft">
              With more than a decade in real estate, 100+ transactions since 2016 and
              over $50M in sales volume, Kelly helps clients use residential and
              commercial property as a tool for building generational wealth.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              She works across both sides of the market — a rare combination that means
              a client&apos;s first home and their first commercial acquisition can be
              guided by the same person.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/about" variant="dark">
                More about Kelly
              </ButtonLink>
              <ButtonLink href="/contact" variant="outline">
                Get in touch
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      {/* Neighborhoods */}
      <Section className="bg-sand">
        <SectionHeading
          eyebrow="Local knowledge"
          title="Explore Greater Phoenix"
          intro="Honest market notes on the submarkets I work every week — what things cost, how fast they move and who each area actually suits."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {neighborhoods.map((area) => (
            <Link
              key={area.slug}
              href={`/neighborhoods/${area.slug}`}
              className="group relative flex min-h-[220px] items-end overflow-hidden p-6 text-white"
              style={{
                backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.8), rgba(0,0,0,0.1)), url('${area.image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div>
                <h3 className="font-serif text-2xl text-white">{area.name}</h3>
                <p className="mt-1 text-xs text-white/70">
                  Median {area.medianPrice}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
