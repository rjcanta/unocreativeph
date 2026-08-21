# Adding a listing

All listings live in one file: **`src/data/listings.ts`**. You add a listing by
copying a block of text into that file and filling in the details. No other file
needs to change — the listings page, search, filters, detail page, home page and
sitemap all update automatically.

You can edit the file directly on GitHub (pencil icon → edit → Commit changes).
Vercel rebuilds the site within a minute or two of the commit.

---

## The short version

Open `src/data/listings.ts`, find the line that reads:

```ts
const inventory: ListingInput[] = [
```

Paste a new block immediately after it. **Only seven fields are required:**

```ts
  {
    slug: "1234-e-main-st-phoenix",
    title: "Renovated Arcadia Ranch",
    address: "1234 E Main St",
    city: "Phoenix",
    price: 750000,
    status: "For Sale",
    type: "Residential",
  },
```

That alone produces a working listing with a "Photo coming soon" placeholder.
Everything below is optional and simply doesn't appear if you leave it out.

---

## Every field

### Required

| Field | Notes |
| --- | --- |
| `slug` | The web address: `/listings/<slug>`. Lowercase, hyphens instead of spaces, no punctuation. **Must be unique.** |
| `title` | Headline shown on the card and page. |
| `address` | Street address only — city goes in its own field. |
| `city` | e.g. `"Scottsdale"` |
| `price` | Digits only, **no dollar sign, no commas**: `750000`, not `$750,000`. |
| `status` | Exactly one of: `"For Sale"`, `"Pending"`, `"Sold"`, `"Coming Soon"` |
| `type` | Exactly one of: `"Residential"`, `"Commercial"`, `"Investment"`, `"Land"` |

### Optional

| Field | Notes |
| --- | --- |
| `zip` | `"85018"` — searchable, so worth including. |
| `beds`, `baths` | Numbers. `baths` accepts halves: `2.5`. Omit for land and commercial. |
| `sqft` | Interior square feet, digits only. |
| `lotSqft` | Lot size in **square feet**, not acres. One acre = `43560`. |
| `yearBuilt` | `1998` |
| `hoa` | Monthly dues as a number, or leave out if none. |
| `mlsId` | `"6712345"` — makes the listing findable by MLS number in search. |
| `gallery` | List of photo paths (see below). |
| `image` | Main photo. Defaults to the first gallery photo, so you rarely need this. |
| `summary` | One sentence. Appears on the card and at the top of the page. |
| `description` | Longer text. One string, or several for multiple paragraphs. |
| `features` | Bullet list: `["Pool", "No HOA", "RV gate"]` |
| `featured` | `true` puts it on the home page (which shows the first four). |

---

## Photos

1. Put the image files in **`public/listings/`**. Create a folder per property to
   stay organized, e.g. `public/listings/1234-e-main-st/`.
2. Reference them with a path starting at `/listings/`:

```ts
    gallery: [
      "/listings/1234-e-main-st/front.jpg",
      "/listings/1234-e-main-st/kitchen.jpg",
      "/listings/1234-e-main-st/pool.jpg",
    ],
```

The **first photo** is the one used on cards and previews, so lead with the
strongest exterior shot. The detail page shows the first three; the rest are
ignored for now.

Guidelines: JPG, roughly 1600px wide, under about 500KB each. Landscape
orientation. A listing with no photos shows a "Photo coming soon" placeholder,
which is fine temporarily but will cost you clicks.

---

## A complete example

```ts
  {
    slug: "4512-e-calle-redonda-phoenix",
    title: "Renovated Arcadia Ranch",
    address: "4512 E Calle Redonda",
    city: "Phoenix",
    zip: "85018",
    price: 1150000,
    status: "For Sale",
    type: "Residential",
    beds: 4,
    baths: 3,
    sqft: 2940,
    lotSqft: 12500,
    yearBuilt: 1958,
    mlsId: "6712377",
    gallery: [
      "/listings/4512-e-calle-redonda/front.jpg",
      "/listings/4512-e-calle-redonda/great-room.jpg",
      "/listings/4512-e-calle-redonda/yard.jpg",
    ],
    summary:
      "Fully reimagined mid-century ranch in Arcadia lite, walkable to the 44th Street restaurants.",
    description: [
      "A 2022 studs-out renovation kept the low-slung mid-century lines while opening the interior into a single light-filled great room.",
      "The lot is the story here: mature citrus, a north-south orientation and room for a casita behind the existing pool.",
    ],
    features: [
      "Studs-out 2022 renovation",
      "Camelback Mountain views",
      "Mature citrus grove",
      "No HOA",
    ],
    featured: true,
  },
```

---

## Updating and removing

- **Price change or status change:** edit the value in place. Changing `status`
  to `"Pending"` or `"Sold"` updates the badge on the card automatically.
- **Removing a listing:** delete the whole block, from its opening `{` to its
  closing `},`. Sold listings are worth keeping as social proof — set
  `status: "Sold"` and `featured: false` instead of deleting.

---

## Rules that will bite you

1. **Every block ends with a comma** after the closing brace: `},`
2. **Text goes in double quotes**, numbers do not. `price: 750000` and
   `city: "Phoenix"`.
3. **`status` and `type` must match the allowed values exactly**, including
   capitalization. `"for sale"` will fail the build; `"For Sale"` works.
4. **`slug` must be unique** across all listings.
5. **Straight quotes only** (`"`), never curly ones (`"`). Pasting from Word or
   Google Docs is the usual culprit — paste into a plain text editor first.

If a commit breaks the build, Vercel keeps the previous version live and shows
the error in the deployment log. Nothing goes down; you just fix the typo and
commit again.

---

## Replacing the demo data

The listings currently in the file are **placeholders with invented addresses and
MLS numbers**. Delete all of them once Kelly's real listings are in — they are
marked with a comment banner in the file.
