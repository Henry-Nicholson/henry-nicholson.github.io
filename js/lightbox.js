/* Photo viewer: click or tap any photo in the page content to see it larger.

   Which photos:
   - Every <img> inside <main> that has alt text, including the thesis charts.
   - Not images inside a link or button, and not the page hero (its background photo).
   - To leave out a photo, give its <img> the attribute data-no-zoom.

   How it behaves:
   - The viewer is a native <dialog>. Esc closes it, keyboard focus stays inside it while it is open,
     and focus returns to the photo afterwards.
   - From the keyboard: press Tab until a photo is selected, then Enter or Space.
   - Arrow keys, the on-screen arrows or a sideways swipe step through every photo on the page.
   - Closing: click or tap anywhere (the photo included), use the close button, press Esc or swipe down.
   - The caption is the photo's own figcaption, with its italics and subscripts, or else its alt text.
   - The page behind does not scroll while the viewer is open.
   - Nothing is built until the first photo is opened, so the viewer adds nothing to page load. */
(function () {
  'use strict';
  if (typeof HTMLDialogElement !== 'function') return;  // very old browsers: photos stay as they are

  var main = document.getElementById('main') || document.body;
  var SKIP = 'a, button, .project-hero, [data-no-zoom]';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  Array.prototype.forEach.call(main.querySelectorAll('img'), function (img) {
    var alt = (img.getAttribute('alt') || '').trim();
    if (!alt || img.closest(SKIP)) return;
    img.classList.add('zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-haspopup', 'dialog');
    img.setAttribute('aria-label', (img.closest('.plot') ? 'Enlarge figure: ' : 'Enlarge photo: ') + alt);
  });

  var dlg, fig, big, cap, count, prevBtn, nextBtn;
  var items = [], index = 0, opener = null, closeTimer = 0, token = 0;

  function button(cls, label, path) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-btn ' + cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>';
    return b;
  }

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'lightbox';
    dlg.setAttribute('aria-label', 'Photo viewer');
    var closeBtn = button('lb-close', 'Close', 'M6 6l12 12M18 6 6 18');
    prevBtn = button('lb-prev', 'Previous photo', 'M15 5l-7 7 7 7');
    nextBtn = button('lb-next', 'Next photo', 'M9 5l7 7-7 7');
    fig = document.createElement('figure');
    fig.className = 'lb-figure';
    big = document.createElement('img');
    big.className = 'lb-img';
    big.decoding = 'async';
    cap = document.createElement('figcaption');
    cap.className = 'lb-caption';
    count = document.createElement('p');
    count.className = 'lb-count';
    fig.appendChild(big);
    fig.appendChild(cap);
    [closeBtn, fig, prevBtn, nextBtn, count].forEach(function (el) { dlg.appendChild(el); });
    document.body.appendChild(dlg);

    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); hide(); });
    prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    // A click or tap anywhere else closes the viewer; a link in a caption still works as a link.
    dlg.addEventListener('click', function (e) { if (!e.target.closest('a')) hide(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });
    // Esc closes the dialog natively, so tidy up when its close event arrives. A late close event from
    // an earlier closing is ignored if the viewer has been opened again since.
    dlg.addEventListener('close', function () { if (!dlg.open) cleanUp(); });
    window.addEventListener('resize', function () { if (dlg.open) fitCaption(); });

    // Swipe sideways to step, swipe down to close. Pinch-zooming, and panning a zoomed-in view,
    // are left to the browser.
    var x0 = 0, y0 = 0, multi = false;
    dlg.addEventListener('touchstart', function (e) {
      multi = e.touches.length > 1;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    dlg.addEventListener('touchmove', function (e) { if (e.touches.length > 1) multi = true; }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (multi || e.touches.length || (window.visualViewport && window.visualViewport.scale > 1.05)) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
      else if (dy > 80 && dy > 1.5 * Math.abs(dx)) hide();
    }, { passive: true });
  }

  // Reserve room under the photo for its caption, so the photo and caption always fit on screen together.
  function fitCaption() {
    fig.style.setProperty('--lb-cap', cap.hidden ? '0px' : cap.offsetHeight + 14 + 'px');
  }

  function show(i) {
    var img = items[i], mine = ++token;
    index = i;
    big.classList.remove('is-ready');
    big.classList.toggle('lb-plot', !!img.closest('.plot'));
    big.alt = img.alt;
    cap.textContent = '';
    var own = img.closest('figure');
    own = own && own.querySelector('figcaption');
    if (own) Array.prototype.forEach.call(own.childNodes, function (n) { cap.appendChild(n.cloneNode(true)); });
    else cap.textContent = img.alt;
    cap.hidden = !cap.textContent.trim();
    count.textContent = (i + 1) + ' / ' + items.length;
    fitCaption();
    // Fade the photo in once it has loaded, so it never appears half-drawn.
    var ready = function () { if (mine === token) big.classList.add('is-ready'); };
    big.onload = big.onerror = ready;
    big.src = img.currentSrc || img.src;
    if (big.complete) ready();
    preload(i + 1);
    preload(i - 1);
  }

  function preload(i) {
    var img = items[(i + items.length) % items.length];
    if (img) new Image().src = img.currentSrc || img.src;
  }

  function step(d) {
    if (items.length > 1) show((index + d + items.length) % items.length);
  }

  function open(img) {
    if (!dlg) build();
    items = Array.prototype.slice.call(main.querySelectorAll('img.zoomable'));
    var i = items.indexOf(img);
    if (i < 0) return;
    clearTimeout(closeTimer);
    opener = img;
    prevBtn.hidden = nextBtn.hidden = count.hidden = items.length < 2;
    dlg.classList.remove('is-open', 'is-closing');
    document.documentElement.classList.add('lb-lock');
    if (!dlg.open) dlg.showModal();
    show(i);
    void dlg.offsetWidth;  // start from the transparent state so the fade-in runs
    dlg.classList.add('is-open');
  }

  function hide() {
    if (!dlg || !dlg.open || dlg.classList.contains('is-closing')) return;
    dlg.classList.remove('is-open');
    dlg.classList.add('is-closing');
    closeTimer = setTimeout(function () {
      if (dlg.open) dlg.close();
      cleanUp();  // straight away: browsers can deliver the dialog's close event late
    }, reduceMotion.matches ? 0 : 200);
  }

  // Runs however the viewer closes (button, click, swipe or Esc). Safe to run twice.
  function cleanUp() {
    clearTimeout(closeTimer);
    dlg.classList.remove('is-open', 'is-closing');
    document.documentElement.classList.remove('lb-lock');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  main.addEventListener('click', function (e) {
    var img = e.target.closest('img.zoomable');
    if (!img || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    open(img);
  });
  main.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('zoomable')) {
      e.preventDefault();
      open(e.target);
    }
  });
})();
