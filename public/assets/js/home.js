// Home page interactions: (1) scroll-driven preface glow, (2) cursor orb,
// (3) intro wheel carousel, (4) interactive TOC totems.
// (Viewport-height sizing for the preface is handled purely by the CSS `dvh` unit now —
// see home.css — no JS measurement needed for that.)
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    initPreface();
    // initCursorOrb();  // disabled — cursor-replacement effect felt more disorienting than
    //                      delightful. Implementation kept intact below; uncomment to bring back.
    initWheel();
    initTOC();
  });

  /* ---------------- 1. Preface: pinned scroll -> glow brighten + expand + bg wash ---------------- */
  /* The page holds still on the preface (via CSS position:sticky, scoped in home.css to
     exactly EFFECT_DISTANCE_PX of extra scroll room — keep the two numbers in sync) while
     this plays out, then releases and scrolls normally. Two things make the effect itself
     read as *instant* rather than gradual: (a) EFFECT_DISTANCE_PX is short and a fixed
     pixel value — not a fraction of viewport height — so a single scroll-wheel/trackpad
     tick already covers all of it, on any device; (b) the progress curve is eased-out
     (fast at the start) instead of linear, so the very first bit of scroll already reads
     as an obvious change instead of an imperceptibly small one. */
  function initPreface() {
    var section = document.getElementById("preface");
    if (!section) return;
    var circle = section.querySelector(".glow-circle");
    var wash = document.getElementById("bg-wash"); // page-level now, not scoped inside #preface
    var cue = section.querySelector(".scroll-cue");
    if (!wash) return;

    var EFFECT_DISTANCE_PX = 450; // must match the "+ 450px" in #preface's height, home.css

    function onScroll() {
      var raw = Math.min(1, Math.max(0, window.scrollY / EFFECT_DISTANCE_PX));
      var progress = 1 - Math.pow(1 - raw, 2); // ease-out: most of the change happens immediately

      // glow brightens & expands slightly
      var scale = 1 + progress * 0.22;
      var glowSpread = 60 + progress * 90;
      circle.style.transform = "scale(" + scale.toFixed(3) + ")";
      circle.style.boxShadow = "0 0 " + glowSpread + "px " + (10 + progress * 20) + "px rgba(244,236,216," + (0.35 + progress * 0.35) + ")";

      // background washes from black to blue-green
      wash.style.opacity = (progress * 0.45).toFixed(3);

      cue.style.opacity = progress > 0.05 ? "0" : "1";
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ---------------- 2. Cursor-following orb ("clue") ---------------- */
  function initCursorOrb() {
    var orb = document.getElementById("cursor-orb");
    if (!orb) return;
    var tx = window.innerWidth * 0.2, ty = window.innerHeight * 0.2; // start near top-left
    var x = tx, y = ty;
    var shown = false;

    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!shown) {
        shown = true;
        orb.classList.add("visible");
        document.body.classList.add("cursor-hidden");
      }
    });
    window.addEventListener("mouseleave", function () {
      orb.classList.remove("visible");
      document.body.classList.remove("cursor-hidden");
    });

    function tick() {
      // easing "lag" gives the orb a floating, trailing feel
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      orb.style.left = x + "px";
      orb.style.top = y + "px";
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- 3. Intro wheel: scroll-driven, steps through the 4 modules ---------------- */
  /* Pinned the same way #preface is (see initPreface) — .wheel-scroll-track is taller than the
     viewport by WHEEL_STEP_PX * stop-count (must match the "+ 1200px" in home.css), and
     position:sticky spends that extra height holding .wheel-sticky in place while this function
     advances one module per WHEEL_STEP_PX of scroll, then releases into #toc. No hover/click
     involved — the wheel-stop list is a pure progress indicator now. */
  function initWheel() {
    var track = document.querySelector(".wheel-scroll-track");
    var stops = document.querySelectorAll(".wheel-stop");
    var panel = document.querySelector(".wheel-panel");
    var content = panel && panel.querySelector(".wp-content");
    if (!track || !stops.length || !panel || !content) return;

    // The medallion dial hanging off the left edge (see home.css section 8). Optional:
    // every page that lacks it still runs the wheel exactly as before.
    var dial = document.getElementById("wheelDial");
    var arcs = document.querySelectorAll(".dial-arc");

    var WHEEL_STEP_PX = 300; // must match "1200px" (= this * stops.length) in home.css
    var FADE_MS = 160;       // must be <= the transition duration set on .wp-content in home.css
    var currentIndex = -1;
    var pendingIndex = null; // an index requested mid-fade, applied once the current fade settles

    function writeContent(index) {
      var stop = stops[index];
      stops.forEach(function (s) { s.classList.remove("active"); });
      stop.classList.add("active");
      var d = stop.dataset;
      content.querySelector(".wp-title").textContent = d.title;
      content.querySelector(".wp-tagline").textContent = d.tagline;
      content.querySelector(".wp-what").textContent = d.what;
      content.querySelector(".wp-methods").textContent = d.methods;
      content.querySelector(".wp-consequence").textContent = d.consequence;
    }

    /* The dial's entrance. It already scrolls up with the section, because the wrap is
       an ordinary absolutely-positioned child of .wheel-sticky; this adds a spin and a
       zoom on TOP of that, both about the same point the module steps already turn
       about, so the centre of rotation never moves relative to the section.

       That the anchor holds still is a property of the transform list, not something
       that needs maintaining. transform-origin is the dial's own centre, and for
       `translate(-50%,-50%) rotate(a) scale(s)` a point maps as translate(rotate(scale(p))):
       the centre is a fixed point of both the rotation and the scale, so whatever a and
       s are, the translate still lands that centre on the wrap's left:0/top:50% anchor.
       Scale and spin therefore cannot drift it.

       ENTRY_SPIN is a full 90deg — the same step the wheel takes between modules — and
       it unwinds to 0 as module 1 arrives, so the entrance reads as one more click of
       the same wheel rather than a separate flourish. It starts positive and runs down
       to zero, i.e. anticlockwise, the direction module 2 will continue in. */
    var ENTRY_SPIN = 90;        // deg of wind-up, unwound to 0 by the time module 1 lands
    var ENTRY_SCALE = 0.55;     // starting size, grown to 1

    /* ENTRY_FRACTION is of viewport height, and it is what decides when the entrance
       BEGINS, counted back from the pin. Getting it wrong is invisible in the code and
       obvious on screen, so the geometry, writing V for viewport height:

         the dial's centre sits at track_top + V/2 (the wrap is left:0/top:50% of a
         viewport-tall .wheel-sticky), and the dial is min(0.92V, 860)px across, so at
         scale s its top edge is at  track_top + V/2 - 430s  and it first crosses the
         bottom of the screen when  track_top < V/2 + 430s.

       At 0.75 the entrance started at track_top = 0.75V, i.e. scrollY ~= 562 on a 990px
       screen — only 112px after the preface's colour effect released (EFFECT_DISTANCE_PX
       is 450) and with the glow circle still whole in the middle of the screen. The dial
       was still below the fold, and worse, the quadratic ease-out was front-loaded: by
       p = 0.5 it was already 75% grown. So the dial did its growing off-screen and by
       the time it was actually readable it was at ~0.8 and barely moving.

       0.45 starts it at track_top = 0.45V, where the dial's top edge is ~285px above the
       bottom of the screen — already visible — so the whole of the growth happens where
       it can be seen. */
    var ENTRY_FRACTION = 0.45;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* progress is 0 where the entrance begins, 1 the moment the track pins and module 1
       is in place. Smoothstep rather than a plain ease-out: it eases IN as well, so the
       growth is centred in the window where the dial is on screen instead of being spent
       in the first third of it, and still decelerates into position at the end. */
    function renderDial(index, progress) {
      if (!dial) return;
      var e = reduceMotion.matches ? 1 : progress * progress * (3 - 2 * progress);
      var rot = -index * 90 + ENTRY_SPIN * (1 - e);
      var scale = ENTRY_SCALE + (1 - ENTRY_SCALE) * e;
      /* The 0.75s transition exists for the 90deg module steps. While the entrance is
         being driven frame by frame off the scroll position it has to be off, or the
         dial trails the scroll by three quarters of a second. Clearing the inline value
         hands it back to the stylesheet for the steps. */
      dial.style.transition = e < 1 ? "none" : "";
      dial.style.transform =
        "translate(-50%, -50%) rotate(" + rot + "deg) scale(" + scale + ")";
    }

    // Turn the dial 90 degrees per module. The arcs ride along, so marking arc
    // [index] active keeps the highlighted marker at a fixed screen angle while the
    // artwork rotates beneath it. The transform itself is written by renderDial, which
    // has to fold in the entrance as well.
    function turnDial(index) {
      for (var i = 0; i < arcs.length; i++) {
        arcs[i].classList.toggle("active", i === index);
      }
    }

    function applyStep(index) {
      if (index === currentIndex) return;
      currentIndex = index;
      turnDial(index);
      pendingIndex = index;
      content.classList.add("fade-out");
      setTimeout(function () {
        writeContent(pendingIndex);
        content.classList.remove("fade-out");
      }, FADE_MS);
    }

    function onScroll() {
      var top = track.getBoundingClientRect().top;
      var scrolledIntoTrack = top > 0 ? 0 : -top;
      var index = Math.min(stops.length - 1, Math.max(0, Math.floor(scrolledIntoTrack / WHEEL_STEP_PX)));
      applyStep(index);
      /* top === 0 is the pin, which is also the moment module 1 is in place, so that is
         where the entrance has to finish: progress 1. It cannot go past 1 once pinned
         (top only goes negative from there) and is clamped at 0 before the section is
         within ENTRY_FRACTION of a screen. renderDial runs on every scroll event, not
         only on a step change, because applyStep returns early when the index is
         unchanged and the entrance moves continuously. */
      var span = (window.innerHeight || 800) * ENTRY_FRACTION;
      var entry = top <= 0 ? 1 : Math.max(0, 1 - top / span);
      renderDial(index, entry);
    }
    writeContent(0);
    turnDial(0);
    renderDial(0, 0);
    currentIndex = 0; // module 1 is already in the markup on load — no fade-in needed for it
    /* Run once before listening: a reload that restores a mid-page scroll position would
       otherwise leave the dial at its entry size until the reader happened to scroll. */
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ---------------- 4. TOC totems: hover -> preview, click -> navigate ---------------- */
  function initTOC() {
    var group = document.querySelector(".toc-totems");
    var totems = document.querySelectorAll(".totem");
    var preview = document.querySelector(".toc-preview");
    var displayLabel = document.querySelector(".totem-display-label");
    if (!group || !totems.length || !preview) return;

    function activate(t) {
      totems.forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      var d = t.dataset;
      preview.classList.remove("idle");
      preview.querySelector(".tp-badge").textContent = d.badge || "";
      preview.querySelector(".tp-badge").style.display = d.badge ? "inline-block" : "none";
      preview.querySelector(".tp-title").textContent = d.title;
      preview.querySelector(".tp-desc").textContent = d.desc;
      // totems are real <a href> elements now (see index.html) — read the link straight off
      // the element itself rather than a separate data-href, so there's one source of truth.
      preview.querySelector(".tp-link").setAttribute("href", t.getAttribute("href"));
      preview.querySelector(".tp-link").textContent = "Open " + d.title + " →";
      preview.querySelector(".tp-link").style.display = "";
      // The shared "stage" image swaps to match whichever figure is hovered — a placeholder
      // label stand-in for a real per-page photo/illustration later.
      if (displayLabel) displayLabel.textContent = d.title;
    }

    // Pulling the mouse off the whole group (not just switching between totems) restores the
    // "nothing selected" idle state, instead of leaving the last-hovered totem stuck highlighted.
    function deactivate() {
      totems.forEach(function (x) { x.classList.remove("active"); });
      preview.classList.add("idle");
      preview.querySelector(".tp-badge").style.display = "none";
      preview.querySelector(".tp-title").textContent = "Hover a totem";
      preview.querySelector(".tp-desc").textContent = "Project · Wet Lab · Human Practices · Team: hover one to preview it here.";
      preview.querySelector(".tp-link").removeAttribute("href");
      preview.querySelector(".tp-link").textContent = "";
      preview.querySelector(".tp-link").style.display = "none";
      if (displayLabel) displayLabel.textContent = "Project";
    }

    totems.forEach(function (t) {
      t.addEventListener("mouseenter", function () { activate(t); });
      t.addEventListener("focus", function () { activate(t); });
    });
    group.addEventListener("mouseleave", deactivate);
    group.addEventListener("focusout", function (e) {
      if (!group.contains(e.relatedTarget)) deactivate();
    });
    deactivate();
  }
})();
