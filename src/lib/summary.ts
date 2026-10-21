// Revenue Summary: one view that answers "what did the money do" for a
// period, with period-over-period deltas. Every number maps to a real
// source:
//   spend            -> dashboard spend store (monthly rows)
//   leads/uniques    -> GHL opportunities created in the period
//   booked/canceled  -> GHL calendar appointments in the period
//   jobs run/paying  -> JobNimbus jobs by stage
//   estimated/sold/  -> JobNimbus estimates written / signed / invoices paid
//   closed revenue
import type { Opp, Call, Appt, JnJob, JnRevenueItem, SpendRow, ContactAttr } from './kpi';

export interface Range {
  start: Date;
  end: Date;
}
const DAY = 86400000;
const inR = (d: Date, r: Range) => d >= r.start && d < r.end;

export function priorRange(r: Range): Range {
  const len = r.end.getTime() - r.start.getTime();
  return { start: new Date(r.start.getTime() - len), end: new Date(r.start) };
}

export const pctChange = (cur: number, prev: number): number | null => (prev > 0 ? (cur - prev) / prev : null);

export interface Metric {
  label: string;
  value: number | null;
  prev: number | null;
  delta: number | null; // fraction, null when no baseline
  fmt: 'int' | 'money' | 'pct' | 'x';
  /** true when a rise is bad news (cancellations, spend) */
  badWhenUp?: boolean;
  note?: string;
}

export interface Series {
  cur: number[]; // cumulative by day, current period
  prev: number[]; // cumulative by day, prior period (same length)
}

export interface ConversionRow {
  source: string;
  type: 'form' | 'phone';
  conversions: number;
  share: number;
  potential: number | null; // JN estimated $ attributed to this source
  bookRate: number | null;
}

export interface RevenueSummary {
  cards: Metric[];
  effectiveness: Metric[];
  efficiency: Metric[];
  pipeline: { label: string; value: number; prev: number; delta: number | null; series: Series }[];
  conversions: { total: Metric; unique: Metric; rows: ConversionRow[] };
  days: number;
}

const CANCELLED = new Set(['cancelled', 'canceled', 'invalid', 'noshow', 'no_show']);

function metric(label: string, cur: number | null, prev: number | null, fmt: Metric['fmt'], extra: Partial<Metric> = {}): Metric {
  return { label, value: cur, prev, delta: cur == null || prev == null ? null : pctChange(cur, prev), fmt, ...extra };
}

