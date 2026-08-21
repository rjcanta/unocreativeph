import Image from "next/image";
import { formatNumber, formatPrice } from "@/data/listings";
import { sideLabels, transactions, type Transaction } from "@/data/transactions";

export function RecentTransactions({
  items = transactions,
}: {
  items?: Transaction[];
}) {
  if (!items.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((deal) => (
        <article
          key={deal.mlsId ?? deal.address}
          className="flex flex-col overflow-hidden border border-line bg-white"
        >
          {deal.image ? (
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={deal.image}
                alt={`${deal.address}, ${deal.city}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : null}

          <div className="flex flex-1 flex-col p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-ink px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-white">
              Closed
            </span>
            <span className="text-[0.688rem] font-bold uppercase tracking-[0.14em] text-gold">
              {sideLabels[deal.side]}
            </span>
          </div>

          <h3 className="mt-5 text-2xl">{deal.address}</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {deal.city}, {deal.state} {deal.zip}
          </p>

          <p className="mt-4 font-serif text-3xl">{formatPrice(deal.price)}</p>

          {deal.beds || deal.sqft ? (
            <p className="mt-2 text-xs uppercase tracking-[0.1em] text-ink-soft">
              {deal.beds ? `${deal.beds} bd · ` : ""}
              {deal.baths ? `${deal.baths} ba · ` : ""}
              {deal.sqft ? `${formatNumber(deal.sqft)} sqft` : ""}
              {deal.yearBuilt ? ` · built ${deal.yearBuilt}` : ""}
            </p>
          ) : null}

          <p className="mt-5 text-[0.938rem] leading-relaxed text-ink-soft">
            {deal.note}
          </p>
          </div>
        </article>
      ))}
    </div>
  );
}
