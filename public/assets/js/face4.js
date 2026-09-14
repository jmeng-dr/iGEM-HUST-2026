// The structural-colour row on the home page: four cards that turn over as the pointer travels
// along them.
//
// Loaded on every page like the rest of the home-page scripts, and does nothing at all when its
// markup is absent — under client-side routing a script that only exists in one page's markup is
// never fetched if the visitor arrives anywhere else first.
(function () {
  "use strict";

  var DUR = 380;        // ms for one card to turn
  var STAGGER = 110;    // ms between one card starting and the next...
  var LEAD_CAP = 150;   // ...but no card ever waits longer than this before it starts.
  /* The cap is the whole point. The stagger used to be a flat 110ms per card, so in a run of
     four the last one sat for 330ms doing nothing — and a pointer swept back the other way
     inside that window cancelled it before it had begun. Waved left and right across the row,
     the two right-hand cards therefore never moved at all: measured, they held 0 and 1 degrees
     through four full passes while the two on the left turned normally. A card that is told to
     move and then told to stop is behaving correctly; a card that can be told to move and
     stopped before it starts, over and over, just looks broken. With the cap, the sequence is
     still read as one travelling down the row, and nothing waits long enough to be robbed. */

  /* The row that is currently on the page, or null. Refreshed per page; read by the one
     document-level listener at the foot of this file. */
  var live = null;

  function build() {
    live = null;
    var root = document.getElementById("face4");
    if (!root) return;
    var grid = root.querySelector(".face4-grid");
    var range = root.querySelector(".face4-range");
    var slider = root.querySelector(".f4-slider");
    var reset = root.querySelector(".f4-reset");
    var readout = root.querySelector(".f4-readout");
    var cards = Array.prototype.slice.call(root.querySelectorAll(".f4-card"));
    if (!grid || !slider || !cards.length) return;

    var N = cards.length;
    var STEP = 100 / N;          // each card's share of the slider's run
    var open = 0;                // how many are face up, counted from the left

    function say(n) {
      if (!readout) return;
      readout.textContent = n ? n + (n === 1 ? " card turned" : " cards turned") : "None turned";
    }

    /* THE ROW IS A TRACK, and the pointer's position along it is the whole state.
     *
     * Not "which card is the pointer over" — that leaves the space to the left of the first
     * card meaning nothing, so the first card could be turned over but never back, and it makes
     * "the pointer left the row" into a state of its own that has to be reconciled with every
     * other one. Going from the fourth card round to the first would then have to decide whether
     * the leaving counted. As a track there is nothing to reconcile: left of the first card is
     * simply the zero end, and OFF the track is not a position at all, so leaving the row
     * changes nothing and the way back in is just another position.
     *
     * Zone boundaries sit in the gaps rather than at the cards' middles, so a card is worth its
     * whole width — half a card meaning one thing and the other half another is the sort of
     * control that feels broken without anyone being able to say why.
     */
    function countAt(x) {
      var first = cards[0].getBoundingClientRect();
      if (x < first.left) return 0;
      for (var i = N - 1; i >= 0; i--) {
        if (x >= cards[i].getBoundingClientRect().left) return i + 1;
      }
      return 0;
    }

    /* The cards move IN SEQUENCE, not together. One to four turns 2, 3 and 4 in that order; four
       back to one turns 4, 3 and 2 back in THAT order — right to left, the direction the run
       travelled — even when the pointer went nowhere near them. Each card waits its turn by how
       far along the run it is, so the eye reads one movement passing down the row rather than
       three cards flipping at once. */
    function setOpen(n, animate) {
      if (n === open && animate) return;
      var prev = open;
      open = n;
      var span = Math.abs(n - prev);
      var step = span > 1 ? Math.min(STAGGER, LEAD_CAP / (span - 1)) : 0;
      cards.forEach(function (card, i) {
        var delay = 0;
        if (animate && n > prev && i >= prev && i < n) delay = (i - prev) * step;
        else if (animate && n < prev && i >= n && i < prev) delay = (prev - 1 - i) * step;
        card.style.setProperty("--dur", (animate ? DUR : 0) + "ms");
        card.style.setProperty("--delay", delay + "ms");
        card.querySelector(".f4-flip").style.setProperty("--turn", i < n ? "1" : "0");
        card.classList.toggle("turned", i < n);
      });
      /* The bar takes as long as the whole run, so the ball arrives with the last card instead
         of racing ahead of it and waiting. */
      var total = animate && span ? DUR + (span - 1) * step : 0;
      if (range) {
        range.style.setProperty("--p", (n / N).toFixed(4));
        range.style.setProperty("--bar", total + "ms");
      }
      slider.value = String(n * STEP);
      say(n);
    }

    /* THE TRACK, AS PURE COORDINATES. Given a point, how many cards should be face up?
     *
     * Not "which card is the pointer inside": that leaves the space to the left of the first
     * card meaning nothing, so the first card could be turned over but never back, and it makes
     * "the pointer left the row" a state of its own to be reconciled with every other one. As a
     * track there is nothing to reconcile — left of the first card is simply the zero end, and
     * off the track is not a position at all, so leaving the row changes nothing.
     *
     * Zone boundaries sit in the GAPS between cards rather than at their middles, so a card is
     * worth its whole width. Half a card meaning one thing and the other half another is the
     * sort of control that feels broken without anyone being able to say why.
     *
     * -1 means "not on the track", which is different from 0. */
    function at(x, y) {
      var first = cards[0].getBoundingClientRect();
      var last = cards[N - 1].getBoundingClientRect();
      /* Band-limited by the cards' own height — the heading above and the slider below are not
         positions on this track. Measured off the CARD, which never moves: the .f4-flip inside
         it is the thing being rotated, and a rotating box reports a rect that shrinks as it
         turns, so a band measured off that would breathe with the animation. */
      if (y < first.top - 24 || y > first.bottom + 24) return -1;
      if (x > last.right + 80) return -1;
      if (x < first.left) return 0;
      for (var i = N - 1; i >= 0; i--) {
        if (x >= cards[i].getBoundingClientRect().left) return i + 1;
      }
      return 0;
    }
    live = { at: at, setOpen: setOpen };

    /* Focus walks the row with the keyboard, where there is no pointer to have a position. */
    cards.forEach(function (card, i) {
      card.addEventListener("focus", function () { setOpen(i + 1, true); });
    });

    /* Dragging is the continuous version of the same state. It turns the cards by fractions
       rather than one at a time, so the transitions are switched off while it is being dragged —
       left on, every card and the ball would lag the thumb by their own duration. */
    slider.addEventListener("input", function () {
      var s = Number(slider.value) || 0;
      var count = 0;
      cards.forEach(function (card, i) {
        var t = (s - i * STEP) / STEP;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        card.style.setProperty("--dur", "0ms");
        card.style.setProperty("--delay", "0ms");
        card.querySelector(".f4-flip").style.setProperty("--turn", t.toFixed(4));
        var done = t >= 1;
        card.classList.toggle("turned", done);
        if (done) count++;
      });
      if (range) {
        range.style.setProperty("--p", (s / 100).toFixed(4));
        range.style.setProperty("--bar", "0ms");
      }
      open = count;
      say(count);
    });

    if (reset) {
      reset.addEventListener("click", function () {
        setOpen(0, true);          // animated, so they turn back right to left
        /* Blur it, or the button keeps focus and the next Tab starts from the wrong end of the
           row — and the focus ring reads as "this is still doing something". */
        reset.blur();
      });
    }

    /* Start from whatever the slider actually says: the browser restores form state across a
       soft navigation back to this page, so it is not necessarily zero. Not animated — the
       opening state of a page is not a movement. */
    setOpen(Math.round((Number(slider.value) || 0) / STEP), false);
  }

  /* ONE LISTENER, ON THE DOCUMENT, READING NOTHING BUT COORDINATES.
   *
   * It used to be a pointermove on the section itself, which meant the row only heard about the
   * pointer when the browser decided the event belonged to it — and the panels overlap by two
   * viewports, so the BOX of the next panel lies across this one for most of its time on screen.
   * That box shows nothing (its own content is parked below the fold by a transform) and it
   * still won every hit test in the region it covered, so the row stopped responding wherever it
   * happened to lie. Asking the document "where is the pointer" cannot be intercepted by
   * anything, because nothing is being hit-tested at all.
   *
   * AND ONLY WHEN THE POINTER HAS ACTUALLY MOVED. pointermove also fires when the page scrolls
   * under a pointer that is standing still, which would let a scroll deal the cards out by
   * itself; comparing against the last position keeps this a thing the reader does rather than
   * something that happens to them.
   *
   * Bound once, at the top level: document listeners outlive every page, so one bound per page
   * would stack up a new one on every navigation. `live` is what changes instead. */
  var lastX = null, lastY = null;
  document.addEventListener("pointermove", function (e) {
    if (!live) return;
    if (e.clientX === lastX && e.clientY === lastY) return;
    lastX = e.clientX; lastY = e.clientY;
    var n = live.at(e.clientX, e.clientY);
    if (n >= 0) live.setOpen(n, true);
  }, { passive: true });

  document.addEventListener("astro:page-load", build);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
