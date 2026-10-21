import { Scene, MAT, C, iso, save } from './iso.mjs';

// lerp helper for 3D points
const L = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Draw shingle courses on the RIGHT slope of a gableY roof (x+dx side).
function coursesRight(s, x, y, dx, dy, z, h, n, color) {
  const xr = x + dx / 2, ridge = z + h;
  const eaveA = [x + dx, y, z], eaveB = [x + dx, y + dy, z];
  const ridgeA = [xr, y, ridge], ridgeB = [xr, y + dy, ridge];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const a = L(eaveA, ridgeA, t), b = L(eaveB, ridgeB, t);
    const a2 = L(eaveA, ridgeA, t - 0.012), b2 = L(eaveB, ridgeB, t - 0.012);
    s.add([a, b, b2, a2], color, { bias: 4 });
  }
}
function coursesLeft(s, x, y, dx, dy, z, h, n, color) {
  const xr = x + dx / 2, ridge = z + h;
  const eaveA = [x, y, z], eaveB = [x, y + dy, z];
  const ridgeA = [xr, y, ridge], ridgeB = [xr, y + dy, ridge];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const a = L(eaveA, ridgeA, t), b = L(eaveB, ridgeB, t);
    const a2 = L(eaveA, ridgeA, t - 0.012), b2 = L(eaveB, ridgeB, t - 0.012);
    s.add([a, b, b2, a2], color, { bias: 4 });
  }
}

// A leaning ladder against the right eave: rails + rungs, drawn as thin boxes near x+dx.
function ladder(s, baseX, baseY, topZ) {
  const w = 0.12, gap = 0.7;
  // two rails leaning: from ground (baseX, baseY) up to (baseX-0.4, baseY, topZ)
  for (const dy of [0, gap]) {
    const foot = [baseX, baseY + dy, 0], head = [baseX - 0.5, baseY + dy, topZ];
    // rail as a thin quad in the x-z plane at this y
    s.add([
      [foot[0], baseY + dy, 0], [foot[0] + w, baseY + dy, 0],
      [head[0] + w, baseY + dy, topZ], [head[0], baseY + dy, topZ],
    ], C.orange500, { bias: 20 });
  }
  // rungs
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const zx = baseX - 0.5 * t, zz = topZ * t;
    s.add([
      [zx, baseY, zz], [zx, baseY + gap, zz], [zx, baseY + gap, zz + 0.06], [zx, baseY, zz + 0.06],
    ], C.orange400, { bias: 21 });
  }
}

export function roofingHero() {
  const s = new Scene();
  // soft ground pad (subtle, slightly lighter than navy hero bg)
  s.tile([-1.2, -1.2, 0], 8.4, 7.4, C.navy800);
  s.tile([-0.6, -0.6, 0.001], 7.2, 6.2, C.navy700);

  // ---- main house ----
  const x = 0, y = 0, dx = 5, dy = 4, bh = 2.6, rh = 2.0;
  s.box([x, y, 0], [dx, dy, bh], MAT.light, { sw: 0.035 });
  // eave overhang base (thin slab under roof)
  s.box([x - 0.25, y - 0.25, bh - 0.02], [dx + 0.5, dy + 0.5, 0.12], { top: C.navy100, left: C.navy200, right: C.navy300 });
  // roof (solid, clean). camera-facing slope = mat.top (x-side).
  const roofMat = { top: C.navy700, left: C.navy800, right: C.navy500 };
  const ov = 0.25, rx = x - ov, ry = y - ov, rdx = dx + ov * 2, rdy = dy + ov * 2, rz = bh + 0.1;
  s.gableY([rx, ry], rdx, rdy, rz, rh, roofMat, { sw: 0.03 });
  // shingle courses on the camera-facing slope
  coursesLeft(s, rx, ry, rdx, rdy, rz, rh, 6, C.navy900);
  // 3D ridge cap straddling the ridge, orange accent
  const xr = rx + rdx / 2, ridge = rz + rh;
  s.box([xr - 0.09, ry, ridge - 0.06], [0.18, rdy, 0.12], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 40 });

  // chimney
  s.box([x + 0.7, y + 0.4, bh + 1.2], [0.6, 0.6, 1.3], { top: C.navy200, left: C.navy500, right: C.navy700 });
  s.box([x + 0.62, y + 0.32, bh + 2.45], [0.76, 0.76, 0.18], { top: C.orange400, left: C.orange500, right: C.orange600 });

  // door (front/left face y+dy) + windows
  s.panelY([x + 2.0, y + dy, 0], 1.0, 1.7, C.navy600);
  s.panelY([x + 2.08, y + dy, 0.08], 0.84, 1.54, C.navy700);
  s.add([[x + 2.42, y + dy, 0.7], [x + 2.5, y + dy, 0.7], [x + 2.5, y + dy, 0.78], [x + 2.42, y + dy, 0.78]], C.orange500, { bias: 7 });
  for (const wx of [0.5, 3.4]) {
    s.panelY([x + wx, y + dy, 0.95], 0.9, 0.95, C.white, { bias: 6 });
    s.panelY([x + wx + 0.07, y + dy, 1.02], 0.76, 0.8, C.glass, { bias: 7 });
  }
  // window on right face (x+dx)
  s.panelX([x + dx, y + 1.4, 0.95], 0.9, 0.95, C.white);
  s.panelX([x + dx, y + 1.47, 1.02], 0.76, 0.8, C.glass, { bias: 1 });

  // ladder against right eave
  ladder(s, x + dx + 0.15, y + 2.4, bh + 0.3);

  // shingle bundles stacked on ground (foreground right)
  let bx = x + dx + 0.9, by = y + 0.2;
  s.box([bx, by, 0], [1.1, 0.7, 0.16], MAT.shingle);
  s.box([bx + 0.05, by + 0.04, 0.16], [1.1, 0.7, 0.16], { top: C.navy500, left: C.navy600, right: C.navy800 });
  s.box([bx - 0.02, by + 0.85, 0], [1.1, 0.7, 0.16], { top: C.navy500, left: C.navy600, right: C.navy800 });

  // a small bush/tree blob (foreground left) for life
  s.box([x - 1.2, y + dy + 0.3, 0], [0.7, 0.7, 0.5], MAT.grass);
  s.box([x - 1.05, y + dy + 0.45, 0.5], [0.4, 0.4, 0.4], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });

  return s.render({ w: 1280, h: 1000, bg: 'none', pad: 70 });
}

