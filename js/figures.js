// Lesson pictures drawn with the Anatomy kit (MIT, see js/vendor/anatomy/LICENSE).
// Each picture kind is a small real machine whose working shows the idea:
//   steps   → gauge blocks under a dial indicator: each step reads higher than the last
//   cycle   → a rotary index table: stations come round to the probe in turn, then back to the first
//   compare → a balance: the side you look at goes down
//   layers  → a chest of drawers: the bottom drawer is the base everything sits on
// A lesson may have 2–6 parts. The machine is built for that count.

import * as k from './vendor/anatomy/iso-kit.mjs';
import * as G from './vendor/anatomy/lathe.mjs';
import {cleanScene, sceneFigure} from './scene.js';

const W = 600;
const H = 360;
const TAU = Math.PI * 2;

// ---------- shared parts ----------

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const halo = d => `<path class="iso-halo" d="${d}"/>`;
const byDepth = (points, P) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const num = i => String(i + 1).padStart(2, '0');

/** Base plate on four feet with a groove, corner screws, a ruler strip and a label plate. */
function basePlate(P, PLATE, {ruler, label, height = 12, foot = 5} = {}) {
  const at = p => k.iso(p, P);
  const out = [halo(k.haloOf(PLATE, -height - foot, height, P))];
  for (const [x, y] of byDepth(k.corners(PLATE, 20), P)) {
    out.push(S(k.cylinder(x, y, 7, -height - foot, 1.6, P, 28), {tone: 'lo'}));
    out.push(S(k.cylinder(x, y, 5.4, -height - foot + 1.6, foot - 1.6, P, 28), {tone: 'mid'}));
  }
  out.push(S(k.slabOf(PLATE, -height, height, P, 8, 1.6), {tone: 'mid', inner: L(k.sideSeam(PLATE, -height + 4, P, 8), {tone: 'faint'})}));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), {tone: 'lo'}));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(''), {tone: 'lo'}));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), {size: 0.5}));
  if (ruler) {
    out.push(S(k.slabOf(ruler, 0, 0.6, P, 3), {tone: 'lo', crease: 'none'}));
    const t = k.topTicks(ruler.x + 4, ruler.x + ruler.w - 4, 4, 5, ruler.y + 0.8, 0.6, [2, 3.6], P);
    out.push(L(t.minor, {tone: 'lo'}), L(t.major, {tone: 'mid'}));
    out.push(D([at([ruler.x + 2, ruler.y + ruler.d / 2, 0.6]), at([ruler.x + ruler.w - 2, ruler.y + ruler.d / 2, 0.6])], {size: 0.45}));
  }
  if (label) {
    out.push(S(k.slabOf(label, 0, 0.8, P, 4), {tone: 'lo'}));
    out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), {tone: 'faint'}));
    const x0 = label.x + 4;
    [0.62, 0.45, 0.3].forEach((share, i) => {
      const y = label.y + 4 + i * 3.4;
      out.push(L(k.lineOnTop([x0, y], [x0 + (label.w - 8) * share, y], 0.8, P), {tone: 'lo', free: true}));
    });
    out.push(D([at([label.x + label.w - 3, label.y + 3, 0.8]), at([label.x + label.w - 3, label.y + label.d - 3, 0.8])], {size: 0.4}));
  }
  return out.join('');
}

/** Knurled knob with a pointer line on top. */
function knob(P, [cx, cy], r, z, h) {
  return S(k.cylinder(cx, cy, r, z, h, P, 32), {tone: 'mid'})
    + L(k.knurl(cx, cy, r, z, z + h, Math.round(r * 6), P), {tone: 'lo'})
    + L(k.lineOnTop([cx - r * 0.5, cy], [cx + r * 0.8, cy], z + h, P), {tone: 'hi'})
    + D([k.iso([cx, cy, z + h], P)], {size: 0.5, tone: 'hi'});
}

// ---------- steps: gauge blocks under a dial indicator ----------

