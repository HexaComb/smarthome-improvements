// Lead intake endpoint (Vercel serverless). Forms POST here; it:
//  1. Upserts the lead into GoHighLevel (API v2) with first/last-touch attribution.
//  2. Creates an Opportunity in the pipeline that matches the service (roofing /
//     windows / insulation), routing the lead into the right pipeline.
//  3. Posts a Discord notification.
//  4. Sends the Web3Forms email as a reliable backup.
// Then redirects to /thank-you/. Server-side honeypot + Astro's same-origin check
// guard it.
//
// Secrets are read from Vercel environment variables at runtime, never committed:
//   GHL_PIT          = GoHighLevel Private Integration Token (pit-...)
//                      scopes needed: contacts write + opportunities read & write
//   GHL_LOCATION_ID  = GoHighLevel Location (sub-account) ID
//   DISCORD_WEBHOOK  = Discord channel webhook URL (optional)
//   JOBNIMBUS_API_KEY = JobNimbus API key (optional; mirrors leads into ops)
// If a var is unset, that step is skipped and the rest still runs.
import type { APIRoute } from 'astro';
import { site } from '../../data/site';
import { jnPushLead } from '../../lib/jn';

export const prerender = false;

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

const env = (k: string): string => (typeof process !== 'undefined' && process.env && process.env[k]) || '';
const val = (fd: FormData, k: string): string => (fd.get(k) ?? '').toString().trim();
const ghlHeaders = (pit: string) => ({
  Authorization: `Bearer ${pit}`,
  Version: GHL_VERSION,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

type Touch = Record<string, string>;

// Drop empty/undefined keys so we never send blanks to GHL.
function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k in o) {
    const v = o[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out as Partial<T>;
}

// Classify the traffic into a readable source/medium from click IDs + UTMs.
function classify(t: Touch): { sessionSource: string; medium: string } {
  if (t.gclid || t.gbraid || t.wbraid) return { sessionSource: 'Google Ads', medium: 'ppc' };
  if (t.msclkid) return { sessionSource: 'Microsoft Ads', medium: 'ppc' };
  if (t.fbclid) return { sessionSource: 'Facebook Ads', medium: 'paid-social' };
  if (t.ttclid) return { sessionSource: 'TikTok Ads', medium: 'paid-social' };
  if (t.utm_medium && /cpc|ppc|paid/i.test(t.utm_medium)) return { sessionSource: t.utm_source || 'Paid', medium: t.utm_medium };
  if (t.utm_source) return { sessionSource: t.utm_source, medium: t.utm_medium || 'referral' };
  if (t.referrer) return { sessionSource: 'Referral', medium: 'referral' };
  return { sessionSource: 'Direct', medium: '(none)' };
}

const CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'];

// Map attribution to a JobNimbus "Lead Source" name (Settings-configured list
// in JN: Facebook, Website, Google Ads, Google Organic, Google Business
// Profile, ...). jnPushLead falls back to no source when a name is not
// configured, so this can name sources before Eric adds them in JN.
function jnSourceName(src: { sessionSource: string; medium: string } | null): string {
  const s = (src?.sessionSource || '').toLowerCase();
  const m = (src?.medium || '').toLowerCase();
  if (/facebook|meta|\bfb\b/.test(s)) return 'Facebook';
  if (/instagram/.test(s)) return 'Instagram';
  if (/tiktok/.test(s)) return 'TikTok';
  if (/google ads/.test(s)) return 'Google Ads';
  if (/microsoft|bing/.test(s)) return 'Bing';
  if (/gmb|gbp|business profile/.test(s) || /gmb|gbp/.test(m)) return 'Google Business Profile';
  if (/google/.test(s)) return 'Google Organic';
  if (s === 'referral') return 'Referral';
  return 'Website';
}

// Map a captured touch to GHL's attributionSource shape.
function toAttribution(t: Touch | undefined, ua: string, ip: string) {
  if (!t || typeof t !== 'object') return undefined;
  const c = classify(t);
  const a = clean({
    url: t.url,
    campaign: t.utm_campaign,
    utmSource: t.utm_source,
    utmMedium: t.utm_medium,
    utmContent: t.utm_content,
    utmKeyword: t.utm_term,
    referrer: t.referrer,
    gclid: t.gclid,
    gbraid: t.gbraid,
    wbraid: t.wbraid,
    fbclid: t.fbclid,
    msclkid: t.msclkid,
    sessionSource: c.sessionSource,
    medium: c.medium,
    userAgent: ua || undefined,
    ip: ip || undefined,
  });
  return Object.keys(a).length ? a : undefined;
}

// Human-readable line with EVERY captured UTM + click id (nothing dropped).
function summarize(label: string, t?: Touch): string {
  if (!t || !Object.keys(t).length) return '';
  const c = classify(t);
  const parts = [`source=${t.utm_source || c.sessionSource}`, `medium=${t.utm_medium || c.medium}`];
  Object.keys(t)
    .filter((k) => /^utm_/.test(k) && k !== 'utm_source' && k !== 'utm_medium')
    .sort()
    .forEach((k) => parts.push(`${k.replace('utm_', '')}=${t[k]}`));
  CLICK_IDS.forEach((k) => { if (t[k]) parts.push(`${k}=${t[k]}`); });
  if (t.referrer) parts.push(`referrer=${t.referrer}`);
  if (t.url) parts.push(`landing=${t.url}`);
  if (t.ts) parts.push(`time=${t.ts}`);
  return `${label}: ${parts.join(' | ')}`;
}

async function ghlUpsert(pit: string, body: unknown): Promise<Response> {
  return fetch(`${GHL_BASE}/contacts/upsert`, { method: 'POST', headers: ghlHeaders(pit), body: JSON.stringify(body) });
}

// Cache pipelines across warm invocations to avoid a fetch on every lead.
const pipelineCache: { data: any[] | null; ts: number } = { data: null, ts: 0 };
async function getPipelines(pit: string, loc: string): Promise<any[]> {
  if (pipelineCache.data && Date.now() - pipelineCache.ts < 5 * 60 * 1000) return pipelineCache.data;
  try {
    const res = await fetch(`${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(loc)}`, { headers: ghlHeaders(pit) });
    if (!res.ok) return pipelineCache.data || [];
    const data = await res.json();
    pipelineCache.data = data?.pipelines || [];
    pipelineCache.ts = Date.now();
    return pipelineCache.data;
  } catch {
    return pipelineCache.data || [];
  }
}

// Route a lead to the right pipeline by service, and return its first stage.
//   roofing  -> "Roofing Pipeline"
//   windows  -> "Window Pipeline"
//   insulation / multiple / anything else -> "Home Improvement Leads" (catch-all)
// A dedicated pipeline is used automatically once one exists whose name contains
// the service word (e.g. add an "Insulation Pipeline" and it routes there).
function pickPipeline(pipelines: any[], service: string): { pipelineId: string; stageId: string } | null {
  if (!pipelines?.length) return null;
  const find = (kw: string) => pipelines.find((p) => (p?.name || '').toLowerCase().includes(kw));
  const s = (service || '').toLowerCase();
  let p: any = null;
  if (s.includes('roof')) p = find('roofing') || find('roof');
  else if (s.includes('window')) p = find('window');
  else if (s.includes('insul')) p = find('insulation') || find('insul');
  if (!p) p = find('home improvement') || find('lead'); // default catch-all
  if (!p?.stages?.length) return null;
  const stage = [...p.stages].sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))[0];
  if (!stage?.id) return null;
  return { pipelineId: p.id, stageId: stage.id };
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const thankYou = new URL('/thank-you/', site.url).href;
  const done = (url = thankYou) => new Response(null, { status: 303, headers: { Location: url } });

  // Same-origin guard (Astro's global checkOrigin is disabled so webhook
  // endpoints can accept third-party POSTs). Browsers always send Origin on
  // POST; a foreign origin means a cross-site form submission, so drop it.
  const origin = request.headers.get('origin') || '';
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).hostname;
    } catch {
      /* malformed origin, treated as foreign */
    }
    const siteHost = new URL(site.url).hostname;
    const allowed = host === siteHost || host === siteHost.replace(/^www\./, '') || host === 'localhost' || host.endsWith('.vercel.app');
    if (!allowed) return new Response('Forbidden', { status: 403 });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return done();
  }

  // Honeypots: if a bot filled either trap, accept silently and do nothing.
  if (val(fd, 'botcheck') || val(fd, 'hp_extra_2')) return done();

  const name = val(fd, 'name');
  // Client validation is bypassable; treat a phone without 10+ digits as absent
  // so garbage numbers never reach GoHighLevel.
  const rawPhone = val(fd, 'phone');
  const phone = rawPhone.replace(/\D/g, '').length >= 10 ? rawPhone : '';
  const email = val(fd, 'email');
  const zip = val(fd, 'zip');
  const address = val(fd, 'address');
  const city = val(fd, 'city');
  const service = val(fd, 'service');
  const message = val(fd, 'message');
  const marketingOptin = val(fd, 'marketing_optin') === 'yes';
  const smsConsent = val(fd, 'sms_consent') === 'yes';
  const source =
    val(fd, 'lead_source') ||
    (val(fd, 'service_page') ? `Website - ${val(fd, 'service_page')}` : 'Website');

  if (!name && !phone && !email) return done(); // nothing usable

  // ---- Attribution (first + last touch) from the sh_attr cookie ----
  let attr: { first?: Touch; last?: Touch } = {};
  try {
    const raw = cookies.get('sh_attr')?.value;
    if (raw) {
      for (const s of [raw, decodeURIComponent(raw)]) {
        try {
          const o = JSON.parse(s);
          if (o && typeof o === 'object') { attr = o; break; }
        } catch {
          /* try next form */
        }
      }
    }
  } catch {
    /* no attribution */
  }
  const ua = request.headers.get('user-agent') || '';
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || clientAddress || '';
  const attributionSource = toAttribution(attr.first, ua, ip);
  const lastAttributionSource = toAttribution(attr.last, ua, ip);
  const attrNote = [summarize('First touch', attr.first), summarize('Last touch', attr.last)]
    .filter(Boolean)
    .join('\n');

  // 1) GoHighLevel: upsert contact, route to the matching pipeline, add a note.
  const GHL_PIT = env('GHL_PIT');
  const GHL_LOCATION_ID = env('GHL_LOCATION_ID');
  if (GHL_PIT && GHL_LOCATION_ID) {
    try {
      const parts = name.split(/\s+/);
      const firstName = parts.shift() || name || 'Website Lead';
      const tags = ['website-lead'];
      if (service) tags.push(service.toLowerCase());
      // Normalized service bucket so GHL workflows can trigger per service
      // without parsing free-form values ("Multiple / Other" etc.).
      const bucket = ['roofing', 'windows', 'insulation'].find((b) => service.toLowerCase().includes(b.slice(0, 4)));
      tags.push(bucket ? `svc-${bucket}` : 'svc-general');
      // Express marketing opt-in (checkbox): builds the marketable list.
      if (marketingOptin) tags.push('marketing-optin');
      tags.push(smsConsent ? 'sms-consent' : 'no-sms-consent');
      // Language: tag every lead english or spanish so follow-up (and pipeline
      // filters) go out in the right language.
      tags.push(val(fd, 'lang') === 'es' ? 'spanish' : 'english');
      const src = attr.last ? classify(attr.last) : null;
      if (src && src.sessionSource !== 'Direct') tags.push(src.sessionSource.toLowerCase());
      // Explicit platform tag for Facebook traffic (LP or organic click-through).
      if (src && /facebook|\bfb\b|meta/i.test(src.sessionSource)) tags.push('facebook-lead');

      // No SMS checkbox = no texts: set SMS DND so GHL automations reach this
      // lead by call and email only (carrier compliance for A2P 10DLC).
      const dndSettings = smsConsent
        ? undefined
        : { SMS: { status: 'active', message: 'No SMS consent given on website form', code: '' } };

      // ORIGINAL lead source is sacred for channel analytics: if this person
      // already exists in GHL, keep their first source and only tag the new
      // touch; a brand-new contact gets this submission as its source.
      let existingId: string | null = null;
      try {
        for (const q of [phone.replace(/\D/g, '').slice(-10), email].filter(Boolean)) {
          const r = await fetch(`${GHL_BASE}/contacts/?locationId=${encodeURIComponent(GHL_LOCATION_ID)}&query=${encodeURIComponent(q)}&limit=1`, { headers: ghlHeaders(GHL_PIT) });
          if (r.ok) {
            const id = (await r.json())?.contacts?.[0]?.id;
            if (id) {
              existingId = id;
              break;
            }
          }
        }
      } catch {
        /* treat as new */
      }
      if (existingId) tags.push('repeat-lead', `touch-${source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);

      const core = clean({
        locationId: GHL_LOCATION_ID,
        dndSettings,
        firstName,
        lastName: parts.join(' '),
        name,
        email,
        phone,
        address1: address,
        city,
        postalCode: zip,
        source: existingId ? undefined : source,
        tags,
      });

      // Try with full attribution; if GHL rejects it, retry with core fields so
      // the contact is always created.
      let res = await ghlUpsert(GHL_PIT, { ...core, tags, attributionSource, lastAttributionSource });
      if (!res.ok) res = await ghlUpsert(GHL_PIT, { ...core, tags });

      const data = res.ok ? await res.json().catch(() => null) : null;
      const contactId = data?.contact?.id ?? data?.id;

      if (contactId) {
        // Route into the pipeline that matches the service (best-effort).
        const match = pickPipeline(await getPipelines(GHL_PIT, GHL_LOCATION_ID), service);
        if (match) {
          await fetch(`${GHL_BASE}/opportunities/`, {
            method: 'POST',
            headers: ghlHeaders(GHL_PIT),
            body: JSON.stringify({
              pipelineId: match.pipelineId,
              pipelineStageId: match.stageId,
              locationId: GHL_LOCATION_ID,
              contactId,
              name: `${name || 'Website lead'}${service ? ` - ${service}` : ''}`,
              status: 'open',
              source,
            }),
          }).catch(() => {});
        }

        // Attach message + full attribution as a note (best-effort).
        const noteBody = [
          smsConsent
            ? `SMS consent (informational checkbox): YES at ${new Date().toISOString()} (STOP to opt out, HELP for help)`
            : `SMS consent (informational checkbox): NO at ${new Date().toISOString()}. SMS DND set; contact by call and email only.`,
          `Marketing opt-in (offers/promos checkbox): ${marketingOptin ? 'YES' : 'no'}`,
          service && `Service: ${service}`,
          zip && `ZIP: ${zip}`,
          `Lead source: ${source}`,
          message && `\nMessage:\n${message}`,
          attrNote && `\nAttribution:\n${attrNote}`,
        ]
          .filter(Boolean)
          .join('\n');
        if (noteBody) {
          await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
            method: 'POST',
            headers: ghlHeaders(GHL_PIT),
            body: JSON.stringify({ body: noteBody }),
          }).catch(() => {});
        }
      }
    } catch {
      // swallow; email + Discord below still record the lead
    }
  }

  // 1b) JobNimbus: mirror the lead into ops so nobody re-types it. Best-effort;
  // the status string rides along in the Discord embed.
  const svcBucketForJn = ['roofing', 'windows', 'insulation'].find((b) => service.toLowerCase().includes(b.slice(0, 4))) || 'general';
  const jnStatus = await jnPushLead({
    name,
    phone,
    email,
    address,
    city,
    zip,
    service,
    bucket: svcBucketForJn,
    source,
    message,
    jnSource: jnSourceName(attr.first ? classify(attr.first) : attr.last ? classify(attr.last) : null),
  });

  // 2) Discord notification (webhook from env; never committed).
  const DISCORD_WEBHOOK = env('DISCORD_WEBHOOK');
  if (DISCORD_WEBHOOK) {
    try {
      const fld = (n: string, v: string, inline = true) => ({ name: n, value: (v || '—').slice(0, 1024), inline });
      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Smart Home Leads',
          embeds: [
            {
              title: `New lead — ${source}`.slice(0, 256),
              color: 0xf6871f,
              fields: [
                fld('Name', name),
                fld('Phone', phone),
                fld('Email', email),
                fld('Service', service),
                fld('ZIP', zip),
                fld('Address', address),
                fld('City', city),
                fld('Message', message, false),
                fld('SMS consent', smsConsent ? 'YES' : 'NO (call/email only)'),
                fld('Marketing opt-in', marketingOptin ? 'YES' : 'no'),
                ...(jnStatus ? [fld('JobNimbus', jnStatus)] : []),
                fld('Attribution', attrNote || 'Direct / none', false),
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
      // swallow
    }
  }

  // 3) Web3Forms email backup (reliable record to info@, with attribution).
  if (site.formAccessKey) {
    try {
      await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: site.formAccessKey,
          subject: `New lead: ${source}`,
          from_name: 'Smart Home Improvements website',
          name,
          phone,
          email,
          zip,
          address,
          city,
          service,
          message,
          lead_source: source,
          sms_consent: smsConsent ? 'yes' : 'no',
          marketing_optin: marketingOptin ? 'yes' : 'no',
          attribution: attrNote || 'Direct / none',
        }),
      });
    } catch {
      // swallow
    }
  }

  // 4) Alivo (AI web chat + lead follow-up): forward every website lead to
  // Alivo's Zapier catch hook so their agent can follow up. Best-effort; set
  // the hook URL in the ALIVO_WEBHOOK_URL environment variable.
  const ALIVO_WEBHOOK_URL = env('ALIVO_WEBHOOK_URL');
  if (ALIVO_WEBHOOK_URL) {
    try {
      await fetch(ALIVO_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email,
          address,
          city,
          state: 'CA',
          zip,
          service,
          message,
          lead_source: source,
          sms_consent: smsConsent ? 'yes' : 'no',
          marketing_optin: marketingOptin ? 'yes' : 'no',
          attribution: attrNote || 'Direct / none',
          submitted_at: new Date().toISOString(),
          site: 'smarthomeimprove.com',
        }),
      });
    } catch {
      // swallow; Alivo is a follow-up mirror, never blocks the lead
    }
  }

  // Every lead redirects with ?service=<bucket> so /thank-you/ can show the
  // matching buyer's guide and booking calendar. Paid landing-page leads also
  // carry ?src=<platform>, which is the only thing that fires ad conversions.
  const svcBucket = ['roofing', 'windows', 'insulation'].find((b) => service.toLowerCase().includes(b.slice(0, 4))) || 'general';
  const q = new URLSearchParams({ service: svcBucket });
  const lp = /^(Google|Facebook|Microsoft) Ads/i.exec(val(fd, 'lead_source'));
  if (lp) q.set('src', lp[1].toLowerCase());
  return done(`${thankYou}?${q}`);
};

// GET ?health=1 reports which integrations are configured (booleans only, no
// secrets) so a deploy/env issue can be diagnosed. Otherwise bounce to contact.
export const GET: APIRoute = ({ url }) => {
  if (url.searchParams.get('health')) {
    return new Response(
      JSON.stringify({
        ok: true,
        ghl: !!env('GHL_PIT') && !!env('GHL_LOCATION_ID'),
        discord: !!env('DISCORD_WEBHOOK'),
        web3forms: !!site.formAccessKey,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  }
  return new Response(null, { status: 303, headers: { Location: '/contact/' } });
};
