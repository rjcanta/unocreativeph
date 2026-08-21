export type ListingStatus =
  | "For Sale"
  | "For Lease"
  | "Pending"
  | "Sold"
  | "Coming Soon";

/** "total" is a sale price; "month" is rent, rendered as "$2,600/mo". */
export type PriceUnit = "total" | "month";
export type ListingType = "Residential" | "Commercial" | "Investment" | "Land";

/** The normalized shape every component consumes. Built by normalizeListing(). */
export type Listing = {
  slug: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  priceUnit: PriceUnit;
  status: ListingStatus;
  type: ListingType;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  yearBuilt: number;
  hoa: number | null;
  mlsId: string;
  image: string;
  gallery: string[];
  summary: string;
  description: string[];
  features: string[];
  featured: boolean;
};

/**
 * What you actually write when adding a listing by hand. Only seven fields are
 * required; everything else falls back to a sensible default and is simply
 * omitted from the page when absent. See docs/ADDING-LISTINGS.md.
 */
export type ListingInput = {
  /** URL segment, lowercase with hyphens: /listings/<slug> */
  slug: string;
  title: string;
  address: string;
  city: string;
  price: number;
  status: ListingStatus;
  type: ListingType;

  /** Defaults to "month" when status is "For Lease", otherwise "total". */
  priceUnit?: PriceUnit;
  state?: string;
  zip?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  hoa?: number | null;
  mlsId?: string;
  /** Main photo. Defaults to the first gallery image, then a placeholder. */
  image?: string;
  gallery?: string[];
  /** One-line description shown on the card and at the top of the page. */
  summary?: string;
  /** Full description. A single string is treated as one paragraph. */
  description?: string | string[];
  features?: string[];
  /** Show on the home page (it displays the first four). */
  featured?: boolean;
};

const PLACEHOLDER_IMAGE = "/listing-placeholder.svg";

/** Fills in defaults so a hand-written listing needs only the essentials. */
export function normalizeListing(input: ListingInput): Listing {
  const gallery = input.gallery?.filter(Boolean) ?? [];
  const image = input.image ?? gallery[0] ?? PLACEHOLDER_IMAGE;
  const description =
    typeof input.description === "string"
      ? [input.description]
      : (input.description ?? []);

  return {
    ...input,
    priceUnit: input.priceUnit ?? (input.status === "For Lease" ? "month" : "total"),
    state: input.state ?? "AZ",
    zip: input.zip ?? "",
    beds: input.beds ?? 0,
    baths: input.baths ?? 0,
    sqft: input.sqft ?? 0,
    lotSqft: input.lotSqft ?? 0,
    yearBuilt: input.yearBuilt ?? 0,
    hoa: input.hoa ?? null,
    mlsId: input.mlsId ?? "",
    image,
    gallery: gallery.length ? gallery : [image],
    summary: input.summary ?? "",
    description,
    features: input.features ?? [],
    featured: input.featured ?? false,
  };
}
/* ---------------------------------------------------------------------------
 * INVENTORY
 *
 * To add a listing, copy this template into the array below. Only the first
 * seven fields are required. Full walkthrough: docs/ADDING-LISTINGS.md
 *
 *   {
 *     slug: "1234-e-main-st-phoenix",
 *     title: "Renovated Arcadia Ranch",
 *     address: "1234 E Main St",
 *     city: "Phoenix",
 *     price: 750000,
 *     status: "For Sale",          // For Sale | Pending | Sold | Coming Soon
 *     type: "Residential",         // Residential | Commercial | Investment | Land
 *     zip: "85018",
 *     beds: 4,
 *     baths: 3,
 *     sqft: 2400,
 *     yearBuilt: 1962,
 *     mlsId: "6712345",
 *     gallery: ["/listings/1234-e-main-st/front.jpg"],
 *     summary: "One line that appears on the card and at the top of the page.",
 *     description: "A paragraph, or an array of paragraphs.",
 *     features: ["Pool", "No HOA", "RV gate"],
 *     featured: true,              // show on the home page
 *   },
 *
 * ------------------------------------------------------------------------- */
