// Draws a lesson's own object from a parts list, in the Anatomy kit's style.
// Claude writes the parts list for each lesson (see PACK_SCHEMA in generate.js), so the picture
// is a real object that fits the topic: a force plate for jump testing, a stopwatch for pacing.
// This module checks the list, lays the parts on a base plate, paints them back to front and
// lights the parts that belong to the step the reader picked.
//
// Coordinates are world units: x and y on the bench, z up. The object sits roughly within
// x, y in [-100, 100] and z in [0, 140]. The base plate is drawn for it.

import * as k from './vendor/anatomy/iso-kit.mjs';
import * as G from './vendor/anatomy/lathe.mjs';

export const SHAPES = ['box', 'cylinder', 'rod', 'dial', 'screen'];
export const DETAILS = ['none', 'screws', 'groove', 'knurl', 'ticks', 'vents', 'label'];
const TONE = {base: 'lo', structure: 'mid', subject: 'hi'};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));

/** Cleans a parts list from the model. Returns null when there is too little to draw. */
export function cleanScene(scene, partCount = 0) {
  if (!scene || !Array.isArray(scene.parts)) return null;
  const parts = [];
  for (const p of scene.parts.slice(0, 48)) {
    if (!SHAPES.includes(p?.shape)) continue;
    const [x, y, z] = (Array.isArray(p.at) ? p.at : []).map((v, i) => clamp(v, i === 2 ? 0 : -110, i === 2 ? 150 : 110));
    const [w, d, h] = (Array.isArray(p.size) ? p.size : []).map(v => clamp(v, 0.6, 180));
    if ([x, y, z, w, d, h].some(v => !Number.isFinite(v))) continue;
    parts.push({
      shape: p.shape, x, y, z, w, d, h,
      axis: ['x', 'y', 'z'].includes(p.axis) ? p.axis : 'z',
      tone: TONE[p.tone] ? p.tone : 'structure',
      detail: DETAILS.includes(p.detail) ? p.detail : 'none',
      link: Number.isInteger(p.link) && p.link >= 0 && p.link < partCount ? p.link : -1,
    });
  }
  if (parts.length < 4) return null;
  return {object: String(scene.object || '').slice(0, 80), azimuth: clamp(scene.azimuth ?? 45, 25, 65), parts};
}

// The floor plan a part covers, for the base plate, overlap tests and fitting.
function planOf(p) {
  if (p.shape === 'cylinder' || p.shape === 'dial') return {x: p.x - p.w / 2, y: p.y - p.w / 2, w: p.w, d: p.w};
  if (p.shape === 'rod') {
    const r = p.w / 2;
    return p.axis === 'x' ? {x: p.x, y: p.y - r, w: p.h, d: p.w} : p.axis === 'y' ? {x: p.x - r, y: p.y, w: p.w, d: p.h} : {x: p.x - r, y: p.y - r, w: p.w, d: p.w};
  }
  return {x: p.x - p.w / 2, y: p.y - p.d / 2, w: p.w, d: p.d};
}
const zRange = p => p.shape === 'rod' && p.axis !== 'z' ? [p.z - p.w / 2, p.z + p.w / 2] : [p.z, p.z + (p.shape === 'cylinder' || p.shape === 'dial' || p.shape === 'rod' ? p.h : p.h)];
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

/**
 * Painter's order. A part resting on or above another part it overlaps is drawn after it;
 * otherwise the part further from the viewer is drawn first.
 */
export function paintOrder(parts, P) {
  const n = parts.length;
  const plans = parts.map(planOf);
  const zs = parts.map(zRange);
  const depth = parts.map((p, i) => k.depthOf([plans[i].x + plans[i].w / 2, plans[i].y + plans[i].d / 2, 0], P));
  const before = Array.from({length: n}, () => new Set());
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (overlap(plans[i], plans[j])) {
        if (zs[i][1] <= zs[j][0] + 0.5 && zs[i][0] < zs[j][0]) before[j].add(i); // i holds j up
      }
    }
  }
  const order = [];
  const done = new Set();
  const ready = () => [...Array(n).keys()].filter(i => !done.has(i) && [...before[i]].every(b => done.has(b)));
  while (order.length < n) {
    let list = ready();
    if (!list.length) list = [...Array(n).keys()].filter(i => !done.has(i)); // a cycle: fall back to depth
    list.sort((a, b) => depth[a] - depth[b] || zs[a][0] - zs[b][0]);
    order.push(list[0]);
    done.add(list[0]);
  }
  return order;
}

