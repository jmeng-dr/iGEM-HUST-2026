// Shared across every wiki page: mobile nav toggle, dropdowns, active-link highlight, ring navigator.
(function () {
  // The cross-document view transition declared in style.css (@view-transition
  // { navigation: auto }) surfaces "AbortError: Transition was skipped" in the
  // console whenever the browser decides to skip it — which it does often, and on
  // real clicks, not just automated ones. A skipped transition is a normal outcome,
  // not a fault, so claim the promises and swallow the rejection rather than
  // leaving an unhandled one to surface as a page error. Guarded because these
  // events only exist where cross-document transitions are supported.
  function settleViewTransition(e) {
    var vt = e && e.viewTransition;
    if (!vt) return;
    if (vt.ready && vt.ready.catch) vt.ready.catch(function () {});
    if (vt.finished && vt.finished.catch) vt.finished.catch(function () {});
    if (vt.updateCallbackDone && vt.updateCallbackDone.catch) vt.updateCallbackDone.catch(function () {});
  }
  window.addEventListener("pagereveal", settleViewTransition);
  window.addEventListener("pageswap", settleViewTransition);

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".nav-toggle");
    var navEl = document.querySelector(".site-nav");
    /* Refreshed by every deliberate interaction with the menu — the Menu button and the
       section headers alike — and read by the scroll handler below. Opening or expanding
       anything changes the bar's height, and the reflow (plus the browser's scroll
       anchoring compensating for it) produces a scroll event that the handler would
       otherwise read as "the reader has moved on" and close everything again. */
    var toggledAt = 0;
    if (toggle && navEl) {
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        toggledAt = Date.now();
        var opening = !navEl.classList.contains("nav-open");
        navEl.classList.toggle("nav-open", opening);
        /* An open menu must never be off screen. Without this it inherits whatever hidden
           state the bar was left in and the whole thing, menu included, sits above the top
           of the viewport. */
        if (opening) navEl.classList.remove("nav-hidden");
      });
    }

    /* Dropdowns (Project / Lab / Human Practices). Every item under one of these is the
       SAME page at a different anchor, so the trigger itself now has a destination —
       the top of that page — and is a real <a>, not a <button>. It used to be a button
       that could only open the menu, which left the most obvious target in the nav doing
       nothing when you clicked it.

       Who opens the menu then:
         - hover devices: CSS already opens it on :hover, so by the time a click lands
           the menu has been readable for a while. The click means "take me to the page"
           and is left alone.
         - keyboard: CSS opens it on :focus-within, so tabbing to the trigger reveals the
           menu and Tab walks into it; Enter navigates.
         - touch, where neither of those fires: the first tap opens the menu (default
           suppressed), and a second tap on the now-open trigger navigates. Otherwise a
           touch user could never see the submenu at all.

       Close on outside click. querySelectorAll — there are three of these per page. */
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    /* Matches the width at which the nav becomes the stacked accordion in style.css. */
    var mobileNav = window.matchMedia("(max-width: 860px)");
    var here = location.pathname.split("/").pop() || "index.html";
    var dropdowns = document.querySelectorAll(".nav-dropdown");
    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector(".nav-drop-trigger");
      if (!trigger) return;
      trigger.addEventListener("click", function (e) {
        var href = trigger.getAttribute("href");
        var isOpen = dropdown.classList.contains("open");

        /* In the stacked menu the trigger is a pure toggle — tapping it again closes it,
           which is what an accordion header does. Its destination is not lost: every menu's
           first item is exactly the page the trigger points at (Project -> Project
           Description, Lab -> Experiments, Human Practices -> Human Practices), so making
           the header navigate as well only cost you the ability to close it. */
        if (!mobileNav.matches && href && (canHover || isOpen)) {
          e.stopPropagation();
          /* Already on the destination page: scroll to the top rather than reloading the
             page to arrive at the same place. */
          if (href.split("/").pop() === here) {
            e.preventDefault();
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            });
          }
          return;                       // otherwise let the link navigate
        }

        e.preventDefault();             // first tap on a touch device: just open the menu
        e.stopPropagation();
        /* Expanding a section makes the bar taller, and the browser's scroll anchoring then
           adjusts scrollY to keep the page visually still — a real scroll event, which the
           handler below would read as "the reader has moved on" and use to close the whole
           menu. Any deliberate touch inside the menu refreshes the same window the Menu
           button uses. */
        toggledAt = Date.now();
        var willOpen = !isOpen;
        dropdowns.forEach(function (d) {
          d.classList.remove("open");
          d.querySelector(".nav-drop-trigger").setAttribute("aria-expanded", "false");
        });
        if (willOpen) {
          dropdown.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });
    document.addEventListener("click", function () {
      dropdowns.forEach(function (d) {
        d.classList.remove("open");
        d.querySelector(".nav-drop-trigger").setAttribute("aria-expanded", "false");
      });
    });

    /* The bar's own scroll behaviour, on phones only.

       It TRACKS the scroll rather than snapping between two states: the amount it is
       translated up is accumulated from the scroll delta and clamped to its own height, so
       it slides away and back under the finger at 1:1 instead of animating in and out once
       a threshold is crossed. There is deliberately no CSS transition while this is
       happening — a transition would make it lag the gesture it is supposed to be following.
       .nav-snap adds one only for the moves the reader did not make: revealing it after an
       anchor jump, which would otherwise appear from nowhere.

       Its height is measured, not assumed, and the same number sets the scroll container's
       scroll-padding-top so an anchor lands clear of the bar rather than underneath it.
       Measured only while the menu is CLOSED — with it open the bar is most of the screen
       tall, and a submenu item that jumps to an anchor is tapped in exactly that state. */
    if (navEl) {
      var navH = 0;
      var reduceMo = window.matchMedia("(prefers-reduced-motion: reduce)");
      var hidden = 0;                 // px the bar is currently translated up
      var lastY = window.scrollY;
      var navTicking = false;
      /* A jump to an anchor is a large scroll the reader did not perform, and with
         scroll-behavior:smooth it arrives as a whole run of events. On a slow load the
         browser can also apply it well after DOMContentLoaded, which is why `load` re-arms
         this rather than only the initial hash check doing so. */
      /* True from the moment a jump is asked for until the reader's next real gesture (or a
         generous ceiling, in case no gesture ever comes). A clock alone could not do this:
         a smooth scroll across a long page takes as long as it takes, and any window short
         enough to feel responsive was sometimes shorter than the scroll it was meant to
         cover. A touch is the unambiguous end of "the browser is still moving the page". */
      var anchorActive = !!location.hash;
      var anchorTimer = 0;
      function claimAnchor() {
        anchorActive = true;
        lastY = window.scrollY;
        clearTimeout(anchorTimer);
        anchorTimer = setTimeout(function () { anchorActive = false; }, 2500);
        revealNav();
      }
      /* Nothing hides the bar until the reader has physically touched the screen. Every
         scroll before that is the browser's — restoring a position, landing on a fragment,
         re-landing after the fonts swap — and none of it is someone reading their way down
         the page. This is a fact about the session rather than a window of time, which is
         why it replaces guessing how long a cold load might take. */
      /* ONE signal: the reader has actually MOVED the page. Not touchstart, not pointerdown
         — a tap is not a decision to read downwards, and both of those fire on the very tap
         that asked for the jump. Using them meant a single touch anywhere cancelled the
         protection while the browser was still doing its own scrolling (its native fragment
         landing, then the re-land after the fonts swap), which is why arriving at a page
         from outside lost the bar while jumping around inside the same page kept it. */
      var readerScrolled = false;
      ["wheel", "touchmove", "keydown"].forEach(function (ev) {
        window.addEventListener(ev, function () {
          readerScrolled = true;
          anchorActive = false;      // the reader has taken over; stop protecting the jump
          pendingTarget = null;      // and stop correcting a landing they have moved past
        }, { passive: true });
      });

      /* Scroll to an anchor by ARITHMETIC rather than asking the browser to put an element
         "at the start". That alignment turned out not to be something to rely on here: with
         identical markup and the same scroll-padding-top it landed exactly on the line on
         one page and 93px — the headings' collapsed top margin — below it on another, and
         there is no reading of the spec that makes the difference predictable. This is one
         subtraction and it cannot be interpreted two ways:

             where the target is now, in document coordinates, minus the bar, minus a gap.

         CSS keeps scroll-padding-top as the no-script fallback. */
      /* How much of the LAYOUT viewport's top is currently hidden behind the browser's own
         chrome. On Android Chrome this is 93px right after a cross-page navigation, because
         the URL bar re-expands over the page without changing scrollY — which is the whole
         reason arriving from another page behaved differently from jumping within one. */
      function chromeInset() {
        return window.visualViewport ? Math.round(window.visualViewport.offsetTop) : 0;
      }

      /* The target of the jump we are still settling, kept so the landing can be REDONE.
         chromeInset() is only correct at the instant it is read, and the URL bar expands
         after the navigation, not before it — so a landing computed at the moment of the
         jump is off by however much the bar then took, every time. Recomputing when the
         visual viewport changes is the only way the two can agree. Cleared the moment the
         reader scrolls, so this can never fight them. */
      var pendingTarget = null;

      function jumpTo(target, smooth) {
        pendingTarget = target;
        measureNav();
        var top = window.scrollY + target.getBoundingClientRect().top
                  - (chromeInset() + (navH || 77) + 10);
        D.insetAtJump = chromeInset();
        D.jump = "to " + Math.round(top) + " (from " + Math.round(window.scrollY) +
                 ", rect.top " + Math.round(target.getBoundingClientRect().top) +
                 ", navH " + navH + ")";
        /* A correction worth less than a couple of pixels is not worth a repaint. Landing
           runs up to four times — the browser's own jump, then after load, after the fonts
           swap, and again when the URL bar changes the inset — and the ones that change
           nothing are pure flicker. */
        if (!smooth && Math.abs(top - window.scrollY) < 3) return;
        window.scrollTo({
          top: Math.max(0, Math.round(top)),
          behavior: smooth && !reduceMo.matches ? "smooth" : "auto"
        });
      }

      /* Stick BELOW the browser chrome, not below the layout viewport's top. sticky top:0
         pins to the layout viewport, and while the URL bar is overlaying the first 93px the
         bar was pinned inside the band nobody can see — measurably present, correctly
         positioned, and invisible. */
      function syncStickyTop() {
        var o = chromeInset();
        navEl.style.top = o ? o + "px" : "";
      }

      function measureNav() {
        if (navEl.classList.contains("nav-open")) return;
        var h = Math.round(navEl.getBoundingClientRect().height);
        if (!h || h === navH) return;
        navH = h;
        document.documentElement.style.scrollPaddingTop = (h + 10) + "px";
      }

      function applyNav() {
        navEl.style.transform = hidden ? "translateY(" + (-hidden) + "px)" : "";
      }
      function revealNav() {
        hidden = 0;
        navEl.classList.add("nav-snap");
        applyNav();
      }

      function navScroll() {
        navTicking = false;
        var y = window.scrollY;
        var dy = y - lastY;
        lastY = y;
        if (!dy) return;
        D.scrolls++;
        var ci = chromeInset();
        if (ci > D.insetMax) D.insetMax = ci;
        navEl.classList.remove("nav-snap");   // from here on it follows the gesture

        if (navEl.classList.contains("nav-open")) {
          /* Ignore the reflow that opening or expanding the menu itself caused. */
          if (Date.now() - toggledAt > 500 && Math.abs(dy) > 6) {
            navEl.classList.remove("nav-open");
            dropdowns.forEach(function (d) {
              d.classList.remove("open");
              d.querySelector(".nav-drop-trigger").setAttribute("aria-expanded", "false");
            });
          }
          return;
        }
        if (!mobileNav.matches) { hidden = 0; applyNav(); return; }
        if (!readerScrolled) { revealNav(); return; }
        if (anchorActive) { revealNav(); return; }

        if (!navH) measureNav();
        var before = hidden;
        hidden = Math.min(navH, Math.max(0, hidden + dy));
        if (!before && hidden) D.firstHide = "dy=" + Math.round(dy) + " y=" + Math.round(y);
        applyNav();
      }

      measureNav();
      syncStickyTop();
      if (window.visualViewport) {
        var onViewportChange = function () {
          syncStickyTop();
          if (!readerScrolled && pendingTarget) jumpTo(pendingTarget, false);
        };
        visualViewport.addEventListener("resize", onViewportChange);
        visualViewport.addEventListener("scroll", onViewportChange);
      }
      window.addEventListener("scroll", function () {
        if (!navTicking) { navTicking = true; requestAnimationFrame(navScroll); }
      }, { passive: true });
      window.addEventListener("resize", function () { measureNav(); revealNav(); });

      /* Same-page fragment jumps are performed HERE rather than left to the browser.

         .site-nav is position:sticky, so it occupies real space in the flow: with the menu
         expanded the bar is some 500px taller and everything below it has been pushed down
         by that much. The browser computes a fragment jump's destination in exactly that
         state — you tap an item while the menu is open — and then the menu closes and the
         content springs back up, leaving the page parked where the target used to be. That
         is why jumping WITHIN a page was wrong while arriving from another page was right:
         a fresh page has no expanded menu to distort it.

         So: close the menu first, let the layout settle for two frames, re-measure the bar,
         and only then scroll. Nothing here has to guess, because nothing moves afterwards.

         Cross-page links are left alone — the navigation handles those, and reland corrects
         for the font swap on the far side. */
      var D = (window.__navDiag = {
        path: "none", href: "", file: "", here: here, found: null,
        reland: "not run", scrolls: 0, firstHide: "", jump: "none",
        insetAtLoad: (window.visualViewport ? Math.round(visualViewport.offsetTop) : 0),
        insetAtJump: "-", insetMax: 0
      });
      Object.defineProperty(D, "state", { get: function () {
        return "readerScrolled=" + readerScrolled + " anchorActive=" + anchorActive +
               " hidden=" + Math.round(hidden) + " navH=" + navH;
      }});
      document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href*="#"]');
        if (!a) { D.path = "not-a-fragment-link"; return; }
        claimAnchor();

        D.href = a.getAttribute("href") || "";
        if (a.closest(".page-sidenav")) { D.path = "sidenav (pagenav.js)"; return; }
        var parts = D.href.split("#");
        if (!parts[1]) { D.path = "no fragment"; return; }
        var file = parts[0].split("/").pop();
        D.file = file;
        if (file && file !== here) { D.path = "cross-page -> browser"; return; }
        var target = document.getElementById(decodeURIComponent(parts[1]));
        D.found = !!target;
        if (!target) { D.path = "target MISSING"; return; }
        D.path = "handled here";

        e.preventDefault();
        navEl.classList.remove("nav-open");
        dropdowns.forEach(function (d) {
          d.classList.remove("open");
          d.querySelector(".nav-drop-trigger").setAttribute("aria-expanded", "false");
        });
        history.replaceState(null, "", "#" + parts[1]);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            jumpTo(target, true);
            claimAnchor();
          });
        });
      }, true);
      window.addEventListener("hashchange", claimAnchor);
      mobileNav.addEventListener("change", revealNav);

      /* Land on the anchor AGAIN once the web fonts have swapped in.
         Cormorant Garamond and Inter load with display=swap, so the first paint uses
         fallback metrics and every heading and paragraph re-measures when the real faces
         arrive. On a phone the browser's jump to the fragment usually happens before that,
         and the page then shifts underneath it by however much text sits above the target —
         which is why the error was different for every anchor instead of constant.

         Only while the reader has not taken over: any real input cancels it, so this can
         never yank the page out from under someone. */
      if (location.hash) {
        var reland = function () {
          if (readerScrolled) { D.reland = "skipped: reader already scrolled"; return; }
          var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
          if (!t) { D.reland = "skipped: no target"; return; }
          D.reland = "ran";
          measureNav();
          jumpTo(t, false);
          claimAnchor();
        };
        var relandSoon = function () { requestAnimationFrame(function () { requestAnimationFrame(reland); }); };
        window.addEventListener("load", relandSoon);
        /* Two frames after the promise: fonts.ready resolves when the faces are usable, which
           is before the reflow they cause has been laid out. Measuring on the same tick would
           read the position the correction is supposed to be correcting. */
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(relandSoon);
      }
    }


    /* Which page you are on. The dropdown trigger is a real link to its section's page, so
       it matches too — it gets the class, marking the section, while aria-current is left to
       the precise item that trackSection settles on below. Two elements both announcing
       themselves as the current page would be worse than neither. */
    document.querySelectorAll(".site-nav nav a").forEach(function (a) {
      var target = (a.getAttribute("href") || "").split("/").pop();
      if (target !== here) return;
      var parentDropdown = a.closest(".nav-dropdown");
      if (parentDropdown) {
        parentDropdown.querySelector(".nav-drop-trigger").classList.add("active");
      } else {
        a.classList.add("active");
        a.setAttribute("aria-current", "page");
      }
    });

    /* Which SECTION of that page you are in, tracked live.
       The pass above matches an href against the pathname, which no entry carrying a
       fragment can ever satisfy — "Wet-Lab-Experiments.html#safety".split("/").pop() keeps
       the "#safety" — so without this the only item ever marked was the one without a
       fragment, and it stayed marked however far down the page you scrolled.

       Same rule as the desktop "on this page" rail in pagenav.js: the current section is the
       last one whose top has passed a line just below the bar. The fragment-less entry owns
       everything above the first anchored section, which is the page's own introduction. */
    (function trackSection() {
      var items = [];
      document.querySelectorAll(".site-nav .nav-drop-item").forEach(function (a) {
        var parts = (a.getAttribute("href") || "").split("#");
        var file = parts[0].split("/").pop();
        if (file !== here && file !== "") return;
        var target = parts[1] ? document.getElementById(parts[1]) : null;
        if (parts[1] && !target) return;          // a fragment with nothing to point at
        items.push({ el: a, target: target });
      });
      var anchored = items.filter(function (i) { return i.target; });
      if (!items.length || !anchored.length) return;

      var LINE = 140;                             // just below the bar, as in pagenav.js
      var secTicking = false;

      function update() {
        secTicking = false;
        var current = null;
        for (var j = 0; j < items.length; j++) if (!items[j].target) { current = items[j]; break; }
        if (!current) current = anchored[0];
        for (var i = 0; i < anchored.length; i++) {
          if (anchored[i].target.getBoundingClientRect().top <= LINE) current = anchored[i];
          else break;
        }
        /* At the very bottom the last section may be too short to ever cross the line. */
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          current = anchored[anchored.length - 1];
        }
        items.forEach(function (i) {
          var on = i === current;
          i.el.classList.toggle("active", on);
          if (on) i.el.setAttribute("aria-current", "true");
          else i.el.removeAttribute("aria-current");
        });
      }
      function onScroll() {
        if (!secTicking) { secTicking = true; requestAnimationFrame(update); }
      }
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      window.addEventListener("hashchange", onScroll);
    })();


    // Ring navigator: floating bubble (fixed bottom-right, every page) opens a full-screen
    // ring menu of the 5 top-level destinations. Escape / outside-click / the close button
    // all dismiss it; focus moves into the ring on open and back to the bubble on close.
    var ringTrigger = document.getElementById("ringNavTrigger");
    var ringNav = document.getElementById("ringNav");
    var ringClose = document.getElementById("ringNavClose");
    if (ringTrigger && ringNav) {
      function openRing() {
        ringNav.classList.add("open");
        ringNav.setAttribute("aria-hidden", "false");
        ringTrigger.setAttribute("aria-expanded", "true");
        var firstNode = ringNav.querySelector(".ring-node");
        if (firstNode) firstNode.focus();
      }
      function closeRing() {
        ringNav.classList.remove("open");
        ringNav.setAttribute("aria-hidden", "true");
        ringTrigger.setAttribute("aria-expanded", "false");
        ringTrigger.focus();
      }
      ringTrigger.addEventListener("click", openRing);
      if (ringClose) ringClose.addEventListener("click", closeRing);
      ringNav.addEventListener("click", function (e) {
        if (e.target === ringNav) closeRing();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && ringNav.classList.contains("open")) closeRing();
      });
      ringNav.querySelectorAll(".ring-node").forEach(function (n) {
        var target = n.getAttribute("href").split("/").pop();
        if (target === here) n.classList.add("active");
      });
    }
  });
})();

