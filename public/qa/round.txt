# REVIEW — coordination between Claude Code and the browser-QA session

Claude Code updates the "Round" section after each batch. The browser session reads
it at **http://localhost:4322/qa/round.md**, runs the checks, and reports back.
No automatic channel — the human carries text between the two.

**Reports:** save to `E:\Downloads\qa-report.md` (always that exact name — Claude Code
moves it into `astro/qa-archive/round-N.md` after reading, so the name is free again).
If this session cannot write files, output the report as text in chat instead; that
worked fine for rounds 0 and 1.

---

## URLs

| | NEW (Astro production build) | ORIGINAL (frozen reference) |
|---|---|---|
| Home | http://localhost:4322/ | http://localhost:8080/index.html |
| Project | http://localhost:4322/Project-Description.html | http://localhost:8080/Project-Description.html |
| Wet Lab | http://localhost:4322/Wet-Lab-Experiments.html | http://localhost:8080/Wet-Lab-Experiments.html |
| Human Practices | http://localhost:4322/Human-Practices.html | http://localhost:8080/Human-Practices.html |
| Attributions | http://localhost:4322/Attributions.html | http://localhost:8080/Attributions.html |
| AI Comp Methods | http://localhost:4322/AI-Computational-Methods.html | http://localhost:8080/AI-Computational-Methods.html |
| AI Ethics/Safety | http://localhost:4322/AI-Ethics-Safety.html | http://localhost:8080/AI-Ethics-Safety.html |

> The ORIGINAL is a frozen reference for anything **not** listed as changed. The two
> sites now differ substantially and deliberately. Do not report intended changes as
> failures. **Re-run `astro preview` has been restarted — hard-refresh 4322.**

---

## Round 2 — QA fixes + artwork + real content

Round 1's report drove most of this. Thank you for the correction on the
view-transition error — it was right, and it is now fixed at the source.

### A. Your Round 1 findings, actioned

1. **Favicon redrawn.** You were right that the full logo is a green smudge at 16px.
   There is now a purpose-drawn `/assets/img/favicon.svg` (teal roundel + one
   kingfisher feather, no ribbon) served first, with 16/32/180 PNG fallbacks
   generated from it. → Check the tab icon is recognisable at 16px now.
2. **Nav mark 30 → 36px**, and `object-fit: contain` added as you suggested.
   → Confirm the bar height and every nav item position are still unchanged vs
   ORIGINAL, and that the pink ribbon now reads.
3. **Footer seals now sit on a tint band.** Your recommendation B1, implemented:
   a full-bleed `rgba(255,255,255,0.045)` strip behind the row, flush to the footer's
   top edge (negative margin cancels the footer's own padding), hairline as its
   bottom edge. Seals unchanged at 58px / 0.92 opacity.
   → **Question C below.**
4. **Qiming seal re-exported lossless** (it was lossy-compressed line art). Its source
   is only 120×120 — that is genuinely all the team has, so 2x is 1:1 and 3x will be
   soft. Flagged for the team to supply a larger original; not fixable here.
5. **Skip link added.** You noted the first card is the 21st tab stop. Tab once from
   the top of any page → a "Skip to content" button should appear top-left and jump
   focus to `#main` just below the nav.
6. **View-transition error fixed.** `nav.js` now listens for `pagereveal` / `pageswap`
   and swallows the rejection from a skipped transition (`.ready`, `.finished`,
   `.updateCallbackDone`). → **This is the single most important thing to verify:
   does `AbortError: Transition was skipped` still appear in the console?** Please
   repeat your Round 1 method — a slow pass with real dwell, plus a real mouse click
   Home → Team — since that is what caught it.

### B. New artwork

7. **Home TOC totems.** The four CSS triangles are gone; each totem is now one of the
   team's hand-drawn emblems (Project / Wet Lab / Human Practices / Team) sitting on a
   shared 78px circular ground. The ground is deliberate: the four drawings are not a
   matched set (round badge / tall flask / wide hands / square flower), so a common
   disc plus `object-fit: contain` normalises them.
   `.toc-preview` bottom padding went 54px → 96px so the caption clears the taller
   totems. → **Question D below.**

### C. New content and sections

8. **Promotion video (new section).** `#promo-video` now follows `#toc` on the home
   page — the team's real iGEM Video Universe embed in a 16:9 frame. `#toc` bottom
   padding dropped 360px → 120px to make room. → **Question E below.**
9. **Attributions now has the real roster.** The five grids were empty `<div>`s filled
   by an inline script with 28 "Team Member N / TODO" cards. They are now rendered at
   build time from the team's actual roster: **31 people** (Wet Lab 11, Dry Lab 8,
   Human Practices 7, Advisors 3, PIs 2), each with their real uploaded portrait from
   `static.igem.wiki`. Headcount badges corrected. The inline script is deleted, so
   the cards are in the HTML rather than appearing only after JS runs.
   → Check: 31 cards, all portraits load (none broken), the hover/focus overlay still
   works over a photo instead of the old grey "Photo" block, and the cards are still
   keyboard-reachable with the focus ring.