function partSvg(p, P, lit) {
  const S = (paths, style) => k.solidSvg(paths, {tone: TONE[p.tone], crease: p.tone === 'subject' ? 'lo' : 'faint', lit, className: p.link >= 0 ? 'pick' : undefined, ...style});
  const L = (d, style) => k.lineSvg(d, style);
  const D = (pts, style) => k.dotsSvg(pts, style);
  const at = q => k.iso(q, P);
  const out = [];
  const top = p.z + p.h;
  if (p.shape === 'box' || p.shape === 'screen') {
    const plan = {x: p.x - p.w / 2, y: p.y - p.d / 2, w: p.w, d: p.d, r: Math.min(3, p.w / 6, p.d / 6)};
    const steps = plan.r > 1.5 ? 4 : 2;
    out.push(S(k.slabOf(plan, p.z, p.h, P, steps, Math.min(1, p.h / 8)), {inner: p.h > 14 && p.detail !== 'none' ? L(k.sideSeam(plan, p.z + p.h * 0.3, P, steps), {tone: 'faint'}) : ''}));
    if (p.shape === 'screen' && p.w > 8 && p.d > 8) {
      const face = k.insetPlan(plan, Math.min(3, p.w / 8));
      out.push(L(k.planOutline(face, top, P, 2), {tone: 'mid'}));
      [0.7, 0.5, 0.35].forEach((share, i) => {
        const y = face.y + face.d * (0.3 + i * 0.2);
        out.push(L(k.lineOnTop([face.x + 3, y], [face.x + 3 + (face.w - 6) * share, y], top, P), {tone: lit ? 'hi' : 'lo', free: true}));
      });
    }
    if (p.detail === 'groove' && p.w > 10 && p.d > 10) out.push(L(k.planOutline(k.insetPlan(plan, Math.min(4, p.w / 6, p.d / 6)), top, P, steps), {tone: 'faint'}));
    if (p.detail === 'screws' && p.w > 10 && p.d > 10) {
      const c = k.corners(plan, Math.min(4, p.w / 5, p.d / 5));
      out.push(D(c.map(([x, y]) => at([x, y, top])), {size: 0.5}));
    }
    if (p.detail === 'vents' && p.w > 16 && p.d > 10) {
      for (let i = 0; i < 4; i++) {
        const slot = {x: plan.x + 4, y: plan.y + 3 + i * Math.min(4, (p.d - 6) / 4), w: p.w - 8, d: 1.4, r: 0.7};
        out.push(L(k.planOutline(slot, top, P, 2), {tone: 'faint'}));
      }
    }
    if (p.detail === 'ticks' && p.w > 12) {
      const t = k.topTicks(plan.x + 2, plan.x + plan.w - 2, Math.max(2, p.w / 24), 5, plan.y + 0.6, top, [Math.min(2, p.d / 3), Math.min(3.6, p.d / 2)], P);
      out.push(L(t.minor, {tone: 'lo'}), L(t.major, {tone: 'mid'}));
    }
    if (p.detail === 'label' && p.w > 14 && p.d > 8) {
      [0.6, 0.4].forEach((share, i) => {
        const y = plan.y + 3 + i * 3;
        out.push(L(k.lineOnTop([plan.x + 3, y], [plan.x + 3 + (p.w - 6) * share, y], top, P), {tone: 'lo', free: true}));
      });
    }
  } else if (p.shape === 'cylinder' || p.shape === 'dial') {
    const r = p.w / 2;
    out.push(S(k.cylinder(p.x, p.y, r, p.z, p.h, P, r > 12 ? 56 : 28, Math.min(0.8, p.h / 8))));
    if (p.detail === 'knurl' || p.shape === 'dial') out.push(L(k.knurl(p.x, p.y, r, top - Math.min(3.4, p.h), top, Math.max(12, Math.round(r * 4)), P, 0.3), {tone: 'lo'}));
    if (p.shape === 'dial' || p.detail === 'ticks') {
      out.push(L(k.ring(p.x, p.y, r * 0.88, top, P, 48), {tone: 'lo'}));
      const t = k.radialTicks(p.x, p.y, r * 0.85, 40, 5, top, [r * 0.07, r * 0.15], P);
      out.push(L(t.minor, {tone: 'lo'}), L(t.major, {tone: 'mid'}));
      if (p.shape === 'dial') out.push(L(k.lineOnTop([p.x, p.y], [p.x + r * 0.45, p.y - r * 0.55], top + 0.2, P), {tone: lit ? 'lit' : 'hi', free: 'end'}), D([at([p.x, p.y, top])], {size: 0.8, tone: 'hi'}));
    }
    if (p.detail === 'screws' && r > 6) out.push(D([0.4, 1.4, 2.4, 3.4].map(q => q / 4 * Math.PI * 2).map(a => [p.x + Math.cos(a) * r * 0.7, p.y + Math.sin(a) * r * 0.7]).map(([x, y]) => at([x, y, top])), {size: 0.45}));
    if (p.detail === 'groove' && r > 5) out.push(L(k.ring(p.x, p.y, r * 0.7, top, P, 40), {tone: 'faint'}));
  } else if (p.shape === 'rod') {
    const r = p.w / 2;
    if (p.axis === 'z') {
      out.push(S(k.cylinder(p.x, p.y, r, p.z, p.h, P, 20), {crease: 'none'}));
    } else {
      const a = p.axis === 'x' ? [1, 0, 0] : [0, 1, 0];
      const u = p.axis === 'x' ? [0, 1, 0] : [1, 0, 0];
      const F = G.frameOf([p.x, p.y, p.z], a, u, [0, 0, 1]);
      const poly = Array.from({length: 12}, (_, i) => [Math.cos(i / 12 * Math.PI * 2) * r, Math.sin(i / 12 * Math.PI * 2) * r]);
      out.push(S(G.prismOf(F, poly, 0, p.h, P), {crease: 'none'}));
    }
  }
  return out.join('');
}

