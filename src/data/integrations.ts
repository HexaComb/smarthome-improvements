// Integration catalog for the dashboard's Integrations view. `connected`
// entries get their live status from the dashboard at render time (keyed by
// `key`); `available` entries describe what each additional integration
// would unlock and what it needs. Keep honest: only list as connected what
// the code actually talks to.

export interface ConnectedIntegration {
  key: string;
  name: string;
  role: string; // one line: what it does for the business
  feeds: string; // which dashboard views / automations depend on it
  setup: string; // where the credential lives
}

export const connectedIntegrations: ConnectedIntegration[] = [
  { key: 'ghl', name: 'GoHighLevel (CRM)', role: 'Every lead lands here: contact, pipeline opportunity, attribution, consent tags, speed-to-lead workflows.', feeds: 'Overview, Month, Ledger, Performance, Pipeline, Landing pages, Revenue summary', setup: 'GHL_PIT + GHL_LOCATION_ID (Vercel)' },
  { key: 'ghlcal', name: 'GoHighLevel calendars', role: 'Roofing and Windows booking calendars; leads self-book on the thank-you page.', feeds: 'Bookings, Revenue summary (booked / canceled)', setup: 'Calendar IDs in site.ts; PIT needs the calendars scope' },
  { key: 'jn', name: 'JobNimbus (ops + revenue)', role: 'Jobs, statuses, estimates, invoices. Website leads are mirrored in as contact + job.', feeds: 'Production, Revenue summary, Ledger revenue, review engine, Monday report', setup: 'JOBNIMBUS_API_KEY (Vercel)' },
  { key: 'jnhook', name: 'JobNimbus webhook (real-time)', role: 'Job changes ping /api/jn-webhook/ so completions trigger review requests within seconds.', feeds: 'Review engine, Discord', setup: 'Automation in JobNimbus (Job modified -> Webhook)' },
  { key: 'artemis', name: 'Artemis (proposals + financing)', role: 'Proposals, designs, financing, e-sign contracts for home-improvement projects.', feeds: 'Proposals view, Discord on every event', setup: 'ARTEMIS_API_KEY (Vercel) + webhook in Artemis Developer settings' },
  { key: 'artemishook', name: 'Artemis webhook (real-time)', role: 'Artemis posts every project event to /api/artemis-webhook/; signed contracts sync instantly.', feeds: 'Artemis sync, Discord', setup: 'Webhook in Artemis Installer Settings > Developer' },
  { key: 'artemissync', name: 'Artemis -> JobNimbus + GHL sync', role: 'New proposals mirror as leads (JN job + GHL opportunity in the service pipeline); signatures rank the job sold, mark the opportunity Won, and create the signed estimate Profit Tracker reads. Test-name and staff guards keep practice runs out.', feeds: 'Production, Pipeline, Revenue summary, Ledger ROI', setup: 'Runs inside /api/artemis-webhook/; map stored as a GHL custom value. Manual push for a deal signed outside Artemis: /api/artemis-sync/?key=...&project=<id>' },
  { key: 'callsync', name: 'CallRail -> GHL (phone leads)', role: 'Every first-time caller becomes a GHL contact + opportunity with the tracking source, campaign, ad set, keywords, and click ids attached; SMS DND set (no consent).', feeds: '360 pipeline, Channels, speed-to-lead follow-up', setup: 'Polls on dashboard loads + daily sync; optional real-time via CallRail post-call webhook -> /api/callrail-webhook/' },
  { key: 'ghlbridge', name: 'GoHighLevel -> JobNimbus (lead bridge)', role: 'Facebook / Instagram Lead Ads and other GHL-origin leads are mirrored into JobNimbus: contact + job on the right board (service from the lead tag) with the Lead Source stamped. Idempotent (no duplicate jobs). Runs two ways: a poll on every cron + dashboard load, and a real-time webhook.', feeds: 'JobNimbus boards, Production', setup: 'Poll uses GHL_PIT (automatic). Real-time optional: GHL workflow (Contact Created) -> Webhook POST to /api/ghl-lead/, guarded by GHL_BRIDGE_SECRET' },
  { key: 'callrail', name: 'CallRail', role: 'Tracking numbers per channel (office, Google Ads, Facebook, LSA); call volume by source.', feeds: 'Calls in every view, calls-by-source, CPL', setup: 'CALLRAIL_API_KEY + CALLRAIL_ACCOUNT_ID (Vercel)' },
  { key: 'meta', name: 'Meta Pixel', role: 'PageView on Facebook landing pages, Lead event on the thank-you page for Facebook leads.', feeds: 'Meta campaign optimization (outside this dashboard)', setup: 'landing.ts platforms.facebook.pixelId' },
  { key: 'gads', name: 'Google Ads tag', role: 'Sitewide base tag + URL conversion on the thank-you page. Campaigns currently paused.', feeds: 'Google Ads conversions (outside this dashboard)', setup: 'landing.ts platforms.google.pixelId' },
  { key: 'ga4', name: 'Google Analytics 4', role: 'Sitewide analytics: page views, generate_lead on every thank-you (with lead source + service), estimate-tool funnel events (started, range shown, submitted).', feeds: 'GA4 reports (analytics.google.com); future organic KPIs in this dashboard via the GA4 API', setup: 'landing.ts ga4Id' },
  { key: 'discord', name: 'Discord alerts', role: 'Instant lead embeds, job-completed alerts, Artemis events, Monday owner report.', feeds: 'Team notifications', setup: 'DISCORD_WEBHOOK (Vercel)' },
  { key: 'web3forms', name: 'Web3Forms (email backup)', role: 'Every form submission is also emailed, so nothing is lost if an API is down.', feeds: 'Backup only', setup: 'site.ts formAccessKey' },
  { key: 'hits', name: 'Upstash Redis (visit counter)', role: 'First-party page-view counts for the paid landing pages.', feeds: 'Landing pages (visits, conversion rate)', setup: 'Vercel Storage -> Upstash Redis (KV_REST_API_URL / TOKEN)' },
  { key: 'indexnow', name: 'IndexNow (Bing)', role: 'Every production deploy submits all URLs so Bing and Copilot index changes immediately.', feeds: 'Search visibility', setup: 'Key file in public/, scripts/indexnow.mjs' },
  { key: 'cron', name: 'Vercel cron', role: 'Monday 8am owner report; daily 9am JobNimbus sync backstop.', feeds: 'Weekly report, review engine', setup: 'vercel.json crons' },
  { key: 'listings', name: 'Google Business Profile + Bing Places', role: 'Local listings; Bing Places auto-syncs from GBP.', feeds: 'Rating value in site.ts, local search', setup: 'Managed in the GBP and Bing Places dashboards' },
];

