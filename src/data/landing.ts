// Paid-ads landing pages. One page per platform x service at /lp/<platform>/<service>/.
// Each page is distraction-free (no site nav), noindex, and tuned to the platform's
// audience intent, with a per-platform call-tracking phone number and conversion pixel.
import { site } from './site';
import { serviceContent } from './serviceContent';

export interface AdPlatform {
  key: 'google' | 'facebook' | 'microsoft';
  name: string;
  badge: string; // small trust line shown by the logo
  // Call-tracking number for this platform. TODO: replace display + raw with a real
  // tracking number (CallRail or similar) so calls from each platform are attributed.
  // Defaults to the main business line so calls work until tracking numbers are set.
  phone: { display: string; raw: string };
  // Conversion tracking ID. Leave '' to skip injecting the pixel.
  //   google    -> Google Ads / gtag ID (e.g. "AW-XXXXXXXXX")
  //   facebook  -> Meta Pixel ID (e.g. "1234567890")
  //   microsoft -> Microsoft UET tag ID (e.g. "12345678")
  pixelId: string;
  // Google only: the conversion action label (the part after the slash in
  // "AW-XXXXXXXXX/AbCdEfGhIj"). Required to count a form lead; '' for others.
  conversionLabel: string;
  // Optional per-service tracking numbers (CallRail). Falls back to `phone`.
  phoneByService?: Partial<Record<'roofing' | 'windows' | 'insulation', { display: string; raw: string }>>;
}

export const platforms: Record<AdPlatform['key'], AdPlatform> = {
  google: {
    key: 'google',
    name: 'Google',
    badge: 'Top-rated on Google',
    // CallRail dedicated source numbers for Google Ads traffic.
    phone: { display: '(559) 648-9581', raw: '+15596489581' }, // roofing + fallback
    phoneByService: {
      windows: { display: '(559) 574-8350', raw: '+15595748350' },
    },
    pixelId: 'AW-18292050102',
    conversionLabel: '', // TODO: event snippet label (send_to: 'AW-18292050102/XXXX')
  },
  microsoft: {
    key: 'microsoft',
    name: 'Microsoft',
    badge: 'Trusted local contractor',
    phone: { display: site.phone, raw: site.phoneRaw },
    pixelId: '',
    conversionLabel: '',
  },
  facebook: {
    key: 'facebook',
    name: 'Facebook',
    badge: 'Loved by Central Valley homeowners',
    // CallRail dedicated source number for Facebook/Meta Ads traffic.
    phone: { display: '(559) 963-6239', raw: '+15599636239' },
    pixelId: '2204742390264631',
    conversionLabel: '',
  },
};

// GA4 measurement IDs (analytics properties, distinct from the AW- ads tag).
// More than one property can collect at once, e.g. our own plus a partner /
// Facebook rep's property. All are configured sitewide, and gtag('event', ...)
// (generate_lead, estimate funnel) sends to every configured property.
export const ga4Ids = ['G-WW17YS9F2E', 'G-Q19B3ZQQF7'];

// Primary GA4 id (back-compat for single-id consumers like the dashboard).
// Loaded sitewide in Layout.astro; lead + estimate-tool events reference it.
export const ga4Id = 'G-WW17YS9F2E';

export const adServices = ['roofing', 'windows', 'insulation'] as const;
export type AdService = (typeof adServices)[number];

/**
 * Registry of every paid landing page: path + the lead_source its form
 * stamps. Drives the dashboard's per-page visits/leads/pipeline view and
 * validates the visit beacon. Add variant pages here when you create them.
 */
