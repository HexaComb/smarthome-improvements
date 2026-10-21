// JobNimbus integration (server-side only). Key comes from the
// JOBNIMBUS_API_KEY env var and is never committed.
//   - lead push:   jnPushLead() called from /api/lead
//   - review sync: runJnSync() called from /api/jn-sync (cron) + /api/jn-webhook
import { fetchJnJobs, fetchJnSyncState, saveJnSyncState, stampSyncState, type JnJob } from './kpi';
import { sendMetaConversion, metaReady } from './metaCapi';
import { fetchArtemisProject } from './artemis';

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

const JN_BASE = 'https://app.jobnimbus.com/api1';
const GHL_BASE = 'https://services.leadconnectorhq.com';

const jnHeaders = () => ({
  Authorization: `bearer ${env('JOBNIMBUS_API_KEY')}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});
const ghlHeaders = () => ({
  Authorization: `Bearer ${env('GHL_PIT')}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

export const jnReady = () => env('JOBNIMBUS_API_KEY').length > 0;

/** Last 10 digits, for phone matching across systems. */
export const digits = (s: string) => (s || '').replace(/\D/g, '').slice(-10);

// JobNimbus job record types that exist in the account. Services without a
// matching type still get the contact, just no job record.
const JN_JOB_TYPE: Record<string, string> = { windows: 'Windows', roofing: 'Roofing' };

// JN Lead Sources treated as "online" -> the job lands in the "Online Leads"
// board column instead of "Lead". Everything else (Canvassing, Referral,
// Self Generated, phone) stays in "Lead".
const ONLINE_SOURCES = new Set(['Facebook', 'Instagram', 'TikTok', 'Google Ads', 'Google Organic', 'Google Business Profile', 'Bing', 'Website']);

// GHL "Street address" custom field id (contact.street_address, shown under
// General Info). Some leads carry the address here instead of the standard
// address1 field, so the mirror reads whichever has data.
const GHL_STREET_CF = 'NqjOCPe5oHVtjXx4zIr9';
const ghlCustomStreet = (c: any): string =>
  String((Array.isArray(c?.customFields) ? c.customFields.find((f: any) => f.id === GHL_STREET_CF)?.value : '') || '');

// Short-lived memo of the JN contact and job lists so bulk operations (the
// Artemis backfill) do not re-download 1000 records per project. TTL is kept
// BELOW the 60s lead-poll cron interval so a warm serverless container never
// serves a stale list to the next run (that staleness created duplicate leads).
let contactsMemo: { at: number; rows: any[] } | null = null;
let jobsMemo: { at: number; rows: any[] } | null = null;
const MEMO_MS = 30_000;
/** Drop the memo so the next lookup re-fetches (call right after a create). */
function invalidateJnMemo(kind?: 'contacts' | 'jobs'): void {
  if (!kind || kind === 'contacts') contactsMemo = null;
  if (!kind || kind === 'jobs') jobsMemo = null;
}
async function jnList(kind: 'contacts' | 'jobs'): Promise<any[]> {
  const memo = kind === 'contacts' ? contactsMemo : jobsMemo;
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.rows;
  try {
    const res = await fetch(`${JN_BASE}/${kind}?size=1000`, { headers: jnHeaders() });
    if (!res.ok) return memo?.rows ?? [];
    const rows = (await res.json())?.results || [];
    if (kind === 'contacts') contactsMemo = { at: Date.now(), rows };
    else jobsMemo = { at: Date.now(), rows };
    return rows;
  } catch {
    return memo?.rows ?? [];
  }
}
/** Register a record created during this run so later lookups see it. */
export function jnRemember(kind: 'contacts' | 'jobs', row: any): void {
  const memo = kind === 'contacts' ? contactsMemo : jobsMemo;
  if (memo) memo.rows.unshift(row);
}

/** Find an existing JobNimbus contact by phone (preferred) or email. */
export async function jnFindContact(phone: string, email: string): Promise<string | null> {
  const p = digits(phone);
  const e = (email || '').trim().toLowerCase();
  if (!p && !e) return null;
  for (const c of await jnList('contacts')) {
    if (p && [c.mobile_phone, c.home_phone, c.work_phone].some((x: string) => digits(x) === p)) return c.jnid;
    if (e && (c.email || '').trim().toLowerCase() === e) return c.jnid;
  }
  return null;
}

/** Find a JN job whose description carries a marker (e.g. an Artemis project id). */
export async function jnFindJobByMarker(marker: string): Promise<{ jnid: string; status: string } | null> {
  for (const j of await jnList('jobs')) {
    if (j.is_active === false) continue;
    if (String(j.description || '').includes(marker)) return { jnid: j.jnid, status: String(j.status_name || '') };
  }
  return null;
}

/** Active jobs of a type whose primary contact is the given JN contact. */
export async function jnFindJobsForContact(contactId: string, type: string): Promise<{ jnid: string; status: string; desc: string }[]> {
  const out: { jnid: string; status: string; desc: string }[] = [];
  for (const j of await jnList('jobs')) {
    if (j.is_active === false) continue;
    if (j.primary?.id === contactId && String(j.record_type_name) === type) out.push({ jnid: j.jnid, status: String(j.status_name || ''), desc: String(j.description || '') });
  }
  return out;
}

export interface JnLead {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  zip: string;
  service: string; // free-form service value from the form
  bucket: string; // roofing | windows | insulation | general
  source: string; // lead_source
  message: string;
  // JN "Lead Source" (Settings-configured list: Facebook, Website, Google Ads,
  // ...). Set on the contact + job when JN accepts it; unknown names fall back
  // to no source (JN 400s values missing from Settings), and the readable
  // source always stays in the job description either way.
  jnSource?: string;
  // How the lead reached us, for the job description ("Website lead via ..." by
  // default; the GHL bridge passes "GoHighLevel lead via Facebook", etc.).
  origin?: string;
  // Idempotency marker (e.g. "GHL contact <id>"): when set, a job already
  // carrying it is not recreated, so webhook re-fires never duplicate the job.
  dedupeKey?: string;
}

/**
 * Push a website lead into JobNimbus: reuse or create the contact, then create
 * a job when the service maps to a JN job type. Best-effort; returns a short
 * status string for the Discord embed and never throws.
 */
export async function jnPushLead(lead: JnLead): Promise<string> {
  if (!jnReady()) return '';
  try {
    let contactId = await jnFindContact(lead.phone, lead.email);
    let contactNote = 'existing contact';
    if (!contactId) {
      const parts = lead.name.split(/\s+/);
      const first = parts.shift() || lead.name || 'Website Lead';
      const contactBody = {
        first_name: first,
        last_name: parts.join(' '),
        display_name: lead.name || 'Website Lead',
        record_type_name: 'Customer',
        status_name: 'New',
        mobile_phone: digits(lead.phone),
        email: lead.email,
        address_line1: lead.address,
        city: lead.city,
        state_text: 'CA',
        zip: lead.zip,
      };
      const postContact = (b: Record<string, unknown>) =>
        fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(lead.jnSource ? { ...b, source_name: lead.jnSource } : b) });
      let res = await postContact(contactBody);
      if (!res.ok && lead.jnSource) {
        // Source name not configured in JN Settings: create without it.
        res = await fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(contactBody) });
      }
      if (!res.ok) {
        // JobNimbus rejects a second contact with the same display name
        // ("Duplicate contact exists"). Two different people can share a name,
        // so disambiguate with the city or the last 4 phone digits and retry.
        const tag = lead.city || digits(lead.phone).slice(-4) || String(Date.now()).slice(-4);
        const uniqueBody = { ...contactBody, display_name: `${lead.name || 'Website Lead'} (${tag})` };
        res = await postContact(uniqueBody);
        if (!res.ok && lead.jnSource) res = await fetch(`${JN_BASE}/contacts`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(uniqueBody) });
      }
      if (!res.ok) return `contact failed (${res.status})`;
      const data = await res.json();
      contactId = data?.jnid || null;
      contactNote = 'new contact';
      // A just-created contact must be visible to the very next jnFindContact
      // (same run or a warm container), or the same lead gets a second contact.
      invalidateJnMemo('contacts');
    }
    if (!contactId) return 'contact failed';

    const type = JN_JOB_TYPE[lead.bucket];
    if (!type) return `${contactNote}, no job (service: ${lead.service || 'unknown'})`;

    // Idempotency: a job already carrying this marker means a prior run (or a
    // webhook retry) handled this lead. Do not create a second job.
    if (lead.dedupeKey) {
      const existing = await jnFindJobByMarker(lead.dedupeKey);
      if (existing) return `${contactNote}, job exists (${lead.dedupeKey})`;
    }

    const desc = [
      `${lead.origin || 'Website lead'} via ${lead.source}.`,
      lead.service && `Service requested: ${lead.service}.`,
      lead.message && `Message: ${lead.message}`,
      lead.address && `Address: ${lead.address}${lead.city ? ', ' + lead.city : ''}${lead.zip ? ' ' + lead.zip : ''}`,
      lead.dedupeKey && lead.dedupeKey,
    ]
      .filter(Boolean)
      .join('\n');
    // Online-source leads land in the "Online Leads" board column so they sit
    // apart from phone / canvassing / referral leads (which stay in "Lead").
    const leadStatus = lead.jnSource && ONLINE_SOURCES.has(lead.jnSource) ? 'Online Leads' : 'Lead';
    const jobBody = {
      name: `${lead.name || 'Website Lead'} - ${type}`,
      record_type_name: type,
      status_name: leadStatus,
      primary: { id: contactId },
      description: desc,
      // Job-level address so the board card shows it (contact address alone does not).
      address_line1: lead.address,
      city: lead.city,
      state_text: 'CA',
      zip: lead.zip,
    };
    // Try: source + status -> status only -> "Lead" fallback (if the board has
    // no "Online Leads" column) with and without source.
    const attempts: Record<string, unknown>[] = [];
    if (lead.jnSource) attempts.push({ ...jobBody, source_name: lead.jnSource });
    attempts.push(jobBody);
    if (leadStatus !== 'Lead') {
      const asLead = { ...jobBody, status_name: 'Lead' };
      if (lead.jnSource) attempts.push({ ...asLead, source_name: lead.jnSource });
      attempts.push(asLead);
    }
    let res: Response | null = null;
    for (const b of attempts) {
      res = await fetch(`${JN_BASE}/jobs`, { method: 'POST', headers: jnHeaders(), body: JSON.stringify(b) });
      if (res.ok) break;
    }
    if (!res?.ok) return `${contactNote}, job failed (${res?.status})`;
    invalidateJnMemo('jobs'); // the new job must be visible to the next marker dedupe
    return `${contactNote} + ${type} job${lead.jnSource ? ` (source ${lead.jnSource})` : ''}`;
  } catch {
    return 'error';
  }
}

