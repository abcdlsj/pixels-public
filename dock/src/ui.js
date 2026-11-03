/* ---------- HUD ---------- */
const $ = id => document.getElementById(id);
const COARSE = matchMedia('(pointer: coarse)').matches;
let toastT = 0;
function toast(msg, sec = 1.6) { $('toast').textContent = msg; $('toast').dataset.show = '1'; toastT = sec; }
const hudCache = {};
function setText(id, s) { if (hudCache[id] !== s) { hudCache[id] = s; $(id).textContent = s; } }
/* a small pixel icon of a crate: its footprint seen from above, extruded by its height */
function crateIcon(t, ci, rot = 0, zoom = 3) {
  const T = TYPES[t], sh = shapeOf({ t, rot }), cell = 7, dz = 3 * T.h;
  const cv = document.createElement('canvas');
  cv.width = sh.w * cell + 2; cv.height = sh.l * cell + dz + 2;
  const x = cv.getContext('2d');
  const base = T.kind === 'fruit' ? T.colors[ci] : T.colors[ci];
  const col = (k, a = 1) => `rgb(${base.map(v => Math.round(Math.min(255, v * k))).join(',')})`;
  const set = new Set(sh.cells.map(([a, b]) => a + ',' + b));
  /* rows are drawn far (high y) at the top of the icon, like the deck seen from the dock */
  const px = (cx, cy) => [1 + cx * cell, 1 + (sh.l - 1 - cy) * cell];
  x.fillStyle = '#1d2a33';
  for (const [cx, cy] of sh.cells) { const [a, b] = px(cx, cy); x.fillRect(a - 1, b - 1, cell + 2, cell + dz + 2); }
  for (const [cx, cy] of sh.cells) { const [a, b] = px(cx, cy); x.fillStyle = col(.62); x.fillRect(a, b + 1, cell, cell + dz - 1); }
  for (const [cx, cy] of sh.cells) {
    const [a, b] = px(cx, cy);
    x.fillStyle = col(1); x.fillRect(a, b, cell, cell);
    x.fillStyle = col(1.18);
    if (!set.has(cx + ',' + (cy + 1))) x.fillRect(a, b, cell, 1);
    if (!set.has((cx - 1) + ',' + cy)) x.fillRect(a, b, 1, cell);
  }
  cv.className = 'icon';
  cv.style.width = cv.width * zoom + 'px'; cv.style.height = cv.height * zoom + 'px';
  return cv;
}
function showManifest() {
  const spec = G.boat.spec, counts = {};
  for (const t of G.manifest) counts[t] = (counts[t] || 0) + 1;
  const card = $('overCard');
  card.innerHTML = '';
  const h = document.createElement('h2'); h.textContent = tx('manifestTitle', { i: G.boatIdx + 1, name: boatName(G.boatIdx) }); card.append(h);
  const lead = document.createElement('p'); lead.textContent = tx('manifest'); card.append(lead);
  const tb = document.createElement('table'); tb.className = 'manifest';
  tb.innerHTML = `<thead><tr><th></th><th>${tx('colCargo')}</th><th>${tx('colWeight')}</th><th class="num">${tx('colQty')}</th></tr></thead>`;
  const body = document.createElement('tbody');
  let total = 0;
  Object.entries(counts).sort((a, b) => TYPES[b[0]].m - TYPES[a[0]].m || b[1] - a[1]).forEach(([type, n]) => {
    const T = TYPES[type]; total += T.m * n;
    const tr = document.createElement('tr');
    const ic = document.createElement('td'); ic.className = 'ic'; ic.append(crateIcon(type, 0, 0, iconZoom(2))); tr.append(ic);
    const nm = document.createElement('td'); nm.textContent = cargoName(type) + (T.h > 1 ? tx('tall') : ''); tr.append(nm);
    const wt = document.createElement('td');
    const bar = document.createElement('span'); bar.className = 'wbar';
    for (let k = 0; k < 5; k++) { const i = document.createElement('i'); if (k >= T.m) i.className = 'off'; bar.append(i); }
    wt.append(bar, document.createTextNode(tx('tons', { n: T.m }))); tr.append(wt);
    const num = document.createElement('td'); num.className = 'num'; num.textContent = '×' + n; tr.append(num);
    body.append(tr);
  });
  tb.append(body); card.append(tb);
  const sum = document.createElement('p'); sum.textContent = tx('sum', { n: G.manifest.length, w: total }); card.append(sum);
  const warn = document.createElement('p'); warn.className = 'warn'; warn.textContent = tx('once'); card.append(warn);
  const btn = document.createElement('button'); btn.className = 'primary'; btn.type = 'button'; btn.id = 'go'; btn.textContent = tx('start');
  btn.addEventListener('click', closeManifest);
  card.append(btn);
  $('over').hidden = false;
  btn.focus({ preventScroll: true });
}
function closeManifest() {
  if (G.seen) return;
  if (COARSE && !touchHintShown) { touchHintShown = true; setTimeout(() => toast(tx('touchHint'), 3.2), 400); }
  G.seen = true; $('over').hidden = true; audio();
  if (G.phase === 'manifest') { G.phase = 'load'; G.phaseT = 0; retarget(); }
  canvas.focus({ preventScroll: true });
}
let iconKey = '';
function updateHud() {
  const b = G.boat;
  setText('hBoat', tx('boatOf', { i: Math.min(G.boatIdx + 1, BOATS.length), n: BOATS.length }));
  setText('hBoatName', b ? boatName(G.boatIdx) : '');
  setText('hScore', String(G.score));
  const active = b && (G.phase === 'load' || G.phase === 'leave');
  const est = active ? boatValue() : null;
  setText('hBoatVal', est ? String(est.value) + (est.full ? ' ' + tx('full') : '') : '0');
  const tideOn = b && b.spec.tide > 0;
  $('cTide').hidden = !tideOn;
  if (tideOn) { const s = Math.max(0, Math.ceil(G.tide)); setText('hTide', tx('seconds', { s })); $('cTide').classList.toggle('warn', s <= 10 && G.phase === 'load'); }
  const k = G.cur ? `${G.cur.t}|${G.cur.ci}|${G.cur.rot}` : '';
  if (k !== iconKey) {
    iconKey = k;
    const slot = $('cIcon'); slot.innerHTML = '';
    if (G.cur) slot.append(crateIcon(G.cur.t, G.cur.ci, G.cur.rot, iconZoom(3)));
  }
  setText('cName', G.cur ? cargoName(G.cur.t) : '');
  setText('cSub', G.cur ? tx('more', { n: G.queue.length }) : '');
  if (b) {
    const deg = v => (v * 180 / Math.PI);
    const r = deg(b.roll), p = deg(b.pitch);
    $('nRoll').style.left = clamp(50 + r / 30 * 50, 0, 100) + '%';
    $('nPitch').style.left = clamp(50 + p / 22 * 50, 0, 100) + '%';
    setText('vRoll', `${Math.abs(r).toFixed(0)}°`);
    setText('vPitch', `${Math.abs(p).toFixed(0)}°`);
    $('gRoll').classList.toggle('warn', Math.abs(b.roll) > SLIDE * .75);
    $('gPitch').classList.toggle('warn', Math.abs(b.pitch) > PSLIDE * .75);
    const fb = Math.max(0, lowestDeck(b));
    $('fDraft').style.width = clamp(fb / FB * 100, 0, 100) + '%';
    setText('vDraft', `${Math.round(fb * 100)}cm`);
    $('gDraft').classList.toggle('warn', fb < .2);
  } else {
    $('nRoll').style.left = $('nPitch').style.left = '50%';
    setText('vRoll', '0°'); setText('vPitch', '0°'); setText('vDraft', '—');
    $('fDraft').style.width = '0%';
    for (const id of ['gRoll', 'gPitch', 'gDraft']) $(id).classList.remove('warn');
  }
  const loading = G.phase === 'load';
  $('bGo').disabled = !loading;
}
/* text and icons snap to whole device pixels of the 12px font grid */
function snapPx(css) { const d = window.devicePixelRatio || 1; return Math.max(1, Math.round(css * d / 12)) * 12 / d; }
function iconZoom(z) { const d = window.devicePixelRatio || 1; return Math.max(1, Math.round(z * d)) / d; }
function setType() {
  const r = document.documentElement.style;
  r.setProperty('--t0', snapPx(13) + 'px'); r.setProperty('--t1', snapPx(16) + 'px'); r.setProperty('--t2', snapPx(26) + 'px');
}
setType();
addEventListener('resize', setType);
document.querySelectorAll('#gRoll .zone').forEach(z => z.style.width = (50 - 14 / 30 * 50) + '%');
document.querySelectorAll('#gPitch .zone').forEach(z => z.style.width = (50 - 10 / 22 * 50) + '%');

