import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native SQLite driver must stay a Node external, never bundled.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
