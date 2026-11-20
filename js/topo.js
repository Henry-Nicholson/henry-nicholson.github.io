// Topographic contour lines behind the top of the home page, drawn like a survey map of upland
// terrain: closed rings round summits, close spacing on steep slopes and a heavier index contour on
// every fifth line. The terrain is generated; it is not a real map.
(function () {
  'use strict';

  var hero = document.querySelector('.hero');
  if (!hero) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LEVELS = 24, INDEX_EVERY = 5, FEATURE = 560;   // contour count, index interval, landform scale (px)

  function make(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f1(v) { return Math.round(v * 10) / 10; }

  // Smooth value noise on a fixed, seeded lattice, so the map is the same on every visit.
  function hash(ix, iy) {
    var h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + 1013904223) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    var a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y) {
    var s = 0, amp = 0.5, f = 1;
    for (var o = 0; o < 4; o++) {
      s += amp * noise(x * f + o * 17.13, y * f - o * 9.71);
      f *= 2.03;
      amp *= 0.45;
    }
    return s;
  }
  // Height: domain-warped fractal noise for flowing landforms, a ridged term for sharper crests,
  // and a gentle regional slope.
  function height(x, y) {
    var qx = fbm(x + 3.1, y + 7.7), qy = fbm(x - 5.2, y + 1.3);
    var h = fbm(x + 1.7 * qx, y + 1.7 * qy);
    var ridge = 1 - Math.abs(2 * noise(x * 0.7 + 11.3, y * 0.7 - 4.1) - 1);
    return 0.72 * h + 0.28 * ridge * ridge + 0.05 * x - 0.08 * y;
  }

  // Marching squares for one level, with the segments joined into polylines.
  var T = 0, R = 1, B = 2, L = 3;
  var CASES = { 1: [[L, B]], 2: [[B, R]], 3: [[L, R]], 4: [[T, R]], 6: [[T, B]], 7: [[T, L]], 8: [[T, L]],
                9: [[T, B]], 11: [[T, R]], 12: [[L, R]], 13: [[B, R]], 14: [[L, B]] };
  function trace(field, cols, rows, G, level) {
    var segs = [];
    function pt(e, i, j, a, b, c, d) {
      var t;
      if (e === T) { t = (level - a) / (b - a); return ['h' + i + ',' + j, (i + t) * G, j * G]; }
      if (e === R) { t = (level - b) / (c - b); return ['v' + (i + 1) + ',' + j, (i + 1) * G, (j + t) * G]; }
      if (e === B) { t = (level - d) / (c - d); return ['h' + i + ',' + (j + 1), (i + t) * G, (j + 1) * G]; }
      t = (level - a) / (d - a);
      return ['v' + i + ',' + j, i * G, (j + t) * G];
    }
    for (var j = 0; j < rows - 1; j++) {
      for (var i = 0; i < cols - 1; i++) {
        var a = field[j * cols + i], b = field[j * cols + i + 1], c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
        var idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        var pairs = CASES[idx];
        if (idx === 5 || idx === 10) {   // saddle: decide by the cell centre
          var high = (a + b + c + d) / 4 > level;
          pairs = (idx === 5) === high ? [[T, L], [B, R]] : [[T, R], [L, B]];
        }
        for (var p = 0; p < pairs.length; p++) segs.push(pt(pairs[p][0], i, j, a, b, c, d), pt(pairs[p][1], i, j, a, b, c, d));
      }
    }
    var n = segs.length / 2, adj = new Map(), used = new Uint8Array(n), lines = [];
    for (var s = 0; s < n; s++) {
      for (var e2 = 0; e2 < 2; e2++) {
        var key = segs[2 * s + e2][0], list = adj.get(key);
        if (list) list.push(s); else adj.set(key, [s]);
      }
    }
    for (s = 0; s < n; s++) {
      if (used[s]) continue;
      used[s] = 1;
      var chain = [segs[2 * s], segs[2 * s + 1]];
      for (var front = 0; front < 2; front++) {
        for (;;) {
          var end = front ? chain[0] : chain[chain.length - 1], cand = adj.get(end[0]), next = -1;
          for (var q = 0; q < cand.length; q++) if (!used[cand[q]]) { next = cand[q]; break; }
          if (next < 0) break;
          used[next] = 1;
          var A = segs[2 * next], Bp = segs[2 * next + 1], other = A[0] === end[0] ? Bp : A;
          if (front) chain.unshift(other); else chain.push(other);
        }
      }
      lines.push(chain);
    }
    return lines;
  }

  // A smooth path through a contour's points (quadratic curves between midpoints).
  function pathD(chain) {
    var closed = chain.length > 3 && chain[0][0] === chain[chain.length - 1][0], P = [chain[0]];
    for (var i = 1; i < chain.length; i++) {
      var p = P[P.length - 1], q = chain[i], dx = q[1] - p[1], dy = q[2] - p[2];
      if (dx * dx + dy * dy >= 9 || i === chain.length - 1) P.push(q);
    }
    if (P.length < 3) return null;
    var len = 0;
    for (i = 1; i < P.length; i++) len += Math.sqrt((P[i][1] - P[i - 1][1]) * (P[i][1] - P[i - 1][1]) + (P[i][2] - P[i - 1][2]) * (P[i][2] - P[i - 1][2]));
    if (len < 60) return null;   // drop tiny rings
    var d;
    if (closed) {
      P.pop();
      var m = P.length;
      d = 'M' + f1((P[m - 1][1] + P[0][1]) / 2) + ' ' + f1((P[m - 1][2] + P[0][2]) / 2);
      for (i = 0; i < m; i++) {
        var nx = P[(i + 1) % m];
        d += ' Q' + f1(P[i][1]) + ' ' + f1(P[i][2]) + ' ' + f1((P[i][1] + nx[1]) / 2) + ' ' + f1((P[i][2] + nx[2]) / 2);
      }
      return d + 'Z';
    }
    d = 'M' + f1(P[0][1]) + ' ' + f1(P[0][2]);
    for (i = 1; i < P.length - 1; i++) d += ' Q' + f1(P[i][1]) + ' ' + f1(P[i][2]) + ' ' + f1((P[i][1] + P[i + 1][1]) / 2) + ' ' + f1((P[i][2] + P[i + 1][2]) / 2);
    return d + ' L' + f1(P[P.length - 1][1]) + ' ' + f1(P[P.length - 1][2]);
  }

  var svg = null, built = { w: 0, h: 0 };
  function build(animate) {
    var w = hero.clientWidth, h = hero.clientHeight;
    if (svg) { svg.remove(); svg = null; }
    built = { w: w, h: h };
    if (w < 200 || h < 200) return;
    var G = w < 760 ? 9 : 11, cols = Math.ceil(w / G) + 1, rows = Math.ceil(h / G) + 1;
    var field = new Float32Array(cols * rows), lo = Infinity, hi = -Infinity;
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var v = height(i * G / FEATURE + 0.37, j * G / FEATURE + 0.91);
        field[j * cols + i] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    svg = make('svg', { class: 'topo', viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    var defs = make('defs', null, svg);
    // Fade out towards the bottom of the hero, and thin the lines behind the headline and text.
    var fade = make('linearGradient', { id: 'topo-fade', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    make('stop', { offset: 0, 'stop-color': '#fff' }, fade);
    make('stop', { offset: 0.55, 'stop-color': '#fff', 'stop-opacity': 0.8 }, fade);
    make('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, fade);
    var clear = make('radialGradient', { id: 'topo-clear' }, defs);
    make('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0.6 }, clear);
    make('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0 }, clear);
    var mask = make('mask', { id: 'topo-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h }, defs);
    make('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#topo-fade)' }, mask);
    var text = hero.querySelector('.hero-text');
    if (text) {
      var hr = hero.getBoundingClientRect(), tr = text.getBoundingClientRect();
      make('ellipse', { cx: f1(tr.left - hr.left + tr.width / 2), cy: f1(tr.top - hr.top + tr.height / 2), rx: f1(tr.width * 0.62),
                        ry: f1(tr.height * 0.66), fill: 'url(#topo-clear)' }, mask);
    }
    var g = make('g', { mask: 'url(#topo-mask)' }, svg), paths = [];
    for (var k = 0; k < LEVELS; k++) {
      var level = lo + (k + 0.5) * (hi - lo) / LEVELS;
      trace(field, cols, rows, G, level).forEach(function (chain) {
        var d = pathD(chain);
        if (!d) return;
        var p = make('path', { d: d, class: k % INDEX_EVERY === INDEX_EVERY - 1 ? 'idx' : '' }, g);
        paths.push([p, k]);
      });
    }
    // Drawn in once, contour by contour, like a plotter tracing the map (a CSS animation, so it
    // also plays when a page opened in a background tab is first shown).
    if (animate && !reduceMotion && !window.matchMedia('(hover: none) and (pointer: coarse)').matches) {   // drawn at once on touchscreens
      svg.classList.add('draw');
      paths.forEach(function (pk) {
        pk[0].setAttribute('pathLength', '1');
        pk[0].style.animationDelay = (0.15 + pk[1] * 0.045).toFixed(2) + 's';
      });
    }
    hero.insertBefore(svg, hero.firstChild);
  }

  function start() {
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
    idle(function () { build(true); }, { timeout: 1200 });
    if ('ResizeObserver' in window) {
      var timer;
      new ResizeObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (Math.abs(hero.clientWidth - built.w) > 1 || Math.abs(hero.clientHeight - built.h) > 2) build(false);
        }, 200);
      }).observe(hero);
    }
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