// ---- Material swatches (card thumbnails). Compact isometric chunks. ----
const woodMat = { top: '#c98a4b', left: '#a96f38', right: '#7d4f25' };

export function swatchShingle() {
  const s = new Scene();
  s.box([0, -0.1, 0], [3, 2.7, 0.22], woodMat, { sw: 0.03 });   // deck (peeks at eave)
  // fully overlapping shingle courses; uniform navy, stepped fronts read as courses
  const shMat = { top: C.navy500, left: C.navy700, right: C.navy800 };
  for (let i = 0; i < 6; i++) {
    s.box([0, i * 0.46, 0.22 + i * 0.05], [3, 0.85, 0.09], shMat, { sw: 0.022 });
  }
  // staggered tab notches on the front course (orange hint of new shingles)
  for (const nx of [0.5, 1.5, 2.5]) {
    s.box([nx, 5 * 0.46, 0.22 + 5 * 0.05], [0.08, 0.85, 0.092], { top: C.navy900, left: C.navy900, right: C.navy900 }, { bias: 6 });
  }
  return s.render({ w: 760, h: 620, bg: 'none', pad: 60 });
}

export function swatchMetal() {
  const s = new Scene();
  s.box([0, 0, 0], [3, 2.6, 0.22], woodMat, { sw: 0.03 });
  s.box([0, 0, 0.22], [3, 2.6, 0.06], { top: C.navy200, left: C.navy400, right: C.navy600 }, { sw: 0.025 }); // sheet
  for (const sy of [0.25, 0.95, 1.65, 2.35]) {                  // standing seams along x
    s.box([0, sy, 0.28], [3, 0.08, 0.16], { top: C.navy100, left: C.navy300, right: C.navy500 }, { sw: 0.02 });
  }
  return s.render({ w: 760, h: 620, bg: 'none', pad: 60 });
}

export function swatchTile() {
  const s = new Scene();
  s.box([0, 0, 0], [3, 2.6, 0.22], woodMat, { sw: 0.03 });
  // barrel tile rows: each row = a low triangular prism ridge running along x
  for (let i = 0; i < 4; i++) {
    const y0 = i * 0.62;
    const m = { top: C.orange400, left: C.orange500, right: C.orange600 };
    s.gableX([0, y0], 3, 0.62, 0.22 + i * 0.01, 0.22, m, { sw: 0.022 });
  }
  return s.render({ w: 760, h: 620, bg: 'none', pad: 60 });
}

// ---- Feature: exploded roof system cutaway ("quality runs deeper") ----
export function roofCutaway() {
  const s = new Scene();
  const X = 3.4, Y = 2.8;
  // rafters (two wood beams) at bottom
  s.box([0.2, 0, 0], [0.4, Y, 0.35], woodMat, { sw: 0.03 });
  s.box([X - 0.6, 0, 0], [0.4, Y, 0.35], woodMat, { sw: 0.03 });
  // deck panel (wood) floating above
  s.box([0, 0, 0.9], [X, Y, 0.22], { top: '#d9ad79', left: '#b98a4f', right: '#946a35' }, { sw: 0.03 });
  // underlayment sheet (periwinkle)
  s.box([-0.05, -0.05, 1.5], [X + 0.1, Y + 0.1, 0.08], { top: C.navy200, left: C.navy300, right: C.navy400 }, { sw: 0.025 });
  // shingles (navy) on top, stepped courses
  for (let i = 0; i < 4; i++) {
    s.box([0, i * 0.68, 2.1 + i * 0.02], [X, 0.85, 0.1], { top: C.navy500, left: C.navy600, right: C.navy800 }, { sw: 0.025 });
  }
  // orange flashing accent tucked at the high edge
  s.box([-0.12, Y - 0.5, 2.15], [0.18, 0.5, 0.5], { top: C.orange400, left: C.orange500, right: C.orange600 }, { sw: 0.025 });
  return s.render({ w: 900, h: 900, bg: 'none', pad: 70 });
}