function stepsFigure(n) {
  const STEP = 16;
  const BLOCK_W = 15.6;
  const RISE = n > 4 ? 4 : 5;
  const heights = Array.from({length: n}, (_, i) => 8 + i * RISE); // step i is i blocks up
  const posOf = i => n - 1 - i; // the tallest block sits furthest back
  const DIAL = [58, 0];
  const DIAL_R = 20;
  const DIAL_H = 10;
  const top = Math.max(...heights);
  const DIAL_Z = top + 66;
  const DIAL_TOP = DIAL_Z + DIAL_H;
  const CLAMP_Z = DIAL_Z + 18;
  const POST = [-98, 0];
  const POST_TOP = CLAMP_Z + 22;
  const CARRIAGE_TOP = 8;
  const CARRIAGE = {x: -28, y: -24, w: n * STEP + 8, d: 48, r: 3};
  const PER_TURN = 20;
  const stopOf = i => DIAL[0] - (-24 + STEP * posOf(i) + BLOCK_W / 2);
  const stops = heights.map((_, i) => stopOf(i));
  const RAIL_FROM = Math.min(...stops) + CARRIAGE.x - 6;
  const RAIL_TO = Math.max(...stops) + CARRIAGE.x + CARRIAGE.w + 6;
  const PLATE = {x: -128, y: -64, w: Math.max(262, RAIL_TO + 16 + 128), d: 128, r: 8};
  const MAG = {x: -112, y: -20, w: 44, d: 40, r: 3};
  const MAG_H = 24;
  const ruler = {x: PLATE.x + 18, y: PLATE.y + PLATE.d - 15, w: PLATE.w - 36, d: 7, r: 1};
  const label = {x: PLATE.x + 16, y: PLATE.y + 12, w: 34, d: 16, r: 1.5};

  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -17, 0), [POST[0], POST[1], POST_TOP + 2], [DIAL[0] + DIAL_R, 0, DIAL_TOP]],
    W, H, {pad: 28, azimuth: 42},
  );
  const at = p => k.iso(p, P);

  const rails = () => {
    const out = [];
    for (const y of [-20, 15]) {
      out.push(S(k.slabOf({x: RAIL_FROM, y, w: RAIL_TO - RAIL_FROM, d: 5, r: 1}, 0, 3, P, 3, 0.4), {tone: 'mid'}));
      out.push(D([RAIL_FROM + 6, RAIL_TO - 6].map(x => at([x, y + 2.5, 3])), {size: 0.4}));
    }
    for (const x of [RAIL_FROM - 5, RAIL_TO]) {
      out.push(S(k.slabOf({x, y: -23, w: 5, d: 46, r: 1.2}, 0, 7, P, 3, 0.5), {tone: 'mid'}));
      out.push(D([at([x + 2.5, -18, 7]), at([x + 2.5, 18, 7])], {size: 0.45}));
    }
    return out.join('');
  };

  const stand = () => {
    const out = [];
    out.push(S(k.slabOf(MAG, 0, 11, P, 6, 0.8), {tone: 'mid'}));
    out.push(S(k.slabOf(k.insetPlan(MAG, 0.8), 11, MAG_H - 11, P, 6, 0.8), {tone: 'mid'}));
    out.push(L(k.planOutline(k.insetPlan(MAG, 3), MAG_H, P), {tone: 'faint'}));
    out.push(knob(P, [MAG.x + 32, MAG.y + 28], 6, MAG_H, 4));
    out.push(S(k.cylinder(POST[0], POST[1], 5, MAG_H, 4, P, 28), {tone: 'mid'}));
    out.push(S(k.cylinder(POST[0], POST[1], 3.2, MAG_H + 4, CLAMP_Z - 4 - MAG_H - 4, P, 28), {tone: 'mid', crease: 'none'}));
    out.push(S(k.slabOf({x: POST[0] - 7, y: POST[1] - 7, w: 14, d: 14, r: 2.5}, CLAMP_Z - 4, 12, P, 4, 0.6), {tone: 'mid'}));
    out.push(S(k.cylinder(POST[0], POST[1], 3.2, CLAMP_Z + 8, POST_TOP - CLAMP_Z - 8, P, 28), {tone: 'mid', crease: 'none'}));
    out.push(S(k.cylinder(POST[0], POST[1], 3.8, POST_TOP, 2, P, 28), {tone: 'mid'}));
    const arm = {x: POST[0] + 7, y: -3, w: DIAL[0] - DIAL_R - POST[0] - 7 + 2, d: 6, r: 2};
    out.push(S(k.slabOf(arm, CLAMP_Z, 4, P, 4, 0.5), {tone: 'mid'}));
    out.push(D([at([arm.x + 4, 0, CLAMP_Z + 4]), at([arm.x + arm.w - 5, 0, CLAMP_Z + 4])], {size: 0.45}));
    const thumb = [POST[0], POST[1] + 10];
    out.push(S(k.slabOf({x: thumb[0] - 1.4, y: POST[1] + 7, w: 2.8, d: 3, r: 0.8}, CLAMP_Z + 1, 4, P, 2), {tone: 'mid', crease: 'none'}));
    out.push(S(k.cylinder(thumb[0], thumb[1] + 1.4, 2.6, CLAMP_Z, 6, P, 20), {tone: 'mid'}));
    out.push(L(k.knurl(thumb[0], thumb[1] + 1.4, 2.6, CLAMP_Z, CLAMP_Z + 6, 18, P), {tone: 'lo'}));
    return out.join('');
  };

  const block = (i, lit) => {
    const plan = {x: -24 + STEP * posOf(i), y: -12, w: BLOCK_W, d: 24, r: 1};
    const h = heights[i];
    return S(k.slabOf(plan, CARRIAGE_TOP, h, P, 3, 0.5), {tone: 'mid', crease: 'lo', lit, className: 'pick'})
      + L(k.planOutline(k.insetPlan(plan, 2), CARRIAGE_TOP + h, P, 3), {tone: 'faint'})
      + k.faceTextSvg(k.topMatrix([plan.x + plan.w / 2, 7], CARRIAGE_TOP + h, P, 'x'), num(i), {size: 3.4, tone: lit ? 'hi' : 'lo', anchor: 'middle'});
  };

  const carriage = active => {
    const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(CARRIAGE, 3), 3, 0.1, P)}" style="filter:blur(4px)"/>`];
    out.push(S(k.slabOf(CARRIAGE, 3, CARRIAGE_TOP - 3, P, 5, 0.6), {tone: 'mid'}));
    for (let x = CARRIAGE.x + 6; x < CARRIAGE.x + CARRIAGE.w - 3; x += 14) out.push(D([at([x, CARRIAGE.y + CARRIAGE.d - 2.6, CARRIAGE_TOP])], {size: 0.4, tone: 'lo'}));
    out.push(L(k.lineOnTop([CARRIAGE.x, -15.5], [CARRIAGE.x + CARRIAGE.w, -15.5], CARRIAGE_TOP, P), {tone: 'faint'}));
    out.push(L(k.lineOnTop([CARRIAGE.x, 15.5], [CARRIAGE.x + CARRIAGE.w, 15.5], CARRIAGE_TOP, P), {tone: 'faint'}));
    // Draw from the back (tallest) to the front so a lower block is never hidden by a taller one in front.
    for (let p = 0; p < n; p++) {
      const i = n - 1 - p;
      out.push(`<g data-part="${i}">${block(i, i === active)}</g>`);
    }
    const handle = [CARRIAGE.x + CARRIAGE.w - 8, CARRIAGE.y + CARRIAGE.d + 3];
    out.push(S(k.slabOf({x: handle[0] - 2, y: CARRIAGE.y + CARRIAGE.d - 1, w: 4, d: 4, r: 1}, 4, 3, P, 2), {tone: 'mid', crease: 'none'}));
    out.push(S(k.cylinder(handle[0], handle[1] + 1, 3, 3, 5, P, 20), {tone: 'mid'}));
    out.push(L(k.knurl(handle[0], handle[1] + 1, 3, 3, 8, 18, P), {tone: 'lo'}));
    return out.join('');
  };

  const plunger = () => S(k.cylinder(DIAL[0], DIAL[1], 2.6, 0, 2.4, P, 20), {tone: 'hi'})
    + S(k.cylinder(DIAL[0], DIAL[1], 1.4, 2.4, DIAL_Z - top - 12, P, 16), {tone: 'hi', crease: 'none'});

  const dial = () => {
    const out = [];
    const [x, y] = DIAL;
    out.push(S(k.cylinder(x, y, 2.9, DIAL_Z - 26, 26, P, 20), {tone: 'mid'}));
    out.push(L(k.sideArc(x, y, 2.9, DIAL_Z - 20, P, 12), {tone: 'lo'}));
    out.push(S(k.slabOf({x: x - DIAL_R - 6, y: -4, w: 8, d: 8, r: 1.5}, DIAL_Z + 2, CLAMP_Z - DIAL_Z - 2, P, 3, 0.4), {tone: 'mid'}));
    out.push(S(k.cylinder(x, y, DIAL_R, DIAL_Z, DIAL_H, P, 64, 0.8), {tone: 'hi', crease: 'lo'}));
    out.push(L(k.knurl(x, y, DIAL_R, DIAL_TOP - 3.4, DIAL_TOP, 84, P, 0.3), {tone: 'lo'}));
    out.push(L(k.sideArc(x, y, DIAL_R, DIAL_TOP - 3.4, P, 40), {tone: 'faint'}));
    out.push(L(k.ring(x, y, DIAL_R - 2.2, DIAL_TOP, P, 64), {tone: 'lo'}));
    const t = k.radialTicks(x, y, DIAL_R - 3, 50, 5, DIAL_TOP, [1.3, 2.8], P);
    out.push(L(t.minor, {tone: 'lo'}), L(t.major, {tone: 'mid'}));
    out.push(S(k.slabOf({x: x + DIAL_R - 1, y: -2.4, w: 5, d: 4.8, r: 1.2}, DIAL_Z + 2, 5, P, 3), {tone: 'mid'}));
    out.push(S(k.slabOf({x: x + DIAL_R + 3.6, y: -3.2, w: 2.6, d: 6.4, r: 1.2}, DIAL_Z + 1.2, 6.6, P, 3), {tone: 'mid'}));
    out.push(L(k.ring(x, y, 1.6, DIAL_TOP, P, 16), {tone: 'mid'}));
    return out.join('');
  };

  const needleAt = turn => {
    const a = turn * TAU;
    const [x, y] = DIAL;
    return k.lineOnTop([x - Math.sin(a) * 3.4, y + Math.cos(a) * 3.4], [x + Math.sin(a) * (DIAL_R - 4), y - Math.cos(a) * (DIAL_R - 4)], DIAL_TOP + 0.2, P);
  };

  const state = {x: stops[0], tip: CARRIAGE_TOP + heights[0], rate: 0};
  return {
    title: 'Gauge blocks',
    label: `A dial indicator over ${n} gauge blocks that rise like stairs. The carriage slides the chosen block under the plunger and the needle reads its height.`,
    body: active => [
      basePlate(P, PLATE, {ruler, label}),
      rails(),
      stand(),
      `<g data-move="carriage" transform="${k.translateAlong(P, [state.x, 0, 0])}">${carriage(active)}</g>`,
      `<g data-move="plunger" transform="${k.translateAlong(P, [0, 0, state.tip])}">${plunger()}</g>`,
      dial(),
      `<path data-move="needle" class="iso-line" data-tone="hi" data-free="start" d="${needleAt((state.tip - CARRIAGE_TOP) / PER_TURN)}" style="stroke-width:1.1"/>`,
    ],
    snap(active) { state.x = stops[active]; state.tip = CARRIAGE_TOP + heights[active]; state.rate = 0; },
    step(svg, active, dt, calm) {
      const target = stops[active];
      state.x = calm ? target : state.x + (target - state.x) * (1 - Math.exp(-dt / 0.3));
      if (Math.abs(target - state.x) < 0.01) state.x = target;
      let want = CARRIAGE_TOP;
      heights.forEach((h, i) => {
        const from = state.x - 24 + STEP * posOf(i);
        if (from + BLOCK_W > DIAL[0] - 2.6 && from < DIAL[0] + 2.6) want = Math.max(want, CARRIAGE_TOP + h);
      });
      if (calm) { state.tip = want; state.rate = 0; }
      for (let s = 0; s < 4 && !calm; s++) { state.rate += ((want - state.tip) * 420 - state.rate * 26) * dt / 4; state.tip += state.rate * dt / 4; }
      if (Math.abs(want - state.tip) < 0.005 && Math.abs(state.rate) < 0.005) { state.tip = want; state.rate = 0; }
      svg.querySelector('[data-move="carriage"]').setAttribute('transform', k.translateAlong(P, [state.x, 0, 0]));
      svg.querySelector('[data-move="plunger"]').setAttribute('transform', k.translateAlong(P, [0, 0, state.tip]));
      svg.querySelector('[data-move="needle"]').setAttribute('d', needleAt((state.tip - CARRIAGE_TOP) / PER_TURN));
      return state.x === target && state.rate === 0;
    },
    reading: active => `block ${num(active)} · ${heights[active]} mm`,
  };
}

