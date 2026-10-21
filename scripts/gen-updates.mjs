// Build-time work-log generator: turns recent git commit subjects into
// dashboard work-log entries (src/data/updates.generated.json). Runs before
// astro build (see package.json / vercel.json buildCommand), so every deploy
// refreshes the log automatically. Vercel clones shallowly by default; set
// VERCEL_DEEP_CLONE=true in project env for history beyond ~10 commits.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/data/updates.generated.json', import.meta.url);

// MERGE with the committed file, never overwrite: Vercel clones shallowly
// (~10 commits), so a plain overwrite would shrink the log on every deploy.
let existing = [];
try {
  existing = JSON.parse(readFileSync(FILE, 'utf8'));
  if (!Array.isArray(existing)) existing = [];
} catch {
  existing = [];
}

let fresh = [];
try {
  const out = execSync('git log --no-merges --since=120.days --date=short --pretty=%ad\x1f%s', {
    encoding: 'utf8',
  });
  fresh = out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [date, text] = l.split('\x1f');
      return { date, text };
    })
    .filter((e) => e.date && e.text && !/^(wip|chore|merge|typo)\b/i.test(e.text));
} catch (e) {
  console.warn('gen-updates: git log unavailable, keeping existing file');
  process.exit(0);
}

const seen = new Set(existing.map((e) => e.date + '|' + e.text));
const added = fresh.filter((e) => !seen.has(e.date + '|' + e.text));
// Newest first; within a day keep git order (git log is already newest-first,
// and Array.sort is stable) so same-day entries read in the order they shipped.
const merged = [...added, ...existing].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

writeFileSync(FILE, JSON.stringify(merged, null, 1));
console.log(`gen-updates: ${added.length} new, ${merged.length} total entries`);
