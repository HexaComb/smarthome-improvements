// Ad-spend line-item editor endpoint for /dashboard. Each row is
// month + platform + campaign (optional) + ad set (optional) + amount, so
// spend can be tracked per campaign and per ad set and joined to the UTM
// performance tables. Storage: GoHighLevel custom value ("Dashboard Ad
// Spend JSON"), no database needed. DASH_KEY gated.
import type { APIRoute } from 'astro';
import { fetchSpendStore, saveSpendStore, spendKey, keyOk, type SpendRow } from '../../lib/kpi';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  if (!keyOk(url)) return new Response('Unauthorized', { status: 401 });

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const str = (k: string) => (fd.get(k) || '').toString().trim();
  const month = str('month');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response('Bad month', { status: 400 });
  const platform = (['google', 'lsa', 'facebook', 'other'].includes(str('platform')) ? str('platform') : 'other') as SpendRow['platform'];
  const row: SpendRow = {
    month,
    platform,
    campaign: str('campaign').slice(0, 120),
    adset: str('adset').slice(0, 120),
    amount: (() => {
      const v = parseFloat(str('amount').replace(/[$,\s]/g, ''));
      return Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
    })(),
  };

  const cur = await fetchSpendStore();
  if (!cur) return new Response('GHL not connected', { status: 502 });

  const action = str('action') || 'save';
  const key = spendKey(row);
  const rows = cur.store.rows.filter((r) => spendKey(r) !== key);
  if (action !== 'delete' && row.amount > 0) rows.push(row);
  rows.sort((a, b) => (a.month === b.month ? (a.platform + a.campaign).localeCompare(b.platform + b.campaign) : a.month < b.month ? 1 : -1));

  const ok = await saveSpendStore({ version: 2, rows }, cur.id);
  if (!ok) return new Response('Save failed', { status: 502 });

  const k = url.searchParams.get('key') || '';
  return new Response(null, {
    status: 303,
    headers: { Location: `/dashboard/?key=${encodeURIComponent(k)}#spend` },
  });
};

export const GET: APIRoute = async ({ url }) => {
  if (!keyOk(url)) return new Response('Unauthorized', { status: 401 });
  const cur = await fetchSpendStore();
  return new Response(JSON.stringify(cur?.store ?? { version: 2, rows: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