// ---------- cycle: a rotary index table ----------

function cycleFigure(n) {
  const R_BASE = 66;
  const R_TABLE = 62;
  const R_STATION = 40;
  const Z_TABLE = 10;
  const TABLE_TOP = Z_TABLE + 6;
  const PLATE = {x: -88, y: -88, w: 176, d: 176, r: 10};
  const P = k.fitProjection([...k.boxCorners(PLATE, -17, 0), [0, 0, 80]], W, H, {pad: 18, azimuth: 45});
  const at = p => k.iso(p, P);
  const [vx, vy] = k.towardViewer(P);
  const HERE = Math.atan2(vy, vx); // the station facing the viewer sits under the probe
  const POST_ANGLE = HERE - 1.05; // to the right of the front station, clear of the others
  const POST = [Math.cos(POST_ANGLE) * 77, Math.sin(POST_ANGLE) * 77];
  const PROBE = [Math.cos(HERE) * R_STATION, Math.sin(HERE) * R_STATION];
  const ARM_Z = 64;
  const ruler = {x: PLATE.x + 16, y: PLATE.y + PLATE.d - 12, w: 52, d: 7, r: 1};
  const label = {x: PLATE.x + PLATE.w - 46, y: PLATE.y + 9, w: 34, d: 15, r: 1.5};

  const base = () => [
    basePlate(P, PLATE, {ruler, label}),
    halo(k.cylinder(0, 0, R_BASE, 0, Z_TABLE, P, 72).fill),
    S(k.cylinder(0, 0, R_BASE, 0, Z_TABLE, P, 72, 0.8), {tone: 'mid', inner: L(k.sideArc(0, 0, R_BASE, 4, P, 60), {tone: 'faint'})}),
    D(Array.from({length: 24}, (_, i) => i / 24 * TAU).filter(a => Math.cos(a - HERE) > 0.15).map(a => at([Math.cos(a) * (R_BASE - 0.1), Math.sin(a) * (R_BASE - 0.1), 7])), {size: 0.4, tone: 'lo'}),
    S(k.cylinder(0, 0, R_TABLE, Z_TABLE, 6, P, 72, 1), {tone: 'hi', crease: 'lo'}),
    L(k.ring(0, 0, R_TABLE - 9, TABLE_TOP, P, 72), {tone: 'faint'}),
    L(k.ring(0, 0, R_STATION + 13, TABLE_TOP, P, 72), {tone: 'faint'}),
  ].join('');

  // Angle 0 of radialTicks points to −y and runs clockwise from above; convert from math angles.
  const tickFrom = theta => Math.PI / 2 + theta;
  const turning = (theta, active) => {
    const out = [];
    const t = k.radialTicks(0, 0, R_TABLE - 1, 72, 6, TABLE_TOP, [1.2, 2.6], P, tickFrom(theta));
    out.push(L(t.minor, {tone: 'lo'}), L(t.major, {tone: 'mid'}));
    const stations = Array.from({length: n}, (_, i) => {
      const a = theta + i * TAU / n;
      return {i, x: Math.cos(a) * R_STATION, y: Math.sin(a) * R_STATION, a};
    });
    // The hub sorts with the stations, so a station nearer than the hub is drawn over it.
    const items = [...stations, {hub: true, x: 0, y: 0}].sort((p, q) => k.depthOf([p.x, p.y, 0], P) - k.depthOf([q.x, q.y, 0], P));
    for (const s of items) {
      if (s.hub) {
        out.push(S(k.cylinder(0, 0, 12, TABLE_TOP, 5, P, 40, 0.6), {tone: 'mid'}));
        out.push(knob(P, [0, 0], 7, TABLE_TOP + 5, 4));
        out.push(L(k.lineOnTop([Math.cos(theta) * 9, Math.sin(theta) * 9], [Math.cos(theta) * 11.4, Math.sin(theta) * 11.4], TABLE_TOP + 5, P), {tone: 'hi'}));
        continue;
      }
      const lit = s.i === active;
      const g = [];
      g.push(L(k.lineOnTop([Math.cos(s.a) * 15, Math.sin(s.a) * 15], [Math.cos(s.a) * (R_STATION - 10), Math.sin(s.a) * (R_STATION - 10)], TABLE_TOP, P), {tone: 'faint'}));
      g.push(S(k.cylinder(s.x, s.y, 10, TABLE_TOP, 3, P, 36, 0.5), {tone: 'mid'}));
      g.push(D([0.5, 1.5, 2.5, 3.5].map(q => q / 4 * TAU + s.a).filter(a => Math.cos(a - HERE) > -0.2).map(a => at([s.x + Math.cos(a) * 8, s.y + Math.sin(a) * 8, TABLE_TOP + 3])), {size: 0.4}));
      g.push(S(k.cylinder(s.x, s.y, 6, TABLE_TOP + 3, 5, P, 32, 0.5), {tone: 'mid', crease: 'lo', lit, className: 'pick'}));
      g.push(L(k.ring(s.x, s.y, 3.6, TABLE_TOP + 8, P, 24), {tone: 'faint'}));
      g.push(k.faceTextSvg(k.topMatrix([s.x, s.y + 1.1], TABLE_TOP + 8, P, 'x'), num(s.i), {size: 3, tone: lit ? 'hi' : 'lo', anchor: 'middle'}));
      out.push(`<g data-part="${s.i}">${g.join('')}</g>`);
    }
    return out.join('');
  };

  // The probe: a column outside the table, an arm reaching over the front station, and a stylus.
  const probe = () => {
    const out = [];
    out.push(S(k.cylinder(POST[0], POST[1], 8, 0, 3, P, 32, 0.5), {tone: 'mid'}));
    out.push(D(Array.from({length: 4}, (_, i) => i / 4 * TAU + 0.4).filter(a => Math.cos(a - HERE) > -0.1).map(a => at([POST[0] + Math.cos(a) * 6, POST[1] + Math.sin(a) * 6, 3])), {size: 0.45}));
    out.push(S(k.cylinder(POST[0], POST[1], 3.6, 3, ARM_Z - 3, P, 28), {tone: 'mid', crease: 'none', inner: L(k.sideArc(POST[0], POST[1], 3.6, 30, P, 16), {tone: 'faint'})}));
    const dir = [PROBE[0] - POST[0], PROBE[1] - POST[1]];
    const len = Math.hypot(dir[0], dir[1]);
    const F = G.frameOf([POST[0], POST[1], ARM_Z], [dir[0] / len, dir[1] / len, 0], [-dir[1] / len, dir[0] / len, 0], [0, 0, 1]);
    out.push(S(k.slabOf({x: POST[0] - 6, y: POST[1] - 6, w: 12, d: 12, r: 2.4}, ARM_Z - 6, 12, P, 4, 0.6), {tone: 'mid'}));
    out.push(S(G.prismOf(F, [[-2.6, -2], [2.6, -2], [2.6, 2], [-2.6, 2]], 4, len + 4, P), {tone: 'mid'}));
    out.push(S(k.cylinder(PROBE[0], PROBE[1], 4.4, ARM_Z - 6, 8, P, 28, 0.5), {tone: 'mid'}));
    out.push(S(k.cylinder(PROBE[0], PROBE[1], 1.2, TABLE_TOP + 12, ARM_Z - 6 - TABLE_TOP - 12, P, 16), {tone: 'hi', crease: 'none'}));
    out.push(S(k.cylinder(PROBE[0], PROBE[1], 2, TABLE_TOP + 10, 2, P, 20), {tone: 'hi'}));
    out.push(knob(P, [POST[0], POST[1]], 3.4, ARM_Z + 6, 3));
    return out.join('');
  };

  const state = {theta: HERE, target: HERE};
  const angleFor = active => HERE - active * TAU / n;
  return {
    title: 'Index table',
    label: `A rotary index table with ${n} stations. The table turns so each station in turn comes under the probe, then the first one comes round again.`,
    body: active => [base(), `<g data-move="table">${turning(state.theta, active)}</g>`, probe()],
    snap(active) { state.theta = state.target = angleFor(active); },
    step(svg, active, dt, calm) {
      // Turn the short way round to the station asked for.
      let goal = angleFor(active);
      goal += Math.round((state.theta - goal) / TAU) * TAU;
      state.target = goal;
      state.theta = calm ? goal : state.theta + (goal - state.theta) * (1 - Math.exp(-dt / 0.35));
      if (Math.abs(goal - state.theta) < 1e-4) state.theta = goal;
      svg.querySelector('[data-move="table"]').innerHTML = turning(state.theta, active);
      return state.theta === goal;
    },
    reading: active => `station ${num(active)} of ${num(n - 1)}${active === n - 1 ? ' · then back to 01' : ''}`,
  };
}

