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

    // Turn the dial 90 degrees per module. The arcs ride along, so marking arc
    // [index] active keeps the highlighted marker at a fixed screen angle while the
    // artwork rotates beneath it.
    function turnDial(index) {
      if (dial) dial.style.transform = "translate(-50%, -50%) rotate(" + (-index * 90) + "deg)";
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
    }
    writeContent(0);
    turnDial(0);
    currentIndex = 0; // module 1 is already in the markup on load — no fade-in needed for it
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
