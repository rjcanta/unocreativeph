# Kelly Rojas — Phoenix Real Estate

A multi-page, interactive real estate website built with Next.js (App Router) and
deployed on Vercel.

---

## Pages

| Route | What it does |
| --- | --- |
| `/` | Home — hero, credibility stats, service overview, featured listings, neighborhood grid |
| `/home-value` | **5-step home valuation wizard** — the primary lead capture tool |
| `/listings` | Live client-side filtering: search, type, status, price slider, bedrooms, sort |
| `/listings/[slug]` | Property detail — gallery, facts, features, inquiry form, embedded payment calculator |
| `/buy` | Buyer guide, six-stage process, buyer intake form, FAQ |
| `/sell` | Seller guide, pricing-window explainer, marketing package, listing consultation form, FAQ |
| `/commercial` | Sectors, services, commercial inventory, deal intake form, FAQ |
| `/invest` | Own/Grow/Expand framework, acquisition method, investing glossary, investor intake, FAQ |
| `/neighborhoods` | Index of submarket guides with median price, price/sqft, days on market |
| `/neighborhoods/[slug]` | Individual area guide with stats, narrative, local listings, question form |
| `/calculators` | Interactive mortgage calculator — P&I, taxes, insurance, PMI, HOA |
| `/about` | Bio, values, testimonials, career timeline |
| `/contact` | Contact form with topic routing plus direct contact details |
| `/privacy` | Privacy policy and fair housing statement |

Plus `/sitemap.xml`, `/robots.txt` and a custom 404.

## Interactive features

- **Valuation wizard** (`src/components/valuation-wizard.tsx`) — 5 steps with a progress
  bar, per-step validation, multi-select chips, a review summary and a success state.
- **Mortgage calculator** (`src/components/mortgage-calculator.tsx`) — live sliders, a
  proportional cost-breakdown bar, and automatic PMI when the down payment is under 20%.
- **Listing browser** (`src/components/listing-browser.tsx`) — instant filtering and
  sorting with an empty state that routes the visitor to a conversation.
- **Lead form** (`src/components/lead-form.tsx`) — one reusable form driving buyer,
  seller, commercial, investor, contact and listing-inquiry submissions.
- FAQ accordions, a mobile navigation drawer, and honeypot spam protection on every form.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run typecheck`.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, then import the repository.
3. Vercel auto-detects Next.js — no build configuration needed.
4. Add the environment variables below under **Settings → Environment Variables**.
5. Deploy. Attach the client's custom domain under **Settings → Domains**.

### Environment variables

All are optional; the site builds and runs without them. See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public URL used for canonical tags, Open Graph and the sitemap. Set this to the live domain, written in full: `https://unocreativeph.vercel.app`. If it is unset or not a valid URL, the site falls back to Vercel's own deployment URL and then to the default domain — an invalid value logs a warning but never fails the build. |
| `LEAD_WEBHOOK_URL` | Every form submission is POSTed here as JSON. Point it at Zapier, Make, n8n, a CRM endpoint or a Slack incoming webhook. |
| `LEAD_NOTIFY_EMAIL` | Included in the webhook payload as the intended recipient. |

**Without `LEAD_WEBHOOK_URL`, leads are written to the server log and nothing is emailed.**
Set it before the site goes live, or swap `deliverLead()` in `src/lib/leads.ts` for a
direct email integration (Resend and SendGrid both drop in cleanly).

Lead payload shape:

```json
{
  "type": "home-valuation",
  "label": "Home Valuation Request",
  "name": "...", "email": "...", "phone": "...", "message": "...",
  "details": { "address": "...", "sqft": "...", "timeline": "..." },
  "notify": "kelly@...", "submittedAt": "2026-08-21T00:00:00.000Z"
}
```

## Content the client needs to supply

Everything below is placeholder and should be replaced before launch:

- **`src/data/site.ts`** — phone number, email, license number and social URLs are
  placeholders. The phone `(602) 555-0142` is a reserved fictional number.
- **Photography** — all images are Unsplash stock loaded remotely. Replace with the
  client's headshot and real listing photography. Put local files in `public/` and
  update the paths; remove the `images.unsplash.com` entry from `next.config.ts` once
  no remote images remain.
- **`src/data/listings.ts`** — demo inventory. See below for connecting a live feed.
- **`src/data/neighborhoods.ts`** — market figures are illustrative. Refresh from
  current ARMLS data.
- **Testimonials** in `src/app/about/page.tsx` and the career timeline are placeholders.
- **Compliance** — confirm the brokerage's required disclosures, license display and
  fair housing language with the designated broker before launch.

## Connecting a live MLS feed

`src/data/listings.ts` exports a typed `Listing[]` and two lookup helpers. To go live:

1. Obtain IDX/RESO Web API access through the client's ARMLS membership.
2. Replace the static array with a fetch in a server component, or add a scheduled
   revalidation route that caches the feed.
3. Keep the `Listing` type as the boundary — every component consumes that shape, so
   nothing else has to change.

## Project structure

```
src/
  app/            routes (App Router) + /api/lead
  components/     header, footer, UI primitives, interactive widgets
  data/           site config, listings, neighborhoods — the content layer
  lib/            lead validation and delivery
design-reference/ the original single-page HTML concept this site grew from
```

## Notes

- Styling is Tailwind CSS v4 configured entirely in `src/app/globals.css`; the brand
  palette lives in the `@theme` block there.
- Fonts are Cormorant Garamond (display) and Inter (body) via `next/font`, self-hosted
  at build time.
- All pages except `/api/lead` are statically prerendered.
