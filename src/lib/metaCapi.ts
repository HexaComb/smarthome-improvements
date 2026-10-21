// Meta (Facebook) Conversions API — server-side offline / CRM conversions.
// When a Facebook-sourced JobNimbus job is marked sold, we send a Purchase
// event (with the deal value) back to Meta so ad delivery optimizes toward
// buyers, not just form-fills. All PII is SHA-256 hashed per Meta's spec; the
// access token + dataset (pixel) id come from env and are never committed.
import crypto from 'node:crypto';

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

// Conversions API token: Events Manager -> dataset -> Conversions API ->
// "Generate access token". A few common var names are accepted so a mis-named
// Vercel variable still works.
const capiToken = (): string =>
  env('META_CAPI_TOKEN') || env('META_ACCESS_TOKEN') || env('FB_CAPI_TOKEN') || env('FACEBOOK_CAPI_TOKEN');

// Dataset id == the Meta Pixel id for this ad account (Facebook lead-ads pixel).
const datasetId = (): string => env('META_PIXEL_ID') || env('META_DATASET_ID') || '2204742390264631';

export const metaReady = (): boolean => capiToken().length > 0;

const GRAPH_VERSION = 'v21.0';

/** SHA-256 hex of a normalized (trimmed, lowercased) string; undefined if empty. */
const hash = (raw: string): string | undefined => {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return undefined;
  return crypto.createHash('sha256').update(v).digest('hex');
};

export interface MetaConversion {
  email?: string;
  phone?: string; // any format; normalized to E.164 digits before hashing
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string; // 2-letter; defaults CA
  zip?: string;
  value?: number; // deal amount, USD
  eventId: string; // stable per deal -> Meta dedups any repeat within its window
  eventTimeSec: number; // unix seconds of the sale (must be within 7 days)
  eventName?: string; // default 'Purchase'
  fbc?: string; // _fbc cookie / fbclid, when captured
}

/** Send one offline conversion to Meta. Best-effort; never throws. */
export async function sendMetaConversion(c: MetaConversion): Promise<string> {
  const token = capiToken();
  if (!token) return 'META_CAPI_TOKEN unset';
  const ds = datasetId();

  const phoneDigits = (c.phone || '').replace(/\D/g, '');
  const phoneE164 = phoneDigits ? (phoneDigits.length === 10 ? '1' + phoneDigits : phoneDigits) : '';
  const zip5 = (c.zip || '').replace(/\D/g, '').slice(0, 5);

  const user_data: Record<string, unknown> = {};
  const em = hash(c.email || '');
  if (em) user_data.em = [em];
  // Phone hashes on digits-only E.164 (no '+'), not lowercased text.
  const ph = phoneE164 ? crypto.createHash('sha256').update(phoneE164).digest('hex') : undefined;
  if (ph) user_data.ph = [ph];
  const fn = hash(c.firstName || '');
  if (fn) user_data.fn = [fn];
  const ln = hash(c.lastName || '');
  if (ln) user_data.ln = [ln];
  const ct = hash((c.city || '').replace(/[^a-z]/gi, ''));
  if (ct) user_data.ct = [ct];
  const st = hash(c.state || 'CA');
  if (st) user_data.st = [st];
  const zp = hash(zip5);
  if (zp) user_data.zp = [zp];
  const country = hash('us');
  if (country) user_data.country = [country];
  if (c.fbc) user_data.fbc = c.fbc;

  // Need at least one strong identifier for Meta to match the person.
  if (!user_data.em && !user_data.ph) return 'no email/phone to match';

  const event: Record<string, unknown> = {
    event_name: c.eventName || 'Purchase',
    event_time: c.eventTimeSec,
    action_source: 'system_generated',
    event_id: c.eventId,
    user_data,
  };
  // Meta requires a currency on every Purchase event, even at value 0. Always
  // send it; a real value drives value-based optimization, 0 still reports the
  // conversion for count-based optimization.
  const value = typeof c.value === 'number' && c.value > 0 ? Math.round(c.value * 100) / 100 : 0;
  event.custom_data = { value, currency: 'USD' };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${ds}/events?access_token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: [event] }) },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return `HTTP ${res.status}: ${JSON.stringify(body).slice(0, 200)}`;
    return `ok (events_received ${body?.events_received ?? '?'})`;
  } catch (e) {
    return `error ${String(e).slice(0, 120)}`;
  }
}
