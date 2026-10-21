// Artemis webhook receiver. Registered in Artemis (Installer Settings >
// Developer > Webhooks) for contract-signed, project-created/updated,
// proposal-sent, contract-sent, credit events. On every event:
//   1. the project is re-read from the Artemis API (payload = pointer)
//   2. mirrored into JobNimbus (contact + job, status forward-only) and GHL
//      (tags; proposal value + Won on signature)  -> src/lib/artemisSync.ts
//   3. a Discord embed reports what happened
// Optional ARTEMIS_WEBHOOK_SECRET verifies the X-Signature HMAC.
import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { syncArtemisProject } from '../../lib/artemisSync';
import { stampSyncState } from '../../lib/kpi';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

function verified(raw: string, sig: string): boolean {
  const secret = env('ARTEMIS_WEBHOOK_SECRET');
  if (!secret) return true;
  if (!sig) return false;
  const digest = createHmac('sha256', secret).update(raw).digest();
  const given = sig.replace(/^sha256=/i, '').trim();
  return [digest.toString('hex'), digest.toString('base64')].some((c) => c.length === given.length && timingSafeEqual(Buffer.from(c), Buffer.from(given)));
}

const pick = (o: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = k.split('.').reduce((a, kk) => (a && typeof a === 'object' ? a[kk] : undefined), o);
    if (v != null && v !== '') return String(v);
  }
  return '';
};

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  if (!verified(raw, request.headers.get('x-signature') || '')) return new Response('Bad signature', { status: 401 });
  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    body = {};
  }
  const event = pick(body, 'event', 'type', 'eventType', 'event_type', 'name') || 'artemis-event';
  const proj = body.project || body.data?.project || body.payload?.project || body.data || body.payload || body;
  const projectId = pick(proj, 'id', 'projectId', 'project_id') || pick(body, 'projectId', 'project_id');
  const isTest = /test/i.test(event) || !projectId || !/^[0-9a-f-]{20,}$/i.test(projectId);

  // Sync (skipped for test pings / payloads without a project id).
  const sync = isTest ? null : await syncArtemisProject(projectId, event);
  await stampSyncState({ lastArtemisWebhookAt: Date.now() }).catch(() => {});
  const p = sync?.project;
  const name = p?.homeowner.name || pick(proj, 'projectName', 'name', 'homeowner.firstName') || 'Project';
  const status = p?.status || pick(proj, 'proposalStatus', 'status');
  const price = p?.price || Number(pick(proj, 'finalSystemPrice', 'grossSystemPrice')) || 0;
  const signed = /contract[-_ ]?signed/i.test(event) || /signed/i.test(status);

  const webhook = env('DISCORD_WEBHOOK');
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Artemis',
          embeds: [
            {
              title: signed ? `Contract signed: ${name}` : `Artemis ${event}: ${name}`,
              color: signed ? 0x16a34a : 0x255188,
              description: [
                status && `Status: **${status}**`,
                price ? `Proposal: **$${Math.round(price).toLocaleString('en-US')}**` : '',
                p?.categories.length ? `Scope: ${p.categories.join(', ')}` : '',
                p?.city ? `City: ${p.city}${p.rep ? ` · Rep: ${p.rep}` : ''}` : '',
                p?.proposalUrl || (projectId && `https://sales.artemis.solar/p/${projectId}`),
                sync?.internal
                  ? '\n(practice/test project, not synced)'
                  : sync
                    ? `\nJobNimbus: ${sync.jn}\nGHL: ${sync.ghl}`
                    : isTest
                      ? '\n(test ping, nothing synced)'
                      : '',
              ]
                .filter(Boolean)
                .join('\n')
                .slice(0, 3900),
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
      /* alert is best-effort */
    }
  }
  return new Response(JSON.stringify({ ok: true, synced: !!sync, jn: sync?.jn, ghl: sync?.ghl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ ok: true, listening: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
