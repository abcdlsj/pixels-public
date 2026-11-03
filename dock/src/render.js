/* ---------- one frame ---------- */
const WATER = [[30, 62, 98], [38, 86, 126], [50, 114, 148], [74, 146, 168], [128, 188, 198], [236, 244, 238]].map(c => rgb(...c));
function render(time) {
  buildScene(time);
  const tq = STILL ? 0 : Math.floor(time * 8) / 8;
  /* shadow pass */
  smap.fill(-1e9);
  for (const q of quads) rasterQuadShadow(q);
  /* clear: water plane or paper */
  for (let i = 0; i < N; i++) {
    qb[i] = -1;
    if (waterIn[i]) { zb[i] = waterD[i]; ob[i] = 0; } else { zb[i] = -1e9; ob[i] = -1; }
  }
  for (let k = 0; k < quads.length; k++) rasterQuadScreen(quads[k], k);
  /* shade */
  const b = G.boat;
  const hw = b ? b.B / 2 - .12 : 0, L = b ? b.L : 0;
  for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
    const i = iy * W + ix, qi = qb[i];
    if (qi >= 0) {
      const q = quads[qi];
      let lit = q.nl > 0 ? q.nl : 0;
      if (lit > 0 && shadowAt(wxb[i], wyb[i], wzb[i])) lit = 0;
      const l = .3 + .7 * lit + .12 * (q.n[2] > 0 ? q.n[2] : 0);
      pix[i] = q.mat(l, ub[i], vb[i], q, ix, iy);
      continue;
    }
    if (!ob[i] && waterIn[i]) {
      const x = waterX[i], y = waterY[i];
      let lv = 1.9 + (waterN[i] - .5) * 1.5;
      const w = Math.sin(x * 1.5 + y * .8 - tq * 1.7) + .6 * Math.sin(-x * .7 + y * 2.1 - tq * 1.1);
      if (w > 1.2) lv += .9; else if (w < -1.05) lv -= .5;
      if (waterIn[i] === 2) lv += .9;
      if (shadowAt(x, y, 0)) lv -= 1.25;
      let c = WATER[clamp(Math.floor(lv + (bay(ix, iy) - .5) * .5), 0, 4)];
      if (w > 1.45 && hash(ix, iy >> 1) > .6) c = WATER[4];
      /* foam at the hull's waterline, around the posts, and the wake when under way */
      if (b) {
        const lx = x - b.x, ly = y - b.y, bowStart = L / 2;
        let half = hw;
        if (ly > bowStart) half = hw * Math.max(0, 1 - (ly - bowStart) / .85);
        const inLen = ly > -L / 2 - .5 && ly < L / 2 + .95;
        const out = Math.abs(lx) - half;
        if (inLen && out > -.05 && out < .2 + .08 * Math.sin(y * 3 + tq * 4) && bay(ix, iy) < .6) c = WATER[5];
        if (b.speed > .2 && ly < -L / 2 - .3 && ly > -L / 2 - 6) {
          const dd = -L / 2 - .3 - ly, edge = Math.abs(Math.abs(lx) - (half + dd * .32));
          if (edge < .2 && bay(ix, iy) < Math.min(1, b.speed / 3) * (1 - dd / 6)) c = WATER[5];
        }
      }
      for (const [px, py] of POSTS) { const d = Math.hypot(x - px, y - py); if (d < .3 && d > .12 && bay(ix, iy) < .5) c = WATER[5]; }
      pix[i] = c;
      continue;
    }
    pix[i] = BGC;
  }
  /* outlines from object ids + depth: dark against water and paper, warm rim on upper-left overlaps */
  const NB = [-W, -1, W, 1];
  for (let iy = 1; iy < H - 1; iy++) for (let ix = 1; ix < W - 1; ix++) {
    const i = iy * W + ix, o = ob[i];
    if (o <= 0) continue;
    const d = zb[i];
    let water = false, rim = false, low = false;
    for (let k = 0; k < 4; k++) {
      const j = i + NB[k];
      if (ob[j] === o || zb[j] > d - .12) continue;
      if (ob[j] <= 0) water = true; else if (k < 2) rim = true; else low = true;
    }
    const p = pix[i], r = p & 255, g = p >> 8 & 255, bl = p >> 16 & 255;
    if (water) pix[i] = rgb(r * .5, g * .48, bl * .62);
    else if (rim) pix[i] = rgb(lerp(r, 255, .28), lerp(g, 236, .28), lerp(bl, 190, .2));
    else if (low) pix[i] = rgb(r * .74, g * .72, bl * .82);
  }
  /* crane rope: a 1px line with depth test */
  if (G.ropeTop && G.hook) {
    const a = G.ropeTop, h = G.hook, ink = rgb(40, 38, 46);
    const pa = project(a), ph = project(h), n = Math.ceil(Math.hypot(pa.x - ph.x, pa.y - ph.y)) + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = Math.floor(lerp(pa.x, ph.x, t)), y = Math.floor(lerp(pa.y, ph.y, t)), d = lerp(pa.d, ph.d, t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (d >= zb[i] - .05) pix[i] = ink;
    }
  }
  /* particles */
  for (const p of G.parts) {
    const s = project([p.x, p.y, p.z]), x = Math.floor(s.x), y = Math.floor(s.y);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = y * W + x;
    if (s.d < zb[i] - .05) continue;
    /* R x R blocks, so particles keep their size at 2x */
    const w = p.big ? 2 * R : R;
    for (let yy = y; yy < Math.min(H, y + R); yy++) for (let xx = x; xx < Math.min(W, x + w); xx++) pix[yy * W + xx] = p.c;
  }
  ctx.putImageData(img, 0, 0);
}
