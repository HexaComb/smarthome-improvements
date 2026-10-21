// 360 pipeline: one row per PERSON, stitched across every system by phone
// (last 10 digits) or email, placed at the furthest stage they have reached.
//   GHL          lead, source/campaign, pipeline stage, opportunity value
//   CallRail     calls from that number
//   GHL calendar inspections booked / cancelled
//   Artemis      proposal status + price + link
//   JobNimbus    job board (Roofing/Windows), status, production stage
import type { Opp, Call, Appt, JnJob, JnRevenueItem, ContactAttr, PipelineInfo } from './kpi';
import type { ArtemisProject } from './artemis';

export const STAGES = [
  { key: 'lead', label: 'Lead' },
  { key: 'booked', label: 'Inspection booked' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'contract', label: 'Contract sent' },
  { key: 'signed', label: 'Signed / Sold' },
  { key: 'production', label: 'In production' },
  { key: 'complete', label: 'Complete' },
  { key: 'paid', label: 'Paid' },
] as const;
export type StageKey = (typeof STAGES)[number]['key'];
const RANK: Record<StageKey, number> = { lead: 0, booked: 1, proposal: 2, contract: 3, signed: 4, production: 5, complete: 6, paid: 7 };

export interface Person {
  key: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  source: string;
  campaign: string;
  adset: string;
  platform: 'google' | 'lsa' | 'facebook' | 'other' | 'organic';
  kind: 'form' | 'phone' | 'other';
  stage: StageKey;
  value: number; // best known $ (paid > signed > proposal > GHL opp value)
  firstSeen: Date;
  lastActivity: Date;
  ghl: { contactId: string; stage: string; status: string; value: number; pipeline: string; createdAt: Date } | null;
  calls: number;
  appts: { booked: number; cancelled: number; next: Date | null };
  artemis: { status: string; price: number; url: string; updatedAt: Date } | null;
  jn: { jnid: string; type: string; status: string; stage: JnJob['stage']; updatedAt: Date } | null;
  paid: number;
  signedValue: number;
  lost: boolean;
}

const CANCELLED = new Set(['cancelled', 'canceled', 'invalid', 'noshow', 'no_show']);
const PLACEHOLDER = new Set(['Unknown', 'Caller', 'Lead', 'Website lead']);
const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);
const later = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);
const earlier = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);

