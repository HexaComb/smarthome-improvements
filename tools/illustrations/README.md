# Isometric illustrations

The brand isometric SVGs in `public/illustrations/` are generated, not hand-drawn.
This keeps them consistent (one 2:1 projection, one brand-shaded palette) and easy
to tweak.

## Regenerate

```bash
node tools/illustrations/build.mjs
```

Writes all 18 SVGs into `public/illustrations/`. Output is deterministic, so
re-running with no code changes produces no git diff.

## Files

- `iso.mjs` — the engine. A `Scene` projects 3D points to 2:1 isometric, sorts
  faces back-to-front (painter's algorithm), and emits brand-shaded polygons.
  Primitives: `box`, `gableY`/`gableX` (roofs), `tile`, `panelY`/`panelX` (wall
  decals), `disc` (sun / pin head). Palette + face-shading ramps live in `C` / `MAT`.
- `scenes.mjs` — composes the primitives into named scenes (heroes, material
  swatches, cutaways, page-header scenes). Each is an `export function` returning
  an SVG string.
- `build.mjs` — maps each scene to its `public/illustrations/*.svg` filename.

## Conventions

- Shading: top faces lightest, then left, right darkest. Light comes from upper-left.
- Brand only: navy / periwinkle / orange + a little wood and muted grass. No em/en
  dashes anywhere (including alt text in the wiring).
- Coplanar wall decals (windows, doors) need a depth `bias` so they sort above the
  wall they sit on; the `panel*` helpers set this automatically.

## Where they're used

- Service hubs (`ServiceHub.astro`): `heroIllustration`, `featureIllustration`, and
  per-material `illustration` in `src/data/serviceContent.ts`.
- Homepage (`src/pages/index.astro`): `home-hero.svg`.
- Page headers (`PageHero.astro` `illustration` prop): about, blog, projects,
  contact, service-areas.
