// Artemis -> JobNimbus + GoHighLevel sync. Used by the webhook (one project
// per event) and the one-time backfill (all projects, batched). Mirrors each
// Artemis project so nobody re-types it:
//   JobNimbus: contact (by phone/email) + ONE job per homeowner + scope
//              (Roofing / Windows), found by an "Artemis project:" marker in
//              the description or by contact+type, status moved forward only,
//              proposal price + link kept in the description.
//   GHL:       contact tagged artemis + artemis-<status>; on contract signed
//              the open opportunity gets the proposal value and is marked Won.
// RULES (updated 2026-09-04 per Levi):
//   - New PROPOSALS mirror as leads: JN contact + job (Estimating/Lead) and a
//     GHL opportunity in the matching service pipeline. No estimate yet.
//   - SIGNED contracts additionally rank the job sold, mark the opportunity
//     Won, and create the signed Approved estimate (Profit Tracker value).
//   - Guards keep practice runs out: staff homeowner records (email match, or
//     phone+name match) and test-looking names ("test", "no name", blank).
// Everything is best-effort and idempotent; failures are reported, never thrown.
import { fetchArtemisProject, lastArtemisStatus, type ArtemisProject } from './artemis';
import { jnFindContact, ghlFindContact, jnFindJobByMarker, jnFindJobsForContact, jnRemember } from './jn';
import { fetchJnSyncState, stampSyncState } from './kpi';

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const JN_BASE = 'https://app.jobnimbus.com/api1';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const ART_BASE = () => env('ARTEMIS_BASE') || 'https://sales-api.artemis.solar/external/v1';
const jnHeaders = () => ({ Authorization: `bearer ${env('JOBNIMBUS_API_KEY')}`, 'Content-Type': 'application/json', Accept: 'application/json' });
const ghlHeaders = () => ({ Authorization: `Bearer ${env('GHL_PIT')}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' });
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);

// ---- Internal (staff) detection ----
let staffMemo: { at: number; phones: Set<string>; emails: Set<string>; names: Set<string> } | null = null;
async function staff(): Promise<{ phones: Set<string>; emails: Set<string>; names: Set<string> }> {
  if (staffMemo && Date.now() - staffMemo.at < 10 * 60_000) return staffMemo;
  const phones = new Set<string>();
  const emails = new Set<string>();
  const names = new Set<string>();
  try {
    const res = await fetch(`${ART_BASE()}/users`, { headers: { 'x-api-key': env('ARTEMIS_API_KEY'), Accept: 'application/json' } });
    if (res.ok) {
      const d = await res.json();
      for (const u of d?.data || d || []) {
        if (u.phoneNumber) phones.add(digits(u.phoneNumber));
        if (u.email) emails.add(String(u.email).toLowerCase());
        const n = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
        if (n) names.add(n);
      }
    }
  } catch {
    /* no staff list: nothing is treated as internal */
  }
  staffMemo = { at: Date.now(), phones, emails, names };
  return staffMemo;
}
/**
 * True when the homeowner is actually a staff member (practice/test project).
 * A staff EMAIL on the homeowner is decisive. A staff PHONE alone is not:
 * reps sometimes put their own number on a real customer's homeowner record
 * (it blocked a signed $19,950 deal on 2026-09-02), so a phone match only
 * counts when the homeowner NAME is also a staff name.
 */
export async function isInternalProject(p: ArtemisProject): Promise<boolean> {
  const s = await staff();
  if (!!p.homeowner.email && s.emails.has(p.homeowner.email)) return true;
  const name = (p.homeowner.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return !!p.homeowner.phone && s.phones.has(p.homeowner.phone) && !!name && s.names.has(name);
}

// ---- Artemis status -> JobNimbus status (forward-only) ----
const JN_RANK: Record<string, number> = {
  'lead': 0, 'estimating': 1, 'appt scheduled': 1, 'pending customer sig.': 2,
  'sold ready to measure': 3, 'sold/awaiting scheduling': 3,
  'windows ordered': 4, 'windows scheduled to be received': 5, 'windows received': 6, 'install scheduled': 7,
  'roof in progress': 7, 'install complete': 8, 'roof complete awaiting funding': 8, 'job complete': 9, 'closed - paid': 10,
};
function targetJnStatus(artemisStatus: string, jnType: string, eventName = ''): string | null {
  // A manual push (or a contract-signed webhook) means the deal is signed even
  // when the Artemis STATUS still lags at Contract Sent (rep signed outside
  // Artemis): rank it as sold, not pending.
  const s = /contract[-_ ]?signed/i.test(eventName) ? 'contract signed' : artemisStatus.toLowerCase();
  if (/contract signed|signed/.test(s)) return jnType === 'Windows' ? 'Sold Ready To Measure' : 'Sold/Awaiting Scheduling';
  if (/contract sent|change order/.test(s)) return 'Pending Customer Sig.';
  if (/proposal (created|sent)|project created|project updated|site survey/.test(s)) return 'Estimating';
  return null;
}
function jnTypeFor(p: ArtemisProject): string | null {
  const c = p.categories.map((x) => x.toLowerCase());
  if (c.some((x) => x.includes('roof'))) return 'Roofing';
  if (c.some((x) => x.includes('window') || x.includes('door'))) return 'Windows';
  return null;
}
const marker = (id: string) => `Artemis project: ${id}`;

// JobNimbus "Contract Amount" job custom field (Number). On a signed contract we
// stamp the Artemis price here too, so the sold price sits in one uniform,
// API-readable column across Artemis and manual deals (Profit Tracker planned
// revenue is not exposed by any JobNimbus API). Code is stable per account.
const JN_CONTRACT_AMOUNT_CF = 'cf_long_3';

// ---- Artemis id -> JobNimbus ids map (GHL custom value) ----
const MAP_CV = 'Artemis JobNimbus Map JSON';
type SyncMap = Record<string, { contact: string; job?: string; status?: string }>;
export async function loadSyncMap(): Promise<{ map: SyncMap; id: string | null } | null> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return null;
  try {
    const res = await fetch(`${GHL_BASE}/locations/${loc}/customValues`, { headers: ghlHeaders() });
    if (!res.ok) return null;
    const cv = ((await res.json())?.customValues || []).find((c: any) => c?.name === MAP_CV);
    if (!cv) return { map: {}, id: null };
    try {
      const parsed = JSON.parse(cv.value || '{}');
      return { map: parsed && typeof parsed === 'object' ? parsed : {}, id: cv.id };
    } catch {
      return { map: {}, id: cv.id };
    }
  } catch {
    return null;
  }
}
export async function saveSyncMap(map: SyncMap, id: string | null): Promise<string | null> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return id;
  const body = JSON.stringify({ name: MAP_CV, value: JSON.stringify(map) });
  try {
    const res = await fetch(id ? `${GHL_BASE}/locations/${loc}/customValues/${id}` : `${GHL_BASE}/locations/${loc}/customValues`, {
      method: id ? 'PUT' : 'POST',
      headers: ghlHeaders(),
      body,
    });
    if (!id && res.ok) return (await res.json())?.customValue?.id ?? null;
  } catch {
    /* best-effort */
  }
  return id;
}

export interface ArtemisSyncResult {
  project: ArtemisProject | null;
  internal: boolean;
  jn: string;
  ghl: string;
}

/** Webhook entry: fetch the project, then sync. */
export async function syncArtemisProject(projectId: string, eventName: string): Promise<ArtemisSyncResult> {
  const project = await fetchArtemisProject(projectId);
  if (!project) return { project: null, internal: false, jn: `project not readable from Artemis (HTTP ${lastArtemisStatus || 'n/a'})`, ghl: '' };
  const store = await loadSyncMap();
  const r = await syncArtemisProjectData(project, eventName, store?.map ?? {});
  if (store) await saveSyncMap(store.map, store.id);
  return r;
}

/**
 * Daily alert: Artemis contracts sitting at "Contract Sent" past minAgeHours.
 * These are deals where the contract went out for signature and hasn't been
 * moved to Contract Signed, which is exactly how sold deals slip through
 * (Greg Ruiz, Maria Dolores, Alexis Tinoco). Posts a Discord digest so Eric can
 * mark the signed ones (which then auto-sync to JobNimbus as Sold).
 */
export async function artemisStuckContractsAlert(minAgeHours = 24, minPrice = 1000, maxAgeDays = 14): Promise<{ count: number; stuck: { name: string; price: number; rep: string; ageHours: number; url: string }[] }> {
  if (!env('ARTEMIS_API_KEY')) return { count: 0, stuck: [] };
  const items: any[] = [];
  try {
    for (let page = 1; page <= 8; page++) {
      const r = await fetch(`${ART_BASE()}/projects?page=${page}&pageSize=100`, { headers: { 'x-api-key': env('ARTEMIS_API_KEY'), Accept: 'application/json' } });
      if (!r.ok) break;
      const d = await r.json();
      const a = d?.data || [];
      items.push(...a);
      if (a.length < 100) break;
    }
  } catch {
    return { count: 0, stuck: [] };
  }

  // JobNimbus job status per Artemis project (by marker), so contracts already
  // reflected as Sold/in-production in JobNimbus are not re-flagged.
  const jnStatusByMarker = new Map<string, string>();
  try {
    const jr = await fetch(`${JN_BASE}/jobs?size=1000`, { headers: jnHeaders() });
    if (jr.ok) {
      for (const j of (await jr.json())?.results || []) {
        if (j.is_active === false) continue;
        const m = String(j.description || '').match(/Artemis project: (\S+)/);
        if (m) jnStatusByMarker.set(m[1], String(j.status_name || ''));
      }
    }
  } catch {
    /* no JN data: fall back to flagging by Artemis status alone */
  }
  const jnAlreadyClosed = (id: string): boolean => {
    const s = (jnStatusByMarker.get(id) || '').toLowerCase();
    return /sold|install|complete|ordered|received|measurements|progress|closed|funding|won/.test(s);
  };

  const now = Date.now();
  // Prefilter on list data (status + age + not-already-sold-in-JN) before the
  // expensive per-project detail fetches.
  const candidates = items.filter((it) => {
    if (!/contract\s*sent/i.test(String(it.status || ''))) return false;
    const age = now - new Date(it.lastStatusUpdatedAt || it.updatedAt || 0).getTime();
    // 24h to maxAgeDays: recent enough to be a live/just-closed deal. Older
    // Contract Sent projects are stale (never signed, never followed up).
    if (age < minAgeHours * 3600000 || age > maxAgeDays * 86400000) return false;
    return !jnAlreadyClosed(String(it.id));
  });

  const stuck: { name: string; price: number; rep: string; ageHours: number; url: string }[] = [];
  const deadline = Date.now() + 40_000; // wall-clock budget: never risk the 60s function limit
  for (const it of candidates.slice(0, 40)) {
    if (Date.now() > deadline) break;
    const p = await fetchArtemisProject(it.id);
    if (!p || (await isInternalProject(p)) || looksLikeTest(p)) continue;
    if (p.price < minPrice) continue; // skip $184-style placeholder prices
    const at = new Date(it.lastStatusUpdatedAt || it.updatedAt || 0).getTime();
    stuck.push({ name: p.homeowner.name || p.name, price: p.price, rep: p.rep, ageHours: Math.round((now - at) / 3600000), url: p.proposalUrl });
    await new Promise((s) => setTimeout(s, 200));
  }
  stuck.sort((a, b) => a.ageHours - b.ageHours);

  if (stuck.length) {
    const webhook = env('DISCORD_WEBHOOK');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Artemis contracts',
            embeds: [
              {
                title: `${stuck.length} contract${stuck.length > 1 ? 's' : ''} awaiting signature (Contract Sent, ${minAgeHours}h to ${maxAgeDays}d)`,
                color: 0xf6871f,
                description:
                  stuck
                    .map((s) => `**${s.name}** ${s.price ? money(s.price) : ''}${s.rep ? ` · ${s.rep}` : ''} · ${s.ageHours}h\n${s.url}`)
                    .join('\n\n')
                    .slice(0, 3800) + '\n\nIf signed, mark **Contract Signed** in Artemis and it syncs to JobNimbus as Sold automatically.',
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch {
        /* best-effort */
      }
    }
  }
  return { count: stuck.length, stuck };
}

export interface ArtemisProposalSyncResult {
  ok: boolean;
  synced: { name: string; jn: string }[];
  note?: string;
}

/**
 * Poll Artemis for recent projects (proposals + contracts) and mirror any not
 * yet in JobNimbus. Artemis does not reliably fire a webhook on proposal
 * creation, so this catches new proposals the same way the GHL poll catches new
 * leads. Signed projects sync as sold; unsigned as leads (Estimating). Bounded
 * by lookback + per-run cap so it fits a serverless invocation; the test/staff
 * guards inside syncArtemisProjectData keep practice runs out.
 */
export async function runArtemisProposalSync(
  force = false,
  opts: { lookbackDays?: number; maxPerRun?: number; minIntervalMinutes?: number } = {},
): Promise<ArtemisProposalSyncResult> {
  if (!env('ARTEMIS_API_KEY')) return { ok: false, synced: [], note: 'Artemis not connected' };
  const state = await fetchJnSyncState();
  const throttle = opts.minIntervalMinutes ?? 15;
  if (!force && state && throttle > 0 && state.state.lastArtemisProposalSyncAt && Date.now() - state.state.lastArtemisProposalSyncAt < throttle * 60000) {
    return { ok: true, synced: [], note: 'throttled' };
  }

  // Project list (cheap: no per-project detail).
  const items: any[] = [];
  try {
    for (let page = 1; page <= 8; page++) {
      const r = await fetch(`${ART_BASE()}/projects?page=${page}&pageSize=100`, { headers: { 'x-api-key': env('ARTEMIS_API_KEY'), Accept: 'application/json' } });
      if (!r.ok) break;
      const d = await r.json();
      const a = d?.data || [];
      items.push(...a);
      if (a.length < 100) break;
    }
  } catch {
    return { ok: false, synced: [], note: 'Artemis list error' };
  }

  const cutoff = Date.now() - (opts.lookbackDays ?? 21) * 86400000;
  const recent = items
    .filter((it) => new Date(it.updatedAt || it.lastStatusUpdatedAt || 0).getTime() >= cutoff)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

  const store = await loadSyncMap();
  const map = store?.map ?? {};
  const cap = opts.maxPerRun ?? (force ? 20 : 8);
  const synced: { name: string; jn: string }[] = [];
  let processed = 0;
  for (const it of recent) {
    if (processed >= cap) break;
    // Already mirrored? Check the persisted sync map first (reliable, no
    // propagation lag), then the JobNimbus marker.
    if (map[it.id]?.job) continue;
    if (await jnFindJobByMarker(marker(it.id))) continue;
    const p = await fetchArtemisProject(it.id);
    if (!p) continue;
    processed++;
    // '' event: isSigned is driven by the project's real status (proposal ->
    // Estimating lead; signed -> sold + estimate).
    const res = await syncArtemisProjectData(p, '', map);
    if (!res.internal && !/skipped|failed|error/.test(res.jn)) synced.push({ name: p.homeowner.name || p.name, jn: res.jn });
    await new Promise((s) => setTimeout(s, 300));
  }
  if (store) await saveSyncMap(map, store.id);
  await stampSyncState({ lastArtemisProposalSyncAt: Date.now() }).catch(() => {});

  if (synced.length) {
    const webhook = env('DISCORD_WEBHOOK');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Artemis -> JobNimbus',
            embeds: [{ title: `${synced.length} Artemis proposal${synced.length > 1 ? 's' : ''} pushed to JobNimbus`, color: 0x255188, description: synced.map((s) => `**${s.name}**: ${s.jn}`).join('\n').slice(0, 3900), timestamp: new Date().toISOString() }],
          }),
        });
      } catch {
        /* best-effort */
      }
    }
  }
  return { ok: true, synced };
}

/**
 * Sync one already-fetched project. `map` is mutated (caller persists it).
 * Internal test projects are skipped.
 */
/** Only signed contracts leave Artemis: proposals are often drafts or practice runs. */
export const isSigned = (p: ArtemisProject, eventName = ''): boolean =>
  /signed|approved|installed|complete|closed|won/i.test(p.status) || /contract[-_ ]?signed/i.test(eventName);

/** Practice/test proposals: blank, "No Name", or "test" in the homeowner name. */
const looksLikeTest = (p: ArtemisProject): boolean => {
  const n = (p.homeowner.name || '').toLowerCase().trim();
  return !n || n === 'no name' || /\btest\b/.test(n);
};

export async function syncArtemisProjectData(p: ArtemisProject, eventName: string, map: SyncMap): Promise<ArtemisSyncResult> {
  if (await isInternalProject(p)) return { project: p, internal: true, jn: 'skipped (staff test project)', ghl: 'skipped' };
  if (!isSigned(p, eventName)) {
    // Proposal stage: still mirrors as a LEAD (JN job + GHL pipeline
    // opportunity), but with extra test guards since unsigned projects are
    // where practice runs live.
    if (looksLikeTest(p)) return { project: p, internal: true, jn: 'skipped (test-looking name)', ghl: 'skipped' };
    if (!p.homeowner.phone && !p.homeowner.email) return { project: p, internal: false, jn: 'skipped (no homeowner contact info)', ghl: 'skipped' };
  }
  const [jn, ghl] = await Promise.all([syncToJobNimbus(p, eventName, map), syncToGhl(p, eventName)]);
  return { project: p, internal: false, jn, ghl };
}

// ---- JobNimbus sales-rep matching (Artemis rep email -> JN user) ----
// JN users come from /api1/account/users. We match the Artemis rep to a JN
// user by email (case-insensitive), then fall back to full-name match. The
// matched JN user id goes on the job's `owners` + `sales_rep`, so the rep who
// wrote the proposal in Artemis is the assigned rep in JobNimbus.
let jnUsersMemo: { at: number; byEmail: Map<string, string>; byName: Map<string, string> } | null = null;
async function jnUsers(): Promise<{ byEmail: Map<string, string>; byName: Map<string, string> }> {
  if (jnUsersMemo && Date.now() - jnUsersMemo.at < 10 * 60_000) return jnUsersMemo;
  const byEmail = new Map<string, string>();
  const byName = new Map<string, string>();
  try {
    const res = await fetch(`${JN_BASE}/account/users`, { headers: jnHeaders() });
    if (res.ok) {
      for (const u of (await res.json())?.users || []) {
        if (u.is_active === false || !u.id) continue;
        if (u.email) byEmail.set(String(u.email).trim().toLowerCase(), u.id);
        const n = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().replace(/\s+/g, ' ').trim();
        if (n) byName.set(n, u.id);
      }
    }
  } catch {
    /* no users: reps just stay unassigned */
  }
  jnUsersMemo = { at: Date.now(), byEmail, byName };
  return jnUsersMemo;
}
/** JN user id for an Artemis project's rep, or null when no rep matches. */
async function jnRepId(p: ArtemisProject): Promise<string | null> {
  const u = await jnUsers();
  if (p.repEmail && u.byEmail.has(p.repEmail)) return u.byEmail.get(p.repEmail)!;
  const name = (p.rep || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (name && u.byName.has(name)) return u.byName.get(name)!;
  return null;
}

// The one shared JN catalog product every Artemis contract estimate rides on
// (JN's v2 estimates endpoint rejects custom line items). Found or created
// once, then memoized for the process lifetime.
let artemisProductMemo: string | null = null;
async function jnEnsureArtemisProduct(): Promise<string | null> {
  if (artemisProductMemo) return artemisProductMemo;
  try {
    const lr = await fetch(`${JN_BASE}/v2/products?size=100`, { headers: jnHeaders() });
    if (lr.ok) {
      const found = ((await lr.json())?.results || []).find((x: any) => x.name === 'Artemis Signed Contract' && x.is_active !== false);
      if (found?.jnid) return (artemisProductMemo = found.jnid);
    }
    const cr = await fetch(`${JN_BASE}/v2/products`, {
      method: 'POST',
      headers: jnHeaders(),
      body: JSON.stringify({
        name: 'Artemis Signed Contract',
        item_type: 'material',
        description: 'Signed contract value synced from Artemis',
        uoms: [{ uom: 'EA', material: { cost: 0, price: 0 } }],
      }),
    });
    if (cr.ok) return (artemisProductMemo = (await cr.json())?.jnid || null);
  } catch {
    /* fall through */
  }
  return null;
}

async function syncToJobNimbus(p: ArtemisProject, eventName: string, map: SyncMap): Promise<string> {
  if (!env('JOBNIMBUS_API_KEY')) return 'JobNimbus not connected';
  const parts: string[] = [];
  try {
    const entry = map[p.id];

    // Contact
    let contactId = entry?.contact || (await jnFindContact(p.homeowner.phone, p.homeowner.email));
    if (!contactId) {
      if (!p.homeowner.phone && !p.homeowner.email) return 'skipped (no homeowner contact info)';
      const [first, ...rest] = (p.homeowner.name || 'Artemis Homeowner').split(/\s+/);
      const body = {
        first_name: first,
        last_name: rest.join(' '),
        display_name: p.homeowner.name || 'Artemis Homeowner',
        record_type_name: 'Customer',
        status_name: 'New',
        mobile_phone: p.homeowner.phone,
        email: p.homeowner.email,
        address_line1: p.street,
        city: p.city,
        state_text: 'CA',
        zip: p.zip,
      };
      // "Artemis" as the JN Lead Source once it exists in JN Settings; JN
      // 400s unknown sources, so fall back to creating without one.
      let res = await fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify({ ...body, source_name: 'Artemis' }) });
      if (!res.ok) res = await fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(body) });
      if (!res.ok) {
        // JN rejects a duplicate display name; disambiguate and retry.
        const tag = p.city || digits(p.homeowner.phone).slice(-4) || String(Date.now()).slice(-4);
        const uniqueBody = { ...body, display_name: `${p.homeowner.name || 'Artemis Homeowner'} (${tag})` };
        res = await fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify({ ...uniqueBody, source_name: 'Artemis' }) });
        if (!res.ok) res = await fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(uniqueBody) });
      }
      if (!res.ok) return `contact failed (${res.status})`;
      const created = await res.json();
      contactId = created?.jnid || null;
      if (contactId) jnRemember('contacts', { ...body, jnid: contactId });
      parts.push('new contact');
    } else parts.push('contact matched');
    if (!contactId) return 'contact failed';

    const jnType = jnTypeFor(p);
    // Assign the JobNimbus sales rep that matches the Artemis rep (by email,
    // then name). null when the rep has no JobNimbus user.
    const repId = await jnRepId(p);
    const desc = [
      marker(p.id),
      `Artemis proposal: ${p.proposalUrl}`,
      `Artemis status: ${p.status}${p.price ? ` | Proposal ${money(p.price)}` : ''}${p.financier ? ` | Financing: ${p.financier}${p.financeStatus ? ' (' + p.financeStatus + ')' : ''}` : ''}`,
      `Scope: ${p.categories.join(', ') || 'n/a'}${p.rep ? ` | Rep: ${p.rep}` : ''}${p.street ? ` | ${p.street}, ${p.city} ${p.zip}` : ''}`,
      `Last event: ${eventName} (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
    ].join('\n');

    // Job: mapped -> marker match -> same contact+type -> create.
    let jobId = entry?.job;
    let curStatus = '';
    if (jobId) {
      // Validate the mapped job still belongs to THIS project (self-heals a
      // stale map: on 9/4 two same-customer projects briefly shared one job).
      const cur = await fetch(`${JN_BASE}/jobs/${jobId}`, { headers: jnHeaders() });
      const j = cur.ok ? await cur.json() : null;
      if (!j || j.is_active === false || !String(j.description || '').includes(marker(p.id))) {
        jobId = undefined;
        parts.push('mapped job stale, re-resolving');
      } else curStatus = String(j.status_name || '');
    }
    if (!jobId) {
      const byMarker = await jnFindJobByMarker(marker(p.id));
      if (byMarker) {
        jobId = byMarker.jnid;
        curStatus = byMarker.status;
        parts.push('job matched by marker');
      } else if (jnType) {
        // Never adopt a job that belongs to a DIFFERENT Artemis project: the
        // same customer can sign contracts on two properties (Estrada 9/2-9/4).
        const same = (await jnFindJobsForContact(contactId, jnType)).filter(
          (j) => !j.desc.includes('Artemis project: ') || j.desc.includes(marker(p.id)),
        );
        if (same.length) {
          jobId = same[0].jnid;
          curStatus = same[0].status;
          parts.push(`linked to existing ${jnType} job`);
        }
      }
    }
    if (!jobId && jnType) {
      const status = targetJnStatus(p.status, jnType, eventName) || 'Lead';
      // Job-level address: the board card shows the JOB's address, not the contact's.
      const body = { name: `${p.homeowner.name || p.name} - ${jnType}`, record_type_name: jnType, status_name: status, primary: { id: contactId }, description: desc, address_line1: p.street, city: p.city, state_text: 'CA', zip: p.zip, ...(repId ? { owners: [{ id: repId }], sales_rep: repId } : {}), ...(isSigned(p, eventName) && p.price > 0 ? { [JN_CONTRACT_AMOUNT_CF]: p.price } : {}) };
      // JN requires unique job names: a second property for the same customer
      // gets the street appended. Attempt order: base -> +street -> +street @ Lead.
      const attempts: { name: string; status_name: string; source_name?: string }[] = [
        { name: body.name, status_name: status },
        ...(p.street ? [{ name: `${body.name} - ${p.street}`, status_name: status }] : []),
        ...(status !== 'Lead' ? [{ name: p.street ? `${body.name} - ${p.street}` : body.name, status_name: 'Lead' }] : []),
      ];
      // Each attempt first tries with the "Artemis" Lead Source (JN 400s
      // sources missing from Settings, hence the sourceless twin).
      const withSource = attempts.flatMap((a) => [{ ...a, source_name: 'Artemis' }, a]);
      let res: Response | null = null;
      let used = withSource[0];
      for (const a of withSource) {
        used = a;
        res = await fetch(`${JN_BASE}/jobs`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify({ ...body, ...a }) });
        if (res.ok) break;
      }
      if (res?.ok) {
        jobId = (await res.json())?.jnid;
        if (jobId) jnRemember('jobs', { ...body, ...used, jnid: jobId, is_active: true });
        parts.push(`new ${jnType} job (${used.status_name}${used.status_name !== status ? `, ${status} not on board` : ''})${repId ? `, rep ${p.rep}` : ''}`);
      } else parts.push(`job create failed (${res?.status})`);
    } else if (jobId) {
      // Fetch the current job once (status + existing owner).
      let curJob: any = null;
      if (!curStatus) {
        const cur = await fetch(`${JN_BASE}/jobs/${jobId}`, { headers: jnHeaders() });
        curJob = cur.ok ? await cur.json() : null;
        curStatus = String(curJob?.status_name || '');
      }
      const target = jnType ? targetJnStatus(p.status, jnType, eventName) : null;
      const body: Record<string, unknown> = { description: desc };
      if (p.street) Object.assign(body, { address_line1: p.street, city: p.city, state_text: 'CA', zip: p.zip });
      if (target && (JN_RANK[target.toLowerCase()] ?? 0) > (JN_RANK[curStatus.toLowerCase()] ?? 0)) body.status_name = target;
      // Assign the rep only when the job has no owner yet, so a manual
      // reassignment in JobNimbus is never overwritten by a later webhook.
      const hasOwner = Array.isArray(curJob?.owners) && curJob.owners.length > 0;
      if (repId && !hasOwner) { body.owners = [{ id: repId }]; body.sales_rep = repId; parts.push(`rep ${p.rep}`); }
      // Stamp the sold price into Contract Amount on signed contracts (only when
      // empty, so a manual edit in JobNimbus is never overwritten).
      if (isSigned(p, eventName) && p.price > 0 && !Number(curJob?.[JN_CONTRACT_AMOUNT_CF] || 0)) body[JN_CONTRACT_AMOUNT_CF] = p.price;
      let up = await fetch(`${JN_BASE}/jobs/${jobId}`, { method: 'PUT', headers: jnHeaders(), body: JSON.stringify(body) });
      if (!up.ok && body.status_name) {
        // Status not valid on this board: keep the status, still refresh the description.
        delete body.status_name;
        up = await fetch(`${JN_BASE}/jobs/${jobId}`, { method: 'PUT', headers: jnHeaders(), body: JSON.stringify(body) });
        parts.push(up.ok ? 'job updated (status kept, target not on board)' : `job update failed (${up.status})`);
      } else parts.push(up.ok ? (body.status_name ? `job -> ${body.status_name}` : 'job updated') : `job update failed (${up.status})`);
    } else parts.push('no job (scope not roofing/windows)');

    // Approved estimate = Profit Tracker "planned revenue". Created once per
    // Artemis project (marker inside the line item), only after signature and
    // only when a real price exists. Never touched again after creation, so
    // anything ops edits in JobNimbus stays authoritative. JN only accepts
    // estimate creation on api1/v2 and only with CATALOG line items, so the
    // value rides on a shared "Artemis Signed Contract" product with a
    // per-estimate price override (verified live 2026-09-04, estimate #1106).
    if (jobId && p.price > 0 && isSigned(p, eventName)) {
      try {
        const er = await fetch(`${JN_BASE}/estimates?size=1000`, { headers: jnHeaders() });
        const rows: any[] = er.ok ? (await er.json())?.results || [] : [];
        const exists = rows.some(
          (e) =>
            e.is_active !== false &&
            (e.related || []).some((r: any) => r.id === jobId) &&
            (e.items || []).some((i: any) => String(i.description || i.name || '').includes(marker(p.id))),
        );
        if (!exists) {
          const productId = await jnEnsureArtemisProduct();
          if (!productId) parts.push('estimate skipped (no catalog product)');
          else {
            const body = {
              related: [{ id: jobId }, { id: contactId }],
              status_name: 'Approved',
              // Profit Tracker only imports FULLY SIGNED estimates, and this
              // estimate only exists because the Artemis contract IS signed.
              signature_status: 'Signed',
              date_signed: Math.floor(Date.now() / 1000),
              date_estimate: Math.floor(Date.now() / 1000),
              items: [
                {
                  jnid: productId,
                  name: 'Artemis Signed Contract',
                  description: `${marker(p.id)}. Signed contract value synced from Artemis (${p.categories.join(', ') || 'project'}).`,
                  quantity: 1,
                  price: p.price,
                  cost: 0,
                  uom: 'EA',
                  item_type: 'material',
                },
              ],
            };
            const res = await fetch(`${JN_BASE}/v2/estimates`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(body) });
            parts.push(res.ok ? `approved estimate ${money(p.price)} (Profit Tracker planned revenue)` : `estimate create failed (${res.status})`);
          }
        }
      } catch {
        parts.push('estimate check failed');
      }
    }

    map[p.id] = { contact: contactId, job: jobId, status: p.status };
    return parts.join(', ');
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

