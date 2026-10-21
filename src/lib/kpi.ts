// KPI data layer for /dashboard and /api/weekly-report (server-side only).
// Sources:
//   - GoHighLevel opportunities  = leads created + jobs won + revenue
//     (every website/ad lead creates an opportunity; monetaryValue on won
//     opportunities is the revenue signal)
//   - CallRail calls             = phone volume by source
//   - src/data/adspend.ts        = the one manual input (monthly ad spend)
// Every fetcher degrades gracefully: missing env vars or API errors return
// null and the UI shows a "not connected" state instead of breaking.

import { spendFor } from '../data/adspend';

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export interface Opp {
  createdAt: Date;
  status: string; // open | won | lost | abandoned
  value: number;
  updatedAt: Date;
  source: string;
  contactId: string;
  pipelineId: string;
  pipelineStageId: string;
  name: string; // opportunity name (lead name + service)
}

export interface Call {
  at: Date;
  firstCall: boolean;
  source: string;
  /** CallRail tracker name, e.g. "Google Local Services Ads", "Google Ads - Roofing". */
  sourceName: string;
  /** Caller number, last 10 digits (joins calls to a person in the 360 view). */
  phone: string;
}

export interface WeekPoint {
  label: string; // e.g. "Jun 30"
  start: Date;
  end: Date;
  leads: number;
  calls: number | null; // null = CallRail not connected
}

export interface MonthKpi {
  ym: string; // YYYY-MM
  label: string; // Jan, Feb...
  leads: number;
  calls: number | null;
  spend: number;
  cpl: number | null;
  jobsWon: number;
  cpa: number | null;
  revenue: number;
  roi: number | null; // (revenue - spend) / spend
}

// ---- GoHighLevel ----------------------------------------------------------

export async function fetchOpportunities(): Promise<Opp[] | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return null;
  const headers = {
    Authorization: `Bearer ${pit}`,
    Version: GHL_VERSION,
    Accept: 'application/json',
  };
  const out: Opp[] = [];
  try {
    for (let page = 1; page <= 30; page++) {
      const res = await fetch(
        `${GHL_BASE}/opportunities/search?location_id=${encodeURIComponent(loc)}&limit=100&page=${page}&order=added_desc`,
        { headers },
      );
      if (!res.ok) return page === 1 ? null : out;
      const data = await res.json();
      const opps = data?.opportunities || [];
      for (const o of opps) {
        out.push({
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt || o.createdAt),
          status: (o.status || 'open').toLowerCase(),
          value: Number(o.monetaryValue) || 0,
          source: (o.source || '').trim() || 'Unknown',
          contactId: o.contactId || '',
          pipelineId: o.pipelineId || '',
          pipelineStageId: o.pipelineStageId || '',
          name: String(o.name || '').trim(),
        });
      }
      if (opps.length < 100) break;
    }
    return out;
  } catch {
    return out.length ? out : null;
  }
}

// ---- Appointments (GHL booking calendars) ---------------------------------

export interface Appt {
  start: Date;
  end: Date;
  title: string;
  calendar: string; // e.g. "Roofing", "Windows"
  status: string; // confirmed | cancelled | showed | noshow | ...
  contactId: string; // GHL contact id (joins to attribution)
}

/**
 * Upcoming booked appointments from the GHL calendars behind the site's
 * booking widgets. Returns null when GHL is not connected or the token lacks
 * the calendars scope, so the UI can show a "not connected" state.
 */
export async function fetchAppointments(
  calendars: { label: string; id: string }[],
  days = 14,
): Promise<Appt[] | null> {
  return fetchAppointmentsRange(calendars, new Date(), new Date(Date.now() + days * 86400000));
}

/** Appointments (any status) whose start time falls in [from, to). */
export async function fetchAppointmentsRange(
  calendars: { label: string; id: string }[],
  fromDate: Date,
  toDate: Date,
): Promise<Appt[] | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc || calendars.length === 0) return null;
  const headers = {
    Authorization: `Bearer ${pit}`,
    Version: GHL_VERSION,
    Accept: 'application/json',
  };
  const from = fromDate.getTime();
  const until = toDate.getTime();
  const out: Appt[] = [];
  let anyOk = false;
  for (const cal of calendars) {
    try {
      const res = await fetch(
        `${GHL_BASE}/calendars/events?locationId=${encodeURIComponent(loc)}&calendarId=${encodeURIComponent(cal.id)}&startTime=${from}&endTime=${until}`,
        { headers },
      );
      if (!res.ok) continue;
      anyOk = true;
      const data = await res.json();
      for (const e of data?.events || []) {
        out.push({
          start: new Date(e.startTime),
          end: new Date(e.endTime || e.startTime),
          title: (e.title || '').trim() || 'Appointment',
          calendar: cal.label,
          status: (e.appointmentStatus || e.status || '').toLowerCase(),
          contactId: String(e.contactId || ''),
        });
      }
    } catch {
      /* try the next calendar */
    }
  }
  if (!anyOk) return null;
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

