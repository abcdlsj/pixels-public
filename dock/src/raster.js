/* ---------- frame buffers ---------- */
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
const img = ctx.createImageData(W, H), pix = new Uint32Array(img.data.buffer);
const N = W * H;
const zb = new Float32Array(N), qb = new Int32Array(N), ob = new Int32Array(N);
const ub = new Float32Array(N), vb = new Float32Array(N), wxb = new Float32Array(N), wyb = new Float32Array(N), wzb = new Float32Array(N);

/* the water plane (z = 0) is the same pixels every frame: precompute where each pixel hits it */
const waterX = new Float32Array(N), waterY = new Float32Array(N), waterD = new Float32Array(N), waterIn = new Uint8Array(N), waterN = new Float32Array(N);
const BGC = rgb(...BG);
for (let iy = 0; iy < H; iy++) for (let ix = 0; ix < W; ix++) {
  const i = iy * W + ix, a = (ix + .5 - OX) / S, b = -(iy + .5 - OY) / S;
  const p0 = [a * RT[0] + b * UP[0], a * RT[1] + b * UP[1], a * RT[2] + b * UP[2]];
  const t = -p0[2] / CAM[2];
  const x = p0[0] + t * CAM[0], y = p0[1] + t * CAM[1];
  waterX[i] = x; waterY[i] = y; waterD[i] = t;
  const ex = Math.abs(x - .1) / 5.5, ey = Math.abs(y - .3) / 7.3;
  const r = Math.pow(ex ** 2.6 + ey ** 2.6, 1 / 2.6) + (noise(x * .9, y * .9) - .5) * .09;
  waterIn[i] = r < .93 || (r < 1.02 && hash(ix, iy) > (r - .93) / .09) ? (r > .86 ? 2 : 1) : 0;
  waterN[i] = noise(x * .55, y * .4);
}

/* ---------- shadow map (light space, max depth = closest to the light) ---------- */
const SM = 420 * R;
const smap = new Float32Array(SM * SM);
let smMinX = 1e9, smMinY = 1e9, smMaxX = -1e9, smMaxY = -1e9;
for (const x of [-11, 11]) for (const y of [-12, 12]) for (const z of [-1, 7]) {
  const p = [x, y, z], a = dot(p, LR), b = dot(p, LU);
  smMinX = Math.min(smMinX, a); smMaxX = Math.max(smMaxX, a); smMinY = Math.min(smMinY, b); smMaxY = Math.max(smMaxY, b);
}
const smScale = (SM - 1) / Math.max(smMaxX - smMinX, smMaxY - smMinY);
const [LR0, LR1, LR2] = LR, [LU0, LU1, LU2] = LU, [LI0, LI1, LI2] = LIGHT;
function shadowAt(x, y, z) {
  const sx = ((x * LR0 + y * LR1 + z * LR2 - smMinX) * smScale) | 0, sy = ((x * LU0 + y * LU1 + z * LU2 - smMinY) * smScale) | 0;
  if (sx < 0 || sy < 0 || sx >= SM || sy >= SM) return false;
  return smap[sy * SM + sx] > x * LI0 + y * LI1 + z * LI2 + .07;
}