/** Fetch one JN contact's phone/email for cross-system matching. */
export async function jnContact(id: string): Promise<{ phone: string; email: string; name: string } | null> {
  try {
    const res = await fetch(`${JN_BASE}/contacts/${encodeURIComponent(id)}`, { headers: jnHeaders() });
    if (!res.ok) return null;
    const c = await res.json();
    return {
      phone: digits(c.mobile_phone || c.home_phone || c.work_phone || ''),
      email: (c.email || '').trim().toLowerCase(),
      name: c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' '),
    };
  } catch {
    return null;
  }
}

/** Find a GHL contact id by phone or email (contacts query search). */
export async function ghlFindContact(phone: string, email: string): Promise<string | null> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return null;
  for (const q of [phone, email].filter(Boolean)) {
    try {
      const res = await fetch(
        `${GHL_BASE}/contacts/?locationId=${encodeURIComponent(loc)}&query=${encodeURIComponent(q)}&limit=1`,
        { headers: ghlHeaders() },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const id = data?.contacts?.[0]?.id;
      if (id) return id;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Highest opportunity monetary value for a GHL contact (deal-value fallback). */
async function ghlOpportunityValue(contactId: string): Promise<number> {
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc || !contactId) return 0;
  try {
    const res = await fetch(
      `${GHL_BASE}/opportunities/search?location_id=${encodeURIComponent(loc)}&contact_id=${encodeURIComponent(contactId)}&limit=20`,
      { headers: ghlHeaders() },
    );
    if (!res.ok) return 0;
    const opps = (await res.json())?.opportunities || [];
    let best = 0;
    for (const o of opps) {
      const v = Number(o.monetaryValue || 0);
      if (v > best) best = v;
    }
    return best;
  } catch {
    return 0;
  }
}

export interface JnSyncResult {
  ok: boolean;
  completed: { job: string; type: string; status: string; tagged: boolean }[];
  note?: string;
}

/**
 * Review engine: find jobs newly arrived in a completed status, tag the
 * matching GHL contact "review-request" (a GHL workflow sends the actual ask,
 * which keeps A2P consent and DND handling in one place), alert Discord, and
 * remember processed jobs in the sync-state custom value so this is idempotent
 * across cron runs and webhook calls.
 */
export async function runJnSync(minIntervalMinutes = 0): Promise<JnSyncResult> {
  if (!jnReady()) return { ok: false, completed: [], note: 'JOBNIMBUS_API_KEY unset' };
  // Without the GHL-backed state store there is no idempotency; do nothing
  // rather than risk double-tagging on every run.
  const state = await fetchJnSyncState();
  if (!state) return { ok: false, completed: [], note: 'GHL state store unavailable' };
  // Throttle: dashboard views and webhook pings call this opportunistically;
  // skip cheaply when a sync ran recently.
  if (minIntervalMinutes > 0 && state.state.lastRun && Date.now() - state.state.lastRun < minIntervalMinutes * 60000) {
    return { ok: true, completed: [], note: 'throttled' };
  }
  const jobs = await fetchJnJobs();
  if (!jobs) return { ok: false, completed: [], note: 'jobs fetch failed' };
  // First ever run: seed the state with every job already completed so only
  // FUTURE completions trigger review requests (no blast at past customers).
  if (state.id === null && state.state.reviewed.length === 0) {
    const seed = jobs.filter((j) => j.stage === 'done' && j.jnid).map((j) => j.jnid);
    await saveJnSyncState({ ...state.state, reviewed: seed, lastRun: Date.now() }, null);
    return { ok: true, completed: [], note: `seeded ${seed.length} already-completed jobs` };
  }
  const reviewed = new Set(state.state.reviewed);
  const fresh = jobs.filter((j) => j.stage === 'done' && j.jnid && !reviewed.has(j.jnid));
  const completed: JnSyncResult['completed'] = [];

  for (const job of fresh) {
    let tagged = false;
    const jc = job.primaryId ? await jnContact(job.primaryId) : null;
    if (jc && (jc.phone || jc.email)) {
      const ghlId = await ghlFindContact(jc.phone, jc.email);
      if (ghlId) {
        try {
          const res = await fetch(`${GHL_BASE}/contacts/${ghlId}/tags`, {
            method: 'POST',
            headers: ghlHeaders(),
            body: JSON.stringify({ tags: ['review-request'] }),
          });
          tagged = res.ok;
        } catch {
          /* stay untagged */
        }
      }
    }
    reviewed.add(job.jnid);
    completed.push({ job: job.name, type: job.type, status: job.status, tagged });
  }

  await saveJnSyncState({ ...state.state, reviewed: [...reviewed], lastRun: Date.now() }, state.id);
  if (completed.length) {
    const webhook = env('DISCORD_WEBHOOK');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'JobNimbus',
            embeds: [
              {
                title: `Job${completed.length > 1 ? 's' : ''} completed - review request queued`,
                color: 0xf6871f,
                description: completed
                  .map((c) => `**${c.job}** (${c.type}) reached "${c.status}"${c.tagged ? ' - review-request tag added in GHL' : ' - no matching GHL contact, ask manually'}`)
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
  }
  return { ok: true, completed };
}

// ---- GoHighLevel -> JobNimbus lead sync (poll) ----
// Facebook / Instagram Lead Ads and other GHL-origin leads never touch the
// website, so they never reach JobNimbus. This polls recent GHL contacts and
// mirrors the lead ones into JobNimbus (idempotent by "GHL contact <id>"), the
// same result as the /api/ghl-lead webhook but without needing a GHL workflow.
function jnSourceFromGhl(raw: string): string {
  const s = (raw || '').toLowerCase();
  if (/facebook|fb|meta|instant form|lead ad/.test(s)) return 'Facebook';
  if (/instagram|\big\b/.test(s)) return 'Instagram';
  if (/tiktok/.test(s)) return 'TikTok';
  if (/google ads|adwords/.test(s)) return 'Google Ads';
  if (/microsoft|bing/.test(s)) return 'Bing';
  if (/gmb|gbp|business profile|my business/.test(s)) return 'Google Business Profile';
  if (/google|organic|seo/.test(s)) return 'Google Organic';
  if (/referral/.test(s)) return 'Referral';
  return 'Website';
}

export interface GhlLeadSyncResult {
  ok: boolean;
  mirrored: { name: string; service: string; result: string }[];
  note?: string;
}

/**
 * Poll recent GoHighLevel contacts and mirror lead-ad / marketing leads into
 * JobNimbus. Bounded by lookback days and a per-run cap so it fits a serverless
 * invocation. Throttled via the sync-state stamp so page loads can call it
 * cheaply. Website form leads and Artemis already reach JN by their own paths,
 * so those sources are skipped here to avoid double-handling.
 */
export async function runGhlLeadSync(force = false, opts: { lookbackDays?: number; maxPerRun?: number } = {}): Promise<GhlLeadSyncResult> {
  if (!jnReady()) return { ok: false, mirrored: [], note: 'JOBNIMBUS_API_KEY unset' };
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return { ok: false, mirrored: [], note: 'GHL not connected' };

  const state = await fetchJnSyncState();
  const throttleMin = force ? 0 : 8;
  if (state && throttleMin > 0 && state.state.lastGhlLeadSyncAt && Date.now() - state.state.lastGhlLeadSyncAt < throttleMin * 60000) {
    return { ok: true, mirrored: [], note: 'throttled' };
  }

  const lookbackMs = (opts.lookbackDays ?? 4) * 86400000;
  const cap = opts.maxPerRun ?? (force ? 40 : 15);
  let contacts: any[] = [];
  try {
    const res = await fetch(`${GHL_BASE}/contacts/?locationId=${encodeURIComponent(loc)}&limit=100`, { headers: ghlHeaders() });
    if (!res.ok) return { ok: false, mirrored: [], note: `GHL contacts list failed (${res.status})` };
    contacts = (await res.json())?.contacts || [];
  } catch {
    return { ok: false, mirrored: [], note: 'GHL contacts list error' };
  }

  const cutoff = Date.now() - lookbackMs;
  const isMarketingLead = (c: any): boolean => {
    const src = String(c.source || '').toLowerCase();
    const tags: string[] = (c.tags || []).map((t: string) => t.toLowerCase());
    // A GHL-origin lead: a lead-ad / marketing source, or a "* lead" tag,
    // but NOT the website-form and phone paths that already reach JN/own flow.
    if (tags.includes('website-lead')) return false; // website form -> already in JN
    if (/artemis/.test(src)) return false; // Artemis -> its own sync
    return /facebook|instagram|tiktok|google|bing|meta/.test(src) || tags.some((t) => / lead$/.test(t) || t.startsWith('svc-'));
  };
  const bucketFor = (c: any): string => {
    const t = (c.tags || []).join(' ').toLowerCase();
    if (/roof/.test(t)) return 'roofing';
    if (/window/.test(t)) return 'windows';
    if (/insul/.test(t)) return 'insulation';
    return 'general';
  };

  // Every recent marketing lead in the lookback window (uncapped) is the pool
  // the poll would consider. Track which GHL contact ids we have already
  // mirrored, persisted in sync state, so a lead is NEVER reprocessed on a later
  // run even if JobNimbus's list API has not yet surfaced the contact/job we
  // created. This is what actually stops the every-minute duplicate creation.
  const candidates = contacts.filter((c) => new Date(c.dateAdded || 0).getTime() >= cutoff && isMarketingLead(c) && (c.phone || c.email));
  const candidateIds = new Set<string>(candidates.map((c) => c.id).filter(Boolean));
  const mirroredIds = new Set<string>(state?.state.ghlMirrored || []);
  const fresh = candidates.filter((c) => !mirroredIds.has(c.id)).slice(0, cap);

  const mirrored: GhlLeadSyncResult['mirrored'] = [];
  for (const c of fresh) {
    const bucket = bucketFor(c);
    const service = bucket === 'general' ? '' : bucket.charAt(0).toUpperCase() + bucket.slice(1);
    const result = await jnPushLead({
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.contactName || 'GHL Lead',
      phone: c.phone || '',
      email: c.email || '',
      // Address can live in the standard field (Contact) or the "Street
      // address" custom field (General Info); take whichever has data.
      address: c.address1 || ghlCustomStreet(c) || '',
      city: c.city || '',
      zip: c.postalCode || '',
      service,
      bucket,
      source: c.source || 'GoHighLevel',
      message: '',
      jnSource: jnSourceFromGhl(c.source || ''),
      origin: 'GoHighLevel lead',
      dedupeKey: `GHL contact ${c.id}`,
    });
    // Mark handled unless the push hard-failed, so it is not retried (and
    // re-duplicated) next run. "job exists"/"no job"/"new contact" all count.
    if (!/^contact failed/.test(result) && result !== 'error' && result !== '') mirroredIds.add(c.id);
    // Only report the ones that actually created a job (skip dedupe hits/no-ops).
    if (/\+ (Roofing|Windows|Insulation) job|new contact/.test(result) && !/job exists/.test(result)) {
      mirrored.push({ name: `${c.firstName || ''} ${c.lastName || ''}`.trim(), service: service || 'general', result });
    }
  }

  // Persist the processed set, pruned to the current lookback window so it stays
  // small (only ids that could still be reconsidered need to be remembered).
  const ghlMirrored = [...mirroredIds].filter((id) => candidateIds.has(id));
  await stampSyncState({ lastGhlLeadSyncAt: Date.now(), ghlMirrored }).catch(() => {});

  if (mirrored.length) {
    const webhook = env('DISCORD_WEBHOOK');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'GoHighLevel -> JobNimbus',
            embeds: [
              {
                title: `${mirrored.length} GHL lead${mirrored.length > 1 ? 's' : ''} mirrored to JobNimbus`,
                color: 0x1877f2,
                description: mirrored.map((m) => `**${m.name}** (${m.service}): ${m.result}`).join('\n').slice(0, 3900),
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

  return { ok: true, mirrored };
}

// ---- GHL opportunity stage -> JobNimbus job status (ongoing) ----
// Sales works leads through GHL pipeline stages; this keeps the JobNimbus job
// status in step so the boards reflect reality instead of everything sitting at
// "Lead". GHL owns the SALES stages (Lead -> Appt -> Estimate -> Sold); once a
// job is sold or in production, JobNimbus/ops owns it and GHL never drags it
// back. Forward-only within the sales stages, plus a terminal move to Lost.
const GHL_STAGE_TO_JN: Record<string, { Roofing?: string; Windows?: string; fallback?: string } | null> = {
  'new lead': null, 'new lead (meta)': null,
  'call attempt 1': null, 'call attempt 2': null, 'call attempt 3': null, 'no show': null, 'contacted': null, 'need to reschedule': null,
  'window lead to schedule': null, 'hot lead': null,
  'appointment set': { Roofing: 'Appt Scheduled', Windows: 'Appt Scheduled', fallback: 'Estimating' },
  'estimate given': { Roofing: 'Estimating', Windows: 'Estimate Given', fallback: 'Estimating' },
  'proposal presented': { Roofing: 'Estimating', Windows: 'Estimating' },
  'won': { Roofing: 'Sold/Awaiting Scheduling', Windows: 'Sold Ready To Measure' },
  'closed': { Roofing: 'Sold/Awaiting Scheduling', Windows: 'Sold Ready To Measure' },
  'sale': { Roofing: 'Sold/Awaiting Scheduling', Windows: 'Sold Ready To Measure' },
  'installed project': { Roofing: 'Roof In Progress', Windows: 'Install Scheduled' },
  'project installed': { Roofing: 'Roof In Progress', Windows: 'Install Scheduled' },
  'not qualified': { Roofing: 'Lost', Windows: 'Lost' },
  'not interested': { Roofing: 'Lost', Windows: 'Lost' },
  'lost': { Roofing: 'Lost', Windows: 'Lost' },
};
// JN sales-stage statuses GHL may drive, with a forward-only rank. A job at any
// OTHER status (Sold*, Windows Ordered, Install*, Job Complete, ...) is owned by
// ops and left alone.
const JN_SALES_RANK: Record<string, number> = { 'lead': 0, 'online leads': 0, 'appt scheduled': 1, 'appointment scheduled': 1, 'estimating': 1, 'estimate given': 1 };

/**
 * Sync GHL opportunity stage -> JobNimbus job status for every GHL-mirrored
 * job. Forward-only through the sales stages; skips jobs already sold/in
 * production; a "Not Qualified/Lost" GHL stage moves the job to Lost. Throttled
 * and best-effort.
 */
export async function runGhlStageSync(force = false, minIntervalMinutes = 10): Promise<{ ok: boolean; moved: { name: string; to: string }[]; note?: string }> {
  if (!jnReady()) return { ok: false, moved: [], note: 'JOBNIMBUS_API_KEY unset' };
  const loc = env('GHL_LOCATION_ID');
  if (!env('GHL_PIT') || !loc) return { ok: false, moved: [], note: 'GHL not connected' };
  const state = await fetchJnSyncState();
  if (!force && state && minIntervalMinutes > 0 && state.state.lastGhlStageSyncAt && Date.now() - state.state.lastGhlStageSyncAt < minIntervalMinutes * 60000) {
    return { ok: true, moved: [], note: 'throttled' };
  }

  // GHL pipelines: stage id -> bare stage name.
  let stageName: Map<string, string>;
  try {
    const pr = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(loc)}`, { headers: ghlHeaders() });
    if (!pr.ok) return { ok: false, moved: [], note: `pipelines failed (${pr.status})` };
    stageName = new Map();
    for (const p of (await pr.json())?.pipelines || []) for (const s of p.stages || []) stageName.set(s.id, String(s.name || '').toLowerCase());
  } catch {
    return { ok: false, moved: [], note: 'pipelines error' };
  }

  // GHL opportunities: contactId -> bare stage name (paginated).
  const byContact = new Map<string, string>();
  let after = '', afterId = '';
  for (let i = 0; i < 30; i++) {
    let u = `${GHL_BASE}/opportunities/search?location_id=${encodeURIComponent(loc)}&limit=100`;
    if (after) u += `&startAfter=${encodeURIComponent(after)}&startAfterId=${encodeURIComponent(afterId)}`;
    let d: any;
    try {
      const r = await fetch(u, { headers: ghlHeaders() });
      if (!r.ok) break;
      d = await r.json();
    } catch {
      break;
    }
    const rows = d?.opportunities || [];
    for (const o of rows) if (o.contactId && o.pipelineStageId) byContact.set(o.contactId, stageName.get(o.pipelineStageId) || '');
    if (!d?.meta?.startAfterId || rows.length < 100) break;
    after = d.meta.startAfter;
    afterId = d.meta.startAfterId;
  }

  const jobs = (await fetch(`${JN_BASE}/jobs?size=1000`, { headers: jnHeaders() }).then((r) => (r.ok ? r.json() : { results: [] })).catch(() => ({ results: [] })))?.results || [];
  const moved: { name: string; to: string }[] = [];
  for (const j of jobs) {
    if (j.is_active === false) continue;
    const m = String(j.description || '').match(/GHL contact (\S+)/);
    if (!m) continue;
    const stage = byContact.get(m[1]);
    if (!stage) continue;
    const map = GHL_STAGE_TO_JN[stage];
    if (!map) continue; // stays where it is (New Lead / Call Attempt / etc.)
    const board = j.record_type_name as 'Roofing' | 'Windows';
    const target = map[board] || map.fallback;
    if (!target) continue;
    const cur = String(j.status_name || '');
    if (cur === target) continue;
    // Ops guard: only touch jobs still in a sales stage.
    if (!(cur.toLowerCase() in JN_SALES_RANK)) continue;
    // Lost is a terminal move from any sales stage; otherwise forward-only.
    if (target !== 'Lost') {
      const targetRank = target.toLowerCase().includes('sold') ? 3 : (JN_SALES_RANK[target.toLowerCase()] ?? 1);
      if (targetRank <= (JN_SALES_RANK[cur.toLowerCase()] ?? 0)) continue;
    }
    let r = await fetch(`${JN_BASE}/jobs/${j.jnid}`, { method: 'PUT', headers: jnHeaders(), body: JSON.stringify({ status_name: target }) });
    let used = target;
    if (!r.ok && map.fallback && map.fallback !== target) {
      used = map.fallback;
      r = await fetch(`${JN_BASE}/jobs/${j.jnid}`, { method: 'PUT', headers: jnHeaders(), body: JSON.stringify({ status_name: map.fallback }) });
    }
    if (r.ok) moved.push({ name: j.name, to: used });
  }

  await stampSyncState({ lastGhlStageSyncAt: Date.now() }).catch(() => {});
  if (moved.length) {
    const webhook = env('DISCORD_WEBHOOK');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'GHL -> JobNimbus stages',
            embeds: [{ title: `${moved.length} job${moved.length > 1 ? 's' : ''} advanced to match GHL`, color: 0x255188, description: moved.map((x) => `**${x.name}** -> ${x.to}`).join('\n').slice(0, 3900), timestamp: new Date().toISOString() }],
          }),
        });
      } catch {
        /* best-effort */
      }
    }
  }
  return { ok: true, moved };
}

// ---- Meta offline conversions (sold Facebook deals -> Facebook) -----------

// A job counts as "sold" once it reaches any won/production status (same
// definition the Artemis sync uses for "already sold in JN").
const META_SOLD_STATUS = /sold|install|complete|ordered|received|measurements|progress|closed|funding|won/i;
// Facebook-origin is read from the lead source; instagram/meta count too.
const META_FB_SOURCE = /facebook|instagram|meta/i;
// Meta rejects conversion events whose event_time is older than 7 days.
const META_MAX_AGE_SEC = 7 * 86400;
// Hold a $0-value sold deal this many days, retrying, so a rep can fill Contract
// Amount and the conversion goes out ONCE with the real value instead of being
// locked at $0. Past this age (with 2-day margin before Meta's 7-day cutoff) it
// sends at $0 as a last resort so the conversion still counts.
const META_VALUE_HOLD_DAYS = 5;

// Rep-entered sold price, captured in a "Contract Amount" job custom field —
// the API-readable stand-in for Profit Tracker planned revenue (which JobNimbus
// does not expose on any API). Custom fields appear on the job by display name;
// the < $10M guard keeps an epoch-valued date custom field (e.g. a "Sold Date")
// from ever being mistaken for a dollar amount.
function jobContractAmount(j: any): number {
  // Tolerate Number/Currency (numeric) or Text ("$22,000") field types.
  const num = (v: unknown): number => {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/[^0-9.]/g, '');
    return s ? Number(s) : NaN;
  };
  const direct = num(j['Contract Amount']);
  if (Number.isFinite(direct) && direct > 0 && direct < 1e7) return direct;
  for (const [k, v] of Object.entries(j || {})) {
    if (!/contract\s*(amount|total|price|value)/i.test(k)) continue;
    const n = num(v);
    if (Number.isFinite(n) && n > 0 && n < 1e7) return n;
  }
  return 0;
}

export interface MetaSoldSyncResult {
  ok: boolean;
  sent: { name: string; value: number; result: string }[];
  note?: string;
}

/**
 * Report sold Facebook-sourced jobs back to Meta as Purchase conversions so ad
 * delivery optimizes toward buyers. FB origin is read from the PRIMARY
 * CONTACT's source, because a job's own source_name often becomes "Artemis"
 * once a proposal is built on top of the lead. Dedup is two-layered: a
 * watermark bounds each run, and a stable event_id ("sold-<jnid>") lets Meta
 * dedup any repeat inside its window. Only deals sold in the last 7 days are
 * eligible (Meta's freshness limit); the first run therefore never blasts old
 * history as fresh conversions.
 */
export async function runMetaSoldSync(force = false, opts: { maxPerRun?: number } = {}): Promise<MetaSoldSyncResult> {
  if (!jnReady() || !metaReady()) return { ok: false, sent: [], note: 'JobNimbus or Meta CAPI not configured' };
  const stateWrap = await fetchJnSyncState();
  const now = Date.now();
  const throttleMs = force ? 0 : 20 * 3600000; // 20h
  if (stateWrap?.state.lastMetaSyncAt && throttleMs > 0 && now - stateWrap.state.lastMetaSyncAt < throttleMs) {
    return { ok: true, sent: [], note: 'throttled' };
  }

  // Scan the full 7-day window every run; the reported-set below (plus Meta's
  // own event_id dedup) prevents double-counting, and failed sends retry
  // automatically until they age out of the window.
  const sinceSec = Math.floor((now - META_MAX_AGE_SEC * 1000) / 1000);

  const jobs = await jnList('jobs');
  const contacts = await jnList('contacts');
  const byId = new Map<string, any>();
  for (const c of contacts) byId.set(c.jnid, c);

  // Estimate value index: max total per related job/contact id. Catches deals
  // whose estimate exists but is not "approved", so the job rollup reads 0.
  const estByRelated = new Map<string, number>();
  try {
    const ests = (await fetch(`${JN_BASE}/estimates?size=1000`, { headers: jnHeaders() }).then((r) => (r.ok ? r.json() : { results: [] })))?.results || [];
    for (const e of ests) {
      const total = Number(e.total || 0);
      if (total <= 0) continue;
      for (const r of e.related || []) {
        if (r?.id && total > (estByRelated.get(r.id) || 0)) estByRelated.set(r.id, total);
      }
    }
  } catch {
    /* estimates optional; other value sources still apply */
  }

  const reported = new Set<string>(stateWrap?.state.metaSent || []); // event_ids already sent
  const inWindow = new Set<string>(); // every sold-FB event_id seen this run (for pruning)
  const cap = opts.maxPerRun ?? 25;
  const sent: MetaSoldSyncResult['sent'] = [];
  let held = 0; // fresh $0-value deals held for a rep to fill Contract Amount
  for (const j of jobs) {
    if (!META_SOLD_STATUS.test(String(j.status_name || ''))) continue;
    const changed = Number(j.date_status_change || 0);
    if (!changed || changed < sinceSec) continue;
    const primaryId = j.primary?.id || (Array.isArray(j.primary) ? j.primary[0]?.id : '');
    const contact = primaryId ? byId.get(primaryId) : null;
    const src = String(contact?.source_name || j.source_name || '');
    if (!META_FB_SOURCE.test(src)) continue;

    const eventId = `sold-${j.jnid}`;
    inWindow.add(eventId);
    if (reported.has(eventId)) continue; // already reported and still in window
    if (sent.length >= cap) continue; // cap new sends, but keep enumerating for the prune

    // Deal value, first source that has it. "Contract Amount" (rep-entered sold
    // price) leads because Profit Tracker planned revenue is NOT API-exposed;
    // then JN approved rollups -> linked estimate/invoice -> Artemis price -> GHL
    // opportunity value. Async fallbacks run only when value is still 0.
    let value = jobContractAmount(j);
    if (!value) {
      value = Number(
        j.approved_estimate_total || j.parent_approved_estimate_total || j.approved_invoice_total || j.parent_approved_invoice_total || 0,
      );
    }
    if (!value) value = estByRelated.get(j.jnid) || (contact ? estByRelated.get(contact.jnid) || 0 : 0);
    if (!value) {
      const m = String(j.description || '').match(/Artemis project:\s*([a-zA-Z0-9-]+)/);
      if (m) {
        const proj = await fetchArtemisProject(m[1]).catch(() => null);
        if (proj && proj.price > 0) value = proj.price;
      }
    }
    if (!value) {
      const gid = await ghlFindContact(contact?.mobile_phone || contact?.home_phone || '', contact?.email || '').catch(() => null);
      if (gid) value = await ghlOpportunityValue(gid);
    }
    // Hold a still-$0 deal (don't send, don't mark reported) so a rep has time to
    // fill Contract Amount; it then sends ONCE with the real value on a later
    // run. Only past the hold age do we send at $0 as a last resort.
    if (!value && (now / 1000 - changed) / 86400 < META_VALUE_HOLD_DAYS) {
      held++;
      continue;
    }
    const name = contact?.display_name || j.name || 'Lead';
    const [first, ...rest] = String(name).split(/\s+/);
    const result = await sendMetaConversion({
      email: contact?.email || '',
      phone: contact?.mobile_phone || contact?.home_phone || contact?.work_phone || '',
      firstName: contact?.first_name || first || '',
      lastName: contact?.last_name || rest.join(' ') || '',
      city: contact?.city || j.city || '',
      state: contact?.state_text || 'CA',
      zip: contact?.zip || j.zip || '',
      value,
      eventId,
      eventTimeSec: changed,
    });
    sent.push({ name, value, result });
    if (/^ok/.test(result)) reported.add(eventId); // only a confirmed send is remembered
  }

  // Persist only the reported ids still inside the window, so the set stays small.
  const metaSent = [...reported].filter((id) => inWindow.has(id));
  await stampSyncState({ lastMetaSyncAt: now, metaSent }).catch(() => {});
  const heldNote = held ? `${held} held awaiting Contract Amount` : undefined;

  if (sent.length) {
    const webhook = env('DISCORD_WEBHOOK');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Sold -> Meta',
            embeds: [{
              title: `${sent.length} sold Facebook deal${sent.length > 1 ? 's' : ''} reported to Meta`,
              color: 0x1877f2,
              description: sent.map((s) => `**${s.name}** $${Math.round(s.value)} — ${s.result}`).join('\n').slice(0, 3900),
              timestamp: new Date().toISOString(),
            }],
          }),
        });
      } catch {
        /* best-effort */
      }
    }
  }
  return { ok: true, sent, note: heldNote };
}

/**
 * One-off: force a Meta conversion for specific jobs with a fresh event_id and
 * their current resolved value. For correcting deals already sent at $0 (Meta
 * dedups the original event_id, so a same-id resend does nothing). The stable
 * "-r1" suffix means calling this twice dedups instead of adding more phantom
 * conversions. Only sends when a value and a sold date within Meta's 7-day
 * window exist. Admin-triggered, not on any cron.
 */
export async function metaResendJobs(jnids: string[]): Promise<MetaSoldSyncResult> {
  if (!jnReady() || !metaReady()) return { ok: false, sent: [], note: 'JobNimbus or Meta CAPI not configured' };
  const jobs = await jnList('jobs');
  const contacts = await jnList('contacts');
  const byId = new Map<string, any>();
  for (const c of contacts) byId.set(c.jnid, c);
  const nowSec = Math.floor(Date.now() / 1000);
  const sent: MetaSoldSyncResult['sent'] = [];
  for (const jnid of jnids.map((s) => s.trim()).filter(Boolean)) {
    const j = jobs.find((x) => x.jnid === jnid);
    if (!j) { sent.push({ name: jnid, value: 0, result: 'job not found' }); continue; }
    const contact = j.primary?.id ? byId.get(j.primary.id) : null;
    const name = contact?.display_name || j.name || jnid;
    let value = jobContractAmount(j);
    if (!value) value = Number(j.approved_estimate_total || j.parent_approved_estimate_total || j.approved_invoice_total || j.parent_approved_invoice_total || 0);
    if (!value) { sent.push({ name, value: 0, result: 'no value to send' }); continue; }
    const changed = Number(j.date_status_change || 0);
    if (!changed || nowSec - changed > META_MAX_AGE_SEC) { sent.push({ name, value, result: 'sold date past Meta 7-day window' }); continue; }
    const [first, ...rest] = String(name).split(/\s+/);
    const result = await sendMetaConversion({
      email: contact?.email || '',
      phone: contact?.mobile_phone || contact?.home_phone || contact?.work_phone || '',
      firstName: contact?.first_name || first || '',
      lastName: contact?.last_name || rest.join(' ') || '',
      city: contact?.city || j.city || '',
      state: contact?.state_text || 'CA',
      zip: contact?.zip || j.zip || '',
      value,
      eventId: `sold-${jnid}-r1`,
      eventTimeSec: changed,
    });
    sent.push({ name, value, result });
  }
  return { ok: true, sent };
}

/** Production-stage jobs untouched for `days`+ days (the stuck list). */
export function stuckJobs(jobs: JnJob[] | null, days = 14): JnJob[] {
  if (!jobs) return [];
  const cutoff = Date.now() - days * 86400000;
  return jobs
    .filter((j) => j.stage === 'production' && j.updated.getTime() < cutoff)
    .sort((a, b) => a.updated.getTime() - b.updated.getTime());
}
