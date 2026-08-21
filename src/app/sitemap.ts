import type { MetadataRoute } from "next";
import { listings } from "@/data/listings";
import { neighborhoods } from "@/data/neighborhoods";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes = [
    { path: "", priority: 1 },
    { path: "/home-value", priority: 0.95 },
    { path: "/listings", priority: 0.9 },
    { path: "/buy", priority: 0.85 },
    { path: "/sell", priority: 0.85 },
    { path: "/commercial", priority: 0.8 },
    { path: "/invest", priority: 0.8 },
    { path: "/neighborhoods", priority: 0.75 },
    { path: "/calculators", priority: 0.7 },
    { path: "/about", priority: 0.7 },
    { path: "/contact", priority: 0.7 },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: `${site.url}${route.path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route.priority,
    })),
    ...listings.map((listing) => ({
      url: `${site.url}/listings/${listing.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...neighborhoods.map((area) => ({
      url: `${site.url}/neighborhoods/${area.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
