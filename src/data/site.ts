export const site = {
  name: "Kelly Rojas",
  brokerage: "Arizona International Real Estate",
  tagline: "Residential + Commercial Real Estate Consultant",
  city: "Phoenix, Arizona",
  phone: "(602) 555-0142",
  phoneHref: "tel:+16025550142",
  email: "kelly@arizonainternationalrealestate.com",
  license: "AZ License #SA123456000",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kellyrojas.com",
  social: {
    instagram: "https://instagram.com/",
    linkedin: "https://linkedin.com/",
    facebook: "https://facebook.com/",
  },
  stats: [
    { value: "10+", label: "Years Experience" },
    { value: "100+", label: "Transactions Since 2016" },
    { value: "$50M+", label: "Sales Volume" },
    { value: "R + C", label: "Residential + Commercial" },
  ],
} as const;

export const navLinks = [
  { href: "/listings", label: "Listings" },
  { href: "/buy", label: "Buy" },
  { href: "/sell", label: "Sell" },
  { href: "/home-value", label: "Home Value" },
  { href: "/commercial", label: "Commercial" },
  { href: "/invest", label: "Invest" },
  { href: "/neighborhoods", label: "Neighborhoods" },
  { href: "/about", label: "About" },
] as const;

export const footerColumns = [
  {
    title: "Work With Kelly",
    links: [
      { href: "/buy", label: "Buy a Home" },
      { href: "/sell", label: "Sell Your Home" },
      { href: "/invest", label: "Invest in Property" },
      { href: "/commercial", label: "Commercial Real Estate" },
    ],
  },
  {
    title: "Tools",
    links: [
      { href: "/home-value", label: "What's My Home Worth?" },
      { href: "/calculators", label: "Mortgage Calculator" },
      { href: "/listings", label: "Search Listings" },
      { href: "/neighborhoods", label: "Neighborhood Guides" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Kelly" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
] as const;
