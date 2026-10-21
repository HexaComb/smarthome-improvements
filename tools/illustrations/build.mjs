// Regenerate every isometric illustration into public/illustrations/.
// Run: node tools/illustrations/build.mjs   (from the repo root)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as S from './scenes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../public/illustrations');
mkdirSync(outDir, { recursive: true });

// public filename -> exported scene function
const map = {
  'home-hero.svg': S.homeHero,
  'roofing-hero.svg': S.roofingHero,
  'mat-shingle.svg': S.swatchShingle,
  'mat-metal.svg': S.swatchMetal,
  'mat-tile.svg': S.swatchTile,
  'roof-cutaway.svg': S.roofCutaway,
  'windows-hero.svg': S.windowsHero,
  'mat-win-hung.svg': S.swatchHung,
  'mat-win-slider.svg': S.swatchSlider,
  'mat-win-bay.svg': S.swatchBay,
  'window-cutaway.svg': S.windowCutaway,
  'insulation-hero.svg': S.insulationHero,
  'mat-ins-batt.svg': S.swatchBatt,
  'mat-ins-radiant.svg': S.swatchRadiant,
  'mat-ins-blown.svg': S.swatchBlown,
  'insulation-cutaway.svg': S.insulationCutaway,
  'neighborhood.svg': S.neighborhoodScene,
  'contact.svg': S.contactScene,
  'insp-roof-flashing.svg': S.inspRoofFlashing,
  'insp-roof-vent.svg': S.inspRoofVent,
  'insp-roof-leak.svg': S.inspRoofLeak,
  'insp-win-seal.svg': S.inspWinSeal,
  'insp-win-draft.svg': S.inspWinDraft,
  'insp-ins-gap.svg': S.inspInsGap,
};

for (const [name, fn] of Object.entries(map)) {
  writeFileSync(resolve(outDir, name), fn());
  console.log('wrote', name);
}
console.log(`\nDone. ${Object.keys(map).length} illustrations written to public/illustrations/.`);
