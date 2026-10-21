// CallRail -> GoHighLevel: every first-time caller becomes a GHL contact +
// opportunity carrying the ORIGINAL attribution (tracking source, campaign,
// ad set / utm_content, keywords, gclid/fbclid, landing page), so phone leads
// get the same speed-to-lead follow-up and the same channel analytics as
// form leads. Idempotent: a caller already in GHL (by phone) is left alone.
// Triggers: dashboard loads (throttled), the daily sync cron, and the
// optional CallRail post-call webhook (/api/callrail-webhook/).
import { fetchPipelines, fetchJnSyncState, saveJnSyncState } from './kpi';
import { ghlFindContact } from './jn';

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const ghlHeaders = () => ({ Authorization: `Bearer ${env('GHL_PIT')}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' });
const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);

export interface CrCall {
  id: string;
  at: Date;
  phone: string; // last 10 digits
  name: string;
  city: string;
  state: string;
  sourceName: string; // tracker name, e.g. "Google Ads - Roofing"
  source: string; // CallRail source classification
  campaign: string;
  medium: string;
  keywords: string;
  landing: string;
  utm: { source: string; medium: string; campaign: string; content: string; term: string };
  gclid: string;
  fbclid: string;
  firstCall: boolean;
  answered: boolean;
  duration: number;
  recording: string;
  tracker: string;
}

const FIELDS = [
  'customer_name', 'customer_city', 'customer_state', 'customer_phone_number', 'source_name', 'source', 'campaign', 'medium',
  'keywords', 'landing_page_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid',
  'first_call', 'answered', 'duration', 'recording', 'tracking_phone_number',
].join(',');

export function mapCall(c: any): CrCall {
  return {
    id: String(c.id || ''),
    at: new Date(c.start_time || c.created_at || Date.now()),
    phone: digits(c.customer_phone_number || c.customer_phone || ''),
    name: String(c.customer_name || '').trim(),
    city: String(c.customer_city || '').trim(),
    state: String(c.customer_state || '').trim(),
    sourceName: String(c.source_name || c.tracking_name || '').trim(),
    source: String(c.source || '').trim(),
    campaign: String(c.campaign || '').trim(),
    medium: String(c.medium || '').trim(),
    keywords: String(c.keywords || '').trim(),
    landing: String(c.landing_page_url || '').trim(),
    utm: {
      source: String(c.utm_source || '').trim(),
      medium: String(c.utm_medium || '').trim(),
      campaign: String(c.utm_campaign || '').trim(),
      content: String(c.utm_content || '').trim(),
      term: String(c.utm_term || '').trim(),
    },
    gclid: String(c.gclid || '').trim(),
    fbclid: String(c.fbclid || '').trim(),
    firstCall: !!c.first_call,
    answered: !!c.answered,
    duration: Number(c.duration) || 0,
    recording: String(c.recording || '').trim(),
    tracker: String(c.tracking_phone_number || '').trim(),
  };
}

/** Detailed calls in [start, end] (CallRail v3). Null when not connected. */
export async function fetchCallsDetailed(start: Date, end: Date): Promise<CrCall[] | null> {
  const key = env('CALLRAIL_API_KEY');
  const account = env('CALLRAIL_ACCOUNT_ID');
  if (!key || !account) return null;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const out: CrCall[] = [];
  try {
    for (let page = 1; page <= 40; page++) {
      const res = await fetch(
        `https://api.callrail.com/v3/a/${account}/calls.json?start_date=${fmt(start)}&end_date=${fmt(end)}&per_page=250&page=${page}&fields=${FIELDS}`,
        { headers: { Authorization: `Token token=${key}`, Accept: 'application/json' } },
      );
      if (!res.ok) return page === 1 ? null : out;
      const data = await res.json();
      const calls = data?.calls || [];
      out.push(...calls.map(mapCall));
      if (calls.length < 250) break;
    }
    return out;
  } catch {
    return out.length ? out : null;
  }
}