// ============ WINDOWS ============
const frameMat = { top: C.white, left: C.navy50, right: C.navy200 };
const glassMat = { top: '#dff1f5', left: C.glass, right: C.glassDk };

// A vertical window unit standing in the y-depth plane (front = y+depth face toward camera).
// muntins: 'h' horizontal bar, 'v' vertical bar, 'hv' both, 'none'.
function windowUnit(s, o, w, h, muntins = 'h', accent = false) {
  const [x, y, z] = o, depth = 0.18, fr = 0.12;
  const fm = accent ? { top: C.orange400, left: C.orange500, right: C.orange600 } : frameMat;
  s.box([x, y, z], [w, depth, h], fm, { sw: 0.02 });                       // frame block
  const fy = y + depth;                                                     // front face plane
  s.panelY([x + fr, fy, z + fr], w - 2 * fr, h - 2 * fr, C.glass, { bias: 8 }); // glass
  // glass sheen highlight: a lighter strip on the left portion
  s.add([[x + fr, fy, z + h - fr], [x + w * 0.5, fy, z + h - fr], [x + w * 0.5, fy, z + fr], [x + fr, fy, z + fr]], '#eaf6f9', { bias: 8.5, opacity: 0.3 });
  if (muntins.includes('h')) s.panelY([x + fr, fy, z + h / 2 - 0.04], w - 2 * fr, 0.08, C.white, { bias: 10 });
  if (muntins.includes('v')) s.panelY([x + w / 2 - 0.04, fy, z + fr], 0.08, h - 2 * fr, C.white, { bias: 10 });
}

export function swatchHung() {
  const s = new Scene();
  windowUnit(s, [0, 0, 0], 1.8, 2.4, 'h');
  return s.render({ w: 760, h: 620, bg: 'none', pad: 70 });
}
export function swatchSlider() {
  const s = new Scene();
  windowUnit(s, [0, 0, 0], 2.6, 1.9, 'v');
  return s.render({ w: 760, h: 620, bg: 'none', pad: 70 });
}
export function swatchBay() {
  const s = new Scene();
  // three angled panels projecting: center flat, two side panels stepped forward
  windowUnit(s, [0.0, 0.7, 0], 1.5, 2.2, 'h');          // center (set back)
  windowUnit(s, [-0.95, 0.0, 0], 1.0, 2.2, 'h');        // left, forward
  windowUnit(s, [1.5, 0.0, 0], 1.0, 2.2, 'h');          // right, forward
  // sill slab under the bay
  s.box([-1.05, -0.1, -0.25], [3.6, 1.0, 0.25], { top: C.navy100, left: C.navy200, right: C.navy300 });
  return s.render({ w: 820, h: 640, bg: 'none', pad: 60 });
}

export function windowCutaway() {
  const s = new Scene();
  // outer frame
  s.box([0, 0, 0], [2.6, 0.5, 2.8], frameMat, { sw: 0.025 });
  // two glass panes exploded along y (double pane + gas gap)
  s.panelY([0.2, 0.9, 0.2], 2.2, 2.4, C.glass, { bias: 14 });
  s.add([[0.2, 0.9, 0.2], [1.3, 0.9, 0.2], [1.3, 0.9, 2.6], [0.2, 0.9, 2.6]], '#eaf6f9', { bias: 14.5, opacity: 0.3 });
  s.panelY([0.2, 1.55, 0.2], 2.2, 2.4, C.glassDk, { bias: 16 });
  // spacer bar between panes (top)
  s.box([0.2, 0.9, 2.55], [2.2, 0.65, 0.1], { top: C.navy300, left: C.navy400, right: C.navy500 }, { bias: 18 });
  // orange Low-E accent tab
  s.box([-0.1, 0.85, 1.2], [0.16, 0.5, 0.5], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 20 });
  return s.render({ w: 900, h: 900, bg: 'none', pad: 80 });
}

