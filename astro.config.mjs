// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.smarthomeimprove.com',
  trailingSlash: 'always',
  // Static by default; the lead endpoint (src/pages/api/lead.ts) opts into
  // on-demand rendering so it runs as a Vercel serverless function.
  // maxDuration: the dashboard aggregates GHL + CallRail + JobNimbus live and
  // can exceed the 10s serverless default on cold caches.
  adapter: vercel({ maxDuration: 60 }),
  // Webhook receivers (/api/jn-webhook, /api/artemis-webhook) get POSTs from
  // third-party servers with text/plain or form content types, which Astro's
  // global origin guard rejects with 403. The guard is off here; the lead
  // form endpoint (/api/lead) enforces its own same-origin check instead.
  security: { checkOrigin: false },
  build: {
    // Inline the (small, ~12KB) bundled CSS into the HTML so no
    // render-blocking stylesheet request remains.
    inlineStylesheets: 'always',
  },
  // Preserve SEO: map old Duda URLs to their new equivalents.
  redirects: {
    '/roofing/roof-replacement': '/roofing/residential-roofing/',
    '/privacy-policy': '/privacy/',
    '/leadership': '/about/',
    '/services': '/#services',
    '/shingles': '/roofing/',
    '/portfolio': '/about/',
    '/roofing-landing-page': '/roofing/',
    '/windows-landing-page': '/windows/',
    '/thank-you-page': '/thank-you/',
    '/5-signs-its-time-to-replace-roof': '/blog/5-signs-its-time-to-replace-your-roof/',
    '/how-proper-insulation-can-reduce-energy-costs':
      '/blog/how-proper-insulation-can-reduce-energy-costs/',
    '/the-benefits-of-energy-efficient-windows-for-central-valley-homes':
      '/blog/benefits-of-energy-efficient-windows/',
  },
  integrations: [
    sitemap({
      // Keep non-indexed pages out of the sitemap.
      filter: (page) =>
        !page.includes('/audit') &&
        !page.includes('/playbook') &&
        !page.includes('/brief') &&
        !page.includes('/ads-plan') &&
        !page.includes('/dashboard') &&
        !page.includes('/thank-you') &&
        !page.includes('/lp/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