/* ---------------------------------------------------------------------------
   TEMPORARY diagnostic. Runs only when the URL carries ?diag=1, and prints the
   numbers that decide where a fragment jump lands, so this can be settled by
   measurement instead of by inference from screenshots. Delete once it has.

   Open e.g.  .../Project-Description.html?diag=1#modelling
   --------------------------------------------------------------------------- */
(function () {
  /* Sticks for the session: nav links carry no query string, so switching it on once has
     to survive the very navigation being investigated. ?diag=0 turns it off. */
  var on = false;
  try {
    if (location.search.indexOf("diag=0") >= 0) sessionStorage.removeItem("navdiag");
    else if (location.search.indexOf("diag") >= 0) sessionStorage.setItem("navdiag", "1");
    on = sessionStorage.getItem("navdiag") === "1";
  } catch (e) { on = location.search.indexOf("diag") >= 0; }
  if (!on) return;
  document.addEventListener("DOMContentLoaded", function () {
    var box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:10px;" +
      "background:rgba(11,15,16,.93);color:#9fe;font:11px/1.45 ui-monospace,monospace;" +
      "white-space:pre-wrap;max-height:52vh;overflow:auto;pointer-events:none";
    document.body.appendChild(box);

    function report() {
      var nav = document.querySelector(".site-nav");
      var id = decodeURIComponent(location.hash.slice(1));
      var t = id && document.getElementById(id);
      var L = [];
      L.push("viewport " + innerWidth + "x" + innerHeight + "  dpr " + devicePixelRatio);
      L.push("scrollY " + Math.round(scrollY) + "   fonts " +
             (document.fonts ? document.fonts.status : "n/a"));
      L.push("scroll-padding-top " + getComputedStyle(document.documentElement).scrollPaddingTop);
      var D = window.__navDiag;
      if (D) {
        L.push("last click: " + D.path + "  href=" + (D.href || "-"));
        L.push("nav state: " + D.state);
        L.push("jumpTo: " + D.jump);
        L.push("chrome inset: atLoad=" + D.insetAtLoad + " atJump=" + D.insetAtJump +
               " max=" + D.insetMax + " now=" +
               (window.visualViewport ? Math.round(visualViewport.offsetTop) : 0));
        L.push("reland: " + D.reland + "   scroll events: " + D.scrolls +
               (D.firstHide ? "   first hide at " + D.firstHide : "   never hid"));
      }
      if (nav) {
        var nr = nav.getBoundingClientRect();
        var ns = getComputedStyle(nav);
        L.push("NAV rect top " + Math.round(nr.top) + " h " + Math.round(nr.height) +
               "  pos " + ns.position + "  z " + ns.zIndex +
               "  vis " + ns.visibility + "  opa " + ns.opacity + "  disp " + ns.display);
        L.push("NAV transform inline '" + (nav.style.transform || "") +
               "'  computed " + ns.transform);
        L.push("body: " + getComputedStyle(document.body).display +
               " / " + getComputedStyle(document.body).overflow +
               "   html overflow " + getComputedStyle(document.documentElement).overflow);
      }
      if (window.visualViewport) {
        var v = window.visualViewport;
        L.push("visualViewport h " + Math.round(v.height) + " offsetTop " +
               Math.round(v.offsetTop) + " pageTop " + Math.round(v.pageTop) +
               "   innerHeight " + window.innerHeight);
      }
      if (!t) { L.push("no hash target"); box.textContent = L.join("\n"); return; }
      var h = t.querySelector("h2");
      var tr = t.getBoundingClientRect();
      L.push("target #" + id + "  <" + t.tagName.toLowerCase() + ">  top " + Math.round(tr.top));
      if (h) {
        var hr = h.getBoundingClientRect();
        var cs = getComputedStyle(h);
        L.push("  h2 top " + Math.round(hr.top) +
               "   h2-minus-section " + Math.round(hr.top - tr.top) + "  (0 = margins collapse)");
        L.push("  h2 display " + cs.display + "  width " + cs.width + "  margin-top " + cs.marginTop);
      }
      L.push("  LANDED: heading is " + Math.round(h ? h.getBoundingClientRect().top : tr.top) +
             "px from the top of the viewport");
      box.textContent = L.join("\n");
    }
    report();
    addEventListener("scroll", function () { requestAnimationFrame(report); }, { passive: true });
    addEventListener("resize", report);
    /* The page can move without a scroll event — the URL bar collapsing, for one — so keep
       the readout live rather than trusting that something notified us. */
    setInterval(report, 250);
    if (window.visualViewport) {
      visualViewport.addEventListener("resize", report);
      visualViewport.addEventListener("scroll", report);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(report);
  });
})();
