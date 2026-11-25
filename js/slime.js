/* The yellow plasmodium of the slime mould Physarum polycephalum, creeping over the page in the section
   marked data-slime (the "Fungi and slime moulds" section of hobbies.html), as fungal hyphae do in the
   other sections; js/main.js leaves that section to it.

   It is modelled as a network of tubes that adapt to the flow of cytoplasm through them, as in the model of
   Tero et al. (2010, Science 327: 439):
   - It enters from the left edge of the page and spreads through the space around the text and photos,
     its edge advancing as a lobed fan that lays down a fine, irregular net of thin tubes.
   - Cytoplasm flows from where it came in towards the fan; the flow through every tube is solved from the
     pressures in the network.
   - Tubes that carry much of the flow thicken; tubes that carry little thin out and are given up, leaving a
     faint track of spent slime. Behind the fan the net resolves into branching veins, which pull taut into
     smooth curves.
   - A slow wave of thickening runs outwards along the veins (shuttle streaming).
   It runs only while the section is on screen and rests once grown. On touchscreens it steps less often;
   for visitors who prefer reduced motion it is grown out of sight and then shown still. */
(function () {
  'use strict';

  var host = document.querySelector('[data-slime]');
  if (!host || !window.requestAnimationFrame || !window.Float32Array || !window.Path2D) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var calm = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  var TAU = Math.PI * 2;

  var JITTER = 0.3, WARP = 1.2, WARP_LEN = 70, MERGE = 0.3;   // the net's irregularity
  var LOBE = 18, REACH = 0.72;                     // lobes of the edge; how far it spreads
  var D0 = 0.16;                                   // conductance of a new tube
  var I0 = 1, MU = 2, THETA = 0.06, ADAPT = 0.02;  // flow, and how tubes respond to it
  var PRUNE = 0.05, PRUNE_AGE = 2.5;               // tubes thinner than this, and older, are given up
  var DRAIN = 0.004;                               // extra thinning behind the fan, so only busy tubes stay
  var TAUT2 = 0.035, TAUT3 = 0.012;                // how fast veins pull straight, and junctions settle
  var ITERS = 80, EPS = 1e-7;                      // pressure solve
  var STEP_HZ = calm ? 20 : 30, GROW_TAU = calm ? 14 : 18;

  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Smooth value noise in [-1, 1] with features about `len` pixels across.
  function noiseField(w, h, len, rand) {
    var gw = Math.ceil(w / len) + 3, gh = Math.ceil(h / len) + 3, lat = new Float32Array(gw * gh);
    for (var i = 0; i < lat.length; i++) lat[i] = rand() * 2 - 1;
    return function (px, py) {
      var fx = Math.max(0, px / len + 1), fy = Math.max(0, py / len + 1), ix = Math.min(gw - 2, fx | 0), iy = Math.min(gh - 2, fy | 0);
      var u = Math.min(1, fx - ix), v = Math.min(1, fy - iy);
      u = u * u * (3 - 2 * u);
      v = v * v * (3 - 2 * v);
      var p = iy * gw + ix, A = lat[p], B = lat[p + 1], C = lat[p + gw], D = lat[p + gw + 1];
      return A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v;
    };
  }
  // Where an element sits once its scroll-reveal fade has finished.
  function settledRect(el) {
    var r = el.getBoundingClientRect(), rv = el.closest('.reveal'), dy = 0;
    if (rv) {
      var tf = getComputedStyle(rv).transform;
      dy = tf && tf !== 'none' ? -new DOMMatrixReadOnly(tf).m42 : 0;
    }
    return { left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy, width: r.width };
  }
  // Is the page dark? The colours of the spent-slime track follow the theme.
  function darkPage() {
    var c = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number);
    if (c.length < 3 || c[3] === 0) c = (getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] < 110;
  }

  var sim = null;

  function build() {
    if (sim) { sim.canvas.remove(); sim = null; }
    var w = host.clientWidth, h = host.clientHeight;
    if (w < 240 || h < 160) return;
    var narrow = w < 760, SP = narrow ? 10 : 11, PAD = narrow ? 10 : 14;
    var dpr = Math.min(2, window.devicePixelRatio || 1), rand = seeded(9241), hr = host.getBoundingClientRect(), i, k;

    // The text and photos, with room around them.
    var blocks = [];
    host.querySelectorAll('.section-label, h2, h3, p, li, figure, .btn').forEach(function (el) {
      var r = settledRect(el);
      if (r.width) blocks.push([r.left - hr.left - PAD, r.top - hr.top - PAD, r.right - hr.left + PAD, r.bottom - hr.top + PAD]);
    });
    function free(x, y) {
      if (x < 2 || y < 3 || x > w - 2 || y > h - 3) return false;
      for (var b = 0; b < blocks.length; b++) {
        var B = blocks[b];
        if (x > B[0] && x < B[2] && y > B[1] && y < B[3]) return false;
      }
      return true;
    }

    /* ----- The net: a jittered triangular lattice, warped by smooth noise so its cells vary in size; the
       tubes join the centres of neighbouring triangles, so every junction is Y-shaped. ----- */
    var hh = SP * Math.sqrt(3) / 2, cols = Math.ceil(w / SP) + 5, rows = Math.ceil(h / hh) + 5, lx = new Float32Array(cols * rows), ly = new Float32Array(cols * rows);
    var wx = noiseField(w + 60, h + 60, WARP_LEN, rand), wy = noiseField(w + 60, h + 60, WARP_LEN, rand);
    for (var j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      var x0 = (i - 2) * SP + (j & 1 ? SP / 2 : 0), y0 = (j - 2) * hh;
      lx[j * cols + i] = x0 + (rand() - 0.5) * 2 * JITTER * SP + wx(x0 + 30, y0 + 30) * WARP * SP;
      ly[j * cols + i] = y0 + (rand() - 0.5) * 2 * JITTER * hh + wy(x0 + 30, y0 + 30) * WARP * SP;
    }
    var vx = [], vy = [], pairs = [], open = new Map();
    function tri(a, b, c) {
      var x = (lx[a] + lx[b] + lx[c]) / 3, y = (ly[a] + ly[b] + ly[c]) / 3;
      if (!free(x, y)) return;
      var v = vx.length;
      vx.push(x);
      vy.push(y);
      [[a, b], [b, c], [c, a]].forEach(function (e) {
        var key = e[0] < e[1] ? e[0] * 1000000 + e[1] : e[1] * 1000000 + e[0], t = open.get(key);
        if (t === undefined) open.set(key, v);
        else if (free((vx[t] + x) / 2, (vy[t] + y) / 2)) pairs.push([t, v]);   // not across a corner of the text
      });
    }
    function L(ii, jj) { return jj * cols + ii; }
    for (j = 0; j < rows - 1; j++) for (i = 0; i < cols - 1; i++) {
      if (!(j & 1)) { tri(L(i, j), L(i + 1, j), L(i, j + 1)); tri(L(i + 1, j), L(i + 1, j + 1), L(i, j + 1)); }
      else { tri(L(i, j), L(i + 1, j + 1), L(i, j + 1)); tri(L(i, j), L(i + 1, j), L(i + 1, j + 1)); }
    }
    var nV = vx.length;
    if (nV < 60) return;
    // Drop some cell walls, merging cells into larger, more varied ones; every junction stays connected.
    var deg = new Int32Array(nV);
    pairs.forEach(function (e) { deg[e[0]]++; deg[e[1]]++; });
    for (k = pairs.length - 1; k > 0; k--) { var r0 = Math.floor(rand() * (k + 1)), tmp = pairs[k]; pairs[k] = pairs[r0]; pairs[r0] = tmp; }
    var kept = [];
    pairs.forEach(function (e) {
      if (rand() < MERGE && deg[e[0]] > 2 && deg[e[1]] > 2) { deg[e[0]]--; deg[e[1]]--; } else kept.push(e);
    });
    var VX = new Float32Array(vx), VY = new Float32Array(vy), nE = kept.length, EA = new Int32Array(nE), EB = new Int32Array(nE), ELEN = new Float32Array(nE);
    var adj = [];
    for (i = 0; i < nV; i++) adj.push([]);
    kept.forEach(function (e, q) {
      EA[q] = e[0];
      EB[q] = e[1];
      ELEN[q] = Math.max(1, Math.sqrt((VX[e[0]] - VX[e[1]]) * (VX[e[0]] - VX[e[1]]) + (VY[e[0]] - VY[e[1]]) * (VY[e[0]] - VY[e[1]])));
      adj[e[0]].push(q);
      adj[e[1]].push(q);
    });

    // It comes in from the left edge of the page, into an open stretch of the net (not a sliver beside the
    // text): low down on wide screens, about half-way down on phones.
    var comp = new Int32Array(nV).fill(-1), sizes = [], stack = [];
    for (i = 0; i < nV; i++) {
      if (comp[i] >= 0 || !adj[i].length) continue;
      var cid = sizes.length, cnt = 0;
      comp[i] = cid;
      stack.push(i);
      while (stack.length) {
        var u0 = stack.pop(), nb0 = adj[u0];
        cnt++;
        for (k = 0; k < nb0.length; k++) {
          var o0 = EA[nb0[k]] === u0 ? EB[nb0[k]] : EA[nb0[k]];
          if (comp[o0] < 0) { comp[o0] = cid; stack.push(o0); }
        }
      }
      sizes.push(cnt);
    }
    var ty = h * (narrow ? 0.5 : 0.82), entry = -1, best = -Infinity;
    for (i = 0; i < nV; i++) {
      if (comp[i] < 0 || VX[i] > 30 || sizes[comp[i]] < 40) continue;
      var score = Math.min(sizes[comp[i]], 400) * 10 - Math.abs(VY[i] - ty) - VX[i] * 4;
      if (score > best) { best = score; entry = i; }
    }
    if (entry < 0) return;
    var sources = [], fixed = new Uint8Array(nV);
    for (i = 0; i < nV; i++) {
      var ex = VX[i] - VX[entry], ey = VY[i] - VY[entry];
      if (ex * ex + ey * ey < 18 * 18) { sources.push(i); fixed[i] = 1; }
    }

    // How far along the net each junction is from the entry (Dijkstra), made lobed by smooth noise.
    var dist = new Float64Array(nV).fill(Infinity), heap = [[0, entry]];
    dist[entry] = 0;
    while (heap.length) {
      var top = heap[0], last = heap.pop();
      if (heap.length) {   // pop the smallest, then sift the last item down from the root
        heap[0] = last;
        for (var hp = 0; ;) {
          var lc = 2 * hp + 1, rc = lc + 1, mn = hp;
          if (lc < heap.length && heap[lc][0] < heap[mn][0]) mn = lc;
          if (rc < heap.length && heap[rc][0] < heap[mn][0]) mn = rc;
          if (mn === hp) break;
          var sw = heap[mn]; heap[mn] = heap[hp]; heap[hp] = sw; hp = mn;
        }
      }
      var dv = top[0], v1 = top[1];
      if (dv > dist[v1]) continue;
      var nb = adj[v1];
      for (k = 0; k < nb.length; k++) {
        var e1 = nb[k], o = EA[e1] === v1 ? EB[e1] : EA[e1], nd = dv + ELEN[e1];
        if (nd < dist[o]) {
          dist[o] = nd;
          heap.push([nd, o]);
          for (var c = heap.length - 1; c > 0;) {
            var pa = (c - 1) >> 1;
            if (heap[pa][0] <= heap[c][0]) break;
            var sw2 = heap[pa]; heap[pa] = heap[c]; heap[c] = sw2; c = pa;
          }
        }
      }
    }
    var lobes = noiseField(w + 60, h + 60, 45, rand), DN = new Float32Array(nV), dmax = 0;
    for (i = 0; i < nV; i++) {
      if (dist[i] === Infinity) { DN[i] = Infinity; continue; }
      DN[i] = dist[i] - LOBE * Math.min(1, dist[i] / 40) * lobes(VX[i] + 30, VY[i] + 30);
      if (dist[i] > dmax) dmax = dist[i];
    }
    var Dfinal = Math.min(dmax * REACH, narrow ? 700 : 1100), pending = new Int32Array(nE), nPending = 0;
    for (var q0 = 0; q0 < nE; q0++) {   // each tube grows from the end the edge reaches first
      if (DN[EA[q0]] > DN[EB[q0]]) { var s3 = EA[q0]; EA[q0] = EB[q0]; EB[q0] = s3; }
      if (DN[EA[q0]] <= Dfinal) pending[nPending++] = q0;   // the tubes it will ever grow
    }

    var canvas = document.createElement('canvas');
    canvas.className = 'slime-layer';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    host.insertBefore(canvas, host.firstChild);

    sim = {
      canvas: canvas, ctx: ctx, w: w, h: h, dpr: dpr, rand: seeded(777), dark: darkPage(), entry: entry, sources: sources,
      nV: nV, VX: VX, VY: VY, DN: DN, fixed: fixed, adj: adj, nE: nE, EA: EA, EB: EB, ELEN: ELEN, free: free,
      state: new Uint8Array(nE), D: new Float32Array(nE), born: new Float32Array(nE), prog: new Float32Array(nE),
      gone: new Float32Array(nE), GX: new Float32Array(nE * 4), aliveDeg: new Int32Array(nV), seen: new Uint8Array(nE),
      p: new Float64Array(nV), b: new Float64Array(nV), rr: new Float64Array(nV), z: new Float64Array(nV), dd: new Float64Array(nV),
      Ad: new Float64Array(nV), diag: new Float64Array(nV), live: new Int32Array(nE), nLive: 0, act: new Int32Array(nV), nAct: 0,
      pending: pending, nPending: nPending, band: narrow ? 30 : 40, t: 0, front: 12, Dfinal: Dfinal
    };
  }

  // The living tubes, and the junctions they meet at; the work each step is over these only.
  function countAlive(s) {
    var deg = s.aliveDeg, state = s.state, EA = s.EA, EB = s.EB, live = s.live, act = s.act, n = 0, m = 0;
    for (var k = 0; k < s.nAct; k++) deg[act[k]] = 0;
    for (var j = 0; j < s.nLive; j++) { var e = live[j]; deg[EA[e]] = 0; deg[EB[e]] = 0; }
    for (var q = 0; q < s.nE; q++) {
      if (state[q] !== 2) continue;
      live[n++] = q;
      if (!deg[EA[q]]++) act[m++] = EA[q];
      if (!deg[EB[q]]++) act[m++] = EB[q];
    }
    s.nLive = n;
    s.nAct = m;
  }

  /* ---------- One step of growth, flow and adaptation ---------- */
  function stepSim(s, dt) {
    s.t += dt;
    s.front = Math.max(12, s.Dfinal * (1 - Math.exp(-s.t / GROW_TAU)));
    var nE = s.nE, nV = s.nV, EA = s.EA, EB = s.EB, DN = s.DN, VX = s.VX, VY = s.VY, state = s.state, D = s.D, prog = s.prog;
    var front = s.front, t = s.t, BAND = s.band, q, a, b, i;
    // The edge advances: tubes grow out from the junctions it has reached.
    var pend = s.pending, np = 0;
    for (var pi = 0; pi < s.nPending; pi++) {
      q = pend[pi];
      a = EA[q]; b = EB[q];
      if (front < DN[a]) { pend[np++] = q; continue; }
      var pr = (front - DN[a]) / Math.max(0.5, DN[b] - DN[a]);
      if (pr >= 1) { state[q] = 2; D[q] = D0; s.born[q] = t; prog[q] = 1; }
      else { state[q] = 1; prog[q] = pr; pend[np++] = q; }
    }
    s.nPending = np;
    countAlive(s);

    // Cytoplasm flows in where the plasmodium enters and out to the junctions along the advancing fan.
    var bb = s.b, aliveDeg = s.aliveDeg, act = s.act, ok = false;
    for (i = 0; i < s.nAct; i++) bb[act[i]] = 0;
    var src = s.sources.filter(function (v) { return aliveDeg[v]; }), sinks = [];
    if (src.length) {
      for (var ai = 0; ai < s.nAct; ai++) { i = act[ai]; if (DN[i] > front - BAND * 0.8 && DN[i] <= front) sinks.push(i); }
      if (sinks.length) {
        src.forEach(function (v) { bb[v] += I0 / src.length; });
        sinks.forEach(function (v) { bb[v] -= I0 / sinks.length; });
        ok = true;
      }
    }
    if (ok) solve(s);

    // Tubes adapt to the flow through them, dD/dt = f(|Q|) - D; behind the fan they also thin a little,
    // and once thin enough they are given up.
    var p = s.p, ELEN = s.ELEN, keepBand = front - BAND, GX = s.GX, live = s.live, nLive = s.nLive;
    for (var li = 0; li < nLive; li++) {
      q = live[li];
      a = EA[q]; b = EB[q];
      var Q = ok ? Math.abs(D[q] / ELEN[q] * (p[a] - p[b])) : 0, qm = Math.pow(Q / THETA, MU);
      D[q] += ADAPT * (qm / (1 + qm) - D[q]);
      if (DN[b] >= keepBand) { if (D[q] < D0 * 0.6) D[q] = D0 * 0.6; }   // the fan keeps its fine net
      else {
        D[q] -= DRAIN;
        if (D[q] < PRUNE && t - s.born[q] > PRUNE_AGE) {
          state[q] = 3;
          s.gone[q] = t;
          D[q] = 0;
          GX[q * 4] = VX[a]; GX[q * 4 + 1] = VY[a]; GX[q * 4 + 2] = VX[b]; GX[q * 4 + 3] = VY[b];
        }
      }
    }

    // Veins pull taut: behind the fan, each junction slides towards the far ends of its living tubes, as
    // long as it stays clear of the text and photos.
    countAlive(s);
    var adj = s.adj, free = s.free;
    for (var ri = 0; ri < s.nAct; ri++) {
      i = act[ri];
      var dg = aliveDeg[i];
      if (dg < 2 || s.fixed[i] || DN[i] >= keepBand) continue;
      var sx = 0, sy = 0, nb2 = adj[i];
      for (var k = 0; k < nb2.length; k++) {
        var e2 = nb2[k];
        if (state[e2] !== 2) continue;
        var o2 = EA[e2] === i ? EB[e2] : EA[e2];
        sx += VX[o2];
        sy += VY[o2];
      }
      var rate = dg === 2 ? TAUT2 : TAUT3, nx = VX[i] + (sx / dg - VX[i]) * rate, ny = VY[i] + (sy / dg - VY[i]) * rate;
      if (free(nx, ny)) { VX[i] = nx; VY[i] = ny; }
    }
    for (li = 0; li < s.nLive; li++) {
      q = live[li];
      a = EA[q]; b = EB[q];
      ELEN[q] = Math.max(1, Math.sqrt((VX[a] - VX[b]) * (VX[a] - VX[b]) + (VY[a] - VY[b]) * (VY[a] - VY[b])));
    }
  }

  // Pressures from Kirchhoff's law: a conjugate-gradient solve of the weighted graph Laplacian, over the
  // living tubes only.
  function solve(s) {
    var EA = s.EA, EB = s.EB, D = s.D, ELEN = s.ELEN, live = s.live, nLive = s.nLive, act = s.act, nAct = s.nAct;
    var p = s.p, b = s.b, r = s.rr, z = s.z, d = s.dd, Ad = s.Ad, diag = s.diag, i, k, li, q, w;
    for (k = 0; k < nAct; k++) diag[act[k]] = EPS;
    for (li = 0; li < nLive; li++) { q = live[li]; w = D[q] / ELEN[q]; diag[EA[q]] += w; diag[EB[q]] += w; }
    function mul(x, y) {
      for (var kk = 0; kk < nAct; kk++) y[act[kk]] = EPS * x[act[kk]];
      for (var m = 0; m < nLive; m++) {
        var e = live[m], a = EA[e], c = EB[e], ww = D[e] / ELEN[e] * (x[a] - x[c]);
        y[a] += ww;
        y[c] -= ww;
      }
    }
    mul(p, Ad);
    var rz = 0;
    for (k = 0; k < nAct; k++) { i = act[k]; r[i] = b[i] - Ad[i]; z[i] = r[i] / diag[i]; d[i] = z[i]; rz += r[i] * z[i]; }
    for (var it = 0; it < ITERS && rz > 1e-12; it++) {
      mul(d, Ad);
      var dAd = 0;
      for (k = 0; k < nAct; k++) { i = act[k]; dAd += d[i] * Ad[i]; }
      if (dAd <= 0) break;
      var alpha = rz / dAd, rz2 = 0;
      for (k = 0; k < nAct; k++) { i = act[k]; p[i] += alpha * d[i]; r[i] -= alpha * Ad[i]; z[i] = r[i] / diag[i]; rz2 += r[i] * z[i]; }
      var beta = rz2 / rz;
      rz = rz2;
      for (k = 0; k < nAct; k++) { i = act[k]; d[i] = z[i] + beta * d[i]; }
    }
  }

  /* ---------- Drawing ---------- */
  var LEVELS = 10, WAVES = 6;
  function render(s) {
    var ctx = s.ctx, nE = s.nE, EA = s.EA, EB = s.EB, VX = s.VX, VY = s.VY, DN = s.DN, D = s.D, state = s.state, prog = s.prog, t = s.t;
    var adj = s.adj, q, a, b, k;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Spent slime where tubes have been given up, fading over about forty seconds.
    var ghosts = [new Path2D(), new Path2D(), new Path2D()], anyGhost = [false, false, false], GX = s.GX;
    for (q = 0; q < nE; q++) {
      if (state[q] !== 3) continue;
      var age = t - s.gone[q];
      if (age > 40) continue;
      var gi = age < 12 ? 0 : age < 26 ? 1 : 2;
      ghosts[gi].moveTo(GX[q * 4], GX[q * 4 + 1]);
      ghosts[gi].lineTo(GX[q * 4 + 2], GX[q * 4 + 3]);
      anyGhost[gi] = true;
    }
    ctx.lineWidth = 0.9;
    [1, 0.65, 0.3].forEach(function (f0, i2) {
      if (!anyGhost[i2]) return;
      ctx.strokeStyle = s.dark ? 'rgba(224, 220, 186, ' + (0.1 * f0).toFixed(3) + ')' : 'rgba(176, 150, 70, ' + (0.16 * f0).toFixed(3) + ')';
      ctx.stroke(ghosts[i2]);
    });
    // The living tubes, joined into veins from junction to junction and drawn as smooth curves, batched by
    // thickness and by the phase of the pulse running outwards.
    countAlive(s);
    var aliveDeg = s.aliveDeg, seen = s.seen, paths = [], phase = reduceMotion ? 0 : t * 1.1, entryLevel = 0;
    seen.fill(0);
    for (k = 0; k < LEVELS * WAVES; k++) paths.push(null);
    function vein(v, e) {
      var xs = [VX[v]], ys = [VY[v]], sumD = 0, sumDN = DN[v], n = 0, cur = v;
      for (;;) {
        seen[e] = 1;
        var nxt = EA[e] === cur ? EB[e] : EA[e];
        xs.push(VX[nxt]);
        ys.push(VY[nxt]);
        sumD += D[e];
        sumDN += DN[nxt];
        n++;
        if (aliveDeg[nxt] !== 2) break;
        var nb = adj[nxt], ne = -1;
        for (var m = 0; m < nb.length; m++) if (nb[m] !== e && state[nb[m]] === 2) { ne = nb[m]; break; }
        if (ne < 0 || seen[ne]) break;
        cur = nxt;
        e = ne;
      }
      var lv = Math.min(LEVELS - 1, Math.round(Math.sqrt(sumD / n) * (LEVELS - 1)));
      if (v === s.entry || nxt === s.entry) entryLevel = Math.max(entryLevel, lv);
      var wv = Math.floor((((sumDN / (n + 1)) * 0.045 - phase) % WAVES + WAVES) % WAVES), idx = lv * WAVES + wv;
      var path = paths[idx] || (paths[idx] = new Path2D());
      path.moveTo(xs[0], ys[0]);
      for (var j = 1; j < xs.length - 1; j++) path.quadraticCurveTo(xs[j], ys[j], (xs[j] + xs[j + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
      path.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
    }
    for (var v = 0; v < s.nV; v++) {
      if (!aliveDeg[v] || aliveDeg[v] === 2) continue;
      var nbv = adj[v];
      for (k = 0; k < nbv.length; k++) if (state[nbv[k]] === 2 && !seen[nbv[k]]) vein(v, nbv[k]);
    }
    for (q = 0; q < nE; q++) if (state[q] === 2 && !seen[q]) vein(EA[q], q);   // closed loops
    // Where it comes in: a trunk from beyond the edge of the page.
    var ent = s.entry, trunk = new Path2D();
    trunk.moveTo(-8, VY[ent] + 4);
    trunk.quadraticCurveTo(VX[ent] * 0.4, VY[ent] + 2, VX[ent], VY[ent]);
    var tl = Math.max(entryLevel, Math.min(LEVELS - 1, Math.round(LEVELS * Math.min(1, s.t / 6) * 0.8)));
    var tIdx = tl * WAVES;
    (paths[tIdx] || (paths[tIdx] = new Path2D())).addPath(trunk);
    // Tubes still growing at the edge, each with a swollen tip.
    var growing = new Path2D(), tips = new Path2D(), anyTip = false;
    for (q = 0; q < nE; q++) {
      if (state[q] !== 1) continue;
      a = EA[q]; b = EB[q];
      var x2 = VX[a] + (VX[b] - VX[a]) * prog[q], y2 = VY[a] + (VY[b] - VY[a]) * prog[q];
      growing.moveTo(VX[a], VY[a]);
      growing.lineTo(x2, y2);
      tips.moveTo(x2 + 1.2, y2);
      tips.arc(x2, y2, 1.2, 0, TAU);
      anyTip = true;
    }
    // A darker rim first, so the yellow reads on a light page, then the yellow, then a wet sheen.
    for (var pass = 0; pass < 3; pass++) {
      for (var lvl = 0; lvl < LEVELS; lvl++) {
        var f = lvl / (LEVELS - 1), w = 0.8 + 3.8 * f * f;
        if (pass === 2 && f <= 0.45) continue;
        var R = Math.round(246 - 18 * f), G = Math.round(210 - 42 * f), B = Math.round(40 - 26 * f);
        for (var wv2 = 0; wv2 < WAVES; wv2++) {
          var pth = paths[lvl * WAVES + wv2];
          if (!pth) continue;
          var pulse = reduceMotion ? 1 : 0.86 + 0.14 * Math.sin(wv2 / WAVES * TAU);
          if (pass === 0) {
            ctx.lineWidth = w + 1.1;
            ctx.strokeStyle = s.dark ? 'rgba(70, 50, 4, .35)' : 'rgba(150, 104, 8, ' + (0.28 * (0.75 + 0.25 * pulse)).toFixed(3) + ')';
            ctx.stroke(pth);
          } else if (pass === 1) {
            ctx.lineWidth = w * (0.94 + 0.06 * pulse);
            ctx.strokeStyle = 'rgba(' + R + ', ' + G + ', ' + B + ', ' + ((0.8 + 0.2 * f) * pulse).toFixed(3) + ')';
            ctx.stroke(pth);
          } else {
            ctx.save();
            ctx.translate(-w * 0.18, -w * 0.18);
            ctx.lineWidth = w * 0.3;
            ctx.strokeStyle = 'rgba(255, 246, 176, ' + (0.45 * pulse).toFixed(3) + ')';
            ctx.stroke(pth);
            ctx.restore();
          }
        }
      }
    }
    if (anyTip) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(236, 196, 30, .9)';
      ctx.stroke(growing);
      ctx.fillStyle = 'rgba(246, 210, 50, .95)';
      ctx.fill(tips);
    }
  }

  /* ---------- Running it ---------- */
  var on = false, raf = 0, last = 0, acc = 0, quiet = false;
  // With ?slimedebug in the address, average milliseconds per step and per redraw go to window.slimeStats.
  var stats = /slimedebug/.test(location.search) ? (window.slimeStats = { steps: 0, stepMs: 0, renders: 0, renderMs: 0, tubes: 0, junctions: 0 }) : null;
  function loop(now) {
    raf = 0;
    if (!on || !sim || quiet) return;
    var grown = sim.t > GROW_TAU * 5, hz = grown ? 12 : STEP_HZ, dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / hz;
    last = now;
    acc += dt;
    var did = 0, t0 = stats ? performance.now() : 0;
    while (acc >= 1 / hz && did < 2) { acc -= 1 / hz; if (!grown) stepSim(sim, 1 / hz); else sim.t += 1 / hz; did++; }
    if (acc > 0.3) acc = 0;
    if (stats && did) { stats.stepMs += performance.now() - t0; stats.steps += did; stats.tubes = sim.nLive; stats.junctions = sim.nV; t0 = performance.now(); }
    if (did) render(sim);
    if (stats && did) { stats.renderMs += performance.now() - t0; stats.renders++; }
    // Once grown it only pulses; on touchscreens it then rests.
    if (calm && grown) { quiet = true; return; }
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (!raf && on && sim && !quiet) { last = 0; raf = requestAnimationFrame(loop); }
  }
  // Reduced motion: grow it in the background in short slices, then show it still.
  function growQuietly() {
    var s = sim;
    (function slice() {
      if (s !== sim) return;
      for (var k = 0; k < 8; k++) stepSim(s, 1 / 12);
      if (s.t < GROW_TAU * 4) setTimeout(slice, 20);
      else render(s);
    })();
  }
  function setup() {
    build();
    quiet = false;
    if (!sim) return;
    if (reduceMotion) growQuietly();
    else { render(sim); start(); }
  }
  function retheme() {
    if (!sim) return;
    var d = darkPage();
    if (d !== sim.dark) { sim.dark = d; render(sim); }
  }

  function whenReady(fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    function fonts() { if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go(); }
    if (document.readyState === 'complete') fonts();
    else window.addEventListener('load', fonts);
    setTimeout(go, 2500);
  }
  whenReady(function () {
    setup();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        on = entries[entries.length - 1].isIntersecting;
        if (on) start();
      }).observe(host);
    } else {
      on = true;
      start();
    }
    if ('ResizeObserver' in window) {
      var timer, w0 = host.clientWidth, h0 = host.clientHeight;
      new ResizeObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          if (Math.abs(host.clientWidth - w0) > 1 || Math.abs(host.clientHeight - h0) > 2) { w0 = host.clientWidth; h0 = host.clientHeight; setup(); }
        }, 250);
      }).observe(host);
    }
    // The theme can be switched with the button in the header, or follow the system.
    new MutationObserver(function () { setTimeout(retheme, 50); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { setTimeout(retheme, 50); });
  });
})();
