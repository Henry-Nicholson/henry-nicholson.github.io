// Small enhancements: theme toggle, mobile menu, hero network, card visual, scroll reveal.
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // Deterministic random numbers so the drawings look the same on every visit.
  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Header border on scroll ---------- */
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // On the home page the name is the hero headline, so the header only shows it once that has scrolled away.
  var heroTitle = document.getElementById('hero-title');
  if (header && heroTitle && 'IntersectionObserver' in window) {
    root.classList.add('name-tucked');
    new IntersectionObserver(function (entries) {
      root.classList.toggle('name-tucked', entries[0].isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(heroTitle);
  }

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.querySelector('.theme-btn');
  function currentTheme() {
    return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  }
  function syncThemeButton() {
    var mode = currentTheme();
    themeBtn.dataset.mode = mode;
    themeBtn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncThemeButton();
    drawHyphae(false);
  });
  var onSystemChange = function () { syncThemeButton(); drawHyphae(false); };
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemChange);
  syncThemeButton();

  /* ---------- Mycelium growth model (shared by the hero and the scroll-linked sections) ----------
     Tips extend with a persistent heading (a correlated random walk), steer away from ground that
     is already colonised (negative autotropism) and outward from their inoculum, branch
     subapically at acute angles on alternating sides, and fuse with neighbouring hyphae they run
     into (anastomosis). Returns each hypha as a polyline plus the step on which it starts growing. */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function angDiff(target, a) { return Math.atan2(Math.sin(target - a), Math.cos(target - a)); }
  function gauss(rand) { return (rand() + rand() + rand() - 1.5) * 1.15; }

  // What the hyphae meet on the page. Text, photos and buttons are hard obstructions they never
  // cross; cards and panels are a substrate they can climb onto and grow across.
  var TEXT_SEL = 'h1,h2,h3,p,li,dt,dd,blockquote,figcaption,.btn,.tag,.section-label,.eyebrow,' +
                 '.card-foot,.step,.card-link,.contact-links a,.crumb';
  var SOLID_SEL = 'img,svg.viz,.card-visual,.plot,.portrait,.contact-card,.tile,.aquarium,.gecko-arrow';
  var SURFACE_SEL = '.card,.skill-group,.facts,.approach,.next-card,.callout';
  var FREE = 0, SURFACE = 1, WALL = 2;
  // Where an element will sit once its scroll-reveal fade has finished.
  function settledRect(el, cache) {
    var r = el.getBoundingClientRect(), rv = el.closest('.reveal'), dy = 0;
    if (rv) {
      if (cache.has(rv)) dy = cache.get(rv);
      else {
        var tf = getComputedStyle(rv).transform;
        dy = tf && tf !== 'none' ? -new DOMMatrixReadOnly(tf).m42 : 0;
        cache.set(rv, dy);
      }
    }
    return { left: r.left, right: r.right, top: r.top + dy, bottom: r.bottom + dy, width: r.width, height: r.height };
  }
  // A coarse map of a drawing's area (origin at left/top in the viewport): FREE, SURFACE or WALL.
  function makeTerrain(left, top, w, h, scope, withSurfaces, textPad) {
    var CB = 4, cols = Math.ceil(w / CB) + 1, rows = Math.ceil(h / CB) + 1;
    var grid = new Uint8Array(cols * rows), cache = new Map(), within = scope || document;
    function paint(el, pad, val) {
      if (el.closest('.site-header')) return;
      var r = settledRect(el, cache);
      if (!r.width || !r.height) return;
      var x0 = r.left - left - pad, x1 = r.right - left + pad, y0 = r.top - top - pad, y1 = r.bottom - top + pad;
      if (x1 < 0 || y1 < 0 || x0 > w || y0 > h || x1 <= x0 || y1 <= y0) return;
      var c0 = Math.max(0, Math.floor(x0 / CB)), c1 = Math.min(cols - 1, Math.floor(x1 / CB));
      var r0 = Math.max(0, Math.floor(y0 / CB)), r1 = Math.min(rows - 1, Math.floor(y1 / CB));
      for (var yy = r0; yy <= r1; yy++) {
        for (var xx = c0; xx <= c1; xx++) if (grid[yy * cols + xx] < val) grid[yy * cols + xx] = val;
      }
    }
    if (withSurfaces) within.querySelectorAll(SURFACE_SEL).forEach(function (el) { paint(el, -3, SURFACE); });
    within.querySelectorAll(SOLID_SEL).forEach(function (el) { paint(el, 0, WALL); });
    within.querySelectorAll(TEXT_SEL).forEach(function (el) { paint(el, textPad, WALL); });
    return function (x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return FREE;
      return grid[Math.floor(y / CB) * cols + Math.floor(x / CB)];
    };
  }
  // Build after web fonts have settled, so obstacle boxes match the final layout.
  function whenLayoutReady(fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    function afterFonts() {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
      else go();
    }
    if (document.readyState === 'complete') afterFonts();
    else window.addEventListener('load', afterFonts);
    setTimeout(go, 2500);
  }

  function growMycelium(o, rand) {
    var CELL = 6, grid = new Map(), hyphae = [], tips = [], marks = [], step = 0;
    var speed = o.speed || [3.2, 2.8, 2.5, 2.2, 2];
    var maxGen = o.maxGen == null ? 4 : o.maxGen;
    var bounds = o.bounds, terrain = o.terrain;
    var climbP = o.climb == null ? 0.6 : o.climb, arrestP = o.arrest == null ? 0.2 : o.arrest;

    function cellKey(cx, cy) { return (cx + 4096) * 16384 + (cy + 4096); }
    function addPoint(x, y, id) {
      var k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL)), c = grid.get(k);
      if (!c) grid.set(k, (c = []));
      c.push(x, y, id);
      if (o.world) o.world.add(x, y, o.colId, hyphae[id]);
    }
    function density(x, y) {
      var c = grid.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
      return c ? c.length / 3 : 0;
    }
    function fusionTarget(x, y, r, self, parent) {
      var cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), r2 = r * r;
      for (var i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          var c = grid.get(cellKey(cx + i, cy + j));
          if (!c) continue;
          for (var m = 0; m < c.length; m += 3) {
            var id = c[m + 2];
            if (id === self || id === parent || hyphae[id].parent === self) continue;
            var dx = c[m] - x, dy = c[m + 1] - y;
            if (dx * dx + dy * dy < r2) return [c[m], c[m + 1]];
          }
        }
      }
      return null;
    }
    function lifeFor(gen, parentLife) {
      var L = o.lifeByGen && o.lifeByGen[gen];
      if (L) return L[0] + rand() * (L[1] - L[0]);
      return parentLife * (o.branchLife[0] + rand() * (o.branchLife[1] - o.branchLife[0]));
    }
    function nextBranch(gen) {
      return (o.branchEvery[0] + rand() * (o.branchEvery[1] - o.branchEvery[0])) * (1 + 0.35 * gen);
    }
    function newHypha(x, y, gen, parent, on, start) {
      var hy = { pts: [x, y], start: start, gen: gen, parent: parent, on: on };
      hyphae.push(hy);
      return hy;
    }
    function sprout(x, y, a, life, gen, parent, ox, oy) {
      var id = hyphae.length, on = !!terrain && terrain(x, y) === SURFACE;
      var t = { x: x, y: y, a: a, life: life, gen: gen, id: id, ox: ox, oy: oy, on: on,
                hy: newHypha(x, y, gen, parent, on, step),
                side: rand() < 0.5 ? -1 : 1, since: 0, next: nextBranch(gen),
                track: 0, mem: null, pause: 0, edge: 0,
                stay: on ? Math.floor((o.stayOn || 0) * (0.5 + rand())) : 0 };
      tips.push(t);
      addPoint(x, y, id);
      return t;
    }
    // The same tip carries on as a new segment after climbing onto, or stepping off, a block.
    function resegment(t, on) {
      var id = hyphae.length;
      t.hy.cont = true;
      t.hy = newHypha(t.x, t.y, t.gen, t.id, on, step - 1);
      t.id = id;
      t.on = on;
    }
    // Text and photos always obstruct. A block's edge obstructs a tip that has decided not to climb
    // it, and, for a while after climbing, the drop off the block holds a tip on its surface.
    function solid(t, x, y) {
      var c = terrain(x, y);
      return c === WALL || (c === SURFACE && !t.on && t.edge > 0) || (c === FREE && t.on && t.stay > 0);
    }
    // Smallest turn (radians) to one side that gives a free step, or Infinity.
    function freeTurn(t, s, v) {
      for (var k = 1; k <= 8; k++) {
        var a2 = t.a + s * k * 0.22;
        if (!solid(t, t.x + Math.cos(a2) * v, t.y + Math.sin(a2) * v)) return k * 0.22;
      }
      return Infinity;
    }
    // Swellings and attachment rings: only on the coarser hyphae, and never crowded together.
    var markCells = new Map();
    function mark(t, kind) {
      if (t.gen > 1 || rand() > 0.6) return;
      var gx = Math.floor(t.x / 18), gy = Math.floor(t.y / 18);
      for (var mi = -1; mi <= 1; mi++) {
        for (var mj = -1; mj <= 1; mj++) if (markCells.has((gx + mi) * 100003 + gy + mj)) return;
      }
      markCells.set(gx * 100003 + gy, true);
      marks.push({ x: t.x, y: t.y, s: step, kind: kind, gen: t.gen });
    }

    o.origins.forEach(function (src) {
      src.angles.forEach(function (a) {
        sprout(src.x, src.y, a, src.life * (0.8 + 0.4 * rand()), 0, -1, src.x, src.y);
      });
    });

    // Meeting other individuals (other colonies of the same community), as wood-decay fungi do:
    // - antagonism at a distance: a tip that senses another mycelium just ahead slows, turns away and
    //   branches more, so the front becomes a dense band of short, pigmented hyphae, with a narrow
    //   uncolonised gap between the two;
    // - deadlock: a tip that touches the other mycelium stops (different individuals don't fuse);
    // - replacement: a markedly more combative mycelium (the cord-formers) closes in as thick,
    //   invasive cords and carries on over the other, whose hyphae lyse soon after it passes.
    var LOOK = [[6, 0], [12, 0], [9, -0.6], [9, 0.6]];   // [distance, bearing] of the points a tip senses
    function sense(t) {
      for (var q = 0; q < LOOK.length; q++) {
        var la2 = t.a + LOOK[q][1], f = o.world.foreign(t.x + Math.cos(la2) * LOOK[q][0], t.y + Math.sin(la2) * LOOK[q][0], o.colId);
        if (f) return { side: LOOK[q][1] > 0 ? 1 : LOOK[q][1] < 0 ? -1 : 0, col: f[2] };
      }
      return null;
    }
    function stronger(col) { return (o.combat || 0) - o.world.combat[col] >= 0.3; }
    // From here on the tip's hypha has a changed structure ('pig': pigmented, 'inv': invasive cord).
    function restructure(t, kind) {
      if (t.hy[kind]) return;
      if (t.hy.pts.length >= 6) resegment(t, t.on);
      t.hy[kind] = true;
    }

    function stepOnce() {
      step++;
      for (var i = tips.length - 1; i >= 0; i--) {
        var t = tips[i];
        var guided = terrain && !(o.exempt && o.exempt(t));
        if (guided && t.pause > 0) { t.pause--; continue; }   // resting at a block's edge before climbing
        var v = speed[Math.min(t.gen, speed.length - 1)] * (t.on ? (o.surfaceSpeed || 0.85) : 1);
        var da = gauss(rand) * (t.gen === 0 ? o.noise : (o.noiseBranch || o.noise));
        if (o.radial) {
          var rx = t.x - t.ox, ry = t.y - t.oy;
          if (rx * rx + ry * ry > 36) da += angDiff(Math.atan2(ry, rx), t.a) * o.radial * (t.gen ? 0.5 : 1);
        }
        if (o.avoid) {
          var la = t.a - 0.6, ra = t.a + 0.6;
          var dl0 = density(t.x + Math.cos(la) * 9, t.y + Math.sin(la) * 9);
          var dr0 = density(t.x + Math.cos(ra) * 9, t.y + Math.sin(ra) * 9);
          da += Math.max(-0.3, Math.min(0.3, (dl0 - dr0) * o.avoid));
        }
        if (o.steer) da += o.steer(t);
        if (guided) {
          if (t.edge > 0) t.edge--;
          if (t.stay > 0) t.stay--;
          if (t.track) {
            // Contact-guided growth: keep feeling for the obstruction on the tracked side.
            var fa = t.a + t.track * 1.15, fd = v + 3;
            if (solid(t, t.x + Math.cos(fa) * fd, t.y + Math.sin(fa) * fd)) {
              da += t.track * 0.05;
              if (t.edge > 0 && rand() < 0.035) t.edge = 0;   // a tip following a block's edge may still climb on
            } else {
              // Lost contact. If the wall carries on just ahead this is an opening: the tip keeps going
              // and a daughter branches into the gap. Otherwise the tip is past the obstruction.
              var resumes = false;
              for (var q = 8; q <= 24 && !resumes; q += 8) {
                resumes = solid(t, t.x + Math.cos(t.a) * q + Math.cos(fa) * fd, t.y + Math.sin(t.a) * q + Math.sin(fa) * fd);
              }
              if (resumes) {
                if (!(t.gapCool > 0) && t.gen < maxGen && hyphae.length < o.maxHyphae && rand() < 0.5) {
                  sprout(t.x, t.y, t.a + t.track * 1.1, Math.max(5, t.life * 0.6), t.gen + 1, t.id, t.ox, t.oy);
                  t.gapCool = 12;
                }
              } else {
                t.track = 0;
              }
            }
          }
          if (t.gapCool > 0) t.gapCool--;
          if (!t.track && t.mem != null) {
            // Directional memory: swing back to the heading held before the obstruction.
            var back = angDiff(t.mem, t.a);
            da += Math.max(-0.14, Math.min(0.14, back));
            if (Math.abs(back) < 0.1) t.mem = null;
          }
        }
        if (o.world && !t.inv) {
          var near = sense(t);
          if (near && !stronger(near.col)) {
            v *= 0.55;
            if (!t.dodge) t.dodge = rand() < 0.5 ? 1 : -1;
            da -= (near.side || t.dodge) * 0.3;   // turn away from the other mycelium
            t.front = 8;
            restructure(t, 'pig');
          } else if (near && t.gen <= 1) {
            restructure(t, 'inv');   // aggregating into an invasive cord as it closes in
          }
        }
        if (t.front > 0 && --t.front === 0 && t.hy.pig && t.hy.pts.length >= 6) resegment(t, t.on);   // clear of the front again
        t.a += da;
        var nx = t.x + Math.cos(t.a) * v, ny = t.y + Math.sin(t.a) * v;
        if (guided) {
          var cell = terrain(nx, ny);
          if (cell === SURFACE && !t.on && t.edge <= 0) {
            // At the edge of a block most tips pause, attach and climb on; the rest follow the edge.
            if (rand() < climbP) {
              mark(t, 'attach');
              resegment(t, true);
              t.track = 0;
              t.pause = 2 + Math.floor(rand() * 4);
              t.stay = 12 + Math.floor(rand() * 20);
              continue;
            }
            t.edge = 10 + Math.floor(rand() * 30);
          } else if (t.on && cell === FREE && t.stay <= 0) {
            resegment(t, false);   // stepping off a block; it will not climb straight back on
            t.edge = 18 + Math.floor(rand() * 25);
          }
          if (solid(t, nx, ny)) {
            // Obstruction. A first contact with text or a photo swells the tip, sometimes arrests it,
            // and often sends a daughter tip along the wall the other way (collision-induced branching).
            var hard = terrain(nx, ny) === WALL, fresh = !t.track;
            var dl = freeTurn(t, -1, v), dr = freeTurn(t, 1, v);
            var headOn = Math.min(dl, dr) > 0.95;
            if (hard && fresh) mark(t, 'contact');
            if (!isFinite(dl) && !isFinite(dr)) { tips.splice(i, 1); continue; }
            if (hard && fresh && headOn && rand() < arrestP) { tips.splice(i, 1); continue; }
            var side = dl < dr ? -1 : dr < dl ? 1 : (rand() < 0.5 ? -1 : 1);
            var turn = side < 0 ? dl : dr, other = side < 0 ? dr : dl;
            if (t.mem == null) t.mem = t.a;
            // Near-orthogonal contact splits the tip into two equivalent tips running opposite ways along
            // the wall; a glancing contact on a coarse hypha occasionally sets off a finer branch.
            var splitP = headOn ? (t.gen <= 1 ? 0.6 : 0.25) : (t.gen <= 1 ? 0.1 : 0);
            if (fresh && isFinite(other) && (headOn || t.gen < maxGen) && hyphae.length < o.maxHyphae && rand() < splitP) {
              var dau = sprout(t.x, t.y, t.a - side * other, Math.max(5, headOn ? t.life : t.life * 0.75),
                               headOn ? t.gen : t.gen + 1, t.id, t.ox, t.oy);
              dau.mem = t.mem;
              dau.track = side;
              dau.edge = t.edge;
              dau.stay = t.stay;
            }
            t.a += side * turn;
            t.track = -side;   // the wall is on the side the tip turned away from
            nx = t.x + Math.cos(t.a) * v;
            ny = t.y + Math.sin(t.a) * v;
          }
        }
        if (o.world) {
          var foe = o.world.foreign(nx, ny, o.colId);
          if (foe) {
            if (!stronger(foe[2]) || rand() < 0.15) { tips.splice(i, 1); continue; }   // deadlock: the tip stops
            o.world.lyse(nx, ny, foe[2], step + 16);   // replacement: the overgrown hyphae break down
            t.inv = true;
            if (t.gen <= 1) restructure(t, 'inv');
          }
        }
        t.x = nx;
        t.y = ny;
        if (t.gen === 0 && o.clampY) t.y = Math.max(o.clampY[0], Math.min(o.clampY[1], t.y));
        var P = t.hy.pts;
        P.push(t.x, t.y);
        addPoint(t.x, t.y, t.id);
        t.life--;
        t.since += v;
        var n = P.length / 2;

        // Anastomosis: a branch that meets another hypha joins it and stops.
        if (o.fuse && t.gen >= 1 && n > 8) {
          var hit = fusionTarget(t.x, t.y, o.fuse, t.id, t.hy.parent);
          if (hit && rand() < o.fuseP) { P.push(hit[0], hit[1]); tips.splice(i, 1); continue; }
        }

        // Subapical branching: a new tip emerges a few steps behind this one (more often on a block).
        var bs = o.branchScale ? o.branchScale(t) : 1;
        var bw = bs * (t.on ? (o.surfaceBranch || 1) : 1) * (t.front > 0 ? 2.6 : 1);   // proliferating at a front
        if (t.since * bw >= t.next && t.gen < maxGen && hyphae.length < o.maxHyphae && n > 3) {
          var lag = Math.min(o.lag || 4, n - 2), bi = (n - 1 - lag) * 2;
          var pa = Math.atan2(P[bi + 3] - P[bi + 1], P[bi + 2] - P[bi]);
          if (rand() < (o.alternate == null ? 0.75 : o.alternate)) t.side = -t.side;
          var ba = pa + t.side * (o.branchAngle[0] + rand() * (o.branchAngle[1] - o.branchAngle[0]));
          var bl = lifeFor(t.gen + 1, t.life) * (o.branchScale ? 0.35 + 0.65 * bs : 1) * (t.front > 0 ? 0.35 : 1);
          if (bl >= 3) {
            var nb = sprout(P[bi], P[bi + 1], ba, bl, t.gen + 1, t.id, t.ox, t.oy);
            if (t.front > 0) { nb.hy.pig = true; nb.front = 6; }   // short, pigmented branches at the front
          }
          t.since = 0;
          t.next = nextBranch(t.gen);
        }

        if (t.life <= 0 || t.x < bounds[0] || t.x > bounds[2] || t.y < bounds[1] || t.y > bounds[3]) tips.splice(i, 1);
      }
    }

    function finish() {
      var out = [];
      hyphae.forEach(function (h) {
        h.len = h.pts.length / 2 - 1;
        if (h.len < 1) return;
        // Round off kinks so bends read as growth rather than steps (the endpoints stay put).
        for (var pass = 0; pass < 2 && h.len >= 2; pass++) {
          var A = h.pts, B = A.slice();
          for (var k = 1; k < h.len; k++) {
            B[2 * k] = 0.25 * A[2 * k - 2] + 0.5 * A[2 * k] + 0.25 * A[2 * k + 2];
            B[2 * k + 1] = 0.25 * A[2 * k - 1] + 0.5 * A[2 * k + 1] + 0.25 * A[2 * k + 3];
          }
          h.pts = B;
        }
        out.push(h);
      });
      return { hyphae: out, marks: marks, maxStep: step, lastP: -1, morph: o.morph };
    }
    function alive() { return tips.length > 0 && step < (o.maxSteps || 600); }
    // In a community the colonies are stepped together on one clock (see growCommunity).
    if (o.world) return { stepOnce: stepOnce, alive: alive, finish: finish };
    while (alive()) stepOnce();
    return finish();
  }

  // Occupancy shared by the colonies of a community: per 4 px cell, a point and the hyphae of each
  // colony there.
  function makeWorld() {
    var cells = new Map();
    function key(cx, cy) { return (cx + 4096) * 16384 + (cy + 4096); }
    return {
      combat: [],
      add: function (x, y, col, hy) {
        var k = key(Math.floor(x / 4), Math.floor(y / 4)), c = cells.get(k), e = null;
        if (!c) cells.set(k, (c = []));
        for (var m = 0; m < c.length; m++) if (c[m].col === col) { e = c[m]; break; }
        if (!e) c.push(e = { x: x, y: y, col: col, hys: [] });
        if (hy && e.hys[e.hys.length - 1] !== hy) e.hys.push(hy);
      },
      foreign: function (x, y, col) {
        var c = cells.get(key(Math.floor(x / 4), Math.floor(y / 4)));
        if (c) for (var m = 0; m < c.length; m++) if (c[m].col !== col) return [c[m].x, c[m].y, c[m].col];
        return null;
      },
      // Hyphae of colony col around (x, y) break down from step s.
      lyse: function (x, y, col, s) {
        var cx = Math.floor(x / 4), cy = Math.floor(y / 4);
        for (var i = -2; i <= 2; i++) {
          for (var j = -2; j <= 2; j++) {
            var c = cells.get(key(cx + i, cy + j));
            if (!c) continue;
            for (var m = 0; m < c.length; m++) {
              if (c[m].col === col) c[m].hys.forEach(function (hy) { if (!(hy.lyse <= s)) hy.lyse = s; });
            }
          }
        }
      }
    };
  }
  // Several colonies grown together on one clock, so that each meets the others where they actually
  // meet. Every colony gets the community's step count, so the same scroll position shows the same
  // moment of growth for all of them.
  function growCommunity(list, rand) {
    var world = makeWorld();
    var sims = list.map(function (o, k) {
      o.world = world;
      o.colId = k;
      world.combat[k] = o.combat || 0;
      return growMycelium(o, rand);
    });
    var steps = 0, live = true;
    while (live) {
      live = false;
      for (var k = 0; k < sims.length; k++) if (sims[k].alive()) { sims[k].stepOnce(); live = true; }
      if (live) steps++;
    }
    return sims.map(function (sim) { var r = sim.finish(); r.maxStep = Math.max(1, steps); return r; });
  }

  // Growth forms, so that neighbouring colonies differ as different species do:
  // - cord: a few straight, thick leading hyphae with sparse branches, and combative;
  // - dense: slow, compact and much branched, and weak in combat;
  // - fan: feathery, near-parallel strands from narrow-angled branching.
  // Unlisted colonies keep the default effuse form.
  var MORPHS = {
    cord: { speed: 1.15, noise: 0.55, every: 1.7, angle: [0.45, 0.9], hyphae: 0.55, fuse: 3, combat: 0.65 },
    dense: { speed: 0.75, noise: 1.25, every: 0.5, angle: [0.9, 1.5], hyphae: 1.25, life: 0.7, combat: 0.15 },
    fan: { speed: 1, noise: 0.35, every: 0.9, angle: [0.25, 0.55], alternate: 0.95, hyphae: 0.9, combat: 0.3 }
  };
  var MORPH_KEYS = ['effuse', 'cord', 'dense', 'fan'];
  function withMorph(o, morph) {
    var m = MORPHS[morph];
    o.morph = morph;
    o.combat = m ? m.combat : 0.35;
    if (!m) return o;
    o.speed = o.speed.map(function (v) { return v * m.speed; });
    o.noise *= m.noise;
    if (o.noiseBranch) o.noiseBranch *= m.noise;
    o.branchEvery = [o.branchEvery[0] * m.every, o.branchEvery[1] * m.every];
    o.branchAngle = m.angle;
    o.maxHyphae = Math.round(o.maxHyphae * m.hyphae);
    if (m.fuse) o.fuse = m.fuse;
    if (m.alternate) o.alternate = m.alternate;
    if (m.life) o.origins.forEach(function (src) { src.life *= m.life; });
    return o;
  }

  /* ---------- Hero: colonies that grow on load and keep growing as you scroll away ---------- */
  var canvas = document.querySelector('.hyphae');
  var HERO_STYLE = [[1.5, 0.56], [1.05, 0.46], [0.8, 0.38], [0.62, 0.31]];   // [width, alpha] by branch order
  var HERO_NODULE = [2, 1.6, 1.3, 1.1];   // nodule radius at hyphal ends, by branch order
  var HERO_CONTACT = [2.4, 2, 1.7, 1.4];  // swelling where a tip touches text or the portrait
  var LOAD_SHARE = 0.6;   // share of growth shown on load; scrolling grows the rest
  var hero = { model: null, buckets: null, w: 0, h: 0, drawn: 0, target: 0, queued: false, ctx: null };

  function buildHero(w, h) {
    var rand = seeded(7), narrow = w < 860, origins = [];
    var cr = canvas.getBoundingClientRect();
    var terrain = makeTerrain(cr.left, cr.top, w, h, canvas.parentElement, false, narrow ? 4 : 6);
    var n = narrow ? 2 : 4;
    for (var i = 0; i < n; i++) {
      var k = narrow ? 6 : 7, angles = [], a0 = rand() * Math.PI * 2, x, y, tries = 0;
      for (var j = 0; j < k; j++) angles.push(a0 + (j / k) * Math.PI * 2 + (rand() - 0.5) * 0.5);
      do {
        x = w * (narrow ? 0.62 + rand() * 0.36 : 0.6 + rand() * 0.38);
        y = h * (narrow ? 0.04 + rand() * 0.4 : 0.06 + rand() * 0.88);
      } while (terrain(x, y) !== FREE && ++tries < 40);
      if (terrain(x, y) !== FREE) continue;
      origins.push({ x: x, y: y, angles: angles, life: (narrow ? 55 : 90) + rand() * 40 });
    }
    // Each origin is a separate individual with its own growth form; where they meet they avoid each
    // other, deadlock at a pigmented front or, for a combative cord-former, overgrow the other.
    var grown = growCommunity(origins.map(function (src, k) {
      return withMorph({
        origins: [src], speed: [3, 2.7, 2.4, 2.1], noise: 0.08, noiseBranch: 0.12, radial: 0.03, avoid: 0.05,
        branchEvery: [10, 34], branchAngle: [0.8, 1.45], branchLife: [0.35, 0.85], maxGen: 3,
        maxHyphae: Math.round((narrow ? 260 : 560) / Math.max(1, origins.length)) + 20, fuse: 2.2, fuseP: 0.45,
        terrain: terrain, arrest: 0.1, bounds: [-20, -20, w + 20, h + 20], maxSteps: 400
      }, MORPH_KEYS[k % MORPH_KEYS.length]);
    }), rand);
    var model = { hyphae: [], marks: [], maxStep: grown.length ? grown[0].maxStep : 1 };
    grown.forEach(function (c) {
      var mi = Math.max(0, MORPH_KEYS.indexOf(c.morph));
      c.hyphae.forEach(function (hy) { hy.mi = mi; model.hyphae.push(hy); });
      c.marks.forEach(function (mk) { mk.mi = mi; model.marks.push(mk); });
    });
    return model;
  }

  // Segments grouped by the step they are laid down on, then by growth form and branch order
  // (key = form * 4 + order; form 4 is pigmented hyphae at an interaction front). Nodules by form.
  var HERO_WIDTH = [1, 1.35, 0.78, 1, 0.85];   // line width factor for effuse, cord, dense, fan and pigmented
  function dotsOf(b, mi) { var d = b.dots || (b.dots = []); return d[mi] || (d[mi] = []); }
  function bucketize(model) {
    var buckets = [];
    model.hyphae.forEach(function (hy) {
      var g = Math.min(hy.gen, HERO_STYLE.length - 1), mi = hy.pig ? 4 : (hy.mi || 0);
      if (hy.inv) { mi = 1; g = 0; }   // invasive cords: heavy
      var P = hy.pts, key = mi * 4 + g;
      for (var k = 0; k < hy.len; k++) {
        var s = hy.start + k + 1, b = buckets[s] || (buckets[s] = []);
        (b[key] || (b[key] = [])).push(P[2 * k], P[2 * k + 1], P[2 * k + 2], P[2 * k + 3]);
      }
      if (hy.cont) return;   // the tip carried on as another segment: no nodule here
      var e = hy.start + hy.len, be = buckets[e] || (buckets[e] = []);
      dotsOf(be, hy.mi || 0).push(P[P.length - 2], P[P.length - 1], HERO_NODULE[g]);
    });
    (model.marks || []).forEach(function (mk) {
      var b = buckets[mk.s] || (buckets[mk.s] = []);
      dotsOf(b, mk.mi || 0).push(mk.x, mk.y, HERO_CONTACT[Math.min(mk.gen, HERO_CONTACT.length - 1)]);
    });
    return buckets;
  }

  function heroLayout() {
    if (!canvas || !canvas.getContext) return false;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    if (!hero.model || Math.abs(w - hero.w) > 1 || Math.abs(h - hero.h) > 1) {
      var frac = hero.model ? hero.drawn / hero.model.maxStep : 0;
      hero.model = buildHero(w, h);
      hero.buckets = bucketize(hero.model);
      hero.w = w;
      hero.h = h;
      hero.drawn = Math.round(frac * hero.model.maxStep);
    }
    var css = getComputedStyle(root);
    hero.rgbs = ['--hyphae', '--hyphae-cord', '--hyphae-dense', '--hyphae-fan', '--pigment'].map(function (v) {
      return css.getPropertyValue(v).trim() || '47, 107, 79';
    });
    hero.ctx = ctx;
    return true;
  }

  function heroPaint(from, to) {
    var ctx = hero.ctx;
    for (var s = from; s <= to; s++) {
      var b = hero.buckets[s];
      if (!b) continue;
      for (var key = 0; key < b.length; key++) {
        var seg = b[key];
        if (!seg) continue;
        var g = key & 3, mi = key >> 2;
        ctx.strokeStyle = 'rgba(' + hero.rgbs[mi] + ',' + HERO_STYLE[g][1] + ')';
        ctx.lineWidth = HERO_STYLE[g][0] * HERO_WIDTH[mi];
        ctx.beginPath();
        for (var q = 0; q < seg.length; q += 4) { ctx.moveTo(seg[q], seg[q + 1]); ctx.lineTo(seg[q + 2], seg[q + 3]); }
        ctx.stroke();
      }
      if (b.dots) {
        for (var di = 0; di < b.dots.length; di++) {
          var dots = b.dots[di];
          if (!dots) continue;
          ctx.fillStyle = 'rgba(' + hero.rgbs[di] + ',0.5)';
          ctx.beginPath();
          for (var m = 0; m < dots.length; m += 3) {
            ctx.moveTo(dots[m] + dots[m + 2], dots[m + 1]);
            ctx.arc(dots[m], dots[m + 1], dots[m + 2], 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }

    }
  }

  // Full repaint at the current growth (first paint, resize, theme change).
  function drawHyphae() {
    if (!heroLayout()) return;
    hero.ctx.clearRect(0, 0, hero.w, hero.h);
    heroPaint(1, hero.drawn);
  }
  function heroGrow() {
    hero.queued = false;
    if (!hero.ctx || !hero.model) return;
    var to = Math.round(hero.target * hero.model.maxStep);
    if (to > hero.drawn) { heroPaint(hero.drawn + 1, to); hero.drawn = to; }
  }
  function heroTarget(f) {
    if (f <= hero.target) return;
    hero.target = Math.min(1, f);
    if (!hero.queued) { hero.queued = true; requestAnimationFrame(heroGrow); }
  }

  whenLayoutReady(function () {
    drawHyphae();
    heroGrow();
    if (reduceMotion) { heroTarget(1); return; }
    var heroT0 = performance.now();
    requestAnimationFrame(function intro(now) {
      var k = clamp01((now - heroT0) / 3400);
      heroTarget(LOAD_SHARE * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(intro);
    });
  });
  var heroSection = canvas ? canvas.parentElement : null;
  window.addEventListener('scroll', function () {
    if (!heroSection || reduceMotion) return;
    var hh = heroSection.offsetHeight || 1;
    heroTarget(LOAD_SHARE + (1 - LOAD_SHARE) * clamp01(window.scrollY / (hh * 1.2)));
  }, { passive: true });

  var heroW = canvas ? canvas.clientWidth : 0, heroH = canvas ? canvas.clientHeight : 0, heroTimer;
  function heroMaybeResize() {
    clearTimeout(heroTimer);
    heroTimer = setTimeout(function () {
      if (!canvas) return;
      // Ignore small height-only changes (mobile address bar).
      if (canvas.clientWidth !== heroW || Math.abs(canvas.clientHeight - heroH) > 80) {
        heroW = canvas.clientWidth;
        heroH = canvas.clientHeight;
        drawHyphae();
      }
    }, 150);
  }
  window.addEventListener('resize', heroMaybeResize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(heroMaybeResize);

  /* ---------- Scroll-linked figure animations ----------
     Small figures that play out as they scroll into view, each demonstrating a method: radial growth
     under water stress, fitting a thermal performance curve, lichens across survey stands and
     aggregating point data to H3 hexagons. On the thesis page the key numbers count up and the
     thesis figures are revealed left to right. */
  var figAnims = [];
  function addFigAnim(el, update, start, end) {
    figAnims.push({ el: el, update: update, start: start || 0.95, end: end || 0.35, last: -1 });
  }
  function updateFigAnims() {
    var vh = window.innerHeight;
    var atEnd = window.scrollY >= document.documentElement.scrollHeight - vh - 2;
    figAnims.forEach(function (a) {
      var r = a.el.getBoundingClientRect();
      var p = (reduceMotion || atEnd) ? 1 : clamp01((vh * a.start - r.top) / (vh * (a.start - a.end)));
      if (Math.abs(p - a.last) < 0.002) return;
      a.last = p;
      a.update(p);
    });
  }
  var figQueued = false;
  function requestFigs() {
    if (figQueued) return;
    figQueued = true;
    requestAnimationFrame(function () { figQueued = false; updateFigAnims(); });
  }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }   // progress of p within [a, b]
  function r1(v) { return Math.round(v * 10) / 10; }
  function ctmi(T, tmin, topt, tmax) {
    if (T <= tmin || T >= tmax) return 0;
    var num = (T - tmax) * Math.pow(T - tmin, 2);
    var den = (topt - tmin) * ((topt - tmin) * (T - topt) - (topt - tmax) * (topt + tmin - 2 * T));
    return Math.max(0, num / den);
  }

  // Water-potential assay: colonies grow day by day on three plates, from control to high water
  // stress, and each day's colony margin is marked along four axes in a new colour.
  document.querySelectorAll('[data-anim="assay"]').forEach(function (svg) {
    var DAYS = 7, cy = 60, R = 40, cols = ['k0', 'k1', 'k2', 'k3'];
    var axes = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];   // a cross drawn on the plate, as in the lab
    var dishes = [
      { cx: 58, rate: 4.6, lag: 0, label: 'Control' },          // radial growth slows as water potential falls
      { cx: 150, rate: 2.9, lag: 0, label: 'Moderate stress' },
      { cx: 242, rate: 1.4, lag: 0, label: 'High stress' }
    ];
    function radius(d, day) { return Math.max(0, Math.min(R - 5, d.rate * (day - d.lag))); }
    var out = '<text class="day" x="6" y="12">Day 0</text>' +
              '<text class="note" x="294" y="12" text-anchor="end">Daily margin marks</text>';
    dishes.forEach(function (d, i) {
      out += '<circle class="dish" cx="' + d.cx + '" cy="' + cy + '" r="' + R + '"/>';
      axes.forEach(function (a) {
        out += '<line class="axis" x1="' + d.cx + '" y1="' + cy + '" x2="' + r1(d.cx + Math.cos(a) * (R - 2)) +
               '" y2="' + r1(cy + Math.sin(a) * (R - 2)) + '"/>';
      });
      out += '<circle class="fringe" data-i="' + i + '" cx="' + d.cx + '" cy="' + cy + '" r="0"/>' +
             '<circle class="colony" data-i="' + i + '" cx="' + d.cx + '" cy="' + cy + '" r="0"/>' +
             '<rect class="plug" x="' + (d.cx - 3.5) + '" y="' + (cy - 3.5) + '" width="7" height="7" rx="1.2"/>';
      for (var day = 1; day <= DAYS; day++) {
        var rd = radius(d, day);
        if (rd < 4.5) continue;   // no measurable growth yet that day
        axes.forEach(function (a) {
          var x = d.cx + Math.cos(a) * rd, y = cy + Math.sin(a) * rd, px = -Math.sin(a) * 3.2, py = Math.cos(a) * 3.2;
          out += '<line class="tick ' + cols[(day - 1) % cols.length] + '" data-day="' + day + '" x1="' + r1(x - px) +
                 '" y1="' + r1(y - py) + '" x2="' + r1(x + px) + '" y2="' + r1(y + py) + '" style="visibility:hidden"/>';
        });
      }
      out += '<text class="lab" x="' + d.cx + '" y="' + (cy + R + 14) + '" text-anchor="middle">' + d.label + '</text>';
    });
    svg.innerHTML = out;
    var dayText = svg.querySelector('.day');
    var colonies = svg.querySelectorAll('.colony'), fringes = svg.querySelectorAll('.fringe');
    var ticks = [].map.call(svg.querySelectorAll('.tick'), function (el) { return { el: el, day: +el.getAttribute('data-day'), vis: false }; });
    addFigAnim(svg, function (p) {
      var D = p * DAYS;
      dayText.textContent = 'Day ' + Math.min(DAYS, Math.floor(D + 1e-6));
      dishes.forEach(function (d, i) {
        var r = radius(d, D);
        colonies[i].setAttribute('r', r1(r));
        fringes[i].setAttribute('r', r > 1 ? r1(r + 2.5) : 0);
      });
      ticks.forEach(function (t) {
        var show = D >= t.day;
        if (show !== t.vis) { t.vis = show; t.el.style.visibility = show ? 'visible' : 'hidden'; }
      });
    });
  });

  // Thermal performance: replicate growth rates appear at nine temperatures, the cardinal
  // temperature model is fitted through them and its cardinal temperatures are marked.
  document.querySelectorAll('[data-anim="fit"]').forEach(function (svg) {
    var x0 = 32, x1 = 290, yb = 106, yt = 20, T0 = -5, T1 = 40;
    function X(T) { return x0 + (T - T0) / (T1 - T0) * (x1 - x0); }
    function Y(v) { return yb - v * (yb - yt); }
    var m = { tmin: -3, topt: 24, tmax: 34, mu: 0.95 }, rand = seeded(17), temps = [], i;
    for (i = 0; i < 9; i++) temps.push(0.9 + i * (40 - 0.9) / 8);
    function curve(p) {
      var d = '';
      for (var T = T0; T <= T1 + 0.01; T += 0.5) d += (d ? ' L' : 'M') + r1(X(T)) + ' ' + r1(Y(ctmi(T, p.tmin, p.topt, p.tmax) * p.mu));
      return d;
    }
    var out = '<line class="axis" x1="' + x0 + '" y1="' + yb + '" x2="' + x1 + '" y2="' + yb + '"/>' +
              '<line class="axis" x1="' + x0 + '" y1="' + (yt - 6) + '" x2="' + x0 + '" y2="' + yb + '"/>' +
              '<text class="lab" x="' + X(0) + '" y="' + (yb + 12) + '" text-anchor="middle">0</text>' +
              '<text class="lab" x="' + X(20) + '" y="' + (yb + 12) + '" text-anchor="middle">20</text>' +
              '<text class="lab" x="' + X(40) + '" y="' + (yb + 12) + '" text-anchor="end">40 °C</text>' +
              '<text class="lab" x="12" y="' + ((yt + yb) / 2) + '" text-anchor="middle" transform="rotate(-90 12 ' + ((yt + yb) / 2) + ')">Growth rate</text>';
    for (i = 0; i < 5; i++) {
      var o = { tmin: -5 + rand() * 5, topt: 19 + rand() * 9, tmax: 0, mu: 0.45 + rand() * 0.45 };
      o.tmax = o.topt + 7 + rand() * 6;
      out += '<path class="other" d="' + curve(o) + '" style="opacity:0"/>';
    }
    out += '<path class="fitline" pathLength="1" d="' + curve(m) + '" style="stroke-dasharray:1 2;stroke-dashoffset:1"/>';
    [['tmin', 'min'], ['topt', 'opt'], ['tmax', 'max']].forEach(function (c) {
      var x = r1(X(m[c[0]]));
      out += '<g class="card-mark" style="opacity:0"><line class="card" x1="' + x + '" y1="' + (yt - 6) + '" x2="' + x + '" y2="' + yb + '"/>' +
             '<text class="cardlab" x="' + x + '" y="' + (yt - 9) + '" text-anchor="middle">T<tspan font-size="6.5" dy="2">' + c[1] + '</tspan></text></g>';
    });
    temps.forEach(function (T, k) {
      for (var rep = 0; rep < 2; rep++) {
        var v = ctmi(T, m.tmin, m.topt, m.tmax) * m.mu;
        if (v > 0) v = Math.max(0.02, v + (rand() - 0.5) * 0.1);
        out += '<circle class="pt" data-k="' + k + '" cx="' + r1(X(T) + (rep ? 2 : -2)) + '" cy="' + r1(Y(v)) + '" r="2.6" style="visibility:hidden"/>';
      }
    });
    out += '<text class="many" x="' + (x1 - 2) + '" y="' + (yt + 42) + '" text-anchor="end" style="opacity:0">×141 isolates</text>';
    svg.innerHTML = out;
    var pts = [].map.call(svg.querySelectorAll('.pt'), function (el) { return { el: el, k: +el.getAttribute('data-k'), vis: false }; });
    var fit = svg.querySelector('.fitline'), marks = svg.querySelectorAll('.card-mark');
    var others = svg.querySelectorAll('.other'), many = svg.querySelector('.many');
    addFigAnim(svg, function (p) {
      pts.forEach(function (q) {
        var show = p >= 0.04 + q.k * 0.05;
        if (show !== q.vis) { q.vis = show; q.el.style.visibility = show ? 'visible' : 'hidden'; }
      });
      fit.style.strokeDashoffset = (1 - seg(p, 0.46, 0.78)).toFixed(3);
      [].forEach.call(marks, function (g, j) { g.style.opacity = seg(p, 0.78 + j * 0.04, 0.84 + j * 0.04).toFixed(2); });
      var o = seg(p, 0.9, 1);
      [].forEach.call(others, function (el) { el.style.opacity = (0.22 * o).toFixed(3); });
      many.style.opacity = o.toFixed(2);
    });
  });

  // Lichens colonise the bark as the survey counter runs through the 48 stands.
  document.querySelectorAll('[data-anim="lichen"]').forEach(function (svg) {
    var rand = seeded(11), out = '', groups = [];
    for (var bx = -8; bx < 310; bx += 15 + rand() * 11) {
      var d = 'M' + bx.toFixed(1) + ' -5';
      for (var y = 10; y <= 150; y += 15) d += ' L' + (bx + (rand() - 0.5) * 7).toFixed(1) + ' ' + y;
      out += '<path class="bark" d="' + d + '"/>';
    }
    for (var i = 0; i < 16; i++) {
      var cx = rand() * 300, cy = 12 + rand() * 116, r = 5 + rand() * 13, g = '';
      g += '<circle class="thallus" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '"/>';
      var lobes = 7 + Math.floor(rand() * 6);
      for (var k = 0; k < lobes; k++) {
        var a = (k / lobes) * Math.PI * 2 + rand() * 0.3;
        g += '<circle class="lobe" cx="' + (cx + Math.cos(a) * r).toFixed(1) + '" cy="' + (cy + Math.sin(a) * r).toFixed(1) + '" r="' + (r * 0.28).toFixed(1) + '"/>';
      }
      if (rand() < 0.6) {
        for (var mm = 0, n = 1 + Math.floor(rand() * 3); mm < n; mm++) {
          g += '<circle class="apo" cx="' + (cx + (rand() - 0.5) * r).toFixed(1) + '" cy="' + (cy + (rand() - 0.5) * r).toFixed(1) + '" r="' + (1.5 + rand() * 1.8).toFixed(1) + '"/>';
        }
      }
      groups.push({ cx: cx, cy: cy, html: g });
    }
    groups.sort(function (a, b) { return a.cx - b.cx; });
    groups.forEach(function (gr, j) {
      out += '<g class="lichen-g" data-j="' + j + '" transform="translate(' + gr.cx.toFixed(1) + ' ' + gr.cy.toFixed(1) +
             ') scale(0) translate(' + (-gr.cx).toFixed(1) + ' ' + (-gr.cy).toFixed(1) + ')">' + gr.html + '</g>';
    });
    out += '<rect class="pill" x="206" y="92" width="88" height="18" rx="9"/>' +
           '<text class="count" x="250" y="104.5" text-anchor="middle">1 / 48 stands</text>';
    svg.innerHTML = out;
    var els = svg.querySelectorAll('.lichen-g'), count = svg.querySelector('.count'), N = groups.length;
    addFigAnim(svg, function (p) {
      [].forEach.call(els, function (el, j) {
        var s = seg(p, 0.04 + 0.6 * j / N, 0.24 + 0.6 * j / N);
        s = 1 - Math.pow(1 - s, 2);
        var gr = groups[j];
        el.setAttribute('transform', 'translate(' + gr.cx.toFixed(1) + ' ' + gr.cy.toFixed(1) + ') scale(' + s.toFixed(3) +
                        ') translate(' + (-gr.cx).toFixed(1) + ' ' + (-gr.cy).toFixed(1) + ')');
      });
      count.textContent = Math.max(1, Math.round(seg(p, 0.04, 0.86) * 48)) + ' / 48 stands';
    });
  });

  // Wetland points appear, then are aggregated to H3-style hexagons shaded by how many fall in each.
  document.querySelectorAll('[data-anim="hex"]').forEach(function (svg) {
    var r = 12, hw = Math.sqrt(3) * r, vh = 1.5 * r, rand = seeded(21), hexes = [], pts = [], i;
    for (var row = -1; row * vh < 140 + r; row++) {
      for (var col = -1; col * hw < 300 + hw; col++) hexes.push({ x: col * hw + (Math.abs(row) % 2 ? hw / 2 : 0), y: row * vh, n: 0 });
    }
    var centres = [[70, 50], [150, 96], [236, 44], [262, 112]];
    for (i = 0; i < 110; i++) {
      var c = centres[Math.floor(rand() * centres.length)], x, y;
      if (rand() < 0.2) { x = 6 + rand() * 288; y = 6 + rand() * 128; }
      else { x = c[0] + gauss(rand) * 22; y = c[1] + gauss(rand) * 15; }
      x = Math.max(4, Math.min(296, x)); y = Math.max(4, Math.min(136, y));
      var best = null, bd = 1e9;
      hexes.forEach(function (h) { var dd = (h.x - x) * (h.x - x) + (h.y - y) * (h.y - y); if (dd < bd) { bd = dd; best = h; } });
      best.n++;
      pts.push({ x: x, y: y, k: rand() });
    }
    var maxN = hexes.reduce(function (mx, h) { return Math.max(mx, h.n); }, 1), out = '';
    hexes.forEach(function (h) {
      var p = [];
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 180 * (60 * k - 30);
        p.push(r1(h.x + r * 0.92 * Math.cos(a)) + ',' + r1(h.y + r * 0.92 * Math.sin(a)));
      }
      out += '<polygon points="' + p.join(' ') + '" style="fill-opacity:0;stroke-opacity:0"/>';
    });
    pts.forEach(function (q) { out += '<circle class="pt" cx="' + r1(q.x) + '" cy="' + r1(q.y) + '" r="1.7" style="opacity:0"/>'; });
    out += '<rect class="pill" x="6" y="92" width="122" height="18" rx="9" style="opacity:0"/>' +
           '<text class="count" x="67" y="104.5" text-anchor="middle" style="opacity:0">Wetlands → H3 cells</text>';
    svg.innerHTML = out;
    var polys = svg.querySelectorAll('polygon'), dots = svg.querySelectorAll('.pt');
    var pill = svg.querySelector('.pill'), label = svg.querySelector('.count');
    addFigAnim(svg, function (p) {
      [].forEach.call(dots, function (el, j) {
        var on = seg(p, 0.03 + 0.3 * pts[j].k, 0.08 + 0.3 * pts[j].k), fade = seg(p, 0.72, 0.95);
        el.style.opacity = (on * (0.85 - 0.6 * fade)).toFixed(2);
      });
      [].forEach.call(polys, function (el, j) {
        var h = hexes[j], s = seg(p, 0.38 + 0.25 * (h.x / 300), 0.55 + 0.25 * (h.x / 300));
        el.style.fillOpacity = ((0.05 + 0.72 * h.n / maxN) * s).toFixed(3);
        el.style.strokeOpacity = (0.6 * s).toFixed(2);
      });
      var l = seg(p, 0.8, 0.95);
      pill.style.opacity = (0.85 * l).toFixed(2);
      label.style.opacity = l.toFixed(2);
    });
  });

  // Thesis page: the thesis figures are revealed left to right as they come into view.
  document.querySelectorAll('.figure .plot').forEach(function (plot) {
    addFigAnim(plot, function (p) {
      var k = p * p * (3 - 2 * p);
      plot.style.clipPath = k >= 1 ? '' : 'inset(0 ' + ((1 - k) * 100).toFixed(1) + '% 0 0 round 14px)';
    }, 0.92, 0.5);
  });

  // Thesis page: the key numbers count up once they are in view.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.querySelectorAll('.stat b').forEach(function (b) {
      var txt = b.textContent, mt = txt.match(/[\d,]+(?:\.\d+)?/);
      if (!mt) return;
      var target = parseFloat(mt[0].replace(/,/g, '')), dec = (mt[0].split('.')[1] || '').length;
      var pre = txt.slice(0, mt.index), post = txt.slice(mt.index + mt[0].length);
      function fmt(v) {
        return pre + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
      }
      b.textContent = fmt(0);
      var seen = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        seen.disconnect();
        var t0 = performance.now();
        requestAnimationFrame(function tick(now) {
          var k = clamp01((now - t0) / 1400);
          b.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(tick);
        });
      }, { threshold: 0.6 });
      seen.observe(b);
    });
  }

  window.addEventListener('scroll', requestFigs, { passive: true });
  window.addEventListener('resize', requestFigs);
  requestFigs();

  /* ---------- Scroll-linked mycelium ----------
     Every .section gets an SVG network built with growMycelium(): a cord along its top edge
     (standing in for the divider line) whose side hyphae crowd the page edges, and colonies that
     hug both side edges. Each hypha is a path whose visible length follows the scroll position,
     eased so growth trails the scroll a little. Bright dots ride the growing tips and stay behind
     as nodules where hyphae end or fuse. A second cord under the header is a reading-progress bar. */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var RUNNER_ROOM = 64;   // the divider network may grow this far up into the previous section's padding
  var GROW_TAU = 450;     // ms; how long growth takes to catch up with the scroll position
  var HIDDEN = 'stroke-dasharray:1 2;stroke-dashoffset:1;visibility:hidden';
  var NODULE_R = [2.1, 1.7, 1.35, 1.1];

  /* ---------- Fruiting bodies ----------
     Small Mycena-like mushrooms on top of some cards: grey-brown, conical to bell-shaped caps with
     translucent striations, and slender stems with white fibrils at the base, in a small tuft. They
     develop from mycelium on the card: hyphal knots first, then pins (cap and stem separate), then the
     stems elongate and the caps expand. As in nature, only some primordia mature. */
  var FRUIT_HOST_SEL = '.card,.skill-group,.facts,.approach,.next-card,.callout,.contact-card';
  function makeTuft(bx, by, rand, scale) {
    var s = scale, n = 4 + Math.floor(rand() * 3), spots = [], i;
    for (i = 0; i < n; i++) spots.push((i - (n - 1) / 2) * (4.5 + rand() * 3) * s + (rand() - 0.5) * 3);
    spots.sort(function (a, b) { return Math.abs(a) - Math.abs(b); });   // the central primordia mature
    var nMature = 2 + (rand() < 0.5 ? 1 : 0), mush = [];
    spots.forEach(function (dx, k) {
      var fate = k < nMature ? 1 : k === nMature ? 0.42 : 0.14;   // mature, pin, or knot only
      var big = fate === 1;
      mush.push({
        x: bx + dx, y: by - 0.4, dmax: fate, start: rand() * 0.14, lastD: -1, seed: rand(),
        h: s * (big ? 15 + rand() * 7 : 8 + rand() * 2.5), cw: s * (big ? 8 + rand() * 3.5 : 4.5 + rand()),
        wb: s * (1.6 + rand() * 0.5), wt: s * (1 + rand() * 0.3),
        lean: dx / (16 * s) * 0.4 + (rand() - 0.5) * 0.14, bend: (rand() - 0.5) * 0.22
      });
    });
    mush.sort(function (a, b) { return b.h - a.h; });   // taller ones behind
    return { x: bx, y: by, mush: mush, kind: 'fruit', lastP: -1 };
  }
  function fruitDefs(id) {
    return '<linearGradient id="' + id + 'cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="cap-a"/>' +
           '<stop offset=".55" class="cap-b"/><stop offset="1" class="cap-c"/></linearGradient>' +
           '<linearGradient id="' + id + 'stem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="stem-a"/>' +
           '<stop offset="1" class="stem-b"/></linearGradient>' +
           '<linearGradient id="' + id + 'amcap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="am-cap-a"/>' +
           '<stop offset=".6" class="am-cap-b"/><stop offset="1" class="am-cap-c"/></linearGradient>' +
           '<linearGradient id="' + id + 'amstem" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="am-stem-a"/>' +
           '<stop offset="1" class="am-stem-b"/></linearGradient>' +
           '<radialGradient id="' + id + 'amsheen" cx=".34" cy=".2" r=".62"><stop offset="0" class="am-sheen-a"/>' +
           '<stop offset="1" class="am-sheen-b"/></radialGradient>' +
           '<linearGradient id="' + id + 'np" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="np-a"/>' +
           '<stop offset=".55" class="np-b"/><stop offset="1" class="np-c"/></linearGradient>';
  }
  function fruitMarkup(fruits, id) {
    var s = '';
    fruits.forEach(function (f) {
      if (f.markup) { s += f.markup(id); return; }   // plants draw themselves
      f.mush.forEach(function (m) {
        if (m.type === 'amanita') {
          s += '<g class="amanita"><path class="am-gills" d=""/><path class="am-gl" d=""/><path class="am-bulb" d=""/>' +
               '<path class="am-stem" fill="url(#' + id + 'amstem)" d=""/><path class="am-rings" d=""/>' +
               '<path class="am-veil" d=""/><path class="am-skirtl" d=""/>' +
               '<path class="am-cap" fill="url(#' + id + 'amcap)" d=""/>' +
               '<path class="am-sheen" fill="url(#' + id + 'amsheen)" d=""/><path class="am-warts" d=""/>' +
               '<path class="am-egg" d=""/></g>';
          return;
        }
        var fib = '';
        for (var k = 0; k < 6; k++) {
          var sg = k % 2 ? 1 : -1, len = 2.4 + ((k * 1.7 + m.seed * 5) % 3.2);
          fib += 'M' + f1(m.x + sg * 0.5) + ' ' + f1(m.y - 0.5) + ' Q' + f1(m.x + sg * len * 0.55) + ' ' +
                 f1(m.y - 1.6 - (k % 3) * 0.4) + ' ' + f1(m.x + sg * len) + ' ' + f1(m.y + 0.4 - (k % 3) * 0.5) + ' ';
        }
        s += '<g class="mush"><path class="fibril" d="' + fib + '" style="opacity:0"/>' +
             '<ellipse class="knot" cx="' + f1(m.x) + '" cy="' + f1(m.y) + '" rx="0" ry="0"/>' +
             '<path class="stem" fill="url(#' + id + 'stem)" d=""/><path class="gill" d=""/>' +
             '<path class="cap" fill="url(#' + id + 'cap)" d=""/><path class="stria" d="" style="opacity:0"/></g>';
      });
    });
    return s;
  }
  function bindFruits(svg, fruits) {
    var groups = svg.querySelectorAll('g.mush, g.amanita'), gi = 0;
    fruits.forEach(function (f) {
      if (f.bind) { f.bind(svg); return; }
      f.mush.forEach(function (m) {
        var g = groups[gi++];
        m.lastD = -1;
        if (m.type === 'amanita') {
          m.el = {};
          AM_PARTS.forEach(function (k) { m.el[k] = g.querySelector('.am-' + k); });
          return;
        }
        m.el = { fib: g.querySelector('.fibril'), knot: g.querySelector('.knot'), stem: g.querySelector('.stem'),
                 gill: g.querySelector('.gill'), cap: g.querySelector('.cap'), stria: g.querySelector('.stria') };
      });
      // The fruit bodies develop after the mycelium beneath them has had a head start.
      f.apply = function (p) {
        var dev = seg(p, 0.25, 1);
        f.mush.forEach(function (m) {
          var d = Math.min(m.dmax, seg(dev, m.start, m.start + 0.86));
          if (Math.abs(d - m.lastD) < 0.002) return;
          m.lastD = d;
          if (m.type === 'amanita') drawAmanita(m, d);
          else drawMushroom(m, d);
        });
      };
    });
  }
  function quadPt(B, C, T, t) {
    var u = 1 - t;
    return [u * u * B[0] + 2 * u * t * C[0] + t * t * T[0], u * u * B[1] + 2 * u * t * C[1] + t * t * T[1]];
  }
  function quadTan(B, C, T, t) {
    return [2 * (1 - t) * (C[0] - B[0]) + 2 * t * (T[0] - C[0]), 2 * (1 - t) * (C[1] - B[1]) + 2 * t * (T[1] - C[1])];
  }
  // Draw one fruiting body at development d: 0 nothing, 0.14 hyphal knot, about 0.42 pin, 1 mature.
  function drawMushroom(m, d) {
    var e = m.el, kn = seg(d, 0, 0.14);
    e.fib.style.opacity = (0.85 * seg(d, 0.04, 0.3)).toFixed(2);
    var kr = d > 0 ? (0.5 + 1.0 * kn) * (1 - 0.65 * seg(d, 0.2, 0.5)) : 0;   // knot merges into the stem base
    e.knot.setAttribute('rx', f1(kr));
    e.knot.setAttribute('ry', f1(kr * 0.8));
    e.knot.setAttribute('cy', f1(m.y - kr * 0.55));
    // Slow pin formation, then rapid elongation as preformed cells inflate.
    var H = m.h * (0.22 * seg(d, 0.1, 0.42) + 0.78 * Math.pow(seg(d, 0.42, 1), 1.15));
    if (H < 0.8) {
      ['stem', 'cap', 'gill', 'stria'].forEach(function (k) { e[k].setAttribute('d', ''); });
      return;
    }
    var B = [m.x, m.y - kr * 0.3], dir = [Math.sin(m.lean), -Math.cos(m.lean)], nrm = [-dir[1], dir[0]];
    var T = [B[0] + dir[0] * H, B[1] + dir[1] * H];
    var C = [(B[0] + T[0]) / 2 + nrm[0] * m.bend * H, (B[1] + T[1]) / 2 + nrm[1] * m.bend * H];
    var thick = 0.55 + 0.45 * seg(d, 0.1, 0.5), left = [], right = [];
    for (var k = 0; k <= 8; k++) {
      var t = k / 8, P = quadPt(B, C, T, t), D = quadTan(B, C, T, t), len = Math.sqrt(D[0] * D[0] + D[1] * D[1]) || 1;
      var nx = -D[1] / len, ny = D[0] / len;
      var half = (m.wb + (m.wt - m.wb) * t) * (1 + 0.5 * Math.pow(1 - t, 6)) * thick / 2;   // slightly swollen base
      left.push(f1(P[0] - nx * half) + ' ' + f1(P[1] - ny * half));
      right.unshift(f1(P[0] + nx * half) + ' ' + f1(P[1] + ny * half));
    }
    e.stem.setAttribute('d', 'M' + left.join(' L') + ' L' + right.join(' L') + ' Z');
    // Cap, aligned with the top of the stem: conical when young, opening to a bell with a flared margin.
    var Dt = quadTan(B, C, T, 1), lt = Math.sqrt(Dt[0] * Dt[0] + Dt[1] * Dt[1]) || 1;
    var u = [Dt[0] / lt, Dt[1] / lt], v = [-u[1], u[0]];
    var W = m.cw * (0.3 + 0.7 * seg(d, 0.38, 1)), Hc = W * (1.05 - 0.42 * seg(d, 0.55, 1)), fl = seg(d, 0.6, 1);
    var Ym = -Hc * (0.22 - 0.1 * fl), Ya = Hc * 0.82, mx = W / 2 * (1 + 0.05 * fl), my = Ym + Hc * 0.05 * fl;
    function at(X, Y) { return f1(T[0] + v[0] * X + u[0] * Y) + ' ' + f1(T[1] + v[1] * X + u[1] * Y); }
    e.cap.setAttribute('d', 'M' + at(-mx, my) + ' C' + at(-W * 0.54, Ym + Hc * 0.62) + ' ' + at(-W * 0.16, Ya) + ' ' + at(0, Ya) +
      ' C' + at(W * 0.16, Ya) + ' ' + at(W * 0.54, Ym + Hc * 0.62) + ' ' + at(mx, my) +
      ' Q' + at(0, Ym + Hc * 0.2) + ' ' + at(-mx, my) + ' Z');
    e.gill.setAttribute('d', 'M' + at(-mx * 0.95, my + Hc * 0.02) + ' Q' + at(0, Ym + Hc * 0.16) + ' ' + at(mx * 0.95, my + Hc * 0.02));
    var st = '';
    for (var si = 1; si <= 6; si++) {
      var X = -W / 2 + si * W / 7;
      st += 'M' + at(X * 0.96, Ym + Hc * 0.08) + ' L' + at(X * 0.5, Ym + (Ya - Ym) * 0.48) + ' ';
    }
    e.stria.setAttribute('d', st);
    e.stria.style.opacity = (0.55 * seg(d, 0.6, 0.95)).toFixed(2);   // translucent striations on the opened cap
  }

  /* ---------- Fly agarics ----------
     Amanita muscaria in small groups: one mature fruit body with a younger button and sometimes an
     unopened egg, as they are usually found. Development follows the species. The young fruit body
     is a white egg enclosed in the universal veil, which splits as the stem elongates; its remains
     are the white warts on the red cap and the cottony rings on the bulb at the stem base. The
     globose cap expands to convex and then almost flat, and the partial veil that covered the white
     gills tears from the cap margin and hangs as a skirt-like ring on the white stem. The stem is
     about as tall as the cap is wide. */
  // Drawn back to front: the bulb sits behind the stem, the egg in front of everything.
  var AM_PARTS = ['gills', 'gl', 'bulb', 'stem', 'rings', 'veil', 'skirtl', 'cap', 'sheen', 'warts', 'egg'];
  function makeAmanitas(bx, by, rand, s, dir) {
    var mush = [];
    function one(dx, sc, dmax, start) {
      // Warts in loose, offset rows over the visible face of the cap, each an irregular flake.
      var warts = [];
      [[0.1, 7], [0.34, 7], [0.56, 6], [0.76, 5], [0.94, 3]].forEach(function (row, ri) {
        for (var i = 0; i < row[1]; i++) {
          var X = ((i + 0.5 + (ri % 2) * 0.5) / (row[1] + 0.5) * 2 - 1) * 0.9 + (rand() - 0.5) * 0.14, k = [];
          for (var v = 0; v < 6; v++) k.push(0.72 + rand() * 0.45);
          warts.push({ X: Math.max(-0.95, Math.min(0.95, X)), t: Math.max(0, Math.min(1, row[0] + (rand() - 0.5) * 0.1)),
                       r: 0.7 + rand() * 0.5, a: 0.6 + rand() * 0.3, k: k, rot: rand() * 6.3 });
        }
      });
      // Remains of the universal veil on the bulb: two or three broken, cottony rings.
      var rings = [];
      for (var rr = 0; rr < 3; rr++) {
        var segs = [], left = 1;
        while (left > 0.02) {
          var wv = Math.min(left, 0.1 + rand() * 0.16);
          segs.push([wv, 0.45 + rand() * 0.9, rand() < 0.16]);
          left -= wv;
        }
        rings.push(segs);
      }
      mush.push({ type: 'amanita', x: bx + dx, y: by, s: sc, dmax: dmax, start: start, lastD: -1, warts: warts, rings: rings,
                  H: sc * (40 + rand() * 7), W: sc * (40 + rand() * 7),
                  lean: (rand() - 0.5) * 0.06 + dx * 0.0015, bend: (rand() - 0.5) * 0.08 });
    }
    one(0, s, 1, 0);                                                // mature, at the back
    one(dir * s * 27, s * 0.8, 0.38 + rand() * 0.08, 0.08);        // a button, its veil still closed
    if (rand() < 0.65) one(-dir * s * 19, s * 0.72, 0.12, 0.16);   // an unopened egg
    return { x: bx, y: by, mush: mush, kind: 'fruit', lastP: -1 };
  }
  // An egg or bulb outline standing on (cx, y0): b tall, broadest (about 0.79a either side) low down.
  function eggPath(cx, y0, a, b) {
    return 'M' + f1(cx) + ' ' + f1(y0) +
      ' C' + f1(cx + a * 1.12) + ' ' + f1(y0 + 0.2) + ' ' + f1(cx + a * 0.98) + ' ' + f1(y0 - b * 0.98) + ' ' + f1(cx) + ' ' + f1(y0 - b) +
      ' C' + f1(cx - a * 0.98) + ' ' + f1(y0 - b * 0.98) + ' ' + f1(cx - a * 1.12) + ' ' + f1(y0 + 0.2) + ' ' + f1(cx) + ' ' + f1(y0) + ' Z';
  }
  // Draw one fly agaric at development d: 0 nothing, about 0.12 egg, 0.4 button, 1 mature.
  function drawAmanita(m, d) {
    var e = m.el, s = m.s;
    if (d <= 0) {
      AM_PARTS.forEach(function (k) { e[k].setAttribute('d', ''); });
      return;
    }
    var x0 = m.x, y0 = m.y + 0.8;   // set slightly into the substrate
    // The egg, which shrinks back to the basal bulb once the veil splits and the stem elongates. While
    // the veil is splitting the egg is drawn in front, hiding the cap until it emerges; the finished
    // bulb sits behind the stem, which grows out of it.
    var g = Math.sqrt(seg(d, 0, 0.14)), rup = seg(d, 0.14, 0.34);
    var a = s * (8.4 * g + (6.6 - 8.4 * g) * rup), b = s * (15 * g + (9 - 15 * g) * rup);
    var shape = eggPath(x0, y0, a, b);
    e.egg.setAttribute('d', rup < 1 ? shape : '');
    e.bulb.setAttribute('d', rup < 1 ? '' : shape);
    // Remains of the universal veil: broken, cottony rings around the top of the bulb.
    var rv = seg(d, 0.22, 0.42), rd = '';
    if (rv > 0) {
      m.rings.forEach(function (segs, k) {
        var fh = 0.5 + 0.15 * k, yk = y0 - b * fh;
        var hw = 0.79 * a * Math.sqrt(Math.max(0, 1 - Math.pow((fh - 0.42) / 0.58, 2))) + 0.4, x = -hw;
        rd += 'M' + f1(x0 + x) + ' ' + f1(yk + s * 0.6 * (1 - (x / hw) * (x / hw)));
        segs.forEach(function (sg) {
          var xb = x + sg[0] * 2 * hw, xm = (x + xb) / 2;
          var yb = yk + s * 0.6 * (1 - (xb / hw) * (xb / hw)), ym = yk + s * 0.6 * (1 - (xm / hw) * (xm / hw));
          rd += sg[2] ? ' M' + f1(x0 + xb) + ' ' + f1(yb)
                      : ' Q' + f1(x0 + xm) + ' ' + f1(ym + s * sg[1]) + ' ' + f1(x0 + xb) + ' ' + f1(yb);
          x = xb;
        });
        rd += ' ';
      });
    }
    e.rings.setAttribute('d', rd);
    e.rings.style.opacity = rv.toFixed(2);
    if (d < 0.14) {
      ['gills', 'gl', 'stem', 'veil', 'skirtl', 'cap', 'sheen', 'warts'].forEach(function (k2) { e[k2].setAttribute('d', ''); });
      return;
    }

    // The stem elongates slowly and then fast, as its cells inflate; then the cap expands.
    var r = seg(d, 0.14, 0.62), xe = seg(d, 0.5, 1);
    xe = xe * xe * (3 - 2 * xe);
    var Hv = m.H * (0.14 + 0.86 * Math.pow(r, 1.25));
    var dir = [Math.sin(m.lean), -Math.cos(m.lean)], nrm = [-dir[1], dir[0]];
    var B = [x0, y0 - Math.min(b * 0.45, Hv * 0.5)], T = [x0 + dir[0] * Hv, y0 + dir[1] * Hv];
    var C = [(B[0] + T[0]) / 2 + nrm[0] * m.bend * Hv, (B[1] + T[1]) / 2 + nrm[1] * m.bend * Hv];
    var wb = s * 3.1, wt = s * 2.35, thick = 1.2 - 0.2 * seg(d, 0.35, 0.8);   // stout in the button, thinning as it elongates
    function halfAt(t) { return (wb + (wt - wb) * t) * thick; }
    var L = [], R = [];
    for (var i = 0; i <= 8; i++) {
      var t = i / 8, P = quadPt(B, C, T, t), D = quadTan(B, C, T, t), len = Math.sqrt(D[0] * D[0] + D[1] * D[1]) || 1;
      var nx = -D[1] / len, ny = D[0] / len, h2 = halfAt(t);
      L.push(f1(P[0] - nx * h2) + ' ' + f1(P[1] - ny * h2));
      R.unshift(f1(P[0] + nx * h2) + ' ' + f1(P[1] + ny * h2));
    }
    e.stem.setAttribute('d', 'M' + L.join(' L') + ' L' + R.join(' L') + ' Z');

    // The cap, in the frame of the stem apex: globose with an incurved margin, then convex, then
    // almost flat with rounded shoulders.
    var Dt = quadTan(B, C, T, 1), lt = Math.sqrt(Dt[0] * Dt[0] + Dt[1] * Dt[1]) || 1;
    var u = [Dt[0] / lt, Dt[1] / lt], v = [-u[1], u[0]];
    function pt(X, Y) { return [T[0] + v[0] * X + u[0] * Y, T[1] + v[1] * X + u[1] * Y]; }
    function at(X, Y) { var q = pt(X, Y); return f1(q[0]) + ' ' + f1(q[1]); }
    var capW = m.W * (0.36 + 0.1 * r + 0.54 * xe);
    var hT = capW * (0.5 - 0.29 * xe), hM = capW * (0.3 - 0.25 * xe), mx = capW / 2 * (0.8 + 0.2 * xe), hh = hT + hM;
    var und = -hM + hh * (0.32 - 0.14 * xe);   // control point of the underside, nearly flat when mature
    var capD = 'M' + at(-mx, -hM) + ' C' + at(-capW * 0.53, -hM + hh * 0.5) + ' ' + at(-capW * 0.3, hT) + ' ' + at(0, hT) +
               ' C' + at(capW * 0.3, hT) + ' ' + at(capW * 0.53, -hM + hh * 0.5) + ' ' + at(mx, -hM) +
               ' Q' + at(0, und) + ' ' + at(-mx, -hM) + ' Z';
    e.cap.setAttribute('d', capD);
    e.sheen.setAttribute('d', capD);

    // White, free gills, seen once the partial veil has torn away.
    var gl = seg(d, 0.6, 0.82);
    if (gl > 0) {
      var gd = s * 3.4 * gl, edge = -hM - gd * 1.2, gls = '';
      e.gills.setAttribute('d', 'M' + at(-mx * 0.97, -hM) + ' Q' + at(0, und) + ' ' + at(mx * 0.97, -hM) +
                                ' Q' + at(0, edge) + ' ' + at(-mx * 0.97, -hM) + ' Z');
      for (var gi = 1; gi < 12; gi++) {
        var q = gi / 12, w2 = (1 - q) * (1 - q) + q * q, w1 = 2 * q * (1 - q), X = 2 * q - 1;
        gls += 'M' + at(X * mx * 0.97, -hM * w2 + und * w1) + ' L' + at(X * mx * 0.9, -hM * w2 + edge * w1) + ' ';
      }
      e.gl.setAttribute('d', gls);
    } else {
      e.gills.setAttribute('d', '');
      e.gl.setAttribute('d', '');
    }

    // The partial veil runs from the stem to the cap margin, then tears free and hangs as the ring.
    var tear = seg(d, 0.56, 0.76), te = tear * tear * (3 - 2 * tear);
    var tr = 0.83, Pr = quadPt(B, C, T, tr), Dr = quadTan(B, C, T, tr), lr = Math.sqrt(Dr[0] * Dr[0] + Dr[1] * Dr[1]) || 1;
    var ur = [Dr[0] / lr, Dr[1] / lr], vr = [-ur[1], ur[0]], hr = halfAt(tr);
    function pr(X, Y) { return [Pr[0] + vr[0] * X + ur[0] * Y, Pr[1] + vr[1] * X + ur[1] * Y]; }
    function mix(p, p2, k3) { return [p[0] + (p2[0] - p[0]) * k3, p[1] + (p2[1] - p[1]) * k3]; }
    var hang = s * 7.5, flare = hr + s * 2.6, IL = pr(-hr, 0), IR = pr(hr, 0);
    var OL = mix(pt(-mx * 0.96, -hM), pr(-flare, -hang), te), OR = mix(pt(mx * 0.96, -hM), pr(flare, -hang), te);
    var vd = 'M' + f1(IL[0]) + ' ' + f1(IL[1]) + ' L' + f1(OL[0]) + ' ' + f1(OL[1]);
    for (var sc = 0; sc < 4; sc++) {   // the free edge, slightly ragged once it hangs
      var p0 = mix(OL, OR, (sc + 0.5) / 4), p1 = mix(OL, OR, (sc + 1) / 4), dip = s * (0.6 + 0.5 * (sc % 2)) * te;
      vd += ' Q' + f1(p0[0] - ur[0] * dip) + ' ' + f1(p0[1] - ur[1] * dip) + ' ' + f1(p1[0]) + ' ' + f1(p1[1]);
    }
    e.veil.setAttribute('d', vd + ' L' + f1(IR[0]) + ' ' + f1(IR[1]) + ' Z');
    var sl = '';
    if (te > 0.5) {
      [-0.6, -0.2, 0.2, 0.6].forEach(function (f) {   // fine striations on the hanging ring
        var p2 = pr(f * hr * 0.9, -0.6), p3 = pr(f * flare * 0.9, -hang * 0.8);
        sl += 'M' + f1(p2[0]) + ' ' + f1(p2[1]) + ' L' + f1(p3[0]) + ' ' + f1(p3[1]) + ' ';
      });
    }
    e.skirtl.setAttribute('d', sl);
    e.skirtl.style.opacity = (0.8 * seg(te, 0.5, 1)).toFixed(2);

    // Warts: patches of the broken universal veil, crowded on the young cap and spreading apart as
    // it expands.
    var sz = 1 + 0.6 * (1 - seg(d, 0.2, 0.62)), ex = 2 + 1.4 * xe, wd = '';
    m.warts.forEach(function (w) {
      var prof = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(w.X), ex)));
      var c = pt(w.X * capW * 0.49, -hM + hh * prof * (0.2 + 0.76 * w.t));
      // smaller towards the margin, and foreshortened towards the sides of the cap
      var rx = s * w.r * sz * (0.6 + 0.4 * w.t) * (1 - 0.45 * w.X * w.X), ry = s * w.r * sz * (0.6 + 0.4 * w.t) * w.a;
      var vx = [], vy = [];
      for (var q2 = 0; q2 < 6; q2++) {
        var an = w.rot + q2 * Math.PI / 3;
        vx.push(c[0] + Math.cos(an) * rx * w.k[q2]);
        vy.push(c[1] + Math.sin(an) * ry * w.k[q2]);
      }
      wd += 'M' + f1((vx[5] + vx[0]) / 2) + ' ' + f1((vy[5] + vy[0]) / 2);
      for (q2 = 0; q2 < 6; q2++) {
        var nq = (q2 + 1) % 6;
        wd += ' Q' + f1(vx[q2]) + ' ' + f1(vy[q2]) + ' ' + f1((vx[q2] + vx[nq]) / 2) + ' ' + f1((vy[q2] + vy[nq]) / 2);
      }
      wd += 'Z ';
    });
    e.warts.setAttribute('d', wd);
  }

  /* ---------- Plants off the contact card ----------
     A Nepenthes vine hangs from one end of the card's lower edge and a creeping fig (Ficus pumila)
     trails from the other. As the page scrolls the stems extend and leaves unfold behind the growing
     tips. Each Nepenthes leaf's midrib runs on into a tendril that droops and curls up into a
     pitcher: the pitcher starts as a small, closed bud, swells to full size, and only then does its
     lid lift. */
  var plantSeq = 0;
  function cubicPts(P0, P1, P2, P3, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
      out.push([a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1]]);
    }
    return out;
  }
  function polyLen(P) {
    var L = 0;
    for (var i = 1; i < P.length; i++) {
      var dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1];
      L += Math.sqrt(dx * dx + dy * dy);
    }
    return L;
  }
  // Point and unit tangent at fraction t of a polyline's length.
  function alongPoly(P, t) {
    var target = t * polyLen(P), acc = 0;
    for (var i = 1; i < P.length; i++) {
      var dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1], l = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      if (acc + l >= target || i === P.length - 1) {
        var fr = clamp01((target - acc) / l);
        return { x: P[i - 1][0] + dx * fr, y: P[i - 1][1] + dy * fr, tx: dx / l, ty: dy / l };
      }
      acc += l;
    }
    return { x: P[0][0], y: P[0][1], tx: 1, ty: 0 };
  }
  function polyD(P) { return 'M' + P.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join(' L'); }
  function smoothClosed(P) {
    var n = P.length, d = 'M' + f1((P[n - 1][0] + P[0][0]) / 2) + ' ' + f1((P[n - 1][1] + P[0][1]) / 2);
    for (var i = 0; i < n; i++) {
      var q = P[(i + 1) % n];
      d += ' Q' + f1(P[i][0]) + ' ' + f1(P[i][1]) + ' ' + f1((P[i][0] + q[0]) / 2) + ' ' + f1((P[i][1] + q[1]) / 2);
    }
    return d + 'Z';
  }
  function dotsD(list, r) {
    return list.map(function (p) {
      return 'M' + f1(p[0] - r) + ' ' + f1(p[1]) + ' a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(2 * r) + ' 0 a' + f1(r) + ' ' + f1(r) + ' 0 1 0 ' + f1(-2 * r) + ' 0';
    }).join(' ');
  }
  function dashTo(el, fr) {
    el.style.visibility = fr > 0 ? 'visible' : 'hidden';
    el.style.strokeDashoffset = (1 - fr).toFixed(4);
  }
  // A pitcher standing on its base at the origin: a rounded lower bulb, a waist and a flared mouth.
  function pitcherD(wp, hp) {
    var R = [[0.1, 0], [0.38, -0.07], [0.5, -0.27], [0.43, -0.5], [0.32, -0.66], [0.36, -0.84], [0.45, -0.95]];
    var right = R.map(function (q) { return [q[0] * wp, q[1] * hp]; });
    var left = R.slice().reverse().map(function (q) { return [-q[0] * wp, q[1] * hp]; });
    return smoothClosed(right.concat(left));
  }

  function makeNepenthes(ox, oy, s, dir, rand) {
    var k = plantSeq++;
    var stem = cubicPts([ox, oy], [ox + dir * 3 * s, oy + 20 * s], [ox + dir * 26 * s, oy + 38 * s], [ox + dir * 52 * s, oy + 28 * s], 30);
    var leaves = [0.25, 0.52, 0.8].map(function (t, i) {
      var p = alongPoly(stem, t), side = i % 2 ? -1 : 1;
      var a = Math.atan2(p.ty, p.tx) + side * (0.85 + rand() * 0.3);
      a += angDiff(Math.PI / 2, a) * 0.3;   // the leaves droop
      var ll = (15 + rand() * 6) * s, tip = [p.x + Math.cos(a) * ll, p.y + Math.sin(a) * ll];
      var drop = (16 + rand() * 6) * s, pb = [tip[0] + dir * (3 + rand() * 3) * s, tip[1] + drop];
      return { t: t, x: p.x, y: p.y, a: a, ll: ll, lw: ll * 0.25, pb: pb, hp: (15 + rand() * 5) * s, lean: dir * (0.05 + rand() * 0.08),
               tendril: cubicPts(tip, [tip[0] + dir * s, tip[1] + drop * 0.8], [pb[0] - dir * 7 * s, pb[1] + 7 * s], pb, 14) };
    });
    var f = { x: ox, y: oy, kind: 'fruit', lastP: -1 };
    f.markup = function (id) {
      var m = '<g class="plant nepenthes" data-k="' + k + '"><path class="np-stem" pathLength="1" style="' + HIDDEN + '" d="' + polyD(stem) + '"/>';
      leaves.forEach(function (lf) {
        var L = lf.ll, W = lf.lw, hp = lf.hp;
        m += '<path class="np-tendril" pathLength="1" style="' + HIDDEN + '" d="' + polyD(lf.tendril) + '"/>' +
             '<g class="np-leaf" transform="scale(0)"><path d="M0 0 C' + f1(L * 0.15) + ' ' + f1(-W * 1.1) + ' ' + f1(L * 0.6) + ' ' + f1(-W * 0.95) + ' ' + f1(L) + ' 0 C' +
             f1(L * 0.6) + ' ' + f1(W * 0.95) + ' ' + f1(L * 0.15) + ' ' + f1(W * 1.1) + ' 0 0 Z"/><path class="np-rib" d="M0 0 L' + f1(L * 0.97) + ' 0"/></g>' +
             '<g class="np-pitcher" transform="scale(0)"><path class="np-body" fill="url(#' + id + 'np)" d="' + pitcherD(hp * 0.5, hp) + '"/>' +
             '<path class="np-spot" d="' + dotsD([[-0.1, -0.3], [0.12, -0.42], [-0.05, -0.6], [0.1, -0.74], [-0.12, -0.8], [0.03, -0.18]].map(function (q) { return [q[0] * hp, q[1] * hp]; }), hp * 0.028) + '"/>' +
             '<ellipse class="np-rim" cx="0" cy="' + f1(-hp * 0.95) + '" rx="' + f1(hp * 0.24) + '" ry="' + f1(hp * 0.07) + '"/>' +
             '<ellipse class="np-lid" cx="' + f1(dir * hp * 0.02) + '" cy="' + f1(-hp * 1.03) + '" rx="' + f1(hp * 0.24) + '" ry="' + f1(hp * 0.06) + '"/></g>';
      });
      return m + '</g>';
    };
    f.bind = function (svg) {
      var g = svg.querySelector('g.nepenthes[data-k="' + k + '"]'), stemEl = g.querySelector('.np-stem');
      var tendrils = g.querySelectorAll('.np-tendril'), leafEls = g.querySelectorAll('.np-leaf'), pits = g.querySelectorAll('.np-pitcher');
      leaves.forEach(function (lf, i) { lf.el = { tendril: tendrils[i], leaf: leafEls[i], pit: pits[i], lid: pits[i].querySelector('.np-lid') }; });
      f.apply = function (p) {
        var gr = seg(p, 0.1, 0.95);
        dashTo(stemEl, seg(gr, 0, 0.4));
        leaves.forEach(function (lf) {
          var g0 = 0.4 * lf.t, lg = seg(gr, g0, g0 + 0.16);
          lf.el.leaf.setAttribute('transform', lg > 0 ? 'translate(' + f1(lf.x) + ' ' + f1(lf.y) + ') rotate(' + f1(lf.a * 57.3) + ') scale(' +
            lg.toFixed(3) + ' ' + (lg * (0.35 + 0.65 * lg)).toFixed(3) + ')' : 'scale(0)');
          dashTo(lf.el.tendril, seg(gr, g0 + 0.1, g0 + 0.3));
          if (gr < g0 + 0.26) { lf.el.pit.setAttribute('transform', 'scale(0)'); return; }
          var inf = seg(gr, g0 + 0.28, g0 + 0.52), sc = 0.22 + 0.78 * inf;   // a slender bud that swells
          lf.el.pit.setAttribute('transform', 'translate(' + f1(lf.pb[0]) + ' ' + f1(lf.pb[1]) + ') rotate(' + f1(lf.lean * 57.3) + ') scale(' +
            (sc * (0.6 + 0.4 * inf)).toFixed(3) + ' ' + sc.toFixed(3) + ')');
          lf.el.lid.setAttribute('transform', 'rotate(' + f1(-dir * 74 * seg(gr, g0 + 0.55, g0 + 0.68)) + ' ' + f1(-dir * lf.hp * 0.21) + ' ' + f1(-lf.hp * 0.99) + ')');
        });
      };
    };
    return f;
  }

  // Juvenile creeping fig climbs pressed flat against a surface: along the card's lower edge, round
  // the corner and up its side, with a couple of shoots trailing down from the corner.
  function makeFig(hs, s, rand) {
    var k = plantSeq++, rad = Math.max(8, Math.min(hs.rad, 40)), cx = hs.x0 + rad, cy = hs.y1 - rad, off = 1.6;
    var climb = [], topY = Math.max(hs.y0 + rad + 12, hs.y1 - (hs.y1 - hs.y0) * 0.6);
    for (var x = cx + 30 * s; x > cx; x -= 3) climb.push([x, hs.y1 + off]);
    for (var a = Math.PI / 2; a < Math.PI; a += 0.15) climb.push([cx + Math.cos(a) * (rad + off), cy + Math.sin(a) * (rad + off)]);
    for (var y = cy; y >= topY; y -= 3) climb.push([hs.x0 - off + Math.sin(y * 0.19) * 0.9, y]);
    var c45 = [cx - (rad + off) * 0.71, cy + (rad + off) * 0.71], b2 = climb[Math.floor(climb.length * 0.16)];
    var trail1 = cubicPts(c45, [c45[0] - 6 * s, c45[1] + 12 * s], [c45[0] - 14 * s, c45[1] + 26 * s], [c45[0] - 10 * s, c45[1] + 40 * s], 18);
    var trail2 = cubicPts(b2, [b2[0] + 2 * s, b2[1] + 10 * s], [b2[0] + 8 * s, b2[1] + 20 * s], [b2[0] + 5 * s, b2[1] + 30 * s], 14);
    var stems = [{ pts: climb, g0: 0, g1: 0.8 }, { pts: trail1, g0: 0.3, g1: 0.75 }, { pts: trail2, g0: 0.45, g1: 0.9 }];
    stems.forEach(function (st) {
      var n = Math.max(3, Math.round(polyLen(st.pts) / (5.2 * s)));   // close-set, overlapping like shingles
      st.leaves = [];
      for (var i = 1; i <= n; i++) {
        var t = i / (n + 0.35), p = alongPoly(st.pts, t), side = i % 2 ? 1 : -1;
        st.leaves.push({ t: t, x: p.x, y: p.y, a: Math.atan2(p.ty, p.tx) + side * (0.9 + rand() * 0.35),
                         l: (6.4 + rand() * 2) * s * (1 - 0.35 * t), young: t > 0.75 });
      }
    });
    var f = { x: hs.x0, y: hs.y1, kind: 'fruit', lastP: -1 };
    f.markup = function () {
      var m = '<g class="plant fig" data-k="' + k + '">';
      stems.forEach(function (st) {
        m += '<path class="fig-stem" pathLength="1" style="' + HIDDEN + '" d="' + polyD(st.pts) + '"/>';
        st.leaves.forEach(function (lf) {
          var l = lf.l;   // small, rounded, heart-based juvenile leaves on short stalks
          m += '<g class="fig-leaf' + (lf.young ? ' young' : '') + '" transform="scale(0)"><path class="fig-blade" d="M' + f1(l * 0.28) + ' 0 C' + f1(l * 0.1) + ' ' + f1(-l * 0.5) + ' ' +
               f1(l * 0.75) + ' ' + f1(-l * 0.62) + ' ' + f1(l * 1.15) + ' 0 C' + f1(l * 0.75) + ' ' + f1(l * 0.62) + ' ' + f1(l * 0.1) + ' ' + f1(l * 0.5) + ' ' + f1(l * 0.28) + ' 0 Z"/>' +
               '<path class="fig-vein" d="M0 0 L' + f1(l * 1.02) + ' 0"/></g>';
        });
      });
      return m + '</g>';
    };
    f.bind = function (svg) {
      var g = svg.querySelector('g.fig[data-k="' + k + '"]'), stemEls = g.querySelectorAll('.fig-stem'), leafEls = g.querySelectorAll('.fig-leaf'), li = 0;
      stems.forEach(function (st, i) { st.el = stemEls[i]; st.leaves.forEach(function (lf) { lf.el = leafEls[li++]; }); });
      f.apply = function (p) {
        var gr = seg(p, 0.1, 0.95);
        stems.forEach(function (st) {
          var sg = seg(gr, st.g0, st.g1);
          dashTo(st.el, sg);
          st.leaves.forEach(function (lf) {
            var lg = seg(sg, lf.t - 0.02, lf.t + 0.14);
            lf.el.setAttribute('transform', lg > 0 ? 'translate(' + f1(lf.x) + ' ' + f1(lf.y) + ') rotate(' + f1(lf.a * 57.3) + ') scale(' + lg.toFixed(3) + ')' : 'scale(0)');
          });
        });
      };
    };
    return f;
  }

  var CONTACT_R = [2.4, 2, 1.7, 1.4];   // swelling where a tip first touches text or a photo, by branch order

  function buildSectionModel(section, index) {
    var w = section.clientWidth, h = section.clientHeight;
    if (w < 50 || h < 50) return null;
    var rand = seeded(9001 + index * 131);
    var leftFirst = index % 2 === 0, narrow = w < 760;
    var scale = Math.max(0.4, Math.min(1, w / 1280));
    var hasBorder = parseFloat(getComputedStyle(section).borderTopWidth) > 0;
    // Headroom above the section: room for the divider network, and for fruiting bodies on cards near the top.
    var top = hasBorder ? RUNNER_ROOM : 40, H = h + top, colonies = [];
    var sr = section.getBoundingClientRect();
    var terrain = makeTerrain(sr.left, sr.top - top, w, H, document, true, narrow ? 4 : 5);
    // 1 at the page edges, falling to a floor across the middle.
    function edgeWeight(x) { return Math.max(0.12, 1 - (Math.min(x, w - x) / w) / 0.3); }

    if (hasBorder) {
      var inward = leftFirst ? 0 : Math.PI, y0 = top + 0.5;
      var run = growMycelium({
        origins: [{ x: leftFirst ? -3 : w + 3, y: y0, angles: [inward], life: 1e4 }],
        speed: [3.4, 2.5, 2.1, 1.8], noise: 0.02, noiseBranch: 0.13, avoid: 0.04,
        steer: function (t) { return t.gen === 0 ? angDiff(inward, t.a) * 0.15 : 0; },
        clampY: [y0 - 2, y0 + 2.5],
        branchEvery: [5, 24], branchAngle: [0.6, 1.3], lifeByGen: [null, [6, 44], [4, 20], [3, 9]],
        branchScale: function (t) { return edgeWeight(t.x); },
        terrain: terrain, exempt: function (t) { return t.gen === 0; },
        maxGen: 3, maxHyphae: Math.round(120 * scale) + 20, fuse: 2, fuseP: 0.4,
        bounds: [-12, 1, w + 12, top + 84], maxSteps: 900
      }, rand);
      run.y = top;
      run.kind = 'runner';
      colonies.push(run);
    }

    // Colonies growing in from both side edges; the lead side gets more and larger ones. When they
    // reach a card they mostly climb onto it and carry on across its surface, around the text.
    var n = Math.max(1, Math.min(3, Math.round(h / 460))), community = [];
    [leftFirst, !leftFirst].forEach(function (left, s) {
      var count = s === 0 ? n : Math.max(1, n - 1);
      // Phones have no side margins, so keep colonies to the edge gutters there.
      var reach = narrow ? (s === 0 ? 0.15 : 0.1) * w : (s === 0 ? 0.24 : 0.17) * Math.max(w, 600);
      var dir = left ? 0 : Math.PI;
      for (var k = 0; k < count; k++) {
        var cy = top + h * (k + 0.25 + rand() * 0.5) / count, angles = [];
        for (var j = 0; j < 5; j++) angles.push(dir + (j / 4 - 0.5) * 2.7 + (rand() - 0.5) * 0.3);
        community.push({ y: cy, o: {
          origins: [{ x: left ? -4 : w + 4, y: cy, angles: angles, life: reach / 3.1 }],
          speed: [3.1, 2.8, 2.5, 2.2], noise: 0.08, noiseBranch: 0.11, radial: 0.02, avoid: 0.05,
          branchEvery: [10, 34], branchAngle: [0.8, 1.45], branchLife: [0.4, 0.85],
          terrain: terrain, climb: 0.6, surfaceBranch: 1.15, stayOn: 20, arrest: 0.1,
          maxGen: 3, maxHyphae: Math.round((s === 0 ? 90 : 60) * scale) + 14, fuse: 2.2, fuseP: 0.5,
          bounds: [-12, top + 4, w + 12, H - 4], maxSteps: 400
        } });
      }
    });

    // For the cards and panels nearest the page edges, find the most open patch of each block's
    // surface; hyphae grow onto the block there and spread across it, meeting its text as obstructions.
    function openness(x, y) {
      var least = 1e9;
      for (var d = 0; d < 8; d++) {
        var a = d * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a), r = 4;
        while (r < 90 && terrain(x + ca * r, y + sa * r) === SURFACE) r += 4;
        if (r < least) least = r;
      }
      return least;
    }
    var cache = new Map(), blocks = [];
    section.querySelectorAll(SURFACE_SEL).forEach(function (el) {
      var r = settledRect(el, cache);
      if (r.width < 80 || r.height < 60) return;
      var x0 = r.left - sr.left, x1 = r.right - sr.left;
      var y0b = r.top - sr.top + top, y1b = r.bottom - sr.top + top;
      blocks.push({ x0: x0, x1: x1, y0: y0b, y1: y1b, d: Math.min(x0, w - x1), left: x0 <= w - x1 });
    });
    blocks.sort(function (a, b) { return a.d - b.d; });
    blocks.slice(0, narrow ? 2 : 4).forEach(function (b) {
      var best = null, bestScore = -1e9;
      for (var y = b.y0 + 8; y < b.y1 - 8; y += 10) {
        for (var x = b.x0 + 8; x < b.x1 - 8; x += 10) {
          if (terrain(x, y) !== SURFACE) continue;
          var open = openness(x, y), score = open - 0.12 * (b.left ? x - b.x0 : b.x1 - x);
          if (score > bestScore) { bestScore = score; best = [x, y, open]; }
        }
      }
      if (!best || best[2] < 12) return;
      // A few hyphae creep in from the margin level with that patch, attach at the block's edge,
      // climb on and spread across it.
      var dir = b.left ? 0 : Math.PI, gap = narrow ? 10 : 26;
      var ox = b.left ? b.x0 - gap : b.x1 + gap, oy = best[1];
      if (terrain(ox, oy) !== FREE) return;
      var angles = [dir - 0.35 + (rand() - 0.5) * 0.2, dir + (rand() - 0.5) * 0.2, dir + 0.35 + (rand() - 0.5) * 0.2];
      community.push({ y: oy, o: {
        origins: [{ x: ox, y: oy, angles: angles, life: narrow ? 60 : 95 }],
        speed: [2.8, 2.5, 2.2, 2], noise: 0.09, noiseBranch: 0.12, avoid: 0.05,
        branchEvery: [10, 30], branchAngle: [0.8, 1.45], branchLife: [0.4, 0.85],
        terrain: terrain, climb: 0.9, surfaceBranch: 1.2, stayOn: 40, arrest: 0.1,
        maxGen: 3, maxHyphae: narrow ? 22 : 45, fuse: 2.2, fuseP: 0.5,
        bounds: [-12, top + 2, w + 12, H - 2], maxSteps: 340
      } });
    });

    // These colonies are separate individuals, some of other growth forms, grown together so they meet:
    // they avoid each other and deadlock at a pigmented front, unless a combative one overgrows another.
    // They share one scroll position, so the meeting plays out as it would in real time.
    if (community.length) {
      var grown = growCommunity(community.map(function (m, k) {
        return withMorph(m.o, k > 0 && rand() < 0.55 ? MORPH_KEYS[1 + Math.floor(rand() * 3)] : 'effuse');
      }), rand);
      var cyAvg = community.reduce(function (sum, m) { return sum + m.y; }, 0) / community.length;
      grown.forEach(function (col) {
        col.y = cyAvg;
        col.kind = 'side';
        colonies.push(col);
      });
    }
    // Fruiting bodies: a small tuft on top of some cards near the page edges where the space above is
    // clear, fruiting from mycelium that first spreads along and over the card's top edge.
    var fruits = [], hosts = [];
    // Clear height above a host's top edge. The scan starts above the grid cell that straddles the
    // edge, which a solid host (the contact card) fills.
    function freeHeight(cx, by, half, maxH) {
      for (var yy = by - 6; yy >= by - maxH; yy -= 2) {
        if (yy < 2) return by - yy - 2;
        for (var xx = cx - half; xx <= cx + half; xx += 4) if (terrain(xx, yy) !== FREE) return by - yy - 2;
      }
      return maxH;
    }
    section.querySelectorAll(FRUIT_HOST_SEL).forEach(function (el) {
      var r = settledRect(el, cache);
      if (r.width < 120 || r.height < 80) return;
      var hx0 = r.left - sr.left, hx1 = r.right - sr.left;
      hosts.push({ x0: hx0, x1: hx1, y0: r.top - sr.top + top, d: Math.min(hx0, w - hx1), left: hx0 <= w - hx1,
                   y1: r.bottom - sr.top + top, always: el.classList.contains('contact-card'), solid: el.matches(SOLID_SEL),
                   rad: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 });
    });
    hosts.sort(function (a, b) { return a.d - b.d; });
    // Mycelium under a fruiting group. On a card the mat spreads along the edge and down over the
    // surface; on a solid host it can only run along the top edge, pressed against it.
    function fruitMat(x, hst, life, maxHy) {
      var mat = growMycelium({
        origins: [{ x: x, y: hst.y0 - (hst.solid ? 5 : 2), life: life,
                    angles: hst.solid ? [0.1, Math.PI - 0.1, 0.3, Math.PI - 0.3]
                                      : [0.08, Math.PI - 0.08, Math.PI / 2 - 0.5, Math.PI / 2 + 0.5] }],
        speed: [2.6, 2.3, 2], noise: 0.09, noiseBranch: 0.12, avoid: 0.05,
        branchEvery: [10, 28], branchAngle: [0.8, 1.45], branchLife: [0.4, 0.8],
        terrain: terrain, climb: 0.85, surfaceBranch: 1.2, stayOn: 40, arrest: 0.1,
        maxGen: 2, maxHyphae: maxHy, fuse: 2.2, fuseP: 0.5,
        bounds: [-12, top + 2, w + 12, H - 2], maxSteps: 220
      }, rand);
      mat.y = hst.y0;
      mat.kind = 'side';
      colonies.push(mat);
    }
    for (var hk = 0; hk < hosts.length && fruits.length < (narrow ? 1 : 2); hk++) {
      var hst = hosts[hk], ins = Math.max(30, hst.rad + 18);   // clear of a rounded corner
      if (!hst.always && rand() < 0.3) continue;   // only some of the boxes (the contact card always fruits)
      for (var tries = 0; tries < 4; tries++) {
        var fx = hst.left ? hst.x0 + ins + tries * 24 : hst.x1 - ins - tries * 24;
        var room = freeHeight(fx, hst.y0, 20, 46);
        if (room < 22) continue;
        fruits.push(makeTuft(fx, hst.y0, rand, Math.min(1.4, (room - 3) / 29) * (narrow ? 0.9 : 1)));
        fruitMat(fx, hst, narrow ? 30 : 45, narrow ? 18 : 30);
        break;
      }
    }
    // Fly agarics: one group, on a box with more headroom and clear of the Mycena tufts. The contact
    // card always has one; otherwise about half of the sections with room get one.
    var taken = fruits.map(function (f) { return { x0: f.x - 30, x1: f.x + 30, y: f.y }; });
    var wantAm = hosts.some(function (hs) { return hs.always; }) || rand() < 0.5;
    for (var ak = 0; wantAm && ak < hosts.length; ak++) {
      var ah = hosts[ak], ains = Math.max(48, ah.rad + 34), placed = false;
      var near = taken.filter(function (tk) { return Math.abs(tk.y - ah.y0) < 70; });
      var ends = ah.left ? [1, -1] : [-1, 1];   // the end nearer the page edge first ...
      var mine = near.filter(function (tk) { return tk.x1 > ah.x0 && tk.x0 < ah.x1; });
      if (mine.length) ends = (mine[0].x0 + mine[0].x1) / 2 < (ah.x0 + ah.x1) / 2 ? [-1, 1] : [1, -1];   // ... or away from a tuft
      for (var ei = 0; ei < 2 && !placed; ei++) {
        for (var at2 = 0; at2 < 3 && !placed; at2++) {
          var ax = ends[ei] > 0 ? ah.x0 + ains + at2 * 30 : ah.x1 - ains - at2 * 30;
          var adir = ax < (ah.x0 + ah.x1) / 2 ? 1 : -1, acx = ax + adir * 6;   // the button stands on the inner side
          if (acx - 40 < ah.x0 || acx + 40 > ah.x1) continue;
          if (near.some(function (tk) { return acx + 40 > tk.x0 && acx - 40 < tk.x1; })) continue;
          var aroom = freeHeight(acx, ah.y0, 34, 80);
          if (aroom < 50) continue;
          fruits.push(makeAmanitas(ax, ah.y0, rand, Math.min(narrow ? 0.95 : 1.1, (aroom - 6) / 56), adir));
          fruitMat(ax, ah, narrow ? 40 : 60, narrow ? 22 : 36);
          placed = true;
        }
      }
      if (placed) break;
    }
    // Plants growing off the lower edge of the contact card, one at each end.
    hosts.forEach(function (hs) {
      if (!hs.always) return;
      var below = H - 3 - hs.y1;
      if (below < 40) return;
      var ps = Math.min(narrow ? 1.1 : 1.35, below / 72), pins = Math.max(46, hs.rad + 22);
      // The pitcher vine grows out past the card's corner on wide screens, inwards on phones.
      fruits.push(makeNepenthes(hs.x1 - pins, hs.y1, ps, narrow ? -1 : 1, rand));
      fruits.push(makeFig(hs, ps, rand));
    });
    return { w: w, h: H, top: top, colonies: colonies, fruits: fruits, hasBorder: hasBorder };
  }

  function f1(v) { return Math.round(v * 10) / 10; }
  function hyphaD(P, every) {
    var n = P.length / 2, d = 'M' + f1(P[0]) + ' ' + f1(P[1]) + 'L';
    for (var k = every; k < n; k += every) d += f1(P[2 * k]) + ' ' + f1(P[2 * k + 1]) + ' ';
    if ((n - 1) % every) d += f1(P[2 * n - 2]) + ' ' + f1(P[2 * n - 1]);
    return d;
  }
  // A strand running beside a hypha and converging on its tip: cords are bundles of hyphae.
  function strandD(P, every, amp, phase) {
    var n = P.length / 2;
    function at(k) {
      var k0 = Math.max(0, k - 1), k1 = Math.min(n - 1, k + 1);
      var tx = P[2 * k1] - P[2 * k0], ty = P[2 * k1 + 1] - P[2 * k0 + 1], L = Math.sqrt(tx * tx + ty * ty) || 1;
      var off = amp * (0.75 + 0.25 * Math.sin(k * 0.19 + phase)) * Math.pow(1 - k / ((n - 1) || 1), 0.5);
      return f1(P[2 * k] - (ty / L) * off) + ' ' + f1(P[2 * k + 1] + (tx / L) * off);
    }
    var d = 'M' + at(0) + 'L';
    for (var k = every; k < n; k += every) d += at(k) + ' ';
    if ((n - 1) % every) d += at(n - 1);
    return d;
  }

  var mycoBuilds = 0;
  function renderMycoSvg(model, className) {
    var id = 'myco' + (++mycoBuilds);
    // Side colonies fade out towards the middle of the page from both edges.
    var out = '<defs><linearGradient id="' + id + 'g" x1="0" x2="1" y1="0" y2="0">' +
      '<stop offset="0" stop-color="#fff"/><stop offset=".13" stop-color="#fff" stop-opacity=".9"/>' +
      '<stop offset=".27" stop-color="#fff" stop-opacity=".4"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset=".73" stop-color="#fff" stop-opacity=".4"/>' +
      '<stop offset=".87" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
      '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="' + model.w + '" height="' + model.h + '">' +
      '<rect width="' + model.w + '" height="' + model.h + '" fill="url(#' + id + 'g)"/></mask></defs>';
    var order = [], tipOwners = [], markOwners = [];
    function markup(kind) {
      var s = '';
      model.colonies.forEach(function (c) {
        if (c.kind !== kind) return;
        s += '<g class="col' + (c.morph && c.morph !== 'effuse' ? ' m-' + c.morph : '') + '">';
        c.hyphae.forEach(function (hy) {
          var d = hyphaD(hy.pts, 2), xs = (hy.pig ? ' pig' : '') + (hy.inv ? ' inv' : '');
          if (hy.gen === 0 && hy.len > 12 && !hy.on) {
            s += '<g class="hy cord g0' + xs + '" style="' + HIDDEN + '"><path pathLength="1" d="' + d + '"/>' +
                 '<path class="strand" pathLength="1" d="' + strandD(hy.pts, 2, 1.5, hy.start + 1) + '"/>' +
                 '<path class="strand" pathLength="1" d="' + strandD(hy.pts, 2, -1.2, hy.start + 4) + '"/></g>';
          } else {
            s += '<path class="hy g' + hy.gen + (hy.on ? ' on' : '') + xs + '" pathLength="1" d="' + d + '" style="' + HIDDEN + '"/>';
          }
          hy.prog = 0;
          hy.tip = null;
          hy.tipState = 0;
          order.push(hy);
          if (hy.gen < NODULE_R.length) {
            s += '<circle class="tip t' + hy.gen + '" r="' + NODULE_R[hy.gen] + '" style="visibility:hidden"/>';
            tipOwners.push(hy);
          }
        });
        (c.marks || []).forEach(function (mk) {
          var r = mk.kind === 'attach' ? 1.8 : CONTACT_R[Math.min(mk.gen, CONTACT_R.length - 1)];
          s += '<circle class="mark ' + mk.kind + '" cx="' + f1(mk.x) + '" cy="' + f1(mk.y) + '" r="' + r +
               '" style="visibility:hidden"/>';
          mk.vis = false;
          markOwners.push(mk);
        });
        s += '</g>';
      });
      return s;
    }
    out += '<g class="runner">' + markup('runner') + '</g>';
    out += '<g class="side" mask="url(#' + id + ')">' + markup('side') + '</g>';
    if (model.fruits && model.fruits.length) {
      out = out.replace('</defs>', fruitDefs(id) + '</defs>');
      out += '<g class="fruit">' + fruitMarkup(model.fruits, id) + '</g>';
    }

    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('viewBox', '0 0 ' + model.w + ' ' + model.h);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = out;
    var els = svg.querySelectorAll('.hy'), dots = svg.querySelectorAll('circle.tip');
    order.forEach(function (hy, i) { hy.el = els[i]; });
    tipOwners.forEach(function (hy, i) { hy.tip = dots[i]; });
    var mks = svg.querySelectorAll('.mark');
    markOwners.forEach(function (mk, i) { mk.el = mks[i]; });
    if (model.fruits && model.fruits.length) bindFruits(svg, model.fruits);
    return svg;
  }

  // Show colony c grown to fraction p (0..1) of its full development.
  function setColony(c, p) {
    if (Math.abs(p - c.lastP) < 0.0004) return;
    c.lastP = p;
    if (c.apply) { c.apply(p); return; }
    var S = p * c.maxStep;
    for (var i = 0; i < c.hyphae.length; i++) {
      var hy = c.hyphae[i], prog = clamp01((S - hy.start) / hy.len);
      if (hy.lyse) {   // overgrown by a more combative mycelium: fades once the invader has passed
        var gone = S >= hy.lyse;
        if (gone !== !!hy.gone) {
          hy.gone = gone;
          hy.el.classList.toggle('lysed', gone);
          if (hy.tip) hy.tip.style.opacity = gone ? '0.08' : '';
        }
      }
      if (prog === hy.prog) continue;
      var was = hy.prog;
      hy.prog = prog;
      var es = hy.el.style, tip = hy.tip;
      if (prog <= 0) {
        es.visibility = 'hidden';
        if (tip) { tip.style.visibility = 'hidden'; hy.tipState = 0; }
        continue;
      }
      if (was <= 0) es.visibility = 'visible';
      es.strokeDashoffset = (1 - prog).toFixed(4);
      if (!tip) continue;
      var P = hy.pts;
      if (prog >= 1) {
        if (hy.cont) {   // the tip carried on as the next segment: no nodule here
          if (hy.tipState !== 0) { tip.style.visibility = 'hidden'; hy.tipState = 0; }
          continue;
        }
        // Finished (or fused): leave a nodule at the end.
        if (hy.tipState !== 2) {
          tip.setAttribute('cx', f1(P[P.length - 2]));
          tip.setAttribute('cy', f1(P[P.length - 1]));
          tip.setAttribute('class', 'tip done t' + hy.gen);
          tip.style.visibility = 'visible';
          hy.tipState = 2;
        }
        continue;
      }
      if (hy.tipState !== 1) {
        tip.setAttribute('class', 'tip t' + hy.gen);
        tip.style.visibility = 'visible';
        hy.tipState = 1;
      }
      var f = prog * hy.len, k = Math.min(Math.floor(f), hy.len - 1), fr = f - k;
      tip.setAttribute('cx', f1(P[2 * k] + (P[2 * k + 2] - P[2 * k]) * fr));
      tip.setAttribute('cy', f1(P[2 * k + 1] + (P[2 * k + 3] - P[2 * k + 1]) * fr));
    }
    if (c.marks) {
      for (var m = 0; m < c.marks.length; m++) {
        var mk = c.marks[m], show = S >= mk.s;
        if (mk.el && show !== mk.vis) { mk.vis = show; mk.el.style.visibility = show ? 'visible' : 'hidden'; }
      }
    }
  }

  // Eased growth: scroll sets each colony's goal; a frame loop moves its shown growth towards it.
  var liveColonies = new Set(), growing = false, lastTick = 0;
  function setGoal(c, p) {
    if (reduceMotion) { setColony(c, p); return; }
    if (c.shown == null) c.shown = c.instant ? p : 0;
    c.goal = p;
    liveColonies.add(c);
    if (!growing) { growing = true; lastTick = 0; requestAnimationFrame(growTick); }
  }
  function growTick(now) {
    var dt = lastTick ? Math.min(64, now - lastTick) : 16;
    lastTick = now;
    liveColonies.forEach(function (c) {
      var d = c.goal - c.shown;
      if (Math.abs(d) < 0.0006) {
        c.shown = c.goal;
        liveColonies.delete(c);
      } else {
        c.shown += d * (1 - Math.exp(-dt / (c.tau || GROW_TAU)));
      }
      setColony(c, c.shown);
    });
    if (liveColonies.size) requestAnimationFrame(growTick);
    else growing = false;
  }

  var mycoItems = [];
  function mountSection(item) {
    var rebuilt = !!item.model;
    if (item.svg) item.svg.remove();
    item.model = buildSectionModel(item.section, item.index);
    // A rebuild after a layout change should show the growth already reached, not regrow it.
    if (rebuilt && item.model) item.model.colonies.concat(item.model.fruits || []).forEach(function (c) { c.instant = true; });
    item.svg = null;
    if (item.model) {
      item.svg = renderMycoSvg(item.model, 'myco');
      item.svg.style.top = -item.model.top + 'px';
      item.svg.style.height = 'calc(100% + ' + item.model.top + 'px)';
      item.section.insertBefore(item.svg, item.section.firstChild);
    }
    item.section.classList.toggle('has-runner', !!(item.model && item.model.hasBorder));
    item.built = true;
    item.w = item.section.clientWidth;
    item.h = item.section.clientHeight;
  }

  var headerHy = null;
  function mountHeaderHypha() {
    if (!header) return;
    if (headerHy) headerHy.svg.remove();
    var w = header.clientWidth, H = 24, y0 = H - 1.5;
    var c = growMycelium({
      origins: [{ x: -3, y: y0, angles: [0], life: 1e4 }],
      speed: [3, 2.2, 1.8], noise: 0.02, noiseBranch: 0.12, avoid: 0.02,
      steer: function (t) { return t.gen === 0 ? angDiff(0, t.a) * 0.18 : 0; },
      clampY: [H - 2.5, H - 0.6], branchEvery: [8, 22], branchAngle: [0.5, 1.0],
      lifeByGen: [null, [2, 5], [1.5, 3]], maxGen: 2, maxHyphae: 400, fuse: 0,
      bounds: [-12, 0, w + 12, H], maxSteps: 2000
    }, seeded(4242));
    c.kind = 'runner';
    c.y = 0;
    c.tau = 180;   // the progress bar should keep up with reading
    var svg = renderMycoSvg({ w: w, h: H, top: 0, colonies: [c] }, 'header-hypha');
    header.appendChild(svg);
    headerHy = { svg: svg, colony: c, w: w };
  }

  var mycoReady = false;
  function updateMyco() {
    if (!mycoReady) return;
    var vh = window.innerHeight;
    var room = Math.max(0, document.documentElement.scrollHeight - vh - window.scrollY);   // scrolling still possible
    // 0 when y comes up to `start` of the screen height, 1 after `span` more. Anything too near the
    // end of the page to get that far up the screen finishes as the bottom of the page is reached.
    function progress(y, start, span) {
      var best = y - room;   // the highest it can still get on screen
      return clamp01((vh * start - y) / Math.max(40, Math.min(span, vh * start - Math.max(0, best) - 1)));
    }
    mycoItems.forEach(function (it) {
      var r = it.section.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      if (!it.built) mountSection(it);   // scrolled here before the idle builder got to it
      if (!it.model || r.bottom < -80 || r.top > vh + 80) return;
      it.model.colonies.forEach(function (c) {
        // Starts as the colony's origin comes up from below the screen, done near the top.
        var y = r.top - it.model.top + c.y;
        var p = reduceMotion ? 1 : progress(y, 1.02, vh * 0.9);
        setGoal(c, p * p * (3 - 2 * p));
      });
      (it.model.fruits || []).forEach(function (f) {
        var y = r.top - it.model.top + f.y;
        var p = reduceMotion ? 1 : progress(y, 1.0, vh * 0.75);
        setGoal(f, p * p * (3 - 2 * p));
      });
    });
    if (headerHy) {
      var max = document.documentElement.scrollHeight - vh;
      setGoal(headerHy.colony, max > 0 ? clamp01(window.scrollY / max) : 0);
    }
  }
  var mycoQueued = false;
  function requestMyco() {
    if (mycoQueued) return;
    mycoQueued = true;
    requestAnimationFrame(function () { mycoQueued = false; updateMyco(); });
  }

  document.querySelectorAll('.section').forEach(function (section, index) {
    mycoItems.push({ section: section, index: index, built: false });
  });
  window.addEventListener('scroll', requestMyco, { passive: true });
  window.addEventListener('resize', requestMyco);

  var whenIdle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 120); };
  whenLayoutReady(function () {
    mycoReady = true;
    mountHeaderHypha();
    updateMyco();   // builds whatever is on or near the screen
    // Build the remaining sections one at a time while the browser is idle.
    (function buildNext() {
      var next = mycoItems.find(function (it) { return !it.built; });
      if (!next) return;
      whenIdle(function () {
        if (!next.built) mountSection(next);
        requestMyco();
        buildNext();
      });
    })();
  });

  // Rebuild a network when its section really changes size (fonts, images, rotation).
  if ('ResizeObserver' in window) {
    var rebuildTimers = new Map();
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        clearTimeout(rebuildTimers.get(el));
        rebuildTimers.set(el, setTimeout(function () {
          if (el === header) {
            if (headerHy && Math.abs(header.clientWidth - headerHy.w) > 1) mountHeaderHypha();
          } else {
            var it = mycoItems.find(function (m) { return m.section === el; });
            if (it && it.built && (Math.abs(el.clientWidth - it.w) > 1 || Math.abs(el.clientHeight - it.h) > 2)) mountSection(it);
          }
          requestMyco();
        }, 160));
      });
    });
    mycoItems.forEach(function (it) { ro.observe(it.section); });
    if (header) ro.observe(header);
  }

  /* ---------- Contact: a click copies the email address or ORCID iD ---------- */
  // Modified clicks (Cmd/Ctrl/Shift/Alt, middle button) still open the link; if copying is not
  // possible the link opens as before.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      if (ok) resolve(); else reject();
    });
  }
  var copyStatus = document.getElementById('copy-status');
  document.querySelectorAll('.contact-links a[data-copy]').forEach(function (a) {
    var handle = a.querySelector('.cl-handle'), icon = a.querySelector('.cl-copy use'), value = a.getAttribute('data-copy'), timer;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      copyText(value).then(function () {
        clearTimeout(timer);
        a.classList.add('copied');
        handle.textContent = 'Copied';
        if (icon) icon.setAttribute('href', '#i-check');
        if (copyStatus) copyStatus.textContent = a.querySelector('.cl-label').textContent.trim() + ' copied to the clipboard';
        timer = setTimeout(function () {
          a.classList.remove('copied');
          handle.textContent = value;
          if (icon) icon.setAttribute('href', '#i-copy');
          if (copyStatus) copyStatus.textContent = '';
        }, 1800);
      }, function () { window.location.href = a.href; });
    });
  });

  /* ---------- Scroll reveal ---------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  }
})();
