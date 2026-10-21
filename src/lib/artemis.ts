// Artemis (sales.artemis.solar) integration: the proposal / financing /
// e-sign platform. Read side lives here: projects, statuses, proposal
// prices, financing state, analytics roll-ups. Key from ARTEMIS_API_KEY
// (production). 60 requests/minute limit, so:
//   - the project LIST (4 pages of 100) is cached 10 minutes
//   - project DETAILS are cached persistently per id (refetched only when
//     the list says updatedAt changed), filled in batches of 40 per call,
//     so full coverage of all projects builds up across loads / cron runs
//   - a 429 ends the run with whatever was gathered
// Cache lives in the Upstash store (see hits.ts); without it, each load
// fetches details for the 20 most recent projects only.
import { kvGetJson, kvSetJson, hitsReady } from './hits';

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const BASE = () => env('ARTEMIS_BASE') || 'https://sales-api.artemis.solar/external/v1';
const headers = () => ({ 'x-api-key': env('ARTEMIS_API_KEY'), Accept: 'application/json' });

export const artemisReady = () => env('ARTEMIS_API_KEY').length > 0;

export interface ArtemisProject {
  id: string;
  name: string;
  status: string; // Proposal Created | Proposal Sent | Contract Sent | Contract Signed | ...
  type: string; // Home Improvement | Solar | ...
  categories: string[]; // roof | window | insulation | hvac | ...
  street: string;
  city: string;
  zip: string;
  price: number; // finalSystemPrice (proposal total)
  financier: string | null;
  financeStatus: string | null;
  paymentOption: string; // financed | cash | ...
  homeowner: { name: string; email: string; phone: string };
  rep: string;
  repEmail: string; // Artemis rep email, lowercased, for JobNimbus rep matching
  proposalUrl: string;
  createdAt: Date;
  updatedAt: Date;
  statusUpdatedAt: Date;
  utmSource: string;
  utmCampaign: string;
  detailed: boolean;
}

const LIST_KEY = 'artemis:list:v2';
const LIST_TTL = 10 * 60;
const DETAIL_PREFIX = 'artemis:detail:v2:';

// In-process cache (survives across warm serverless invocations). Without
// the Upstash store this is what keeps repeated dashboard loads from
// re-spending the 60/min budget: the list is reused for 10 minutes and
// fetched details accumulate for the life of the instance.
let memList: { at: number; rows: any[] } | null = null;
const memDetails = new Map<string, { updatedAt: string; p: ArtemisProject }>();

/** HTTP status of the most recent detail fetch (404 = gone, 429 = rate limited). */
export let lastArtemisStatus = 0;

/** One project with full detail (webhook use). */
export async function fetchArtemisProject(id: string): Promise<ArtemisProject | null> {
  if (!artemisReady() || !id) return null;
  try {
    let r = await fetch(`${BASE()}/projects/${encodeURIComponent(id)}`, { headers: headers() });
    if (r.status === 429) {
      // Webhooks share the 60/min budget with dashboard loads: wait out the
      // window (Retry-After, capped) and try once more.
      const wait = Math.min(25, Number(r.headers.get('retry-after')) || 20);
      await new Promise((res) => setTimeout(res, wait * 1000));
      r = await fetch(`${BASE()}/projects/${encodeURIComponent(id)}`, { headers: headers() });
    }
    lastArtemisStatus = r.status;
    if (!r.ok) return null;
    const d = await r.json();
    const p = mapOne({ id: d.id, projectName: d.projectName, status: d.proposalStatus, projectType: d.proposalType, address: d.address, createdAt: d.createdAt, updatedAt: d.updatedAt, lastStatusUpdatedAt: d.proposalStatusUpdatedAt, paymentOption: d.paymentOption }, d);
    memDetails.set(p.id, { updatedAt: String(d.updatedAt), p });
    if (hitsReady()) await kvSetJson(DETAIL_PREFIX + p.id, { updatedAt: p.updatedAt.toISOString(), p }, 0);
    return p;
  } catch {
    return null;
  }
}

/**
 * All projects. Details come from the persistent cache when fresh; up to
 * `fill` missing/stale details are fetched per call.
 */
