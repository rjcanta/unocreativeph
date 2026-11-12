import { defineConfig } from "prisma/config";

// Local MVP uses SQLite. See docs/deployment.md for the Supabase PostgreSQL path.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
