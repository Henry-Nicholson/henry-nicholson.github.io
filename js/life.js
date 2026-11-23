// Animals around the "Outside work" section: a gecko that crosses the page in short bursts, and a
// small planted aquarium with medaka, corydoras and kuhli loaches. Both run only while they are on
// screen, and hold still for visitors who prefer reduced motion.
(function () {
  'use strict';

  var section = document.getElementById('interests');
  if (!section || !window.requestAnimationFrame) return;
  var NS = 'http://www.w3.org/2000/svg';
  var TAU = Math.PI * 2;
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
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function angDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }
  // Where an element sits once its scroll-reveal fade has finished.
  function settledRect(el) {
    var r = el.getBoundingClientRect(), rv = el.closest('.reveal'), dy = 0;
    if (rv) {
      var tf = getComputedStyle(rv).transform;
      dy = tf && tf !== 'none' ? -new DOMMatrixReadOnly(tf).m42 : 0;
    }
    return { left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy, width: r.width, height: r.height };
  }
  // A closed outline through the points, smoothed with quadratic curves between midpoints.
  function blob(P) {
    var n = P.length, d = 'M' + f1((P[n - 1][0] + P[0][0]) / 2) + ' ' + f1((P[n - 1][1] + P[0][1]) / 2);
    for (var i = 0; i < n; i++) {
      var q = P[(i + 1) % n];
      d += ' Q' + f1(P[i][0]) + ' ' + f1(P[i][1]) + ' ' + f1((P[i][0] + q[0]) / 2) + ' ' + f1((P[i][1] + q[1]) / 2);
    }
    return d + 'Z';
  }
  function polyline(P) {
    var d = 'M' + f1(P[0][0]) + ' ' + f1(P[0][1]);
    for (var i = 1; i < P.length; i++) d += ' L' + f1(P[i][0]) + ' ' + f1(P[i][1]);
    return d;
  }

  /* ---------- One animation loop for everything here ---------- */
  // On touchscreens the animals move at half the frame rate, which halves the redrawing (see calm in js/main.js).
  var actors = [], running = false, last = 0, calm = window.matchMedia('(hover: none) and (pointer: coarse)').matches, skipped = false, carry = 0;
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!actors.some(function (a) { return a.on; })) { running = false; last = 0; carry = 0; return; }
    if (calm) {
      skipped = !skipped;
      if (skipped) { carry = dt; requestAnimationFrame(frame); return; }
      dt = Math.min(0.07, dt + carry);
      carry = 0;
    }
    actors.forEach(function (a) { if (a.on) a.step(dt); });
    requestAnimationFrame(frame);
  }
  function wake() {
    if (running || reduceMotion) return;
    running = true;
    last = 0;
    requestAnimationFrame(frame);
  }
  function watch(actor, target, ratio) {
    actors.push(actor);
    if (!('IntersectionObserver' in window)) { actor.on = true; wake(); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var on = e.isIntersecting && e.intersectionRatio >= ratio;
        if (on !== actor.on && actor.seen) actor.seen(on);
        actor.on = on;
      });
      wake();
    }, { threshold: [0, ratio || 0.01] }).observe(target);
  }
  function onResize(target, fn) {
    if (!('ResizeObserver' in window)) return;
    var timer, w0 = target.clientWidth, h0 = target.clientHeight;
    new ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (Math.abs(target.clientWidth - w0) > 1 || Math.abs(target.clientHeight - h0) > 2) {
          w0 = target.clientWidth;
          h0 = target.clientHeight;
          fn();
        }
      }, 200);
    }).observe(target);
  }
  function whenReady(fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    function fonts() { if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go(); }
    if (document.readyState === 'complete') fonts();
    else window.addEventListener('load', fonts);
    setTimeout(go, 2500);
  }

  /* =====================================================================
     Aquarium: a planted tank with medaka near the surface, corydoras on the sand and kuhli loaches
     along the bottom.
     ===================================================================== */
  function gradient(defs, id, stops, x2, y2) {
    var g = make('linearGradient', { id: id, x1: 0, y1: 0, x2: x2 == null ? 0 : x2, y2: y2 == null ? 1 : y2 }, defs);
    stops.forEach(function (s) { make('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] == null ? 1 : s[2] }, g); });
  }

  // Medaka (Oryzias latipes), facing +x, about 26 px long: flat back, upturned mouth, large eyes,
  // a small dorsal fin set far back and a long anal fin.
  var MEDAKA = {
    body: 'M12.9 -0.9 C11 -2 7.4 -2.5 3 -2.6 C-1.6 -2.6 -5.6 -2 -8.7 -1.15 L-8.7 1.15 C-5.2 2.2 -1 2.95 3 2.9 C7 2.7 10.6 1.95 12.7 0.25 Z',
    dorsal: 'M-4.3 -2.35 L-6.3 -4.5 L-7.6 -1.75 Z',
    anal: 'M1.2 2.8 L-0.9 5 L-7.9 3.4 L-7.9 1.5 Z',
    tail: 'M-8.5 -1.1 L-13.3 -3.1 Q-14.2 0 -13.3 3.1 L-8.5 1.1 Z',
    rays: 'M-0.4 3.2 L-1.6 4.7 M-2.6 2.9 L-3.6 4.4 M-4.8 2.5 L-5.6 3.9 M-9.5 -0.4 L-13.4 -1.4 M-9.5 0.4 L-13.4 1.4'
  };
  // Corydoras, facing +x, about 24 px long: deep, armoured body with a flat belly, a tall dorsal fin
  // with a spine, an adipose fin, a forked tail and barbels under the snout.
  var CORY = {
    body: 'M11.7 2.6 C12 0.6 10.4 -2.1 7.6 -3.5 C5 -4.7 1.4 -4.9 -2 -4.4 C-4.8 -3.9 -7 -2.7 -8.6 -1.35 L-8.6 1.5 C-6 2.6 -2 3.4 3 3.6 C6.6 3.7 9.6 3.5 11.7 2.6 Z',
    dorsal: 'M3.6 -4.45 L0.6 -10.2 L-2.7 -4.3 Z',
    spine: 'M3.5 -4.5 L0.6 -10.2',
    adipose: 'M-5.3 -3.25 L-6.9 -4.7 L-7.7 -2.35 Z',
    tail: 'M-8.4 -1.2 L-13.8 -4.8 L-11.7 0 L-13.8 4.8 L-8.4 1.2 Z',
    pectoral: 'M7.4 2.5 L3.4 5.8 L5.3 2.6 Z',
    pelvic: 'M0.5 3.45 L-2.3 5.3 L-1.6 3.35 Z',
    barbels: 'M11.5 2.9 L13.3 4.5 M10.7 3.25 L11.9 5.1 M11.7 2.3 L13.7 3',
    seam: 'M6.2 0.1 C2 0 -3 0.1 -8.3 0'
  };

  // Freshwater shrimp in side view, facing +x, body length 1 (scaled per animal): carapace with a
  // rostrum, a segmented abdomen arching to the tail fan, five walking legs that reach the floor at
  // y = SHRIMP_FOOT, swimmerets under the abdomen and long antennae.
  var SHRIMP_FOOT = 0.24;
  var SHRIMP = {
    body: 'M.47 -.075 C.4 -.14 .26 -.16 .1 -.155 C-.02 -.16 -.12 -.155 -.22 -.12 C-.32 -.09 -.4 -.03 -.45 .02 L-.45 .085 C-.36 .09 -.2 .075 -.04 .08 C.12 .085 .3 .07 .4 .04 C.45 .02 .48 -.03 .47 -.075 Z',
    rostrum: 'M.43 -.095 L.62 -.135 L.46 -.06 Z',
    tail: 'M-.44 .01 C-.52 -.04 -.6 -.05 -.64 0 C-.66 .06 -.63 .13 -.58 .17 C-.52 .15 -.47 .12 -.44 .085 Z',
    segs: 'M.08 -.155 Q.05 -.04 .07 .083 M-.03 -.157 Q-.05 -.04 -.04 .08 M-.13 -.15 Q-.15 -.04 -.14 .078 M-.22 -.12 Q-.25 -.02 -.24 .077 M-.31 -.087 Q-.33 0 -.32 .082 M-.39 -.035 Q-.4 .03 -.39 .086',
    legs: 'M.33 .07 L.365 .16 L.315 .24 M.26 .075 L.295 .16 L.245 .24 M.19 .078 L.225 .16 L.175 .24 M.12 .08 L.155 .16 L.105 .24 M.05 .082 L.085 .16 L.035 .24',
    antennae: 'M.45 -.08 C.75 -.38 .35 -.52 -.25 -.44 M.46 -.07 C.75 -.12 .95 0 1.05 .14 M.47 -.07 L.62 -.15 M.47 -.07 L.63 -.09',
    stripe: 'M.4 -.12 C.25 -.145 .05 -.145 -.12 -.135 C-.25 -.1 -.36 -.05 -.42 0'
  };
  function ovals(list) {   // small ellipses [x, y, rx, ry] as one path
    return list.map(function (e) {
      return 'M' + (e[0] - e[2]).toFixed(3) + ' ' + e[1] + ' a' + e[2] + ' ' + e[3] + ' 0 1 0 ' + (2 * e[2]).toFixed(3) + ' 0 a' + e[2] + ' ' + e[3] + ' 0 1 0 ' + (-2 * e[2]).toFixed(3) + ' 0';
    }).join(' ');
  }

  // Three round lobes, as Hydrocotyle tripartita's leaves look from the side.
  function trefoil(cx, cy, r, a0) {
    var d = '';
    for (var k = 0; k < 3; k++) {
      var a = a0 + k * TAU / 3, lx = cx + Math.cos(a) * r * 0.62, ly = cy + Math.sin(a) * r * 0.5, lr = r * 0.62;
      d += 'M' + f1(lx - lr) + ' ' + f1(ly) + ' a' + f1(lr) + ' ' + f1(lr * 0.8) + ' 0 1 0 ' + f1(2 * lr) + ' 0 a' + f1(lr) + ' ' + f1(lr * 0.8) + ' 0 1 0 ' + f1(-2 * lr) + ' 0 ';
    }
    return d;
  }
  function cubicAt(P0, P1, P2, P3, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]];
  }
  // A leaf drawn along +x from its base and placed with translate/rotate.
  function leafAt(parent, base, angle, d, rib, cls, extra) {
    var g = make('g', { class: cls, transform: 'translate(' + f1(base[0]) + ' ' + f1(base[1]) + ') rotate(' + f1(angle * 57.3) + ')' }, parent);
    make('path', { class: 'em-blade', d: d }, g);
    if (rib) make('path', { class: 'em-rib', d: rib }, g);
    if (extra) make('path', { class: 'em-streak', d: extra }, g);
    return g;
  }
  // Terrestrial plants grown with their roots in the aquarium and their leaves out of the top: a peace
  // lily (Spathiphyllum) with a white spathe, golden pothos (Epipremnum aureum) with one shoot trailing
  // down the front glass, and emersed Hydrocotyle tripartita, whose leaves are larger out of water.
  function growEmersed(root, W, wy, narrow, rand, lilyX, pothX) {
    var k = narrow ? 0.82 : 1, g = make('g', { class: 'tk-emersed' }, root), stalks = '';
    var lily = make('g', { class: 'em-lily' }, g), B = [lilyX, wy + 1];
    var spathTop = [lilyX + 4 * k, wy - 46 * k];
    stalks += 'M' + f1(B[0]) + ' ' + f1(B[1]) + ' Q' + f1(B[0] + 1) + ' ' + f1((B[1] + spathTop[1]) / 2) + ' ' + f1(spathTop[0]) + ' ' + f1(spathTop[1]) + ' ';
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + (i - 2.5) * 0.3 + (rand() - 0.5) * 0.1, P = (16 + rand() * 13) * k;
      var Lb = [B[0] + Math.cos(a) * P, B[1] + Math.sin(a) * P], ba = a + (a + Math.PI / 2) * 0.9, bl = (18 + rand() * 7) * k, bw = bl * 0.17;
      stalks += 'M' + f1(B[0]) + ' ' + f1(B[1]) + ' Q' + f1(B[0] + Math.cos(a) * P * 0.5) + ' ' + f1(B[1] + Math.sin(a) * P * 0.55) + ' ' + f1(Lb[0]) + ' ' + f1(Lb[1]) + ' ';
      leafAt(lily, Lb, ba, 'M0 0 C' + f1(bl * 0.3) + ' ' + f1(-bw) + ' ' + f1(bl * 0.75) + ' ' + f1(-bw * 0.85) + ' ' + f1(bl) + ' 0 C' + f1(bl * 0.75) + ' ' + f1(bw * 0.85) + ' ' + f1(bl * 0.3) + ' ' + f1(bw) + ' 0 0 Z',
             'M0 0 L' + f1(bl * 0.93) + ' 0', 'em-lily-leaf');
    }
    var s = 13 * k, sp = make('g', { class: 'em-spathe-g', transform: 'translate(' + f1(spathTop[0]) + ' ' + f1(spathTop[1]) + ') rotate(-8)' }, lily);
    make('path', { class: 'em-spathe', d: 'M0 0 C' + f1(-0.42 * s) + ' ' + f1(-0.3 * s) + ' ' + f1(-0.36 * s) + ' ' + f1(-0.82 * s) + ' 0 ' + f1(-s) + ' C' + f1(0.3 * s) + ' ' + f1(-0.82 * s) + ' ' + f1(0.4 * s) + ' ' + f1(-0.3 * s) + ' 0 0 Z' }, sp);
    make('ellipse', { class: 'em-spadix', cx: f1(-0.05 * s), cy: f1(-0.34 * s), rx: f1(0.08 * s), ry: f1(0.22 * s) }, sp);

    // Golden pothos: heart-shaped, gold-streaked leaves; one shoot arches over the rim and down the glass.
    var poth = make('g', { class: 'em-pothos' }, g), PB = [pothX, wy + 1], stems = '';
    [[[-6, -22], [-18, -36], [-30, -40], false], [[4, -20], [12, -34], [22, -42], false], [[10, -14], [28, -8], [24, 34], true]].forEach(function (sh, si) {
      var P1 = [PB[0] + sh[0][0] * k, PB[1] + sh[0][1] * k], P2 = [PB[0] + sh[1][0] * k, PB[1] + sh[1][1] * k], P3 = [PB[0] + sh[2][0] * k, PB[1] + sh[2][1] * k];
      stems += 'M' + f1(PB[0]) + ' ' + f1(PB[1]) + ' C' + f1(P1[0]) + ' ' + f1(P1[1]) + ' ' + f1(P2[0]) + ' ' + f1(P2[1]) + ' ' + f1(P3[0]) + ' ' + f1(P3[1]) + ' ';
      [0.36, 0.6, 0.82, 1].forEach(function (t, li) {
        var p = cubicAt(PB, P1, P2, P3, t), q = cubicAt(PB, P1, P2, P3, Math.max(0, t - 0.04));
        var tan = Math.atan2(p[1] - q[1], p[0] - q[0]), side = (li + si) % 2 ? 1 : -1, L = (16 - li * 1.6 + rand() * 2) * k, w = L * 0.8;
        var ang = tan + side * 1.1;
        if (sh[3]) ang += (Math.PI / 2 - ang) * 0.3;   // the trailing shoot's leaves hang
        leafAt(poth, p, ang, 'M' + f1(L * 0.08) + ' 0 C' + f1(-L * 0.14) + ' ' + f1(-w * 0.5) + ' ' + f1(L * 0.55) + ' ' + f1(-w * 0.72) + ' ' + f1(L) + ' 0 C' + f1(L * 0.55) + ' ' + f1(w * 0.72) + ' ' + f1(-L * 0.14) + ' ' + f1(w * 0.5) + ' ' + f1(L * 0.08) + ' 0 Z',
               'M' + f1(L * 0.08) + ' 0 L' + f1(L * 0.92) + ' 0', 'em-pothos-leaf',
               'M' + f1(L * 0.3) + ' 0 q' + f1(L * 0.1) + ' ' + f1(-w * 0.12) + ' ' + f1(L * 0.16) + ' ' + f1(-w * 0.3) + ' M' + f1(L * 0.48) + ' 0 q' + f1(L * 0.08) + ' ' + f1(w * 0.12) + ' ' + f1(L * 0.14) + ' ' + f1(w * 0.26) + ' M' + f1(L * 0.66) + ' 0 q' + f1(L * 0.06) + ' ' + f1(-w * 0.08) + ' ' + f1(L * 0.12) + ' ' + f1(-w * 0.18));
      });
    });
    make('path', { class: 'em-pothos-stem', d: stems }, poth);
    poth.insertBefore(poth.lastChild, poth.firstChild);   // stems behind the leaves

    // Emersed Hydrocotyle tripartita.
    var hyd = make('g', { class: 'em-hydro' }, g), hx = W * 0.64, hd = '', hl = '';
    for (var h = 0; h < 6; h++) {
      var x = hx + (h - 2.5) * 5 * k + (rand() - 0.5) * 3, ht = (8 + rand() * 15) * k, ln = (rand() - 0.5) * 6;
      hd += 'M' + f1(x) + ' ' + f1(wy + 1) + ' q' + f1(ln * 0.3) + ' ' + f1(-ht * 0.6) + ' ' + f1(ln) + ' ' + f1(-ht) + ' ';
      hl += trefoil(x + ln, wy + 1 - ht, (2.6 + rand() * 0.9) * k, rand() * TAU);
    }
    make('path', { class: 'em-stalk', d: hd }, hyd);
    make('path', { class: 'em-hydro-leaf', d: hl }, hyd);
    make('path', { class: 'em-stalk', d: stalks }, lily).parentNode.insertBefore(lily.lastChild, lily.firstChild);   // stalks behind
  }

  function buildTank(box) {
    var W = box.clientWidth, TOP = W < 520 ? 52 : 62, H = box.clientHeight - TOP;
    if (W < 120 || H < 80) return null;
    var rand = seeded(5150), time = 0, narrow = W < 520;
    var surf = 8, sand = H - 15;
    // The glass tank sits below a band where terrestrial plants grow out of the top of it. Everything
    // inside the tank is drawn in tank coordinates and clipped to the glass.
    var root = make('svg', { viewBox: '0 0 ' + W + ' ' + (H + TOP), 'aria-hidden': 'true', focusable: 'false' });
    var defs = make('defs', null, root);
    make('rect', { x: 0, y: 0, width: W, height: H, rx: 14 }, make('clipPath', { id: 'tk-clip' }, defs));
    var water = make('linearGradient', { id: 'tk-water', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [[0, 'tk-w1'], [0.55, 'tk-w2'], [1, 'tk-w3']].forEach(function (st) { make('stop', { offset: st[0], class: st[1] }, water); });
    var svg = make('g', { transform: 'translate(0 ' + TOP + ')', 'clip-path': 'url(#tk-clip)' }, root);
    make('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#tk-water)' }, svg);
    gradient(defs, 'tk-ray', [[0, '#ffffff', 0.38], [1, '#ffffff', 0]]);
    gradient(defs, 'tk-sand', [[0, '#e3d4b4'], [0.35, '#d6c4a0'], [1, '#c4ae86']]);
    gradient(defs, 'tk-med-o', [[0, '#d9702c'], [0.5, '#f0a052'], [1, '#f8d9aa']]);
    gradient(defs, 'tk-med-w', [[0, '#7a6d4b'], [0.48, '#b7b39c'], [1, '#ebe8dc']]);
    gradient(defs, 'tk-cory-p', [[0, '#5f6252'], [0.55, '#9a9a85'], [1, '#e7dbc4']]);
    gradient(defs, 'tk-cory-b', [[0, '#4f5636'], [0.5, '#7e8c58'], [1, '#e0d2b0']]);
    gradient(defs, 'tk-kuhli', [[0, '#d99248'], [0.6, '#eeb46a'], [1, '#f6dcae']]);
    gradient(defs, 'tk-wood', [[0, '#6b4a30'], [1, '#3e2a1b']]);
    gradient(defs, 'tk-rock', [[0, '#b08d64'], [0.55, '#8c6c4b'], [1, '#634c37']]);
    gradient(defs, 'tk-bgrock', [[0, '#b39a78'], [0.5, '#95795a'], [1, '#6f5a44']]);
    gradient(defs, 'tk-darkrock', [[0, '#5b5a45'], [1, '#2f3022']]);

    // The planting follows the user's own tank: a red stem plant at the back left, big hammered green
    // Aponogeton leaves across the back right, red and bronze Cryptocoryne in the middle, driftwood,
    // Madagascar lace plant at the front left, java fern, a little terracotta pot, a red rosette plant,
    // big tan river stones and a moss-covered rock on the right, light sand and dwarf grass.
    var ps = narrow ? 0.72 : 1, sway = [];
    function swayer(g, x, y, a, amp, sp) {
      sway.push({ g: g, x: x, y: y, a: a, amp: amp, sp: sp, ph: rand() * TAU });
      g.setAttribute('transform', 'translate(' + f1(x) + ' ' + f1(y) + ') rotate(' + f1(a * 57.3) + ')');
      return g;
    }
    // A leaf along +x from its base, its midline curving by `bend` towards the tip; `wave` ripples the margin.
    function curvedLeaf(len, wid, bend, wave, ph, blunt) {
      var n = 18, sp = [], th = [], Lf = [], Rt = [], x = 0, y = 0;
      for (var i = 0; i <= n; i++) {
        var t = i / n, a = bend * Math.pow(t, 1.5);
        sp.push([x, y]);
        th.push(a);
        x += Math.cos(a) * len / n;
        y += Math.sin(a) * len / n;
      }
      function hw(t) { return wid / 2 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * (blunt ? 0.92 : 1) + (blunt ? 0.04 : 0)))), 0.6) * (1 + wave * Math.sin(t * Math.PI * 9 + ph)); }
      for (i = 0; i <= n; i++) {
        var w2 = hw(i / n), nx = -Math.sin(th[i]), ny = Math.cos(th[i]);
        Lf.push([sp[i][0] + nx * w2, sp[i][1] + ny * w2]);
        Rt.push([sp[i][0] - nx * w2, sp[i][1] - ny * w2]);
      }
      return { d: blob(Lf.concat(Rt.reverse())), sp: sp, th: th, hw: hw, n: n };
    }

    // Air above the water and slanting light from the surface.
    make('rect', { class: 'tk-air', x: 0, y: 0, width: W, height: surf }, svg);
    var rays = [], rayG = make('g', { class: 'tk-rays' }, svg);
    for (var r = 0; r < 3; r++) {
      var rx = W * (0.18 + 0.3 * r + rand() * 0.08), rw = 26 + rand() * 30;
      rays.push({ el: make('path', { class: 'tk-ray', fill: 'url(#tk-ray)',
        d: 'M' + f1(rx) + ' ' + surf + ' L' + f1(rx + rw) + ' ' + surf + ' L' + f1(rx + rw + H * 0.55) + ' ' + H + ' L' + f1(rx + H * 0.35) + ' ' + H + ' Z' }, rayG),
        ph: rand() * TAU });
    }

    // Big stones at the back, tan and partly mossed, softened by the water in front of them.
    function mossCap(parent, cx, top, rw, rh, dense) {
      var d = '', nm = Math.round(rw * (dense ? 2.2 : 1.1));
      for (var m = 0; m < nm; m++) {
        var dx = (rand() * 2 - 1) * rw * (dense ? 0.92 : 0.7), yy = top + rh * (1 - Math.sqrt(Math.max(0, 1 - (dx / rw) * (dx / rw)))) + rand() * rh * (dense ? 0.9 : 0.35);
        var rr = 0.7 + rand() * 1.1;
        d += 'M' + f1(cx + dx - rr) + ' ' + f1(yy) + ' a' + f1(rr) + ' ' + f1(rr * 0.8) + ' 0 1 0 ' + f1(2 * rr) + ' 0 a' + f1(rr) + ' ' + f1(rr * 0.8) + ' 0 1 0 ' + f1(-2 * rr) + ' 0 ';
      }
      make('path', { class: dense ? 'tk-moss dense' : 'tk-moss', d: d }, parent);
    }
    function stone(parent, cx, rw, rh, base, tilt, cls, fill) {
      var pts = [];
      for (var i = 0; i <= 12; i++) {
        var t = Math.PI * i / 12, jit = 1 + (rand() - 0.5) * 0.12, c = Math.cos(t);
        pts.push([cx - c * rw * jit, base - Math.sin(t) * rh * jit * (1 + tilt * c)]);
      }
      pts.push([cx + rw * 0.92, base + 3], [cx - rw * 0.92, base + 3]);
      make('path', { class: cls, fill: fill, d: blob(pts) }, parent);
      make('path', { class: 'tk-rock-hi', d: 'M' + f1(cx - rw * 0.55) + ' ' + f1(base - rh * 0.78) + ' Q' + f1(cx - rw * 0.12) + ' ' +
        f1(base - rh * (1.02 + tilt * 0.3)) + ' ' + f1(cx + rw * 0.38) + ' ' + f1(base - rh * 0.86) }, parent);
    }
    var bgStones = make('g', { class: 'tk-bgstones' }, svg);
    [[0.7, 50, 40, 0.15, true], [0.85, 70, 52, -0.1, false], [0.975, 50, 44, 0.2, true], [0.06, 40, 27, -0.2, false]].forEach(function (sp2) {
      var cx = W * sp2[0], rw = sp2[1] * ps, rh = sp2[2] * ps;
      stone(bgStones, cx, rw, rh, sand + 4, sp2[3], 'tk-bgstone', 'url(#tk-bgrock)');
      if (sp2[4]) mossCap(bgStones, cx, sand + 4 - rh, rw, rh, false);
    });

    // Back right: big Aponogeton leaves with a hammered (bullate) blade and wavy margin, arching over.
    var apoG = make('g', { class: 'tk-apo' }, svg), nApo = narrow ? 5 : 8;
    for (var ai = 0; ai < nApo; ai++) {
      var abx = W * (0.6 + 0.38 * (ai + rand() * 0.7) / nApo), along = Math.min(sand - surf - 8, (72 + rand() * 46) * ps);
      var aang = -Math.PI / 2 - 0.15 - rand() * 0.75, abend = -(0.5 + rand() * 0.6);   // leaning left and arching over
      var leaf = curvedLeaf(along, (9 + rand() * 4) * ps, abend, 0.13, rand() * TAU);
      var g = swayer(make('g', null, apoG), abx, sand + 2, aang, 0.025, 0.45 + rand() * 0.2);
      make('path', { class: 'apo-blade' + (rand() < 0.3 ? ' pale' : ''), d: leaf.d }, g);
      var wr = '';
      for (var wi = 2; wi < leaf.n - 1; wi++) {   // the hammered texture: little transverse puckers
        var p = leaf.sp[wi], th0 = leaf.th[wi], hwv = leaf.hw(wi / leaf.n) * 0.78, nx0 = -Math.sin(th0), ny0 = Math.cos(th0);
        wr += 'M' + f1(p[0] + nx0 * hwv) + ' ' + f1(p[1] + ny0 * hwv) + ' Q' + f1(p[0] + Math.cos(th0) * 1.6) + ' ' + f1(p[1] + Math.sin(th0) * 1.6) + ' ' +
              f1(p[0] - nx0 * hwv) + ' ' + f1(p[1] - ny0 * hwv) + ' ';
      }
      make('path', { class: 'apo-wrinkle', d: wr }, g);
      make('path', { class: 'apo-rib', d: polyline(leaf.sp) }, g);
    }

    // Back left: a red stem plant.
    var stemG = make('g', { class: 'tk-stems' }, svg), nStem = narrow ? 3 : 5;
    for (var si = 0; si < nStem; si++) {
      var sx = W * (0.13 + 0.09 * si / nStem + rand() * 0.02), sh = Math.min(sand - surf - 6, (58 + rand() * 50) * ps), lean = (rand() - 0.5) * 0.25;
      var sg = swayer(make('g', null, stemG), sx, sand + 2, -Math.PI / 2 + lean, 0.03, 0.6 + rand() * 0.3), lv = '';
      for (var hgt = 6; hgt < sh; hgt += 4.2 * ps) {
        var ll = (7 - 3 * hgt / sh) * ps, la = 0.75 + rand() * 0.3;
        [1, -1].forEach(function (sd) {   // a pair of narrow leaves at each node, pointing up the stem
          lv += 'M' + f1(hgt) + ' 0 l' + f1(Math.cos(sd * la) * ll) + ' ' + f1(Math.sin(sd * la) * ll) + ' ';
        });
      }
      make('path', { class: 'stem-stalk', d: 'M0 0 L' + f1(sh) + ' 0' }, sg);
      make('path', { class: 'stem-leaves', d: lv }, sg);
    }

    // Sand with scattered grains and pebbles.
    var sd2 = 'M0 ' + f1(sand + 1);
    for (var sx2 = 0; sx2 <= W; sx2 += 40) sd2 += ' Q' + f1(sx2 + 20) + ' ' + f1(sand - 1.5 + rand() * 3) + ' ' + f1(Math.min(W, sx2 + 40)) + ' ' + f1(sand + rand() * 1.5);
    make('path', { class: 'tk-sand', fill: 'url(#tk-sand)', d: sd2 + ' L' + W + ' ' + H + ' L0 ' + H + ' Z' }, svg);
    var pebbles = make('g', { class: 'tk-pebbles' }, svg), tones = ['#b7a27c', '#cbb995', '#9d8a69', '#ded0b2', '#8a7a62'];
    for (var pb = 0; pb < Math.round(W / 9); pb++) {
      make('ellipse', { cx: f1(rand() * W), cy: f1(sand + 2.5 + rand() * (H - sand - 4)), rx: f1(0.6 + rand() * 1.6),
                        ry: f1(0.5 + rand() * 1), fill: tones[Math.floor(rand() * tones.length)] }, pebbles);
    }

    var kuhliLayer = make('g', null, svg);

    // Front stones on the right: tan stones, one with a moss cap, and a dark rock furred with moss.
    var rocks = [], rockG = make('g', { class: 'tk-rocks' }, svg);
    [[0.8, 50, 36, 0.1, 1], [0.7, 27, 19, -0.1, 0], [0.9, 33, 26, 0.2, 0], [0.62, 19, 13, 0, 0], [0.955, 28, 28, 0.1, 2]].forEach(function (sp3) {
      var cx = W * sp3[0], rw = sp3[1] * (narrow ? 0.8 : 1), rh = sp3[2] * (narrow ? 0.8 : 1), base = sand + 2.5;
      stone(rockG, cx, rw, rh, base, sp3[3], sp3[4] === 2 ? 'tk-rock dark' : 'tk-rock', sp3[4] === 2 ? 'url(#tk-darkrock)' : 'url(#tk-rock)');
      if (sp3[4]) mossCap(rockG, cx, base - rh, rw, rh, sp3[4] === 2);
      rocks.push({ cx: cx, rw: rw, rh: rh, base: base });
    });
    function floorAt(x) {   // the top of the sand or of a stone
      var y = sand;
      rocks.forEach(function (rk) {
        var d = (x - rk.cx) / rk.rw;
        if (Math.abs(d) < 0.95) y = Math.min(y, rk.base - rk.rh * Math.sqrt(1 - d * d) * 0.97);
      });
      return y;
    }

    // Hydrocotyle tripartita creeping over the stones on the right.
    var hydroG = make('g', { class: 'tk-hydro' }, svg), hx0 = W * 0.6, hx1 = W * 0.86, hs = '', hl = '';
    var runner = 'M' + f1(hx0) + ' ' + f1(floorAt(hx0) + 0.3);
    for (var rx3 = hx0 + 4; rx3 <= hx1; rx3 += 4) runner += ' L' + f1(rx3) + ' ' + f1(floorAt(rx3) + 0.3);
    for (var hx = hx0; hx < hx1; hx += 3.4 + rand() * 3) {
      var fy = floorAt(hx) + 0.4, hh2 = (2.5 + rand() * 6) * ps, ln = (rand() - 0.5) * 3;
      hs += 'M' + f1(hx) + ' ' + f1(fy) + ' q' + f1(ln * 0.3) + ' ' + f1(-hh2 * 0.6) + ' ' + f1(ln) + ' ' + f1(-hh2) + ' ';
      hl += trefoil(hx + ln, fy - hh2, 1.5 + rand() * 0.7, rand() * TAU);
    }
    make('path', { class: 'hy-stem', d: runner + ' ' + hs }, hydroG);
    make('path', { class: 'hy-leaf', d: hl }, hydroG);

    // Red and bronze Cryptocoryne in the middle.
    function cryptClump(cx, n, lenMin, lenVar, widF, spread, cls, cols, wave) {
      var cg2 = make('g', { class: cls }, svg);
      for (var c3 = 0; c3 < n; c3++) {
        var a3 = -Math.PI / 2 + (c3 - (n - 1) / 2) / ((n - 1) / 2) * spread + (rand() - 0.5) * 0.15, l3 = (lenMin + rand() * lenVar) * ps;
        var lf = curvedLeaf(l3, l3 * widF, (a3 + Math.PI / 2) * 0.6, wave, rand() * TAU, true);
        var g3 = swayer(make('g', null, cg2), cx + (rand() - 0.5) * 6 * ps, sand + 3, a3, 0.03, 0.8 + rand() * 0.3);
        make('path', { class: 'cr-blade', fill: cols[Math.floor(rand() * cols.length)], d: lf.d }, g3);
        make('path', { class: 'cr-rib', d: polyline(lf.sp.slice(0, lf.n - 2)) }, g3);
      }
    }
    cryptClump(W * 0.37, narrow ? 7 : 10, 20, 14, 0.36, 1.15, 'tk-crypt bronze', ['#6e3b2c', '#7d4a33', '#5c3a2a', '#86513a'], 0.12);
    cryptClump(W * 0.45, narrow ? 6 : 8, 26, 16, 0.22, 0.75, 'tk-crypt red', ['#b8282a', '#cf3a30', '#a51f28', '#d64a3a'], 0.04);

    // Driftwood, mottled and pitted, behind the front plants.
    var wx = W * (narrow ? 0.52 : 0.55), wood = make('g', { class: 'tk-woodg' }, svg);
    make('path', { class: 'tk-wood', fill: 'url(#tk-wood)', d:
      'M' + f1(wx - 34) + ' ' + f1(sand + 2) + ' C' + f1(wx - 18) + ' ' + f1(sand - 6) + ' ' + f1(wx + 4) + ' ' + f1(sand - 10) + ' ' + f1(wx + 20) + ' ' + f1(sand - 24) +
      ' L' + f1(wx + 25) + ' ' + f1(sand - 21) + ' C' + f1(wx + 14) + ' ' + f1(sand - 8) + ' ' + f1(wx + 30) + ' ' + f1(sand - 6) + ' ' + f1(wx + 40) + ' ' + f1(sand + 2) +
      ' L' + f1(wx + 32) + ' ' + f1(sand + 3) + ' C' + f1(wx + 20) + ' ' + f1(sand - 2) + ' ' + f1(wx + 8) + ' ' + f1(sand - 3) + ' ' + f1(wx - 2) + ' ' + f1(sand + 1) +
      ' C' + f1(wx - 12) + ' ' + f1(sand + 2) + ' ' + f1(wx - 24) + ' ' + f1(sand + 4) + ' ' + f1(wx - 34) + ' ' + f1(sand + 2) + ' Z' }, wood);
    var spots = '';
    for (var wsp = 0; wsp < 26; wsp++) {
      var t5 = rand(), px5 = wx - 30 + t5 * 66, py5 = sand + 1 - Math.max(0, (px5 - wx) * 0.55 + 4) * rand() * 0.8, rr5 = 0.4 + rand() * 0.8;
      spots += 'M' + f1(px5 - rr5) + ' ' + f1(py5) + ' a' + f1(rr5) + ' ' + f1(rr5) + ' 0 1 0 ' + f1(2 * rr5) + ' 0 a' + f1(rr5) + ' ' + f1(rr5) + ' 0 1 0 ' + f1(-2 * rr5) + ' 0 ';
    }
    make('path', { class: 'tk-woodspots', d: spots }, wood);

    // Roots of the plants growing out of the top hang down into the water.
    var rootD = '', lilyX = W * (narrow ? 0.11 : 0.12), pothX = W * 0.87;
    function hangRoots(x0, n, len, spread) {
      for (var i = 0; i < n; i++) {
        var x = x0 + (i - (n - 1) / 2) * spread / n + (rand() - 0.5) * 2, l = len * (0.55 + rand() * 0.45), wv = (rand() - 0.5) * 8;
        rootD += 'M' + f1(x) + ' ' + f1(surf + 1) + ' q' + f1(wv) + ' ' + f1(l * 0.5) + ' ' + f1(wv * 0.4) + ' ' + f1(l) + ' ';
      }
    }
    hangRoots(lilyX, 7, narrow ? 28 : 36, 14);
    hangRoots(pothX, 6, narrow ? 34 : 44, 18);
    make('path', { class: 'tk-roots', d: rootD }, svg);

    var shrimpLayer = make('g', null, svg), coryLayer = make('g', null, svg), medakaLayer = make('g', null, svg);

    // In front of the animals: Madagascar lace plant (left), java fern, the terracotta pot, a red
    // rosette plant and tufts of dwarf sagittaria.
    var lace = [], laceG = make('g', { class: 'tk-lace' }, svg), lcx = W * (narrow ? 0.12 : 0.1);
    for (var li = 0; li < 7; li++) {
      var pet = (5 + rand() * 5) * ps, bl = (30 + rand() * 18) * ps, bw = bl * (0.2 + rand() * 0.05), n12 = 12;
      var hwf = function (x) { return bw / 2 * Math.pow(Math.max(0, Math.sin(Math.PI * (x - pet) / bl)), 0.55); };
      var ol = 'M' + f1(pet) + ' 0', vn = 'M0 0 L' + f1(pet + bl) + ' 0', xx, j;
      for (j = 1; j <= n12; j++) { xx = pet + bl * j / n12; ol += ' L' + f1(xx) + ' ' + f1(-hwf(xx)); }
      for (j = n12 - 1; j >= 0; j--) { xx = pet + bl * j / n12; ol += ' L' + f1(xx) + ' ' + f1(hwf(xx)); }
      [-0.62, -0.3, 0.3, 0.62].forEach(function (fr) {
        vn += ' M' + f1(pet) + ' 0';
        for (var j2 = 1; j2 <= n12; j2++) { var x2 = pet + bl * j2 / n12; vn += ' L' + f1(x2) + ' ' + f1(fr * hwf(x2)); }
      });
      for (xx = pet + 2.2; xx < pet + bl - 1.5; xx += 2.4) vn += ' M' + f1(xx) + ' ' + f1(-hwf(xx)) + ' L' + f1(xx) + ' ' + f1(hwf(xx));
      var leafG = make('g', { class: li % 3 === 1 ? 'old' : '' }, laceG);
      make('path', { class: 'lace-blade', d: ol + ' Z' }, leafG);
      make('path', { class: 'lace-veins', d: vn }, leafG);
      swayer(leafG, lcx + (rand() - 0.5) * 6, sand + 2, -Math.PI / 2 + (li - 3) * 0.36 + (rand() - 0.5) * 0.12, 0.03, 0.55);
      lace.push(leafG);
    }
    var jfG = make('g', { class: 'tk-javafern' }, svg), jfx = W * 0.27;
    for (var jf = 0; jf < (narrow ? 7 : 10); jf++) {
      var jl = (15 + rand() * 13) * ps, ja = -Math.PI / 2 + (jf - 4.5) * 0.2 + (rand() - 0.5) * 0.2;
      var jlf = curvedLeaf(jl, 3.4 * ps, (ja + Math.PI / 2) * 0.5, 0.05, rand() * TAU, false);
      var jg = swayer(make('g', null, jfG), jfx + (rand() - 0.5) * 8 * ps, sand + 2, ja, 0.04, 0.9 + rand() * 0.3);
      make('path', { class: 'jf-blade', d: jlf.d }, jg);
      make('path', { class: 'jf-rib', d: polyline(jlf.sp.slice(0, jlf.n - 1)) }, jg);
    }
    // The terracotta pot with a small heart-leaved plant.
    var potX = W * 0.49, potG = make('g', { class: 'tk-pot' }, svg), pw = 17 * ps, pbw = 11 * ps, ph2 = 13 * ps, pr = 3 * ps, pTop = sand + 3 - ph2;
    make('path', { class: 'pot-body', d: 'M' + f1(potX - pw / 2) + ' ' + f1(pTop + pr) + ' L' + f1(potX - pbw / 2) + ' ' + f1(sand + 3) + ' L' + f1(potX + pbw / 2) + ' ' + f1(sand + 3) + ' L' + f1(potX + pw / 2) + ' ' + f1(pTop + pr) + ' Z' }, potG);
    make('rect', { class: 'pot-rim', x: f1(potX - pw / 2 - 1), y: f1(pTop), width: f1(pw + 2), height: f1(pr), rx: 0.8 }, potG);
    make('path', { class: 'pot-shine', d: 'M' + f1(potX - pw / 2 + 2) + ' ' + f1(pTop + pr + 1.5) + ' L' + f1(potX - pbw / 2 + 1.5) + ' ' + f1(sand + 1) }, potG);
    [[-0.9, 11], [-0.35, 15], [0.25, 13], [0.75, 10]].forEach(function (pl) {
      var stA = -Math.PI / 2 + pl[0] * 0.6, len = pl[1] * ps, ex = potX + Math.cos(stA) * len, ey = pTop + Math.sin(stA) * len;
      make('path', { class: 'pot-stem', d: 'M' + f1(potX + pl[0] * 2) + ' ' + f1(pTop + 1) + ' Q' + f1(potX + pl[0] * 3) + ' ' + f1(pTop - len * 0.6) + ' ' + f1(ex) + ' ' + f1(ey) }, potG);
      var hl2 = 7 * ps, hw2 = hl2 * 0.8, hg = make('g', { class: 'pot-leaf', transform: 'translate(' + f1(ex) + ' ' + f1(ey) + ') rotate(' + f1((stA + pl[0] * 0.5) * 57.3) + ')' }, potG);
      make('path', { d: 'M' + f1(hl2 * 0.08) + ' 0 C' + f1(-hl2 * 0.14) + ' ' + f1(-hw2 * 0.5) + ' ' + f1(hl2 * 0.55) + ' ' + f1(-hw2 * 0.72) + ' ' + f1(hl2) + ' 0 C' + f1(hl2 * 0.55) + ' ' + f1(hw2 * 0.72) + ' ' + f1(-hl2 * 0.14) + ' ' + f1(hw2 * 0.5) + ' ' + f1(hl2 * 0.08) + ' 0 Z' }, hg);
    });
    // Red rosette plant (front right of centre).
    var roG = make('g', { class: 'tk-rosette' }, svg), rox = W * 0.62, roCols = ['#d65466', '#c0394c', '#e07a7a', '#cc4d5c'];
    for (var ro = 0; ro < (narrow ? 8 : 11); ro++) {
      var ra = -Math.PI / 2 + (ro - 5) * 0.27 + (rand() - 0.5) * 0.15, rl = (14 + rand() * 9) * ps;
      var rlf = curvedLeaf(rl, rl * 0.34, (ra + Math.PI / 2) * 0.45, 0.03, rand() * TAU, true);
      var rgp = swayer(make('g', null, roG), rox + (rand() - 0.5) * 4 * ps, sand + 3, ra, 0.03, 0.7 + rand() * 0.3);
      make('path', { class: 'ro-blade', fill: roCols[Math.floor(rand() * roCols.length)], d: rlf.d }, rgp);
      make('path', { class: 'ro-rib', d: polyline(rlf.sp.slice(0, rlf.n - 2)) }, rgp);
    }
    // Dwarf sagittaria tufts along the front of the sand.
    var grass = '';
    [0.2, 0.33, 0.41, 0.53, 0.67, 0.75, 0.88].forEach(function (gx) {
      var cx = W * gx + (rand() - 0.5) * 6;
      for (var b2 = 0; b2 < 5; b2++) {
        var gl = (6 + rand() * 9) * ps, ga = -Math.PI / 2 + (b2 - 2) * 0.28 + (rand() - 0.5) * 0.2;
        grass += 'M' + f1(cx + (b2 - 2) * 1.2) + ' ' + f1(sand + 3) + ' q' + f1(Math.cos(ga) * gl * 0.3) + ' ' + f1(Math.sin(ga) * gl * 0.6) + ' ' + f1(Math.cos(ga) * gl) + ' ' + f1(Math.sin(ga) * gl) + ' ';
      }
    });
    make('path', { class: 'tk-grass', d: grass }, svg);

    // The water surface.
    make('path', { class: 'tk-surface', d: 'M0 ' + surf + ' L' + W + ' ' + surf }, svg);
    make('path', { class: 'tk-meniscus', d: 'M0 ' + (surf + 1.6) + ' L' + W + ' ' + (surf + 1.6) }, svg);

    /* ----- fish ----- */
    function fishGroup(layer, shape, fill, extra) {
      var g = make('g', { class: extra }, layer), tailG = make('g', null, g);
      make('path', { class: 'fin', d: shape.tail }, tailG);
      if (shape.rays) make('path', { class: 'ray', d: shape.rays }, g);
      ['dorsal', 'anal', 'adipose', 'pectoral', 'pelvic'].forEach(function (k) { if (shape[k]) make('path', { class: 'fin', d: shape[k] }, g); });
      make('path', { class: 'body', fill: fill, d: shape.body }, g);
      return { g: g, tail: tailG };
    }

    var medaka = [], nM = narrow ? 4 : 6;
    for (var m = 0; m < nM; m++) {
      var orange = m % 3 !== 2;
      var mg = fishGroup(medakaLayer, MEDAKA, orange ? 'url(#tk-med-o)' : 'url(#tk-med-w)', 'medaka ' + (orange ? 'orange' : 'wild'));
      if (!orange) make('path', { class: 'shine', d: 'M8 0.1 C3 0.3 -3 0.2 -8 0' }, mg.g);
      make('ellipse', { class: 'pect', cx: 5.6, cy: 0.9, rx: 2.3, ry: 0.85, transform: 'rotate(-18 5.6 0.9)' }, mg.g);
      make('circle', { class: 'eye-iris', cx: 9.2, cy: -0.6, r: 1.5 }, mg.g);
      make('circle', { class: 'eye-pupil', cx: 9.35, cy: -0.6, r: 0.78 }, mg.g);
      make('circle', { class: 'eye-glint', cx: 9.7, cy: -1, r: 0.3 }, mg.g);
      medaka.push({ el: mg, x: W * (0.25 + rand() * 0.5), y: surf + 12 + rand() * 18, vx: 0, vy: 0, wa: rand() < 0.5 ? 0 : Math.PI,
                    face: 1, turn: 1, ph: rand() * TAU, z: 0.86 + rand() * 0.16, depth: rand(), dart: 0, cruise: 13 + rand() * 9 });
    }

    var corys = [], nC = narrow ? 3 : 4;
    for (var k = 0; k < nC; k++) {
      var pepper = k % 2 === 0;
      var cgr = fishGroup(coryLayer, CORY, pepper ? 'url(#tk-cory-p)' : 'url(#tk-cory-b)', 'cory ' + (pepper ? 'peppered' : 'bronze'));
      make('path', { class: 'seam', d: CORY.seam }, cgr.g);
      if (pepper) {
        make('path', { class: 'blotch', d: 'M4.3 -1.2 c-1.6 -1 -3.8 -0.6 -4.2 0.6 c0.6 1.3 3 1.5 4.2 -0.6 Z M-2 0 c-1.4 -0.9 -3.2 -0.3 -3.4 0.9 c0.8 0.9 2.6 0.8 3.4 -0.9 Z M-5.6 -1.2 c-0.8 -0.4 -1.8 0 -1.8 0.6 c0.6 0.5 1.4 0.4 1.8 -0.6 Z M1.8 -3 c-0.9 -0.3 -1.8 0.1 -1.9 0.7 c0.6 0.4 1.4 0.2 1.9 -0.7 Z' }, cgr.g);
        make('path', { class: 'speck', d: 'M1.2 -6 h0.6 M0.4 -7.6 h0.6 M-1 -5.6 h0.6 M-11 -2.2 h0.6 M-12 1.6 h0.6 M-10.4 2.8 h0.6' }, cgr.g);
      } else {
        make('path', { class: 'iridescence', d: 'M7 -0.5 C3 -2.5 -3 -2.4 -7.5 -0.6 C-3 0.8 3 0.9 7 -0.5 Z' }, cgr.g);
      }
      make('path', { class: 'spine', d: CORY.spine }, cgr.g);
      make('path', { class: 'barbel', d: CORY.barbels }, cgr.g);
      make('circle', { class: 'eye-iris cory-iris', cx: 7.2, cy: -1.3, r: 1.35 }, cgr.g);
      make('circle', { class: 'eye-pupil', cx: 7.35, cy: -1.25, r: 0.75 }, cgr.g);
      make('circle', { class: 'eye-glint', cx: 7.7, cy: -1.7, r: 0.28 }, cgr.g);
      var z = 0.9 + rand() * 0.12;
      corys.push({ el: cgr, x: W * (0.25 + 0.14 * k + rand() * 0.06), y: sand - 3.6 * z, z: z, mode: 'root', timer: 0.6 + rand() * 2.5,
                   tilt: 0.18, face: rand() < 0.5 ? 1 : -1, turn: 1, ph: rand() * TAU, tx: 0, hd: 1, arc: 3, sinceAir: 4 + rand() * 12, t: rand() * 10 });
      corys[k].turn = corys[k].face;
    }

    var kuhlis = [], nK = narrow ? 2 : 3;
    for (var kk = 0; kk < nK; kk++) {
      var kg = make('g', { class: 'kuhli' }, kuhliLayer);
      var ku = { len: (narrow ? 34 : 40) + rand() * 6, x: W * (0.2 + 0.3 * kk + rand() * 0.1), y: sand - 3 - rand() * 4,
                 a: rand() < 0.5 ? 0 : Math.PI, v: 0, mode: 'rest', timer: 0.5 + rand() * 3, ph: rand() * TAU, trail: [],
                 body: make('path', { class: 'kh-body', fill: 'url(#tk-kuhli)' }, kg), bands: make('path', { class: 'kh-band' }, kg),
                 fin: make('path', { class: 'kh-fin' }, kg), barbels: make('path', { class: 'kh-barbel' }, kg), eye: make('circle', { class: 'kh-eye', r: 0.55 }, kg) };
      for (var i2 = 0; i2 <= ku.len + 6; i2++) ku.trail.push([ku.x - Math.cos(ku.a) * i2, ku.y + Math.sin(i2 * 0.3) * 1.2]);
      kuhlis.push(ku);
    }

    // Shrimp: red cherry shrimp (Neocaridina) and Amano shrimp graze over sand and stones, picking with
    // their small claws, walking slowly and now and then swimming a short hop. The vampire shrimp
    // (Atya gabonensis) perches on the largest stone and filter-feeds, holding its fans up into the
    // water and sweeping one to its mouth every few seconds.
    var shrimp = [];
    function addShrimp(kind, x, Lpx, extra) {
      var g = make('g', { class: 'shrimp sh-' + kind }, shrimpLayer);
      var ant = make('path', { class: 'sh-ant', d: SHRIMP.antennae }, g);
      make('path', { class: 'sh-legs', d: SHRIMP.legs }, g);
      if (kind === 'vampire') make('path', { class: 'sh-legs sh-thick', d: 'M.19 .078 L.235 .16 L.165 .24 M.26 .075 L.3 .16 L.24 .24' }, g);
      var pleo = make('path', { class: 'sh-legs sh-pleo' }, g);
      if (extra && extra.berried) make('path', { class: 'sh-eggs', d: ovals([[-0.3, 0.11, 0.022, 0.018], [-0.25, 0.12, 0.022, 0.018], [-0.2, 0.115, 0.022, 0.018], [-0.15, 0.12, 0.022, 0.018], [-0.1, 0.115, 0.022, 0.018], [-0.22, 0.14, 0.02, 0.016], [-0.13, 0.14, 0.02, 0.016]]) }, g);
      make('path', { class: 'sh-tail', d: SHRIMP.tail }, g);
      make('path', { class: 'sh-body', d: SHRIMP.body }, g);
      if (kind !== 'vampire') make('path', { class: 'sh-body', d: SHRIMP.rostrum }, g);
      make('path', { class: 'sh-seg', d: SHRIMP.segs }, g);
      if (kind === 'cherry') {
        make('path', { class: 'sh-mottle', d: ovals([[0.22, -0.07, 0.06, 0.035], [0.0, -0.09, 0.05, 0.03], [-0.18, -0.06, 0.045, 0.03], [-0.33, -0.02, 0.03, 0.022]]) }, g);
        if (extra && extra.saddle) make('path', { class: 'sh-saddle', d: ovals([[0.17, -0.115, 0.09, 0.028]]) }, g);
      }
      if (kind === 'amano') {
        var dots = '';
        for (var dx = -0.4; dx <= 0.36; dx += 0.055) dots += 'M' + dx.toFixed(3) + ' ' + (-0.025 + 0.06 * Math.max(0, (-dx - 0.25) / 0.2)).toFixed(3) + ' l.018 0 ';
        make('path', { class: 'sh-dots', d: dots }, g);
      }
      if (kind !== 'cherry') make('path', { class: 'sh-stripe', d: SHRIMP.stripe }, g);
      make('circle', { class: 'sh-eye', cx: 0.38, cy: -0.085, r: 0.034 }, g);
      var s = { kind: kind, g: g, ant: ant, pleo: pleo, L: Lpx, x: x, y: floorAt(x) - SHRIMP_FOOT * Lpx, face: x < W / 2 ? 1 : -1, turn: 1,
                mode: 'graze', timer: 1 + rand() * 4, tx: x, ph: rand() * TAU, pick: 0, tilt: 0, sweep: 0, sweepT: 1 + rand() * 4, sweepSide: 0,
                claws: kind === 'vampire' ? null : make('path', { class: 'sh-legs sh-claw' }, g),
                fans: kind === 'vampire' ? make('path', { class: 'sh-fan' }, g) : null };
      s.turn = s.face;
      shrimp.push(s);
    }
    addShrimp('vampire', rocks[0].cx, narrow ? 34 : 40);
    addShrimp('cherry', rocks[1].cx, narrow ? 15 : 17, { saddle: true });
    addShrimp('cherry', W * 0.2, narrow ? 15 : 17);
    addShrimp('cherry', rocks[3].cx, narrow ? 14 : 16, { berried: true });
    if (!narrow) addShrimp('cherry', W * 0.66, 16);
    addShrimp('amano', W * 0.62, narrow ? 24 : 27);
    if (!narrow) addShrimp('amano', W * 0.74, 26);

    function drawFans(s) {
      var d = '';
      [0, 1].forEach(function (k) {
        var sw = s.sweepSide === k ? Math.sin(s.sweep * Math.PI) : 0;   // this fan brought to the mouth
        var bx = 0.41 + k * 0.025, tx = 0.6 + k * 0.025 - sw * 0.13, ty = -0.13 + k * 0.03 + sw * 0.18;
        d += 'M' + bx.toFixed(3) + ' .03 L' + tx.toFixed(3) + ' ' + ty.toFixed(3) + ' ';
        var spread = 1 - 0.7 * sw, base = -0.8 + sw * 0.95;   // a broad brush of bristles, closing as it is swept in
        for (var b = 0; b < 9; b++) {
          var a = base + (b - 4) * 0.2 * spread, len = 0.2 - Math.abs(b - 4) * 0.012;
          d += 'M' + tx.toFixed(3) + ' ' + ty.toFixed(3) + ' l' + (Math.cos(a) * len).toFixed(3) + ' ' + (Math.sin(a) * len).toFixed(3) + ' ';
        }
      });
      s.fans.setAttribute('d', d);
    }
    function stepShrimp(dt) {
      shrimp.forEach(function (s) {
        var foot = function (x) { return floorAt(x) - SHRIMP_FOOT * s.L; };
        s.timer -= dt;
        s.ph += dt * (s.mode === 'swim' ? 16 : 5);
        if (s.kind === 'vampire') {
          s.sweepT -= dt;
          if (s.sweepT <= 0) { s.sweep = 1; s.sweepT = 2.5 + rand() * 4; s.sweepSide = rand() < 0.5 ? 0 : 1; }
          if (s.sweep > 0) s.sweep = Math.max(0, s.sweep - dt * 1.4);
          s.y = foot(s.x);
        } else if (s.mode === 'graze') {
          s.pick = Math.max(0, Math.sin(s.ph * 2.6)) * 0.05;   // claws picking at the surface
          s.y += (foot(s.x) - s.y) * Math.min(1, dt * 8);
          if (s.timer <= 0) {
            s.tx = clamp(s.x + (rand() - 0.5) * (s.kind === 'amano' ? 130 : 70), 10, W - 10);
            if (rand() < 0.18) { s.mode = 'swim'; s.sx = s.x; s.sy = s.y; s.hop = 0; s.hd = Math.max(8, Math.abs(s.tx - s.x)); s.arc = 10 + rand() * 22; }
            else s.mode = 'walk';
            s.timer = 2 + rand() * 4;
          }
        } else if (s.mode === 'walk') {
          var dx = s.tx - s.x;
          s.face = dx >= 0 ? 1 : -1;
          s.x += s.face * Math.min(Math.abs(dx), (s.kind === 'amano' ? 11 : 7) * dt);
          s.y += (foot(s.x) - s.y) * Math.min(1, dt * 8);
          s.pick = 0;
          if (Math.abs(dx) < 0.5 || s.timer <= 0) { s.mode = 'graze'; s.timer = 1.5 + rand() * 4; }
        } else {   // swimming a short hop, swimmerets beating, landing further along
          s.hop = Math.min(1, s.hop + dt * 22 / s.hd);
          s.face = s.tx >= s.sx ? 1 : -1;
          s.x = s.sx + (s.tx - s.sx) * smooth(s.hop);
          s.y = s.sy + (foot(s.tx) - s.sy) * s.hop - Math.sin(s.hop * Math.PI) * s.arc;
          if (s.hop >= 1) { s.mode = 'graze'; s.timer = 1.5 + rand() * 3; }
        }
        var slope = s.mode === 'swim' ? 0 : (foot(s.x + 3) - foot(s.x - 3)) / 6;   // stand along the surface
        s.tilt += (Math.atan(slope) * s.face - s.tilt) * Math.min(1, dt * 6);
        s.turn += (s.face - s.turn) * Math.min(1, dt * 6);
        s.g.setAttribute('transform', 'translate(' + f1(s.x) + ' ' + f1(s.y) + ') scale(' + (s.turn * s.L).toFixed(2) + ' ' + s.L.toFixed(2) + ') rotate(' + f1(s.tilt * 57.3) + ')');
        s.ant.setAttribute('transform', 'rotate(' + f1(Math.sin(s.ph * 0.7) * 6) + ' .45 -.08)');
        var pd = '';
        [-0.07, -0.16, -0.25, -0.33].forEach(function (px, i) {
          var beat = Math.sin(s.ph * (s.mode === 'swim' ? 1 : 0.5) + i * 0.9) * 0.03;
          pd += 'M' + px.toFixed(3) + ' .08 L' + (px + 0.03 + beat).toFixed(3) + ' .15 ';
        });
        s.pleo.setAttribute('d', pd);
        if (s.claws) {
          var cy = (0.12 + s.pick).toFixed(3), ty = (0.2 + s.pick * 1.4).toFixed(3);
          s.claws.setAttribute('d', 'M.38 .05 L.47 ' + cy + ' L.51 ' + ty + ' M.36 .055 L.43 ' + cy + ' L.46 ' + ty);
        }
        if (s.fans) drawFans(s);
      });
    }

    function placeFish(f, tilt) {
      f.el.g.setAttribute('transform', 'translate(' + f1(f.x) + ' ' + f1(f.y) + ') scale(' + (f.turn * f.z).toFixed(3) + ' ' + f.z.toFixed(3) + ') rotate(' + f1(tilt * 57.3) + ')');
    }

    function stepMedaka(dt) {
      medaka.forEach(function (f) {
        var cx = 0, cy = 0, n = 0, sx = 0, sy = 0;
        medaka.forEach(function (o) {
          if (o === f) return;
          var ox = o.x - f.x, oy = o.y - f.y, d2 = ox * ox + oy * oy;
          cx += o.x; cy += o.y; n++;
          if (d2 < 260) { sx -= ox / (d2 + 4) * 16; sy -= oy / (d2 + 4) * 16; }
        });
        // Loose shoal: wander, keep near the others, avoid crowding, stay in the upper water.
        var dx = Math.cos(f.wa) * 2, dy = Math.sin(f.wa) * 0.5;
        if (n) { dx += (cx / n - f.x) * 0.006; dy += (cy / n - f.y) * 0.01; }
        dx += sx; dy += sy;
        dy += (surf + 9 + f.depth * (H * 0.3) - f.y) * 0.05;
        if (f.x < 30) dx += (30 - f.x) * 0.12;
        if (f.x > W - 30) dx -= (f.x - W + 30) * 0.12;
        f.wa += angDiff(Math.atan2(dy, dx), f.wa) * Math.min(1, dt * 1.6) + (rand() - 0.5) * 1.6 * dt;
        if (f.dart > 0) f.dart -= dt;
        else if (rand() < dt * 0.1) f.dart = 0.25 + rand() * 0.2;   // a quick dart now and then
        var sp = f.dart > 0 ? 62 : f.cruise;
        var k2 = Math.min(1, dt * (f.dart > 0 ? 6 : 2.5));
        f.vx += (Math.cos(f.wa) * sp - f.vx) * k2;
        f.vy += (Math.sin(f.wa) * sp * 0.45 - f.vy) * k2;
        f.x = clamp(f.x + f.vx * dt, 8, W - 8);
        f.y = clamp(f.y + f.vy * dt, surf + 5, sand - 22);
        if (Math.abs(f.vx) > 3) f.face = f.vx > 0 ? 1 : -1;
        f.turn += (f.face - f.turn) * Math.min(1, dt * 7);
        var speed = Math.sqrt(f.vx * f.vx + f.vy * f.vy);
        f.ph += dt * (7 + speed * 0.35);
        f.el.tail.setAttribute('transform', 'rotate(' + f1(Math.sin(f.ph) * (8 + speed * 0.4)) + ' -8.5 0)');
        placeFish(f, clamp(Math.atan2(f.vy, Math.abs(f.vx) + 2) * 0.6, -0.35, 0.35));
      });
    }

    function stepCorys(dt) {
      var mean = corys.reduce(function (s, c) { return s + c.x; }, 0) / corys.length;
      corys.forEach(function (c) {
        var restY = sand - 3.6 * c.z - 0.3;
        c.timer -= dt;
        c.t += dt;
        c.sinceAir += dt;
        if (c.mode === 'root') {
          // Rooting: nose down in the sand, barbels working.
          c.tilt += (0.2 + Math.sin(c.t * 9) * 0.05 - c.tilt) * Math.min(1, dt * 6);
          c.y += (restY - c.y) * Math.min(1, dt * 5);
          if (c.timer <= 0) {
            if (c.sinceAir > 16 && rand() < 0.25) {
              c.mode = 'up';   // a dash to the surface to gulp air
              c.sinceAir = 0;
            } else {
              var tx = rand() < 0.6 ? mean + (rand() - 0.5) * 90 : c.x + (rand() - 0.5) * 140;
              c.tx = clamp(tx, 16, W - 16);
              c.hd = Math.max(1, Math.abs(c.tx - c.x));
              c.arc = 2 + rand() * 5;
              c.mode = 'hop';
            }
          }
        } else if (c.mode === 'hop') {
          var dx = c.tx - c.x;
          c.face = dx >= 0 ? 1 : -1;
          c.x += c.face * Math.min(Math.abs(dx), 32 * dt);
          var hp = 1 - Math.abs(c.tx - c.x) / c.hd;
          c.y = restY - Math.sin(hp * Math.PI) * c.arc;
          c.tilt += (-0.04 - c.tilt) * Math.min(1, dt * 6);
          if (Math.abs(c.tx - c.x) < 0.5) { c.mode = 'root'; c.timer = 1.2 + rand() * 3.2; }
        } else if (c.mode === 'up') {
          c.y -= 75 * dt;
          c.x = clamp(c.x + c.face * 14 * dt, 12, W - 12);
          c.tilt += (-1.05 - c.tilt) * Math.min(1, dt * 8);
          if (c.y <= surf + 5) { c.mode = 'down'; c.timer = 0.2; }
        } else {
          // Gliding back down after the gulp.
          if (c.timer > 0) { c.timer -= 0; }
          c.y += 24 * dt;
          c.x = clamp(c.x + c.face * 10 * dt, 12, W - 12);
          c.tilt += (0.3 - c.tilt) * Math.min(1, dt * 3);
          if (c.y >= restY) { c.y = restY; c.mode = 'root'; c.timer = 1 + rand() * 2; }
        }
        c.turn += (c.face - c.turn) * Math.min(1, dt * 6);
        c.ph += dt * (c.mode === 'root' ? 3.5 : c.mode === 'down' ? 2 : 15);
        c.el.tail.setAttribute('transform', 'rotate(' + f1(Math.sin(c.ph) * (c.mode === 'root' ? 4 : 13)) + ' -8.5 0)');
        placeFish(c, c.tilt);
      });
    }

    // Kuhli loaches: eel-like, banded, weaving along the bottom; the body follows the head's path.
    function kuhliH(u) { return u < 0.07 ? 0.6 + 1.15 * Math.sqrt(u / 0.07) : u < 0.78 ? 1.75 : 1.75 - 0.95 * (u - 0.78) / 0.22; }
    function stepKuhlis(dt) {
      kuhlis.forEach(function (k) {
        k.timer -= dt;
        if (k.timer <= 0) {
          if (k.mode === 'rest') { k.mode = 'go'; k.timer = 1.8 + rand() * 4; }
          else { k.mode = 'rest'; k.timer = 1.2 + rand() * 4; }
        }
        var vt = k.mode === 'go' ? 26 : 0;
        k.v += (vt - k.v) * Math.min(1, dt * 3);
        if (k.v > 0.3) {
          // Wander, mostly within a band above the sand, turning back at the glass.
          var yWant = sand - 4 - (k.mode === 'go' && Math.sin(time * 0.3 + k.ph) > 0.6 ? 22 : 0);
          var turn = (rand() - 0.5) * 3 * dt + clamp((yWant - k.y) * 0.01, -0.04, 0.04) * Math.cos(k.a);
          if (k.x < 24 && Math.cos(k.a) < 0) turn += angDiff(0, k.a) * dt * 2.2;
          if (k.x > W - 24 && Math.cos(k.a) > 0) turn += angDiff(Math.PI, k.a) * dt * 2.2;
          k.a += turn;
          var ca = Math.cos(k.a), sa = Math.sin(k.a);
          if (Math.abs(sa) > 0.55) { k.a = Math.atan2(clamp(sa, -0.55, 0.55), ca); ca = Math.cos(k.a); sa = Math.sin(k.a); }
          k.ph += dt * 9;
          var wig = Math.cos(k.ph) * 0.9;   // the head snakes up and down as it swims
          k.x = clamp(k.x + (ca - sa * wig) * k.v * dt, 4, W - 4);
          k.y = clamp(k.y + (sa + ca * wig) * k.v * dt, surf + 30, sand - 2.6);
          var h0 = k.trail[0], ddx = k.x - h0[0], ddy = k.y - h0[1];
          if (ddx * ddx + ddy * ddy >= 1) {
            k.trail.unshift([k.x, k.y]);
            if (k.trail.length > k.len * 1.6 + 8) k.trail.pop();
          }
        }
        drawKuhli(k);
      });
    }
    function drawKuhli(k) {
      // Spine: points every len/17 along the trail behind the head.
      var N = 18, step = k.len / (N - 1), sp = [[k.trail[0][0], k.trail[0][1]]], acc = 0, j = 0, need = step;
      while (sp.length < N && j < k.trail.length - 1) {
        var a = k.trail[j], b = k.trail[j + 1], sl = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1])) || 1e-6;
        if (acc + sl >= need) {
          var t = (need - acc) / sl;
          sp.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          need += step;
        } else {
          acc += sl;
          j++;
        }
      }
      while (sp.length < N) { var p = sp[sp.length - 1], q = sp[sp.length - 2] || [p[0] + 1, p[1]]; sp.push([p[0] + (p[0] - q[0]), p[1] + (p[1] - q[1])]); }
      var top = [], bot = [], bands = '', ups = [];
      for (var i = 0; i < N; i++) {
        var pa = sp[Math.max(0, i - 1)], pb = sp[Math.min(N - 1, i + 1)], tx = pa[0] - pb[0], ty = pa[1] - pb[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        tx /= tl; ty /= tl;   // pointing towards the head
        var ux = -ty, uy = tx;
        if (uy > 0) { ux = -ux; uy = -uy; }   // the side facing up is the back
        ups.push([ux, uy, tx, ty]);
        var hh = kuhliH(i / (N - 1));
        top.push([sp[i][0] + ux * hh, sp[i][1] + uy * hh]);
        bot.push([sp[i][0] - ux * hh * 0.9, sp[i][1] - uy * hh * 0.9]);
      }
      k.body.setAttribute('d', blob(top.concat(bot.reverse())));
      // Dark saddles over the back and sides, not meeting under the belly.
      for (var bI = 0; bI < 13; bI++) {
        var u = 0.07 + bI * 0.066, fi = u * (N - 1), i0 = Math.floor(fi), fr = fi - i0, i1 = Math.min(N - 1, i0 + 1);
        var cxp = sp[i0][0] + (sp[i1][0] - sp[i0][0]) * fr, cyp = sp[i0][1] + (sp[i1][1] - sp[i0][1]) * fr, U = ups[i0], hb = kuhliH(u);
        bands += 'M' + f1(cxp + U[0] * hb * 0.92) + ' ' + f1(cyp + U[1] * hb * 0.92) + ' L' + f1(cxp - U[0] * hb * 0.62) + ' ' + f1(cyp - U[1] * hb * 0.62) + ' ';
      }
      k.bands.setAttribute('d', bands);
      var e = sp[N - 1], E = ups[N - 1], tdx = -E[2], tdy = -E[3];
      k.fin.setAttribute('d', blob([[e[0] + E[0] * 0.9, e[1] + E[1] * 0.9], [e[0] + tdx * 2.4 + E[0] * 1.4, e[1] + tdy * 2.4 + E[1] * 1.4],
                                     [e[0] + tdx * 3.2, e[1] + tdy * 3.2], [e[0] + tdx * 2.4 - E[0] * 1.4, e[1] + tdy * 2.4 - E[1] * 1.4], [e[0] - E[0] * 0.9, e[1] - E[1] * 0.9]]));
      var hd = sp[0], H0 = ups[0], fx = H0[2], fy = H0[3], bd = '';
      [[0.5, 2], [0.95, 1.7], [1.35, 1.5]].forEach(function (bb) {
        var ca = Math.cos(bb[0]), sa = Math.sin(bb[0]), dxb = fx * ca + H0[0] * -sa, dyb = fy * ca + H0[1] * -sa;
        bd += 'M' + f1(hd[0] - H0[0] * 0.2) + ' ' + f1(hd[1] - H0[1] * 0.2) + ' l' + f1(dxb * bb[1]) + ' ' + f1(dyb * bb[1]) + ' ';
      });
      k.barbels.setAttribute('d', bd);
      var ei = sp[1];
      k.eye.setAttribute('cx', f1(ei[0] * 0.6 + hd[0] * 0.4 + H0[0] * 0.55));
      k.eye.setAttribute('cy', f1(ei[1] * 0.6 + hd[1] * 0.4 + H0[1] * 0.55));
    }

    function stepPlants() {
      sway.forEach(function (w) {
        w.g.setAttribute('transform', 'translate(' + f1(w.x) + ' ' + f1(w.y) + ') rotate(' + f1((w.a + Math.sin(time * w.sp + w.ph) * w.amp) * 57.3) + ')');
      });
      rays.forEach(function (r2) { r2.el.setAttribute('opacity', (0.55 + 0.45 * Math.sin(time * 0.35 + r2.ph)).toFixed(2)); });
      hydroG.setAttribute('transform', 'translate(0 ' + f1(sand) + ') skewX(' + f1(Math.sin(time * 0.8) * 1.6) + ') translate(0 ' + f1(-sand) + ')');
    }

    function step(dt) {
      time += dt;
      stepPlants();
      stepKuhlis(dt);
      stepShrimp(dt);
      stepCorys(dt);
      stepMedaka(dt);
    }
    make('rect', { class: 'tk-glass', x: 0.5, y: TOP + 0.5, width: W - 1, height: H - 1, rx: 14 }, root);
    growEmersed(root, W, TOP + surf, narrow, rand, lilyX, pothX);
    box.appendChild(root);
    step(0);
    return { svg: root, step: step };
  }

  function setupTank(box) {
    var scene = null, actor = { on: false, step: function (dt) { if (scene) scene.step(dt); } };
    function build() {
      if (scene) scene.svg.remove();
      scene = buildTank(box);
    }
    build();
    watch(actor, box, 0.01);
    onResize(box, build);
  }

  /* =====================================================================
     Gecko: crosses the section in short bursts with a lizard's walking gait. The trunk bends in a
     standing wave with nodes at the shoulders and hips, the legs move in diagonal pairs, and each
     foot stays planted while the body moves over it. Its colours follow the gecko in the portrait:
     a rusty dorsal stripe edged with pale pinstripes on mottled grey-brown, with broad toe pads.
     ===================================================================== */
  var TEXT = 'h1,h2,h3,p,li,.btn,.section-label,.aquarium,.gecko-arrow text';

  // A route across the section through the space around the text, passing over the portrait.
  function planRoute(w, h) {
    var sr = section.getBoundingClientRect(), C = 8, cols = Math.ceil(w / C), rows = Math.ceil(h / C);
    var block = new Uint8Array(cols * rows), near = new Uint8Array(cols * rows), contentTop = h;
    function paint(r, pad, grid) {
      var c0 = Math.max(0, Math.floor((r.left - sr.left - pad) / C)), c1 = Math.min(cols - 1, Math.floor((r.right - sr.left + pad) / C));
      var r0 = Math.max(0, Math.floor((r.top - sr.top - pad) / C)), r1 = Math.min(rows - 1, Math.floor((r.bottom - sr.top + pad) / C));
      for (var y = r0; y <= r1; y++) for (var x = c0; x <= c1; x++) grid[y * cols + x] = 1;
    }
    section.querySelectorAll(TEXT).forEach(function (el) {
      var r = settledRect(el);
      if (!r.width) return;
      paint(r, 16, block);
      paint(r, 34, near);
      contentTop = Math.min(contentTop, r.top - sr.top);
    });
    var portrait = section.querySelector('.portrait'), pr = portrait ? settledRect(portrait) : null;
    if (pr) {
      contentTop = Math.min(contentTop, pr.top - sr.top);
      // Only the strip along the top of the photo is open to the gecko, clear of the face.
      paint({ left: pr.left, right: pr.right, top: pr.top + pr.height * 0.15, bottom: pr.bottom }, 6, block);
    }
    var band = clamp(contentTop * 0.48, 18, 80);
    function cell(x, y) { return [clamp(Math.round(x / C), 0, cols - 1), clamp(Math.round(y / C), 0, rows - 1)]; }
    function free(c) { return !block[c[1] * cols + c[0]]; }
    function astar(a, b) {
      var N = cols * rows, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
      var heap = [], start = a[1] * cols + a[0], goal = b[1] * cols + b[0];
      function hval(i) { var dx = (i % cols) - b[0], dy = Math.floor(i / cols) - b[1]; return Math.sqrt(dx * dx + dy * dy); }
      function push(f, i) {
        heap.push([f, i]);
        var k = heap.length - 1;
        while (k > 0) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var tmp = heap[p]; heap[p] = heap[k]; heap[k] = tmp; k = p; }
      }
      function pop() {
        var top = heap[0], end = heap.pop();
        if (heap.length) {
          heap[0] = end;
          var k = 0;
          for (;;) {
            var l = 2 * k + 1, r = l + 1, m = k;
            if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
            if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
            if (m === k) break;
            var tmp = heap[m]; heap[m] = heap[k]; heap[k] = tmp; k = m;
          }
        }
        return top;
      }
      g[start] = 0;
      push(hval(start), start);
      while (heap.length) {
        var cur = pop()[1];
        if (cur === goal) break;
        if (shut[cur]) continue;
        shut[cur] = 1;
        var cx = cur % cols, cy = Math.floor(cur / cols);
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            var nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            var ni = ny * cols + nx;
            if (block[ni] || shut[ni]) continue;
            var cost = (dx && dy ? 1.414 : 1) * (near[ni] ? 3 : 1);
            if (g[cur] + cost < g[ni]) { g[ni] = g[cur] + cost; from[ni] = cur; push(g[ni] + hval(ni), ni); }
          }
        }
      }
      if (from[goal] < 0 && goal !== start) return null;
      var out = [], i = goal;
      while (i >= 0) { out.unshift([(i % cols) * C, Math.floor(i / cols) * C]); i = from[i]; }
      return out;
    }
    var S = cell(w - 4, band), E = cell(4, band + 10), M = pr ? cell(pr.left - sr.left + pr.width * 0.66, pr.top - sr.top + pr.height * 0.06) : null;
    if (!free(S) || !free(E)) return null;
    var pts = M && free(M) ? astar(S, M) : null, rest = pts ? astar(M, E) : null;
    if (pts && rest) pts = pts.concat(rest.slice(1));
    else pts = astar(S, E);
    if (!pts) return null;
    // Drop the staircase of grid steps, then round off the corners.
    var simple = [pts[0]];
    for (var i = 1; i < pts.length - 1; i += 3) simple.push(pts[i]);
    simple.push(pts[pts.length - 1]);
    for (var it = 0; it < 4; it++) {
      var sm = [simple[0]];
      for (var j = 0; j < simple.length - 1; j++) {
        var p = simple[j], q = simple[j + 1];
        sm.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
      }
      sm.push(simple[simple.length - 1]);
      simple = sm;
    }
    // Enter from beyond the right edge and leave beyond the left one.
    simple.unshift([w + 150, simple[0][1]]);
    simple.push([-150, simple[simple.length - 1][1]]);
    var out = [simple[0]], carry = 0;
    for (var k = 1; k < simple.length; k++) {
      var a = simple[k - 1], b = simple[k], dx2 = b[0] - a[0], dy2 = b[1] - a[1], L = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      for (var d = 2 - carry; d <= L; d += 2) out.push([a[0] + dx2 * d / L, a[1] + dy2 * d / L]);
      carry = L - (Math.floor((L - (2 - carry)) / 2) * 2 + (2 - carry));
      if (carry < 0 || carry > 2) carry = 0;
    }
    return { pts: out, restX: w * 0.8 };
  }

  // opts.look: 'gargoyle' (default) or 'mourning'; opts.stopAtEnd: walk the route once and rest at its end.
  var geckoSeq = 0;
  function makeGecko(svg, route, L, rand, opts) {
    opts = opts || {};
    var look = opts.look || 'gargoyle', slim = look === 'mourning' ? 0.86 : 1, fid = 'gk-blur-' + (++geckoSeq);
    var P = route.pts, STEP = 2, total = (P.length - 1) * STEP;
    var tans = P.map(function (p, i) {
      var a = P[Math.max(0, i - 3)], b = P[Math.min(P.length - 1, i + 3)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy) || 1;
      return [dx / l, dy / l];
    });
    function at(s) {   // point and unit tangent at arc length s, straight beyond either end
      var n = P.length;
      if (s <= 0) return [P[0][0] + tans[0][0] * s, P[0][1] + tans[0][1] * s, tans[0][0], tans[0][1]];
      if (s >= total) { var t1 = tans[n - 1], o = s - total; return [P[n - 1][0] + t1[0] * o, P[n - 1][1] + t1[1] * o, t1[0], t1[1]]; }
      var fi = s / STEP, i = Math.floor(fi), fr = fi - i, a = P[i], b = P[i + 1], ta = tans[i], tb = tans[i + 1];
      var tx = ta[0] + (tb[0] - ta[0]) * fr, ty = ta[1] + (tb[1] - ta[1]) * fr, tl = Math.sqrt(tx * tx + ty * ty) || 1;
      return [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr, tx / tl, ty / tl];
    }

    var defs = make('defs', null, svg);
    var blur = make('filter', { id: fid, x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    make('feGaussianBlur', { stdDeviation: (L * 0.02).toFixed(2) }, blur);
    var root = make('g', { class: 'gecko ' + look }, svg);
    var shadow = make('path', { class: 'gk-shadow', filter: 'url(#' + fid + ')' }, root);
    var legEls = [0, 1, 2, 3].map(function () {
      return { upper: make('path', { class: 'gk-limb gk-upper' }, root), lower: make('path', { class: 'gk-limb gk-lower' }, root),
               toes: make('path', { class: 'gk-limb gk-toe' }, root), pads: make('path', { class: 'gk-pad' }, root) };
    });
    var body = make('path', { class: 'gk-body' }, root), stripe = make('path', { class: 'gk-stripe' }, root);
    var pins = make('path', { class: 'gk-pin' }, root), spots = make('path', { class: 'gk-spot' }, root);
    var bumps = make('path', { class: 'gk-bump' }, root), marks = make('path', { class: 'gk-mark', 'stroke-width': f1(L * 0.026) }, root);
    var eyes = make('path', { class: 'gk-eye' }, root), nostrils = make('path', { class: 'gk-nostril' }, root);
    root.querySelector('.gk-upper') && legEls.forEach(function (l) {
      l.upper.setAttribute('stroke-width', f1(L * 0.046));
      l.lower.setAttribute('stroke-width', f1(L * 0.034));
      l.toes.setAttribute('stroke-width', f1(L * 0.013));
    });

    // Half-width of the body (fraction of total length L) from snout (u = 0) to tail tip (u = 1).
    function halfW(u) {
      if (u < 0.1) return 0.02 + 0.064 * Math.sin(u / 0.1 * Math.PI / 2);   // broad head
      if (u < 0.15) return 0.084 - 0.028 * (u - 0.1) / 0.05;               // neck
      if (u < 0.45) return 0.056 + 0.03 * Math.sin((u - 0.15) / 0.3 * Math.PI);   // trunk
      if (u < 0.5) return 0.056 - 0.01 * (u - 0.45) / 0.05;                 // hips to tail base
      return 0.046 * Math.pow(1 - (u - 0.5) / 0.5, 0.85) + 0.002;            // tapering tail
    }
    // Lateral bending: a standing wave with nodes at the shoulders (u 0.18) and hips (u 0.44).
    function bend(u, ph) {
      if (u < 0.57) return Math.sin(ph) * Math.cos(Math.PI * (u - 0.31) / 0.26);
      var k = (u - 0.57) / 0.43;
      return -Math.sin(ph) * (1 - 0.45 * k) + 0.7 * k * Math.sin(ph - k * 4.2);
    }
    var G = [0.19, 0.19, 0.445, 0.445], SIDE = [1, -1, 1, -1], FRONT = [true, true, false, false];
    var OFF = [0, 0.5, 0.5, 0];   // left fore with right hind, then right fore with left hind
    var STRIDE = 0.21 * L, DUTY = 0.38, L1 = 0.095 * L, L2 = 0.085 * L;   // limbs about 18% of total length
    var feet = [0, 1, 2, 3].map(function () { return { pos: [0, 0], from: [0, 0], swing: false }; });
    var g = { s: 0, v: 0, mode: 'wait', timer: 0.8, speed: L * 1.1, A: 0.055 * L };

    function home(i, s) {
      var q = at(s - G[i] * L), nx = -q[3], ny = q[2], fwd = FRONT[i] ? 0.05 * L : -0.03 * L, lat = 0.14 * L * SIDE[i];
      return [q[0] + nx * lat + q[2] * fwd, q[1] + ny * lat + q[3] * fwd];
    }
    function plantAll() { feet.forEach(function (f, i) { f.pos = home(i, g.s); f.swing = false; }); }

    function render() {
      var N = 34, ph = TAU * g.s / STRIDE, C = [], NB = [], left = [], right = [];
      for (var k = 0; k < N; k++) {
        var u = k / (N - 1), q = at(g.s - u * L), lat = g.A * bend(u, ph);
        C.push([q[0] - q[3] * lat, q[1] + q[2] * lat]);
      }
      for (k = 0; k < N; k++) {
        var a = C[Math.max(0, k - 1)], b = C[Math.min(N - 1, k + 1)], tx = a[0] - b[0], ty = a[1] - b[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        NB.push([-ty / tl, tx / tl, tx / tl, ty / tl]);   // normal, then direction towards the head
        var hw = halfW(k / (N - 1)) * L * slim;
        left.push([C[k][0] + NB[k][0] * hw, C[k][1] + NB[k][1] * hw]);
        right.push([C[k][0] - NB[k][0] * hw, C[k][1] - NB[k][1] * hw]);
      }
      var outline = left.concat(right.slice().reverse());
      body.setAttribute('d', blob(outline));
      var sh = outline.map(function (p) { return [p[0] + L * 0.018, p[1] + L * 0.03]; });
      shadow.setAttribute('d', blob(sh));
      function side(u, f) {   // a point across the body at fraction f of the half-width
        var fi = u * (N - 1), i = Math.min(N - 2, Math.floor(fi)), fr = fi - i, hw = halfW(u) * L * f * slim;
        var cx = C[i][0] + (C[i + 1][0] - C[i][0]) * fr, cy = C[i][1] + (C[i + 1][1] - C[i][1]) * fr, n = NB[i];
        return [cx + n[0] * hw, cy + n[1] * hw];
      }
      if (look === 'mourning') {
        // Mourning gecko: paired dark chevrons down the back, a dark stripe through each eye and a banded tail.
        var md = '';
        [0.2, 0.265, 0.33, 0.395, 0.46].forEach(function (u) {
          var l1 = side(u - 0.02, 0.74), m = side(u + 0.022, 0), r1 = side(u - 0.02, -0.74);
          md += 'M' + f1(l1[0]) + ' ' + f1(l1[1]) + ' L' + f1(m[0]) + ' ' + f1(m[1]) + ' L' + f1(r1[0]) + ' ' + f1(r1[1]) + ' ';
        });
        for (var tu = 0.56; tu < 0.95; tu += 0.055) {
          var a1 = side(tu, 0.82), b1 = side(tu, -0.82);
          md += 'M' + f1(a1[0]) + ' ' + f1(a1[1]) + ' L' + f1(b1[0]) + ' ' + f1(b1[1]) + ' ';
        }
        [1, -1].forEach(function (sg) {
          var p0 = side(0.015, 0.35 * sg), p1 = side(0.07, 0.98 * sg), p2 = side(0.135, 0.82 * sg);
          md += 'M' + f1(p0[0]) + ' ' + f1(p0[1]) + ' Q' + f1(p1[0]) + ' ' + f1(p1[1]) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' ';
        });
        marks.setAttribute('d', md);
        stripe.setAttribute('d', '');
        pins.setAttribute('d', '');
        spots.setAttribute('d', '');
        bumps.setAttribute('d', '');
      } else {
      var sl = [], sr2 = [];
      for (var u2 = 0.11; u2 <= 0.94; u2 += 0.03) { sl.push(side(u2, 0.48)); sr2.push(side(u2, -0.48)); }
      stripe.setAttribute('d', blob(sl.concat(sr2.reverse())));
      var pl = [], pr = [];
      for (var u3 = 0.13; u3 <= 0.55; u3 += 0.03) { pl.push(side(u3, 0.6)); pr.push(side(u3, -0.6)); }
      pins.setAttribute('d', polyline(pl) + ' ' + polyline(pr));
      var sd = '';
      [[0.21, 0.8], [0.25, -0.74], [0.3, 0.84], [0.34, -0.82], [0.38, 0.76], [0.42, -0.78], [0.5, 0.66], [0.56, -0.62], [0.63, 0.56], [0.7, -0.5], [0.08, 0.55], [0.09, -0.5]].forEach(function (s2) {
        var p = side(s2[0], s2[1]), r = L * 0.0075;
        sd += 'M' + f1(p[0] - r) + ' ' + f1(p[1]) + ' a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0 a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(-2 * r) + ' 0 ';
      });
      spots.setAttribute('d', sd);
      var bd = '';
      [[0.115, 0.66], [0.115, -0.66]].forEach(function (b2) {
        var p = side(b2[0], b2[1]), r = L * 0.008;
        bd += 'M' + f1(p[0] - r) + ' ' + f1(p[1]) + ' a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0 a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(-2 * r) + ' 0 ';
      });
      bumps.setAttribute('d', bd);
      }
      var ed = '', n0 = NB[2];
      [1, -1].forEach(function (sg) {
        var p = side(0.07, 0.9 * sg), rx = L * 0.024, ry = L * 0.017, ax = n0[2], ay = n0[3];
        // an ellipse along the head's axis, drawn as a closed curve
        var pts = [];
        for (var e = 0; e < 8; e++) {
          var t = e / 8 * TAU, ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
          pts.push([p[0] + ax * ex - ay * ey, p[1] + ay * ex + ax * ey]);
        }
        ed += blob(pts) + ' ';
      });
      eyes.setAttribute('d', ed);
      var nd = '';
      [0.35, -0.35].forEach(function (f) { var p = side(0.012, f), r = L * 0.005; nd += 'M' + f1(p[0] - r) + ' ' + f1(p[1]) + ' a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0 a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(-2 * r) + ' 0 '; });
      nostrils.setAttribute('d', nd);

      // Legs: two-segment limbs from shoulder or hip to the planted foot, elbows back, knees forward.
      feet.forEach(function (f, i) {
        var gi = Math.round(G[i] * (N - 1)), sh = side(G[i], 0.72 * SIDE[i]), F = f.pos;
        var dx = F[0] - sh[0], dy = F[1] - sh[1], d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        if (d > L1 + L2 - 0.5) { F = [sh[0] + dx / d * (L1 + L2 - 0.5), sh[1] + dy / d * (L1 + L2 - 0.5)]; d = L1 + L2 - 0.5; }
        var base = Math.atan2(dy, dx), ang = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
        var dir = NB[gi], best = null;
        [1, -1].forEach(function (sg) {
          var kx = sh[0] + Math.cos(base + sg * ang) * L1, ky = sh[1] + Math.sin(base + sg * ang) * L1;
          var fwd = (kx - sh[0]) * dir[2] + (ky - sh[1]) * dir[3];
          var score = FRONT[i] ? -fwd : fwd;
          if (!best || score > best[2]) best = [kx, ky, score];
        });
        var K = [best[0], best[1]];
        legEls[i].upper.setAttribute('d', 'M' + f1(sh[0]) + ' ' + f1(sh[1]) + ' L' + f1(K[0]) + ' ' + f1(K[1]));
        legEls[i].lower.setAttribute('d', 'M' + f1(K[0]) + ' ' + f1(K[1]) + ' L' + f1(F[0]) + ' ' + f1(F[1]));
        // Five splayed toes, each ending in a broad adhesive pad.
        var fa = Math.atan2(F[1] - K[1], F[0] - K[0]) + (FRONT[i] ? 0.25 : -0.15) * SIDE[i], td = '', pd = '';
        [-0.95, -0.47, 0, 0.47, 0.95].forEach(function (o, j) {
          var ang = fa + o, ca = Math.cos(ang), sa = Math.sin(ang), len = L * 0.058 * [0.7, 0.9, 1, 0.95, 0.75][j];
          var tx2 = F[0] + ca * len, ty2 = F[1] + sa * len, pts = [];
          td += 'M' + f1(F[0]) + ' ' + f1(F[1]) + ' L' + f1(tx2) + ' ' + f1(ty2) + ' ';
          for (var e = 0; e < 6; e++) {   // a pad wider than the digit, set across its tip
            var t = e / 6 * TAU, ex = Math.cos(t) * L * 0.009, ey = Math.sin(t) * L * 0.012;
            pts.push([tx2 + ca * ex - sa * ey, ty2 + sa * ex + ca * ey]);
          }
          pd += blob(pts) + ' ';
        });
        legEls[i].toes.setAttribute('d', td);
        legEls[i].pads.setAttribute('d', pd);
      });
    }

    function updateFeet() {
      var phase = g.s / STRIDE;
      feet.forEach(function (f, i) {
        var c = phase + OFF[i];
        c -= Math.floor(c);
        if (c < DUTY) {
          if (!f.swing) { f.swing = true; f.from = f.pos.slice(); }
          var target = home(i, g.s + (DUTY - c) * STRIDE + STRIDE * 0.5), e = smooth(c / DUTY);
          f.pos = [f.from[0] + (target[0] - f.from[0]) * e, f.from[1] + (target[1] - f.from[1]) * e];
        } else if (f.swing) {
          f.swing = false;
        }
      });
    }

    function settle() {   // come to rest at the end of the route, feet planted
      g.s = total;
      g.v = 0;
      g.mode = 'done';
      plantAll();
      render();
    }
    function step(dt) {
      if (g.mode === 'done') return;
      g.timer -= dt;
      if (g.timer <= 0) {
        if (g.mode === 'go') { g.mode = 'pause'; g.timer = 0.25 + rand() * 0.6; }
        else { g.mode = 'go'; g.timer = 0.6 + rand() * 0.7; }
      }
      var vt = g.mode === 'go' ? g.speed : 0;
      if (opts.stopAtEnd) {
        if (g.s >= total) { settle(); return; }
        vt *= clamp((total - g.s) / (L * 0.35), 0.2, 1);   // slowing to a stop
      }
      g.v += (vt - g.v) * Math.min(1, dt * 12);
      if (g.v > 0.5) {
        g.s += g.v * dt;
        updateFeet();
        render();
      }
      if (g.s - L * 1.2 > total) { g.mode = 'done'; root.style.display = 'none'; }
    }
    function restart(reverse) {
      if (reverse) { P.reverse(); tans.reverse(); tans.forEach(function (t, i) { tans[i] = [-t[0], -t[1]]; }); }
      g.s = 0; g.v = 0; g.mode = 'wait'; g.timer = 0.6;
      root.style.display = '';
      plantAll();
      render();
    }
    // For visitors who prefer reduced motion: resting on the open band near the right edge.
    function rest() {
      if (opts.stopAtEnd) { settle(); return; }
      var best = total * 0.3;
      for (var i = 0; i < P.length; i++) if (P[i][0] <= route.restX) { best = i * STEP; break; }
      g.s = best;
      g.mode = 'done';
      plantAll();
      render();
    }
    plantAll();
    render();
    return { step: step, restart: restart, rest: rest, done: function () { return g.mode === 'done'; } };
  }

  function setupGecko() {
    var layer = null, gecko = null, crossings = 0, rand = seeded(2718);
    var actor = {
      on: false,
      step: function (dt) { if (gecko) gecko.step(dt); },
      // Each time the section comes back into view after the gecko has gone, it crosses again the other way.
      seen: function (on) { if (on && gecko && gecko.done() && !reduceMotion) { crossings++; gecko.restart(true); } }
    };
    function build() {
      if (layer) layer.remove();
      layer = null;
      gecko = null;
      var w = section.clientWidth, h = section.clientHeight;
      if (w < 240 || h < 200) return;
      var route = planRoute(w, h);
      if (!route) return;
      layer = make('svg', { class: 'gecko-layer', viewBox: '0 0 ' + w + ' ' + h, 'aria-hidden': 'true', focusable: 'false' });
      section.appendChild(layer);
      gecko = makeGecko(layer, route, w < 760 ? 84 : 108, rand);
      if (reduceMotion) gecko.rest();
    }
    build();
    watch(actor, section, 0.3);
    onResize(section, build);
  }

  /* A small mourning gecko (Lepidodactylus lugubris) that walks in and settles beside the name at the top
     of the page, facing it: just after the last letter where there is room, otherwise above the end of the
     name. It never rests on the text, the buttons or the photo. */
  function setupNameGecko() {
    var hero = document.querySelector('.hero'), h1 = hero && hero.querySelector('h1');
    if (!hero || !h1) return;
    var layer = null, gecko = null, rand = seeded(1618), actor = { on: false, step: function (dt) { if (gecko) gecko.step(dt); } };
    function build() {
      if (layer) layer.remove();
      layer = null;
      gecko = null;
      var w = hero.clientWidth, h = hero.clientHeight;
      if (w < 240 || h < 200) return;
      var hr = hero.getBoundingClientRect(), range = document.createRange();
      range.selectNodeContents(h1);
      var lines = range.getClientRects(), last = lines[lines.length - 1];
      if (!last) return;
      var L = w < 760 ? 44 : 58, nameR = last.right - hr.left, nameT = last.top - hr.top, nameH = last.height;
      var blocks = [];
      hero.querySelectorAll('p,li,.btn,.portrait').forEach(function (el) {
        var r = settledRect(el);
        if (r.width) blocks.push([r.left - hr.left - 6, r.top - hr.top - 6, r.right - hr.left + 6, r.bottom - hr.top + 6]);
      });
      // The heading's box is wider than the name: use the name's own line boxes instead.
      for (var li = 0; li < lines.length; li++) blocks.push([lines[li].left - hr.left - 4, lines[li].top - hr.top + nameH * 0.12, lines[li].right - hr.left + 4, lines[li].bottom - hr.top - nameH * 0.08]);
      // Resting places, facing the name: after the last letter of each line (last line first), then
      // above the end of the name.
      var spots = [];
      for (var ln = lines.length - 1; ln >= 0; ln--) {
        spots.push({ x: lines[ln].right - hr.left + 12, y: lines[ln].top - hr.top + lines[ln].height * 0.5, a: Math.PI });
      }
      spots.push({ x: nameR - L * 0.2, y: nameT + nameH * 0.08, a: Math.PI - 0.28 });
      // On phones the photo sits above the text: rest beside it, facing down towards the name below.
      var port = hero.querySelector('.portrait'), pr = port && settledRect(port);
      if (pr && pr.bottom - hr.top < nameT) {
        spots.push({ x: Math.min(w - 6 - L * 0.8, pr.right - hr.left + L * 1.1), y: pr.bottom - hr.top - 8, a: Math.PI / 2 + 0.55 });
      }
      function footprint(c) {   // the body from snout to tail, legs either side
        var dx = Math.cos(c.a), dy = Math.sin(c.a), tx = c.x - dx * L * 1.02, ty = c.y - dy * L * 1.02, ox = -dy * L * 0.26, oy = dx * L * 0.26;
        var xs = [c.x + ox, c.x - ox, tx + ox, tx - ox], ys = [c.y + oy, c.y - oy, ty + oy, ty - oy];
        return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
      }
      var spot = null;
      for (var k = 0; k < spots.length && !spot; k++) {
        var fp = footprint(spots[k]);
        if (fp[2] > w - 4 || fp[0] < 4 || fp[1] < 6) continue;
        var clear = blocks.every(function (b) { return fp[2] < b[0] || fp[0] > b[2] || fp[3] < b[1] || fp[1] > b[3]; });
        if (clear) spot = spots[k];
      }
      if (!spot) return;
      // Its approach: a short curve that ends at the spot, heading towards the name.
      var dx = Math.cos(spot.a), dy = Math.sin(spot.a), px = -dy, py = dx, E = [spot.x, spot.y];
      var S = [E[0] - dx * L * 2.2 + px * L * 0.5, E[1] - dy * L * 2.2 + py * L * 0.5], C = [E[0] - dx * L, E[1] - dy * L + py * L * 0.45];
      var pts = [], n = 60;
      for (var i = 0; i <= n; i++) {
        var t = i / n, u = 1 - t;
        pts.push([u * u * S[0] + 2 * u * t * C[0] + t * t * E[0], u * u * S[1] + 2 * u * t * C[1] + t * t * E[1]]);
      }
      var even = [pts[0]], carry = 0;   // resample every 2 px
      for (var j = 1; j < pts.length; j++) {
        var a = pts[j - 1], b = pts[j], sx = b[0] - a[0], sy = b[1] - a[1], sl = Math.sqrt(sx * sx + sy * sy);
        for (var d = 2 - carry; d <= sl; d += 2) even.push([a[0] + sx * d / sl, a[1] + sy * d / sl]);
        carry = (sl - (2 - carry)) % 2;
        if (carry < 0) carry = 0;
      }
      layer = make('svg', { class: 'gecko-layer', viewBox: '0 0 ' + w + ' ' + h, 'aria-hidden': 'true', focusable: 'false' });
      hero.appendChild(layer);
      gecko = makeGecko(layer, { pts: even }, L, rand, { look: 'mourning', stopAtEnd: true });
      if (reduceMotion) gecko.rest();
    }
    build();
    watch(actor, hero, 0.3);
    onResize(hero, build);
  }

  whenReady(function () {
    var tank = section.querySelector('.aquarium');
    if (tank) setupTank(tank);
    setupGecko();
    setupNameGecko();
  });
})();