export async function fetchArtemisProjects(fill = 40): Promise<ArtemisProject[] | null> {
  if (!artemisReady()) return null;
  try {
    // 1) list (cached: memory, then Upstash)
    let list: any[] | null = memList && Date.now() - memList.at < LIST_TTL * 1000 ? memList.rows : null;
    if (!list) list = await kvGetJson<any[]>(LIST_KEY);
    let limited = false;
    if (!list) {
      list = [];
      for (let page = 1; page <= 25; page++) {
        const res = await fetch(`${BASE()}/projects?page=${page}&pageSize=100`, { headers: headers() });
        if (res.status === 429) {
          limited = true;
          break;
        }
        if (!res.ok) {
          if (page === 1) return null;
          break;
        }
        const data = await res.json();
        list.push(...(data?.data || []));
        if (page >= (Number(data?.pagination?.totalPages) || 1)) break;
      }
      if (!limited && list.length) await kvSetJson(LIST_KEY, list, LIST_TTL);
    }
    if (!limited && list.length) memList = { at: Date.now(), rows: list };
    // Detail priority: signed and contract-stage projects first (they carry
    // the revenue numbers), then most recently updated.
    const prio = (p: any) => {
      const s = String(p.status || '').toLowerCase();
      return /signed|approved|installed|complete|closed|won/.test(s) ? 2 : /contract|credit|application/.test(s) ? 1 : 0;
    };
    list.sort((a, b) => prio(b) - prio(a) || String(b.updatedAt).localeCompare(String(a.updatedAt)));

    // 2) details: memory first, then Upstash, refreshed when updatedAt moved
    const details = new Map<string, any>();
    for (const p of list) {
      const m = memDetails.get(p.id);
      if (m && m.updatedAt === String(p.updatedAt)) details.set(p.id, m.p);
    }
    const cacheOn = hitsReady();
    if (cacheOn) {
      const keys = list.map((p) => DETAIL_PREFIX + p.id);
      for (let i = 0; i < keys.length; i += 200) {
        const chunk = keys.slice(i, i + 200);
        const got = await kvMget(chunk);
        got.forEach((raw, j) => {
          if (!raw) return;
          const entry = raw as { updatedAt: string; p: any };
          const proj = list[i + j];
          if (entry?.p && entry.updatedAt === String(proj.updatedAt)) details.set(proj.id, entry.p);
        });
      }
    }
    // Without the persistent cache every load would refetch; keep it light so
    // webhooks always have budget left.
    const missing = list.filter((p) => !details.has(p.id)).slice(0, cacheOn ? fill : 12);
    if (!limited) {
      outer: for (let i = 0; i < missing.length; i += 5) {
        const batch = missing.slice(i, i + 5);
        const got = await Promise.all(
          batch.map(async (p) => {
            try {
              const r = await fetch(`${BASE()}/projects/${encodeURIComponent(p.id)}`, { headers: headers() });
              if (r.status === 429) return '429';
              return r.ok ? [p, await r.json()] : null;
            } catch {
              return null;
            }
          }),
        );
        for (const g of got) {
          if (g === '429') break outer;
          if (!g) continue;
          const [p, d] = g as [any, any];
          const mapped = mapOne(p, d);
          details.set(p.id, mapped);
          memDetails.set(p.id, { updatedAt: String(p.updatedAt), p: mapped });
          if (cacheOn) await kvSetJson(DETAIL_PREFIX + p.id, { updatedAt: String(p.updatedAt), p: mapped }, 0);
        }
      }
    }
    return list.map((p) => {
      const d = details.get(p.id);
      return d ? revive(d) : mapOne(p, null);
    });
  } catch {
    return null;
  }
}

async function kvMget(keys: string[]): Promise<(unknown | null)[]> {
  // Reuse hits.ts pipeline via kvGetJson would be N calls; do one MGET here.
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token || keys.length === 0) return keys.map(() => null);
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['MGET', ...keys]]),
    });
    if (!res.ok) return keys.map(() => null);
    const out = await res.json();
    const arr: (string | null)[] = out?.[0]?.result || [];
    return arr.map((s) => {
      if (typeof s !== 'string') return null;
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    });
  } catch {
    return keys.map(() => null);
  }
}

