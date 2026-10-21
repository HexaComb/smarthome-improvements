// Daily digest of Artemis contracts stuck at "Contract Sent" (contract out for
// signature, never advanced to Contract Signed) — the state where sold deals
// slip past the JobNimbus sync. Its own cron so it never competes with the
// heavier jn-sync work for the 60s function budget.
import type { APIRoute } from 'astro';
import { artemisStuckContractsAlert } from '../../lib/artemisSync';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const authorized = (request: Request, url: URL): boolean => {
  const cronSecret = env('CRON_SECRET');
  const auth = request.headers.get('authorization') || '';
  const ua = request.headers.get('user-agent') || '';
  const cronOk = cronSecret ? auth === `Bearer ${cronSecret}` : ua.startsWith('vercel-cron');
  const dashKey = env('DASH_KEY').trim();
  const rawKey = (url.search.match(/[?&]key=([^&]*)/)?.[1] || '').trim();
  const keyOk = dashKey.length > 0 && (url.searchParams.get('key') === dashKey || rawKey === dashKey || decodeURIComponent(rawKey) === dashKey);
  return cronOk || keyOk;
};

export const GET: APIRoute = async ({ request, url }) => {
  if (!authorized(request, url)) return new Response('Unauthorized', { status: 401 });
  const stuck = await artemisStuckContractsAlert(24).catch((e) => ({ count: 0, stuck: [], note: String(e) }));
  return new Response(JSON.stringify(stuck), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