export function windowsHero() {
  const s = new Scene();
  s.tile([-1.2, -1.2, 0], 8.4, 7.4, C.navy800);
  s.tile([-0.6, -0.6, 0.001], 7.2, 6.2, C.navy700);
  const x = 0, y = 0, dx = 5, dy = 4, bh = 2.8, rh = 1.7;
  s.box([x, y, 0], [dx, dy, bh], MAT.light, { sw: 0.035 });
  s.box([x - 0.25, y - 0.25, bh - 0.02], [dx + 0.5, dy + 0.5, 0.12], { top: C.navy100, left: C.navy200, right: C.navy300 });
  const roofMat = { top: C.navy600, left: C.navy800, right: C.navy500 };
  const ov = 0.25, rx = x - ov, ry = y - ov, rdx = dx + ov * 2, rdy = dy + ov * 2, rz = bh + 0.1;
  s.gableY([rx, ry], rdx, rdy, rz, rh, roofMat, { sw: 0.03 });
  const xr = rx + rdx / 2, ridge = rz + rh;
  s.box([xr - 0.09, ry, ridge - 0.06], [0.18, rdy, 0.12], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 40 });

  // big front-face (y+dy) windows, one accented as "new"
  windowUnit(s, [x + 0.4, y + dy - 0.18, 1.0], 1.2, 1.5, 'h');
  windowUnit(s, [x + 2.0, y + dy - 0.18, 1.0], 1.2, 1.5, 'h', true);  // new (orange)
  // door
  s.panelY([x + 3.6, y + dy, 0], 1.0, 1.9, C.navy600, { bias: 6 });
  s.panelY([x + 3.68, y + dy, 0.08], 0.84, 1.74, C.navy700, { bias: 7 });
  // right-face (x+dx) windows
  windowUnit(s, [x + dx - 0.18, y + 0.6, 1.0], 1.2, 1.5, 'h');
  windowUnit(s, [x + dx - 0.18, y + 2.3, 1.0], 1.2, 1.5, 'h');

  // shrubs flanking the house for life
  s.box([x + dx + 0.6, y + 0.4, 0], [0.7, 0.7, 0.5], MAT.grass);
  s.box([x + dx + 0.75, y + 0.55, 0.5], [0.4, 0.4, 0.4], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });
  s.box([x - 1.0, y + dy + 0.2, 0], [0.6, 0.6, 0.45], MAT.grass);
  s.box([x - 0.88, y + dy + 0.33, 0.45], [0.36, 0.36, 0.34], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });
  return s.render({ w: 1280, h: 1000, bg: 'none', pad: 70 });
}

// ============ INSULATION ============
const battMat = { top: C.navy100, left: C.navy200, right: C.navy300 };   // soft periwinkle batts
const battWarm = { top: '#ffe6cc', left: '#fdc88a', right: '#f6a04d' };   // warm batt alt

// a run of fluffy batt between/over joists: bumpy top via small stepped boxes
function battRun(s, x, y, z, len, wid, color) {
  const n = Math.max(3, Math.round(len / 0.5));
  for (let i = 0; i < n; i++) {
    const seg = len / n;
    const hz = 0.18 + (i % 2) * 0.05;
    s.box([x + i * seg, y, z], [seg * 0.96, wid, hz], color, { sw: 0.018 });
  }
}

export function swatchBatt() {
  const s = new Scene();
  // wood joists
  for (const jy of [0, 1.1, 2.2]) s.box([0, jy, 0], [3, 0.22, 0.5], woodMat, { sw: 0.025 });
  // batts between joists
  for (const by of [0.28, 1.38]) battRun(s, 0, by, 0.1, 3, 0.78, battMat);
  return s.render({ w: 760, h: 620, bg: 'none', pad: 60 });
}

export function swatchRadiant() {
  const s = new Scene();
  s.box([0, 0, 0], [3, 2.6, 0.22], woodMat, { sw: 0.03 });
  // reflective sheet (light periwinkle, near white)
  s.box([0, 0, 0.22], [3, 2.6, 0.05], { top: '#eaf1fb', left: C.navy100, right: C.navy300 }, { sw: 0.022 });
  // sun + deflected heat arrows (orange) bouncing off
  s.disc([3.2, -0.6, 2.2], 0.45, C.orange500, { bias: 60 });
  for (const ax of [0.6, 1.4, 2.2]) {
    // incoming ray
    s.add([[ax + 0.5, -0.3, 1.6], [ax + 0.62, -0.3, 1.66], [ax + 0.12, 0.4, 0.42], [ax, 0.4, 0.36]], C.orange400, { bias: 50 });
    // bounced ray
    s.add([[ax, 0.4, 0.36], [ax + 0.12, 0.4, 0.42], [ax - 0.4, 1.1, 1.3], [ax - 0.52, 1.1, 1.24]], C.orange500, { bias: 50 });
  }
  return s.render({ w: 820, h: 700, bg: 'none', pad: 50 });
}

export function swatchBlown() {
  const s = new Scene();
  s.box([0, 0, 0], [3, 2.6, 0.18], woodMat, { sw: 0.03 });
  // bumpy blown-in field: grid of small varied mounds
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let ix = 0; ix < 7; ix++) for (let iy = 0; iy < 6; iy++) {
    const h = 0.22 + rnd() * 0.22;
    s.box([0.1 + ix * 0.4, 0.1 + iy * 0.4, 0.18], [0.36, 0.36, h], battMat, { sw: 0.012 });
  }
  return s.render({ w: 760, h: 620, bg: 'none', pad: 55 });
}

