// JobNimbus outbound webhook receiver: configure in JobNimbus
// (Settings > API > Webhooks) to POST here on job updates:
//   https://www.smarthomeimprove.com/api/jn-webhook/
// No secret needed: any ping just triggers the same idempotent, state-backed
// sync the daily cron runs (nothing is read from the request body, nothing is
// returned but a counter), and a 1-minute throttle bounds abuse.
import type { APIRoute } from 'astro';
import { runJnSync } from '../../lib/jn';
import { stampSyncState } from '../../lib/kpi';

export const prerender = false;

export const POST: APIRoute = async () => {
  const result = await runJnSync(1);
  await stampSyncState({ lastJnWebhookAt: Date.now() }).catch(() => {});
  return new Response(JSON.stringify({ ok: result.ok, processed: result.completed.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// JobNimbus may send a test GET when saving the webhook; answer politely.
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true, listening: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
