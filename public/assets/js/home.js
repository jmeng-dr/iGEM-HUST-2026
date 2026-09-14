// Home page interactions: (1) scroll-driven preface glow, (2) cursor orb,
// (3) intro wheel carousel, (4) interactive TOC totems.
// (Viewport-height sizing for the preface is handled purely by the CSS `dvh` unit now —
// see home.css — no JS measurement needed for that.)
(function () {
  /* Client-side routing swaps the document, so this file runs again on every navigation
     while everything it attached to window survives. Each listener is recorded as it is
     added and dropped before the next page wires its own — otherwise every navigation would
     leave another scroll handler running against elements that no longer exist. */
  /* Both DOMContentLoaded and astro:page-load fire on the FIRST load, so this would
     initialise twice and double-bind every element listener. The flag lives on <body>,
     which the router replaces on every swap — so it clears itself per page, with no timer
     and no guess about which event wins the race. */
  function bootedAlready(key) {
    if (!document.body) return false;
    if (document.body.dataset[key] === "1") return true;
    document.body.dataset[key] = "1";
    return false;
  }

  var listeners = [];
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    listeners.push([target, type, fn, opts]);
  }
  function offAll() {
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    listeners = [];
  }

  function initPage() {
    initPreface();
    initWheel();
    initStack();
    initTOC();
  }

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

    /* 675, was 450. Every hold on this page was lengthened by half again — see the note on
       WHEEL_STEP_PX below. */
    var EFFECT_DISTANCE_PX = 675; // must match the "+ 675px" in #preface's height, home.css

    /* Split the epigraph into words so each can come into focus in turn — see section 10 of
       home.css. Done in script rather than in the markup so the quote stays one readable
       sentence in the source, and so that a reader with no JS, or one who has asked for less
       motion, simply gets the finished line. <br> and the spaces are carried across
       untouched: rebuilding the line from words alone would lose the author's break. */
    (function focusQuote() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var h = section.querySelector(".quote-mark h2");
      if (!h || h.querySelector(".lit-word")) return;
      var out = [], words = [];
      Array.prototype.slice.call(h.childNodes).forEach(function (node) {
        if (node.nodeType !== 3) { out.push(node); return; }
        node.nodeValue.split(/(\s+)/).forEach(function (piece) {
          if (!piece) return;
          if (/^\s+$/.test(piece)) { out.push(document.createTextNode(piece)); return; }
          var w = document.createElement("span");
          w.className = "lit-word";
          w.textContent = piece;
          out.push(w);
          words.push(w);
        });
      });
      if (!words.length) return;
      h.innerHTML = "";
      out.forEach(function (n) { h.appendChild(n); });
      var attr = section.querySelector(".attribution");
      if (attr) { attr.classList.add("lit-word"); words.push(attr); }
      words.forEach(function (w, i) { w.style.animationDelay = (i * 95) + "ms"; });
    })();

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
    on(window, "scroll", onScroll, { passive: true });
    on(window, "resize", onScroll);
  }

  /* ---------------- 2. Cursor-following orb ("clue") ---------------- */
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
    var dialWrap = document.querySelector(".wheel-dial-wrap");
    var arcs = document.querySelectorAll(".dial-arc");
    var sectors = document.querySelectorAll(".dial-sector");

    /* Restart an animation that is very likely already running: drop the class, force the
       style to be recomputed, put it back. Without the reflow the browser coalesces the two
       changes into no change at all, and stepping quickly through the modules would light
       the first one and then nothing. */
    function relight(el) {
      if (!el) return;
      el.classList.remove("lit");
      void el.offsetWidth;
      el.classList.add("lit");
    }

    /* 450, was 300: a module now takes half again as much scrolling to change. The first
       version was tuned to a scroll wheel, where 300px is two comfortable notches — but a
       trackpad delivers that in one flick, and four modules went by in the time it took to
       read one of them. Everything that HOLDS on this page was stretched by the same factor
       at the same time (the preface effect above, the totems' dwell and the last panel's, in
       home.css), so the page keeps one pace rather than having a slow part and a fast part. */
    var WHEEL_STEP_PX = 450; // must match "1800px" (= this * stops.length) in home.css
    var FADE_MS = 220;       // must be <= the transition duration set on .wp-content in home.css
    var currentIndex = -1;
    var pendingIndex = null; // an index requested mid-fade, applied once the current fade settles

    function writeContent(index) {
      var stop = stops[index];
      stops.forEach(function (s) { s.classList.remove("active"); });
      stop.classList.add("active");
      var d = stop.dataset;
      content.querySelector(".wp-title").textContent = d.title;
      content.querySelector(".wp-tagline").textContent = d.tagline;
      /* One paragraph now, where there used to be three labelled rows. The chapter copy is
         prose: splitting it across What is it / Methods / Consequence would have meant
         writing those headings over text that does not answer them. */
      content.querySelector(".wp-lead").textContent = d.body;
      /* The lens crosses the panel — see "THE LIT REVEAL" in home.css. The row in the list
         needs nothing here; its own colour transition covers it. */
      relight(panel);
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
    /* One full turn. The landing is exact for any value — the term is
       ENTRY_SPIN * (1 - e) and e is exactly 1 at the pin, so it vanishes — but keeping
       it a multiple of 90 means the entrance is indistinguishable from four more clicks
       of the same wheel rather than an unrelated flourish. Runs positive down to zero,
       i.e. anticlockwise, the direction module 2 then continues in. */
    var ENTRY_SPIN = 360;
    /* 0.05 of 860px is a ~43px speck, and only its right half is ever on screen, so it
       starts as a glint at the left edge and opens out of nothing. Interpolated linearly
       rather than geometrically: pow(0.05, 1-e) keeps it tiny until very late and then
       blooms, which reads as a pop rather than as growth. */
    var ENTRY_SCALE = 0.05;

    /* ENTRY_FRACTION is of viewport height, and it decides when the entrance BEGINS,
       counted back from the pin. It is not tuned — it is the one value that makes the
       spin start at the instant the point it spins about crosses into view.

       .wheel-sticky is the first child of .wheel-scroll-track, so track.top is also the
       sticky's top; the wrap is left:0/top:50% of it and .dial's translate(-50%,-50%)
       puts the centre of rotation on that anchor. Writing V for viewport height, the
       centre therefore sits at

           y = track_top + V/2

       and crosses the bottom edge of the screen when y < V, i.e. when

           track_top < V/2      =>   ENTRY_FRACTION = 0.5

       For the record, what the earlier values were doing. 0.75 started it at scrollY
       ~= 562 on a 990px screen — 112px after the preface's colour effect released
       (EFFECT_DISTANCE_PX is 450), with the glow circle still whole in the middle of the
       screen and the dial's centre still half a screen below the fold. 0.45 was the
       opposite error, if a small one: it began 0.05V after the centre had already
       entered. 0.5 is the boundary itself. */
    var ENTRY_FRACTION = 0.5;

    /* THE EXIT. The dial is viewport-fixed and page-level now (see .wheel-dial-wrap in
       home.css), so once the modules are done it can simply stop moving while the page
       keeps scrolling under it, instead of sliding away with the section that used to
       contain it. It goes on turning and growing, and fades out across the totems.

       Progress is read off #toc's own rectangle rather than counted in pixels from the
       release, because #toc follows the wheel's track immediately: its top is at exactly
       V when the track releases, so `1 - top/V` is 0 at the release with nothing to
       measure or keep in sync. Past that, `-top/height` carries it across the section.

         q = 0    the modules have just finished; #toc's top edge is at the bottom of
                  the screen, which is exactly where its slide begins
         q = 0.5  #toc's top edge has reached mid-screen — so the totem panel is over the
                  lower half of the dial, and the dial is at 50%: partly covered, half
                  faded, which is the effect asked for
         q = 1    #toc covers the screen. The panel is opaque, so the dial has to be gone
                  by then; the squared tail below has it invisible well before. */
    var EXIT_SPIN        = 200;   /* deg of further rotation across the exit */
    var EXIT_SCALE       = 2.2;   /* grown to this by the time it is gone */
    var EXIT_MID_OPACITY = 0.5;
    var BASE_OPACITY     = 0.92;  /* matches .dial's opacity in home.css */

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* Measured off the totems' STACK, and off exactly the same run as the hand-off itself —
       which is what keeps the two in step.
       It used to read #toc's own top going from a viewport down to zero. That was the same run
       once, but the stacks overlap by two viewports now rather than one (so that the outgoing
       panel is still pinned while the incoming one rises), and #toc therefore starts moving a
       whole viewport earlier than it used to. A viewport is two modules' worth of scrolling, so
       the wheel began leaving as module 2 ended — with half the sequence still to come. The
       stack's top crossing zero is the moment the panel actually starts rising over the wheel,
       and one viewport later it has covered the screen; that is the exit, and nothing else is. */
    function exitProgress() {
      if (!toc || !toc.parentElement) return 0;
      var V = window.innerHeight || 800;
      return Math.min(1, Math.max(0, -toc.parentElement.getBoundingClientRect().top / V));
    }

    /* progress is 0 where the entrance begins, 1 the moment the track pins and module 1
       is in place. Smoothstep rather than a plain ease-out: it eases IN as well, so the
       growth is centred in the window where the dial is on screen instead of being spent
       in the first third of it, and still decelerates into position at the end. */
    function renderDial(index, progress, exit) {
      if (!dial) return;
      var e = reduceMotion.matches ? 1 : progress * progress * (3 - 2 * progress);
      var rot = -index * 90 + ENTRY_SPIN * (1 - e) - EXIT_SPIN * exit;
      var scale = (ENTRY_SCALE + (1 - ENTRY_SCALE) * e) * (1 + (EXIT_SCALE - 1) * exit);
      /* The 0.75s transition exists for the 90deg module steps. Whenever the transform is
         instead being driven frame by frame off the scroll position — the entrance, and
         now the exit — it has to be off, or the dial trails the scroll by three quarters
         of a second. Clearing the inline value hands it back to the stylesheet. */
      dial.style.transition = (e < 1 || exit > 0) ? "none" : "";
      dial.style.transform =
        "translate(-50%, -50%) rotate(" + rot + "deg) scale(" + scale + ")";

      var op = exit <= 0.5
        ? BASE_OPACITY + (EXIT_MID_OPACITY - BASE_OPACITY) * (exit / 0.5)
        /* Squared, so the second half of the fade drops away early rather than trailing
           a barely-there ghost down the page: at the halfway point of this leg it is
           already at an eighth of the mid opacity, not a half. */
        : EXIT_MID_OPACITY * Math.pow(1 - (exit - 0.5) / 0.5, 2);
      dial.style.opacity = op.toFixed(3);
      /* Fully faded: take the fixed box out of the picture entirely rather than leaving
         an invisible full-height element composited over the rest of the page. */
      /* "visible", not "": clearing the inline value would fall back to the stylesheet,
         which now hides the wrap by default so it cannot flash before it is positioned. */
      if (dialWrap) dialWrap.style.visibility = op < 0.002 ? "hidden" : "visible";
    }

    // Turn the dial 90 degrees per module. The arcs ride along, so marking arc
    // [index] active keeps the highlighted marker at a fixed screen angle while the
    // artwork rotates beneath it. The transform itself is written by renderDial, which
    // has to fold in the entrance as well.
    function turnDial(index) {
      for (var i = 0; i < arcs.length; i++) {
        arcs[i].classList.toggle("active", i === index);
      }
      /* The wheel turns -index*90deg, so sector `index` is the one that ends up at the
         marker — which is why the emphasis is keyed to the same number rather than to a
         measured angle. */
      for (var k = 0; k < sectors.length; k++) {
        sectors[k].classList.toggle("on", k === index);
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
      var V = window.innerHeight || 800;
      var span = V * ENTRY_FRACTION;
      var entry = top <= 0 ? 1 : Math.max(0, 1 - top / span);

      /* One clamp covers all three phases of the dial's vertical position: it rides up
         with the section while the track is still below (top > 0), holds at mid-screen
         for the whole pinned sequence (top <= 0), and goes on holding there once the
         track has released — which IS the exit, with no extra branch. */
      if (dialWrap) {
        dialWrap.style.transform = "translateY(" + (V / 2 + Math.max(0, top)).toFixed(1) + "px)";
      }
      renderDial(index, entry, exitProgress());
    }
    writeContent(0);
    turnDial(0);
    renderDial(0, 0, 0);
    currentIndex = 0; // module 1 is already in the markup on load — no fade-in needed for it
    /* Run once before listening: a reload that restores a mid-page scroll position would
       otherwise leave the dial at its entry size until the reader happened to scroll. */
    onScroll();
    on(window, "scroll", onScroll, { passive: true });
    on(window, "resize", onScroll);
  }

  /* ---------------- 3b. Stacked panels: the hand-off ---------------- */
  /* Two adjacent full-screen blocks cannot share a fixed gap that is both small enough to
     leave no dead space in between and large enough to keep each off screen while the
     other is centred. Writing hm/ht for the two block heights, BOTH endpoints demand the
     same thing:

         block centred, the other must be off screen  ->  gap >= V/2 - h/2

     and a block centred in its own viewport-tall panel contributes (V - h)/2 of margin at
     each end, so the standing gap is (V-hm)/2 + (V-ht)/2 — about twice what is needed.
     Halving it is therefore exactly right, and lands on the boundary rather than past it:
     with the totems centred, the modules' bottom edge sits at y = 0, flush.

     Better still, that constraint only BINDS AT THE ENDPOINTS. In between the gap may go
     tighter than any fixed value could, and since the tightest point IS the effect, it is
     set directly rather than left to emerge from two hand-shaped motion curves:

       T(c) = (V - ht)/2 * (1 - c)      the incoming block, pulled up early. At c = 0 this
                                        puts its top edge exactly on the fold — as early as
                                        it can be without intruding — and at c = 1 it is
                                        zero, so the block lands centred.

       G(c) = mix(G0,G1,c) - D * sin^2(pi*c),  D = SQUEEZE * mid
                                        the gap itself. Its endpoints are forced, not
                                        chosen: G0 = V/2 - hm/2 and G1 = V/2 - ht/2 are
                                        exactly the values at which one block is flush with
                                        an edge of the screen while the other is centred.
                                        The bump dips it toward GAP_MIN in between and
                                        vanishes at both ends, so it disturbs neither.

                                        sin^2, not sin: sin's slope is at its MAXIMUM at
                                        c = 0, so the squeeze demanded its fastest closing
                                        exactly where it had to start from nothing.
                                        sin^2 starts and ends flat.

       M(c) = G(c) - V(1-c) + (hm+ht)/2 + T(c)
                                        the outgoing block's travel, SOLVED from the gap
                                        rather than shaped by hand. It comes out monotonic,
                                        leaving at under half the average rate and ending
                                        at over 1.5x it — which is the squeeze itself: the
                                        incoming block closes on one that is barely moving,
                                        and then that one shoots away. Both endpoints fall
                                        out for free, M(0) = 0 and M(1) = V/2 + hm/2.

     M must never go BACKWARDS, and differentiating says exactly when it would:

         M'(c) = V - G0 - D * b'(c)

     V - G0 is the rate at which scrolling closes the gap on its own; D * b'(c) is the rate
     the curve is asking for. Ask for more than scrolling supplies and the only place the
     difference can come from is pushing the outgoing block DOWN — which is visible as the
     whole section sinking before it rises. So D is capped at (V - G0) / pi, pi being the
     largest b' can be. The squeeze then goes as tight as it can without ever reversing,
     and GAP_MIN is a floor it reaches only where the geometry allows.

     The overlap is still checked outright each frame. By construction it cannot go below
     the minimum actually achieved, but that construction assumes both blocks fit inside
     the viewport and nothing guarantees the content will. */
  function initStack() {
    function contentOf(el) { return el && el.querySelector(":scope > .container"); }
    /* Every panel hands over to the one after it, in the order they appear. This used to name
       the two it knew about — the totems and the video — so a section added between them was
       not part of the choreography at all: it scrolled past normally while the panels around it
       slid and held, and the footer, which is seated against the LAST panel, was pulled up over
       it. Reading the document instead means the sequence is whatever the markup says. */
    var panels = [document.querySelector(".wheel-sticky")]
      .concat(Array.prototype.slice.call(document.querySelectorAll(".stack > section")))
      .filter(Boolean);
    var pairs = [];
    for (var pi = 1; pi < panels.length; pi++) {
      pairs.push({ outEl: panels[pi - 1], inEl: panels[pi] });
    }
    pairs = pairs.filter(function (p) {
      p.out = contentOf(p.outEl); p.in = contentOf(p.inEl);
      return p.out && p.in;
    });
    if (!pairs.length) return;

    /* How hard the squeeze bites, as a FRACTION of the gap that pair starts with — not an
       absolute pixel floor. The two pairs have different block heights, so they start from
       different gaps, and one shared pixel floor made the same setting read as a light
       nudge for one pair and as almost touching for the other. A fraction is the same
       amount of squeeze for both by construction. */
    /* 0.45 rather than 0.75: the top hand-off had been running looser than it was set to,
       because its pull-up was being clobbered (see update()), and that looser value was the
       one that looked right. This is roughly it, now applied to both. */
    /* How far each block's pace departs from a constant one, and therefore how deep the gap
       gets in the middle of the run. 0.18 rather than the 0.45 the old curve used: the two are
       not the same knob. The old one took a hump out of a gap that was otherwise linear; this
       one bends both blocks' paths, and both bends close the gap, so the same number squeezes
       about twice as hard. 0.18 puts the narrowest gap back at the 85px or so the page has been showing, which is also
       the headroom that keeps a fast scroll from closing it completely — see the note in
       update() about the frame the compositor is ahead by. */
    var SQUEEZE = 0.18;
    var GAP_MIN = 8;      /* px: an absolute floor as well, for a pair that starts tiny */
    var PAD = 4;          /* px of hard clearance, for content that does not fit the viewport */
    var ticking = false;

    /* The footer's arrival, treated as one more hand-off. The footer normally begins where
       the last panel's track ends, so it can only appear once that panel's sticky has
       released and the panel is already sliding away. Pulling it up by exactly its own
       height instead makes it rise into view while the panel is STILL pinned, which is
       what lets the panel re-centre into the space left above it rather than scroll off.

       Its own height is the right amount and only the runtime knows it: at the end of the
       document the footer's bottom is on the viewport's bottom, so with this margin the
       panel's sticky releases at precisely the moment the footer reaches its resting
       place. Re-measured on resize, since the footer reflows. */
    var footer = document.querySelector(".site-footer");
    var lastPanel = pairs.length ? pairs[pairs.length - 1].in : null;
    var briefStack = document.querySelector(".stack-brief");
    /* Of viewport height, between the panel landing and the footer coming up. 0.75 to match
       the totems: .stack-hold is 275dvh — one viewport to slide in, THREE QUARTERS for the
       dwell, one to stay pinned while the next panel takes over — so three quarters of a
       viewport is what a dwell is on this page, and the last panel had no reason to be the
       exception. Was 0.5, alongside every other hold here. */
    var VIDEO_DWELL = 0.75;
    /* Whether the footer is allowed to overlap the last panel at all. It rises from BEHIND
       that panel — the panel is the one with a stacking layer — so this only works while the
       panel can vacate the room the footer needs. When it cannot, pulling the footer up does
       not push anything: it slides the footer under the video and leaves the two on top of
       each other. */
    var footerPulls = false;

    function seatFooter() {
      if (!footer) return;
      footer.style.marginTop = "";
      var fh = footer.offsetHeight;
      var Vh = window.innerHeight || 800;
      var hLast = lastPanel ? lastPanel.offsetHeight : 0;
      var navBar = document.querySelector(".site-nav");
      var navHh = navBar ? navBar.getBoundingClientRect().height : 0;
      footerPulls = (Vh - hLast) >= (fh + navHh + 24);
      footer.style.marginTop = footerPulls ? (-fh) + "px" : "";
      /* The last track's height is set here rather than in CSS because the dwell is what we
         actually want to control, and the track has to be one viewport of slide-in, plus
         the dwell, plus the footer's own height for the push. CSS cannot know that last
         term, so .stack-brief's declared height could only ever be a guess at it — and the
         dwell was whatever was left over after the guess. This makes the dwell the stated
         quantity and lets the push take exactly as long as the footer is tall. */
      if (briefStack) {
        /* The track only needs the footer's height on top when the footer is going to travel
           across it. Without the pull it would just be dead scroll. */
        briefStack.style.minHeight =
          Math.round(Vh * (2 + VIDEO_DWELL) + (footerPulls ? fh : 0)) + "px";
      }
    }
    seatFooter();

    function update() {
      ticking = false;
      var V = window.innerHeight || 800;
      var i;
      /* Shifts ACCUMULATE, they are not assigned. The middle panel belongs to both pairs —
         it is the incoming of one and the outgoing of the next — and writing the second
         pair's value over the first's silently dropped the first's pull-up. Its M had been
         solved assuming that pull-up was applied, so the gap came out T larger than
         designed and only the top hand-off was affected, which is exactly why the two
         looked nothing like each other. The two terms are never both non-zero anyway: a
         panel is done arriving before it starts leaving. */
      for (i = 0; i < pairs.length; i++) {
        pairs[i].out.__acc = 0;
        pairs[i].in.__acc = 0;
      }
      for (i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        /* THE RUN HAPPENS AFTER THE INCOMING SECTION HAS PINNED, and that is the whole fix
         * for the hand-off tightening when you scroll fast.
         *
         * It used to run while the incoming section was still travelling up the screen, and
         * measure itself off that travel. So one block was where the BROWSER had put it this
         * frame, and the other was where JAVASCRIPT had put it last frame — and JavaScript is
         * always a frame behind the compositor. The difference between the two landed straight
         * in the gap: measured, the closest the pair came was 69px at 20px a notch, 29 at 60,
         * and MINUS 209 at 300. The error was exactly one frame of scrolling every time, which
         * is why no amount of reshaping the curve touched it — the curve was never the problem.
         *
         * Both blocks are pinned during the run now. The outgoing one already was; the incoming
         * one is parked a viewport below the fold by its own transform until its section sticks
         * at the top of the screen, and only then does it come up — by transform, not by scroll.
         * Neither block's base moves any more, so both are a frame late TOGETHER and the gap
         * between them is exact at any speed. A flick costs the pair drifting a few pixels as a
         * whole, which is not something anyone can see.
         *
         * c is measured off the STACK, not the section: the section stops moving once it pins,
         * which is exactly when the run starts, so it has no progress left to report. The stack
         * keeps scrolling under it. */
        var stack = p.inEl.parentElement;
        var c = Math.min(1, Math.max(0, -stack.getBoundingClientRect().top / V));
        var hm = p.out.offsetHeight, ht = p.in.offsetHeight;

        /* TWO PATHS, NOT A SOLVED GAP — and that is what makes it speed-proof.
         *
         * It used to compute the gap it wanted and solve the outgoing block's offset from it.
         * That looks equivalent and is not, because the two blocks were not moved by the same
         * thing: the incoming one rode the browser's own scroll, while the whole of the
         * outgoing one's 750px exit was a transform written from JavaScript — and JavaScript
         * is always a frame behind the compositor. A frame is a few pixels when you nudge the
         * wheel and two hundred when you flick it, so the gap the pair actually showed was the
         * designed one minus one frame of scrolling. Measured, the closest the two blocks came
         * was 62px at 20px a notch, 22px at 60, and MINUS 215px at 300 — they overlapped.
         *
         * So neither block rides the scroll any more. The V*(1-c) term below cancels the
         * incoming block's native motion and its path is re-imposed as a transform, exactly
         * like the outgoing block's. Both are now the same function of the same c, both are a
         * frame late together, and their DIFFERENCE — which is the only thing anyone looks at —
         * is exact at any speed. What a flick costs is the pair drifting a few pixels as a
         * whole, which nobody can see.
         *
         * The paths themselves are the simplest pair that does the job: the outgoing block
         * accelerates away and the incoming one decelerates in, both monotonic, with w setting
         * how far each departs from a constant pace. That is where "close, then open again"
         * comes from — early in the run the outgoing block has barely started while the
         * incoming one is arriving fast, so the two crowd together; late in the run it is the
         * other way round and they part. No hump is added to anything, and no block's speed
         * ever reverses, which is what used to read as elastic. */
        var P = V / 2 + ht / 2;      /* the incoming block's travel: fold to centred */
        var Q = V / 2 + hm / 2;      /* the outgoing block's travel: centred to gone */
        var w = SQUEEZE;
        /* The gap is at its narrowest in the middle of the run; keep it off GAP_MIN there. */
        var linMid = (P + Q) / 2 - (ht + hm) / 2;
        w = Math.max(0, Math.min(w, (linMid - GAP_MIN) / ((P + Q) / 4)));
        var E = (1 - w) * c + w * (1 - (1 - c) * (1 - c));   /* incoming: fast, then slow */
        var A = (1 - w) * c + w * c * c;                      /* outgoing: slow, then fast */

        /* Pinned at the top of the screen, the incoming section's own top is 0, so the block's
           position is entirely this: a viewport-and-a-half below centre at the start of the run
           and centred at the end. */
        var T = -P * (1 - E);
        var M = Q * A;

        var inTop  = V / 2 - ht / 2 + P * (1 - E);
        var outBot = V / 2 + hm / 2 - M;
        var slack  = inTop - outBot;
        if (slack < PAD) M += PAD - slack;    /* clear the outgoing further, never hold the
                                                 incoming back — that is the dead space */

        p.out.__acc += -M;
        p.in.__acc += -T;

        /* Published for the ?diag=1 overlay. The hand-off is only sound while both blocks fit
           the viewport with room to spare at the two ENDS of the run — one centred with the
           other just off screen — so these two are the numbers that say whether the layout can
           work at this size at all. */
        var endStart = V / 2 - hm / 2;     /* outgoing centred, incoming at the fold */
        var endFinish = V / 2 - ht / 2;    /* incoming centred, outgoing gone */
        if (i === 0) window.__homeDiag = [];
        window.__homeDiag.push(
          "pair" + (i + 1) + " V=" + Math.round(V) +
          " hOut=" + Math.round(hm) + " hIn=" + Math.round(ht) +
          " gap0=" + Math.round(endStart) + " gap1=" + Math.round(endFinish) +
          " w=" + w.toFixed(2) +
          (Math.min(endStart, endFinish) < 40 ? "  <-- TOO TIGHT" : ""));
      }

      /* Re-centre the last panel in what the footer has not taken. The footer covers the
         bottom `enc` pixels, so the free band is [0, V - enc] and its middle is enc/2
         higher than the viewport's — hence the panel moves up by half of what the footer
         moves in, not all of it. */
      if (footer && lastPanel && footerPulls) {
        var enc = Math.min(V, Math.max(0, V - footer.getBoundingClientRect().top));
        /* Re-centre in what the footer has not taken — but only as far as the block still
           FITS there. Half the encroachment is the right shift when the block is smaller
           than the free band; when it is not, that same shift drives its top up behind the
           sticky bar, which is what a shorter screen was showing: a 640px block, a 330px
           footer and a 942px viewport leave 612px of free band, and the block simply does
           not go in it. Clamped so its top can never rise above the bar. */
        var hLast = lastPanel.offsetHeight;
        var navBar = document.querySelector(".site-nav");
        var navH = navBar ? navBar.getBoundingClientRect().height : 0;
        var maxShift = Math.max(0, V / 2 - hLast / 2 - navH - 12);
        lastPanel.__acc += -Math.min(enc / 2, maxShift);
      }

      for (i = 0; i < pairs.length; i++) {
        pairs[i].out.style.setProperty("--shift", pairs[i].out.__acc.toFixed(1) + "px");
        pairs[i].in.style.setProperty("--shift", pairs[i].in.__acc.toFixed(1) + "px");
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    update();
    on(window, "scroll", onScroll, { passive: true });
    on(window, "resize", function () { seatFooter(); onScroll(); });
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
  function boot() {
    if (bootedAlready("homeBooted")) return;
    offAll();
    initPage();
  }
  /* astro:page-load covers the first load as well as every navigation; the readyState check
     is the fallback for a build without <ClientRouter />. */
  /* NOT recorded: offAll() would otherwise remove the very hook that calls it, and every
     navigation after the first would arrive with nothing wired at all. */
    document.addEventListener("astro:page-load", boot);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
