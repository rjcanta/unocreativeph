export type Neighborhood = {
  slug: string;
  name: string;
  tagline: string;
  image: string;
  medianPrice: string;
  medianPricePerSqft: string;
  avgDaysOnMarket: string;
  inventoryTrend: string;
  intro: string;
  body: string[];
  goodFor: string[];
  highlights: { label: string; value: string }[];
};

export const neighborhoods: Neighborhood[] = [
  {
    slug: "phoenix",
    name: "Phoenix",
    tagline: "Urban core, historic districts and everything between",
    image:
      "https://images.unsplash.com/photo-1558645836-e44122a743ee?auto=format&fit=crop&w=1400&q=80",
    medianPrice: "$465,000",
    medianPricePerSqft: "$291",
    avgDaysOnMarket: "43 days",
    inventoryTrend: "Balanced",
    intro:
      "Phoenix is not one market — it's a dozen. What you pay and how fast you have to move depends almost entirely on which pocket you're shopping.",
    body: [
      "The historic districts around downtown — Willo, Encanto, Coronado — trade on character and walkability, and inventory there moves quickly whenever a well-preserved bungalow lists. Arcadia and Biltmore sit at the top end of the city, where mid-century ranches on large lots regularly clear $1M after renovation.",
      "North Phoenix and Ahwatukee offer more square footage per dollar and appeal to families prioritizing schools and newer construction. Downtown lofts and condos are the value story right now, with HOA-inclusive living well under the metro median.",
      "For investors, the rental math in Phoenix still works in specific corridors — particularly near the light rail line and the ASU downtown campus, where tenant demand is durable through cycles.",
    ],
    goodFor: ["First-time buyers", "Renovation projects", "Rental investors", "Urban lifestyle"],
    highlights: [
      { label: "Population", value: "1.65M" },
      { label: "Median household income", value: "$72,100" },
      { label: "Commute to Sky Harbor", value: "12 min" },
    ],
  },
  {
    slug: "scottsdale",
    name: "Scottsdale",
    tagline: "Luxury inventory, resort living and the strongest resale demand in the Valley",
    image:
      "https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=1400&q=80",
    medianPrice: "$885,000",
    medianPricePerSqft: "$412",
    avgDaysOnMarket: "51 days",
    inventoryTrend: "Seller-leaning",
    intro:
      "Scottsdale carries the Valley's deepest luxury inventory and its most reliable resale demand — but the submarkets behave very differently.",
    body: [
      "South Scottsdale is the entry point, with 1960s ranches under $700K that renovate well and rent even better. Old Town commands a premium for walkability. North Scottsdale — DC Ranch, Silverleaf, Troon — is where the $2M+ inventory concentrates, and where buyers should expect longer marketing times in both directions.",
      "The gated-community question comes up constantly. Guard-gated addresses hold value well in downturns, but HOA and community assessments deserve a hard look before you write. I pull the last three years of assessment history on every gated purchase I represent.",
      "Seasonality matters more here than anywhere else in the metro. January through April is the buying season; a well-priced listing in July sits, and a buyer with patience in July has real leverage.",
    ],
    goodFor: ["Luxury buyers", "Second homes", "Relocations", "Short-term rental owners"],
    highlights: [
      { label: "Population", value: "243,000" },
      { label: "Median household income", value: "$102,400" },
      { label: "Golf courses", value: "51" },
    ],
  },
  {
    slug: "glendale",
    name: "Glendale",
    tagline: "West Valley value with sports, entertainment and steady appreciation",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80",
    medianPrice: "$425,000",
    medianPricePerSqft: "$254",
    avgDaysOnMarket: "46 days",
    inventoryTrend: "Balanced",
    intro:
      "Glendale delivers more house per dollar than almost anywhere comparable in the metro, with an entertainment district that keeps drawing employers.",
    body: [
      "The Westgate district — State Farm Stadium, Desert Diamond Arena, the surrounding retail — anchors the city's growth and continues to pull in commercial tenants and the housing that follows them.",
      "Arrowhead Ranch and the northern neighborhoods are the family-buyer core, with established landscaping, strong school boundaries and homes generally built between 1990 and 2010. Historic downtown Glendale offers genuinely affordable character housing that most buyers overlook.",
      "Industrial and flex commercial along the Loop 101 corridor has been the quiet story of the last five years, and it's where I've placed several investor clients.",
    ],
    goodFor: ["Value-focused buyers", "Families", "Commercial investors", "New construction"],
    highlights: [
      { label: "Population", value: "252,000" },
      { label: "Median household income", value: "$66,800" },
      { label: "Loop 101 access", value: "Direct" },
    ],
  },
  {
    slug: "peoria",
    name: "Peoria",
    tagline: "Master-planned communities, lake access and top-rated schools",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    medianPrice: "$520,000",
    medianPricePerSqft: "$268",
    avgDaysOnMarket: "44 days",
    inventoryTrend: "Balanced",
    intro:
      "Peoria is where West Valley buyers go when schools and community amenities top the list, and Vistancia is its flagship.",
    body: [
      "Vistancia and Trilogy dominate the northern half of the city — master-planned, amenity-rich and consistently among the strongest resale performers in the West Valley.",
      "Lake Pleasant sits at the city's northern edge, which supports a small but real market for buyers who want boat access without leaving the metro.",
      "Peoria Unified's ratings and the newer construction stock mean listings here compete well against comparable Surprise and Buckeye inventory, usually at a modest premium that holds up on resale.",
    ],
    goodFor: ["Families", "New construction buyers", "Active adult (55+)", "Lake access"],
    highlights: [
      { label: "Population", value: "195,000" },
      { label: "Median household income", value: "$83,200" },
      { label: "Lake Pleasant", value: "15 min" },
    ],
  },
  {
    slug: "west-valley",
    name: "West Valley",
    tagline: "Surprise, Goodyear, Buckeye — the metro's fastest-growing corridor",
    image:
      "https://images.unsplash.com/photo-1531761535209-180857e963b9?auto=format&fit=crop&w=1400&q=80",
    medianPrice: "$398,000",
    medianPricePerSqft: "$219",
    avgDaysOnMarket: "52 days",
    inventoryTrend: "Buyer-leaning",
    intro:
      "The West Valley is absorbing more new households than any other part of Maricopa County, and builder incentives there are the best in the metro.",
    body: [
      "Surprise, Goodyear and Buckeye are adding rooftops at a pace that keeps resale competitive with new construction — which is exactly why buyers here need someone reading builder incentive sheets carefully.",
      "Rate buydowns, closing cost credits and design center allowances are frequently worth $25,000 to $60,000 on a new build in this corridor, and they are negotiable in ways the sales office rarely volunteers. I represent buyers in the builder's office at no cost to them.",
      "For investors, the corridor's employment growth — TSMC's ripple effects, the Goodyear logistics cluster — supports a genuine long-term rental thesis rather than a purely appreciation-based bet.",
    ],
    goodFor: ["New construction", "First-time buyers", "Long-term rentals", "Relocations"],
    highlights: [
      { label: "Household growth", value: "Fastest in county" },
      { label: "Median new build", value: "$412,000" },
      { label: "Typical builder incentive", value: "$25K–$60K" },
    ],
  },
];

export function getNeighborhood(slug: string) {
  return neighborhoods.find((n) => n.slug === slug);
}
