# Smart Home Improvements

Static marketing site (Astro + Tailwind) for Smart Home Improvements — roofing,
windows, and insulation in Fresno & the Central Valley.

## Develop

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static output -> dist/
npm run preview    # serve the build
```

## Editing content

- **Business facts** (phone, email, license, hours, service cities, nav,
  homepage services, reviews): `src/data/site.ts`
- **Service page copy + FAQs**: `src/data/serviceContent.ts`
- **Blog posts**: add a markdown file in `src/content/blog/`

## Deploy

The site is a static Astro build. Hosted on **Vercel**.

### Vercel
1. Vercel: **Add New → Project → Import** the `smart-home-improvements` repository.
2. Vercel auto-detects Astro (config is also pinned in `vercel.json`):
   build `astro build`, output `dist`. Deploy.
3. Add the domain `smarthomeimprove.com` and set `www` as primary so it matches
   the canonical URLs. Point DNS at Vercel.

### Contact form (Web3Forms, no backend)
The form posts to [Web3Forms](https://web3forms.com) so it works on Vercel with
no server.
1. Get a free access key at web3forms.com (enter `info@smarthomeimprove.com` as
   the destination; submissions are emailed there).
2. Paste the key into `formAccessKey` in `src/data/site.ts` and redeploy.
3. Until the key is set, the submit button is disabled and a setup notice shows.
   On success the form redirects to `/thank-you/`.

## SEO included
- `RoofingContractor` LocalBusiness JSON-LD on every page; `Service` + `FAQPage`
  schema on service pages; `BlogPosting` schema on posts.
- Per-page titles, meta descriptions, canonical URLs, Open Graph.
- `sitemap-index.xml` (auto), `robots.txt`, and 301-style redirects from all old
  Duda URLs.

## Post-launch TODO (client data)
- Web3Forms access key → `src/data/site.ts` (`formAccessKey`) to enable the form.
- Real Google review text → `src/data/site.ts` (`reviews`); rating badge is live.
- TikTok + Yelp URLs → `src/data/site.ts` (`social`); Instagram + Facebook done.
- `public/og-default.jpg` (1200×630) for social previews.
- Real insulation/attic photos (currently insulation pages reuse a home/roof photo).
- Project photos for the hero and a real portfolio section.
- Verify business hours and add a street address if you have a public office
  (improves local SEO + Google Business Profile match).
