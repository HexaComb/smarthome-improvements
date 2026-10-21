// Code source of truth for business facts. Edit here, propagates everywhere.
// Canonical human reference (NAP, brand, TODOs): ../../business.md
// Keep these values identical to business.md and to all external listings.
import ratingGen from './rating.generated.json';

// Live Google rating + review count are fetched from the Places API at build
// time (scripts/fetch-rating.mjs -> rating.generated.json). The values just
// below are the fallback if that file is missing or the fetch is not set up.
const ratingFallback = { value: 5.0, count: 54 };
const liveRating = {
  value: typeof ratingGen?.value === 'number' && ratingGen.value > 0 ? ratingGen.value : ratingFallback.value,
  count: typeof ratingGen?.count === 'number' && ratingGen.count > 0 ? ratingGen.count : ratingFallback.count,
};

export const site = {
  name: 'Smart Home Improvements',
  legalName: 'Smart Home Improvements',
  tagline: 'Roofing, Windows & Insulation Done Right, Every Time.',
  url: 'https://www.smarthomeimprove.com',
  phone: '(559) 833-6945',
  phoneRaw: '+15598336945',
  // Text-us CTAs (sms: links). Same CallRail office line; texting must be
  // enabled on that number in CallRail for messages to arrive.
  smsRaw: '+15598336945',
  email: 'info@smarthomeimprove.com',
  license: '1129883',
  yearsInBusiness: 10,
  founded: '2014',
  city: 'Fresno',
  region: 'CA',
  regionName: 'California',
  areaServed: 'Fresno & the Central Valley',
  // Service-area business: no public storefront (per Google Business Profile).
  serviceAreaOnly: true,
  // Cities verified on the Google Business Profile service area. Keep this list
  // identical to GBP. Expansion cities (Sanger, Selma, Reedley, Kerman) should be
  // added to BOTH GBP and here at the same time to preserve consistency.
  serviceCities: ['Fresno', 'Clovis', 'Madera', 'Visalia'],
  // Hours verified from the Google Business Profile (keep identical to GBP).
  hours: [
    { days: 'Monday - Friday', time: '9:00 AM - 7:00 PM' },
    { days: 'Saturday', time: '9:00 AM - 6:00 PM' },
    { days: 'Sunday', time: 'Closed' },
  ],
  // Schema.org opening hours specification
  hoursSpec: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '19:00' },
    { days: ['Saturday'], opens: '09:00', closes: '18:00' },
  ],
  // Google rating (verified from GBP). Update as it changes.
  // value/count come from Google (Places API) at build time; see liveRating above.
  rating: { value: liveRating.value, count: liveRating.count, url: 'https://www.google.com/search?q=Smart+Home+Improvements+Fresno' },
  // Sitewide storm-damage banner above the header (rendered in Layout.astro):
  // flip true during storm season (Oct-Mar).
  stormBanner: false,
  // Contact form: Web3Forms (free, no backend, works on Vercel/any static host).
  // This access key is public by design (it lives in the form markup and only
  // routes submissions to info@smarthomeimprove.com). Rotate it at web3forms.com
  // if needed. Configure email/Discord/spam options in the Web3Forms dashboard.
  formAccessKey: '6af2a4f8-c555-44e6-8b4b-51897712a439',

  // GoHighLevel booking calendars (widget embed URLs). Shown on /thank-you/
  // for the matching service so fresh leads can self-book their inspection.
  booking: {
    roofing: 'https://api.leadconnectorhq.com/widget/booking/3MorzAyJaivuEXcw463N',
    windows: 'https://api.leadconnectorhq.com/widget/booking/z77MdSLmMbmppfna60CX',
  } as Record<string, string>,
  social: {
    // Verified profiles. Pending ones kept as '#' (hidden in the footer).
    facebook: 'https://www.facebook.com/profile.php?id=61581907966797',
    instagram: 'https://www.instagram.com/smarthome_improvements',
    youtube: 'https://www.youtube.com/@SmartHome_Improvements',
    tiktok: '#',
    yelp: '#',
  },
} as const;

// footerOnly items are hidden from the header nav but still linked in the footer.
export const nav = [
  { label: 'Home', href: '/' },
  { label: 'Roofing', href: '/roofing/' },
  { label: 'Windows', href: '/windows/' },
  { label: 'Insulation', href: '/insulation/' },
  { label: 'Pricing', href: '/estimate/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', href: '/contact/' },
  { label: 'Areas', href: '/service-areas/', footerOnly: true },
  { label: 'Projects', href: '/projects/', footerOnly: true },
  { label: 'Blog', href: '/blog/', footerOnly: true },
  { label: 'FAQ', href: '/faq/', footerOnly: true },
  { label: 'Resources', href: '/resources/', footerOnly: true },
  { label: 'Español', href: '/es/', footerOnly: true },
] as const;

export const services = [
  {
    slug: 'roofing',
    name: 'Roofing',
    short:
      'Repairs and full replacements built for Valley heat and Title 24, most reroofs done in 1 to 3 days. Every job starts with a free, photo-documented 21-Point Roof Inspection.',
    icon: 'roof',
  },
  {
    slug: 'windows',
    name: 'Windows',
    short:
      'Anlin replacement windows, built 15 minutes away in Clovis and backed by a double lifetime transferable warranty. Energy glass picked for triple-digit Valley summers.',
    icon: 'window',
  },
  {
    slug: 'insulation',
    name: 'Insulation',
    short:
      'Attic insulation and radiant barrier that cut heating and cooling costs by about 15%, per ENERGY STAR estimates. The free assessment measures what your attic actually has.',
    icon: 'insulation',
  },
] as const;

// Placeholder testimonials. Replace with real Google/Yelp reviews when available.
export const reviews = [
  {
    name: 'Maria G.',
    city: 'Fresno, CA',
    rating: 5,
    text: "Smart Home Improvements replaced our roof ahead of schedule and left the yard spotless. Honest pricing and great communication the whole way through.",
  },
  {
    name: 'David R.',
    city: 'Clovis, CA',
    rating: 5,
    text: "New energy-efficient windows dropped our summer AC bills noticeably. The install crew was professional and tidy. Highly recommend.",
  },
  {
    name: 'Janet S.',
    city: 'Madera, CA',
    rating: 5,
    text: "They re-insulated our attic and added a radiant barrier. The upstairs is finally comfortable in July. Couldn't be happier.",
  },
] as const;
