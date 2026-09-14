// The Team page's roster filter: one grid, five tabs, All to begin with.
//
// Loaded on every page like the other page scripts and does nothing at all when its markup is
// absent — under client-side routing a script that only exists in one page's markup is never
// fetched if the visitor arrives anywhere else first.
(function () {
  "use strict";

  /* Rebound per page: these elements live in the swapped body, so they die with it. */
  function build() {
    var tabs = document.querySelector(".roster-tabs");
    var grid = document.getElementById("roster-grid");
    var note = document.getElementById("roster-note");
    if (!tabs || !grid) return;

    var buttons = Array.prototype.slice.call(tabs.querySelectorAll(".roster-tab"));
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".team-card"));
    var notes = {};
    try { notes = JSON.parse(note && note.dataset.notes || "{}"); } catch (e) { notes = {}; }

    function show(key) {
      cards.forEach(function (card) {
        card.hidden = key !== "all" && card.dataset.team !== key;
      });
      buttons.forEach(function (b) {
        var on = b.dataset.team === key;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      /* The note belongs to one group, so it appears with that group and goes away again. The
         Dry Lab's is the one that matters: it says per-person attribution has not been
         published, and showing it under "All" would attach it to everyone. */
      if (note) {
        var text = notes[key] || "";
        note.textContent = text;
        note.hidden = !text;
      }
    }

    tabs.addEventListener("click", function (e) {
      var b = e.target.closest(".roster-tab");
      if (b) show(b.dataset.team);
    });

    /* Nothing is hidden until the script runs, so a reader without JavaScript gets the whole
       roster — which is the right answer, not a broken one. */
    show("all");
  }

  document.addEventListener("astro:page-load", build);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