export function insulationCutaway() {
  const s = new Scene();
  const X = 3.2, Y = 2.8;
  // drywall ceiling (bottom)
  s.box([0, 0, 0], [X, Y, 0.16], { top: C.navy50, left: C.navy100, right: C.navy200 }, { sw: 0.025 });
  // joists
  for (const jy of [0.2, 1.3, 2.4]) s.box([0, jy, 0.7], [X, 0.24, 0.5], woodMat, { sw: 0.022 });
  // batt insulation layer (floating above)
  battRun(s, 0, 0, 0.95, X, Y, battMat);
  // radiant barrier sheet (reflective, floating higher)
  s.box([-0.05, -0.05, 1.8], [X + 0.1, Y + 0.1, 0.06], { top: '#eaf1fb', left: C.navy100, right: C.navy300 }, { sw: 0.022 });
  // sun + heat accent
  s.disc([X + 0.6, -0.8, 3.0], 0.5, C.orange500, { bias: 80 });
  s.box([-0.12, Y - 0.5, 1.9], [0.18, 0.5, 0.5], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 60 });
  return s.render({ w: 900, h: 900, bg: 'none', pad: 70 });
}

export function insulationHero() {
  const s = new Scene();
  s.tile([-1.2, -1.2, 0], 8.4, 7.4, C.navy800);
  s.tile([-0.6, -0.6, 0.001], 7.2, 6.2, C.navy700);
  const x = 0, y = 0, dx = 5, dy = 4, bh = 2.6, rh = 1.9;
  s.box([x, y, 0], [dx, dy, bh], MAT.light, { sw: 0.035 });
  // windows + door
  for (const wx of [0.5, 3.4]) {
    s.panelY([x + wx, y + dy, 0.95], 0.9, 0.95, C.white, { bias: 6 });
    s.panelY([x + wx + 0.07, y + dy, 1.02], 0.76, 0.8, C.glass, { bias: 7 });
  }
  s.panelY([x + 2.0, y + dy, 0], 1.0, 1.7, C.navy600, { bias: 6 });
  // ceiling slab on top of walls
  s.box([x, y, bh], [dx, dy, 0.12], { top: C.navy50, left: C.navy100, right: C.navy200 });
  // attic insulation batts sitting on the ceiling (the reveal)
  battRun(s, x + 0.15, y + 0.15, bh + 0.12, dx - 0.3, dy - 0.3, battMat);
  // roof floating ABOVE the insulation (exploded, reveals attic)
  const ov = 0.25, rx = x - ov, ry = y - ov, rdx = dx + ov * 2, rdy = dy + ov * 2, rz = bh + 1.15;
  const roofMat = { top: C.navy600, left: C.navy800, right: C.navy500 };
  s.gableY([rx, ry], rdx, rdy, rz, rh, roofMat, { sw: 0.03 });
  const xr = rx + rdx / 2, ridge = rz + rh;
  s.box([xr - 0.09, ry, ridge - 0.06], [0.18, rdy, 0.12], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 60 });
  // sun + heat rays onto the roof
  s.disc([x + dx + 1.4, y - 1.4, ridge + 0.6], 0.6, C.orange500, { bias: 90 });
  for (const t of [0, 1, 2]) {
    const ax = x + dx + 0.4 - t * 0.5, az = ridge + 0.2 - t * 0.1;
    s.add([[ax + 0.5, y - 0.6, az + 0.5], [ax + 0.6, y - 0.6, az + 0.54], [ax + 0.1, y - 0.1, az + 0.0], [ax, y - 0.1, az - 0.04]], C.orange400, { bias: 70 });
  }
  // shrub
  s.box([x - 1.0, y + dy + 0.2, 0], [0.6, 0.6, 0.45], MAT.grass);
  s.box([x - 0.88, y + dy + 0.33, 0.45], [0.36, 0.36, 0.34], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });
  return s.render({ w: 1280, h: 1050, bg: 'none', pad: 70 });
}

// ============ HOME (flagship) ============
function tree(s, x, y, scale = 1) {
  s.box([x, y, 0], [0.22 * scale, 0.22 * scale, 0.6 * scale], { top: '#a9763f', left: '#8a5e31', right: '#6b4724' });
  s.box([x - 0.25 * scale, y - 0.25 * scale, 0.6 * scale], [0.7 * scale, 0.7 * scale, 0.6 * scale], MAT.grass);
  s.box([x - 0.12 * scale, y - 0.12 * scale, 1.2 * scale], [0.5 * scale, 0.5 * scale, 0.45 * scale], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });
}

