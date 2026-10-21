# Smart Home Improvements — site

Marketing site for a Fresno / Central Valley home improvement contractor
(roofing, windows, insulation). Rebuilt from a Duda site into a static
**Astro 7 + Tailwind v4** site for speed, SEO, and full code control.

## Stack
- Astro 7 (static output), Tailwind v4 (via `@tailwindcss/vite`), `@astrojs/sitemap`.
- No client framework. One small inline script (mobile nav) in `Header.astro`.

## Brand (from the official brand guide)
- Colors: navy `#255188`, periwinkle `#A9C0E3`, orange `#F6871F`. Tailwind tokens
  are `navy-*` (50-950, brand = `navy-600`) and `orange-*` (brand = `orange-500`).
  `navy-200` is the brand periwinkle.
- Type: Acumin Condensed (print) -> web uses **Barlow Condensed** (display/headings,
  `.font-display`, usually uppercase) + **Barlow** (body). Section labels use `.kicker`.
- Logo: official vector lockups + house mark in `public/brand/`, rendered by
  `src/components/Logo.astro` (`variant="color" | "white" | "mark"`). Favicon is
  the house mark on a navy square. Assets were extracted from the brand guide PDF
  with PyMuPDF; do not redraw them.
- **Never use em dashes or en dashes** in copy. Use commas, periods, or
  parentheses. Hyphens are fine. See business.md.

## NAP
`business.md` is the canonical business profile (NAP, hours, license, brand,
TODOs). `src/data/site.ts` mirrors it for the code. Change both together and keep
them identical to every external listing (Google Business Profile, Yelp, etc.).

## Paid ads landing pages
`/lp/<platform>/<service>/` (9 pages: google|microsoft|facebook x
roofing|windows|insulation) are distraction-free, `noindex`, sitemap-excluded
landing pages for paid traffic. Data + copy in `src/data/landing.ts`
(`platforms`, `landingCopy`); minimal `LandingLayout` (per-platform conversion
pixel) + `LandingForm` (lead_source tagging). Per-platform tracking numbers and
pixel IDs live in `landing.ts`.

## Conversion + messaging pages
- `/estimate/` (`src/pages/estimate.astro`, brackets in `src/data/estimate.ts`):
  instant price-range tool for windows and roofing. Range shows BEFORE contact
  info; the form submits inputs + range as a normal lead ("Website - Instant
  Estimate"). Keep `estimate.ts` identical to the blog cost guides.
- `/es/` (`src/pages/es.astro`): Spanish page with Spanish form labels and
  Spanish A2P consent (`FormConsent lang="es"`); leads tag `spanish` in GHL.
- `/faq/` (`src/pages/faq.astro`): every service FAQ aggregated, FAQPage schema.
- `PromiseBand` ("A real person answers"), `NamedSystem` ("The Smart Home
  Standard": Home Shield, Magnet-Swept Cleanup, Photo-Documented Work) reuse
  on hubs/home. Text-us CTAs use `site.smsRaw` (texting must be enabled on
  that CallRail number).

## Dashboard integrations
`/dashboard/` view 13 lists every connected system with live status
(`src/data/integrations.ts` = catalog, status computed in `dashboard.astro`).
Artemis (proposals/financing): `src/lib/artemis.ts` (read + analytics, detail
cache in Upstash), `src/lib/artemisSync.ts` (webhook -> JobNimbus contact/job
+ GHL tags/opportunity), `/api/artemis-webhook/`, dashboard view 14
"Proposals". Env `ARTEMIS_API_KEY`, optional `ARTEMIS_WEBHOOK_SECRET`.
Secrets never live in the repo.

## GBP
Ready-to-upload Google Business Profile post images live in
`public/photos/gbp-posts/`. The Google rating value lives in `site.ts`
(`rating`); keep it in sync with GBP.

## Where things live
- `src/data/site.ts` — **single source of truth** for business facts (phone, email,
  license, hours, service cities, nav, reviews, rating, form key). Edit here.
- `src/data/serviceContent.ts` — hub + sub-page copy/FAQs/images for each service.
  Each service has `children` (sub-services). Drives `/[service]/` and
  `/[service]/[slug]/` via `src/pages/[service]/`.
- `src/data/projects.ts` — real completed projects (address-captioned, alt text);
  powers `/projects/` and the `ProjectStrip` on home/service pages.
- `src/lib/schema.ts` — schema helpers (breadcrumb, FAQ, Service).
- `public/photos/` — web-optimized photos (resized from `media/` with ImageMagick:
  ~1400px, q82). Source originals stay in the gitignored `media/` folder.
- `src/layouts/Layout.astro` — SEO head, Open Graph, and the always-on
  `RoofingContractor` LocalBusiness JSON-LD. Pages pass extra `schema={[...]}`.
- `src/components/` — Header, Footer, Icon, CtaBand, Reviews, ServicePage (template).
- `src/pages/` — routes. `roofing/windows/insulation.astro` just feed
  `ServicePage.astro` from `serviceContent`.
- `src/content/blog/*.md` — blog posts (content collection, schema in
  `src/content.config.ts`). Add a post = add a markdown file.
- Old Duda URLs are redirected in `astro.config.mjs` (`redirects`).

## Commands
- `npm run dev` — dev server.
- `npm run build` — static build to `dist/`.
- `npm run preview` — serve the build locally.

## Conventions
- Internal links keep trailing slashes (`/roofing/`) to match routes/redirects.
- Buttons: `.btn-primary` / `.btn-secondary` / `.btn-outline` (defined in
  `src/styles/global.css`). In Tailwind v4 don't `@apply` a custom class —
  list the base utilities directly.
- Update business facts only in `src/data/site.ts`.

## Known TODOs (need real data from client)
- Real social profile URLs in `site.ts` `social` (currently `#`, hidden in footer).
- Replace placeholder `reviews` in `site.ts` with real Google/Yelp reviews.
- Add `public/og-default.jpg` (1200×630) for social share previews.
- Real project photos for hero/portfolio when available.
