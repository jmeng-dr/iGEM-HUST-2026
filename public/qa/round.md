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
