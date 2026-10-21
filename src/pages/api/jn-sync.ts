// Daily JobNimbus sync (Vercel cron, see vercel.json), also callable manually
// with ?key=<DASH_KEY>. Tags GHL contacts "review-request" when their job
// reaches a completed status and alerts Discord. Idempotent via the sync-state
// custom value, so the webhook and the cron can both run safely.
import type { APIRoute } from 'astro';
import { runJnSync } from '../../lib/jn';
import { runCallSync } from '../../lib/callrail';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const authorized = (request: Request, url: URL): boolean => {
  const cronSecret = env('CRON_SECRET');
  const auth = request.headers.get('authorization') || '';
  const ua = request.headers.get('user-agent') || '';
  const cronOk = cronSecret ? auth === `Bearer ${cronSecret}` : ua.startsWith('vercel-cron');
  const dashKey = env('DASH_KEY').trim();
  const parsedKey = (url.searchParams.get('key') || '').trim();
  const rawKey = (url.search.match(/[?&]key=([^&]*)/)?.[1] || '').trim();
  const keyOk = dashKey.length > 0 && (parsedKey === dashKey || rawKey === dashKey || decodeURIComponent(rawKey) === dashKey);
  return cronOk || keyOk;
};

// Daily cron. Kept lean so it never hits the 60s function timeout: the frequent
// GHL + Artemis-proposal syncs live on the every-minute /api/lead-poll cron, and
// the stuck-contract digest on /api/contracts-alert, so this only does the
// review engine and the CallRail backfill.
export const GET: APIRoute = async ({ request, url }) => {
  if (!authorized(request, url)) return new Response('Unauthorized', { status: 401 });
  const result = await runJnSync();
  // CallRail -> GHL: first-time callers become contacts with attribution.
  const callSync = await runCallSync(true).catch(() => null);
  return new Response(JSON.stringify({ ...result, calls: callSync }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