10. **AI-use disclosure expanded** (Wet Lab → Biosafety & responsible AI use). It was
    vague ("AI tools"); it now has a models table, per-use detail, and a two-stage
    human review process. → Just confirm it renders correctly; no comparison needed.
11. **All 18 tables wrapped** in `.table-wrap` (`overflow-x: auto`).
    → **Verify the Round 1 bug is gone: Project-Description at 375px should no longer
    overflow** (was scrollWidth 416 > clientWidth 360). Desktop widths should be
    completely unaffected.

### Aesthetic judgement wanted

I still cannot see the page. Please give an opinion, not just pass/fail:

- **C.** Does the tint band behind the footer seals fix the "three unrelated logos"
  problem you described, or does the band itself now look like a seam? Is
  `rgba(255,255,255,0.045)` about right, too faint, or too strong?
- **D.** Do the four emblems on their shared discs read as **one set** at 78px? Is the
  disc doing its job, or would the emblems be better without it? Is 78px right, and
  does the caption panel actually clear them at every width?
- **E.** Does the promotion video read as part of the page, or bolted on to the end?
  The home page now runs preface → module wheel → totems → video. Is that a sensible
  place for it, or should it come earlier?

### Regression (abbreviated)

- Full geometry/style diff on **index, Attributions, Wet-Lab-Experiments** at
  **1321 and 768**. Everything outside the changes above must still match ORIGINAL.
- **Console on all 7 pages** — especially item 6.
- Horizontal scrollbar check at **375px on Project-Description** — expected fixed.
- Interaction **E (home totems)** — the hover→caption behaviour must still work now
  that the totems are images rather than CSS triangles.

### Known, still not fixed

- Per-person contribution text is genuinely not written yet — the cards say so
  rather than inventing it. Not a bug.
- No GitLab repository link in the footer yet (a judging requirement) — blocked on
  deciding which repo this site will live in.

---

## Response format

```
ROUND: 2
NEW build reachable (4322): yes/no
--- ROUND 1 FIXES ---
1 favicon at 16px   — OK / problem:
2 nav mark 36px     — OK / problem:   (bar height, item positions vs ORIGINAL)
3 footer tint band  — OK / problem:
4 qiming lossless   — OK / problem:
5 skip link         — OK / problem:
6 AbortError GONE?  — YES / NO  + method used, per page
--- NEW WORK ---
7 totem emblems     — OK / problem:
8 promo video       — OK / problem:
9 roster 31 cards   — OK / problem:   (portraits loaded? overlay? focus ring?)
10 AI disclosure    — OK / problem:
11 table-wrap       — OK / 375px overflow fixed? YES / NO
--- AESTHETIC ---
C footer band:
D emblem discs:
E video placement:
--- REGRESSION ---
index / Attributions / Wet-Lab at 1321 + 768 — PASS or diffs
E home totems interaction — PASS/FAIL
--- CONSOLE ---
<per page>
--- NOTES ---
```

---

## Round 2 — ADDENDUM: butterfly ornament (item 12)

A butterfly now flies a fixed curve across the home page as you scroll. It is
adapted from a reference implementation the team had, but rebuilt, because that one
stalled — most visibly while the pinned intro-wheel was stepping through its four
modules.