export interface AvailableIntegration {
  name: string;
  unlocks: string;
  needs: string;
  effort: 'hours' | 'half day' | '1-2 days';
}

export const availableIntegrations: AvailableIntegration[] = [
  { name: 'Website lead -> Artemis project', unlocks: 'Every lead becomes an Artemis project with UTM attribution, assigned to a rep, ready for a proposal. No re-typing.', needs: 'Artemis create-project field spec + rep assignment rule (who gets which leads)', effort: 'half day' },
  { name: 'Meta Marketing API (spend)', unlocks: 'Ad spend pulled automatically per campaign and ad set; the spend editor becomes optional and CPL/ROAS are always current.', needs: 'Meta app + system user token with ads_read on the ad account', effort: 'half day' },
  { name: 'Google Ads API (spend + LSA)', unlocks: 'Same for Google Ads and Local Services Ads spend when campaigns restart.', needs: 'Google Ads developer token + OAuth (approval takes days)', effort: '1-2 days' },
  { name: 'Google Search Console + GA4', unlocks: 'Organic KPIs in the dashboard: impressions, clicks, top queries per blog post, AI-referrer traffic. Measures the blog and AEO work.', needs: 'A Google Cloud service account added to Search Console and GA4', effort: 'half day' },
  { name: 'CallRail post-call webhook', unlocks: 'Phone leads land in GHL the second the call ends instead of on the next poll; Discord alert per new caller.', needs: 'CallRail Settings > Integrations > Webhooks > Post-Call URL /api/callrail-webhook/ (endpoint already live)', effort: 'hours' },
  { name: 'JobNimbus -> GHL value sync', unlocks: 'Signed estimate totals written back to the GHL opportunity value and marked Won, so GHL pipeline health stops reading zero.', needs: 'Team agreement that JobNimbus is the source of truth', effort: 'hours' },
  { name: 'Google Business Profile API', unlocks: 'New reviews pulled into the dashboard (and onto the site when licensed), Google Posts published from the work log, review reply reminders.', needs: 'GBP API access request (Google approves per business)', effort: '1-2 days' },
  { name: 'QuickBooks Online', unlocks: 'Collected revenue from paid invoices when accounting, not JobNimbus, holds the truth.', needs: 'QuickBooks OAuth app + owner consent', effort: '1-2 days' },
  { name: 'Angi / Yelp lead APIs', unlocks: 'Third-party leads flow into GHL and the dashboard with their own source tag instead of living in email.', needs: 'Active accounts on those platforms', effort: 'half day' },
];
