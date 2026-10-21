// Visit beacon for paid landing pages (sent by LandingLayout via
// navigator.sendBeacon). Only registered /lp/ paths count; obvious bots are
// dropped. Stores nothing about the visitor, just a counter per page per day.
import type { APIRoute } from 'astro';
import { landingPages } from '../../data/landing';
import { recordHit, dayKey } from '../../lib/hits';

export const prerender = false;

const KNOWN = new Set(landingPages.map((l) => l.path));
const BOT = /bot|crawl|spider|slurp|headless|puppeteer|lighthouse|pagespeed|preview|facebookexternalhit|monitor/i;

export const POST: APIRoute = async ({ request }) => {
  const ok = new Response(null, { status: 204 });
  try {
    if (BOT.test(request.headers.get('user-agent') || '')) return ok;
    const raw = await request.text();
    let path = '';
    try {
      path = String(JSON.parse(raw)?.p || '');
    } catch {
      path = raw.trim();
    }
    path = path.split(/[?#]/)[0];
    if (!path.endsWith('/')) path += '/';
    if (!KNOWN.has(path)) return ok;
    await recordHit(path, dayKey(new Date()));
  } catch {
    /* never fail the page for analytics */
  }
  return ok;
};
