/* Butterfly ornament — a decorative butterfly that flies a fixed curve across the
   viewport as the home page scrolls. Standalone: it shares no state with home.js.

   WHY THIS IS BUILT THE WAY IT IS
   The obvious implementation keys the path's waypoints to section offsets and gives
   each leg of the path the same parametric range 0..1. That reads fine as code and
   feels broken in use, because the sections are wildly different scroll lengths: the
   pinned intro-wheel spends ~1200px of scroll on one leg while a plain section spends
   ~400px on the next. Same screen distance, three times the scrolling — so the
   butterfly crawls through the pinned sections (which reads as "stuck") and darts
   through the short ones.

   So this parameterises the path by ARC LENGTH instead. The curve is sampled once
   into a polyline carrying cumulative pixel distances, and scroll progress maps to
   distance-along-the-path. One pixel of scroll always buys the same number of pixels
   of travel, wherever you are on the page.

   Three other things keep it smooth:
     - Catmull-Rom through the waypoints, so velocity is continuous at the joins
       instead of kinking at every corner.
     - An exponential follower (frame-rate independent) between the raw scroll value
       and the drawn value, so a burst of wheel events glides rather than steps, and
       the butterfly eases to a stop instead of snapping.
     - transform + opacity only, from a single rAF loop that parks itself once the
       follower converges. Never width/height: those force layout and cannot be
       composited, which is the other half of the naive version's jank.

   TUNING (all at the top of initButterfly):
     WAYPOINTS   — the flight path itself, in viewport fractions
     SMOOTH_TAU  — glide/lag in seconds. Higher = floatier, lower = tighter to scroll
     START_PX    — how far down the page it appears
     MAX_OPACITY — how present it is over the content
     FLAP_*      — how hard the wingbeat responds to travel speed
*/
(function () {
  document.addEventListener("DOMContentLoaded", initButterfly);

  function initButterfly() {
    var el = document.getElementById("butterfly");
    if (!el) return;

    /* Waypoints in viewport fractions (x -> vw, y -> vh) plus a scale multiplier.
       Editing these is the intended way to redraw the flight path. */
    var WAYPOINTS = [
      { x: 0.50, y: 0.52, s: 1.55 },  /* behind the preface glow, large */
      { x: 0.50, y: 0.13, s: 0.82 },  /* rises to the top as the preface releases */
      { x: 0.84, y: 0.25, s: 0.74 },  /* swings out to the right */
      { x: 0.90, y: 0.62, s: 0.74 },  /* down the right edge, past the module wheel */
      { x: 0.64, y: 0.86, s: 0.78 },  /* curves in along the bottom */
      { x: 0.20, y: 0.80, s: 0.74 },  /* crosses to the left */
      { x: 0.10, y: 0.34, s: 0.70 },  /* up the left edge */
      { x: 0.17, y: 0.10, s: 0.62 }   /* settles top-left by the footer */
    ];

    var START_PX    = 260;   /* scroll px before it appears — after the preface glow has played */
    var FADE_PX     = 300;   /* px of scroll it fades in over */
    var FADE_OUT_AT = 0.93;  /* progress at which it starts fading back out */
    var MAX_OPACITY = 0.8;
    var SMOOTH_TAU  = 0.10;  /* seconds of glide */
    /* Wingbeat. Driven from here rather than from CSS keyframes, because the AMPLITUDE
       has to vary and a keyframe's angles are fixed. Frequency could be varied through
       playbackRate; amplitude cannot, short of rewriting the keyframes or hanging them
       off custom properties — and a transform animation carrying a var() drops off the
       compositor anyway, so the CSS version was not buying what it looked like it was.

       The signal is the SMOOTHED travel speed in px/s, not raw scroll velocity: it is
       already glided by the follower below, and it is what is actually on screen — a
       burst of wheel events during a pinned section moves the page a long way and the
       butterfly hardly at all, and the wings should follow the butterfly.

       Amplitude rises with speed CONTINUOUSLY, but on a far gentler curve than the
       frequency. Two fixed gears would need a transition between them, and building
       that transition is building this, only with a worse curve. And the two must not
       scale together: tip speed goes as frequency x amplitude, so 5.8x and 1.4x is
       already 8x, where 5.8x and 2x would be 11.6x and just smears. */
    var FLAP_REF_SPEED = 450;   /* px/s of travel that buys one extra beat's worth of rate */
    var FLAP_MAX_EXTRA = 4.8;   /* rate ceiling, so it runs 1 .. 5.8 */
    var FLAP_TAU       = 0.18;  /* seconds for rate and amplitude to catch up */
    var FLAP_BASE_HZ   = 1.18;  /* resting beat — the 0.85s period this had in CSS */
    var FLAP_MID_DEG   = 20;    /* the stroke is centred above flat, as a real one is */
    /* Rest and full speed are set independently: the flat-out stroke is
       FLAP_AMP_DEG * (1 + FLAP_AMP_GAIN), so shrinking the rest without widening the
       gain would drag the top of the range down with it. 30 * 1.96 = 58.8 keeps the
       fast stroke exactly where it was while the rest drops back to roughly the span
       the CSS keyframes used to hold. */
    var FLAP_AMP_DEG   = 30;    /* resting half-stroke: -10deg to +50deg */
    var FLAP_AMP_GAIN  = 0.96;  /* at full speed: -38.8deg to +78.8deg, as before */
    var FLAP_PERSP     = 420;   /* px; was the perspective() in the keyframes */

    var SWAY_DEG    = 7;     /* gentle roll on top of the heading, so it banks */
    var SWAY_HZ     = 0.22;
    var SAMPLES     = 700;

    var samples = [];        /* {x, y, s, d} — d is cumulative arc length in px */
    var total = 0;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    function catmull(p0, p1, p2, p3, t, k) {
      var v0 = p0[k], v1 = p1[k], v2 = p2[k], v3 = p3[k];
      return 0.5 * ((2 * v1) + (-v0 + v2) * t +
             (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t +
             (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t);
    }

    /* Sample the spline into a polyline and accumulate real pixel distance. Rebuilt
       on resize, because the same fractions describe a different-length curve once
       the viewport aspect changes. */
    function buildPath() {
      var vw = window.innerWidth, vh = window.innerHeight;
      var w = WAYPOINTS, n = w.length;
      samples.length = 0;
      total = 0;
      var px = 0, py = 0;
      for (var i = 0; i <= SAMPLES; i++) {
        var u = (i / SAMPLES) * (n - 1);
        var seg = Math.min(n - 2, Math.floor(u));
        var t = u - seg;
        var p0 = w[Math.max(0, seg - 1)], p1 = w[seg];
        var p2 = w[seg + 1], p3 = w[Math.min(n - 1, seg + 2)];
        var x = catmull(p0, p1, p2, p3, t, "x") * vw;
        var y = catmull(p0, p1, p2, p3, t, "y") * vh;
        var s = catmull(p0, p1, p2, p3, t, "s");
        if (i > 0) total += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
        samples.push({ x: x, y: y, s: s, d: total });
        px = x; py = y;
      }
    }

    /* Binary-search the polyline for a given arc length; return the interpolated
       point plus the local tangent, which is used as the heading. */
    function atDistance(d) {
      var lo = 1, hi = samples.length - 1;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (samples[mid].d < d) lo = mid + 1; else hi = mid;
      }
      var b = samples[lo], a = samples[lo - 1];
      var span = (b.d - a.d) || 1;
      var t = (d - a.d) / span;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        s: a.s + (b.s - a.s) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x)
      };
    }

    /* Raw progress along the whole scrollable page, clamped to 0..1. Uniform against
       scroll — which is exactly what makes the travel speed uniform. */
    function rawProgress() {
      var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(1, Math.max(0, (window.scrollY - START_PX) / Math.max(1, max - START_PX)));
    }

    function opacityAt(p) {
      if (window.scrollY < START_PX) return 0;
      if (p > FADE_OUT_AT) return MAX_OPACITY * (1 - (p - FADE_OUT_AT) / (1 - FADE_OUT_AT));
      return MAX_OPACITY * Math.min(1, (window.scrollY - START_PX) / FADE_PX);
    }

    var target = 0, smooth = 0, running = false, lastT = 0;

    var wingL  = el.querySelector(".bf-wing-l");
    var wingR  = el.querySelector(".bf-wing-r");
    var shades = el.querySelectorAll(".bf-shade");
    var flapRate = 1, flapPhase = 0, prevSmooth = 0;

    /* Phase is ACCUMULATED (phase += hz * dt) rather than recomputed from absolute
       time. Deriving it from the clock would mean that every change of frequency
       reinterprets the whole elapsed time and the wings jump mid-stroke — the same
       reason animation-duration was the wrong knob. Accumulating makes the frequency
       free to change at any moment with no discontinuity at all. */
    function drawWings(dt) {
      if (!wingL || !wingR) return;
      var norm = (flapRate - 1) / FLAP_MAX_EXTRA;                 // 0 at rest, 1 flat out
      flapPhase = (flapPhase + FLAP_BASE_HZ * flapRate * dt) % 1;
      var amp = FLAP_AMP_DEG * (1 + FLAP_AMP_GAIN * norm);
      var deg = FLAP_MID_DEG - amp * Math.cos(flapPhase * 2 * Math.PI);
      wingL.style.transform = "perspective(" + FLAP_PERSP + "px) rotateY(" + deg.toFixed(2) + "deg)";
      wingR.style.transform = "perspective(" + FLAP_PERSP + "px) rotateY(" + (-deg).toFixed(2) + "deg)";
      /* The shading is now a function of the fold ANGLE, not a parallel animation that
         merely shares its period. sin(deg) is 0 when the wings are flat or below and
         approaches 1 as they close on edge-on, so a bigger stroke deepens the shadow on
         its own — which is what more fold actually does — with nothing extra to tune. */
      var op = Math.max(0, Math.sin(deg * Math.PI / 180)).toFixed(3);
      for (var i = 0; i < shades.length; i++) shades[i].style.opacity = op;
    }

    function draw(p, timeMs) {
      var pt = atDistance(p * total);
      var sway = reduce.matches ? 0 : Math.sin(timeMs / 1000 * SWAY_HZ * Math.PI * 2) * SWAY_DEG;
      var deg = pt.angle * 180 / Math.PI + 90 + sway;
      el.style.transform =
        "translate3d(" + pt.x.toFixed(1) + "px," + pt.y.toFixed(1) + "px,0)" +
        " rotate(" + deg.toFixed(2) + "deg) scale(" + pt.s.toFixed(3) + ")";
      el.style.opacity = opacityAt(p).toFixed(3);
    }

    function frame(now) {
      var dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0.016;
      lastT = now;
      /* Frame-rate-independent follower, so it behaves the same at 60Hz and 144Hz
         rather than being proportionally faster on a fast display. */
      smooth += (target - smooth) * (1 - Math.exp(-dt / SMOOTH_TAU));

      /* smooth is progress along a path of `total` px, so this is travel in px/s. */
      var speed = Math.abs(smooth - prevSmooth) / dt * total;
      prevSmooth = smooth;
      var want = 1 + Math.min(FLAP_MAX_EXTRA, speed / FLAP_REF_SPEED);
      flapRate += (want - flapRate) * (1 - Math.exp(-dt / FLAP_TAU));
      drawWings(dt);

      draw(smooth, now);
      /* Keep animating while catching up, or while visible (for the sway). Park
         otherwise; a scroll or resize wakes it again. */
      if (Math.abs(target - smooth) > 0.00015 || opacityAt(smooth) > 0.001) {
        requestAnimationFrame(frame);
      } else {
        running = false;
        flapRate = 1;     /* parked and out of sight; do not resume at the old rate */
      }
    }

    function wake() {
      target = rawProgress();
      if (!running) { running = true; lastT = 0; requestAnimationFrame(frame); }
    }

    buildPath();
    smooth = target = prevSmooth = rawProgress();

    if (reduce.matches) {
      /* No animation loop at all: draw once, then only on scroll/resize. */
      var still = function () { draw(rawProgress(), 0); };
      still();
      window.addEventListener("scroll", still, { passive: true });
      window.addEventListener("resize", function () { buildPath(); still(); });
      return;
    }

    wake();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", function () { buildPath(); wake(); });
  }
})();