// ---------- compare: a balance ----------

function compareFigure() {
  const PLATE = {x: -118, y: -52, w: 236, d: 104, r: 8};
  const PIVOT = [0, 0, 104];
  const ARM = 82;
  const DROP = 46;
  const PAN_R = 20;
  const TILT = 0.085;
  // Fit the beam at full tilt either way, so the raised end never leaves the card.
  const lift = Math.sin(TILT) * (ARM + 3) + 5;
  const P = k.fitProjection([...k.boxCorners(PLATE, -17, 0), [-ARM - 3, 0, PIVOT[2] + lift], [ARM + 3, 0, PIVOT[2] + lift], [-ARM - PAN_R, 0, 0], [ARM + PAN_R, 0, 0]], W, H, {pad: 22, azimuth: 34});
  const at = p => k.iso(p, P);
  const ruler = {x: -40, y: PLATE.y + PLATE.d - 14, w: 80, d: 7, r: 1};
  const label = {x: PLATE.x + 14, y: PLATE.y + 12, w: 34, d: 16, r: 1.5};

  const column = () => {
    const out = [];
    out.push(S(k.slabOf({x: -16, y: -16, w: 32, d: 32, r: 3}, 0, 6, P, 4, 0.8), {tone: 'mid'}));
    out.push(D(k.corners({x: -16, y: -16, w: 32, d: 32}, 4).map(([x, y]) => at([x, y, 6])), {size: 0.45}));
    out.push(S(k.cylinder(0, 0, 8, 6, 5, P, 32, 0.5), {tone: 'mid'}));
    out.push(S(k.cylinder(0, 0, 4.5, 11, PIVOT[2] - 19, P, 28), {tone: 'mid', crease: 'none', inner: L([40, 70].map(z => k.sideArc(0, 0, 4.5, z, P, 16)).join(''), {tone: 'faint'})}));
    out.push(S(k.cylinder(0, 0, 6, PIVOT[2] - 8, 3, P, 28, 0.4), {tone: 'mid'}));
    // Scale plate on the column's front for the pointer.
    out.push(S(k.slabOf({x: -3, y: 3, w: 6, d: 3, r: 0.6}, 50, 6, P, 2), {tone: 'mid', crease: 'none'}));
    out.push(S(k.slabOf({x: -16, y: 5, w: 32, d: 2.4, r: 0.6}, 46, 14, P, 2), {tone: 'mid'}));
    out.push(D([at([-13, 7.4, 48]), at([13, 7.4, 48])], {size: 0.4}));
    out.push(L(Array.from({length: 9}, (_, i) => {
      const x = -12 + i * 3;
      return k.segment([x, 7.4, 60], [x, 7.4, i === 4 ? 54 : i % 2 ? 57.5 : 56], P);
    }).join(''), {tone: 'lo'}));
    out.push(S(k.slabOf({x: -4, y: -4, w: 8, d: 8, r: 1}, PIVOT[2] - 5, 3, P, 2), {tone: 'mid'}));
    return out.join('');
  };

  // One pan: three cords from the beam end to the rim, the dish, and a sample on it.
  const pan = (end, side, lit) => {
    const [ex, ey, ez] = end;
    const z = ez - DROP;
    const out = [];
    const rim = [0, 1, 2].map(i => i / 3 * TAU + Math.PI / 2).map(a => [ex + Math.cos(a) * (PAN_R - 2), ey + Math.sin(a) * (PAN_R - 2)]);
    const cords = rim.map(([x, y]) => ({x, y, d: k.depthOf([x, y, z], P)})).sort((a, b) => a.d - b.d);
    const back = cords.slice(0, 1);
    const front = cords.slice(1);
    const cordSvg = list => list.map(c => k.wireSvg(at([ex, ey, ez - 2]), at([c.x, c.y, z + 2]), {tone: 'mid', size: 0.7})).join('');
    out.push(cordSvg(back));
    out.push(S(k.cylinder(ex, ey, PAN_R, z, 2, P, 64, 0.6), {tone: 'mid'}));
    out.push(L(k.ring(ex, ey, PAN_R - 3, z + 2, P, 64), {tone: 'faint'}));
    out.push(`<g data-part="${side}">${S(k.cylinder(ex, ey, 7, z + 2, 6, P, 32, 0.5), {tone: 'mid', crease: 'lo', lit, className: 'pick'})}${knob(P, [ex, ey], 3, z + 8, 3)}</g>`);
    out.push(cordSvg(front));
    out.push(S(k.cylinder(ex, ey, 1.8, ez - 4, 4, P, 16), {tone: 'mid'}));
    return out.join('');
  };

  const beamAt = (theta, active) => {
    const a = [Math.cos(theta), 0, Math.sin(theta)];
    const ends = [-1, 1].map(s => [PIVOT[0] + a[0] * ARM * s, 0, PIVOT[2] + a[2] * ARM * s]);
    const F = G.frameOf(PIVOT, a, [0, 1, 0], [-Math.sin(theta), 0, Math.cos(theta)]);
    const beam = S(G.prismOf(F, [[-2.2, -3.2], [2.2, -3.2], [2.2, 3.2], [-2.2, 3.2]], -ARM - 3, ARM + 3, P), {tone: 'mid'});
    const tip = [Math.sin(theta) * 44, 8.6, PIVOT[2] - Math.cos(theta) * 44];
    const pointer = L(k.segment([0, 8.6, PIVOT[2]], tip, P), {tone: 'hi', free: 'end'}) + D([at([0, 8.6, PIVOT[2]])], {size: 0.9, tone: 'hi'});
    const pans = ends.map((end, side) => ({svg: pan(end, side, side === active), d: k.depthOf(end, P)}));
    const [far, near] = pans[0].d < pans[1].d ? [pans[0], pans[1]] : [pans[1], pans[0]];
    return {far: far.svg, near: near.svg, beam: beam + S(k.cylinder(0, 0, 3.4, PIVOT[2] - 2, 4, P, 20), {tone: 'mid'}) + pointer};
  };

  const state = {theta: 0, rate: 0};
  const goalOf = active => (active === 0 ? 1 : -1) * TILT; // the side you look at goes down
  const draw = active => {
    const b = beamAt(state.theta, active);
    return `<g data-move="far">${b.far}</g>${column()}<g data-move="beam">${b.beam}</g><g data-move="near">${b.near}</g>`;
  };
  return {
    title: 'Balance',
    label: 'A balance with a pan on each side. The side you are looking at goes down and the pointer swings toward it.',
    body: active => [basePlate(P, PLATE, {ruler, label}), `<g data-move="all">${draw(active)}</g>`],
    snap(active) { state.theta = goalOf(active); state.rate = 0; },
    step(svg, active, dt, calm) {
      const goal = goalOf(active);
      if (calm) { state.theta = goal; state.rate = 0; }
      for (let s = 0; s < 4 && !calm; s++) { state.rate += ((goal - state.theta) * 60 - state.rate * 7) * dt / 4; state.theta += state.rate * dt / 4; }
      if (Math.abs(goal - state.theta) < 1e-4 && Math.abs(state.rate) < 1e-4) { state.theta = goal; state.rate = 0; }
      svg.querySelector('[data-move="all"]').innerHTML = draw(active);
      return state.rate === 0;
    },
    reading: active => `${active === 0 ? 'left' : 'right'} pan`,
  };
}

