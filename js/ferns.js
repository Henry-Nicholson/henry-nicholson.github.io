// Ferns in the two bottom corners of the page: a male fern (Dryopteris filix-mas) on the left and an
// ostrich fern (Matteuccia struthiopteris) on the right. Each frond starts as a fiddlehead and unrolls
// from the base upwards (circinate vernation) over the last stretch of scrolling, lengthening as it
// opens. Its pinnae, lobed into pinnules, come out of the coil short and folded and spread as the
// coil moves on. A couple of young croziers in each clump stay coiled. Fronds are shortened, or left
// out, where they would reach text, the contact card or the plants hanging from it.
(function () {
  'use strict';

  var footer = document.querySelector('.site-footer');
  if (!footer || !window.requestAnimationFrame) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function make(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f1(v) { return Math.round(v * 10) / 10; }
  function pt(p) { return f1(p[0]) + ' ' + f1(p[1]); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  // Where an element sits once its scroll-reveal fade has finished.
  function settledRect(el) {
    var r = el.getBoundingClientRect(), rv = el.closest && el.closest('.reveal'), dy = 0;
    if (rv) {
      var tf = getComputedStyle(rv).transform;
      dy = tf && tf !== 'none' && window.DOMMatrixReadOnly ? -new DOMMatrixReadOnly(tf).m42 : 0;
    }
    return { left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy, width: r.width };
  }

  /* ---------- The two species ---------- */
  // Each frond is listed for the left-hand corner as [angle from the horizontal in degrees (negative is
  // up), length relative to the clump's longest frond, how far it unrolls (1 = fully open)].
  var SPECIES = {
    // Male fern: a scaly stipe about a quarter of the frond, a lanceolate blade whose lowest pinnae are
    // a little shorter than the middle ones, and croziers covered in pale brown scales.
    male: { cls: 'fern-male', stipe: 0.24, peak: 0.36, base: 0.5, rise: 2, span: 0.17, width: 0.15, pairs: 17, scaly: true,
            fronds: [[-117, 0.8, 1], [-104, 0.95, 1], [-91, 1, 1], [-77, 0.92, 1], [-63, 0.8, 1], [-50, 0.66, 1],
                     [-98, 0.5, 0.14], [-72, 0.45, 0.3]] },
    // Ostrich fern: an upright shuttlecock of short-stalked fronds whose pinnae are shortest at the base
    // and longest near the top, where the blade ends abruptly; bright green croziers with few scales.
    ostrich: { cls: 'fern-ostrich', stipe: 0.06, peak: 0.72, base: 0.1, rise: 1, span: 0.145, width: 0.12, pairs: 19, scaly: false,
               fronds: [[-113, 0.84, 1], [-101, 0.96, 1], [-89, 1, 1], [-78, 0.94, 1], [-66, 0.84, 1], [-55, 0.7, 1],
                        [-95, 0.46, 0.2], [-83, 0.42, 0.1]] }
  };
  // Pinna length along the blade, from u = 0 at the lowest pinna to u = 1 at the frond tip.
  function profile(sp, u) {
    if (u <= sp.peak) return sp.base + (1 - sp.base) * (1 - Math.pow(1 - u / sp.peak, sp.rise));
    return Math.pow(Math.cos(Math.PI / 2 * (u - sp.peak) / (1 - sp.peak)), 0.85);
  }

  /* ---------- One frond ---------- */
  function size(f, L) {
    f.L = L;
    f.k0 = f.lean * f.turn / L;           // the open frond arches outwards, more so the further it leans
    f.Lmax = L * f.sp.span;               // longest pinna
    f.r0 = clamp(L * 0.04, 3.4, 6.8);     // radius of the fiddlehead
    f.W0 = clamp(L * 0.028, 2.6, 4.8);    // thickness of the rolled-up blade
    f.wb = clamp(L * 0.011, 1.5, 2.5);    // rachis at the base
  }
  // The frond's axis at stage g (0 = fiddlehead, 1 = open). The stipe lengthens first and the blade
  // then unrolls; the open part arches outwards, most towards its tip. The rest is the crozier, rolled
  // the other way (upper surface inwards) into a spiral that has fewer and smaller turns the further
  // the frond has opened, ending as a hook at the tip.
  var TURNS = 13.2;   // about two turns in a fresh fiddlehead
  function geom(f, g) {
    var Lc = f.L * (0.3 + 0.7 * g), gl = Lc * Math.pow(g, 0.8), n = 36, ds = gl / n;
    var x = f.x0, y = f.y0, a = f.a0, pts = [[x, y]], hd = [a], i;
    for (i = 1; i <= n; i++) {
      a += f.k0 * (0.55 + 0.9 * (i - 0.5) * ds / Lc) * ds;
      x += Math.cos(a) * ds;
      y += Math.sin(a) * ds;
      pts.push([x, y]);
      hd.push(a);
    }
    var coil = [], ch = [], cw = [], open = 1 - g, wr = f.wb * (1 - 0.55 * gl / Lc);
    if (open > 0.012) {
      var Phi = TURNS * Math.pow(open, 0.6), b = f.r0 / TURNS, m = Math.max(6, Math.ceil(Phi / 0.22)), loc = [];
      for (i = 0; i <= m; i++) {   // an Archimedean spiral, from its outer end inwards
        var ph = Phi * (1 - i / m);
        loc.push([b * ph * Math.cos(ph), f.sg * b * ph * Math.sin(ph)]);
      }
      var rot = a - Math.atan2(loc[1][1] - loc[0][1], loc[1][0] - loc[0][0]), cr = Math.cos(rot), sr = Math.sin(rot);
      var Wb = wr + (f.W0 * (0.7 + 0.3 * open) - wr) * Math.min(1, Phi / 4);
      for (i = 0; i <= m; i++) {
        var lx = loc[i][0] - loc[0][0], ly = loc[i][1] - loc[0][1];
        coil.push([x + lx * cr - ly * sr, y + lx * sr + ly * cr]);
        var q = i / m;   // 0 at the base of the coil, 1 at the tip
        cw.push(Math.max(0.9, (wr + (Wb - wr) * smooth(q * Phi / 0.7)) * (1 - 0.72 * q)));
      }
      for (i = 0; i <= m; i++) {
        var j0 = Math.max(0, i - 1), j1 = Math.min(m, i + 1);
        ch.push(Math.atan2(coil[j1][1] - coil[j0][1], coil[j1][0] - coil[j0][0]));
      }
    }
    return { Lc: Lc, gl: gl, ge: gl + 0.15 * Lc * smooth((g - 0.7) / 0.3), ds: ds, pts: pts, hd: hd, coil: coil, ch: ch, cw: cw };
  }
  // Calls fn for every pinna that is out of the coil, with where it joins the rachis, its direction,
  // side, present and final length, and how far it has opened.
  function eachPinna(f, fr, fn) {
    var sp = f.sp, K = f.K;
    for (var k = 0; k < K; k++) {
      for (var sd = 1; sd >= -1; sd -= 2) {
        var u = (k + (sd < 0 ? 0.4 : 0)) / K;   // the two rows are a little offset (subopposite)
        var s = fr.Lc * (sp.stipe + (1 - sp.stipe) * u);
        var e = clamp((fr.ge - s) / (0.14 * fr.Lc), 0, 1);
        if (e < 0.03 || s > fr.gl) continue;
        var fi = s / fr.ds, i0 = Math.min(fr.pts.length - 2, Math.floor(fi)), t = fi - i0;
        var P = [fr.pts[i0][0] + (fr.pts[i0 + 1][0] - fr.pts[i0][0]) * t, fr.pts[i0][1] + (fr.pts[i0 + 1][1] - fr.pts[i0][1]) * t];
        var pa = fr.hd[i0] + sd * (1.32 - 0.52 * u) * (0.3 + 0.7 * e) + 0.06 * e * Math.sin(k * 7.31 + sd * 1.7 + f.seed);
        pa += 0.1 * e * Math.sin(Math.PI / 2 - pa);   // open pinnae sag a little
        var Lf = f.Lmax * profile(sp, u);
        fn(P, pa, sd, Lf * (0.25 + 0.75 * e), Lf, e);
      }
    }
  }
  // A point on a pinna: v along its midrib (which curves towards the frond tip), k half-widths aside.
  function pinPt(P, pa, sd, Lp, W, v, k) {
    var a = pa - 0.2 * sd * v, x = P[0] + Math.cos(a) * Lp * v, y = P[1] + Math.sin(a) * Lp * v;
    if (!k) return [x, y];
    var b = pa - 0.4 * sd * v, h = W * Lp * Math.pow(1 - v, 0.8) * (0.6 + 0.4 * Math.min(1, v / 0.15)) * k;
    return [x - Math.sin(b) * h, y + Math.cos(b) * h];
  }
  // A pinna's outline, with J rounded pinnules along each edge that separate as it opens.
  function pinnaD(P, pa, sd, Lp, W, J, open) {
    function q(v, k) { return pt(pinPt(P, pa, sd, Lp, W, v, k)); }
    var d = 'M' + pt(P), j, v0, dv, vE = 0.93, nk = 1 - 0.6 * open;
    if (J < 2) return d + 'Q' + q(0.42, 2) + ' ' + q(1, 0) + 'Q' + q(0.42, -2) + ' ' + pt(P) + 'Z';
    dv = vE / J;
    d += 'L' + q(0.02, nk);
    for (j = 0; j < J; j++) {
      v0 = j * dv;
      d += 'Q' + q(v0 + dv * 0.15, 1.12) + ' ' + q(v0 + dv * 0.72, 1) + 'Q' + q(v0 + dv * 0.94, 0.9) + ' ' + q(v0 + dv, nk);
    }
    d += 'L' + q(1, 0) + 'L' + q(vE, -nk);
    for (j = J - 1; j >= 0; j--) {
      v0 = j * dv;
      d += 'Q' + q(v0 + dv * 0.94, -0.9) + ' ' + q(v0 + dv * 0.72, -1) + 'Q' + q(v0 + dv * 0.15, -1.12) + ' ' + q(Math.max(0.02, v0), -nk);
    }
    return d + 'Z';
  }
  // A filled band along a line, wOf(i) wide at point i.
  function band(P, H, wOf) {
    var l = [], r = [];
    for (var i = 0; i < P.length; i++) {
      var w = wOf(i) / 2, nx = -Math.sin(H[i]) * w, ny = Math.cos(H[i]) * w;
      l.push(pt([P[i][0] + nx, P[i][1] + ny]));
      r.push(pt([P[i][0] - nx, P[i][1] - ny]));
    }
    return 'M' + l.join('L') + 'L' + r.reverse().join('L') + 'Z';
  }
  var PARTS = ['young', 'pin', 'vein', 'rach', 'coil', 'edge', 'scale'];
  function draw(f, g) {
    var fr = geom(f, g), sp = f.sp, Lc = fr.Lc, out = { young: '', pin: '', vein: '', rach: '', coil: '', edge: '', scale: '' }, i, j;
    function wr(s) { return f.wb * (1 - 0.55 * s / Lc); }
    if (fr.gl > 0.5) out.rach = band(fr.pts, fr.hd, function (k) { return wr(k * fr.ds); });
    if (sp.scaly) {   // brown scales along the male fern's stipe, lying forwards
      var top = Math.min(fr.gl, sp.stipe * Lc * 1.15);
      for (var s = 2, side = 1; s < top; s += 3.2, side = -side) {
        j = Math.min(fr.pts.length - 1, Math.round(s / fr.ds));
        var h = fr.hd[j], half = wr(s) / 2, len = 2.2 * (1 - 0.5 * s / top), a = h + side * (Math.PI / 2 - 0.85);
        var bx = fr.pts[j][0] - Math.sin(h) * side * half, by = fr.pts[j][1] + Math.cos(h) * side * half;
        out.scale += 'M' + pt([bx, by]) + 'l' + f1(Math.cos(a) * len) + ' ' + f1(Math.sin(a) * len);
      }
    }
    if (fr.coil.length) {
      // The rolled blade, and the groove between its turns along the outer edge of each.
      out.coil = band(fr.coil, fr.ch, function (k) { return fr.cw[k]; });
      var edge = [], m = fr.coil.length - 1;
      for (i = 0; i <= m; i++) {
        var hc = fr.ch[i], hw = fr.cw[i] / 2;
        edge.push([fr.coil[i][0] - Math.sin(hc) * f.sg * hw, fr.coil[i][1] + Math.cos(hc) * f.sg * hw]);
      }
      out.edge = 'M' + edge.map(pt).join('L');
      if (sp.scaly) {   // pale brown scales pressed against the outside of the crozier
        for (i = 1; i < m * 0.55; i += 2) {
          var hs = fr.ch[i], e0 = edge[i];
          out.scale += 'M' + pt(e0) + 'l' + f1(-Math.cos(hs - f.sg * 0.45) * 1.3) + ' ' + f1(-Math.sin(hs - f.sg * 0.45) * 1.3);
        }
      }
    }
    eachPinna(f, fr, function (P, pa, sd, Lp, Lf, e) {
      var d = pinnaD(P, pa, sd, Lp, sp.width, Math.min(8, Math.round(Lf / 4)), e);
      if (e > 0.97) out.pin += d; else out.young += d;
      if (Lp > 5) out.vein += 'M' + pt(P) + 'L' + pt(pinPt(P, pa, sd, Lp, 0, 0.5, 0)) + 'L' + pt(pinPt(P, pa, sd, Lp, 0, 0.9, 0));
    });
    for (i = 0; i < PARTS.length; i++) f.el[i].setAttribute('d', out[PARTS[i]]);
  }
  // Whether the frond stays clear of the obstacles at every stage of unrolling.
  function fits(f, blocks, w) {
    var stages = f.gmax < 1 ? [f.gmax, f.gmax / 2] : [1, 0.75, 0.5, 0.25], W = f.sp.width;
    for (var k = 0; k < stages.length; k++) {
      var fr = geom(f, stages[k]), P = fr.pts.concat(fr.coil);
      eachPinna(f, fr, function (Q, pa, sd, Lp) {
        P.push(pinPt(Q, pa, sd, Lp, W, 1, 0), pinPt(Q, pa, sd, Lp, W, 0.35, 1.15), pinPt(Q, pa, sd, Lp, W, 0.35, -1.15),
               pinPt(Q, pa, sd, Lp, W, 0.7, 1.1), pinPt(Q, pa, sd, Lp, W, 0.7, -1.1));
      });
      for (var i = 0; i < P.length; i++) {
        var x = P[i][0], y = P[i][1];
        if (x < 0 || x > w) continue;   // past the edge of the page
        if (y < 6) return false;        // would be cut off at the top of the layer
        for (var b = 0; b < blocks.length; b++) {
          var r = blocks[b];
          if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return false;
        }
      }
    }
    return true;
  }

  /* ---------- Layout ---------- */
  var layer = null, fronds = [], builtW = 0;
  var shown = reduceMotion ? 1 : 0;
  // Text, cards and the contact card's plants near the bottom of the page, in the layer's coordinates.
  function obstacles(lr) {
    var out = [];
    function add(r, m, mb) { out.push([r.left - lr.left - m, r.top - lr.top - m, r.right - lr.left + m, r.bottom - lr.top + (mb || m)]); }
    document.querySelectorAll('h1,h2,h3,h4,p,li,a,img,figure,button,.btn,.contact-card,.next-card,.card,.tile,.chip').forEach(function (el) {
      if (layer.contains(el)) return;
      var r = settledRect(el);
      if (r.width && r.bottom > lr.top - 10 && r.top < lr.bottom + 10) add(r, 6);
    });
    document.querySelectorAll('.myco g.plant').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width && r.bottom > lr.top - 10 && r.top < lr.bottom) add(r, 10, 14);
    });
    return out;
  }
  function build() {
    if (layer) layer.remove();
    fronds = [];
    var w = footer.clientWidth, narrow = w < 640, H = narrow ? 210 : 280, rand = seeded(1729);
    builtW = w;
    layer = make('svg', { class: 'fern-layer', viewBox: '0 0 ' + w + ' ' + H, 'aria-hidden': 'true', focusable: 'false' }, footer);
    layer.style.height = H + 'px';
    var blocks = obstacles(layer.getBoundingClientRect());
    var Lbig = narrow ? clamp(w * 0.34, 96, 140) : clamp(w * 0.16, 170, 235);
    [['male', 1], ['ostrich', -1]].forEach(function (c) {
      var sp = SPECIES[c[0]], side = c[1], inset = narrow ? 10 : 22, x0 = side > 0 ? inset : w - inset, set = [];
      sp.fronds.forEach(function (q, j) {
        var a0 = (side > 0 ? q[0] : -180 - q[0]) * Math.PI / 180 + (rand() - 0.5) * 0.06, dev = a0 + Math.PI / 2;
        var f = { sp: sp, x0: x0 + (rand() - 0.5) * 8, y0: H + 4, a0: a0, gmax: q[2], K: narrow ? Math.round(sp.pairs * 0.75) : sp.pairs,
                  lean: dev > 0.02 ? 1 : dev < -0.02 ? -1 : side, turn: 0.3 + 1.05 * Math.abs(dev) + 0.15 * rand(),
                  start: j * 0.045 + rand() * 0.1, order: q[2] < 1 ? 9 : -Math.abs(dev), seed: rand() * 100 };
        f.sg = f.lean;
        size(f, Lbig * q[1] * (0.93 + 0.14 * rand()));
        for (var tries = 0; tries < 9 && !fits(f, blocks, w); tries++) size(f, f.L * 0.88);
        if (f.L >= Lbig * 0.28 && fits(f, blocks, w)) set.push(f);
      });
      set.sort(function (a, b) { return a.order - b.order; });   // outer fronds behind, young croziers in front
      set.forEach(function (f) {
        var g = make('g', { class: 'fern ' + sp.cls }, layer);
        f.el = PARTS.map(function (k) { return make('path', { class: 'fern-' + k }, g); });
        f.g = -1;
        fronds.push(f);
      });
    });
  }
  function render(force) {
    fronds.forEach(function (f) {
      var g = f.gmax * smooth((shown * 1.2 - f.start) / 0.8);
      if (!force && (g === f.g || (Math.abs(g - f.g) < 0.004 && g > 0 && g < f.gmax))) return;
      f.g = g;
      draw(f, g);
    });
  }

  /* ---------- Scrolling ---------- */
  // The ferns unroll over the last 560 px of the page and roll up again on the way back.
  function goal() {
    if (reduceMotion) return 1;
    var se = document.scrollingElement || document.documentElement;
    return clamp(1 - (se.scrollHeight - window.scrollY - window.innerHeight) / 560, 0, 1);
  }
  var near = false, raf = 0, last = 0, pending = false, waits = 0;
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60, g = goal();
    last = now;
    shown += (g - shown) * Math.min(1, dt / 0.5);
    if (Math.abs(g - shown) < 0.002) shown = g;
    render(false);
    if (shown !== g) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() {
    if (layer && near && !raf && !reduceMotion) raf = requestAnimationFrame(frame);
  }
  // Built once the fonts are in and js/main.js has added the contact card's plants (or after 2 s).
  function ensure() {
    if (layer || pending) return;
    var fontsDue = document.fonts && document.fonts.status !== 'loaded';
    var plantsDue = document.querySelector('.contact-card') && !document.querySelector('.myco g.plant');
    if ((fontsDue || plantsDue) && waits++ < 8) {
      pending = true;
      setTimeout(function () { pending = false; ensure(); }, 250);
      return;
    }
    build();
    render(true);
    kick();
  }
  if (reduceMotion || !('IntersectionObserver' in window)) {
    near = true;
    if (document.readyState === 'complete') ensure();
    else window.addEventListener('load', ensure);
  } else {
    new IntersectionObserver(function (entries) {
      near = entries[entries.length - 1].isIntersecting;
      if (near) { ensure(); kick(); }
    }, { rootMargin: '0px 0px 600px 0px' }).observe(footer);
    window.addEventListener('scroll', kick, { passive: true });
  }
  if ('ResizeObserver' in window) {
    var resizeTimer;
    new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (layer && Math.abs(footer.clientWidth - builtW) > 1) { build(); render(true); }
      }, 200);
    }).observe(footer);
  }
})();
