/* ---------- the harbour ---------- */
const DOCK = { x0: -3.1, x1: -.62, y0: -4.6, y1: 4.6, top: .62 };
const POSTS = [];
for (const y of [-4.35, -1.45, 1.45, 4.35]) for (const x of [-2.9, -.82]) POSTS.push([x, y]);
const PICKUP = [-1.85, 2.3];                        // where the crane picks crates up
const QSLOTS = [[-1.86, -.15], [-1.86, -3.05]];     // the next two crates wait here
const CRANE = [-2.2, 3.95];
const LV = .72, MAXH = 3, FB = .75;

/* cells are deck squares (x across the beam, y along the boat); h is height in layers */
const TYPES = {
  wood:    { cells: [[0, 0]],                 h: 1, m: 1, v: 1, kind: 'crate', colors: [[176, 120, 70], [170, 74, 58], [70, 104, 150]] },
  long:    { cells: [[0, 0], [0, 1]],         h: 1, m: 2, v: 2, kind: 'crate', colors: [[176, 120, 70], [84, 128, 80]] },
  big:     { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], h: 1, m: 4, v: 6, kind: 'crate', brace: true, colors: [[206, 172, 112], [222, 214, 196], [220, 176, 70]] },
  iron:    { cells: [[0, 0]],                 h: 1, m: 4, v: 3, kind: 'metal', colors: [[104, 124, 144], [176, 96, 60], [124, 124, 130]] },
  tall:    { cells: [[0, 0]],                 h: 2, m: 2, v: 3, kind: 'cab',   colors: [[72, 128, 102], [62, 78, 128], [140, 62, 72]] },
  fruit:   { cells: [[0, 0], [0, 1]],         h: 1, m: 1, v: 3, kind: 'fruit', colors: [[236, 128, 44], [214, 64, 56], [236, 206, 72]] },
  lumber:  { cells: [[0, 0], [0, 1], [0, 2]], h: 1, m: 3, v: 4, kind: 'lumber', colors: [[204, 164, 106], [142, 98, 64]] },
  machine: { cells: [[0, 0], [1, 0], [0, 1]], h: 1, m: 5, v: 8, kind: 'machine', colors: [[214, 170, 52], [62, 140, 140]] },
  drum:    { cells: [[0, 0]],                 h: 1, m: 3, v: 2, kind: 'drum',  colors: [[190, 60, 52], [52, 96, 170], [64, 66, 74]] },
  fridge:  { cells: [[0, 0], [1, 0]],         h: 2, m: 3, v: 6, kind: 'cab', fridge: true, colors: [[220, 226, 226], [150, 206, 188]] },
  hay:     { cells: [[0, 0], [1, 0]],         h: 1, m: 1, v: 1, kind: 'hay',   colors: [[214, 184, 96]] },
};
const WEIGHTS = { wood: 3, long: 2, big: 1.1, iron: 1.8, tall: 1.4, fruit: 1.5, lumber: 1.2, machine: 1, drum: 1.5, fridge: .9, hay: 1.2 };
const matCache = new Map();
function matFor(t, ci) {
  const key = t + ci;
  let m = matCache.get(key);
  if (!m) { const T = TYPES[t]; m = KIND[T.kind](T.colors[ci], T); matCache.set(key, m); }
  return m;
}
const BOATS = [
  { B: 3, L: 5, M0: 9,  kr: .34, kp: .13, paint: [58, 98, 122],  sea: 1,    tide: 0,  n: 10 },
  { B: 2, L: 6, M0: 7,  kr: .5,  kp: .11, paint: [138, 74, 62],  sea: 1.2, tide: 80, n: 9 },
  { B: 4, L: 4, M0: 13, kr: .27, kp: .16, paint: [70, 104, 76],  sea: 1.4,  tide: 60, n: 12 },
];
const SLIDE = 14 * Math.PI / 180, CAPSIZE = 24 * Math.PI / 180, PSLIDE = 10 * Math.PI / 180, PCAPSIZE = 18 * Math.PI / 180;
const LAYER_MULT = [1, 1.5, 2], FULL_BONUS = 1.3;

