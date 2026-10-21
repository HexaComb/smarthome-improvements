// Accessibility gate: run axe-core over representative built pages.
//
//   npm run build && npm run a11y
//
// Loads built HTML into jsdom, injects axe-core, and fails the run (exit 1)
// on any serious or critical violation. No browser or dev server needed, so
// it is safe in CI. color-contrast is skipped because it needs a real
// rendering engine; contrast is checked manually against the brand palette.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Representative pages: a paid-ads landing page (LandingLayout + LandingForm)
// and the FAQ page (Layout + Header/Footer + details/summary accordions).
const PAGES = ['lp/facebook/roofing/index.html', 'faq/index.html'];

// The Vercel adapter writes the static site to dist/client; a plain static
// build writes to dist. Accept either. Retry a few times before failing:
// right after a build, the adapter's asset rearrange (or AV indexing on
// Windows) can briefly race existsSync on a file that is really there.
async function resolvePage(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const base of ['dist/client', 'dist']) {
      const full = path.join(root, base, page);
      if (existsSync(full)) return full;
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
  }
  console.error(`Built page not found: ${page} (looked in dist/client and dist). Run "npm run build" first.`);
  process.exit(1);
}

const FAIL_IMPACTS = new Set(['serious', 'critical']);
let failing = 0;

for (const page of PAGES) {
  const file = await resolvePage(page);
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://www.smarthomeimprove.com/' + page.replace(/index\.html$/, ''),
  });
  const { window } = dom;

  // Content inside closed <details> is hidden from axe; force every
  // accordion open so FAQ answers and mobile nav sections get scanned.
  window.document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));

  window.eval(axeSource);
  const results = await window.eval(`axe.run(document, {
    resultTypes: ['violations'],
    rules: { 'color-contrast': { enabled: false } }
  })`);

  const serious = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact));
  console.log(`\n${page}: ${results.violations.length} violation(s), ${serious.length} serious/critical`);
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const n of v.nodes.slice(0, 5)) {
      console.log(`      ${n.target.join(' ')}`);
    }
  }
  failing += serious.length;
  window.close();
}

if (failing > 0) {
  console.error(`\nFAIL: ${failing} serious/critical violation(s) across ${PAGES.length} page(s).`);
  process.exit(1);
}
console.log(`\nPASS: no serious or critical violations across ${PAGES.length} page(s).`);
