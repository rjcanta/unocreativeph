import Image from "next/image";
import Link from "next/link";
import { formatNumber, formatPrice, type Listing } from "@/data/listings";

const statusStyles: Record<Listing["status"], string> = {
  "For Sale": "bg-gold text-white",
  Pending: "bg-ink text-white",
  Sold: "bg-white text-ink border border-line",
  "Coming Soon": "bg-ink-soft text-white",
};

export function PropertyCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="group flex h-full flex-col border border-line bg-white transition-colors hover:border-gold"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className={`absolute left-0 top-0 px-3 py-2 text-[0.625rem] font-bold uppercase tracking-[0.12em] ${statusStyles[listing.status]}`}
        >
          {listing.status}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow text-gold">
          {listing.city} · {listing.type}
        </p>
        <h3 className="mt-2 text-xl">{listing.title}</h3>
        <p className="mt-1 text-sm text-ink-soft">{listing.address}</p>
        <p className="mt-3 font-serif text-2xl">{formatPrice(listing.price)}</p>
        <p className="mt-auto pt-4 text-xs text-ink-soft">
          {listing.beds > 0 ? `${listing.beds} bd · ${listing.baths} ba · ` : ""}
          {listing.sqft > 0
            ? `${formatNumber(listing.sqft)} sqft`
            : `${formatNumber(Math.round(listing.lotSqft / 43560 * 100) / 100)} acres`}
        </p>
      </div>
    </Link>
  );
}