/** Which ad platform a tracker/source string belongs to (spend join key). */
export function platformOf(s: string): 'google' | 'lsa' | 'facebook' | 'other' | 'organic' {
  const x = (s || '').toLowerCase();
  if (/facebook|meta|instagram|fb\b/.test(x)) return 'facebook';
  if (/local services|lsa/.test(x)) return 'lsa';
  if (/google ads|adwords|google cpc|google paid|gclid/.test(x)) return 'google';
  if (/microsoft|bing/.test(x)) return 'other';
  return 'organic';
}
const PLATFORM_LABEL: Record<string, string> = { google: 'Google Ads', lsa: 'Google Local Services Ads', facebook: 'Facebook Ads', other: 'Microsoft Ads', organic: 'Organic / Direct' };

function serviceOf(c: CrCall): 'roofing' | 'windows' | 'insulation' | 'general' {
  const x = `${c.sourceName} ${c.campaign} ${c.utm.campaign} ${c.keywords}`.toLowerCase();
  if (/roof/.test(x)) return 'roofing';
  if (/window/.test(x)) return 'windows';
  if (/insul/.test(x)) return 'insulation';
  return 'general';
}

export interface CallSyncResult {
  ok: boolean;
  scanned: number;
  created: number;
  existing: number;
  skipped: number;
  note?: string;
  names: string[];
}

/**
 * Create the GHL contact + opportunity for one first-time caller. Returns
 * 'created' | 'existing' | 'skipped:<why>'.
 */
export async function processCall(c: CrCall, pipelines?: Awaited<ReturnType<typeof fetchPipelines>>): Promise<string> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return 'skipped:ghl not connected';
  if (!c.phone || c.phone.length < 10) return 'skipped:no number';
  if (c.duration < 10 && !c.answered) return 'skipped:short unanswered call (likely robocall)';
  // A Fresno contractor's real leads call from California; out-of-state
  // caller IDs are overwhelmingly telemarketers and dialers.
  if (c.state && c.state.toUpperCase() !== 'CA') return `skipped:out of state (${c.state})`;
  if (/^(wireless caller|unavailable|unknown|anonymous|toll free|restricted)$/i.test(c.name) && c.duration < 30 && !c.answered) return 'skipped:unidentified short call';
  if (await ghlFindContact(c.phone, '')) return 'existing';

  const platform = platformOf(`${c.sourceName} ${c.source} ${c.medium} ${c.utm.source}${c.gclid ? ' gclid' : ''}${c.fbclid ? ' facebook' : ''}`);
  const svc = serviceOf(c);
  const source = `Phone - ${c.sourceName || c.source || 'CallRail'}`;
  const parts = (c.name || '').split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || 'Phone';
  const lastName = parts.join(' ') || (c.name ? '' : 'Lead');
  const campaign = c.utm.campaign || c.campaign;
  const adset = c.utm.content;
  const tags = ['phone-lead', `platform-${platform}`, `svc-${svc}`, 'no-sms-consent'];
  const attributionSource: Record<string, string> = {};
  const put = (k: string, v: string) => {
    if (v) attributionSource[k] = v;
  };
  put('sessionSource', PLATFORM_LABEL[platform]);
  put('medium', c.utm.medium || c.medium || (platform === 'organic' ? 'phone' : 'paid'));
  put('campaign', campaign);
  put('utmSource', c.utm.source || c.source);
  put('utmMedium', c.utm.medium || c.medium);
  put('utmCampaign', campaign);
  put('utmContent', adset);
  put('utmKeyword', c.utm.term || c.keywords);
  put('gclid', c.gclid);
  put('fbclid', c.fbclid);
  put('url', c.landing);

  try {
    const body: Record<string, unknown> = {
      locationId: loc,
      firstName,
      lastName,
      name: c.name || `Phone lead ${c.phone.slice(-4)}`,
      phone: `+1${c.phone}`,
      city: c.city || undefined,
      state: c.state || undefined,
      source,
      tags,
      // No SMS consent from a phone call: automations reach them by call/email.
      dndSettings: { SMS: { status: 'active', message: 'Phone lead, no SMS consent on record', code: '' } },
      attributionSource,
    };
    let res = await fetch(`${GHL_BASE}/contacts/upsert`, { method: 'POST', headers: ghlHeaders(), body: JSON.stringify(body) });
    if (!res.ok) {
      delete body.attributionSource;
      res = await fetch(`${GHL_BASE}/contacts/upsert`, { method: 'POST', headers: ghlHeaders(), body: JSON.stringify(body) });
    }
    if (!res.ok) return `skipped:ghl ${res.status}`;
    const data = await res.json();
    const contactId = data?.contact?.id ?? data?.id;
    if (!contactId) return 'skipped:no contact id';

    // Opportunity in the matching pipeline (first stage).
    const pls = pipelines ?? (await fetchPipelines()) ?? [];
    const pick = pls.find((p) => p.name.toLowerCase().includes(svc.slice(0, 4))) || pls.find((p) => /general|lead/i.test(p.name)) || pls[0];
    if (pick && pick.stages.length) {
      const stage = [...pick.stages].sort((a, b) => a.position - b.position)[0];
      await fetch(`${GHL_BASE}/opportunities/`, {
        method: 'POST',
        headers: ghlHeaders(),
        body: JSON.stringify({ pipelineId: pick.id, pipelineStageId: stage.id, locationId: loc, contactId, name: `${c.name || 'Phone lead'} - ${svc === 'general' ? 'Phone' : svc.charAt(0).toUpperCase() + svc.slice(1)}`, status: 'open', source }),
      }).catch(() => {});
    }
    // Call details as a note.
    const note = [
      `Phone lead via CallRail (${c.sourceName || c.source})`,
      `Called ${c.at.toISOString().slice(0, 16).replace('T', ' ')} UTC, ${c.answered ? 'answered' : 'missed'}, ${c.duration}s`,
      campaign && `Campaign: ${campaign}${adset ? ` | Ad set: ${adset}` : ''}`,
      c.keywords && `Keywords: ${c.keywords}`,
      c.landing && `Landing page: ${c.landing}`,
      c.recording && `Recording: ${c.recording}`,
    ]
      .filter(Boolean)
      .join('\n');
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, { method: 'POST', headers: ghlHeaders(), body: JSON.stringify({ body: note }) }).catch(() => {});
    return 'created';
  } catch (e) {
    return `skipped:${(e as Error).message}`;
  }
}