/* ---------- game state ---------- */
let rngS = (Date.now() & 0xffff) + 1;
const rnd = () => (rngS = (rngS * 16807) % 2147483647) / 2147483647;
const G = { boatIdx: 0, score: 0, crates: 0, phase: 'arrive', t: 0, phaseT: 0, boat: null, queue: [], cur: null, onboard: [], falling: [], dockBack: [], parts: [], target: null, mouse: null, nextId: 100, log: [], lost: 0, tide: 0, seen: false };

/* ---------- shapes ---------- */
function rotCells(cells, k) {
  let c = cells.map(p => p.slice());
  for (let i = 0; i < k; i++) c = c.map(([x, y]) => [y, -x]);
  const mx = Math.min(...c.map(p => p[0])), my = Math.min(...c.map(p => p[1]));
  return c.map(([x, y]) => [x - mx, y - my]);
}
function shapeOf(c) {
  const cells = rotCells(TYPES[c.t].cells, c.rot);
  return { cells, w: Math.max(...cells.map(p => p[0])) + 1, l: Math.max(...cells.map(p => p[1])) + 1 };
}
/* split a cell set into rectangles (runs per row, merged downward) so each crate draws as few boxes as possible */
function rectsOf(cells) {
  const set = new Set(cells.map(([x, y]) => x + ',' + y)), used = new Set(), out = [];
  const ys = [...new Set(cells.map(p => p[1]))].sort((a, b) => a - b);
  for (const y of ys) {
    const xs = cells.filter(p => p[1] === y).map(p => p[0]).sort((a, b) => a - b);
    for (const x of xs) {
      if (used.has(x + ',' + y)) continue;
      let x1 = x; while (set.has((x1 + 1) + ',' + y) && !used.has((x1 + 1) + ',' + y)) x1++;
      let y1 = y;
      for (;;) {
        let ok = true;
        for (let xx = x; xx <= x1; xx++) if (!set.has(xx + ',' + (y1 + 1)) || used.has(xx + ',' + (y1 + 1))) ok = false;
        if (!ok) break;
        y1++;
      }
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) used.add(xx + ',' + yy);
      out.push([x, y, x1 + 1, y1 + 1]);
    }
  }
  /* inset only on edges that face outside the shape */
  return out.map(([x0, y0, x1, y1]) => {
    const has = (x, y) => set.has(x + ',' + y);
    const e = .06;
    return [x0 + (has(x0 - 1, y0) ? 0 : e), y0 + (has(x0, y0 - 1) ? 0 : e), x1 - (has(x1, y0) ? 0 : e), y1 - (has(x0, y1) ? 0 : e)];
  });
}

