// "More of the wiki": the flip is CSS, but how LONG it takes is not.
//
// A CSS transition cannot preserve velocity across an interruption — reversed halfway, the
// browser throws the old transition away and starts a new one from rest, and this curve begins
// at about a tenth of its top speed. On its own that is a small stall. What made it feel rubbery
// was the duration: a fixed 0.66s meant a card caught at 170 degrees took exactly as long to
// come back as one caught at 10. Scaling the duration by the distance still to travel makes the
// stall proportionally short, so the return reads as a return rather than a bounce.
//
// Everything else stays in CSS, including the :hover rule, so a reader without JavaScript still
// gets the flip and therefore still gets the description on the back.
(function () {
  "use strict";

  var FULL = 660;      // ms for a complete half-turn
  var MIN = 170;       // ...but never so brief that it reads as a snap
  /* HOVER INTENT. The card lights up the instant the pointer arrives, and only begins to turn if
     the pointer is still there after this long. A row of five cards is a thing people sweep
     across on the way somewhere else, and without the pause that sweep set all five turning —
     a flurry of movement that says nothing about what the reader wanted. The light is the
     acknowledgement; the turn is the answer, and it waits to be asked. */
  var INTENT_MS = 100;

  function angleOf(el) {
    var t = getComputedStyle(el).transform;
    if (!t || t === "none") return 0;
    try {
      var m = new DOMMatrixReadOnly(t);
      /* rotateY about the element's own centre: m11 = cos, m13 = -sin. Normalised to 0..1,
         where 1 is fully turned. */
      var deg = Math.atan2(-m.m13, m.m11) * 180 / Math.PI;
      return Math.min(1, Math.abs(deg) / 180);
    } catch (e) { return 0; }
  }

  function drive(card, to) {
    var from = angleOf(card);
    var ms = Math.max(MIN, Math.round(FULL * Math.abs(to - from)));
    card.style.setProperty("--flip-ms", ms + "ms");
    /* Read back before writing the new target, or the browser coalesces the two and the
       transition starts from the OLD duration. */
    void card.offsetWidth;
    card.style.setProperty("--turn", String(to));
  }

  function build() {
    var wraps = document.querySelectorAll(".quick-card-wrap");
    if (!wraps.length) return;
    Array.prototype.forEach.call(wraps, function (wrap) {
      var card = wrap.querySelector(".quick-card");
      if (!card) return;
      /* Claim the property inline straight away. The stylesheet's :hover rule also sets --turn,
         as the no-script fallback, and an inline value is what stops it from turning the card
         before the pause has elapsed. */
      card.style.setProperty("--turn", "0");
      var timer = 0;

      wrap.addEventListener("pointerenter", function () {
        card.classList.add("is-hot");                 // the light, immediately
        clearTimeout(timer);
        timer = setTimeout(function () { drive(card, 1); }, INTENT_MS);
      });
      wrap.addEventListener("pointerleave", function () {
        /* If the pause has not elapsed, this cancels a turn that never started — the card was
           only ever lit, and it goes dark again with nothing to undo. */
        clearTimeout(timer);
        card.classList.remove("is-hot");
        drive(card, 0);
      });
      /* Focus reaches the link, not the wrapper, and is the keyboard's way in. No pause there:
         tabbing onto something is already a deliberate act. */
      card.addEventListener("focus", function () { card.classList.add("is-hot"); drive(card, 1); });
      card.addEventListener("blur", function () { card.classList.remove("is-hot"); drive(card, 0); });
    });
  }

  document.addEventListener("astro:page-load", build);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
