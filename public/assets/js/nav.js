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
    if (toggle && navEl) {
      toggle.addEventListener("click", function () {
        navEl.classList.toggle("nav-open");
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
    var here = location.pathname.split("/").pop() || "index.html";
    var dropdowns = document.querySelectorAll(".nav-dropdown");
    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector(".nav-drop-trigger");
      if (!trigger) return;
      trigger.addEventListener("click", function (e) {
        var href = trigger.getAttribute("href");
        var isOpen = dropdown.classList.contains("open");

        if (href && (canHover || isOpen)) {
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

    // Active-link highlight, including a dropdown's own trigger when on one of its pages.
    // (`here` is declared with the dropdown code above.)
    document.querySelectorAll(".site-nav nav a").forEach(function (a) {
      var target = a.getAttribute("href").split("/").pop();
      if (target === here) {
        a.classList.add("active");
        var parentDropdown = a.closest(".nav-dropdown");
        if (parentDropdown) parentDropdown.querySelector(".nav-drop-trigger").classList.add("active");
      }
    });

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