/** A base plate sized to the object, with feet, a groove, screws and a ruler. */
function basePlate(parts, P) {
  const plans = parts.filter(p => p.z < 4).map(planOf);
  const all = plans.length ? plans : parts.map(planOf);
  const x0 = Math.min(...all.map(p => p.x)) - 16;
  const y0 = Math.min(...all.map(p => p.y)) - 16;
  const x1 = Math.max(...all.map(p => p.x + p.w)) + 16;
  const y1 = Math.max(...all.map(p => p.y + p.d)) + 22;
  const PLATE = {x: x0, y: y0, w: x1 - x0, d: y1 - y0, r: 8};
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -15, 10, P)}"/>`];
  for (const [x, y] of k.corners(PLATE, 14).sort((a, b) => k.depthOf([...a, 0], P) - k.depthOf([...b, 0], P))) {
    out.push(k.solidSvg(k.cylinder(x, y, 5.6, -15, 1.4, P, 24), {tone: 'lo'}));
    out.push(k.solidSvg(k.cylinder(x, y, 4.4, -13.6, 3.6, P, 24), {tone: 'mid'}));
  }
  out.push(k.solidSvg(k.slabOf(PLATE, -10, 10, P, 8, 1.4), {tone: 'mid', inner: k.lineSvg(k.sideSeam(PLATE, -6.5, P, 8), {tone: 'faint'})}));
  out.push(k.lineSvg(k.planOutline(k.insetPlan(PLATE, 4.5), 0, P), {tone: 'lo'}));
  const screws = k.corners(PLATE, 8.5);
  out.push(k.lineSvg(screws.map(([x, y]) => k.ring(x, y, 1.9, 0, P, 16)).join(''), {tone: 'lo'}));
  out.push(k.dotsSvg(screws.map(([x, y]) => k.iso([x, y, 0], P)), {size: 0.45}));
  const ruler = {x: PLATE.x + 16, y: PLATE.y + PLATE.d - 13, w: PLATE.w - 32, d: 6, r: 1};
  if (ruler.w > 30) {
    out.push(k.solidSvg(k.slabOf(ruler, 0, 0.6, P, 3), {tone: 'lo', crease: 'none'}));
    const t = k.topTicks(ruler.x + 3, ruler.x + ruler.w - 3, 4, 5, ruler.y + 0.6, 0.6, [1.8, 3.2], P);
    out.push(k.lineSvg(t.minor, {tone: 'lo'}), k.lineSvg(t.major, {tone: 'mid'}));
  }
  return {svg: out.join(''), PLATE};
}

/**
 * Builds the figure. Returns {P, base, draw(active)}: the base plate, and the parts with the
 * active step's pieces lit.
 */
export function sceneFigure(scene, {W = 600, H = 400} = {}) {
  const parts = scene.parts;
  const probe = {origin: [0, 0], scale: 1, azimuth: scene.azimuth, elevation: 30};
  const plate = basePlate(parts, probe);
  const points = [...k.boxCorners(plate.PLATE, -15, 0)];
  for (const p of parts) {
    const pl = planOf(p);
    const [z0, z1] = zRange(p);
    points.push(...k.boxCorners(pl, z0, z1 + 6));
  }
  const P = k.fitProjection(points, W, H, {pad: 18, azimuth: scene.azimuth});
  const base = basePlate(parts, P).svg;
  const order = paintOrder(parts, P);
  const draw = active => order.map(i => {
    const p = parts[i];
    return `<g data-part="${p.link}">${partSvg(p, P, p.link >= 0 && p.link === active)}</g>`;
  }).join('');
  return {P, base, draw, parts, order};
}
