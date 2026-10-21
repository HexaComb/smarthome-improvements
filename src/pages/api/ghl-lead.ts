// GoHighLevel -> JobNimbus bridge.
//
// Leads that ORIGINATE in GHL (Facebook / Instagram Lead Ads, manual entry,
// third-party forms) never touch our website, so /api/lead never sees them and
// they never reach JobNimbus. A GHL workflow POSTs new qualified leads here and
// this endpoint mirrors them into JobNimbus (contact + job on the right board,
// with the Lead Source stamped), reusing the same jnPushLead used by the site.
//
// Set up in GHL (Smart Home location):
//   Automation > Workflows > new workflow
//   Trigger:  "Contact Created" (or "Facebook Lead Form submitted"), filtered
//             to the sources you want mirrored (e.g. Facebook Lead Ads).
//   Action:   "Webhook" -> POST https://www.smarthomeimprove.com/api/ghl-lead/
//             Custom JSON body (merge fields):
//               { "contact_id": "{{contact.id}}",
//                 "name": "{{contact.name}}",
//                 "phone": "{{contact.phone}}",
//                 "email": "{{contact.email}}",
//                 "address": "{{contact.address1}}",
//                 "city": "{{contact.city}}",
//                 "zip": "{{contact.postal_code}}",
//                 "service": "Roofing",            // or map a form field
//                 "source": "{{contact.source}}",  // e.g. "Facebook"
//                 "language": "{{contact.some_lang_field}}" }
//   Optional: append ?key=<GHL_BRIDGE_SECRET> to the URL and set that env var.
//
// Idempotent: a job carrying "GHL contact <id>" is never recreated, so workflow
// retries and re-enrolments do not duplicate the job. Best-effort; never throws.
import type { APIRoute } from 'astro';
import { jnPushLead } from '../../lib/jn';

export const prerender = false;

const env = (k: string): string =>
  (typeof process !== 'undefined' && process.env && process.env[k]) || '';

// Read a value under any of several possible keys (GHL payloads vary).
const pick = (o: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = o?.[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

// GHL contact source -> JobNimbus Lead Source (Settings-configured list).
function jnSource(raw: string): string {
  const s = raw.toLowerCase();
  if (/facebook|fb|meta|instant form|lead ad/.test(s)) return 'Facebook';
  if (/instagram|\big\b/.test(s)) return 'Instagram';
  if (/tiktok/.test(s)) return 'TikTok';
  if (/google ads|adwords|gclid/.test(s)) return 'Google Ads';
  if (/microsoft|bing/.test(s)) return 'Bing';
  if (/gmb|gbp|business profile/.test(s)) return 'Google Business Profile';
  if (/google|organic|seo/.test(s)) return 'Google Organic';
  if (/referral/.test(s)) return 'Referral';
  return 'Website';
}

async function handle(data: any): Promise<{ status: number; body: any }> {
  const name = pick(data, 'name', 'full_name', 'fullName') || [pick(data, 'first_name', 'firstName'), pick(data, 'last_name', 'lastName')].filter(Boolean).join(' ');
  const phone = pick(data, 'phone', 'phone_number', 'mobile');
  const email = pick(data, 'email');
  if (!phone && !email) return { status: 200, body: { ok: false, note: 'no phone or email; nothing to mirror' } };

  const service = pick(data, 'service', 'service_needed', 'serviceRequested');
  const bucket = ['roofing', 'windows', 'insulation'].find((b) => service.toLowerCase().includes(b.slice(0, 4))) || 'general';
  const sourceRaw = pick(data, 'source', 'lead_source', 'leadSource', 'attributionSource', 'utm_source') || 'Facebook';
  const contactId = pick(data, 'contact_id', 'contactId', 'id');
  const lang = pick(data, 'language', 'lang');

  const jnStatus = await jnPushLead({
    name: name || 'GHL Lead',
    phone,
    email,
    // Address can be the standard field or the "Street address" custom field.
    address: pick(data, 'address', 'address1', 'street', 'street_address', 'full_address'),
    city: pick(data, 'city'),
    zip: pick(data, 'zip', 'postal_code', 'postalCode'),
    service,
    bucket,
    source: sourceRaw,
    message: pick(data, 'message', 'notes', 'question') + (lang === 'es' ? ' (Spanish lead)' : ''),
    jnSource: jnSource(sourceRaw),
    origin: 'GoHighLevel lead',
    dedupeKey: contactId ? `GHL contact ${contactId}` : undefined,
  });

  // Best-effort Discord ping so the team sees the bridge working.
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
              title: `Lead mirrored to JobNimbus: ${name || 'GHL Lead'}`,
              color: 0x1877f2,
              description: [`Source: **${jnSource(sourceRaw)}**`, service && `Service: ${service}`, `JobNimbus: ${jnStatus}`].filter(Boolean).join('\n'),
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
      /* alert is best-effort */
    }
  }

  return { status: 200, body: { ok: true, jn: jnStatus } };
}

export const POST: APIRoute = async ({ request, url }) => {
  const secret = env('GHL_BRIDGE_SECRET');
  if (secret && url.searchParams.get('key') !== secret) return new Response('Forbidden', { status: 403 });

  let data: any = {};
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) data = await request.json();
    else {
      const fd = await request.formData();
      data = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, note: 'unparseable body' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const { status, body } = await handle(data);
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
};