export interface LandingPageInfo {
  path: string; // e.g. /lp/facebook/windows/
  platform: AdPlatform['key'];
  service: AdService | 'general';
  label: string;
  leadSource: string;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const landingPages: LandingPageInfo[] = [
  ...(['google', 'facebook', 'microsoft'] as const).flatMap((p) =>
    adServices.map((s) => ({
      path: `/lp/${p}/${s}/`,
      platform: p,
      service: s,
      label: `${cap(s)} (offer)`,
      leadSource: `${platforms[p].name} Ads - ${cap(s)}`,
    })),
  ),
  { path: '/lp/facebook/windows-product/', platform: 'facebook', service: 'windows', label: 'Windows (product angle)', leadSource: 'Facebook Ads - Windows Product' },
  { path: '/lp/facebook/why-us/', platform: 'facebook', service: 'general', label: 'Company / why us', leadSource: 'Facebook Ads - Why Us' },
];

// Service-level hooks used to assemble platform-specific copy.
const svc: Record<AdService, { keyword: string; hook: string; benefitLine: string }> = {
  roofing: {
    keyword: 'roofing',
    hook: 'Is your roof ready for another Central Valley summer?',
    benefitLine: 'Durable roofs built to handle Fresno heat, from fast repairs to full replacements.',
  },
  windows: {
    keyword: 'windows',
    hook: 'Tired of high energy bills and drafty, dated windows?',
    benefitLine: 'Energy-efficient replacement windows that cut bills, block noise, and boost curb appeal.',
  },
  insulation: {
    keyword: 'insulation',
    hook: 'Is your home always too hot upstairs and too expensive to cool?',
    benefitLine: 'Attic insulation and radiant barriers that cut energy bills and keep every room comfortable.',
  },
};

// The "Godfather offer": an irresistible free front-end (inspection + guide)
// that warms cold traffic and proves value before the real (back-end) job.
export interface OfferData {
  inspectionName: string;
  guideTitle: string;
  guidePath: string;
  valueStack: { item: string; value: string }[];
  totalValue: string;
  problems: { title: string; text: string }[];
  /** Interactive "what our inspection covers" points (icon + plain-language detail + illustration). */
  inspect: { icon: string; title: string; text: string; illustration: string }[];
}

export const offerFor: Record<AdService, OfferData> = {
  roofing: {
    inspectionName: '21-Point Roof Inspection',
    guideTitle: 'The 7 Costly Roofing Mistakes Guide',
    guidePath: '/guides/roofing-buyers-guide.pdf',
    valueStack: [
      { item: 'Free 21-point roof inspection', value: '$149' },
      { item: 'Free written report with photos', value: '$99' },
      { item: '"7 Costly Roofing Mistakes" guide', value: '$29' },
      { item: 'Honest, no-pressure written quote', value: '$0' },
      { item: 'Our get-it-right guarantee', value: 'Included' },
    ],
    totalValue: '$277',
    problems: [
      { title: 'The wrong contractor costs you thousands', text: 'Skipped underlayment, bad flashing, and unlicensed crews fail early. You end up paying twice.' },
      { title: 'Small leaks become big damage', text: 'By the time you see a stain, water has often been getting in for months, into decking, insulation, and drywall.' },
      { title: 'Cheap bids hide what matters', text: 'The lowest quote usually means thinner materials and corners cut where you cannot see.' },
    ],
    inspect: [
      { icon: 'roof', title: 'Shingles & granule loss', text: 'We check for cracked, curling, or missing shingles and granule loss that signals your roof is wearing out.', illustration: '/illustrations/mat-shingle.svg' },
      { icon: 'wrench', title: 'Flashing & valleys', text: 'Flashing around chimneys, vents, and valleys is the most common leak point. We inspect every one.', illustration: '/illustrations/insp-roof-flashing.svg' },
      { icon: 'shield', title: 'Underlayment & decking', text: 'We look for soft spots and water intrusion in the decking and underlayment beneath the surface.', illustration: '/illustrations/roof-cutaway.svg' },
      { icon: 'leaf', title: 'Attic ventilation', text: 'Poor ventilation cooks your roof from below and drives up cooling bills. We check intake and exhaust.', illustration: '/illustrations/insp-roof-vent.svg' },
      { icon: 'check', title: 'Leaks & water damage', text: 'We document any active leaks or past water damage with photos so you see exactly what we see.', illustration: '/illustrations/insp-roof-leak.svg' },
    ],
  },
  windows: {
    inspectionName: 'Window & Energy Assessment',
    guideTitle: 'The Window Buyer\'s Guide',
    guidePath: '/guides/windows-buyers-guide.pdf',
    valueStack: [
      { item: 'Free in-home window assessment', value: '$129' },
      { item: 'Free energy-savings estimate', value: '$79' },
      { item: '"Before You Replace Your Windows" guide', value: '$29' },
      { item: 'Honest, no-pressure written quote', value: '$0' },
      { item: 'Our get-it-right guarantee', value: 'Included' },
    ],
    totalValue: '$237',
    problems: [
      { title: 'High energy bills every summer', text: 'Old, leaky windows let the heat pour in and your AC fight a losing battle, month after month.' },
      { title: 'Drafts, noise, and hot spots', text: 'Failed seals and single panes mean uneven rooms, outside noise, and a home that never feels right.' },
      { title: 'Dated, hard-to-use windows', text: 'Louvers and worn frames hurt curb appeal, security, and resale value.' },
    ],
    inspect: [
      { icon: 'window', title: 'Seal & glass failure', text: 'Fogging or condensation between panes means the seal has failed and the window no longer insulates.', illustration: '/illustrations/insp-win-seal.svg' },
      { icon: 'wrench', title: 'Frame & operation', text: 'We check frames, sashes, and hardware for warping, sticking, and security issues.', illustration: '/illustrations/mat-win-hung.svg' },
      { icon: 'leaf', title: 'Energy efficiency', text: 'We measure where heat is getting in and show you the savings Low-E, double-pane glass can deliver.', illustration: '/illustrations/window-cutaway.svg' },
      { icon: 'shield', title: 'Drafts & air leaks', text: 'We find the gaps and failed weatherstripping making your AC work overtime all summer.', illustration: '/illustrations/insp-win-draft.svg' },
      { icon: 'check', title: 'Noise & comfort', text: 'We note rooms that run hot, cold, or loud so the right windows fix the actual problem.', illustration: '/illustrations/mat-win-slider.svg' },
    ],
  },
  insulation: {
    inspectionName: 'Home Comfort & Energy Assessment',
    guideTitle: 'The Central Valley Insulation Guide',
    guidePath: '/guides/insulation-buyers-guide.pdf',
    valueStack: [
      { item: 'Free attic and home energy assessment', value: '$129' },
      { item: 'Free written savings estimate', value: '$79' },
      { item: '"Cut Your Energy Bills" insulation guide', value: '$29' },
      { item: 'Honest, no-pressure written quote', value: '$0' },
      { item: 'Our get-it-right guarantee', value: 'Included' },
    ],
    totalValue: '$237',
    problems: [
      { title: 'The upstairs is an oven in July', text: 'Poor attic insulation lets heat pour in, so some rooms never feel comfortable no matter how hard the AC runs.' },
      { title: 'Energy bills that keep climbing', text: 'Air leaks and thin insulation waste the money you spend heating and cooling your home.' },
      { title: 'Money spent on the wrong fix', text: 'Without a real assessment, it is easy to pay for upgrades that do not actually move the needle.' },
    ],
    inspect: [
      { icon: 'insulation', title: 'Attic insulation depth', text: 'We measure how much insulation you actually have versus what Central Valley homes need.', illustration: '/illustrations/mat-ins-batt.svg' },
      { icon: 'shield', title: 'Air leaks & gaps', text: 'We find the hidden gaps around ducts, lights, and the attic hatch where conditioned air escapes.', illustration: '/illustrations/insp-ins-gap.svg' },
      { icon: 'leaf', title: 'Radiant barrier', text: 'We check whether a reflective barrier would stop summer heat before it ever enters your attic.', illustration: '/illustrations/mat-ins-radiant.svg' },
      { icon: 'wrench', title: 'Moisture & ventilation', text: 'Trapped moisture ruins insulation and invites mold. We confirm your attic breathes properly.', illustration: '/illustrations/mat-ins-blown.svg' },
      { icon: 'check', title: 'Room-by-room comfort', text: 'We map the hot and cold rooms so the fix targets the spots that actually bother you.', illustration: '/illustrations/insulation-hero.svg' },
    ],
  },
};

export interface LandingCopy {
  eyebrow: string;
  headline: string;
  sub: string;
  offer: string;
  cta: string;
}

export function landingCopy(p: AdPlatform['key'], s: AdService): LandingCopy {
  const service = serviceContent[s];
  const Name = service.name; // Roofing / Windows / Insulation
  const lower = Name.toLowerCase();
  const city = site.city;
  const r = site.rating;
  const h = svc[s];

  if (p === 'google') {
    return {
      eyebrow: `${city} ${lower}`,
      headline: `${city} ${lower} done right, the first time`,
      sub: `Get a free inspection and our free buyer's guide from a licensed local team rated ${r.value} stars by ${r.count} ${city}-area homeowners. ${h.benefitLine}`,
      offer: 'Free inspection + free buyer\'s guide',
      cta: 'Claim My Free Inspection',
    };
  }
  if (p === 'microsoft') {
    return {
      eyebrow: `Trusted ${city} ${lower}`,
      headline: `Your trusted ${city} ${lower} contractor`,
      sub: `${site.yearsInBusiness}+ years, licensed (CA #${site.license}), and ${r.count} five-star reviews. Start with a free inspection and honest, upfront pricing. ${h.benefitLine}`,
      offer: 'Free inspection + honest, upfront quote',
      cta: 'Claim My Free Inspection',
    };
  }
  // facebook
  return {
    eyebrow: `${city} homeowners`,
    headline: h.hook,
    sub: `${h.benefitLine} Book a free, no-pressure inspection and grab our free guide, from a licensed local team rated ${r.value} stars by ${r.count} homeowners.`,
    offer: 'Free inspection + free guide. No pressure.',
    cta: 'Claim My Free Inspection',
  };
}