/* ---------- actions ---------- */
function place() {
  if (G.phase !== 'load' || !G.cur || G.fetch || !G.target || !G.target.valid) {
    if (G.target && !G.target.valid && G.phase === 'load') toast(tx(G.target.why || 'noRoom'));
    return;
  }
  const t = TYPES[G.cur.t], tg = G.target;
  G.onboard.push({ id: G.nextId++, t: G.cur.t, ci: G.cur.ci, rot: G.cur.rot, cells: tg.sh.cells, col: tg.col, row: tg.row, h: t.h, base: tg.base, drop: 1.05, vz: 0 });
  G.fetch = true;
  nextCrate();
}
function nextCrate() {
  G.cur = G.queue.shift() || null;
  G.target = null;
  if (G.mouse) retarget();
  updateHud();
}
function rotate() {
  if (!G.cur || G.phase !== 'load') return;
  G.cur.rot = (G.cur.rot + 1) % 4;
  if (G.mouse || G.aim) retarget(); else if (G.target) moveKey(0, 0);
  updateHud();
}
function depart(forced) {
  if (G.phase !== 'load') return;
  if (G.onboard.some(c => c.drop > 0)) { G.departSoon = true; return; }
  G.phase = 'leave'; G.phaseT = 0; G.target = null; G.departSoon = false; sfx('horn');
}
function retarget() {
  if (G.phase !== 'load' || !G.cur) { if (G.mouse) G.target = null; return; }
  if (G.mouse) G.target = pickCell(G.mouse[0], G.mouse[1]);
  else if (G.aim) aimTarget();
}
/* touch aims with a virtual cursor in deck coordinates (cells from the deck centre), moved by dragging anywhere */
function aimTarget() {
  const b = G.boat, sh = shapeOf(G.cur), t = TYPES[G.cur.t];
  G.aim[0] = clamp(G.aim[0], -b.B / 2, b.B / 2); G.aim[1] = clamp(G.aim[1], -b.L / 2, b.L / 2);
  const col = clamp(Math.round(G.aim[0] + b.B / 2 - sh.w / 2), 0, b.B - sh.w), row = clamp(Math.round(G.aim[1] + b.L / 2 - sh.l / 2), 0, b.L - sh.l);
  G.target = check(col, row, sh, t.h, heights());
}
function moveKey(dx, dy) {
  if (G.phase !== 'load' || !G.cur) return;
  const sh = shapeOf(G.cur), t = TYPES[G.cur.t], hg = heights(), b = G.boat;
  let col = G.target ? G.target.col : Math.floor((b.B - sh.w) / 2), row = G.target ? G.target.row : Math.floor((b.L - sh.l) / 2);
  col = clamp(col + dx, 0, b.B - sh.w); row = clamp(row + dy, 0, b.L - sh.l);
  G.mouse = null;
  G.target = check(col, row, sh, t.h, hg);
  if (G.target) G.aim = [col + sh.w / 2 - b.B / 2, row + sh.l / 2 - b.L / 2];
}