// ---------- layers: a chest of drawers ----------

function layersFigure(n) {
  const DH = n > 4 ? 16 : 19; // drawer height
  const FACE = 30; // the drawer fronts face +x
  const Y0 = -46;
  const WIDTH = 92;
  const Z0 = 9; // top of the plinth
  const BODY_TOP = Z0 + 2 + n * DH + 2;
  const OPEN = 34;
  const PLATE = {x: -64, y: -70, w: 150, d: 140, r: 8};
  const CASE = {x: -30, y: Y0, w: FACE + 30, d: WIDTH, r: 2};
  const P = k.fitProjection([...k.boxCorners(PLATE, -17, 0), [-30, Y0, BODY_TOP + 5], [FACE + OPEN + 4, Y0 + WIDTH, 0]], W, H, {pad: 26, azimuth: 33});
  const at = p => k.iso(p, P);
  const ruler = {x: PLATE.x + PLATE.w - 14, y: PLATE.y + 14, w: 7, d: PLATE.d - 28, r: 1};
  const zOf = i => Z0 + 2 + i * DH;

  const rulerY = () => {
    const out = [S(k.slabOf(ruler, 0, 0.6, P, 3), {tone: 'lo', crease: 'none'})];
    const t = k.topTicks(ruler.y + 4, ruler.y + ruler.d - 4, 4, 5, ruler.x + 0.8, 0.6, [2, 3.6], P, 'y');
    out.push(L(t.minor, {tone: 'lo'}), L(t.major, {tone: 'mid'}));
    return out.join('');
  };

  const carcass = () => {
    const out = [];
    const plinth = {x: CASE.x + 3, y: CASE.y + 3, w: CASE.w - 6, d: CASE.d - 6, r: 1.5};
    out.push(halo(k.haloOf(CASE, 0, BODY_TOP, P)));
    out.push(S(k.slabOf(plinth, 0, Z0, P, 3, 0.5), {tone: 'lo'}));
    const seams = Array.from({length: n - 1}, (_, i) => k.sideSeam(CASE, zOf(i + 1), P, 3)).join('');
    out.push(S(k.slabOf(CASE, Z0, BODY_TOP - Z0, P, 3, 0.6), {tone: 'mid', inner: L(seams, {tone: 'faint'})}));
    const top = k.insetPlan(CASE, -2.5);
    out.push(S(k.slabOf(top, BODY_TOP, 4, P, 4, 1), {tone: 'mid'}));
    out.push(L(k.planOutline(k.insetPlan(top, 6), BODY_TOP + 4, P, 4), {tone: 'faint'}));
    out.push(D(k.corners(top, 4).map(([x, y]) => at([x, y, BODY_TOP + 4])), {size: 0.45}));
    return out.join('');
  };

  // A drawer: its box (only the part that is out of the case), then the front with a label holder and a pull.
  const drawer = (i, open, lit) => {
    const z = zOf(i);
    const out = [];
    const y0 = Y0 + 4;
    const w = WIDTH - 8;
    if (open > 0.3) {
      const box = {x: FACE, y: y0 + 2, w: open, d: w - 4, r: 0.6};
      out.push(S(k.slabOf(box, z + 1.5, DH - 5, P, 2), {tone: 'mid'}));
      out.push(L(k.planOutline(k.insetPlan(box, 1.4), z + DH - 3.5, P, 2), {tone: 'lo'}));
      for (let c = 0; c < 3 && open > 10; c++) {
        const card = {x: FACE + 3 + c * 7, y: y0 + 10, w: 2, d: w - 20, r: 0.4};
        if (card.x + card.w < FACE + open - 4) out.push(S(k.slabOf(card, z + DH - 6, 4, P, 2), {tone: 'hi', crease: 'none'}));
      }
    }
    const front = {x: FACE + open, y: y0, w: 2.6, d: w, r: 0.8};
    const zf = z + 1;
    const hf = DH - 2;
    out.push(S(k.slabOf(front, zf, hf, P, 2, 0.4), {tone: 'mid', crease: 'lo', lit, className: 'pick'}));
    const fx = FACE + open + 2.6;
    // Label holder: a small frame with a card, numbered.
    const cy = y0 + w * 0.3;
    const holder = [[fx, cy - 9, zf + hf - 3], [fx, cy + 9, zf + hf - 3], [fx, cy + 9, zf + 3], [fx, cy - 9, zf + 3]];
    out.push(L(k.pathOf(holder.map(at), true), {tone: 'lo'}));
    out.push(D([[fx, cy - 9, zf + hf / 2], [fx, cy + 9, zf + hf / 2]].map(at), {size: 0.4}));
    out.push(k.faceTextSvg(k.sideMatrix([fx, cy, zf + hf / 2 + 1.4], zf + hf / 2 + 1.4, P, 'right'), num(i), {size: 3.6, tone: lit ? 'hi' : 'lo', anchor: 'middle'}));
    // Pull: two posts and a bar.
    const py = y0 + w * 0.72;
    const pz = zf + hf / 2 - 1;
    out.push(S(k.slabOf({x: fx, y: py - 9, w: 3, d: 2.2, r: 0.5}, pz, 2.2, P, 2), {tone: 'mid', crease: 'none'}));
    out.push(S(k.slabOf({x: fx, y: py + 6.8, w: 3, d: 2.2, r: 0.5}, pz, 2.2, P, 2), {tone: 'mid', crease: 'none'}));
    out.push(S(k.slabOf({x: fx + 3, y: py - 10, w: 1.8, d: 20, r: 0.8}, pz - 0.2, 2.6, P, 3), {tone: 'mid'}));
    return `<g data-part="${i}">${out.join('')}</g>`;
  };

  const opens = Array(n).fill(0);
  const drawers = active => {
    // Closed drawers first, lowest up; an open drawer is drawn last so it covers the fronts below it.
    const order = [...Array(n).keys()].sort((a, b) => (opens[a] > 0.3) - (opens[b] > 0.3) || a - b);
    return order.map(i => drawer(i, opens[i], i === active)).join('');
  };

  return {
    title: 'Chest of drawers',
    label: `A chest of ${n} drawers. Drawer 01 at the bottom is the base; each drawer above rests on the one below. The chosen drawer slides open.`,
    body: active => [basePlate(P, PLATE, {}), rulerY(), carcass(), `<g data-move="drawers">${drawers(active)}</g>`],
    snap(active) { opens.forEach((_, i) => { opens[i] = i === active ? OPEN : 0; }); },
    step(svg, active, dt, calm) {
      let done = true;
      opens.forEach((o, i) => {
        const goal = i === active ? OPEN : 0;
        opens[i] = calm ? goal : o + (goal - o) * (1 - Math.exp(-dt / 0.28));
        if (Math.abs(goal - opens[i]) < 0.05) opens[i] = goal;
        if (opens[i] !== goal) done = false;
      });
      svg.querySelector('[data-move="drawers"]').innerHTML = drawers(active);
      return done;
    },
    reading: active => `drawer ${num(active)} of ${num(n - 1)}${active === 0 ? ' · the base' : ''}`,
  };
}

