// Local one-time import of every Artemis project into JobNimbus through the
// same sync the webhook uses (staff test projects skipped; duplicate-proof).
// Run:  ARTEMIS_API_KEY=... JOBNIMBUS_API_KEY=... PROGRESS_FILE=./backfill-progress.json \
//       npx esbuild scripts/artemis-backfill-local.ts --bundle --platform=node --format=esm --outfile=/tmp/bf.mjs && node /tmp/bf.mjs
// Paced to stay under Artemis's 60 requests/minute. Re-runnable: progress file
// remembers finished projects; the sync itself never creates duplicates.
import { fetchArtemisProjects, fetchArtemisProject, lastArtemisStatus } from '../src/lib/artemis';
import { syncArtemisProjectData, isSigned } from '../src/lib/artemisSync';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PROGRESS = process.env.PROGRESS_FILE || './backfill-progress.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const done: Record<string, string> = existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')) : {};

const all = await fetchArtemisProjects(0);
if (!all) {
  console.log('LIST FAILED (rate limit or key)');
  process.exit(1);
}
all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
const signedOnly = all.filter((p) => isSigned(p));
console.log(`projects: ${all.length}, signed: ${signedOnly.length}, already done: ${Object.keys(done).length}`);
const map: Record<string, any> = {};
let n = 0, created = 0, linked = 0, staff = 0, skipped = 0, failed = 0;
for (const p0 of signedOnly) {
  if (done[p0.id]) continue;
  await sleep(1400); // ~43 Artemis calls/min
  let p = await fetchArtemisProject(p0.id);
  if (!p && lastArtemisStatus === 404) {
    console.log(`  - ${p0.id} (${p0.status}) not found in Artemis (deleted or not readable), skipped`);
    done[p0.id] = 'MISSING';
    writeFileSync(PROGRESS, JSON.stringify(done));
    continue;
  }
  for (let attempt = 1; !p && attempt <= 3; attempt++) {
    // Most likely a 429: wait out the per-minute window and retry the same project.
    console.log(`  ~ detail unavailable for ${p0.id} (${p0.status}), waiting 65s (attempt ${attempt}/3)`);
    await sleep(65000);
    p = await fetchArtemisProject(p0.id);
  }
  if (!p) {
    console.log(`  ! detail failed ${p0.id} (${p0.status}) - retried on rerun`);
    failed++;
    continue;
  }
  const r = await syncArtemisProjectData(p, 'backfill', map);
  n++;
  const tag = r.internal ? 'STAFF' : /new .* job/.test(r.jn) ? 'CREATED' : /linked|matched by marker|job updated|job ->/.test(r.jn) ? 'LINKED' : 'SKIP';
  if (tag === 'STAFF') staff++;
  else if (tag === 'CREATED') created++;
  else if (tag === 'LINKED') linked++;
  else skipped++;
  console.log(`${String(n).padStart(3)} ${tag.padEnd(7)} ${(p.homeowner.name || p.name).padEnd(26).slice(0, 26)} ${p.status.padEnd(18).slice(0, 18)} ${p.price ? '$' + Math.round(p.price).toLocaleString('en-US') : '-'} | ${r.jn}`);
  done[p.id] = tag;
  writeFileSync(PROGRESS, JSON.stringify(done));
}
console.log(`\nDONE processed=${n} created=${created} linked=${linked} staff=${staff} skipped=${skipped} detailFailed=${failed}`);
