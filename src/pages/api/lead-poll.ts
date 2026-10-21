// Frequent, lightweight lead poll (Vercel cron every few minutes). Runs ONLY
// the GHL -> JobNimbus lead mirror so new Facebook / lead-ad leads reach
// JobNimbus within minutes, instead of waiting for the once-daily jn-sync.
// Kept separate from /api/jn-sync so the heavy Artemis/CallRail/review work
// stays on its daily schedule.
import type { APIRoute } from 'astro';
import { runGhlLeadSync, runGhlStageSync } from '../../lib/jn';
import { runArtemisProposalSync } from '../../lib/artemisSync';

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
  const ghlLeads = await runGhlLeadSync(true).catch((e) => ({ ok: false, mirrored: [], note: String(e) }));
  // Sync GHL stage -> JN status too, but only every ~10 min (heavier: it reads
  // all opportunities). The every-minute run stays cheap for new-lead capture.
  const ghlStages = await runGhlStageSync(false, 10).catch((e) => ({ ok: false, moved: [], note: String(e) }));
  // New Artemis proposals -> JobNimbus (throttled ~10 min; Artemis is rate-limited).
  const artemisProposals = await runArtemisProposalSync(false, { minIntervalMinutes: 10, maxPerRun: 10 }).catch((e) => ({ ok: false, synced: [], note: String(e) }));
  return new Response(JSON.stringify({ ghlLeads, ghlStages, artemisProposals }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