const inventory: ListingInput[] = [
  {
    slug: "2238-e-mulberry-dr-phoenix",
    title: "Biltmore Beauty — Remodeled Mid-Century Ranch",
    address: "2238 E Mulberry Dr",
    city: "Phoenix",
    zip: "85016",
    price: 2600,
    status: "For Lease",
    type: "Residential",
    beds: 3,
    baths: 2,
    sqft: 1350,
    lotSqft: 9287,
    yearBuilt: 1950,
    mlsId: "7037969",
    gallery: ["/listings/2238-e-mulberry-dr/main.jpg"],
    summary:
      "Fully remodeled single-level mid-century ranch in the Camelback Corridor, available for lease at $2,600 a month.",
    description: [
      "A fully remodeled single-level contemporary mid-century ranch in a prime Central Phoenix / Camelback Corridor location, close to Arcadia-area schools, dining, shopping, freeways and hiking.",
      "The interior is move-in ready with updated modern finishes, strong natural light, solid wood cabinetry, custom quartz countertops and an efficient open layout. The backyard is the surprise: unusually large and private, with a new wood fence, an RV gate and a 350 square foot covered patio with recessed lighting and dual ceiling fans.",
      "Available 6/5/2026 on a 12-month minimum lease. Tenant pays electric, gas and water. Pet-friendly subject to owner approval.",
    ],
    features: [
      "Fully remodeled, move-in ready",
      "Quartz countertops and solid wood cabinetry",
      "350 sqft covered patio with recessed lighting",
      "Large private backyard with new wood fence",
      "RV gate and covered carport parking",
      "Inside laundry with stacked washer/dryer hookups",
      "Central air plus mini split, dual pane windows",
      "Madison Elementary District · Camelback High School",
    ],
    featured: true,
  },
  {
    slug: "6801-n-59th-ave-glendale",
    title: "1-Acre C-2 Commercial Site — Downtown Glendale",
    address: "6801 N 59th Ave, Lots 42-46",
    city: "Glendale",
    zip: "85301",
    price: 815000,
    status: "For Sale",
    type: "Land",
    lotSqft: 43962,
    mlsId: "6930979",
    gallery: ["/listings/6801-n-59th-ave/aerial.jpg"],
    summary:
      "Two adjoining C-2 General Commercial parcels totaling roughly one acre on a high-traffic corner in downtown Glendale.",
    description: [
      "A premium one-acre C-2 commercial opportunity site in the downtown Glendale corridor: two adjoining General Commercial parcels totaling approximately 43,962 square feet, on a hard corner with excellent visibility and dual access from 59th Avenue and Market Street.",
      "C-2 zoning supports broad development potential — retail, restaurant, drive-thru, office, medical, automotive service and a wide range of commercial uses. The land is flat and usable with no existing structures, and utilities run within 350 feet of the site.",
      "Includes APN 146-01-106-E and APN 146-01-010-B. A rare high-exposure site for developers or owner-users, surrounded by strong area growth and downtown Glendale's ongoing revitalization.",
    ],
    features: [
      "Two adjoining parcels, approx. 1.0 acre combined",
      "Zoned C-2 General Commercial",
      "Hard corner with dual access from 59th Ave and Market St",
      "Lot dimensions 205 x 205, flat and usable",
      "No existing structures — raw land",
      "All utilities within 350 feet",
      "Cash, conventional, SBA or 1031 exchange",
      "2024 taxes: $3,996",
    ],
    featured: true,
  },
];

export const listings: Listing[] = inventory.map(normalizeListing);

export function getListing(slug: string) {
  return listings.find((l) => l.slug === slug);
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

/** Formats a listing's price, appending "/mo" for lease listings. */
export function formatListingPrice(
  listing: Pick<Listing, "price" | "priceUnit">,
): string {
  const amount = formatPrice(listing.price);
  return listing.priceUnit === "month" ? `${amount}/mo` : amount;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
