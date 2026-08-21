import type { Metadata } from "next";
import { ListingBrowser } from "@/components/listing-browser";
import { CtaBand, PageHero, Section } from "@/components/ui";
import { listings } from "@/data/listings";

export const metadata: Metadata = {
  title: "Phoenix Homes & Commercial Property for Sale",
  description:
    "Browse curated residential, commercial, investment and land listings across Greater Phoenix. Filter by price, type, status and bedrooms.",
};

export default function ListingsPage() {
  return (
    <>
      <PageHero
        eyebrow="Current inventory"
        title={
          <>
            Listings across
            <span className="block text-gold-light">Greater Phoenix.</span>
          </>
        }
        intro="A curated selection of residential, commercial, investment and land opportunities. Kelly has full ARMLS access — if you don't see it here, ask."
        image="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1800&q=85"
      />

      <Section>
        <ListingBrowser listings={listings} />
      </Section>

      <CtaBand
        eyebrow="Not seeing it?"
        title="The right property may not be listed yet."
        intro="A meaningful share of what I sell trades before it reaches the public MLS. Tell me your criteria and I'll watch for it."
        primary={{ href: "/buy", label: "Set up my search" }}
        secondary={{ href: "/contact", label: "Contact Kelly" }}
      />
    </>
  );
}
