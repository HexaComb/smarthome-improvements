# Smart Home Improvements Website, Setup Guide

A static Astro site hosted on Vercel. This covers deploying it and the API keys
it needs. Architecture details are in `README-DEV.md`.

## Deploy (Vercel)
1. Create a Vercel project from this repository. Vercel auto-detects Astro; the
   build command and the cron schedule are pinned in `vercel.json`, output is `dist`.
2. Use a Vercel **Pro** plan. The site runs scheduled jobs, including an
   every-minute lead sync, that the Hobby plan does not allow.
3. Add the environment variables below (Project Settings, Environment Variables).
4. Deploy, verify on the preview URL, then point the domain at the project.

## Environment variables
Register each key under your own account for that service, then add it in Vercel.

| Variable | Where to get it | Needed for |
| --- | --- | --- |
| `JOBNIMBUS_API_KEY` | JobNimbus, Settings, API (Admin access profile) | CRM sync |
| `GHL_PIT` | GoHighLevel, Settings, Private Integrations token | GHL lead sync |
| `GHL_LOCATION_ID` | GoHighLevel sub-account location id | GHL lead sync |
| `GHL_BRIDGE_SECRET` | A random string you choose (guards the GHL webhook) | Optional |
| `ARTEMIS_API_KEY` | Artemis account (sales-api.artemis.solar) | Proposal / contract sync |
| `ARTEMIS_WEBHOOK_SECRET` | Artemis webhook secret, if you register the webhook | Optional |
| `CALLRAIL_API_KEY` + `CALLRAIL_ACCOUNT_ID` | CallRail, Account, API access | Call-lead sync |
| `META_CAPI_TOKEN` | Meta Events Manager, your dataset, Conversions API token | Sold deals to Facebook |
| `META_PIXEL_ID` | Meta pixel / dataset id (also set in code, see below) | Conversions API |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console, a Places API (New) key, **restrict it** | Live review rating at build |
| `GOOGLE_PLACE_ID` | The business Google Place ID (public) | Rating fetch |
| `ALIVO_WEBHOOK_URL` | Alivo (your Zapier catch hook) | Forward leads to Alivo |
| `DISCORD_WEBHOOK` | A webhook URL from your Discord server | Internal alerts (optional) |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis database (or Vercel KV: `KV_REST_API_URL` + `KV_REST_API_TOKEN`) | Sync state / caching |
| `DASH_KEY` | A random string you choose (gates internal pages + manual endpoints) | Recommended |
| `CRON_SECRET` | A random string Vercel uses to authorize cron calls | Recommended |

## Also set in the code (not environment variables)
- `src/data/landing.ts` holds the GA4 measurement IDs, the Google Ads tag, and
  the Meta Pixel id. Replace them with your own.
- `src/data/site.ts` holds the business facts (phone, email, hours, license,
  rating). Keep it in sync with `business.md`.

## Security
Treat every key like a password. The Google, cloud, and ad keys are billed by
usage, and a leaked key can run up large charges on the connected account. Keep
keys only in Vercel environment variables, never in the code or a public repo,
and restrict them in the provider's console wherever possible.

## Build
`vercel.json` pins the build command and the cron schedule. Pro plan required for
the crons. Nothing else to configure.