export function homeHero() {
  const s = new Scene();
  s.tile([-1.6, -1.6, 0], 9.2, 8.0, C.navy800);
  s.tile([-1.0, -1.0, 0.001], 8.0, 6.8, C.navy700);

  const x = 0, y = 0, dx = 5.2, dy = 4, bh = 2.7, rh = 2.0;
  s.box([x, y, 0], [dx, dy, bh], MAT.light, { sw: 0.035 });
  s.box([x - 0.25, y - 0.25, bh - 0.02], [dx + 0.5, dy + 0.5, 0.12], { top: C.navy100, left: C.navy200, right: C.navy300 });
  const roofMat = { top: C.navy600, left: C.navy800, right: C.navy500 };
  const ov = 0.28, rx = x - ov, ry = y - ov, rdx = dx + ov * 2, rdy = dy + ov * 2, rz = bh + 0.1;
  s.gableY([rx, ry], rdx, rdy, rz, rh, roofMat, { sw: 0.03 });
  coursesLeft(s, rx, ry, rdx, rdy, rz, rh, 6, C.navy900);
  const xr = rx + rdx / 2, ridge = rz + rh;
  s.box([xr - 0.09, ry, ridge - 0.06], [0.18, rdy, 0.12], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 40 });
  // chimney
  s.box([x + 0.7, y + 0.45, bh + 1.1], [0.55, 0.55, 1.25], { top: C.navy200, left: C.navy500, right: C.navy700 });
  s.box([x + 0.62, y + 0.37, bh + 2.25], [0.71, 0.71, 0.18], { top: C.orange400, left: C.orange500, right: C.orange600 });

  // front-face windows + door
  windowUnit(s, [x + 0.5, y + dy - 0.18, 1.0], 1.1, 1.4, 'h');
  windowUnit(s, [x + 3.5, y + dy - 0.18, 1.0], 1.1, 1.4, 'h');
  s.panelY([x + 2.05, y + dy, 0], 1.0, 1.8, C.navy600, { bias: 6 });
  s.panelY([x + 2.13, y + dy, 0.08], 0.84, 1.64, C.navy700, { bias: 7 });
  s.add([[x + 2.78, y + dy, 0.85], [x + 2.86, y + dy, 0.85], [x + 2.86, y + dy, 0.93], [x + 2.78, y + dy, 0.93]], C.orange500, { bias: 8 });
  // right-face windows
  windowUnit(s, [x + dx - 0.18, y + 0.7, 1.0], 1.1, 1.4, 'h');
  windowUnit(s, [x + dx - 0.18, y + 2.4, 1.0], 1.1, 1.4, 'h');

  // front walkway path (tan tiles) from door out toward camera
  for (let i = 0; i < 4; i++) {
    s.tile([x + 2.1, y + dy + 0.15 + i * 0.5, 0.02], 0.9, 0.42, i % 2 ? C.navy100 : C.navy200);
  }
  // landscaping
  tree(s, x - 1.1, y + dy + 0.3, 1.1);
  s.box([x + dx + 0.6, y + 0.5, 0], [0.7, 0.7, 0.5], MAT.grass);
  s.box([x + dx + 0.75, y + 0.65, 0.5], [0.4, 0.4, 0.4], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });
  // sun
  s.disc([x + dx + 1.6, y - 1.6, ridge + 1.0], 0.6, C.orange500, { bias: 90, opacity: 0.95 });

  return s.render({ w: 1320, h: 1040, bg: 'none', pad: 70 });
}

// ============ PAGE HEROES ============
function miniHouse(s, x, y, scale = 1, roofTop = C.navy600) {
  const dx = 3.2 * scale, dy = 2.6 * scale, bh = 1.7 * scale, rh = 1.3 * scale;
  s.box([x, y, 0], [dx, dy, bh], MAT.light, { sw: 0.035 });
  s.box([x - 0.18, y - 0.18, bh - 0.02], [dx + 0.36, dy + 0.36, 0.08 * scale], { top: C.navy100, left: C.navy200, right: C.navy300 });
  const roofMat = { top: roofTop, left: C.navy800, right: C.navy500 };
  const ov = 0.18 * scale, rx = x - ov, ry = y - ov, rdx = dx + ov * 2, rdy = dy + ov * 2, rz = bh + 0.06;
  s.gableY([rx, ry], rdx, rdy, rz, rh, roofMat, { sw: 0.03 });
  const xr = rx + rdx / 2, ridge = rz + rh;
  s.box([xr - 0.06 * scale, ry, ridge - 0.04 * scale], [0.12 * scale, rdy, 0.08 * scale], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 40 });
  // window + door on front face
  s.panelY([x + 0.4 * scale, y + dy, 0.55 * scale], 0.7 * scale, 0.7 * scale, C.white, { bias: 6 });
  s.panelY([x + 0.46 * scale, y + dy, 0.61 * scale], 0.58 * scale, 0.58 * scale, C.glass, { bias: 7 });
  s.panelY([x + dx - 1.0 * scale, y + dy, 0], 0.7 * scale, 1.15 * scale, C.navy600, { bias: 6 });
}

export function neighborhoodScene() {
  const s = new Scene();
  s.tile([-2.0, -2.0, 0], 11, 9.5, C.navy800);
  s.tile([-1.4, -1.4, 0.001], 9.8, 8.3, C.navy700);
  miniHouse(s, 0, 0, 1.0, C.navy600);
  miniHouse(s, 4.2, 1.4, 0.85, C.navy500);
  miniHouse(s, 1.0, 3.6, 0.75, C.navy700);
  // trees
  tree(s, -1.3, 1.4, 1.0);
  tree(s, 5.6, -0.4, 0.85);
  s.box([3.4, 4.6, 0], [0.6, 0.6, 0.45], MAT.grass);
  s.box([3.52, 4.72, 0.45], [0.36, 0.36, 0.34], { top: '#d7e6c9', left: '#bcd3a8', right: '#9fbb8a' });
  // sun
  s.disc([6.4, -1.8, 4.2], 0.55, C.orange500, { bias: 90 });
  return s.render({ w: 1340, h: 1040, bg: 'none', pad: 70 });
}