function spendIn(rows: SpendRow[], r: Range): number {
  const a = r.start.toISOString().slice(0, 7);
  const b = new Date(r.end.getTime() - 1).toISOString().slice(0, 7);
  return rows.filter((x) => x.month >= a && x.month <= b).reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

function cumulative(items: { when: Date; total: number }[], r: Range, days: number): number[] {
  const buckets = new Array(days).fill(0);
  for (const it of items) {
    if (!inR(it.when, r)) continue;
    const i = Math.min(days - 1, Math.floor((it.when.getTime() - r.start.getTime()) / DAY));
    buckets[i] += it.total;
  }
  let run = 0;
  return buckets.map((v) => (run += v));
}

/** SVG polyline points for a series, scaled to a shared max. */
export function sparkPoints(values: number[], max: number, w = 220, h = 60): string {
  if (values.length === 0) return '';
  const n = values.length;
  const sx = (i: number) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const sy = (v: number) => (max > 0 ? h - (v / max) * (h - 4) - 2 : h - 2);
  return values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
}

export function buildRevenueSummary(input: {
  range: Range;
  opps: Opp[] | null;
  calls: Call[] | null;
  appts: Appt[] | null; // both periods, filtered here
  jnJobs: JnJob[] | null;
  revItems: JnRevenueItem[];
  spendRows: SpendRow[];
  attrs: Map<string, ContactAttr> | null;
  jnContacts: Map<string, { phone: string; email: string }> | null;
}): RevenueSummary {
  const cur = input.range;
  const prev = priorRange(cur);
  const days = Math.max(1, Math.ceil((cur.end.getTime() - cur.start.getTime()) / DAY));
  const opps = input.opps ?? [];
  const jobs = input.jnJobs ?? [];
  const appts = input.appts ?? [];

  const per = (r: Range) => {
    const leads = opps.filter((o) => inR(o.createdAt, r));
    const uniques = new Set(leads.map((o) => o.contactId || o.name)).size;
    const calls = input.calls ? input.calls.filter((c) => inR(c.at, r)).length : null;
    const booked = appts.filter((a) => inR(a.start, r) && !CANCELLED.has(a.status)).length;
    const canceled = appts.filter((a) => inR(a.start, r) && CANCELLED.has(a.status)).length;
    const run = jobs.filter((j) => inR(j.created, r) && j.stage !== 'pipeline').length;
    const paying = jobs.filter((j) => j.stage === 'done' && inR(j.updated, r)).length;
    const sum = (kind: JnRevenueItem['kind']) => input.revItems.filter((i) => i.kind === kind && inR(i.when, r)).reduce((s, i) => s + i.total, 0);
    return {
      leads: leads.length,
      uniques,
      calls,
      booked,
      canceled,
      run,
      paying,
      estimated: sum('estimated'),
      sold: sum('signed'),
      closed: sum('paid'),
      spend: spendIn(input.spendRows, r),
    };
  };
  const c = per(cur);
  const p = per(prev);
  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

  const cards: Metric[] = [
    metric('Spend', c.spend, p.spend, 'money', { badWhenUp: true, note: 'from the spend editor (whole months)' }),
    metric('ROAS (potential)', ratio(c.estimated, c.spend), ratio(p.estimated, p.spend), 'x', { note: 'estimated revenue / spend' }),
    metric('ROAS (closed)', ratio(c.closed, c.spend), ratio(p.closed, p.spend), 'x', { note: 'paid revenue / spend' }),
    metric('Revenue potential', c.estimated, p.estimated, 'money', { note: 'priced estimates written' }),
  ];
  const effectiveness: Metric[] = [
    metric('Leads', c.leads + (c.calls || 0), p.leads + (p.calls || 0), 'int', { note: 'forms + calls' }),
    metric('Booked', c.booked, p.booked, 'int', { note: 'inspection appointments' }),
    metric('Canceled', c.canceled, p.canceled, 'int', { badWhenUp: true, note: 'cancelled or no-show' }),
    metric('Jobs run', c.run, p.run, 'int', { note: 'JobNimbus jobs past the lead stage' }),
    metric('Paying', c.paying, p.paying, 'int', { note: 'jobs completed' }),
  ];
  const contacts = (x: typeof c) => x.leads + (x.calls || 0);
  const efficiency: Metric[] = [
    metric('Book rate', ratio(c.booked, contacts(c)), ratio(p.booked, contacts(p)), 'pct', { note: 'booked / leads' }),
    metric('Cancel rate', ratio(c.canceled, c.booked + c.canceled), ratio(p.canceled, p.booked + p.canceled), 'pct', { badWhenUp: true, note: 'canceled / all appointments' }),
    metric('Run rate', ratio(c.run, contacts(c)), ratio(p.run, contacts(p)), 'pct', { note: 'jobs run / leads' }),
    metric('Close rate', ratio(c.paying, contacts(c)), ratio(p.paying, contacts(p)), 'pct', { note: 'paying / leads' }),
  ];

  const kinds: { label: string; kind: JnRevenueItem['kind']; value: number; prev: number }[] = [
    { label: 'Estimated revenue', kind: 'estimated', value: c.estimated, prev: p.estimated },
    { label: 'Sold revenue', kind: 'signed', value: c.sold, prev: p.sold },
    { label: 'Closed revenue', kind: 'paid', value: c.closed, prev: p.closed },
  ];
  const pipeline = kinds.map((k) => {
    const items = input.revItems.filter((i) => i.kind === k.kind);
    return { label: k.label, value: k.value, prev: k.prev, delta: pctChange(k.value, k.prev), series: { cur: cumulative(items, cur, days), prev: cumulative(items, prev, days) } };
  });

  // Conversion table: forms by lead source, calls by tracker.
  const leadsCur = opps.filter((o) => inR(o.createdAt, cur));
  const bySource = new Map<string, ConversionRow>();
  for (const o of leadsCur) {
    const k = `${o.source}|form`;
    const row = bySource.get(k) || { source: o.source, type: 'form' as const, conversions: 0, share: 0, potential: 0, bookRate: null };
    row.conversions++;
    bySource.set(k, row);
  }
  for (const cl of input.calls ?? []) {
    if (!inR(cl.at, cur)) continue;
    const k = `${cl.sourceName || cl.source}|phone`;
    const row = bySource.get(k) || { source: cl.sourceName || cl.source, type: 'phone' as const, conversions: 0, share: 0, potential: null, bookRate: null };
    row.conversions++;
    bySource.set(k, row);
  }
  // Revenue potential per source: JN estimate -> JN contact -> GHL contact (phone/email) -> its source.
  if (input.attrs && input.jnContacts) {
    const byPhone = new Map<string, ContactAttr>();
    const byEmail = new Map<string, ContactAttr>();
    for (const a of input.attrs.values()) {
      if (a.phone) byPhone.set(a.phone, a);
      if (a.email) byEmail.set(a.email, a);
    }
    for (const it of input.revItems) {
      if (it.kind !== 'estimated' || !inR(it.when, cur)) continue;
      const jc = input.jnContacts.get(it.contactId);
      const a = (jc?.phone && byPhone.get(jc.phone)) || (jc?.email && byEmail.get(jc.email)) || null;
      if (!a) continue;
      const row = bySource.get(`${a.source}|form`);
      if (row) row.potential = (row.potential || 0) + it.total;
    }
    // Book rate per source: appointment contact -> source.
    const bookedBySource = new Map<string, number>();
    for (const ap of appts) {
      if (!inR(ap.start, cur) || CANCELLED.has(ap.status) || !ap.contactId) continue;
      const src = input.attrs.get(ap.contactId)?.source;
      if (src) bookedBySource.set(src, (bookedBySource.get(src) || 0) + 1);
    }
    for (const row of bySource.values()) {
      if (row.type === 'form') row.bookRate = ratio(bookedBySource.get(row.source) || 0, row.conversions);
    }
  }
  const rows = [...bySource.values()].sort((a, b) => b.conversions - a.conversions);
  const total = rows.reduce((s, r) => s + r.conversions, 0);
  for (const r of rows) r.share = total > 0 ? r.conversions / total : 0;

  return {
    cards,
    effectiveness,
    efficiency,
    pipeline,
    conversions: {
      total: metric('Conversions', contacts(c), contacts(p), 'int', { note: 'form leads + tracked calls' }),
      unique: metric('Unique leads', c.uniques, p.uniques, 'int', { note: 'distinct contacts' }),
      rows,
    },
    days,
  };
}