function mapOne(p: any, d: any | null): ArtemisProject {
  const ho = d?.homeowner || {};
  const rep = d?.assignedSalesRep;
  const cats: string[] = Array.isArray(d?.projectEquipmentCategories)
    ? d.projectEquipmentCategories
    : Array.isArray(d?.equipments)
      ? [...new Set(d.equipments.map((e: any) => String(e.homeImprovementType || e.equipmentType || '')))]
      : [];
  return {
    id: String(p.id),
    name: String(p.projectName || d?.projectName || 'Project'),
    status: String(d?.proposalStatus || p.status || 'Unknown'),
    type: String(d?.proposalType || p.projectType || ''),
    categories: cats.filter(Boolean),
    street: String(p.address?.street || d?.address?.street || ''),
    city: String(p.address?.city || d?.address?.city || ''),
    zip: String(p.address?.zipcode || d?.address?.zipcode || ''),
    price: Number(d?.finalSystemPrice ?? d?.grossSystemPrice ?? 0) || 0,
    financier: d?.financier?.financierType ? String(d.financier.financierType) : null,
    financeStatus: d?.financier?.applicationStatus ? String(d.financier.applicationStatus) : null,
    paymentOption: String(p.paymentOption || d?.paymentOption || ''),
    homeowner: {
      name: [ho.firstName, ho.lastName].filter(Boolean).join(' ').trim(),
      email: String(ho.email || '').toLowerCase(),
      phone: String(ho.phoneNumber || '').replace(/\D/g, '').slice(-10),
    },
    rep: rep ? [rep.firstName, rep.lastName].filter(Boolean).join(' ').trim() : '',
    repEmail: String(rep?.email || '').trim().toLowerCase(),
    proposalUrl: String(d?.proposalUrl || `https://sales.artemis.solar/p/${p.id}`),
    createdAt: new Date(p.createdAt || d?.createdAt || 0),
    updatedAt: new Date(p.updatedAt || d?.updatedAt || 0),
    statusUpdatedAt: new Date(p.lastStatusUpdatedAt || d?.proposalStatusUpdatedAt || p.updatedAt || 0),
    utmSource: String(d?.utmSource || ''),
    utmCampaign: String(d?.utmCampaign || ''),
    detailed: !!d,
  };
}

/** Dates come back as strings from the cache. */
function revive(r: any): ArtemisProject {
  return { ...r, createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt), statusUpdatedAt: new Date(r.statusUpdatedAt) };
}

// ---- Analytics ----

const STAGES = ['Proposal Created', 'Proposal Sent', 'Contract Sent', 'Contract Signed'];
const stageRank = (s: string): number => {
  const x = s.toLowerCase();
  if (/signed|approved|installed|complete|closed|won/.test(x)) return 3;
  if (/contract sent|change order|credit|application/.test(x)) return 2;
  if (/proposal sent|sent/.test(x)) return 1;
  return 0;
};

export interface ArtemisAnalytics {
  total: number;
  detailed: number;
  inRange: number;
  proposed: number;
  contractsOut: number;
  signed: number;
  signedCount: number;
  closeRate: number | null;
  avgProposal: number | null;
  avgDaysToSign: number | null;
  funnel: { stage: string; count: number }[];
  byStatus: { status: string; n: number; value: number }[];
  byCategory: { category: string; n: number; value: number }[];
  byRep: { rep: string; n: number; signed: number; value: number }[];
  byCity: { city: string; n: number; value: number }[];
  financing: { label: string; n: number }[];
  monthly: { ym: string; created: number; signed: number; signedValue: number }[];
  recent: ArtemisProject[];
}

