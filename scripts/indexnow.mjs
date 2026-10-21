// IndexNow ping after production builds: tells Bing (and other IndexNow
// engines) which URLs exist/changed so Copilot's index stays fresh without
// waiting for a crawl. Key file lives in public/. No account required.
// Runs only on Vercel production builds.
import { readFileSync, existsSync } from 'node:fs';

const KEY = '9772a227794553cac4e920be403a5f7e';
const HOST = 'www.smarthomeimprove.com';
const SITEMAP = 'dist/client/sitemap-0.xml';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('[indexnow] not a production build, skipping');
  process.exit(0);
}
if (!existsSync(SITEMAP)) {
  console.log('[indexnow] no sitemap found, skipping');
  process.exit(0);
}
const xml = readFileSync(SITEMAP, 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) process.exit(0);
try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: urls,
    }),
  });
  console.log(`[indexnow] submitted ${urls.length} urls, status ${res.status}`);
} catch (e) {
  console.log('[indexnow] ping failed (non-fatal):', e.message);
}