// ---- JobNimbus (production/ops truth) -------------------------------------

export interface JnJob {
  jnid: string;
  name: string;
  type: string; // record_type_name: Windows | Roofing | ...
  status: string; // status_name, e.g. "Install Complete"
  stage: 'pipeline' | 'production' | 'done';
  created: Date;
  updated: Date;
  estTotal: number; // approved_estimate_total
  invTotal: number; // approved_invoice_total
  primaryId: string; // primary contact jnid
}

/** Bucket a JobNimbus status into a coarse stage for the funnel tiles. */
function jnStage(status: string): JnJob['stage'] {
  const s = status.toLowerCase();
  if (/(complete|paid|closed)/.test(s)) return 'done';
  if (/(sold|ordered|scheduled to be received|received|in progress|install scheduled|measure)/.test(s)) return 'production';
  return 'pipeline';
}

/** All JobNimbus jobs. Null when JOBNIMBUS_API_KEY is missing or the API errors. */
export async function fetchJnJobs(): Promise<JnJob[] | null> {
  const key = env('JOBNIMBUS_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://app.jobnimbus.com/api1/jobs?size=1000', {
      headers: { Authorization: `bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.results || []).map((j: Record<string, unknown>) => {
      const status = String(j.status_name || 'Unknown');
      return {
        jnid: String(j.jnid || ''),
        name: String(j.name || 'Unnamed job'),
        type: String(j.record_type_name || 'Other'),
        status,
        stage: jnStage(status),
        created: new Date(Number(j.date_created || 0) * 1000),
        updated: new Date(Number(j.date_updated || 0) * 1000),
        estTotal: Number(j.approved_estimate_total) || 0,
        invTotal: Number(j.approved_invoice_total) || 0,
        primaryId: String((j.primary as { id?: string } | null)?.id || ''),
      };
    });
  } catch {
    return null;
  }
}

export interface JnRevenueItem {
  when: Date;
  total: number;
  kind: 'estimated' | 'signed' | 'paid';
  contactId: string; // JN contact jnid
  name: string;
}

/**
 * Real revenue signals from JobNimbus: signed estimates + paid invoices.
 * byMonthSigned/byMonthPaid key on YYYY-MM.
 */
export async function fetchJnRevenue(): Promise<{
  items: JnRevenueItem[];
  byMonthSigned: Record<string, number>;
  byMonthPaid: Record<string, number>;
} | null> {
  const key = env('JOBNIMBUS_API_KEY');
  if (!key) return null;
  const headers = { Authorization: `bearer ${key}`, Accept: 'application/json' };
  const items: JnRevenueItem[] = [];
  try {
    const [estRes, invRes] = await Promise.all([
      fetch('https://app.jobnimbus.com/api1/estimates?size=1000', { headers }),
      fetch('https://app.jobnimbus.com/api1/invoices?size=1000', { headers }),
    ]);
    if (!estRes.ok && !invRes.ok) return null;
    const contactOf = (r: Record<string, unknown>) => {
      const rel = (r.related as { id?: string; type?: string }[] | null) || [];
      return String(rel.find((x) => x.type === 'contact')?.id || r.customer || '');
    };
    if (estRes.ok) {
      for (const r of (await estRes.json())?.results || []) {
        const signed = Number(r.date_signed) || 0;
        const total = Number(r.total) || 0;
        const name = String(r.related?.[0]?.name || r.number || 'Estimate');
        if (total <= 0) continue;
        // Every priced estimate is "estimated" (revenue potential) when it was
        // written; signing adds a separate "signed" item at the signature date.
        const est = Number(r.date_estimate) || Number(r.date_created) || 0;
        if (est > 0) items.push({ when: new Date(est * 1000), total, kind: 'estimated', contactId: contactOf(r), name });
        if (signed > 0) items.push({ when: new Date(signed * 1000), total, kind: 'signed', contactId: contactOf(r), name });
      }
    }
    if (invRes.ok) {
      for (const r of (await invRes.json())?.results || []) {
        const paid = Number(r.date_paid_in_full) || 0;
        const total = Number(r.total) || 0;
        if (paid > 0 && total > 0)
          items.push({ when: new Date(paid * 1000), total, kind: 'paid', contactId: contactOf(r), name: String(r.related?.[0]?.name || r.number || 'Invoice') });
      }
    }
    const byMonthSigned: Record<string, number> = {};
    const byMonthPaid: Record<string, number> = {};
    for (const it of items) {
      const ym = it.when.toISOString().slice(0, 7);
      if (it.kind === 'signed') byMonthSigned[ym] = (byMonthSigned[ym] || 0) + it.total;
      else byMonthPaid[ym] = (byMonthPaid[ym] || 0) + it.total;
    }
    return { items, byMonthSigned, byMonthPaid };
  } catch {
    return null;
  }
}

/** JN contact jnid -> phone digits + email, for joining revenue to GHL attribution. */
export async function fetchJnContactsIndex(): Promise<Map<string, { phone: string; email: string }> | null> {
  const key = env('JOBNIMBUS_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://app.jobnimbus.com/api1/contacts?size=1000', {
      headers: { Authorization: `bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const out = new Map<string, { phone: string; email: string }>();
    for (const c of (await res.json())?.results || []) {
      out.set(String(c.jnid), {
        phone: String(c.mobile_phone || c.home_phone || c.work_phone || '').replace(/\D/g, '').slice(-10),
        email: String(c.email || '').trim().toLowerCase(),
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Attribute JobNimbus revenue to marketing sources by matching the JN contact's
 * phone/email against GHL contacts (which carry first-touch UTM attribution).
 */
export function jnRevenueBySource(
  items: JnRevenueItem[],
  jnContacts: Map<string, { phone: string; email: string }> | null,
  attrs: Map<string, ContactAttr> | null,
): { source: string; campaign: string; estimated: number; signed: number; paid: number; n: number }[] {
  const rows = new Map<string, { source: string; campaign: string; estimated: number; signed: number; paid: number; n: number }>();
  const byPhone = new Map<string, ContactAttr>();
  const byEmail = new Map<string, ContactAttr>();
  for (const a of attrs?.values() ?? []) {
    if (a.phone) byPhone.set(a.phone, a);
    if (a.email) byEmail.set(a.email, a);
  }
  for (const it of items) {
    const jc = jnContacts?.get(it.contactId);
    const match = (jc?.phone && byPhone.get(jc.phone)) || (jc?.email && byEmail.get(jc.email)) || null;
    const source = match ? match.source : 'Unmatched (no GHL contact)';
    const campaign = match?.campaign || '';
    const k = `${source}|${campaign}`;
    const row = rows.get(k) || { source, campaign, estimated: 0, signed: 0, paid: 0, n: 0 };
    row[it.kind] += it.total;
    row.n++;
    rows.set(k, row);
  }
  return [...rows.values()].sort((a, b) => b.signed + b.paid - (a.signed + a.paid));
}

export interface JnFile {
  filename: string;
  contentType: string;
  recordType: string;
  by: string;
  when: Date;
}

/** Recent image uploads in JobNimbus (marketing photo review queue). */
export async function fetchJnPhotos(limit = 12): Promise<JnFile[] | null> {
  const key = env('JOBNIMBUS_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://app.jobnimbus.com/api1/files?size=1000', {
      headers: { Authorization: `bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return ((data?.files || []) as Record<string, unknown>[])
      .filter((f) => String(f.content_type || '').startsWith('image/') && f.is_active !== false)
      .map((f) => ({
        filename: String(f.filename || 'unnamed'),
        contentType: String(f.content_type || ''),
        recordType: String(f.record_type_name || ''),
        by: String(f.created_by_name || ''),
        when: new Date(Number(f.date_created || 0) * 1000),
      }))
      .sort((a, b) => b.when.getTime() - a.when.getTime())
      .slice(0, limit);
  } catch {
    return null;
  }
}

// ---- JobNimbus sync state (custom value storage, same pattern as spend) ----

const JN_SYNC_CV_NAME = 'JobNimbus Sync State JSON';

export interface JnSyncState {
  reviewed: string[]; // job jnids already processed by the review engine
  lastRun?: number; // epoch ms of the last completed sync (throttling)
  lastJnWebhookAt?: number; // epoch ms of the last real ping from JobNimbus
  lastArtemisWebhookAt?: number; // epoch ms of the last real ping from Artemis
  lastCallSyncAt?: number; // epoch ms of the last CallRail -> GHL poll
  lastGhlLeadSyncAt?: number; // epoch ms of the last GHL -> JobNimbus lead poll
  lastGhlStageSyncAt?: number; // epoch ms of the last GHL stage -> JN status sync
  lastArtemisProposalSyncAt?: number; // epoch ms of the last Artemis proposal -> JN poll
  lastMetaSyncAt?: number; // epoch ms of the last sold-jobs -> Meta offline-conversions run
  metaSent?: string[]; // event_ids already reported to Meta; pruned each run to the 7-day window
  ghlMirrored?: string[]; // GHL contact ids already mirrored to JN; pruned to the lookback window
}

/** Merge a partial update into the sync state (webhook liveness stamps). */
export async function stampSyncState(patch: Partial<JnSyncState>): Promise<void> {
  const cur = await fetchJnSyncState();
  if (!cur) return;
  await saveJnSyncState({ ...cur.state, ...patch, reviewed: cur.state.reviewed }, cur.id);
}

export async function fetchJnSyncState(): Promise<{ state: JnSyncState; id: string | null } | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return null;
  try {
    const res = await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { headers: ghlHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const cv = (data?.customValues || []).find((c: any) => c?.name === JN_SYNC_CV_NAME);
    if (!cv) return { state: { reviewed: [] }, id: null };
    let state: JnSyncState = { reviewed: [] };
    try {
      const parsed = JSON.parse(cv.value || '{}');
      if (Array.isArray(parsed?.reviewed))
        state = {
          reviewed: parsed.reviewed.filter((x: unknown) => typeof x === 'string'),
          lastRun: Number(parsed.lastRun) || 0,
          lastJnWebhookAt: Number(parsed.lastJnWebhookAt) || 0,
          lastArtemisWebhookAt: Number(parsed.lastArtemisWebhookAt) || 0,
          lastCallSyncAt: Number(parsed.lastCallSyncAt) || 0,
          lastGhlLeadSyncAt: Number(parsed.lastGhlLeadSyncAt) || 0,
          lastGhlStageSyncAt: Number(parsed.lastGhlStageSyncAt) || 0,
          lastArtemisProposalSyncAt: Number(parsed.lastArtemisProposalSyncAt) || 0,
          lastMetaSyncAt: Number(parsed.lastMetaSyncAt) || 0,
          metaSent: Array.isArray(parsed.metaSent) ? parsed.metaSent.filter((x: unknown) => typeof x === 'string') : [],
          ghlMirrored: Array.isArray(parsed.ghlMirrored) ? parsed.ghlMirrored.filter((x: unknown) => typeof x === 'string') : [],
        };
    } catch {
      /* corrupted; start fresh (worst case a duplicate review tag) */
    }
    return { state, id: cv.id };
  } catch {
    return null;
  }
}

export async function saveJnSyncState(state: JnSyncState, id: string | null): Promise<boolean> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return false;
  const body = JSON.stringify({ name: JN_SYNC_CV_NAME, value: JSON.stringify(state) });
  try {
    const res = id
      ? await fetch(`${GHL_BASE}/locations/${loc}/customValues/${id}`, { method: 'PUT', headers: ghlHeaders(), body })
      : await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { method: 'POST', headers: ghlHeaders(), body });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- CallRail -------------------------------------------------------------

export async function fetchCalls(start: Date, end: Date): Promise<Call[] | null> {
  const key = env('CALLRAIL_API_KEY');
  const account = env('CALLRAIL_ACCOUNT_ID');
  if (!key || !account) return null;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const out: Call[] = [];
  try {
    for (let page = 1; page <= 8; page++) {
      const res = await fetch(
        `https://api.callrail.com/v3/a/${account}/calls.json?start_date=${fmt(start)}&end_date=${fmt(end)}&per_page=250&page=${page}&fields=first_call,source,source_name,tracker_id,customer_phone_number`,
        { headers: { Authorization: `Token token="${key}"` } },
      );
      if (!res.ok) return page === 1 ? null : out;
      const data = await res.json();
      const calls = data?.calls || [];
      for (const c of calls) {
        out.push({
          at: new Date(c.start_time),
          firstCall: !!c.first_call,
          phone: String(c.customer_phone_number || '').replace(/\D/g, '').slice(-10),
          source: c.source || '',
          sourceName: c.source_name || c.source || 'Unknown',
        });
      }
      if (page >= (data?.total_pages || 1)) break;
    }
    return out;
  } catch {
    return out.length ? out : null;
  }
}

// ---- Rollups --------------------------------------------------------------

/** Monday 00:00 UTC of the week containing d. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay(); // 0 Sun .. 6 Sat
  x.setUTCDate(x.getUTCDate() - ((day + 6) % 7));
  return x;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildWeekly(
  opps: Opp[] | null,
  calls: Call[] | null,
  nWeeks = 12,
  now = new Date(),
): WeekPoint[] {
  const thisWeek = weekStart(now);
  const points: WeekPoint[] = [];
  for (let i = nWeeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    points.push({
      label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`,
      start,
      end,
      leads: (opps || []).filter((o) => o.createdAt >= start && o.createdAt < end).length,
      calls: calls === null ? null : calls.filter((c) => c.at >= start && c.at < end).length,
    });
  }
  return points;
}

export function buildMonthly(
  opps: Opp[] | null,
  calls: Call[] | null,
  year: number,
  now = new Date(),
  spendLookup: (ym: string) => number = spendFor,
): MonthKpi[] {
  const rows: MonthKpi[] = [];
  const lastMonth = year === now.getUTCFullYear() ? now.getUTCMonth() : 11;
  for (let m = 0; m <= lastMonth; m++) {
    const start = new Date(Date.UTC(year, m, 1));
    const end = new Date(Date.UTC(year, m + 1, 1));
    const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
    const monthOpps = (opps || []).filter((o) => o.createdAt >= start && o.createdAt < end);
    // Won this month = status won and last updated this month (close date proxy).
    const won = (opps || []).filter(
      (o) => o.status === 'won' && o.updatedAt >= start && o.updatedAt < end,
    );
    const leads = monthOpps.length;
    const monthCalls = calls === null ? null : calls.filter((c) => c.at >= start && c.at < end).length;
    const spend = spendLookup(ym);
    const revenue = won.reduce((s, o) => s + o.value, 0);
    const totalLeads = leads + (monthCalls ?? 0);
    rows.push({
      ym,
      label: MONTHS[m],
      leads,
      calls: monthCalls,
      spend,
      cpl: spend > 0 && totalLeads > 0 ? spend / totalLeads : null,
      jobsWon: won.length,
      cpa: spend > 0 && won.length > 0 ? spend / won.length : null,
      revenue,
      roi: spend > 0 ? (revenue - spend) / spend : null,
    });
  }
  return rows;
}

export const money = (n: number): string =>
  '$' + Math.round(n).toLocaleString('en-US');
export const pct = (n: number): string =>
  `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;

// ---- Access key (shared by /dashboard, /api/spend, /api/weekly-report) ----

/** Tolerant key check: trims whitespace and accepts the raw query form. */
export function keyOk(url: URL): boolean {
  const dashKey = env('DASH_KEY').trim();
  if (!dashKey) return false;
  const parsed = (url.searchParams.get('key') || '').trim();
  const raw = (url.search.match(/[?&]key=([^&]*)/)?.[1] || '').trim();
  try {
    return parsed === dashKey || raw === dashKey || decodeURIComponent(raw) === dashKey;
  } catch {
    return parsed === dashKey || raw === dashKey;
  }
}

// ---- Spend store (persisted as a GHL custom value; no database needed) ----

/** One spend line item. campaign/adset empty = platform-level entry. */
export interface SpendRow {
  month: string; // YYYY-MM
  platform: 'google' | 'lsa' | 'facebook' | 'other';
  campaign: string;
  adset: string;
  amount: number;
}
export type SpendStore = { version: 2; rows: SpendRow[] };
const SPEND_CV_NAME = 'Dashboard Ad Spend JSON';

export const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, ' ');

/** Upsert key for a spend row. */
export const spendKey = (r: Pick<SpendRow, 'month' | 'platform' | 'campaign' | 'adset'>) =>
  [r.month, r.platform, norm(r.campaign), norm(r.adset)].join('|');

const ghlHeaders = () => ({
  Authorization: `Bearer ${env('GHL_PIT')}`,
  Version: GHL_VERSION,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

/** Read the saved spend store. Returns {store, id} (id null until first save). */
export async function fetchSpendStore(): Promise<{ store: SpendStore; id: string | null } | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return null;
  try {
    const res = await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { headers: ghlHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const cv = (data?.customValues || []).find((c: any) => c?.name === SPEND_CV_NAME);
    if (!cv) return { store: { version: 2, rows: [] }, id: null };
    let store: SpendStore = { version: 2, rows: [] };
    try {
      const parsed = JSON.parse(cv.value || '{}');
      if (parsed && Array.isArray(parsed.rows)) {
        store = { version: 2, rows: parsed.rows.filter((r: any) => r && r.month) };
      } else if (parsed && typeof parsed === 'object') {
        // migrate v1 shape: { 'YYYY-MM': { google, facebook, other } }
        for (const [month, v] of Object.entries<any>(parsed)) {
          if (!/^\d{4}-\d{2}$/.test(month) || !v) continue;
          for (const platform of ['google', 'facebook', 'other'] as const) {
            const amount = Number(v[platform]) || 0;
            if (amount > 0) store.rows.push({ month, platform, campaign: '', adset: '', amount });
          }
        }
      }
    } catch {
      /* corrupted value; treat as empty */
    }
    return { store, id: cv.id };
  } catch {
    return null;
  }
}

/** Upsert the spend store custom value. Returns true on success. */
export async function saveSpendStore(store: SpendStore, id: string | null): Promise<boolean> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return false;
  const body = JSON.stringify({ name: SPEND_CV_NAME, value: JSON.stringify(store) });
  try {
    const res = id
      ? await fetch(`${GHL_BASE}/locations/${loc}/customValues/${id}`, { method: 'PUT', headers: ghlHeaders(), body })
      : await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { method: 'POST', headers: ghlHeaders(), body });
    return res.ok;
  } catch {
    return false;
  }
}

/** Combined spend lookup: saved rows first, static adspend.ts as fallback. */
export function makeSpendLookup(store: SpendStore | null): (ym: string) => number {
  return (ym: string) => {
    const rows = (store?.rows || []).filter((r) => r.month === ym);
    if (rows.length) return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return spendFor(ym);
  };
}

/** YTD spend grouped by normalized campaign name (rows with a campaign set). */
export function spendByCampaign(store: SpendStore | null, since: Date, until?: Date): Map<string, number> {
  const out = new Map<string, number>();
  const sinceYm = since.toISOString().slice(0, 7);
  const untilYm = until ? until.toISOString().slice(0, 7) : '9999-99';
  for (const r of store?.rows || []) {
    if (r.month < sinceYm || r.month > untilYm || !r.campaign) continue;
    const k = norm(r.campaign);
    out.set(k, (out.get(k) || 0) + (Number(r.amount) || 0));
  }
  return out;
}

/** YTD spend grouped by campaign|adset for rows that name an ad set. */
export function spendByAdset(store: SpendStore | null, since: Date, until?: Date): Map<string, number> {
  const out = new Map<string, number>();
  const sinceYm = since.toISOString().slice(0, 7);
  const untilYm = until ? until.toISOString().slice(0, 7) : '9999-99';
  for (const r of store?.rows || []) {
    if (r.month < sinceYm || r.month > untilYm || !r.adset) continue;
    const k = norm(r.campaign) + '|' + norm(r.adset);
    out.set(k, (out.get(k) || 0) + (Number(r.amount) || 0));
  }
  return out;
}

// ---- Contact attribution (which campaign/source each lead came from) ------

export interface ContactAttr {
  id: string;
  dateAdded: Date;
  source: string;
  campaign: string; // utmCampaign of first-touch attribution, or ''
  channel: string; // adSource / utmSessionSource / medium, best available
  adset: string; // utmContent, or utmMedium when it carries an ad set name
  tags: string[];
  phone: string; // last 10 digits, for cross-system matching (JobNimbus)
  email: string; // lowercased
}

export async function fetchContactAttribution(): Promise<Map<string, ContactAttr> | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return null;
  const out = new Map<string, ContactAttr>();
  try {
    let startAfterId = '';
    let startAfter = '';
    for (let page = 0; page < 30; page++) {
      const qs = new URLSearchParams({ locationId: loc, limit: '100' });
      if (startAfterId) {
        qs.set('startAfterId', startAfterId);
        qs.set('startAfter', startAfter);
      }
      const res = await fetch(`${GHL_BASE}/contacts/?${qs}`, { headers: ghlHeaders() });
      if (!res.ok) return page === 0 ? null : out;
      const data = await res.json();
      const contacts = data?.contacts || [];
      for (const c of contacts) {
        const attrs = Array.isArray(c.attributions) ? c.attributions : [];
        const first = attrs.find((a: any) => a?.isFirst) || attrs[0] || {};
        // Ad set: utm_content when present; else utmMedium unless it is a
        // generic medium word (Meta setups often park the ad set name there).
        const GENERIC = new Set(['cpc', 'ppc', 'paid', 'paid-social', 'paidsocial', 'social', 'facebook', 'instagram', 'email', 'organic', 'referral']);
        const um = (first.utmMedium || '').trim();
        const adset = (first.utmContent || '').trim() || (um && !GENERIC.has(um.toLowerCase()) ? um : '');
        out.set(c.id, {
          id: c.id,
          dateAdded: new Date(c.dateAdded),
          source: (c.source || '').trim() || 'Unknown',
          campaign: (first.utmCampaign || '').trim(),
          channel: (first.adSource || first.utmSessionSource || first.medium || '').trim(),
          adset,
          tags: Array.isArray(c.tags) ? c.tags : [],
          phone: String(c.phone || '').replace(/\D/g, '').slice(-10),
          email: String(c.email || '').trim().toLowerCase(),
        });
      }
      if (contacts.length < 100) break;
      startAfterId = data?.meta?.startAfterId || contacts[contacts.length - 1]?.id || '';
      startAfter = String(data?.meta?.startAfter ?? '');
      if (!startAfterId) break;
    }
    return out;
  } catch {
    return out.size ? out : null;
  }
}

// ---- Performance tables ---------------------------------------------------

export interface PerfRow {
  name: string;
  sub: string;
  leads: number;
  won: number;
  revenue: number;
}

function rollup(rows: Map<string, PerfRow>, key: string, sub: string, o: Opp) {
  const r = rows.get(key) || { name: key, sub, leads: 0, won: 0, revenue: 0 };
  r.leads += 1;
  if (o.status === 'won') {
    r.won += 1;
    r.revenue += o.value;
  }
  rows.set(key, r);
}

/** Leads/wins/revenue grouped by opportunity source (lead_source strings). */
export function buildSourceTable(opps: Opp[] | null, since: Date, until?: Date): PerfRow[] {
  if (!opps) return [];
  const rows = new Map<string, PerfRow>();
  for (const o of opps) {
    if (o.createdAt < since || (until && o.createdAt >= until)) continue;
    rollup(rows, o.source, '', o);
  }
  return [...rows.values()].sort((a, b) => b.leads - a.leads);
}

export interface SpendPerfRow extends PerfRow {
  spend: number | null;
  cpl: number | null;
  cpa: number | null;
  roi: number | null;
}

function withSpend(r: PerfRow, spend: number | undefined): SpendPerfRow {
  const sp = spend && spend > 0 ? spend : null;
  return {
    ...r,
    spend: sp,
    cpl: sp && r.leads ? sp / r.leads : null,
    cpa: sp && r.won ? sp / r.won : null,
    roi: sp ? (r.revenue - sp) / sp : null,
  };
}

/** Leads/wins/revenue by first-touch UTM campaign, joined to entered spend. */
export function buildCampaignTable(
  opps: Opp[] | null,
  attrs: Map<string, ContactAttr> | null,
  since: Date,
  campSpend: Map<string, number> = new Map(),
  until?: Date,
): SpendPerfRow[] {
  if (!opps || !attrs) return [];
  const rows = new Map<string, PerfRow>();
  for (const o of opps) {
    if (o.createdAt < since || (until && o.createdAt >= until)) continue;
    const a = attrs.get(o.contactId);
    const name = a?.campaign || (a?.channel ? `(no campaign · ${a.channel})` : '(no attribution)');
    rollup(rows, name, a?.channel || '', o);
  }
  return [...rows.values()]
    .sort((a, b) => b.leads - a.leads)
    .map((r) => withSpend(r, campSpend.get(norm(r.name))));
}

/** Leads/wins/revenue by campaign + ad set, joined to ad-set-level spend. */
export function buildAdsetTable(
  opps: Opp[] | null,
  attrs: Map<string, ContactAttr> | null,
  since: Date,
  adsetSpend: Map<string, number> = new Map(),
  until?: Date,
): SpendPerfRow[] {
  if (!opps || !attrs) return [];
  const rows = new Map<string, PerfRow>();
  const meta = new Map<string, { campaign: string; adset: string }>();
  for (const o of opps) {
    if (o.createdAt < since || (until && o.createdAt >= until)) continue;
    const a = attrs.get(o.contactId);
    if (!a?.adset) continue;
    const key = `${a.campaign || '(no campaign)'} · ${a.adset}`;
    meta.set(key, { campaign: a.campaign || '', adset: a.adset });
    rollup(rows, key, a.channel || '', o);
  }
  return [...rows.values()]
    .sort((a, b) => b.leads - a.leads)
    .map((r) => {
      const m = meta.get(r.name);
      const spend = m ? adsetSpend.get(norm(m.campaign) + '|' + norm(m.adset)) : undefined;
      return withSpend(r, spend);
    });
}

/** Calls grouped by CallRail tracker name inside [since, until). */
export interface CallSourceRow {
  name: string;
  calls: number;
  firstTime: number;
}
export function buildCallSources(
  calls: Call[] | null,
  since: Date,
  until?: Date,
): CallSourceRow[] {
  if (!calls) return [];
  const rows = new Map<string, CallSourceRow>();
  for (const c of calls) {
    if (c.at < since || (until && c.at >= until)) continue;
    const r = rows.get(c.sourceName) || { name: c.sourceName, calls: 0, firstTime: 0 };
    r.calls += 1;
    if (c.firstCall) r.firstTime += 1;
    rows.set(c.sourceName, r);
  }
  return [...rows.values()].sort((a, b) => b.calls - a.calls);
}

// ---- Work log store (dashboard quick-add; persisted like the spend store) ----

export interface WorkLogEntry {
  date: string; // YYYY-MM-DD
  text: string;
}
const WORKLOG_CV_NAME = 'Dashboard Work Log JSON';

export async function fetchWorkLog(): Promise<{ entries: WorkLogEntry[]; id: string | null } | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return null;
  try {
    const res = await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { headers: ghlHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    const cv = (data?.customValues || []).find((c: any) => c?.name === WORKLOG_CV_NAME);
    if (!cv) return { entries: [], id: null };
    let entries: WorkLogEntry[] = [];
    try {
      const parsed = JSON.parse(cv.value || '[]');
      if (Array.isArray(parsed)) entries = parsed.filter((e: any) => e && e.date && e.text);
    } catch {
      /* corrupted; treat as empty */
    }
    return { entries, id: cv.id };
  } catch {
    return null;
  }
}

export async function saveWorkLog(entries: WorkLogEntry[], id: string | null): Promise<boolean> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return false;
  const body = JSON.stringify({ name: WORKLOG_CV_NAME, value: JSON.stringify(entries.slice(0, 300)) });
  try {
    const res = id
      ? await fetch(`${GHL_BASE}/locations/${loc}/customValues/${id}`, { method: 'PUT', headers: ghlHeaders(), body })
      : await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { method: 'POST', headers: ghlHeaders(), body });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Pipeline health -------------------------------------------------------

export interface PipelineInfo {
  id: string;
  name: string;
  stages: { id: string; name: string; position: number }[];
}

export async function fetchPipelines(): Promise<PipelineInfo[] | null> {
  const pit = env('GHL_PIT');
  const loc = env('GHL_LOCATION_ID');
  if (!pit || !loc) return null;
  try {
    const res = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(loc)}`, {
      headers: ghlHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.pipelines || []).map((p: any) => ({
      id: p.id,
      name: p.name || 'Unnamed',
      stages: (p.stages || []).map((s: any, i: number) => ({ id: s.id, name: s.name || 'Stage', position: Number(s.position ?? i) })),
    }));
  } catch {
    return null;
  }
}

export interface FunnelKpis {
  open: number;
  won: number;
  lost: number;
  winRate: number | null; // won / (won + lost)
  avgDaysToWin: number | null;
  staleOpen: number; // open, untouched > staleDays
  openValue: number;
}

export function buildFunnel(opps: Opp[] | null, since: Date, now = new Date(), staleDays = 7): FunnelKpis | null {
  if (!opps) return null;
  const inRange = opps.filter((o) => o.createdAt >= since);
  const open = inRange.filter((o) => o.status === 'open');
  const won = inRange.filter((o) => o.status === 'won');
  const lost = inRange.filter((o) => o.status === 'lost' || o.status === 'abandoned');
  const staleCutoff = new Date(now.getTime() - staleDays * 86400000);
  const winDays = won
    .map((o) => (o.updatedAt.getTime() - o.createdAt.getTime()) / 86400000)
    .filter((d) => d >= 0 && d < 365);
  return {
    open: open.length,
    won: won.length,
    lost: lost.length,
    winRate: won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null,
    avgDaysToWin: winDays.length ? winDays.reduce((a, b) => a + b, 0) / winDays.length : null,
    staleOpen: open.filter((o) => o.updatedAt < staleCutoff).length,
    openValue: open.reduce((s2, o) => s2 + o.value, 0),
  };
}

export interface PipelineRow {
  name: string;
  open: number;
  openValue: number;
  won: number;
  lost: number;
  winRate: number | null;
  revenue: number;
}

export function buildPipelineHealth(
  opps: Opp[] | null,
  pipelines: PipelineInfo[] | null,
  since: Date,
): PipelineRow[] {
  if (!opps) return [];
  const names = new Map((pipelines || []).map((p) => [p.id, p.name]));
  const rows = new Map<string, PipelineRow>();
  for (const o of opps) {
    if (o.createdAt < since) continue;
    const name = names.get(o.pipelineId) || 'No pipeline';
    const r = rows.get(name) || { name, open: 0, openValue: 0, won: 0, lost: 0, winRate: null, revenue: 0 };
    if (o.status === 'open') {
      r.open += 1;
      r.openValue += o.value;
    } else if (o.status === 'won') {
      r.won += 1;
      r.revenue += o.value;
    } else if (o.status === 'lost' || o.status === 'abandoned') {
      r.lost += 1;
    }
    rows.set(name, r);
  }
  for (const r of rows.values()) {
    r.winRate = r.won + r.lost > 0 ? r.won / (r.won + r.lost) : null;
  }
  return [...rows.values()].sort((a, b) => b.open - a.open);
}

export interface ListHealth {
  smsYes: number;
  smsNo: number;
  smsRate: number | null;
  marketingOptins: number;
}

/** Consent/list KPIs from contact tags (tags exist on leads since Aug 2026). */
export function buildListHealth(attrs: Map<string, ContactAttr> | null): ListHealth | null {
  if (!attrs) return null;
  let smsYes = 0;
  let smsNo = 0;
  let marketing = 0;
  for (const c of attrs.values()) {
    const t = c.tags.map((x) => x.toLowerCase());
    if (t.includes('sms-consent')) smsYes += 1;
    else if (t.includes('no-sms-consent')) smsNo += 1;
    if (t.includes('marketing-optin')) marketing += 1;
  }
  return {
    smsYes,
    smsNo,
    smsRate: smsYes + smsNo > 0 ? smsYes / (smsYes + smsNo) : null,
    marketingOptins: marketing,
  };
}