export function artemisAnalytics(projects: ArtemisProject[], range?: { start: Date; end: Date }): ArtemisAnalytics {
  const inR = (d: Date) => !range || (d >= range.start && d < range.end);
  const scoped = projects.filter((p) => inR(p.createdAt));
  const byStatus = new Map<string, { n: number; value: number }>();
  const byCategory = new Map<string, { n: number; value: number }>();
  const byRep = new Map<string, { n: number; signed: number; value: number }>();
  const byCity = new Map<string, { n: number; value: number }>();
  const financing = new Map<string, number>();
  const funnel = STAGES.map((s) => ({ stage: s, count: 0 }));
  let proposed = 0, contractsOut = 0, signed = 0, signedCount = 0, priced = 0, daysSum = 0, daysN = 0;
  for (const p of scoped) {
    const rank = stageRank(p.status);
    for (let i = 0; i <= rank && i < funnel.length; i++) funnel[i].count++;
    proposed += p.price;
    if (p.price > 0) priced++;
    if (rank === 3) {
      signed += p.price;
      signedCount++;
      const days = (p.statusUpdatedAt.getTime() - p.createdAt.getTime()) / 86400000;
      if (days >= 0 && days < 365) {
        daysSum += days;
        daysN++;
      }
    } else if (rank === 2) contractsOut += p.price;
    const st = byStatus.get(p.status) || { n: 0, value: 0 };
    st.n++;
    st.value += p.price;
    byStatus.set(p.status, st);
    for (const c of p.categories.length ? p.categories : ['unknown']) {
      const row = byCategory.get(c) || { n: 0, value: 0 };
      row.n++;
      row.value += p.price;
      byCategory.set(c, row);
    }
    const rep = p.rep || (p.detailed ? 'Unassigned' : 'Not loaded yet');
    const r = byRep.get(rep) || { n: 0, signed: 0, value: 0 };
    r.n++;
    if (rank === 3) r.signed++;
    r.value += p.price;
    byRep.set(rep, r);
    const city = p.city || 'Unknown';
    const cr = byCity.get(city) || { n: 0, value: 0 };
    cr.n++;
    cr.value += p.price;
    byCity.set(city, cr);
    const fin = p.financier ? `${p.financier}${p.financeStatus ? ' / ' + p.financeStatus : ''}` : p.paymentOption || 'unknown';
    financing.set(fin, (financing.get(fin) || 0) + 1);
  }
  // Monthly created vs signed over the last 6 months (all projects, not range-scoped).
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  const monthly = months.map((ym) => ({ ym, created: 0, signed: 0, signedValue: 0 }));
  for (const p of projects) {
    const c = monthly.find((m) => m.ym === p.createdAt.toISOString().slice(0, 7));
    if (c) c.created++;
    if (stageRank(p.status) === 3) {
      const s = monthly.find((m) => m.ym === p.statusUpdatedAt.toISOString().slice(0, 7));
      if (s) {
        s.signed++;
        s.signedValue += p.price;
      }
    }
  }
  const sortDesc = <T extends { n: number }>(m: Map<string, T>, key: string) =>
    [...m.entries()].map(([k, v]) => ({ [key]: k, ...v })).sort((a: any, b: any) => b.n - a.n) as any[];
  return {
    total: projects.length,
    detailed: projects.filter((p) => p.detailed).length,
    inRange: scoped.length,
    proposed,
    contractsOut,
    signed,
    signedCount,
    closeRate: scoped.length ? signedCount / scoped.length : null,
    avgProposal: priced ? proposed / priced : null,
    avgDaysToSign: daysN ? daysSum / daysN : null,
    funnel,
    byStatus: sortDesc(byStatus, 'status'),
    byCategory: sortDesc(byCategory, 'category'),
    byRep: sortDesc(byRep, 'rep'),
    byCity: sortDesc(byCity, 'city').slice(0, 8),
    financing: [...financing.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    monthly,
    recent: [...projects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 15),
  };
}

/** Compact roll-up kept for the Integrations panel. */
export function artemisSummary(projects: ArtemisProject[]) {
  const a = artemisAnalytics(projects);
  return { count: a.total, proposed: a.proposed, sent: a.contractsOut, signed: a.signed, byStatus: a.byStatus.map((s) => [s.status, { n: s.n, value: s.value }] as [string, { n: number; value: number }]), recent: a.recent.slice(0, 8) };
}