/* ---------- input ---------- */
function toCanvas(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; G.mouse = toCanvas(e); retarget(); });
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  audio(); if (ac && ac.state === 'suspended') ac.resume();
  if (e.button === 2) { rotate(); return; }
  G.mouse = toCanvas(e); retarget();
});
canvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse' || e.button === 2) return; G.mouse = toCanvas(e); retarget(); place(); });
/* touch and pen: drag anywhere on the page (not on buttons or cards) to move the crane, tap to drop.
   The finger never has to cover the boat. */
let drag = null, touchHintShown = false;
document.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || drag) return;
  if (e.target.closest('button, .tip, #over')) return;
  audio(); if (ac && ac.state === 'suspended') ac.resume();
  if (G.phase !== 'load' || !G.cur) return;
  if (!G.aim) G.aim = [0, 0];
  G.mouse = null;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), aim: G.aim.slice(), moved: false };
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id || G.phase !== 'load' || !G.cur) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 8) return;
  drag.moved = true;
  /* screen drag → ground-plane drag (inverse of the camera), with a little gain so short swipes cross the deck */
  const k = 1.6 / (S * cssScale), a = dx * k, bb = -dy * k / SP;
  G.aim = [drag.aim[0] + (a - bb) * R2, drag.aim[1] + (-a - bb) * R2];
  aimTarget();
});
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const tap = !drag.moved && performance.now() - drag.t < 350;
  drag = null;
  if (tap && e.type === 'pointerup') place();
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
$('bRot').addEventListener('click', () => { audio(); rotate(); });
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { G.mouse = null; G.target = null; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); rotate(); }, { passive: false });
addEventListener('keydown', e => {
  if (e.target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter')) return;
  const k = e.key;
  if (!$('over').hidden) { if ((k === 'Enter' || k === ' ') && G.phase !== 'end') { closeManifest(); e.preventDefault(); } return; }
  if (k === 'r' || k === 'R') rotate();
  else if (k === 'ArrowLeft') moveKey(-1, 0); else if (k === 'ArrowRight') moveKey(1, 0);
  else if (k === 'ArrowUp') moveKey(0, 1); else if (k === 'ArrowDown') moveKey(0, -1);
  else if (k === ' ') place();
  else if (k === 'Enter') depart();
  else return;
  e.preventDefault();
});
$('bGo').addEventListener('click', () => { audio(); depart(); });
/* rules card: hover or focus on desktop, a tap toggles it on touch */
$('bRules').addEventListener('click', e => { const t = $('tip'); t.dataset.open = t.dataset.open === '1' ? '0' : '1'; e.stopPropagation(); });
addEventListener('pointerdown', e => { if (!$('tip').contains(e.target)) $('tip').dataset.open = '0'; });
$('mute').addEventListener('click', () => { muted = !muted; $('mute').textContent = tx(muted ? 'soundOff' : 'soundOn'); $('mute').setAttribute('aria-pressed', String(muted)); });
$('mute').textContent = tx('soundOn');
if ($('lang')) $('lang').addEventListener('click', () => setLang(LANG === 'zh' ? 'en' : 'zh'));
/* a language switch redraws everything the game wrote itself */
function onLangChange() {
  for (const k in hudCache) delete hudCache[k];
  iconKey = '';
  $('mute').textContent = tx(muted ? 'soundOff' : 'soundOn');
  if (!$('over').hidden) { if (G.phase === 'end') renderEnd(); else if (G.boat && !G.seen) showManifest(); }
  updateHud();
}

let cssScale = 1;
function fit() {
  const st = $('stage').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  /* at most 2 CSS px per 1x game pixel: bigger stops looking like a small model */
  const k = Math.max(1, Math.min(Math.round(2 * dpr / R), Math.floor(Math.min(st.width * dpr / W, st.height * dpr / H))));
  const scale = k / dpr;
  cssScale = scale;
  canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px';
}
addEventListener('resize', fit);

/* ---------- update ---------- */
function splash(x, y, n, big) {
  for (let k = 0; k < n; k++) {
    const a = rnd() * 6.283, s = .8 + rnd() * 2.2;
    G.parts.push({ x, y, z: .05, vx: Math.cos(a) * s * .5, vy: Math.sin(a) * s * .5, vz: 2 + rnd() * 2.5, life: .6 + rnd() * .5, c: rnd() < .5 ? WATER[5] : WATER[4], big: big && rnd() < .4, g: 9 });
  }
}
function dust(p, n) {
  for (let k = 0; k < n; k++) {
    const a = rnd() * 6.283, s = .6 + rnd();
    G.parts.push({ x: p[0], y: p[1], z: p[2] + .05, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: .4 + rnd() * .6, life: .3 + rnd() * .2, c: rgb(214, 196, 160), g: 3 });
  }
}
function update(dt) {
  G.t += dt; G.phaseT += dt;
  const b = G.boat;
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').dataset.show = '0';
  if (G.hookGoal) {
    if (!G.hook) G.hook = G.hookGoal.slice();
    const k = Math.min(1, dt * 9);
    for (let i = 0; i < 3; i++) G.hook[i] = lerp(G.hook[i], G.hookGoal[i], k);
    if (G.fetch && Math.hypot(G.hook[0] - G.hookGoal[0], G.hook[1] - G.hookGoal[1], G.hook[2] - G.hookGoal[2]) < .35) { G.fetch = false; retarget(); }
  }
  if (G.phase === 'arrive') {
    const t = Math.min(1, G.phaseT / 2.4), e = 1 - Math.pow(1 - t, 3);
    b.y = lerp(-17, 0, e); b.speed = (1 - t) * 3;
    if (t >= 1) { b.speed = 0; G.phase = G.seen ? 'load' : 'manifest'; G.phaseT = 0; retarget(); }
  }
  if (G.phase === 'load' && b.spec.tide > 0) {
    G.tide -= dt;
    if (G.tide <= 0) depart(true);
  }
  if (G.departSoon && G.phase === 'load') depart(G.tide <= 0 && b.spec.tide > 0);
  for (const c of G.onboard) if (c.drop > 0) {
    c.vz -= 14 * dt; c.drop += c.vz * dt;
    if (c.drop <= 0) {
      c.drop = 0;
      const t = TYPES[c.t];
      const M = b.spec.M0 + G.onboard.reduce((s, o) => s + TYPES[o.t].m, 0);
      const [cx, cy] = centre(c);
      b.rollV += .9 * t.m * (cx - b.B / 2) / M;
      b.pitchV += .6 * t.m * (cy - b.L / 2) / M;
      dust(boatT(b)([cx - b.B / 2, cy - b.L / 2, FB + c.base * LV]), 5);
      sfx('thunk', t.m);
    }
  }
  if (b && G.phase !== 'sink') physics(dt);
  if (G.phase === 'leave') {
    b.speed = Math.min(3.2, b.speed + dt * 1.1);
    b.y += b.speed * dt;
    if (b.y > 9.5) {
      const { value, full } = boatValue();
      G.score += value; G.crates += G.onboard.length;
      G.log.push({ idx: G.boatIdx, n: G.onboard.length, value, full, lost: G.lost });
      if (value) toast(tx('paid', { v: value }) + (full ? '  ' + tx('full') : ''), 2.2);
      if (value) sfx('coin');
      nextBoat();
    }
  }
  if (G.phase === 'sink') {
    b.roll = lerp(b.roll, b.sinkDir * 1.25, Math.min(1, dt * 1.6)); b.rollV = 0;
    b.z -= dt * .5;
    if (G.phaseT > 2.6) nextBoat();
  }
  for (const f of G.falling.slice()) {
    f.vz -= 9.5 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.roll += f.wr * dt; f.pitch += f.wp * dt;
    const onDock = f.x > DOCK.x0 && f.x < DOCK.x1 && f.y > DOCK.y0 && f.y < DOCK.y1;
    if (onDock && f.z - f.hh <= DOCK.top && f.vz < 0 && f.penalty) {
      G.falling.splice(G.falling.indexOf(f), 1);
      G.dockBack.push({ t: f.c.t, ci: f.c.ci, rot: f.c.rot, x: clamp(f.x, DOCK.x0 + .7, DOCK.x1 - .7), y: f.y, id: f.c.id, life: .9 });
      sfx('thunk', 2);
    } else if (f.z < -.7) {
      G.falling.splice(G.falling.indexOf(f), 1);
      splash(f.x, f.y, 16, true); sfx('splash');
    } else if (f.z < .1 && !f.splashed) {
      f.splashed = true; splash(f.x, f.y, 10, true); f.vx *= .3; f.vy *= .3; f.vz *= .3; f.wr *= .3; f.wp *= .3;
      if (f.penalty) { const v = TYPES[f.c.t].v; G.score -= v; G.lost += v; toast(tx('lost', { v })); }
    }
  }
  for (const d of G.dockBack.slice()) if ((d.life -= dt) <= 0) {
    G.dockBack.splice(G.dockBack.indexOf(d), 1);
    if (G.phase === 'load' || G.phase === 'arrive' || G.phase === 'manifest') { if (G.cur) G.queue.unshift(G.cur); G.cur = { t: d.t, ci: d.ci, rot: 0 }; retarget(); }
  }
  for (const p of G.parts.slice()) {
    p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
    if (p.life <= 0 || p.z < -.05) G.parts.splice(G.parts.indexOf(p), 1);
  }
  updateHud();
}
function nextBoat() {
  G.boatIdx++;
  G.falling = G.falling.filter(f => f.z > -.7);
  if (G.boatIdx >= BOATS.length) return endDay();
  startBoat();
}
function endDay() {
  G.phase = 'end'; G.boat = null; G.cur = null; G.queue = [];
  updateHud();
  let best = 0;
  try { best = +(localStorage.getItem('dock-best-v2') || 0); if (G.score > best) localStorage.setItem('dock-best-v2', String(G.score)); } catch (e) { best = 0; }
  G.prevBest = best;
  renderEnd();
}
function renderEnd() {
  const best = G.prevBest, card = $('overCard');
  card.innerHTML = '';
  const h = document.createElement('h2'); h.textContent = tx('dayDone'); card.append(h);
  const ul = document.createElement('ul'); ul.className = 'ledger';
  G.log.forEach((r, i) => {
    const li = document.createElement('li');
    const a = document.createElement('span'); a.textContent = `${i + 1} ${boatName(r.idx)}`;
    const m = document.createElement('span'); m.className = 'mid';
    m.textContent = r.sunk ? tx('sank') : tx('crates', { n: r.n }) + (r.full ? ' ' + tx('full') : '') + (r.lost ? ' ' + tx('lostShort', { n: r.lost }) : '');
    const v = document.createElement('b'); v.textContent = r.sunk ? (r.lost ? `-${r.lost}` : '0') : `+${r.value - r.lost}`;
    li.append(a, m, v); ul.append(li);
  });
  card.append(ul);
  const tot = document.createElement('p'); tot.className = 'total';
  tot.textContent = tx('total', { s: G.score }) + (G.score > best ? ' · ' + tx('newBest') : best ? ' · ' + tx('best', { b: best }) : '');
  card.append(tot);
  const btn = document.createElement('button'); btn.className = 'primary'; btn.type = 'button'; btn.textContent = tx('again');
  btn.addEventListener('click', newDay); card.append(btn);
  $('over').hidden = false; btn.focus({ preventScroll: true });
}

/* ---------- loop ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G.phase !== 'end') for (let k = 0; k < 2; k++) update(dt / 2);
  render(G.t);
  requestAnimationFrame(frame);
}
fit();
newDay();
requestAnimationFrame(t => { last = t; frame(t); });
