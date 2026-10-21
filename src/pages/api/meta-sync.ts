// Daily: report sold Facebook-sourced JobNimbus deals back to Meta as Purchase
// conversions (offline / CRM Conversions API), so ad delivery optimizes toward
// buyers, not just form-fills. Its own cron so it never competes with the
// heavier jn-sync work for the 60s function budget.
import type { APIRoute } from 'astro';
import { runMetaSoldSync, metaResendJobs } from '../../lib/jn';

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
  // Admin one-off: ?resend=<jnid>,<jnid> force-sends those jobs with a fresh
  // event_id + real value (corrects deals already sent at $0).
  const resend = url.searchParams.get('resend');
  const res = resend
    ? await metaResendJobs(resend.split(',')).catch((e) => ({ ok: false, sent: [], note: String(e) }))
    : await runMetaSoldSync(true).catch((e) => ({ ok: false, sent: [], note: String(e) }));
  return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