// GHL pipelines, cached per process. Routing matches website leads (lead.ts):
// roofing -> "Roofing" pipeline, windows -> "Window", else the
// "Home Improvement"/"Lead" catch-all.
let ghlPipeMemo: { at: number; rows: any[] } | null = null;
async function ghlPipelines(): Promise<any[]> {
  if (ghlPipeMemo && Date.now() - ghlPipeMemo.at < 5 * 60_000) return ghlPipeMemo.rows;
  try {
    const res = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(env('GHL_LOCATION_ID'))}`, { headers: ghlHeaders() });
    if (!res.ok) return ghlPipeMemo?.rows ?? [];
    ghlPipeMemo = { at: Date.now(), rows: (await res.json())?.pipelines || [] };
    return ghlPipeMemo.rows;
  } catch {
    return ghlPipeMemo?.rows ?? [];
  }
}
function pickGhlPipeline(pipelines: any[], service: string): { pipelineId: string; stageId: string } | null {
  if (!pipelines?.length) return null;
  const find = (kw: string) => pipelines.find((x) => (x?.name || '').toLowerCase().includes(kw));
  let pl: any = null;
  if (service === 'roofing') pl = find('roofing') || find('roof');
  else if (service === 'windows') pl = find('window');
  else if (service === 'insulation') pl = find('insulation') || find('insul');
  if (!pl) pl = find('home improvement') || find('lead');
  if (!pl?.stages?.length) return null;
  const stage = [...pl.stages].sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))[0];
  return stage?.id ? { pipelineId: pl.id, stageId: stage.id } : null;
}
function serviceOf(p: ArtemisProject): string {
  const c = p.categories.join(' ').toLowerCase();
  if (c.includes('roof')) return 'roofing';
  if (c.includes('window')) return 'windows';
  if (c.includes('insul')) return 'insulation';
  return 'home improvement';
}

async function syncToGhl(p: ArtemisProject, eventName: string): Promise<string> {
  if (!env('GHL_PIT') || !env('GHL_LOCATION_ID')) return 'GHL not connected';
  try {
    const parts: string[] = [];
    const service = serviceOf(p);
    const signed = isSigned(p, eventName);

    // Contact: match by phone/email, create when new (Artemis is the original
    // source only for contacts born here; existing contacts keep theirs).
    let contactId = await ghlFindContact(p.homeowner.phone, p.homeowner.email);
    if (!contactId) {
      const [first, ...rest] = (p.homeowner.name || 'Artemis Homeowner').split(/\s+/);
      const res = await fetch(`${GHL_BASE}/contacts/`, {
        method: 'POST',
        headers: ghlHeaders(),
        body: JSON.stringify({
          locationId: env('GHL_LOCATION_ID'),
          firstName: first,
          lastName: rest.join(' '),
          phone: p.homeowner.phone ? `+1${p.homeowner.phone}` : undefined,
          email: p.homeowner.email || undefined,
          address1: p.street || undefined,
          city: p.city || undefined,
          state: 'CA',
          postalCode: p.zip || undefined,
          source: 'Artemis proposal',
          // Artemis collects no SMS consent: block marketing texts (A2P).
          dndSettings: { SMS: { status: 'active', message: 'No SMS consent on record (Artemis proposal)', code: '' } },
        }),
      });
      if (res.ok) {
        contactId = (await res.json())?.contact?.id || null;
        parts.push('new contact');
      } else parts.push(`contact create failed (${res.status})`);
    }
    if (!contactId) return parts.join(', ') || 'no contact';

    const tags = ['artemis', `artemis-${slug(p.status)}`, slug(service)];
    const t = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, { method: 'POST', headers: ghlHeaders(), body: JSON.stringify({ tags }) });
    parts.push(t.ok ? `tagged ${tags[1]}` : 'tag failed');

    // Opportunity: reuse the contact's open one; otherwise create it in the
    // matching service pipeline (first stage) so proposals land in sales.
    const res = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${encodeURIComponent(env('GHL_LOCATION_ID'))}&contact_id=${encodeURIComponent(contactId)}&limit=20`,
      { headers: ghlHeaders() },
    );
    const opps: any[] = res.ok ? (await res.json())?.opportunities || [] : [];
    const open = opps.find((o) => String(o.status).toLowerCase() === 'open') || opps[0];
    if (!open) {
      const pipe = pickGhlPipeline(await ghlPipelines(), service);
      if (!pipe) {
        parts.push('no pipeline found');
        return parts.join(', ');
      }
      const create = await fetch(`${GHL_BASE}/opportunities/`, {
        method: 'POST',
        headers: ghlHeaders(),
        body: JSON.stringify({
          locationId: env('GHL_LOCATION_ID'),
          pipelineId: pipe.pipelineId,
          pipelineStageId: pipe.stageId,
          contactId,
          name: `${p.homeowner.name || 'Artemis Homeowner'} - ${service}`,
          status: signed ? 'won' : 'open',
          monetaryValue: p.price > 0 ? p.price : undefined,
          source: 'Artemis',
        }),
      });
      parts.push(create.ok ? `opportunity created in ${service} pipeline${signed ? ', Won' : ''}${p.price > 0 ? ` @ ${money(p.price)}` : ''}` : `opportunity create failed (${create.status})`);
      return parts.join(', ');
    }
    if (signed || p.price > 0) {
      const body: Record<string, unknown> = {};
      if (p.price > 0) body.monetaryValue = p.price;
      if (signed) body.status = 'won';
      const up = await fetch(`${GHL_BASE}/opportunities/${open.id}`, { method: 'PUT', headers: ghlHeaders(), body: JSON.stringify(body) });
      parts.push(up.ok ? (signed ? `opportunity Won @ ${money(p.price)}` : `opportunity value ${money(p.price)}`) : 'opportunity update failed');
    }
    return parts.join(', ');
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}
