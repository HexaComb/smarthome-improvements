// CallRail post-call webhook (optional, for instant phone-lead creation).
// In CallRail: Settings > Integrations > Webhooks > Post-Call, URL
//   https://www.smarthomeimprove.com/api/callrail-webhook/
// The payload carries the same call fields the API does; the caller becomes
// a GHL contact + opportunity immediately (idempotent). Without this, the
// dashboard-load / daily poll catches them within minutes to hours.
import type { APIRoute } from 'astro';
import { mapCall, processCall } from '../../lib/callrail';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

export const POST: APIRoute = async ({ request }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    try {
      body = Object.fromEntries(new URLSearchParams(await request.text()));
    } catch {
      body = {};
    }
  }
  const call = mapCall(body.call || body);
  if (!call.phone) return new Response(JSON.stringify({ ok: true, result: 'ignored (no number)' }), { status: 200 });
  const result = call.firstCall === false && body.first_call !== undefined ? 'skipped:repeat caller' : await processCall(call);
  const webhook = env('DISCORD_WEBHOOK');
  if (webhook && result === 'created') {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'CallRail',
          embeds: [
            {
              title: `New phone lead: ${call.name || call.phone}`,
              color: 0xf6871f,
              description: [`Source: ${call.sourceName || call.source}`, call.campaign || call.utm.campaign ? `Campaign: ${call.utm.campaign || call.campaign}` : '', `${call.answered ? 'Answered' : 'Missed'}, ${call.duration}s`, 'Added to GHL with attribution.'].filter(Boolean).join('\n'),
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
      /* best-effort */
    }
  }
  return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true, listening: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
