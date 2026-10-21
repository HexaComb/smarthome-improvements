// Blog-side service metadata: category -> service mapping, per-service blog
// CTAs, and the resource links service pages surface ("Pricing and honest
// answers"). Kept separate from serviceContent.ts so template work never
// touches service copy.

export type ServiceSlug = 'roofing' | 'windows' | 'insulation';

/** Map a post's category string to its service. */
export const serviceForCategory = (category: string): ServiceSlug | null => {
  const c = (category || '').toLowerCase();
  if (c.includes('roof')) return 'roofing';
  if (c.includes('window')) return 'windows';
  if (c.includes('insulation')) return 'insulation';
  return null;
};

/** The one canonical free-assessment offer per service (same as the LPs). */
export const blogCta: Record<ServiceSlug, { offer: string; sub: string; hub: string }> = {
  roofing: {
    offer: 'Get your free 21-Point Roof Inspection',
    sub: 'A licensed local crew checks your whole roof and shows you photos of what we find. Free, no obligation.',
    hub: '/roofing/',
  },
  windows: {
    offer: 'Get your free Window & Energy Assessment',
    sub: 'We measure your windows, walk through glass options for Valley heat, and put an exact price in writing. Free, no obligation.',
    hub: '/windows/',
  },
  insulation: {
    offer: 'Get your free Home Comfort & Energy Assessment',
    sub: 'We check your attic insulation depth and coverage and show you exactly what your home needs. Free, no obligation.',
    hub: '/insulation/',
  },
};

/** Post ids that quote real prices; these also deep-link the estimate tool. */
export const costGuides = new Set(['roof-replacement-cost-fresno', 'window-replacement-cost-fresno']);

export interface ResourceLink {
  href: string;
  label: string;
  note: string;
}

/**
 * "Pricing and honest answers" links rendered on each service hub and
 * sub-page. Only link published content; cost guides first.
 */
export const serviceResources: Record<ServiceSlug, ResourceLink[]> = {
  roofing: [
    { href: '/blog/roof-replacement-cost-fresno/', label: 'Roof replacement cost in Fresno and Clovis', note: 'The real price ranges we charge, and what moves them' },
    { href: '/estimate/', label: 'Instant roof estimate', note: 'See your price range in 60 seconds, no contact info needed' },
    { href: '/blog/5-signs-its-time-to-replace-your-roof/', label: '5 signs it is time to replace your roof', note: 'How to tell repair from replacement' },
    { href: '/faq/', label: 'Every roofing question we get asked', note: 'Straight answers, all in one place' },
    { href: '/financing/', label: 'Financing your roof', note: 'How payment options work, in plain English' },
  ],
  windows: [
    { href: '/blog/window-replacement-cost-fresno/', label: 'What window replacement actually costs in Fresno', note: 'Real per-window and whole-home ranges' },
    { href: '/estimate/', label: 'Instant window estimate', note: 'See your price range in 60 seconds, no contact info needed' },
    { href: '/blog/anlin-vs-milgard-windows/', label: 'Anlin vs Milgard, compared honestly', note: 'From the crew that installs them' },
    { href: '/faq/', label: 'Every window question we get asked', note: 'Straight answers, all in one place' },
    { href: '/financing/', label: 'Financing your windows', note: 'How payment options work, in plain English' },
  ],
  insulation: [
    { href: '/blog/how-proper-insulation-can-reduce-energy-costs/', label: 'How insulation cuts your energy bills', note: 'What ENERGY STAR says savings really look like' },
    { href: '/blog/benefits-of-energy-efficient-windows/', label: 'Pair insulation with efficient windows', note: 'The whole-envelope view of a cooler home' },
    { href: '/faq/', label: 'Every insulation question we get asked', note: 'Straight answers, all in one place' },
    { href: '/financing/', label: 'Financing your project', note: 'How payment options work, in plain English' },
  ],
};
