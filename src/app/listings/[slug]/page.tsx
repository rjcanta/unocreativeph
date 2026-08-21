import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/lead-form";
import { PropertyCard } from "@/components/property-card";
import { MortgageCalculator } from "@/components/mortgage-calculator";
import { ButtonLink, Eyebrow, Section, SectionHeading } from "@/components/ui";
import {
  formatListingPrice,
  formatNumber,
  formatPrice,
  getListing,
  listings,
} from "@/data/listings";
import { site } from "@/data/site";

export function generateStaticParams() {
  return listings.map((listing) => ({ slug: listing.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = getListing(slug);
  if (!listing) return { title: "Listing not found" };

  return {
    title: `${listing.title} — ${listing.city}, AZ`,
    description: listing.summary,
    openGraph: {
      title: `${listing.title} — ${formatListingPrice(listing)}`,
      description: listing.summary,
      images: [listing.image],
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = getListing(slug);
  if (!listing) notFound();

  const similar = listings
    .filter((l) => l.slug !== listing.slug && l.type === listing.type)
    .slice(0, 3);

  const facts = [
    { label: "Status", value: listing.status },
    { label: "Type", value: listing.type },
    ...(listing.beds > 0
      ? [
          { label: "Bedrooms", value: String(listing.beds) },
          { label: "Bathrooms", value: String(listing.baths) },
        ]
      : []),
    ...(listing.sqft > 0
      ? [
          { label: "Interior", value: `${formatNumber(listing.sqft)} sqft` },
          ...(listing.priceUnit === "total"
            ? [
                {
                  label: "Price / sqft",
                  value: formatPrice(Math.round(listing.price / listing.sqft)),
                },
              ]
            : []),
        ]
      : []),
    ...(listing.lotSqft > 0
      ? [{ label: "Lot size", value: `${formatNumber(listing.lotSqft)} sqft` }]
      : []),
    ...(listing.yearBuilt > 0
      ? [{ label: "Year built", value: String(listing.yearBuilt) }]
      : []),
    ...(listing.hoa !== null
      ? [{ label: "HOA", value: `${formatPrice(listing.hoa)} / mo` }]
      : []),
    ...(listing.mlsId ? [{ label: "MLS #", value: listing.mlsId }] : []),
  ];

  return (
    <>
      <div className="border-b border-line bg-white px-6 py-4 md:px-10 lg:px-16">
        <div className="mx-auto max-w-6xl text-sm text-ink-soft">
          <Link href="/listings" className="hover:text-gold">
            ← All listings
          </Link>
        </div>
      </div>

      {/* Gallery — a single photo spans the full width; extras stack beside it. */}
      <section
        className={`grid gap-1 bg-white ${listing.gallery.length > 1 ? "md:grid-cols-3" : ""}`}
      >
        <div
          className={`relative aspect-[16/10] md:aspect-auto md:min-h-[460px] ${
            listing.gallery.length > 1 ? "md:col-span-2" : ""
          }`}
        >
          <Image
            src={listing.gallery[0]}
            alt={listing.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 66vw"
            className="object-cover"
          />
        </div>
        <div className={listing.gallery.length > 1 ? "grid gap-1" : "hidden"}>
          {listing.gallery.slice(1, 3).map((src, index) => (
            <div key={src} className="relative aspect-[16/9] md:min-h-[229px]">
              <Image
                src={src}
                alt={`${listing.title} — view ${index + 2}`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          ))}
          {listing.gallery.length === 2 ? (
            <div className="flex min-h-[229px] items-center justify-center bg-sand p-8 text-center">
              <p className="text-sm text-ink-soft">
                Additional photography available on request.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr] lg:items-start">
          <div>
            <Eyebrow tone="ink">
              {listing.city}, {listing.state} {listing.zip} · {listing.status}
            </Eyebrow>
            <h1 className="mt-3 font-serif text-4xl md:text-5xl">{listing.title}</h1>
            <p className="mt-2 text-lg text-ink-soft">{listing.address}</p>
            <p className="mt-5 font-serif text-4xl text-gold">
              {formatListingPrice(listing)}
            </p>

            {listing.summary ? (
              <p className="mt-7 text-lg leading-relaxed">{listing.summary}</p>
            ) : null}

            <div className="mt-8 space-y-4 leading-relaxed text-ink-soft">
              {listing.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-10">
              <h2 className="text-2xl">Property facts</h2>
              <dl className="mt-5 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3">
                {facts.map((fact) => (
                  <div key={fact.label} className="bg-white p-5">
                    <dt className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 font-serif text-lg">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className={listing.features.length ? "mt-10" : "hidden"}>
              <h2 className="text-2xl">Features</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {listing.features.map((feature) => (
                  <li key={feature} className="flex gap-3 text-[0.938rem] text-ink-soft">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-gold" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:sticky lg:top-28">
            <div className="border border-line bg-white p-6">
              <p className="eyebrow text-gold">Request a showing</p>
              <h2 className="mt-2 text-2xl">Ask Kelly about this property</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Questions, a private tour, the seller&apos;s disclosure package, or the
                full comparable-sales picture — just ask.
              </p>
              <div className="mt-6">
                <LeadForm
                  type="listing-inquiry"
                  compact
                  submitLabel="Send inquiry"
                  successTitle="Inquiry sent."
                  successBody="Kelly will reach out within one business day with availability and any documents you asked for."
                  messageLabel="Your question"
                  messagePlaceholder={`I'd like to tour ${listing.address}…`}
                  hidden={{
                    listing: listing.title,
                    address: `${listing.address}, ${listing.city}`,
                    mlsId: listing.mlsId,
                    price: formatListingPrice(listing),
                  }}
                  extraFields={[
                    {
                      name: "interest",
                      label: "I'd like to",
                      type: "select",
                      options: [
                        "Schedule a private tour",
                        "See the disclosure package",
                        "Discuss making an offer",
                        "Just gathering information",
                      ],
                    },
                  ]}
                />
              </div>
              <div className="mt-5 border-t border-line pt-5 text-sm">
                <a href={site.phoneHref} className="font-serif text-xl hover:text-gold">
                  {site.phone}
                </a>
                <p className="mt-1 text-ink-soft">
                  {site.name} · {site.brokerage}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </Section>

      {listing.type === "Residential" && listing.priceUnit === "total" ? (
        <Section className="bg-sand">
          <SectionHeading
            eyebrow="Run the numbers"
            title="What would this cost per month?"
            intro="Pre-loaded with this property's price and HOA. Adjust the down payment and rate to match your situation."
          />
          <MortgageCalculator initialPrice={listing.price} />
        </Section>
      ) : null}

      {similar.length ? (
        <Section>
          <SectionHeading
            eyebrow="Similar properties"
            title={`More ${listing.type.toLowerCase()} opportunities`}
            align="left"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((item) => (
              <PropertyCard key={item.slug} listing={item} />
            ))}
          </div>
          <div className="mt-10">
            <ButtonLink href="/listings" variant="outline">
              View all listings
            </ButtonLink>
          </div>
        </Section>
      ) : null}
    </>
  );
}
