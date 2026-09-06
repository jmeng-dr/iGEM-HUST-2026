// Shared across every wiki page: mobile nav toggle, dropdowns, active-link highlight, ring navigator.
(function () {
  /* Debug mode. Decided once, here, so the instrumentation below can be skipped rather
     than merely ignored — it used to build strings and count events for every visitor.
     Sticks for the session because nav links carry no query string and the thing most
     worth investigating is a navigation; ?diag=0 clears it. */
  var DIAG = (function () {
    try {
      if (location.search.indexOf("diag=0") >= 0) sessionStorage.removeItem("navdiag");
      else if (location.search.indexOf("diag") >= 0) sessionStorage.setItem("navdiag", "1");
      return sessionStorage.getItem("navdiag") === "1";
    } catch (e) { return location.search.indexOf("diag") >= 0; }
  })();
  window.__navDiagOn = DIAG;   // the overlay at the foot of this file reads it

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

  /* Split in two, because client-side routing means the document is swapped rather than
     rebuilt and the two halves have different lifetimes:

       initOnce()    everything bound to window, to document, or to .site-nav — which
                     carries transition:persist and therefore survives every navigation.
                     Binding any of these per page would stack a new listener each time.
       refreshPage() everything that describes THIS page: which link is current, which
                     sections exist to track, the nav's light/dark variant, and the state
                     the anchor machinery starts a page with.

     astro:page-load fires on the first load as well as on every navigation, so it is the
     single entry point; boot() runs initOnce at most once and refreshPage always. */
  var here = "";
  var booted = false;
  /* Assigned inside initOnce so they close over its locals; called by refreshPage. */
  var markCurrentPage = function () {};
  var buildSectionTracking = function () {};
  var refreshNavState = function () {};

  function initOnce() {
    var resetAnchorState = function () {};   // assigned inside the `if (navEl)` block below
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
          /* Already on the destination page? The document-level handler above owns that
             case now — for every link on the page, not just this one — so there is nothing
             to do here but let it through. */
          return;
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
    function closeDropdowns() {
      dropdowns.forEach(function (d) {
        d.classList.remove("open");
        d.querySelector(".nav-drop-trigger").setAttribute("aria-expanded", "false");
      });
    }
    document.addEventListener("click", closeDropdowns);

    /* Escape closes what is open, innermost first, and hands focus back to the control that
       opened it. Expected of anything that expands, and the stacked menu covers most of a
       phone screen with no other way out from a keyboard. */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !navEl) return;
      var anyOpen = false;
      dropdowns.forEach(function (d) { if (d.classList.contains("open")) anyOpen = true; });
      if (anyOpen) {
        closeDropdowns();
        e.stopPropagation();
        return;
      }
      if (navEl.classList.contains("nav-open")) {
        navEl.classList.remove("nav-open");
        if (toggle) toggle.focus();
        e.stopPropagation();
      }
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
      var relandBudget = 0;

      function jumpTo(target, smooth) {
        if (target !== pendingTarget) relandBudget = 5;   // a new destination, a fresh budget
        pendingTarget = target;
        measureNav();
        var top = window.scrollY + target.getBoundingClientRect().top
                  - (chromeInset() + (navH || 77) + 10);
        if (DIAG) {
          D.insetAtJump = chromeInset();
          D.jump = "to " + Math.round(top) + " (from " + Math.round(window.scrollY) +
                   ", rect.top " + Math.round(target.getBoundingClientRect().top) +
                   ", navH " + navH + ")";
        }
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
        if (DIAG) {
          D.scrolls++;
          var ci = chromeInset();
          if (ci > D.insetMax) D.insetMax = ci;
        }
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
        /* Desktop never hides the bar, so there is nothing to write; the old code cleared
           a transform that had never been set, once per scroll frame. */
        if (!mobileNav.matches) { if (hidden) { hidden = 0; applyNav(); } return; }
        if (!readerScrolled) { revealNav(); return; }
        if (anchorActive) { revealNav(); return; }

        if (!navH) measureNav();
        var before = hidden;
        hidden = Math.min(navH, Math.max(0, hidden + dy));
        if (DIAG && !before && hidden) D.firstHide = "dy=" + Math.round(dy) + " y=" + Math.round(y);
        applyNav();
      }

      measureNav();
      syncStickyTop();
      if (window.visualViewport) {
        var onViewportChange = function () {
          syncStickyTop();
          /* Correcting the landing when the inset changes is necessary — the URL bar expands
             after the jump — but it must be able to STOP. jumpTo scrolls, scrolling moves
             the visual viewport, and that fires this again; without a budget an idling URL
             bar could keep nudging the page indefinitely. Five is more than the two or three
             the real sequence needs, and jumpTo already declines a correction under 3px. */
          if (readerScrolled || !pendingTarget || relandBudget <= 0) return;
          relandBudget--;
          jumpTo(pendingTarget, false);
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
        /* Never take over a click the reader has qualified. Ctrl/Cmd/Shift/Alt and the
           middle button all mean "open this somewhere else", and preventDefault would have
           silently swallowed every one of them. defaultPrevented likewise: something closer
           to the element has already decided. */
        if (e.defaultPrevented || e.button !== 0 ||
            e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        /* Any link to somewhere on THIS page, whether it names a fragment or not. Matching
           only on a "#" in the href missed the commonest one of all: the nav entry for the
           page you are already on, and the brand mark, which point at the page itself. Those
           fell through to the router, which navigates to the same address and lands you at
           the top with no movement at all — the jump this was written to animate.

           Compared as resolved URLs rather than by splitting filenames: that settles
           relative paths, query strings and the origin in one step, and a mailto: or an
           external link simply is not same-origin. */
        var a = e.target.closest && e.target.closest("a[href]");
        if (!a) { if (DIAG) D.path = "not-a-link"; return; }
        if (a.target && a.target !== "_self") return;      // opens elsewhere; not ours
        if (a.hasAttribute("download")) return;

        var url;
        try { url = new URL(a.href, location.href); } catch (err) { return; }
        if (DIAG) D.href = a.getAttribute("href") || "";
        if (url.origin !== location.origin) { if (DIAG) D.path = "external"; return; }
        if (url.pathname !== location.pathname) { if (DIAG) D.path = "other page -> router"; return; }
        if (a.closest(".page-sidenav")) { if (DIAG) D.path = "sidenav (pagenav.js)"; return; }
        /* In the stacked menu a section header is a pure accordion toggle, and this handler
           runs in the capture phase — so without this it would take the tap before the
           toggle ever saw it and scroll to the top of a page you were already on instead of
           opening the section. */
        if (mobileNav.matches && a.classList.contains("nav-drop-trigger")) {
          if (DIAG) D.path = "stacked-menu toggle";
          return;
        }

        claimAnchor();
        var frag = decodeURIComponent(url.hash.slice(1));
        var target = frag ? document.getElementById(frag) : null;
        if (frag && !target) { if (DIAG) D.path = "target MISSING"; return; }
        if (DIAG) D.path = target ? "handled here" : "same page -> top";

        e.preventDefault();
        navEl.classList.remove("nav-open");
        dropdowns.forEach(function (d) {
          d.classList.remove("open");
          d.querySelector(".nav-drop-trigger").setAttribute("aria-expanded", "false");
        });
        history.replaceState(null, "", target ? "#" + frag : url.pathname);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (target) jumpTo(target, true);
            else window.scrollTo({ top: 0, behavior: reduceMo.matches ? "auto" : "smooth" });
            claimAnchor();
            if (!target) return;
            /* Follow the jump with FOCUS. Suppressing the default navigation also suppresses
               the focus move the browser would have made, which quietly broke the skip link
               and left every keyboard and screen-reader user still at the top of the page
               with the view somewhere else. preventScroll because the scroll is ours. */
            var focusable = /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName) ||
                            target.hasAttribute("tabindex");
            if (!focusable) target.setAttribute("tabindex", "-1");
            try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
          });
        });
      }, true);
      window.addEventListener("hashchange", claimAnchor);
      mobileNav.addEventListener("change", revealNav);

      /* Everything the anchor machinery must forget when a new page arrives. The bar is
         persisted, so without this it would carry the previous page's translation, its open
         menu and its "the reader is already scrolling" flag straight across the swap. */
      resetAnchorState = function () {
        readerScrolled = false;
        anchorActive = !!location.hash;
        pendingTarget = null;
        relandBudget = 0;
        clearTimeout(anchorTimer);
        lastY = window.scrollY;
        hidden = 0;
        applyNav();
        measureNav();
        syncStickyTop();

        /* Land on the anchor again once the layout has settled. The fonts are self-hosted
           and preloaded now, so the reflow this was written for is largely gone — but the
           browser can still apply a fragment late, and under client-side routing the router
           restores scroll itself, so one confirming pass is still worth it.

           Only while the reader has not taken over: any real input cancels it, so this can
           never yank the page out from under someone. */
        if (!location.hash) return;
        var reland = function () {
          if (readerScrolled) { if (DIAG) D.reland = "skipped: reader already scrolled"; return; }
          var t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
          if (!t) { if (DIAG) D.reland = "skipped: no target"; return; }
          if (DIAG) D.reland = "ran";
          measureNav();
          jumpTo(t, false);
          claimAnchor();
        };
        requestAnimationFrame(function () { requestAnimationFrame(reland); });
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(function () {
            requestAnimationFrame(function () { requestAnimationFrame(reland); });
          });
        }
      };
    }

    /* Which page you are on. The dropdown trigger is a real link to its section's page, so
       it matches too — it gets the class, marking the section, while aria-current is left to
       the precise item that trackSection settles on below. Two elements both announcing
       themselves as the current page would be worse than neither. */
    markCurrentPage = function () {
      /* Clearing first is not optional: the nav is persisted, so last page's marks are
         still on these very elements. */
      document.querySelectorAll(".site-nav nav a, .site-nav .nav-drop-trigger").forEach(function (a) {
        a.classList.remove("active");
        a.removeAttribute("aria-current");
      });
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
    };

    /* Which SECTION of that page you are in, tracked live.
       The pass above matches an href against the pathname, which no entry carrying a
       fragment can ever satisfy — "Wet-Lab-Experiments.html#safety".split("/").pop() keeps
       the "#safety" — so without this the only item ever marked was the one without a
       fragment, and it stayed marked however far down the page you scrolled.

       Same rule as the desktop "on this page" rail in pagenav.js: the current section is the
       last one whose top has passed a line just below the bar. The fragment-less entry owns
       everything above the first anchored section, which is the page's own introduction. */
    var secItems = [], secAnchored = [], secTicking = false;

    function updateSection() {
      secTicking = false;
      if (!secItems.length || !secAnchored.length) return;
      var current = null;
      for (var j = 0; j < secItems.length; j++) if (!secItems[j].target) { current = secItems[j]; break; }
      if (!current) current = secAnchored[0];
      for (var i = 0; i < secAnchored.length; i++) {
        if (secAnchored[i].target.getBoundingClientRect().top <= 140) current = secAnchored[i];
        else break;
      }
      /* At the very bottom the last section may be too short to ever cross the line. */
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = secAnchored[secAnchored.length - 1];
      }
      secItems.forEach(function (i) {
        var on = i === current;
        i.el.classList.toggle("active", on);
        if (on) i.el.setAttribute("aria-current", "true");
        else i.el.removeAttribute("aria-current");
      });
    }
    function onSectionScroll() {
      if (!secTicking) { secTicking = true; requestAnimationFrame(updateSection); }
    }
    window.addEventListener("scroll", onSectionScroll, { passive: true });
    window.addEventListener("resize", onSectionScroll);
    window.addEventListener("hashchange", onSectionScroll);

    buildSectionTracking = function () {
      /* The items are persisted nav elements; their TARGETS live in the swapped body. So
         the list is rebuilt per page while the listener above stays bound once. */
      document.querySelectorAll(".site-nav .nav-drop-item").forEach(function (a) {
        a.classList.remove("active");
        a.removeAttribute("aria-current");
      });
      secItems = [];
      document.querySelectorAll(".site-nav .nav-drop-item").forEach(function (a) {
        var parts = (a.getAttribute("href") || "").split("#");
        var file = parts[0].split("/").pop();
        if (file !== here && file !== "") return;
        var target = parts[1] ? document.getElementById(parts[1]) : null;
        if (parts[1] && !target) return;          // a fragment with nothing to point at
        secItems.push({ el: a, target: target });
      });
      secAnchored = secItems.filter(function (i) { return i.target; });
      updateSection();
    };


    /* The bar is persisted, so it cannot carry a per-page class; BaseLayout puts the variant
       on <body> and this copies it across after each swap. Without it the home page's dark,
       full-bleed bar would follow you onto every interior page. */
    refreshNavState = function () {
      if (!navEl) return;
      var home = document.body.getAttribute("data-nav") === "home";
      navEl.classList.toggle("on-dark", home);
      navEl.classList.toggle("home-topbar", home);
      navEl.classList.remove("nav-open");
      closeDropdowns();
      resetAnchorState();
    };
  }

  function refreshPage() {
    here = location.pathname.split("/").pop() || "index.html";
    refreshNavState();
    markCurrentPage();
    buildSectionTracking();
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    if (!booted) { booted = true; initOnce(); }
    /* refreshPage is per PAGE, and both DOMContentLoaded and astro:page-load fire on the
       first one. The flag lives on <body>, which the router replaces on every swap, so it
       clears itself per page without a timer or a guess about which event wins. */
    if (document.body) {
      if (document.body.dataset.navRefreshed === "1") return;
      document.body.dataset.navRefreshed = "1";
    }
    refreshPage();
  }
  /* Fires on the first load and after every client-side navigation. The readyState check is
     the fallback for a build without <ClientRouter />, where that event never comes. */
  document.addEventListener("astro:page-load", boot);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { if (!booted) boot(); });
  } else if (!booted) {
    boot();
  }
})();

