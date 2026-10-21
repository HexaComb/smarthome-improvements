# Business Profile and NAP

This file is the single canonical source for Smart Home Improvements business
facts. NAP (Name, Address, Phone) must be byte-for-byte identical everywhere it
appears online: the website, Google Business Profile, Yelp, Facebook, Instagram,
TikTok, Bing Places, Apple Business Connect, and every directory or citation.
Inconsistent NAP hurts local SEO and erodes trust.

When anything here changes, update it in [src/data/site.ts](src/data/site.ts)
(the website reads from there) and then push the same change to every external
listing.

## Name (exact)

```
Smart Home Improvements
```

Do not abbreviate ("SHI"), add a city ("Smart Home Improvements Fresno"), or add
service keywords. Use this exact string everywhere.

## Address

```
Service-area business. No public storefront. Based in Fresno, CA.
```

- Confirmed on the Google Business Profile: "No location; deliveries and home
  services only." Do NOT publish a street address anywhere. Keep the address
  hidden on all listings and rely on the service-area setting.
- The placeholder on the brand business card (`123 Address Ave #101`) must never
  be published.

## Phone

```
(559) 833-6945
```

- Display format everywhere: `(559) 833-6945`
- `tel:` link format: `tel:+15598336945`
- Use one consistent number across all listings and call-tracking. If a tracking
  number is ever used, keep the real number as the GBP primary to protect NAP.

## Email

```
info@smarthomeimprove.com
```

## Website

```
https://www.smarthomeimprove.com
```

Canonical host is `www`. Non-www and `http` should 301-redirect to this.

## License

```
CA Contractor License #1129883
```

Show on the site, GBP, proposals, and invoices. Builds trust and is required for
California contractors.

## Hours

Verified from the Google Business Profile. Keep identical to GBP.

| Day             | Hours              |
| --------------- | ------------------ |
| Monday - Friday | 9:00 AM - 7:00 PM  |
| Saturday        | 9:00 AM - 6:00 PM  |
| Sunday          | Closed             |

## Service area

Cities verified on the Google Business Profile service area:

Fresno, Clovis, Madera, Visalia.

Expansion candidates (Sanger, Selma, Reedley, Kerman) should be added to BOTH the
GBP service area and `site.ts` at the same time to keep them consistent.

## Reviews

Google: **4.9 stars across 54 reviews** (verified from GBP). 213 customer
interactions. Do not put this rating in website schema as AggregateRating unless
the actual reviews are displayed on the page (Google structured-data policy).
Plan: embed real Google reviews on the site, then add AggregateRating.

## Services

- Roofing: residential roofing (asphalt, metal, tile), roof repair, siding,
  storm damage repair, commercial roofing
- Windows (energy-efficient replacement and repair)
- Insulation (attic, wall, radiant barrier)

Note: siding, storm damage, and commercial roofing are confirmed roofing
services (added June 2026). They need real photos (siding and commercial
currently reuse home/roof photos). Add the matching GBP categories if you want
them as their own listings (Siding contractor; commercial covered under Roofing
Contractor).

## Brand

- Navy `#255188` (Pantone 105-15 C)
- Periwinkle `#A9C0E3` (Pantone 106-3 C)
- Orange `#F6871F` (Pantone 24-8 C)
- Type: Acumin Condensed (print); web uses Barlow Condensed + Barlow as the
  closest free match.
- Logo assets: [public/brand/](public/brand/) (vector lockups + house mark).

## Social profiles

- Instagram: https://www.instagram.com/smarthome_improvements (verified, live on site)
- Facebook: https://www.facebook.com/profile.php?id=61581907966797
- TikTok: (pending real URL, hidden until provided)
- Yelp: (pending real URL, hidden until provided)

## Google Business Profile optimization

Full copy-paste playbook (categories, description, services, posts, Q&A, review
templates, UTM links, photo plan): [gmb-optimization.md](gmb-optimization.md).
Ready-to-upload post images: `public/photos/gbp-posts/`.

## Google Business Profile corrections needed

Discrepancies found during the audit. Fix these in GBP so it matches the site:

- **Primary category** is the generic "Contractor". Change to "Roofing
  Contractor" and add secondary categories (e.g. Window installation service,
  Insulation contractor).
- **Description** says "roofing, windows, and HVAC". The business does NOT do
  HVAC; it does insulation. Correct it to "roofing, windows, and insulation".
- **Services** list only Roof installation, Roof repair, and Window installation.
  Add insulation services and window repair so GBP matches the website services.
- **Profile incomplete** ("Complete your profile" prompt). Add photos, products,
  and the opening date.

## Writing rule

Never use em dashes (`—`) or en dashes (`–`) in any copy. Use commas, periods,
or parentheses instead. Hyphens are fine for ranges and compound words.
