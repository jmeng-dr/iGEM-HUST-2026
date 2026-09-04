// Shared across every wiki page: mobile nav toggle, dropdowns, active-link highlight, ring navigator.
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".nav-toggle");
    var navEl = document.querySelector(".site-nav");
    if (toggle && navEl) {
      toggle.addEventListener("click", function () {
        navEl.classList.toggle("nav-open");
      });
    }

    // Dropdowns (Project / Lab / Human Practices): click to toggle (works for touch + desktop),
    // close on outside click. querySelectorAll — there are three of these per page now, not one.
    var dropdowns = document.querySelectorAll(".nav-dropdown");
    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector(".nav-drop-trigger");
      if (!trigger) return;
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = !dropdown.classList.contains("open");
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
    var here = location.pathname.split("/").pop() || "index.html";
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