/* ---------------------------------------------------------------------------
   ON-DEVICE DIAGNOSTIC — inert unless the URL carries ?diag=1 (?diag=0 clears it).

   Kept, rather than deleted. Every mobile defect in this file was found with it and
   none of them were found without it: the offset that turned out to be a heading's
   collapsed margin, the bar that was measurably present and correctly positioned while
   sitting inside the 93px of layout viewport hidden behind Chrome's URL bar. Reasoning
   from screenshots got the wrong answer five times running; the first reading settled it.

   Open e.g.  .../Project-Description.html?diag=1#modelling
   --------------------------------------------------------------------------- */
(function () {
  if (!window.__navDiagOn) return;

  /* The router replaces <body> on every navigation, so a panel appended to it is discarded
     and anything still writing into it is writing to a node nobody can see. Mounted lazily,
     re-mounted whenever it finds itself detached; the listeners are bound once, to window,
     which outlives all of it. */
  var box = null;
  function mount() {
    if (box && box.isConnected) return;
    if (!document.body) return;
    box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:10px;" +
      "background:rgba(11,15,16,.93);color:#9fe;font:11px/1.45 ui-monospace,monospace;" +
      "white-space:pre-wrap;max-height:52vh;overflow:auto;pointer-events:none";
    document.body.appendChild(box);
  }

  function report() {
    if (!box) return;
    var nav = document.querySelector(".site-nav");
    var id = decodeURIComponent(location.hash.slice(1));
    var t = id && document.getElementById(id);
    var D = window.__navDiag;
    var L = [];

    L.push("viewport " + innerWidth + "x" + innerHeight + "  dpr " + devicePixelRatio);
    L.push("scrollY " + Math.round(scrollY) + "   fonts " +
           (document.fonts ? document.fonts.status : "n/a"));
    L.push("scroll-padding-top " + getComputedStyle(document.documentElement).scrollPaddingTop);

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
             "'  computed " + ns.transform +
             "   persisted " + (nav.hasAttribute("data-astro-transition-persist") ? "yes" : "NO"));
    }
    if (window.visualViewport) {
      var v = window.visualViewport;
      L.push("visualViewport h " + Math.round(v.height) + " offsetTop " +
             Math.round(v.offsetTop) + "   innerHeight " + window.innerHeight);
    }
    /* The home page's hand-off geometry, if this is the home page. G0/G1 are the clearance
       each pair has to work with; below about 40px the "nothing intrudes while this one is
       centred" guarantee has nothing left to give and the blocks start to collide. */
    if (window.__homeDiag && window.__homeDiag.length) {
      window.__homeDiag.forEach(function (line) { L.push(line); });
    }

    if (!t) {
      L.push("no hash target");
    } else {
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
    }
    box.textContent = L.join(String.fromCharCode(10));
  }

  function tick() { mount(); report(); }

  document.addEventListener("astro:page-load", tick);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick);
  else tick();

  addEventListener("scroll", function () { requestAnimationFrame(report); }, { passive: true });
  addEventListener("resize", report);
  /* The page can move without a scroll event — the URL bar collapsing, for one — so poll
     rather than trust that something will notify us. */
  setInterval(tick, 250);
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", report);
    visualViewport.addEventListener("scroll", report);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(report);
})();