// ---------- mounting ----------

// A lesson's own object, drawn from the parts list Claude wrote for it (js/scene.js).
function objectFigure(scene, n) {
  const fig = sceneFigure(scene, {W, H});
  return {
    title: scene.object || 'Lesson object',
    label: `${scene.object || 'An object'} built for this lesson. Each step lights the piece of the object it belongs to.`,
    body: active => [fig.base, fig.draw(active)],
    snap() {},
    step() { return true; },
    reading: active => `part ${num(active)} of ${num(n - 1)}`,
  };
}

export function figureFor(visual) {
  const n = Math.max(2, Math.min(6, visual?.parts?.length || 0));
  const scene = cleanScene(visual?.scene, n);
  if (scene) return objectFigure(scene, n);
  const kind = visual?.kind;
  if (kind === 'steps') return stepsFigure(n);
  if (kind === 'cycle') return cycleFigure(n);
  if (kind === 'compare' && n === 2) return compareFigure();
  return layersFigure(n); // layers, and comparisons of three or more as drawers side by side in one chest
}

/**
 * Draws the figure into `host` and keeps it live. `onSelect(i)` fires when the reader picks a part.
 * Returns {select(i), destroy()}.
 */
export function mountFigure(host, visual, {onSelect = () => {}, tour = true} = {}) {
  const fig = figureFor(visual);
  const parts = visual.parts.slice(0, 6);
  let active = 0;
  fig.snap(active);
  host.innerHTML = k.figureSvg({width: W, height: H, label: fig.label, body: fig.body(active)});
  const svg = host.querySelector('svg');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let last = 0;
  let visible = false;
  let touring = tour && !still.matches;
  let tourClock = 0;
  const TOUR_STEP = 3.2;

  // Exactly one part is lit: the one the reader is looking at.
  const markActive = () => svg.querySelectorAll('[data-part]').forEach(g => {
    const on = Number(g.dataset.part) === active;
    g.querySelectorAll('.pick').forEach(el => on ? el.setAttribute('data-lit', '') : el.removeAttribute('data-lit'));
    g.querySelectorAll('.iso-face-text').forEach(el => el.setAttribute('data-tone', on ? 'hi' : 'lo'));
  });
  const tick = now => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    if (touring) {
      tourClock += dt;
      const next = Math.floor(tourClock / TOUR_STEP) % parts.length;
      if (next !== active) { active = next; markActive(); onSelect(active, false); }
    }
    const settled = fig.step(svg, active, dt, still.matches);
    frame = visible && (touring || !settled) ? requestAnimationFrame(tick) : 0;
  };
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
  const observer = new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); else { cancelAnimationFrame(frame); frame = 0; } }, {rootMargin: '80px 0px'});
  observer.observe(host);

  const select = (i, fromReader = true) => {
    active = Math.max(0, Math.min(parts.length - 1, i));
    if (fromReader) touring = false;
    markActive();
    onSelect(active, fromReader);
    if (still.matches) fig.step(svg, active, 0, true);
    run();
  };
  svg.addEventListener('click', e => {
    const part = e.target.closest('[data-part]');
    if (part) select(Number(part.dataset.part));
  });
  svg.style.cursor = 'pointer';
  return {select, reading: i => fig.reading(i), title: fig.title, destroy: () => { observer.disconnect(); cancelAnimationFrame(frame); }};
}