/* ---------- geometry: quads in world space ---------- */
let quads = [];
/* a quad: four world points (in order around the face), material, object id, plus extra fields for materials */
function quad(p, mat, obj, inside, extra) {
  let n = norm(cross(sub(p[1], p[0]), sub(p[3], p[0])));
  const c = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, (p[0][2] + p[2][2]) / 2];
  if (dot(n, sub(c, inside)) < 0) n = [-n[0], -n[1], -n[2]];
  const q = { p, mat, obj, n, su: Math.hypot(...sub(p[1], p[0])), sv: Math.hypot(...sub(p[3], p[0])), top: n[2] > .7, nl: dot(n, LIGHT), shadowOnly: false };
  if (extra) Object.assign(q, extra);
  quads.push(q);
  return q;
}
/* a box given in some local frame; T maps local points to world */
function box(x0, y0, z0, x1, y1, z1, mat, obj, T, extra, skipBottom = true) {
  const P = (x, y, z) => T([x, y, z]);
  const inside = P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  quad([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], mat, obj, inside, extra);
  quad([P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], mat, obj, inside, extra);
  quad([P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)], mat, obj, inside, extra);
  quad([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], mat, obj, inside, extra);
  quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], mat, obj, inside, extra);
  if (!skipBottom) quad([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], mat, obj, inside, extra);
}
/* a square beam between two world points */
function beam(a, b, t, mat, obj, extra) {
  const d = norm(sub(b, a));
  let s = norm(cross(d, Math.abs(d[2]) > .9 ? [1, 0, 0] : [0, 0, 1]));
  const w = cross(d, s), L = Math.hypot(...sub(b, a));
  const T = p => [a[0] + s[0] * p[0] + w[0] * p[1] + d[0] * p[2], a[1] + s[1] * p[0] + w[1] * p[1] + d[1] * p[2], a[2] + s[2] * p[0] + w[2] * p[1] + d[2] * p[2]];
  box(-t, -t, 0, t, t, L, mat, obj, T, extra, false);
}
const ID = p => p;

/* ---------- rasteriser ---------- */
function project(p) {
  return { x: OX + dot(p, RT) * S, y: OY - dot(p, UP) * S, d: dot(p, CAM) };
}
function rasterQuadScreen(q, qi) {
  if (dot(q.n, CAM) <= 0.001) return;                 // back face
  const P = q.p.map(project);
  const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  tri(P[0], P[1], P[2], UV[0], UV[1], UV[2], q.p[0], q.p[1], q.p[2], qi, q.obj);
  tri(P[0], P[2], P[3], UV[0], UV[2], UV[3], q.p[0], q.p[2], q.p[3], qi, q.obj);
}
function tri(a, b, c, ta, tb, tc, wa, wb, wc, qi, obj) {
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let iy = y0; iy <= y1; iy++) {
    const py = iy + .5;
    for (let ix = x0; ix <= x1; ix++) {
      const px = ix + .5;
      const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
      if (w0 < -1e-6) continue;
      const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
      if (w1 < -1e-6) continue;
      const w2 = 1 - w0 - w1;
      if (w2 < -1e-6) continue;
      const d = w0 * a.d + w1 * b.d + w2 * c.d, i = iy * W + ix;
      if (d <= zb[i]) continue;
      zb[i] = d; qb[i] = qi; ob[i] = obj;
      ub[i] = w0 * ta[0] + w1 * tb[0] + w2 * tc[0];
      vb[i] = w0 * ta[1] + w1 * tb[1] + w2 * tc[1];
      wxb[i] = w0 * wa[0] + w1 * wb[0] + w2 * wc[0];
      wyb[i] = w0 * wa[1] + w1 * wb[1] + w2 * wc[1];
      wzb[i] = w0 * wa[2] + w1 * wb[2] + w2 * wc[2];
    }
  }
}
function rasterQuadShadow(q) {
  const P = q.p.map(p => ({ x: (dot(p, LR) - smMinX) * smScale, y: (dot(p, LU) - smMinY) * smScale, d: dot(p, LIGHT) }));
  stri(P[0], P[1], P[2]); stri(P[0], P[2], P[3]);
}
function stri(a, b, c) {
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(area) < 1e-9) return;
  const inv = 1 / area;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), x1 = Math.min(SM - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), y1 = Math.min(SM - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
    const px = ix + .5, py = iy + .5;
    const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) * inv;
    if (w0 < -1e-6) continue;
    const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) * inv;
    if (w1 < -1e-6) continue;
    const w2 = 1 - w0 - w1;
    if (w2 < -1e-6) continue;
    const d = w0 * a.d + w1 * b.d + w2 * c.d, i = iy * SM + ix;
    if (d > smap[i]) smap[i] = d;
  }
}
