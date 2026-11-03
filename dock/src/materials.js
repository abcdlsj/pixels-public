/* ---------- materials: each returns a final colour for a pixel ---------- */
const edgeDist = (u, v, q) => Math.min(u * q.su, (1 - u) * q.su, v * q.sv, (1 - v) * q.sv);
/* crate looks are parametrised by colour; a crate's pattern tells its kind, its colour is random like a falling block's */
const KIND = {
  crate(base, opt) {
    const rp = ramp(base);
    return (l, u, v, q, ix, iy) => {
      const e = edgeDist(u, v, q);
      if (e < .075) return pick(rp, l + .07, ix, iy);
      if (opt.brace && !q.top && Math.abs(u - v) < .07) return pick(rp, l + .08, ix, iy);
      if (opt.brace && q.top && (Math.abs(u - v) < .04 || Math.abs(u + v - 1) < .04)) return pick(rp, l - .24, ix, iy);
      const along = q.top ? u * q.su : v * q.sv, k = Math.floor(along / .2);
      if (along / .2 - k < .16) return pick(rp, l - .2, ix, iy);
      return pick(rp, l + (hash(k, q.obj) - .5) * .09, ix, iy);
    };
  },
  metal(base) {
    const rp = ramp(base);
    return (l, u, v, q, ix, iy) => {
      if (edgeDist(u, v, q) < .05) return pick(rp, l - .14, ix, iy);
      if (!q.top && (u * q.su / .17) % 1 < .3) return pick(rp, l + .12, ix, iy);
      return pick(rp, l, ix, iy);
    };
  },
  cab(base, opt) {
    const rp = ramp(base), brass = ramp([226, 186, 92]);
    return (l, u, v, q, ix, iy) => {
      if (edgeDist(u, v, q) < .06) return pick(rp, l - .1, ix, iy);
      if (q.top) return pick(rp, l, ix, iy);
      if (opt.fridge) {
        if (Math.abs(v - .5) * q.sv < .03) return pick(rp, l - .22, ix, iy);
        if (Math.abs(u - .86) * q.su < .04 && ((v > .58 && v < .8) || (v > .2 && v < .42))) return pick(brass, l + .1, ix, iy);
        return pick(rp, l, ix, iy);
      }
      if (Math.abs(u - .5) * q.su < .035) return pick(rp, l - .22, ix, iy);
      if (Math.abs(u - .5) * q.su < .14 && Math.abs(v - .52) * q.sv < .05) return pick(brass, l + .1, ix, iy);
      return pick(rp, l, ix, iy);
    };
  },
  fruit(base) {
    const slat = ramp([214, 178, 118]), fruit = ramp(base);
    return (l, u, v, q, ix, iy) => {
      if (edgeDist(u, v, q) < .06) return pick(slat, l, ix, iy);
      if ((v * q.sv / .19) % 1 < .38) return pick(fruit, l - .08 + (hash(ix >> 1, iy >> 1) - .5) * .2, ix, iy);
      return pick(slat, l, ix, iy);
    };
  },
  lumber(base) {
    const rp = ramp(base), strap = ramp([60, 60, 70]);
    return (l, u, v, q, ix, iy) => {
      if (!q.top && (u * q.su % 1.5) > .66 && (u * q.su % 1.5) < .78) return pick(strap, l, ix, iy);
      if (q.top) return (u * q.su / .2) % 1 < .12 ? pick(rp, l - .2, ix, iy) : pick(rp, l + (hash(Math.floor(u * q.su / .2), 7) - .5) * .1, ix, iy);
      if ((v * q.sv / .16) % 1 < .16) return pick(rp, l - .22, ix, iy);
      return pick(rp, l + (hash(Math.floor(v * q.sv / .16), q.obj) - .5) * .12, ix, iy);
    };
  },
  machine(base) {
    const rp = ramp(base), ink = ramp([44, 44, 50]), hazard = ramp([236, 196, 60]);
    return (l, u, v, q, ix, iy) => {
      const e = edgeDist(u, v, q);
      if (e < .05) return pick(rp, l - .14, ix, iy);
      if (!q.top && v > .7 && v < .86) return ((ix + iy) >> R) & 1 ? pick(ink, l, ix, iy) : pick(hazard, l, ix, iy);
      if (q.top && e < .14 && (Math.floor(u * q.su * 6) + Math.floor(v * q.sv * 6)) % 4 === 0) return pick(rp, l + .2, ix, iy);
      if (q.top && Math.abs(u - .5) * q.su < .25 && (v * q.sv / .1) % 1 < .4) return pick(ink, l + .1, ix, iy);
      return pick(rp, l, ix, iy);
    };
  },
  drum(base) {
    const rp = ramp(base);
    return (l, u, v, q, ix, iy) => {
      if (q.top) {
        const e = edgeDist(u, v, q);
        if (e < .08) return pick(rp, l - .16, ix, iy);
        if (Math.hypot(u - .7, v - .7) < .1) return pick(rp, l + .22, ix, iy);
        return pick(rp, l, ix, iy);
      }
      if ((v > .2 && v < .27) || (v > .72 && v < .79)) return pick(rp, l + .14, ix, iy);
      if ((v > .27 && v < .31) || (v > .79 && v < .83)) return pick(rp, l - .18, ix, iy);
      return pick(rp, l + (Math.abs(u - .35) < .06 ? .1 : 0), ix, iy);
    };
  },
  hay(base) {
    const rp = ramp(base), twine = ramp([128, 92, 52]);
    return (l, u, v, q, ix, iy) => {
      const a = q.top ? v : u;
      if ((a > .3 && a < .35) || (a > .65 && a < .7)) return pick(twine, l, ix, iy);
      return pick(rp, l + (hash(ix, iy * 3) - .5) * .28, ix, iy);
    };
  },
};
const MAT = {};
MAT.deck = (() => {
  const rp = ramp([172, 130, 86]);
  return (l, u, v, q, ix, iy) => {
    const a = u * q.su / .34, k = Math.floor(a);
    if (a - k < .1) return pick(rp, l - .17, ix, iy);
    const b = v * q.sv / 1.6 + hash(k, 3);
    if (b % 1 < .025) return pick(rp, l - .17, ix, iy);
    return pick(rp, l + (hash(k, Math.floor(b)) - .5) * .08, ix, iy);
  };
})();
function hullMat(paint) {
  const rp = ramp(paint), stripe = ramp([232, 226, 208]), anti = ramp([156, 58, 52]);
  return (l, u, v, q, ix, iy) => {
    const z = lerp(q.z0, q.z1, v);
    if (z < .05) return pick(anti, l, ix, iy);
    if (z > q.z1 - .14) return pick(stripe, l, ix, iy);
    if (((z + 2) / .2) % 1 < .12) return pick(rp, l - .14, ix, iy);
    return pick(rp, l, ix, iy);
  };
}
MAT.cream = (() => { const rp = ramp([224, 214, 186]); return (l, u, v, q, ix, iy) => pick(rp, l, ix, iy); })();
MAT.dock = (() => {
  const rp = ramp([150, 128, 108]);
  return (l, u, v, q, ix, iy) => {
    if (!q.top) return pick(rp, l - .08, ix, iy);
    const a = v * q.sv / .32, k = Math.floor(a);
    if (a - k < .14) return pick(rp, l - .2, ix, iy);
    if ((u * q.su + .15) % 1.5 < .06 && hash(k, 9) > .35) return pick(rp, l - .14, ix, iy);
    return pick(rp, l + (hash(k, 4) - .5) * .12, ix, iy);
  };
})();
MAT.post = (() => { const rp = ramp([92, 74, 60]); return (l, u, v, q, ix, iy) => pick(rp, l + ((v * q.sv) % .5 < .06 ? -.15 : 0), ix, iy); })();
MAT.iron = (() => { const rp = ramp([62, 70, 84]); return (l, u, v, q, ix, iy) => pick(rp, l, ix, iy); })();
MAT.crane = (() => {
  const rp = ramp([232, 170, 52]), dark = ramp([60, 60, 68]);
  return (l, u, v, q, ix, iy) => ((u * q.su + v * q.sv) / .3) % 1 < .5 && q.stripe ? pick(dark, l, ix, iy) : pick(rp, l, ix, iy);
})();
MAT.flag = (() => { const rp = ramp([220, 72, 58]); return (l, u, v, q, ix, iy) => pick(rp, l + .15, ix, iy); })();
MAT.markOk = (l, u, v, q, ix, iy) => ((ix + iy) >> R) & 1 ? rgb(255, 214, 72) : rgb(204, 150, 36);
MAT.markBad = (l, u, v, q, ix, iy) => ((ix + iy) >> R) & 1 ? rgb(232, 76, 64) : rgb(160, 40, 44);

