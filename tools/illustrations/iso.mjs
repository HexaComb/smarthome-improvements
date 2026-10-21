// Isometric SVG generator for Smart Home Improvements.
// 2:1-ish true-iso projection (30deg). Brand-shaded faces, painter ordering.
import { writeFileSync } from 'node:fs';

// ---- Brand palette ----
export const C = {
  navy950: '#0e1d33', navy900: '#142a48', navy800: '#1a3860', navy700: '#1f4373',
  navy600: '#255188', navy500: '#2f6098', navy400: '#4a79b2', navy300: '#7ea3cf',
  navy200: '#a9c0e3', navy100: '#d8e3f1', navy50: '#eef3f9',
  orange600: '#df7110', orange500: '#f6871f', orange400: '#f9a04d', orange200: '#fdc88a',
  white: '#ffffff', glass: '#bfe0e8', glassDk: '#7fb6c4',
};

// Shade triples {top,left,right} from a base ramp for a material.
export const MAT = {
  navy:   { top: C.navy300, left: C.navy500, right: C.navy700 },
  navyLt: { top: C.navy100, left: C.navy200, right: C.navy400 },
  peri:   { top: C.navy100, left: C.navy200, right: C.navy300 },
  orange: { top: C.orange400, left: C.orange500, right: C.orange600 },
  light:  { top: C.white, left: C.navy50, right: C.navy100 },
  shingle:{ top: C.navy400, left: C.navy600, right: C.navy800 },
  metal:  { top: C.navy200, left: C.navy400, right: C.navy600 },
  tile:   { top: C.orange400, left: C.orange500, right: C.orange600 },
  wood:   { top: '#c98a4b', left: '#a96f38', right: '#7d4f25' },
  grass:  { top: '#cfe0c2', left: '#b6cda6', right: '#9bb98a' },
};

const COS = Math.cos(Math.PI / 6); // 0.8660
const SIN = Math.sin(Math.PI / 6); // 0.5

export function iso(x, y, z) {
  return [(x - y) * COS, (x + y) * SIN - z];
}