/**
 * Poll CallRail for first-time callers since the last run (with a 1-day
 * overlap) and create anyone missing from GHL. First ever run covers the
 * year to date. Throttled unless force.
 */
export async function runCallSync(force = false, maxPerRun = force ? 40 : 15): Promise<CallSyncResult> {
  if (!env('CALLRAIL_API_KEY') || !env('CALLRAIL_ACCOUNT_ID')) return { ok: false, scanned: 0, created: 0, existing: 0, skipped: 0, note: 'CallRail not connected', names: [] };
  const state = await fetchJnSyncState();
  if (!state) return { ok: false, scanned: 0, created: 0, existing: 0, skipped: 0, note: 'GHL state unavailable', names: [] };
  const last = state.state.lastCallSyncAt || 0;
  if (!force && last && Date.now() - last < 10 * 60_000) return { ok: true, scanned: 0, created: 0, existing: 0, skipped: 0, note: 'throttled', names: [] };
  const now = new Date();
  const since = last ? new Date(last - 86400000) : new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const calls = await fetchCallsDetailed(since, now);
  if (!calls) return { ok: false, scanned: 0, created: 0, existing: 0, skipped: 0, note: 'CallRail fetch failed', names: [] };
  const first = calls.filter((c) => c.firstCall && c.phone).sort((x, y) => x.at.getTime() - y.at.getTime());
  // One row per number (a caller can have several "first" records across trackers).
  const seen = new Set<string>();
  const unique = first.filter((c) => (seen.has(c.phone) ? false : (seen.add(c.phone), true)));
  const pipelines = await fetchPipelines();
  let created = 0, existing = 0, skipped = 0;
  const names: string[] = [];
  // Bounded per run (serverless time limit); progress is stamped at the last
  // processed call so the next run continues from there. Existing contacts
  // cost one lookup each, so re-scanning the overlap window is cheap.
  const batch = unique.slice(0, maxPerRun);
  for (const c of batch) {
    const r = await processCall(c, pipelines);
    if (r === 'created') {
      created++;
      names.push(c.name || c.phone);
    } else if (r === 'existing') existing++;
    else skipped++;
  }
  const done = batch.length < unique.length ? batch[batch.length - 1].at.getTime() : Date.now();
  await saveJnSyncState({ ...state.state, lastCallSyncAt: done }, state.id);
  return { ok: true, scanned: batch.length, created, existing, skipped, names, note: batch.length < unique.length ? `${unique.length - batch.length} more callers queued for the next run` : undefined };
}