**The cause, and what changed.** The reference keys its waypoints to section offsets
and gives every leg of the path the same parametric range. The sections are very
different scroll lengths — the pinned intro-wheel spends roughly three times the
scroll of a plain section on one leg — so the same screen distance costs three times
the scrolling and the butterfly crawls there and darts elsewhere. This version
parameterises the path by **arc length**: the curve is sampled into a polyline with
cumulative pixel distances, and scroll progress maps to distance along it. One pixel
of scroll buys the same travel everywhere. Also: Catmull-Rom instead of linear legs
(no velocity kink at the corners), an exponential follower so wheel bursts glide
instead of stepping, and transform/opacity only from one rAF loop that parks when
idle — the reference wrote `width`/`height` on every scroll event, which forces
layout and cannot be composited.

**Please test the scroll feel specifically** — this is the part I most need eyes on:

1. **Uniform speed.** Scroll the whole home page at a steady rate, top to bottom.
   Does the butterfly travel at a visibly constant speed, or does it still slow down
   somewhere? The old failure point was the "Four modules" section — watch it there
   in particular, and also across the boundary from the module wheel into the totems.
2. **No stalling.** Scroll in single wheel notches. Each notch should move it a
   similar amount. It should glide and settle, never jump or freeze.
3. **Direction.** It should point along its direction of travel (head first) and
   bank gently. Check it does not spin wildly or point backwards.
4. **Layering.** It must pass *under* the top nav bar, not over it. It should be
   above the page content. `pointer-events` is none — confirm you can still click a
   link the butterfly is sitting on top of.
5. **Fade.** Absent at the very top of the page, fades in after ~260px of scroll,
   fades back out approaching the footer.
6. **Performance.** With DevTools Performance open, scroll the home page for a few
   seconds. Are frames dropping? Is anything triggering layout/reflow during scroll?
   The intent is compositor-only (transform + opacity).
7. **Resize.** Resize the window mid-page. The path is rebuilt on resize; the
   butterfly should re-place itself sensibly, not jump off-screen.
8. **Reduced motion.** With `prefers-reduced-motion: reduce` emulated, the butterfly
   should be hidden entirely and no rAF loop should run.

**Aesthetic question F:** is the flight path good? It currently goes centre → top →
right edge → down the right → along the bottom → across to the left → up the left →
settles top-left. Does it feel like it belongs to the page, or like it wanders? Is
80% opacity right over the content, and is the size sensible at 1321 and at 768?
If the path is wrong, say roughly where it should go instead — the waypoints are a
plain list of viewport fractions at the top of `/assets/js/butterfly.js` and are cheap
to change.

Report as item `12 butterfly` plus aesthetic `F`.

---

## Round 2 — ADDENDUM 2: intro-wheel dial (item 13)

The "Four modules" section now has a large medallion hanging off the **left edge of
the page**, rotating **90° per module**. Adapted from the reference build, with one
deliberate change: there the disc is pulled back 75% of its width, here it is pulled
back exactly **50%** — so the artwork's centre sits on x = 0 and precisely half of it
is on screen.

The four thin arcs around it are fixed at 90° intervals *inside* the dial, and the
dial turns by `-index * 90deg`, so the highlighted arc always ends up at the same
screen angle: the marker holds still while the artwork rotates underneath it.

It is decorative — `aria-hidden`, `pointer-events: none`, `z-index: 0` behind the
heading and module list. The wheel-stop list is still the real progress indicator.

**Check:**
1. Exactly half the medallion is visible; its centre is on the page's left edge, and
   it is vertically centred in the pinned section.
2. Scrolling through the four modules turns it 0° → −90° → −180° → −270°, one step
   per module, in sync with the module list highlight and the panel text.
3. The rotation eases (0.75s) rather than snapping, and does not fight the scroll if
   you move quickly through several modules.
4. The active arc stays at a **fixed screen angle** across all four steps while the
   artwork spins beneath it.
5. The heading "Four modules, one supply chain" and the numbered module list are
   **readable on top of it** — the dial is at opacity 0.5 for this reason. If the
   list is hard to read, say so; that opacity is the knob.
6. Hidden entirely below 760px, and it must not create a horizontal scrollbar at any
   width (the left half hangs outside the viewport and is clipped by
   `.wheel-sticky { overflow: hidden }`).

**Aesthetic question G:** is the size right? It is `min(92dvh, 860px)` in diameter,
so roughly half a viewport-height protrudes. Too dominant, too timid, or right? And
is opacity 0.5 the right balance between "visible ornament" and "readable text"?

Report as item `13 dial` plus aesthetic `G`.