/* ---------- a day: three boats, each with a manifest shown once ---------- */
function newManifest(n, B) {
  const keys = Object.keys(WEIGHTS), tot = keys.reduce((s, k) => s + WEIGHTS[k], 0);
  const list = [];
  for (let k = 0; k < n; k++) {
    let r = rnd() * tot, t = keys[0];
    for (const key of keys) { r -= WEIGHTS[key]; if (r <= 0) { t = key; break; } }
    list.push(t);
  }
  if (new Set(list).size < 4) list[0] = 'big', list[1] = 'machine', list[2] = 'tall';
  return list;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startBoat() {
  const spec = BOATS[G.boatIdx];
  G.boat = { spec, B: spec.B, L: spec.L, x: DOCK.x1 + .22 + spec.B / 2, y: -17, z: 0, roll: 0, rollV: 0, pitch: 0, pitchV: 0, speed: 0, sinkDir: 1, eqR: 0, eqP: 0, sink: 0 };
  const list = newManifest(spec.n, spec.B);
  G.manifest = list;
  G.queue = shuffle(list.map(t => ({ t, rot: 0, ci: Math.floor(rnd() * TYPES[t].colors.length) })));
  G.onboard = []; G.cur = G.queue.shift(); G.phase = 'arrive'; G.phaseT = 0; G.target = null; G.fetch = false;
  G.lost = 0; G.tide = spec.tide; G.seen = false; G.aim = COARSE ? [0, 0] : null;
  showManifest();
  updateHud();
}
function newDay() {
  G.boatIdx = 0; G.score = 0; G.crates = 0; G.falling = []; G.dockBack = []; G.parts = []; G.log = [];
  $('over').hidden = true;
  startBoat();
}

/* ---------- boat transform ---------- */
function boatT(b) {
  const cr = Math.cos(b.roll), sr = Math.sin(b.roll), cp = Math.cos(b.pitch), sp = Math.sin(b.pitch);
  return p => {
    let y = p[1] * cp + p[2] * sp, z = -p[1] * sp + p[2] * cp, x = p[0];
    const x2 = x * cr + z * sr; z = -x * sr + z * cr;
    return [x2 + b.x, y + b.y, z + b.z];
  };
}
function boatInv(b, w) {
  const cr = Math.cos(b.roll), sr = Math.sin(b.roll), cp = Math.cos(b.pitch), sp = Math.sin(b.pitch);
  let x = w[0] - b.x, y = w[1] - b.y, z = w[2] - b.z;
  const x1 = x * cr - z * sr, z1 = x * sr + z * cr;
  const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  return [x1, y2, z2];
}

/* ---------- stacking ---------- */
function heights() {
  const b = G.boat, hg = [];
  for (let i = 0; i < b.B; i++) { hg.push([]); for (let j = 0; j < b.L; j++) hg[i].push(0); }
  for (const c of G.onboard) for (const [dx, dy] of c.cells) hg[c.col + dx][c.row + dy] = Math.max(hg[c.col + dx][c.row + dy], c.base + c.h);
  return hg;
}
function check(col, row, sh, h, hg) {
  const b = G.boat;
  if (col < 0 || row < 0 || col + sh.w > b.B || row + sh.l > b.L) return null;
  let base = -1, flat = true;
  for (const [dx, dy] of sh.cells) { const v = hg[col + dx][row + dy]; if (base < 0) base = v; else if (v !== base) flat = false; }
  return { col, row, sh, base, valid: flat && base + h <= MAXH, why: !flat ? 'notFlat' : base + h > MAXH ? 'tooHigh' : '' };
}
function anyFit() {
  const hg = heights(), t = TYPES[G.cur.t];
  for (let r = 0; r < 4; r++) {
    const sh = shapeOf({ t: G.cur.t, rot: r });
    for (let i = 0; i < G.boat.B; i++) for (let j = 0; j < G.boat.L; j++) { const c = check(i, j, sh, t.h, hg); if (c && c.valid) return true; }
  }
  return false;
}
/* screen pixel → deck cell, intersecting the tilted deck plane at the stack height (two passes) */
function pickCell(sx, sy) {
  const b = G.boat, sh = shapeOf(G.cur), t = TYPES[G.cur.t], hg = heights();
  const a = (sx - OX) / S, bb = -(sy - OY) / S;
  const Q0 = [a * RT[0] + bb * UP[0], a * RT[1] + bb * UP[1], a * RT[2] + bb * UP[2]];
  const T = boatT(b);
  let base = 0, res = null;
  for (let pass = 0; pass < 2; pass++) {
    const zl = FB + base * LV;
    const P = T([0, 0, zl]), O = T([0, 0, zl + 1]), Nn = sub(O, P);
    const den = -dot(CAM, Nn);
    if (Math.abs(den) < 1e-6) return null;
    const s = dot(sub(P, Q0), Nn) / den;
    const X = [Q0[0] - s * CAM[0], Q0[1] - s * CAM[1], Q0[2] - s * CAM[2]];
    const loc = boatInv(b, X);
    if (Math.abs(loc[0]) > b.B / 2 + .9 || Math.abs(loc[1]) > b.L / 2 + .9) return null;
    const col = clamp(Math.round(loc[0] + b.B / 2 - sh.w / 2), 0, b.B - sh.w), row = clamp(Math.round(loc[1] + b.L / 2 - sh.l / 2), 0, b.L - sh.l);
    res = check(col, row, sh, t.h, hg);
    if (!res) return null;
    base = Math.min(res.base, MAXH);
  }
  return res;
}

/* ---------- physics ---------- */
function equilibrium() {
  const b = G.boat, spec = b.spec;
  let M = spec.M0, mx = 0, my = 0, mz = 0, cargo = 0;
  for (const c of G.onboard) {
    if (c.drop > 0) continue;
    const t = TYPES[c.t], m = t.m / c.cells.length, cz = (c.base + c.h / 2) * LV;
    for (const [dx, dy] of c.cells) {
      mx += m * (c.col + dx + .5 - b.B / 2); my += m * (c.row + dy + .5 - b.L / 2); mz += m * cz;
    }
    M += t.m; cargo += t.m;
  }
  const top = 1 + 1.25 * mz / M;
  b.eqR = spec.kr * mx / M * top;
  b.eqP = spec.kp * my / M * top;            // load toward the bow (+y) dips the bow (positive pitch)
  b.sink = .016 * cargo;
  return M;
}
function lowestDeck(b) {
  const T = boatT(b);
  let m = 9;
  for (const x of [-b.B / 2, b.B / 2]) for (const y of [-b.L / 2, b.L / 2]) m = Math.min(m, T([x, y, FB])[2]);
  return m;
}
function shares(a, b) {
  for (const [ax, ay] of a.cells) for (const [bx, by] of b.cells) if (a.col + ax === b.col + bx && a.row + ay === b.row + by) return true;
  return false;
}
function topCrates() {
  return G.onboard.filter(c => c.drop <= 0 && !G.onboard.some(o => o !== c && o.base === c.base + c.h && shares(o, c)));
}
/* local boxes of a crate on the boat */
function crateBoxes(c, b) {
  const z0 = FB + c.base * LV + .01 + c.drop, z1 = FB + (c.base + c.h) * LV - .03 + c.drop;
  return rectsOf(c.cells).map(([x0, y0, x1, y1]) => [c.col + x0 - b.B / 2, c.row + y0 - b.L / 2, z0, c.col + x1 - b.B / 2, c.row + y1 - b.L / 2, z1]);
}
function centre(c) {
  let x = 0, y = 0;
  for (const [dx, dy] of c.cells) { x += c.col + dx + .5; y += c.row + dy + .5; }
  return [x / c.cells.length, y / c.cells.length];
}
function releaseCrate(c, dirX, dirY, kick, penalty) {
  const b = G.boat, T = boatT(b), boxes = crateBoxes(c, b);
  const [cx, cy] = centre(c), lc = [cx - b.B / 2, cy - b.L / 2, (boxes[0][2] + boxes[0][5]) / 2];
  const ctr = T(lc);
  const o = T([0, 0, 0]), d = sub(T([dirX, dirY, 0]), o);
  G.onboard.splice(G.onboard.indexOf(c), 1);
  /* keep the crate's boxes relative to its centre so it tumbles as one piece */
  const rel = boxes.map(bx => [bx[0] - lc[0], bx[1] - lc[1], bx[2] - lc[2], bx[3] - lc[0], bx[4] - lc[1], bx[5] - lc[2]]);
  const hh = (boxes[0][5] - boxes[0][2]) / 2;
  G.falling.push({ c, rel, hh, penalty, x: ctr[0], y: ctr[1], z: ctr[2], vx: d[0] * kick, vy: d[1] * kick + (G.phase === 'leave' ? b.speed : 0), vz: 1.1, roll: b.roll, pitch: b.pitch, wr: dirX * 3.2, wp: dirY * 2.4 });
}
let slideCD = 0;
function physics(dt) {
  const b = G.boat, sea = b.spec.sea;
  equilibrium();
  const leaving = G.phase === 'leave';
  const amp = (leaving ? .036 + Math.min(.024, b.speed * .008) : .012) * sea;
  const beam = 3 / b.B;                       /* a wide hull rolls less in the same sea */
  const wr = (amp * Math.sin(G.t * 1.9) + amp * .5 * Math.sin(G.t * 3.1 + 1)) * beam, wp = amp * .45 * Math.sin(G.t * 1.3 + 2);
  const om = 2.7, ze = .22;
  b.rollV += (-om * om * (b.roll - b.eqR - wr) - 2 * ze * om * b.rollV) * dt;
  b.pitchV += (-om * om * 1.3 * (b.pitch - b.eqP - wp) - 2 * ze * om * b.pitchV) * dt;
  b.roll += b.rollV * dt; b.pitch += b.pitchV * dt;
  b.z = lerp(b.z, -b.sink + .035 * sea * Math.sin(G.t * 1.7), Math.min(1, dt * 4));
  if (G.phase !== 'load' && G.phase !== 'leave') return;
  if (Math.abs(b.roll) > CAPSIZE || Math.abs(b.pitch) > PCAPSIZE) return sinkBoat('capsized');
  if (lowestDeck(b) < .015) return sinkBoat('swamped');
  slideCD -= dt;
  if (slideCD <= 0 && (Math.abs(b.roll) > SLIDE || Math.abs(b.pitch) > PSLIDE)) {
    const byRoll = Math.abs(b.roll) / SLIDE >= Math.abs(b.pitch) / PSLIDE;
    const sx = byRoll ? Math.sign(b.roll) : 0, sy = byRoll ? 0 : Math.sign(b.pitch);
    const tops = topCrates();
    if (tops.length) {
      const score = c => { const [cx, cy] = centre(c); return cx * sx + cy * sy + c.base * .7; };
      tops.sort((p, q) => score(q) - score(p));
      releaseCrate(tops[0], sx, sy, 2.6, true);
      sfx('slide');
      slideCD = .45;
    }
  }
}
function sinkBoat(msg) {
  const b = G.boat;
  G.phase = 'sink'; G.phaseT = 0; b.sinkDir = Math.sign(b.roll || 1);
  for (const c of G.onboard.slice()) releaseCrate(c, (rnd() - .5) * 2, (rnd() - .5) * 2, 1.4, false);
  G.log.push({ idx: G.boatIdx, n: 0, value: 0, lost: G.lost, sunk: true });
  toast(tx(msg), 2.6); sfx('splash'); sfx('splash');
}
/* what this boat would earn if it sailed now */
function boatValue() {
  const b = G.boat;
  let v = 0;
  for (const c of G.onboard) v += TYPES[c.t].v * LAYER_MULT[c.base];
  const hg = heights();
  let full = G.onboard.length > 0;
  for (let i = 0; i < b.B; i++) for (let j = 0; j < b.L; j++) if (!hg[i][j]) full = false;
  return { value: Math.round(v * (full ? FULL_BONUS : 1)), full };
}

/* ---------- quads for one frame ---------- */
function buildScene(time) {
  quads = [];
  const tq = STILL ? 0 : Math.floor(time * 8) / 8;
  box(DOCK.x0, DOCK.y0, DOCK.top - .26, DOCK.x1, DOCK.y1, DOCK.top, MAT.dock, 1, ID);
  for (const [x, y] of POSTS) box(x - .13, y - .13, -.4, x + .13, y + .13, DOCK.top + .2, MAT.post, 2, ID);
  for (const y of [-1.45, 1.45]) box(DOCK.x1 - .42, y - .14, DOCK.top, DOCK.x1 - .14, y + .14, DOCK.top + .22, MAT.iron, 3, ID);
  /* crane: mast and slewing arm to the hook */
  const mastTop = [CRANE[0], CRANE[1], 4.75];
  box(CRANE[0] - .32, CRANE[1] - .32, DOCK.top, CRANE[0] + .32, CRANE[1] + .32, DOCK.top + .35, MAT.iron, 4, ID);
  beam([CRANE[0], CRANE[1], DOCK.top + .3], mastTop, .14, MAT.crane, 4, { stripe: true });
  const hook = G.hook || [PICKUP[0], PICKUP[1], 3];
  const armEnd = [hook[0], hook[1], 4.6];
  beam([mastTop[0], mastTop[1], 4.6], armEnd, .1, MAT.crane, 4);
  beam([mastTop[0] - (armEnd[0] - mastTop[0]) * .25, mastTop[1] - (armEnd[1] - mastTop[1]) * .25, 4.62], [mastTop[0], mastTop[1], 4.62], .16, MAT.iron, 4);
  G.ropeTop = armEnd;
  /* the next crates wait on the dock, long side along the dock */
  const drawLoose = (c, cx, cy, z, obj, T) => {
    const sh = shapeOf(c);
    for (const [x0, y0, x1, y1] of rectsOf(sh.cells))
      box(cx - sh.w / 2 + x0, cy - sh.l / 2 + y0, z, cx - sh.w / 2 + x1, cy - sh.l / 2 + y1, z + TYPES[c.t].h * LV - .03, matFor(c.t, c.ci), obj, T || ID);
  };
  G.queue.slice(0, QSLOTS.length).forEach((c, k) => {
    const sh = shapeOf(c), view = sh.w > sh.l ? { ...c, rot: (c.rot + 1) % 4 } : c;
    drawLoose(view, QSLOTS[k][0], QSLOTS[k][1], DOCK.top, 10 + k);
  });
  for (const d of G.dockBack) drawLoose(d, d.x, d.y, DOCK.top, d.id);
  /* the boat */
  const b = G.boat;
  if (b) {
    const T = boatT(b), B = b.B, L = b.L, hw = B / 2, inset = .38, bot = -.5, bow = L / 2 + 1.05, bowB = L / 2 + .45, st = -L / 2 - .3;
    const hm = hb(b), inside = T([0, 0, 0]), hz = { z0: bot, z1: FB };
    /* hull plates are listed bottom edge first, so v runs from the keel (0) to the rail (1) */
    quad([T([hw - inset, st, bot]), T([hw - inset, L / 2, bot]), T([hw, L / 2, FB]), T([hw, st, FB])], hm, 5, inside, hz);
    quad([T([-hw + inset, st, bot]), T([-hw + inset, L / 2, bot]), T([-hw, L / 2, FB]), T([-hw, st, FB])], hm, 5, inside, hz);
    quad([T([hw - inset, L / 2, bot]), T([0, bowB, bot]), T([0, bow, FB]), T([hw, L / 2, FB])], hm, 5, inside, hz);
    quad([T([-hw + inset, L / 2, bot]), T([0, bowB, bot]), T([0, bow, FB]), T([-hw, L / 2, FB])], hm, 5, inside, hz);
    quad([T([-hw + inset, st, bot]), T([hw - inset, st, bot]), T([hw, st, FB]), T([-hw, st, FB])], hm, 5, inside, hz);
    quad([T([-hw, -L / 2, FB]), T([hw, -L / 2, FB]), T([hw, L / 2, FB]), T([-hw, L / 2, FB])], MAT.deck, 5, T([0, 0, -1]));
    quad([T([-hw, L / 2, FB]), T([hw, L / 2, FB]), T([0, bow, FB]), T([0, bow, FB])], MAT.deck, 5, T([0, 0, -1]));
    quad([T([-hw, st, FB]), T([hw, st, FB]), T([hw, -L / 2, FB]), T([-hw, -L / 2, FB])], MAT.deck, 5, T([0, 0, -1]));
    box(-hw, st, FB, -hw + .09, L / 2, FB + .14, MAT.cream, 6, T);
    box(hw - .09, st, FB, hw, L / 2, FB + .14, MAT.cream, 6, T);
    box(-hw, st, FB, hw, st + .09, FB + .14, MAT.cream, 6, T);
    /* flag pole on the stern, behind the cargo from this camera */
    const my = st + .12, mb = T([0, my, FB]), mt = T([0, my, FB + 1.5]);
    beam(mb, mt, .07, MAT.cream, 7);
    const flap = STILL ? 0 : Math.round(Math.sin(tq * 6) * 2) / 10;
    const f0 = T([0, my, FB + 1.48]), f1 = T([0, my, FB + 1.12]), f2 = T([.02, my - .7, FB + 1.18 + flap]), f3 = T([.02, my - .7, FB + 1.44 + flap]);
    quad([f0, f1, f2, f3], MAT.flag, 8, T([1, my, FB + 1.3]));
    quad([f0, f1, f2, f3], MAT.flag, 8, T([-1, my, FB + 1.3]));
    /* target outline on the deck: one bar per outside edge of the footprint */
    if (G.target && G.phase === 'load' && !G.fetch) {
      const tg = G.target, zf = FB + tg.base * LV + .012, mat = tg.valid ? MAT.markOk : MAT.markBad, e = .1;
      const set = new Set(tg.sh.cells.map(([x, y]) => x + ',' + y));
      for (const [dx, dy] of tg.sh.cells) {
        const x0 = tg.col + dx - B / 2 + .03, x1 = x0 + .94, y0 = tg.row + dy - L / 2 + .03, y1 = y0 + .94;
        const bars = [];
        if (!set.has(dx + ',' + (dy - 1))) bars.push([x0, y0, x1, y0 + e]);
        if (!set.has(dx + ',' + (dy + 1))) bars.push([x0, y1 - e, x1, y1]);
        if (!set.has((dx - 1) + ',' + dy)) bars.push([x0, y0, x0 + e, y1]);
        if (!set.has((dx + 1) + ',' + dy)) bars.push([x1 - e, y0, x1, y1]);
        for (const [a0, b0, a1, b1] of bars) quad([T([a0, b0, zf]), T([a1, b0, zf]), T([a1, b1, zf]), T([a0, b1, zf])], mat, 9, T([0, 0, -2]));
      }
    }
    for (const c of G.onboard) for (const x of crateBoxes(c, b)) box(x[0], x[1], x[2], x[3], x[4], x[5], matFor(c.t, c.ci), c.id, T);
  }
  /* crane hook load */
  if (G.cur && (G.phase === 'load' || G.phase === 'arrive' || G.phase === 'manifest')) {
    const t = TYPES[G.cur.t], sh = shapeOf(G.cur);
    let cx, cy, cz;
    if (G.fetch || !G.target || G.phase !== 'load') { cx = PICKUP[0]; cy = PICKUP[1]; cz = DOCK.top + 1.25; }
    else {
      const T = boatT(b), tg = G.target;
      const p = T([tg.col + sh.w / 2 - b.B / 2, tg.row + sh.l / 2 - b.L / 2, FB + tg.base * LV]);
      cx = p[0]; cy = p[1]; cz = p[2] + 1.05 + (STILL ? 0 : Math.sin(time * 3) * .04);
    }
    G.hookGoal = [cx, cy, cz + t.h * LV];
    const hk = G.hook || G.hookGoal;
    if (!G.fetch) drawLoose(G.cur, hk[0], hk[1], hk[2] - t.h * LV, 99);
  } else G.hookGoal = [PICKUP[0], PICKUP[1], 3.2];
  /* falling crates tumble as one piece */
  for (const f of G.falling) {
    const cr = Math.cos(f.roll), sr = Math.sin(f.roll), cp = Math.cos(f.pitch), sp = Math.sin(f.pitch);
    const T = p => { const y = p[1] * cp + p[2] * sp; let z = -p[1] * sp + p[2] * cp; const x = p[0] * cr + z * sr; z = -p[0] * sr + z * cr; return [x + f.x, y + f.y, z + f.z]; };
    for (const r of f.rel) box(r[0], r[1], r[2], r[3], r[4], r[5], matFor(f.c.t, f.c.ci), f.c.id, T, null, false);
  }
}
const hullCache = new Map();
function hb(b) { let m = hullCache.get(b.spec); if (!m) { m = hullMat(b.spec.paint); hullCache.set(b.spec, m); } return m; }

