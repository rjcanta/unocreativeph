"use client";

import { useMemo, useState } from "react";
import { PropertyCard } from "@/components/property-card";
import { formatPrice, type Listing, type ListingStatus, type ListingType } from "@/data/listings";

const types: (ListingType | "All")[] = [
  "All",
  "Residential",
  "Commercial",
  "Investment",
  "Land",
];

const statuses: (ListingStatus | "All")[] = [
  "All",
  "For Sale",
  "For Lease",
  "Pending",
  "Sold",
];

const sorts = [
  { id: "price-desc", label: "Price: high to low" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "sqft-desc", label: "Largest first" },
  { id: "newest", label: "Newest construction" },
] as const;

type SortId = (typeof sorts)[number]["id"];

export function ListingBrowser({ listings }: { listings: Listing[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof types)[number]>("All");
  const [status, setStatus] = useState<(typeof statuses)[number]>("All");
  const [maxPrice, setMaxPrice] = useState(5000000);
  const [minBeds, setMinBeds] = useState(0);
  const [sort, setSort] = useState<SortId>("price-desc");

  const cities = useMemo(
    () => Array.from(new Set(listings.map((l) => l.city))).sort(),
    [listings],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = listings.filter((listing) => {
      if (type !== "All" && listing.type !== type) return false;
      if (status !== "All" && listing.status !== status) return false;
      if (listing.price > maxPrice) return false;
      if (minBeds > 0 && listing.beds < minBeds) return false;
      if (!q) return true;

      return [
        listing.title,
        listing.address,
        listing.city,
        listing.zip,
        listing.type,
        listing.mlsId,
        listing.summary,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const sorted = [...filtered];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.price - b.price);
        break;
      case "sqft-desc":
        sorted.sort((a, b) => b.sqft - a.sqft);
        break;
      case "newest":
        sorted.sort((a, b) => b.yearBuilt - a.yearBuilt);
        break;
      default:
        sorted.sort((a, b) => b.price - a.price);
    }
    return sorted;
  }, [listings, query, type, status, maxPrice, minBeds, sort]);

  const filtersActive =
    query !== "" || type !== "All" || status !== "All" || maxPrice < 5000000 || minBeds > 0;

  function reset() {
    setQuery("");
    setType("All");
    setStatus("All");
    setMaxPrice(5000000);
    setMinBeds(0);
  }

  return (
    <div>
      <div className="border border-line bg-white p-5 md:p-7">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <label className="label" htmlFor="listing-search">
              Search
            </label>
            <input
              id="listing-search"
              className="field"
              placeholder={`City, address, MLS# — try "${cities[0] ?? "Phoenix"}"`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="listing-beds">
              Minimum bedrooms
            </label>
            <select
              id="listing-beds"
              className="field"
              value={minBeds}
              onChange={(e) => setMinBeds(Number(e.target.value))}
            >
              <option value={0}>Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+ bedrooms
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="listing-sort">
              Sort by
            </label>
            <select
              id="listing-sort"
              className="field"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
            >
              {sorts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_1.2fr]">
          <div>
            <span className="label">Property type</span>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <Chip key={t} label={t} selected={type === t} onClick={() => setType(t)} />
              ))}
            </div>
          </div>
          <div>
            <span className="label">Status</span>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={status === s}
                  onClick={() => setStatus(s)}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <span className="label mb-0">Max price</span>
              <span className="font-serif text-lg">
                {maxPrice >= 5000000 ? "No limit" : formatPrice(maxPrice)}
              </span>
            </div>
            <input
              type="range"
              aria-label="Maximum price"
              min={250000}
              max={5000000}
              step={25000}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none bg-sand accent-[#b98945]"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Showing <strong className="text-ink">{results.length}</strong> of{" "}
          {listings.length} properties
        </p>
        {filtersActive ? (
          <button
            type="button"
            onClick={reset}
            className="text-[0.688rem] font-bold uppercase tracking-[0.14em] text-gold hover:underline"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      {results.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((listing) => (
            <PropertyCard key={listing.slug} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="mt-5 border border-line bg-white px-6 py-16 text-center">
          <h3 className="text-2xl">Nothing matches those filters.</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
            The public site shows a curated selection. Kelly has access to every
            listing on the ARMLS — tell her what you&apos;re after and she&apos;ll
            send matches directly, including off-market opportunities.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 border border-ink/25 px-6 py-3 text-[0.688rem] font-bold uppercase tracking-[0.14em] transition-colors hover:bg-ink hover:text-white"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`border px-4 py-2 text-sm transition-colors ${
        selected ? "border-gold bg-gold text-white" : "border-line hover:border-ink/30"
      }`}
    >
      {label}
    </button>
  );
}