export function build360(input: {
  opps: Opp[] | null;
  attrs: Map<string, ContactAttr> | null;
  pipelines: PipelineInfo[] | null;
  calls: Call[] | null;
  appts: Appt[] | null;
  jnJobs: JnJob[] | null;
  jnContacts: Map<string, { phone: string; email: string }> | null;
  jnContactNames?: Map<string, string>;
  revItems: JnRevenueItem[];
  artemis: ArtemisProject[] | null;
}): Person[] {
  const people = new Map<string, Person>();
  const byPhone = new Map<string, Person>();
  const byEmail = new Map<string, Person>();

  const find = (phone: string, email: string): Person | null =>
    (phone && byPhone.get(phone)) || (email && byEmail.get(email)) || null;
  const blank = (name: string, phone: string, email: string, when: Date): Person => ({
    key: phone || email || `${name}-${when.getTime()}`,
    name,
    phone,
    email,
    city: '',
    source: '',
    campaign: '',
    adset: '',
    platform: 'organic',
    kind: 'other',
    stage: 'lead',
    value: 0,
    firstSeen: when,
    lastActivity: when,
    ghl: null,
    calls: 0,
    appts: { booked: 0, cancelled: 0, next: null },
    artemis: null,
    jn: null,
    paid: 0,
    signedValue: 0,
    lost: false,
  });
  const upsert = (name: string, phone: string, email: string, when: Date): Person => {
    phone = digits(phone);
    email = (email || '').trim().toLowerCase();
    let p = find(phone, email);
    if (!p) {
      p = blank(name, phone, email, when);
      people.set(p.key, p);
    }
    if (phone && !p.phone) p.phone = phone;
    if (email && !p.email) p.email = email;
    if (p.phone) byPhone.set(p.phone, p);
    if (p.email) byEmail.set(p.email, p);
    if (name && !PLACEHOLDER.has(name) && (!p.name || PLACEHOLDER.has(p.name))) p.name = name;
    else if (name && !p.name) p.name = name;
    p.firstSeen = earlier(p.firstSeen, when);
    p.lastActivity = later(p.lastActivity, when);
    return p;
  };
  const bump = (p: Person, stage: StageKey) => {
    if (RANK[stage] > RANK[p.stage]) p.stage = stage;
  };

  // 1) GHL: contacts (attribution) + opportunities (stage, value)
  const stageName = new Map<string, { name: string; pipeline: string }>();
  for (const pl of input.pipelines ?? []) for (const s of pl.stages) stageName.set(s.id, { name: s.name, pipeline: pl.name });
  const attrById = input.attrs ?? new Map<string, ContactAttr>();
  const oppByContact = new Map<string, Opp>();
  for (const o of input.opps ?? []) {
    const prev = oppByContact.get(o.contactId);
    if (!prev || o.updatedAt > prev.updatedAt) oppByContact.set(o.contactId, o);
  }
  for (const [contactId, o] of oppByContact) {
    const a = attrById.get(contactId);
    const name = o.name.replace(/\s+-\s+.*$/, '').trim() || 'Unknown';
    const p = upsert(name, a?.phone || '', a?.email || '', o.createdAt);
    p.lastActivity = later(p.lastActivity, o.updatedAt);
    p.source = p.source || a?.source || o.source;
    p.campaign = p.campaign || a?.campaign || '';
    p.adset = p.adset || a?.adset || '';
    p.kind = /^phone/i.test(p.source) ? 'phone' : 'form';
    const st = stageName.get(o.pipelineStageId);
    p.ghl = { contactId, stage: st?.name || 'Open', status: o.status, value: o.value, pipeline: st?.pipeline || '', createdAt: o.createdAt };
    if (o.value > p.value) p.value = o.value;
    if (o.status === 'won') bump(p, 'signed');
    if (o.status === 'lost' || o.status === 'abandoned') p.lost = true;
  }

  // 2) Calls (by caller number)
  for (const c of input.calls ?? []) {
    if (!c.phone) continue;
    const p = upsert('Caller', c.phone, '', c.at);
    p.calls++;
    if (!p.source) p.source = `Phone - ${c.sourceName || c.source}`;
    if (!p.ghl) p.kind = 'phone';
  }

  // 3) Appointments (by GHL contact id)
  const now = new Date();
  for (const ap of input.appts ?? []) {
    const a = ap.contactId ? attrById.get(ap.contactId) : null;
    if (!a && !ap.contactId) continue;
    const p = a ? upsert('Unknown', a.phone, a.email, ap.start) : null;
    if (!p) continue;
    if (CANCELLED.has(ap.status)) p.appts.cancelled++;
    else {
      p.appts.booked++;
      bump(p, 'booked');
      if (ap.start > now && (!p.appts.next || ap.start < p.appts.next)) p.appts.next = ap.start;
    }
  }

  // 4) Artemis proposals (by homeowner phone/email)
  for (const ar of input.artemis ?? []) {
    if (!ar.homeowner.phone && !ar.homeowner.email) continue;
    const p = upsert(ar.homeowner.name || ar.name, ar.homeowner.phone, ar.homeowner.email, ar.createdAt);
    p.lastActivity = later(p.lastActivity, ar.updatedAt);
    if (!p.city) p.city = ar.city;
    const s = ar.status.toLowerCase();
    const st: StageKey = /signed|approved|installed|complete|closed|won/.test(s) ? 'signed' : /contract sent|change order/.test(s) ? 'contract' : 'proposal';
    if (!p.artemis || ar.updatedAt > p.artemis.updatedAt || RANK[st] > RANK[p.stage]) {
      p.artemis = { status: ar.status, price: ar.price, url: ar.proposalUrl, updatedAt: ar.updatedAt };
    }
    bump(p, st);
    if (ar.price > p.value) p.value = ar.price;
    if (st === 'signed' && ar.price > p.signedValue) p.signedValue = ar.price;
  }

  // 5) JobNimbus jobs (by JN contact phone/email)
  for (const j of input.jnJobs ?? []) {
    const jc = input.jnContacts?.get(j.primaryId);
    if (!jc || (!jc.phone && !jc.email)) continue;
    const name = input.jnContactNames?.get(j.primaryId) || j.name.replace(/\s+-\s+(Roofing|Windows)$/, '');
    const p = upsert(name, jc.phone, jc.email, j.created);
    p.lastActivity = later(p.lastActivity, j.updated);
    const s = j.status.toLowerCase();
    // Sold statuses are a signature, not production; production starts at ordered/scheduled/in progress.
    const st: StageKey = /paid|closed/.test(s) ? 'paid' : j.stage === 'done' ? 'complete' : /sold/.test(s) ? 'signed' : j.stage === 'production' ? 'production' : /pending customer sig|estimat/.test(s) ? 'proposal' : /appt|measure/.test(s) ? 'booked' : 'lead';
    if (!p.jn || RANK[st] >= RANK[p.stage] || j.updated > p.jn.updatedAt) p.jn = { jnid: j.jnid, type: j.type, status: j.status, stage: j.stage, updatedAt: j.updated };
    bump(p, st);
    const jv = j.invTotal || j.estTotal;
    if (jv > p.value) p.value = jv;
  }

  // 6) JobNimbus money (signed estimates / paid invoices by JN contact)
  for (const it of input.revItems) {
    const jc = input.jnContacts?.get(it.contactId);
    if (!jc || (!jc.phone && !jc.email)) continue;
    const p = find(jc.phone, jc.email);
    if (!p) continue;
    p.lastActivity = later(p.lastActivity, it.when);
    if (it.kind === 'paid') {
      p.paid += it.total;
      bump(p, 'paid');
    } else if (it.kind === 'signed') {
      p.signedValue = Math.max(p.signedValue, it.total);
      bump(p, 'signed');
    }
    if (it.total > p.value) p.value = it.total;
  }

  // People known only by phone number (calls that never became a CRM contact)
  // get the number as their display name instead of a placeholder.
  for (const p of people.values()) {
    if (PLACEHOLDER.has(p.name) && p.phone) p.name = `Caller ${p.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}`;
  }
  for (const p of people.values()) p.platform = platformOf(`${p.source} ${p.campaign}`);
  return [...people.values()].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

export function platformOf(s: string): Person['platform'] {
  const x = (s || '').toLowerCase();
  if (/facebook|meta|instagram|fb\b/.test(x)) return 'facebook';
  if (/local services|lsa/.test(x)) return 'lsa';
  if (/google ads|adwords|google cpc|google paid|gclid|google-search|roofing-search|windows-search/.test(x)) return 'google';
  if (/microsoft|bing/.test(x)) return 'other';
  return 'organic';
}
export const PLATFORM_LABEL: Record<Person['platform'], string> = {
  google: 'Google Ads',
  lsa: 'Google Local Services Ads',
  facebook: 'Facebook Ads',
  other: 'Microsoft Ads',
  organic: 'Organic / Direct / Referral',
};

export interface ChannelRow {
  level: 0 | 1 | 2; // platform | campaign | ad set
  key: string;
  label: string;
  platform: Person['platform'];
  people: number;
  forms: number;
  phone: number;
  booked: number;
  proposals: number;
  signed: number;
  signedValue: number;
  paid: number;
  spend: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  roi: number | null;
}

const normKey = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Channel economics: platform -> campaign -> ad set, with people (forms +
 * phone), funnel counts, signed/paid dollars, and spend joined from the
 * spend editor rows (platform rows without a campaign count at platform
 * level; campaign rows join on campaign name; ad set rows on campaign+ad set).
 */
export function channelSummary(
  people: Person[],
  spendRows: { month: string; platform: string; campaign: string; adset: string; amount: number }[],
  range: { start: Date; end: Date },
): ChannelRow[] {
  const a = range.start.toISOString().slice(0, 7);
  const b = new Date(range.end.getTime() - 1).toISOString().slice(0, 7);
  const spend = spendRows.filter((r) => r.month >= a && r.month <= b);
  const rows = new Map<string, ChannelRow>();
  const get = (level: ChannelRow['level'], key: string, label: string, platform: Person['platform']) => {
    let r = rows.get(key);
    if (!r) {
      r = { level, key, label, platform, people: 0, forms: 0, phone: 0, booked: 0, proposals: 0, signed: 0, signedValue: 0, paid: 0, spend: 0, cpl: null, cpa: null, roas: null, roi: null };
      rows.set(key, r);
    }
    return r;
  };
  for (const p of people) {
    const keys: [ChannelRow['level'], string, string][] = [[0, p.platform, PLATFORM_LABEL[p.platform]]];
    if (p.campaign) keys.push([1, `${p.platform}|${normKey(p.campaign)}`, p.campaign]);
    if (p.campaign && p.adset) keys.push([2, `${p.platform}|${normKey(p.campaign)}|${normKey(p.adset)}`, p.adset]);
    if (!p.campaign && p.platform === 'organic') keys.push([1, `organic|${normKey(p.source)}`, p.source || 'Unknown source']);
    for (const [level, key, label] of keys) {
      const r = get(level, key, label, p.platform);
      r.people++;
      if (p.kind === 'phone') r.phone++;
      else r.forms++;
      if (p.appts.booked > 0) r.booked++;
      if (p.artemis) r.proposals++;
      if (RANK[p.stage] >= RANK.signed) {
        r.signed++;
        r.signedValue += p.signedValue || p.value;
      }
      r.paid += p.paid;
    }
  }
  for (const s of spend) {
    const platform = (s.platform as Person['platform']) || 'other';
    get(0, platform, PLATFORM_LABEL[platform] || platform, platform).spend += s.amount;
    if (s.campaign) get(1, `${platform}|${normKey(s.campaign)}`, s.campaign, platform).spend += s.amount;
    if (s.campaign && s.adset) get(2, `${platform}|${normKey(s.campaign)}|${normKey(s.adset)}`, s.adset, platform).spend += s.amount;
  }
  for (const r of rows.values()) {
    r.cpl = r.spend > 0 && r.people > 0 ? r.spend / r.people : null;
    r.cpa = r.spend > 0 && r.signed > 0 ? r.spend / r.signed : null;
    r.roas = r.spend > 0 ? r.signedValue / r.spend : null;
    r.roi = r.spend > 0 ? (r.signedValue - r.spend) / r.spend : null;
  }
  const order: Person['platform'][] = ['facebook', 'google', 'lsa', 'other', 'organic'];
  return [...rows.values()].sort((x, y) => {
    const px = order.indexOf(x.platform);
    const py = order.indexOf(y.platform);
    if (px !== py) return px - py;
    return x.key.localeCompare(y.key) || x.level - y.level;
  });
}

export function stageSummary(people: Person[]) {
  return STAGES.map((s) => {
    const rows = people.filter((p) => p.stage === s.key && !p.lost);
    return { ...s, count: rows.length, value: rows.reduce((t, p) => t + p.value, 0), people: rows };
  });
}
