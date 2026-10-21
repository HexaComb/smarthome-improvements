// Pull the live Google rating + total review count from the Google Places API
// and bake it into src/data/rating.generated.json at build time. site.ts merges
// that file over its fallback, so the star rating and review count on the site
// track the Google Business Profile automatically.
//
// Env (set in Vercel):
//   GOOGLE_PLACES_API_KEY  - a Google Maps Platform key with "Places API (New)" enabled
//   GOOGLE_PLACE_ID        - our Place ID (optional; if unset we look it up by name)
//
// FAIL-SAFE: this script NEVER throws or exits non-zero. If the key is missing
// or the call fails, it leaves the existing rating.generated.json untouched so
// the build always succeeds and the site keeps the last-known values.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'rating.generated.json');
const KEY = process.env.GOOGLE_PLACES_API_KEY;
const BUSINESS_QUERY = 'Smart Home Improvements roofing Fresno CA';
// Our Google Place ID (public id, not a secret). Verified 2026-09-10 for
// Smart Home Improvements, 2740 N Sunnyside Ave, Fresno. Env var overrides it.
const DEFAULT_PLACE_ID = 'ChIJ2yHBoUSG64sRYivTllKqrVs';

const log = (m) => console.log('[fetch-rating]', m);

async function findPlaceId() {
  if (process.env.GOOGLE_PLACE_ID) return process.env.GOOGLE_PLACE_ID.trim();
  if (DEFAULT_PLACE_ID) return DEFAULT_PLACE_ID;
  // Text Search (New) to resolve the Place ID from the business name.
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.id,places.displayName' },
    body: JSON.stringify({ textQuery: BUSINESS_QUERY }),
  });
  if (!res.ok) throw new Error(`text search ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const id = (await res.json())?.places?.[0]?.id;
  if (!id) throw new Error('no place found for query');
  return id;
}

async function main() {
  if (!KEY) {
    log('GOOGLE_PLACES_API_KEY not set; keeping existing rating.generated.json');
    return;
  }
  try {
    const placeId = await findPlaceId();
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'rating,userRatingCount' },
    });
    if (!res.ok) throw new Error(`place details ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const d = await res.json();
    const value = Number(d.rating);
    const count = Number(d.userRatingCount);
    // Sanity guard: only write real, plausible numbers, never overwrite good
    // data with garbage from a partial/odd response.
    if (!(value > 0 && value <= 5) || !(Number.isInteger(count) && count > 0)) {
      throw new Error(`implausible values rating=${d.rating} count=${d.userRatingCount}`);
    }
    writeFileSync(OUT, JSON.stringify({ value, count, fetchedAt: new Date().toISOString() }) + '\n');
    log(`updated: ${value} stars, ${count} reviews (place ${placeId})`);
  } catch (e) {
    // Keep the last-known file; never break the build.
    let prev = '(none)';
    try { prev = readFileSync(OUT, 'utf8').trim(); } catch {}
    log(`fetch failed (${e.message}); keeping existing ${prev}`);
  }
}

await main();