function mapPin(s, x, y, z, scale = 1) {
  // head (orange disc) with a downward triangle stem, screen-space
  const head = iso(x, y, z + 1.2 * scale);
  const tip = iso(x, y, z);
  const r = 0.42 * scale;
  // stem triangle in screen space via raw, plus disc head, plus white dot
  s.disc([x, y, z + 1.2 * scale], r, C.orange500, { bias: 200 });
  s.disc([x, y, z + 1.2 * scale], r * 0.42, C.white, { bias: 201 });
  // stem: a thin triangle from head bottom to tip (screen space)
  s.raw([[head[0] - r * 0.5, head[1] + r * 0.4], [head[0] + r * 0.5, head[1] + r * 0.4], [tip[0], tip[1]]], C.orange600, { depth: 199.5 });
  // shadow on ground
  s.disc([x, y, z + 0.02], r * 0.5, C.navy900, { bias: 5, opacity: 0.3 });
}

export function contactScene() {
  const s = new Scene();
  s.tile([-1.6, -1.6, 0], 9.0, 7.6, C.navy800);
  s.tile([-1.0, -1.0, 0.001], 7.8, 6.4, C.navy700);
  miniHouse(s, 0, 0, 1.15, C.navy600);
  tree(s, -1.2, 1.6, 1.0);
  mapPin(s, 1.85, 1.3, 2.7, 1.25);
  s.disc([5.6, -1.4, 3.8], 0.5, C.orange500, { bias: 90, opacity: 0.9 });
  return s.render({ w: 1200, h: 1000, bg: 'none', pad: 80 });
}

// ============ INSPECTION POINT VIGNETTES ============
// thin stroke in the window front plane (y = fy), from (x1,z1) to (x2,z2)
function strokeY(s, fy, x1, z1, x2, z2, color, wdt = 0.055, bias = 14) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1;
  const ux = (-dz / len) * wdt, uz = (dx / len) * wdt;
  s.add([[x1 + ux, fy, z1 + uz], [x2 + ux, fy, z2 + uz], [x2 - ux, fy, z2 - uz], [x1 - ux, fy, z1 - uz]], color, { bias });
  // arrowhead
  const hx = (dx / len) * 0.16, hz = (dz / len) * 0.16;
  s.add([[x2 + hx, fy, z2 + hz], [x2 - hz * 0.9, fy, z2 + hx * 0.9], [x2 + hz * 0.9, fy, z2 - hx * 0.9]], color, { bias: bias + 0.1 });
}
function shingleSlab(s) {
  s.box([0, -0.1, 0], [3, 2.7, 0.22], woodMat, { sw: 0.03 });
  for (let i = 0; i < 4; i++) s.box([0, i * 0.62, 0.22 + i * 0.04], [3, 0.8, 0.09], { top: C.navy500, left: C.navy700, right: C.navy800 }, { sw: 0.02 });
}

export function inspRoofFlashing() {
  const s = new Scene();
  shingleSlab(s);
  s.box([1.0, 0.8, 0.45], [0.9, 0.9, 1.4], { top: C.navy200, left: C.navy500, right: C.navy700 }, { sw: 0.03 }); // chimney
  s.box([0.88, 0.68, 0.45], [1.14, 1.14, 0.14], { top: C.orange400, left: C.orange500, right: C.orange600 }, { bias: 7 }); // flashing skirt
  return s.render({ w: 760, h: 700, bg: 'none', pad: 60 });
}

export function inspRoofVent() {
  const s = new Scene();
  shingleSlab(s);
  s.box([0.2, 1.0, 0.45], [2.6, 0.62, 0.2], { top: C.navy200, left: C.navy400, right: C.navy600 }, { bias: 6 }); // ridge vent
  for (const ax of [0.7, 1.5, 2.3]) {
    s.add([[ax, 1.31, 0.72], [ax + 0.08, 1.31, 0.76], [ax + 0.5, 1.31, 1.5], [ax + 0.42, 1.31, 1.46]], C.orange500, { bias: 20 });
    s.add([[ax + 0.46, 1.31, 1.62], [ax + 0.3, 1.31, 1.36], [ax + 0.62, 1.31, 1.4]], C.orange500, { bias: 20.1 });
  }
  return s.render({ w: 800, h: 720, bg: 'none', pad: 55 });
}

export function inspRoofLeak() {
  const s = new Scene();
  s.box([0, 0, 0], [3, 2.6, 0.26], { top: C.navy50, left: C.navy100, right: C.navy200 }, { sw: 0.03 }); // ceiling
  s.box([0.95, 0.8, 0.26], [1.05, 0.95, 0.015], { top: '#b98a4f', left: '#a07440', right: '#835e33' }, { bias: 5 }); // stain
  s.box([0.7, 1.15, 0.26], [0.7, 0.6, 0.015], { top: '#caa06a', left: '#b08850', right: '#8f6c3c' }, { bias: 5 });
  s.disc([1.55, 1.2, 1.15], 0.16, C.glass, { bias: 40 });
  s.disc([1.2, 1.55, 0.85], 0.12, C.glassDk, { bias: 40 });
  s.disc([1.75, 0.95, 0.6], 0.09, C.glass, { bias: 40 });
  return s.render({ w: 760, h: 700, bg: 'none', pad: 60 });
}

