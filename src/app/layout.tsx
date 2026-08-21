import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/data/site";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | Phoenix Residential & Commercial Real Estate`,
    template: `%s | ${site.name}`,
  },
  description:
    "Kelly Rojas helps individuals, families and investors buy, sell and invest in residential and commercial real estate across Greater Phoenix.",
  keywords: [
    "Phoenix real estate agent",
    "Scottsdale realtor",
    "Arizona commercial real estate",
    "Phoenix home value",
    "West Valley homes for sale",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: site.url,
    siteName: site.name,
    title: `${site.name} | Phoenix Residential & Commercial Real Estate`,
    description:
      "Residential, commercial and investment real estate guidance across Greater Phoenix.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: site.name,
  description:
    "Residential, commercial and investment real estate guidance across Greater Phoenix.",
  url: site.url,
  telephone: site.phone,
  email: site.email,
  areaServed: [
    "Phoenix, AZ",
    "Scottsdale, AZ",
    "Glendale, AZ",
    "Peoria, AZ",
    "Surprise, AZ",
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Phoenix",
    addressRegion: "AZ",
    addressCountry: "US",
  },
  memberOf: { "@type": "Organization", name: site.brokerage },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
