'use strict';
/* =====================================================================
   Dockhand — a tiny software rasteriser: orthographic camera, depth buffer,
   rotated triangles, a light-space shadow map, hue-shifted ramps with a
   Bayer screen, and outlines from object ids + depth.
   ===================================================================== */
/* the picture: 320x228 game pixels on desktop. On a narrow screen the canvas is sized at boot so each game pixel is
   about 1.33 CSS px (a whole number of device pixels) and the scene fills the width, a little larger than at 1x. */
const VIEW = (() => {
  const st = document.getElementById('stage').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  /* desktop: rendered at R x 320x228 when the stage gives the 1x picture at least 2 device px per game pixel,
     so the picture keeps its size and gets finer */
  if (st.width >= 560 || st.width < 200 || st.height < 200) {
    const R = Math.min(st.width * dpr / 320, st.height * dpr / 228) >= 2 ? 2 : 1;
    return { W: 320 * R, H: 228 * R, S: 21 * R, R };
  }
  const k = Math.max(1, Math.round(1.34 * dpr));
  const W = Math.floor(st.width * dpr / k), H = Math.max(160, Math.min(Math.floor(st.height * dpr / k), Math.round(W * 1.05)));
  return { W, H, S: .95 * W / 14.6, R: 1 };
})();
const W = VIEW.W, H = VIEW.H, S = VIEW.S, R = VIEW.R;
const PHI = 35 * Math.PI / 180, SP = Math.sin(PHI), CP = Math.cos(PHI), R2 = Math.SQRT1_2;
const CAM = [CP * R2, CP * R2, SP];          // toward the camera
const RT = [R2, -R2, 0];                      // screen right
const UP = [-SP * R2, -SP * R2, CP];          // screen up
const OX = W / 2 + 2 * R, OY = H / 2 - 2 * R;
const BG = [230, 236, 238];
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (r, g, b) => (255 << 24 | clamp(b | 0, 0, 255) << 16 | clamp(g | 0, 0, 255) << 8 | clamp(r | 0, 0, 255)) >>> 0;
function hash(x, y) { const s = Math.sin(x * 157.31 + y * 271.13) * 24634.6345; return s - Math.floor(s); }
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), sx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy);
}
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];

/* light from the upper left of the screen, so shadows fall to the lower right */
const LIGHT = norm([-0.62, 0.5, 0.62]);
const LR = norm([-LIGHT[1], LIGHT[0], 0]), LU = cross(LIGHT, LR);

/* ---------- colour ramps: six steps, shadows drift violet, lights drift warm ---------- */
const COOL = [52, 40, 92], WARM = [255, 236, 190];
function ramp(c) {
  const m = [.36, .54, .72, .88, 1, 1.1], cool = [.36, .22, .1, .03, 0, 0], warm = [0, 0, 0, 0, .06, .22];
  return m.map((k, i) => {
    let r = c[0] * k, g = c[1] * k, b = c[2] * k;
    r = lerp(r, COOL[0], cool[i]); g = lerp(g, COOL[1], cool[i]); b = lerp(b, COOL[2], cool[i]);
    r = lerp(r, WARM[0], warm[i]); g = lerp(g, WARM[1], warm[i]); b = lerp(b, WARM[2], warm[i]);
    return rgb(r, g, b);
  });
}
/* light levels are tuned so lit tops, lit sides and unlit sides land mid-step; the screen only mixes where texture pushes a pixel near a step */
const pick = (rp, l, ix, iy) => rp[clamp(Math.floor(l * 5.6 - .15 + (bay(ix, iy) - .5) * .35), 0, 5)];