export function inspWinSeal() {
  const s = new Scene();
  const w = 2.2, h = 2.6, depth = 0.18, fr = 0.12, fy = depth;
  s.box([0, 0, 0], [w, depth, h], frameMat, { sw: 0.02 });
  s.panelY([fr, fy, fr], w - 2 * fr, h - 2 * fr, '#c4ccd1', { bias: 8 }); // fogged glass
  for (const [dx, dz] of [[0.5, 0.6], [0.85, 1.4], [1.3, 0.9], [1.6, 1.85], [1.0, 2.0], [0.65, 1.7], [1.45, 1.5]]) {
    s.disc([dx, fy, dz], 0.06, '#eef3f6', { bias: 10 });
  }
  s.panelY([fr, fy, h / 2 - 0.04], w - 2 * fr, 0.08, C.white, { bias: 9 });
  return s.render({ w: 700, h: 740, bg: 'none', pad: 70 });
}

export function inspWinDraft() {
  const s = new Scene();
  const w = 2.2, h = 2.6, depth = 0.18, fr = 0.12, fy = depth;
  s.box([0, 0, 0], [w, depth, h], frameMat, { sw: 0.02 });
  s.panelY([fr, fy, fr], w - 2 * fr, h - 2 * fr, C.glass, { bias: 8 });
  s.panelY([fr, fy, h / 2 - 0.04], w - 2 * fr, 0.08, C.white, { bias: 9 });
  // orange draft arrows pushing in at gaps
  strokeY(s, fy, -0.6, 2.05, 0.15, 1.85, C.orange500);
  strokeY(s, fy, -0.55, 1.25, 0.15, 1.15, C.orange500);
  strokeY(s, fy, w + 0.6, 0.65, w - 0.15, 0.8, C.orange500);
  return s.render({ w: 760, h: 740, bg: 'none', pad: 60 });
}

export function inspInsGap() {
  const s = new Scene();
  for (const jy of [0, 1.1, 2.2]) s.box([0, jy, 0], [3, 0.22, 0.5], woodMat, { sw: 0.025 });
  battRun(s, 0, 0.28, 0.1, 3, 0.78, battMat);
  battRun(s, 0, 1.38, 0.1, 1.05, 0.78, battMat);
  battRun(s, 1.95, 1.38, 0.1, 1.05, 0.78, battMat);
  // escaping-air arrow through the gap
  s.add([[1.45, 1.7, 0.3], [1.55, 1.7, 0.36], [1.2, 1.7, 1.35], [1.1, 1.7, 1.29]], C.orange500, { bias: 30 });
  s.add([[1.16, 1.7, 1.46], [1.0, 1.7, 1.2], [1.32, 1.7, 1.24]], C.orange500, { bias: 30.1 });
  return s.render({ w: 800, h: 660, bg: 'none', pad: 55 });
}

const which = process.argv[2];
const out = {
  home: ['out-home-hero.svg', homeHero],
  neighborhood: ['out-neighborhood.svg', neighborhoodScene],
  contact: ['out-contact.svg', contactScene],
  iflash: ['out-insp-roof-flashing.svg', inspRoofFlashing],
  ivent: ['out-insp-roof-vent.svg', inspRoofVent],
  ileak: ['out-insp-roof-leak.svg', inspRoofLeak],
  iseal: ['out-insp-win-seal.svg', inspWinSeal],
  idraft: ['out-insp-win-draft.svg', inspWinDraft],
  igap: ['out-insp-ins-gap.svg', inspInsGap],
  roofing: ['out-roofing-hero.svg', roofingHero],
  shingle: ['out-mat-shingle.svg', swatchShingle],
  metal: ['out-mat-metal.svg', swatchMetal],
  tile: ['out-mat-tile.svg', swatchTile],
  cutaway: ['out-roof-cutaway.svg', roofCutaway],
  windows: ['out-windows-hero.svg', windowsHero],
  whung: ['out-win-hung.svg', swatchHung],
  wslider: ['out-win-slider.svg', swatchSlider],
  wbay: ['out-win-bay.svg', swatchBay],
  wcut: ['out-window-cutaway.svg', windowCutaway],
  insulation: ['out-insulation-hero.svg', insulationHero],
  ibatt: ['out-ins-batt.svg', swatchBatt],
  iradiant: ['out-ins-radiant.svg', swatchRadiant],
  iblown: ['out-ins-blown.svg', swatchBlown],
  icut: ['out-insulation-cutaway.svg', insulationCutaway],
};
if (which === 'all') {
  for (const k of Object.keys(out)) { save(out[k][0], out[k][1]()); }
  console.log('all roofing assets saved');
} else if (out[which]) {
  save(out[which][0], out[which][1]());
  console.log(out[which][0], 'saved');
}