// A scene collects faces with a depth key; we sort painter back-to-front.
export class Scene {
  constructor() { this.faces = []; }
  // depth: larger = nearer camera (drawn later). camera at +x,+y,+z.
  add(pts3, fill, opts = {}) {
    let depth = opts.depth ?? pts3.reduce((s, p) => s + p[0] + p[1] + p[2], 0) / pts3.length;
    depth += opts.bias ?? 0;
    const proj = pts3.map((p) => iso(p[0], p[1], p[2]));
    this.faces.push({ proj, fill, depth, stroke: opts.stroke, sw: opts.sw, opacity: opts.opacity });
  }
  // Box: o=[x,y,z] min corner, s=[dx,dy,dz]. mat={top,left,right}. Visible: top, left(y+dy), right(x+dx).
  box(o, s, mat, opts = {}) {
    const [x, y, z] = o, [dx, dy, dz] = s;
    const tw = opts.stroke ?? C.navy950, sw = opts.sw ?? 0;
    const so = { stroke: tw, sw };
    // right face (x = x+dx, normal +x) -> darkest
    this.add([[x + dx, y, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x + dx, y, z + dz]], mat.right, so);
    // left face (y = y+dy, normal +y) -> medium
    this.add([[x, y + dy, z], [x + dx, y + dy, z], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]], mat.left, so);
    // top face -> lightest
    this.add([[x, y, z + dz], [x + dx, y, z + dz], [x + dx, y + dy, z + dz], [x, y + dy, z + dz]], mat.top, so);
  }
  // Gable roof over footprint o=[x,y,z] size [dx,dy] base, height h. Ridge runs along Y (length dy).
  gableY(o, dx, dy, z, h, mat, opts = {}) {
    const [x, y] = o;
    const xr = x + dx / 2;
    const sw = opts.sw ?? 0, st = opts.stroke ?? C.navy950, so = { stroke: st, sw };
    const ridgeTop = z + h;
    // right slope (x+dx side) darkest
    this.add([[x + dx, y, z], [x + dx, y + dy, z], [xr, y + dy, ridgeTop], [xr, y, ridgeTop]], mat.right, so);
    // left slope (x side) lighter
    this.add([[x, y, z], [x, y + dy, z], [xr, y + dy, ridgeTop], [xr, y, ridgeTop]], mat.top, so);
    // front gable triangle (y+dy)
    this.add([[x, y + dy, z], [x + dx, y + dy, z], [xr, y + dy, ridgeTop]], mat.left, so);
    return { ridgeTop, xr };
  }
  // Gable roof, ridge along X (length dx).
  gableX(o, dx, dy, z, h, mat, opts = {}) {
    const [x, y] = o;
    const yr = y + dy / 2;
    const sw = opts.sw ?? 0, st = opts.stroke ?? C.navy950, so = { stroke: st, sw };
    const ridgeTop = z + h;
    // left slope (y+dy side) medium
    this.add([[x, y + dy, z], [x + dx, y + dy, z], [x + dx, yr, ridgeTop], [x, yr, ridgeTop]], mat.left, so);
    // right/front slope (y side) lightest (faces camera-ish)
    this.add([[x, y, z], [x + dx, y, z], [x + dx, yr, ridgeTop], [x, yr, ridgeTop]], mat.top, so);
    // right gable triangle (x+dx)
    this.add([[x + dx, y, z], [x + dx, y + dy, z], [x + dx, yr, ridgeTop]], mat.right, so);
    return { ridgeTop, yr };
  }
  // Flat tile on the ground (z plane), o=[x,y,z] size dx,dy.
  tile(o, dx, dy, fill, opts = {}) {
    const [x, y, z] = o;
    this.add([[x, y, z], [x + dx, y, z], [x + dx, y + dy, z], [x, y + dy, z]], fill, opts);
  }
  // Vertical quad facing +y (a wall detail like a window/door), at y plane.
  panelY(o, w, hgt, fill, opts = {}) {
    const [x, y, z] = o;
    this.add([[x, y, z], [x + w, y, z], [x + w, y, z + hgt], [x, y, z + hgt]], fill, { bias: 6, ...opts });
  }
  // Vertical quad facing +x, at x plane (spans y,z).
  panelX(o, depth, hgt, fill, opts = {}) {
    const [x, y, z] = o;
    this.add([[x, y, z], [x, y + depth, z], [x, y + depth, z + hgt], [x, y, z + hgt]], fill, { bias: 6, ...opts });
  }
  raw(proj2d, fill, opts = {}) {
    this.faces.push({ proj: proj2d, fill, depth: opts.depth ?? 0, stroke: opts.stroke, sw: opts.sw, opacity: opts.opacity });
  }
  // Screen-space disc centered at a 3D point, radius in world units.
  disc(center3, rWorld, fill, opts = {}) {
    const c = iso(center3[0], center3[1], center3[2]);
    const depth = (opts.depth ?? center3[0] + center3[1] + center3[2]) + (opts.bias ?? 0);
    this.faces.push({ circle: true, c, r: rWorld, fill, depth, opacity: opts.opacity, stroke: opts.stroke, sw: opts.sw });
  }

  render({ w = 1200, h = 900, pad = 60, bg = 'none', scale = null } = {}) {
    const sorted = [...this.faces].sort((a, b) => a.depth - b.depth);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of sorted) {
      if (f.circle) {
        minX = Math.min(minX, f.c[0] - f.r); maxX = Math.max(maxX, f.c[0] + f.r);
        minY = Math.min(minY, f.c[1] - f.r); maxY = Math.max(maxY, f.c[1] + f.r);
        continue;
      }
      for (const [px, py] of f.proj) {
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
    }
    const bw = maxX - minX, bh = maxY - minY;
    const s = scale ?? Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    const offX = (w - bw * s) / 2 - minX * s;
    const offY = (h - bh * s) / 2 - minY * s;
    const P = (p) => `${(p[0] * s + offX).toFixed(2)},${(p[1] * s + offY).toFixed(2)}`;
    let body = '';
    for (const f of sorted) {
      const st = f.sw ? ` stroke="${f.stroke}" stroke-width="${f.sw * s}" stroke-linejoin="round"` : '';
      const op = f.opacity != null ? ` opacity="${f.opacity}"` : '';
      if (f.circle) {
        const cx = (f.c[0] * s + offX).toFixed(2), cy = (f.c[1] * s + offY).toFixed(2), r = (f.r * s).toFixed(2);
        body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f.fill}"${st}${op}/>`;
        continue;
      }
      const pts = f.proj.map(P).join(' ');
      body += `<polygon points="${pts}" fill="${f.fill}"${st}${op}/>`;
    }
    const bgRect = bg === 'none' ? '' : `<rect width="${w}" height="${h}" fill="${bg}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bgRect}${body}</svg>`;
  }
}

export function save(path, svg) { writeFileSync(path, svg); }
