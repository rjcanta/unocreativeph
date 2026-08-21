export type ListingStatus = "For Sale" | "Pending" | "Sold" | "Coming Soon";
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
 * The entries below are PLACEHOLDER DEMO DATA with invented addresses and MLS
 * numbers. Delete them once Kelly's real listings are in.
 * ------------------------------------------------------------------------- */
const inventory: ListingInput[] = [
  {
    slug: "modern-desert-residence-scottsdale",
    title: "Modern Desert Residence",
    address: "8427 E Cactus Ridge Rd",
    city: "Scottsdale",
    state: "AZ",
    zip: "85255",
    price: 2750000,
    status: "For Sale",
    type: "Residential",
    beds: 5,
    baths: 4.5,
    sqft: 4820,
    lotSqft: 21780,
    yearBuilt: 2021,
    hoa: 285,
    mlsId: "6712345",
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "A contemporary five-bedroom estate backing to open desert with unobstructed McDowell Mountain views.",
    description: [
      "Set on a half-acre north Scottsdale lot, this 2021 build pairs a disappearing wall of glass with a resort-grade backyard — negative-edge pool, sunken fire lounge and a covered ramada with full outdoor kitchen.",
      "The primary suite occupies its own wing with a private patio, dual closets and a spa bath finished in honed marble. A separate casita works equally well as a guest suite or dedicated home office.",
    ],
    features: [
      "Negative-edge pool and spa",
      "Detached guest casita",
      "Chef's kitchen with Wolf/Sub-Zero package",
      "Owned solar array",
      "Four-car garage with EV charging",
      "Backs to protected desert preserve",
    ],
    featured: true,
  },
  {
    slug: "arcadia-luxury-residence-phoenix",
    title: "Arcadia Luxury Residence",
    address: "4512 E Calle Redonda",
    city: "Phoenix",
    state: "AZ",
    zip: "85018",
    price: 1150000,
    status: "For Sale",
    type: "Residential",
    beds: 4,
    baths: 3,
    sqft: 2940,
    lotSqft: 12500,
    yearBuilt: 1958,
    hoa: null,
    mlsId: "6712377",
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Fully reimagined mid-century ranch in the Arcadia lite corridor, walkable to the 44th Street restaurants.",
    description: [
      "A 2022 studs-out renovation kept the low-slung mid-century lines while opening the interior into a single light-filled great room anchored by a 12-foot quartzite island.",
      "The lot is the story here: mature citrus, a north-south orientation and room for a casita or pickleball court behind the existing pool.",
    ],
    features: [
      "Studs-out 2022 renovation",
      "Camelback Mountain views",
      "Mature citrus grove",
      "No HOA",
      "Diving pool with new equipment",
      "Walkable to Arcadia dining",
    ],
    featured: true,
  },
  {
    slug: "class-a-office-tempe",
    title: "Class A Office Opportunity",
    address: "1180 W Rio Salado Pkwy",
    city: "Tempe",
    state: "AZ",
    zip: "85281",
    price: 4200000,
    status: "For Sale",
    type: "Commercial",
    beds: 0,
    baths: 0,
    sqft: 18400,
    lotSqft: 43560,
    yearBuilt: 2015,
    hoa: null,
    mlsId: "6698120",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Stabilized two-story office building on Tempe Town Lake with 92% occupancy and staggered lease expirations.",
    description: [
      "18,400 rentable square feet across two floors, currently 92% leased to five tenants with a weighted average lease term of 4.1 years.",
      "Ownership completed a full HVAC replacement in 2023 and re-roofed in 2022, leaving minimal near-term capital exposure for a new buyer.",
    ],
    features: [
      "92% leased, 5 tenants",
      "6.4% in-place cap rate",
      "HVAC replaced 2023, roof 2022",
      "74 surface parking spaces",
      "Light rail within 0.3 miles",
      "Rio Salado frontage",
    ],
    featured: true,
  },
  {
    slug: "industrial-income-property-glendale",
    title: "Industrial Income Property",
    address: "6720 N 55th Ave",
    city: "Glendale",
    state: "AZ",
    zip: "85301",
    price: 3600000,
    status: "For Sale",
    type: "Investment",
    beds: 0,
    baths: 0,
    sqft: 32000,
    lotSqft: 87120,
    yearBuilt: 2008,
    hoa: null,
    mlsId: "6701244",
    image:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Single-tenant industrial flex building with 24-foot clear height and eight years remaining on an absolute NNN lease.",
    description: [
      "32,000 square feet of dock-high industrial space leased to a regional distributor through 2034 with 3% annual escalations.",
      "Absolute NNN structure means no landlord responsibilities — a genuinely passive hold for a 1031 exchange buyer.",
    ],
    features: [
      "Absolute NNN, zero landlord duties",
      "8 years remaining term",
      "3% annual rent escalations",
      "24' clear height, 4 dock doors",
      "Two acres, fully fenced yard",
      "Ideal 1031 exchange replacement",
    ],
    featured: true,
  },
  {
    slug: "peoria-family-home",
    title: "Vistancia Family Home",
    address: "29815 N Sunray Dr",
    city: "Peoria",
    state: "AZ",
    zip: "85383",
    price: 685000,
    status: "Pending",
    type: "Residential",
    beds: 4,
    baths: 3,
    sqft: 2610,
    lotSqft: 8100,
    yearBuilt: 2016,
    hoa: 112,
    mlsId: "6705991",
    image:
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Move-in-ready four bedroom in Vistancia with a north-facing backyard and community trail access.",
    description: [
      "A practical, well-kept 2016 floor plan with the bedroom-plus-full-bath downstairs that buyers keep asking for.",
      "Vistancia's trail system connects directly to the greenbelt at the end of the street, and the Peoria Unified schools serving the community rate among the best in the West Valley.",
    ],
    features: [
      "Downstairs bed and full bath",
      "North-facing backyard",
      "Owned water softener",
      "Three-car tandem garage",
      "Greenbelt trail access",
      "Highly rated school boundary",
    ],
    featured: false,
  },
  {
    slug: "downtown-phoenix-loft",
    title: "Roosevelt Row Loft",
    address: "915 N 2nd St #308",
    city: "Phoenix",
    state: "AZ",
    zip: "85004",
    price: 479000,
    status: "For Sale",
    type: "Residential",
    beds: 2,
    baths: 2,
    sqft: 1340,
    lotSqft: 0,
    yearBuilt: 2019,
    hoa: 395,
    mlsId: "6709812",
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Corner loft in the arts district with 14-foot ceilings, two parking spaces and skyline views.",
    description: [
      "A true corner unit with windows on two exposures — rare in this building and the reason it lives far larger than 1,340 square feet.",
      "Walk Score of 91: Roosevelt Row galleries, the light rail and downtown employers are all within a few blocks.",
    ],
    features: [
      "14-foot exposed ceilings",
      "Two deeded parking spaces",
      "Corner unit, dual exposure",
      "Rooftop pool and lounge",
      "Walk Score 91",
      "Light rail two blocks away",
    ],
    featured: false,
  },
  {
    slug: "west-valley-development-land",
    title: "West Valley Development Parcel",
    address: "NEC Jomax Rd & 195th Ave",
    city: "Surprise",
    state: "AZ",
    zip: "85387",
    price: 1890000,
    status: "For Sale",
    type: "Land",
    beds: 0,
    baths: 0,
    sqft: 0,
    lotSqft: 435600,
    yearBuilt: 0,
    hoa: null,
    mlsId: "6688457",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Ten entitled acres in the Surprise growth corridor, utilities stubbed to the property line.",
    description: [
      "Ten acres entitled for residential development in one of the fastest-absorbing submarkets in Maricopa County.",
      "Water, sewer and power are stubbed to the parcel line, removing the longest lead-time item from a builder's schedule.",
    ],
    features: [
      "10.0 acres, entitled",
      "Utilities to property line",
      "Hard corner with signal planned",
      "Surprise growth corridor",
      "Survey and Phase I available",
    ],
    featured: false,
  },
  {
    slug: "paradise-valley-estate-sold",
    title: "Paradise Valley Estate",
    address: "6210 E Mockingbird Ln",
    city: "Paradise Valley",
    state: "AZ",
    zip: "85253",
    price: 3950000,
    status: "Sold",
    type: "Residential",
    beds: 6,
    baths: 6.5,
    sqft: 6740,
    lotSqft: 43560,
    yearBuilt: 2019,
    hoa: null,
    mlsId: "6644120",
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=80",
    ],
    summary:
      "Represented the buyer on a one-acre Paradise Valley estate — closed $180,000 under list after inspection.",
    description: [
      "Represented the buyer on this off-market opportunity, negotiating $180,000 below the original list price following a thorough inspection period.",
      "Closed in 24 days with a conventional loan and no appraisal contingency waiver required.",
    ],
    features: [
      "Represented buyer",
      "Closed $180K under list",
      "24-day close",
      "One acre in Paradise Valley",
    ],
    featured: false,
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

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
