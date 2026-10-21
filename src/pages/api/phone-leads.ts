// Admin maintenance for phone leads created by the CallRail -> GHL sync.
//   GET /api/phone-leads/?key=DASH_KEY&action=list
//   GET /api/phone-leads/?key=DASH_KEY&action=purge-out-of-state
// Only touches contacts tagged "phone-lead" (created by this integration);
// purge removes the ones whose state is set and is not CA (out-of-state
// caller IDs = telemarketers/dialers, never leads for a Fresno contractor).
import type { APIRoute } from 'astro';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const ghlHeaders = () => ({ Authorization: `Bearer ${env('GHL_PIT')}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' });

async function phoneLeadContacts(): Promise<any[]> {
  const loc = env('GHL_LOCATION_ID');
  const out: any[] = [];
  let startAfterId = '';
  let startAfter = '';
  for (let page = 0; page < 40; page++) {
    const qs = new URLSearchParams({ locationId: loc, limit: '100' });
    if (startAfterId) {
      qs.set('startAfterId', startAfterId);
      qs.set('startAfter', startAfter);
    }
    const res = await fetch(`${GHL_BASE}/contacts/?${qs}`, { headers: ghlHeaders() });
    if (!res.ok) break;
    const data = await res.json();
    const contacts = data?.contacts || [];
    for (const c of contacts) if (Array.isArray(c.tags) && c.tags.includes('phone-lead')) out.push(c);
    if (contacts.length < 100) break;
    startAfterId = data?.meta?.startAfterId || contacts[contacts.length - 1]?.id || '';
    startAfter = String(data?.meta?.startAfter ?? '');
    if (!startAfterId) break;
  }
  return out;
}

export const GET: APIRoute = async ({ url }) => {
  const dashKey = env('DASH_KEY').trim();
  if (!dashKey || (url.searchParams.get('key') || '').trim() !== dashKey) return new Response('Unauthorized', { status: 401 });
  if (!env('GHL_PIT') || !env('GHL_LOCATION_ID')) return new Response(JSON.stringify({ ok: false, error: 'GHL not connected' }), { status: 200 });
  const action = url.searchParams.get('action') || 'list';
  const contacts = await phoneLeadContacts();
  const rows = contacts.map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' '), phone: c.phone, state: c.state || '', city: c.city || '', source: c.source || '', added: c.dateAdded }));
  if (action === 'purge-out-of-state') {
    const victims = rows.filter((r) => r.state && String(r.state).toUpperCase() !== 'CA');
    const deleted: string[] = [];
    for (const v of victims) {
      try {
        const res = await fetch(`${GHL_BASE}/contacts/${v.id}`, { method: 'DELETE', headers: ghlHeaders() });
        if (res.ok) deleted.push(`${v.name} (${v.state})`);
      } catch {
        /* skip */
      }
    }
    return new Response(JSON.stringify({ ok: true, phoneLeads: rows.length, outOfState: victims.length, deleted }, null, 1), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ ok: true, phoneLeads: rows.length, byState: rows.reduce((m: Record<string, number>, r) => ((m[r.state || '?'] = (m[r.state || '?'] || 0) + 1), m), {}), rows: rows.slice(0, 200) }, null, 1), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
