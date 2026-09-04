# REVIEW — coordination between Claude Code and the browser-QA session

This file is the shared checklist. **Claude Code** updates the "Round" section after
each batch of changes. The **browser session** reads it at
http://localhost:4322/qa/round.md, runs the checks, and reports back. The **human**
carries text between the two. There is no automatic channel.

---

## URLs

| | NEW (Astro, **production build**) | ORIGINAL (frozen reference) |
|---|---|---|
| Home | http://localhost:4322/ | http://localhost:8080/index.html |
| Project | http://localhost:4322/Project-Description.html | http://localhost:8080/Project-Description.html |
| Wet Lab | http://localhost:4322/Wet-Lab-Experiments.html | http://localhost:8080/Wet-Lab-Experiments.html |
| Human Practices | http://localhost:4322/Human-Practices.html | http://localhost:8080/Human-Practices.html |
| Attributions | http://localhost:4322/Attributions.html | http://localhost:8080/Attributions.html |
| AI Comp Methods | http://localhost:4322/AI-Computational-Methods.html | http://localhost:8080/AI-Computational-Methods.html |
| AI Ethics/Safety | http://localhost:4322/AI-Ethics-Safety.html | http://localhost:8080/AI-Ethics-Safety.html |

> **Port changed from 4321 → 4322.** Round 0 tested the dev server; from Round 1 on,
> NEW is the real `astro build` output served by `astro preview`, so the comparison is
> production-to-production and there is no Vite/dev-toolbar noise in the console.

## Hand-off

- Instructions: **http://localhost:4322/qa/round.md**
- Report: save to `E:\Downloads\qa-report.md` if possible; if this session cannot
  write files, just output the report as text in chat instead — that worked fine
  for Round 0 and is an acceptable substitute. Screenshots are optional; the
  per-element computed-style + geometry diff used in Round 0 is better evidence.

---

## Round 1 — first intended changes

> **IMPORTANT — the brief has changed.** In Round 0 the two sites had to be
> identical. They are now **intentionally different**. The ORIGINAL is a frozen
> reference for everything that was *not* touched. Do **not** report the changes
> listed below as failures — verify them, and judge whether they look good.

### What changed (verify these)

1. **Favicon + theme colour** — every page now has a browser-tab icon
   (`/assets/img/favicon-32.png`, the team's hand-drawn logo) and
   `<meta name="theme-color" content="#0e6e6a">`. ORIGINAL has neither.
   → Check the tab icon actually appears and is recognisable at 16–32px.

2. **Nav brand mark** — the small gradient dot (`span.swatch`) before
   "点翠 · Diǎn Cuì" in the top-left is replaced by the hand-drawn logo image
   (`img.brand-mark`, `/assets/img/logo.webp`, 30px tall).
   → Check: the nav bar height is unchanged vs ORIGINAL; the mark is vertically
   centred with the wordmark; it does not push the nav items around; it renders
   (not a broken image) on both the light interior nav and the dark home nav.

3. **Ring-navigator brand mark** — same image at 38px inside the full-screen ring
   menu, replacing the dot there too. Open the ring nav and check it.

4. **Footer institution seals (NEW ROW)** — a centred row of three seals
   (HUST / College of Life Science and Technology / Qiming College) now sits above
   the copyright line, separated by a hairline. 58px tall, 44px at ≤600px.
   → Check: spacing looks deliberate, the row is centred, the hairline sits right,
   the three seals are not clipped, and the layout does not break at 375/768.

5. **Attributions cards are now keyboard-reachable** — this fixes the accessibility
   bug you found. Every `div.team-card` now has `tabindex="0"`.
   → Test: on `/Attributions.html`, press Tab repeatedly. Focus must land on the
   cards; a teal focus ring (`outline: 3px solid`) must be visible; and because the
   CSS already has `:focus-within`, **the contribution overlay must open on focus** —
   which finally gives you a way to verify the overlay that you could not hover-test
   in Round 0. Confirm `.info-overlay` opacity goes 0 → 1 on focus.
   ORIGINAL still has the bug (Tab never reaches a card) — that difference is expected.

### Aesthetic judgement wanted (not just pass/fail)

I cannot see the rendered page, so give me an opinion on these two:

- **A.** Does the logo mark read clearly at 30px in the nav, or is it too detailed
  and turning into a coloured smudge? Would it be better larger, smaller, or is the
  old plain dot honestly cleaner?
- **B.** The three institution seals are blue line-art on white discs, sitting on a
  near-black footer. Do they read as three bright white circles that dominate the
  footer, or does it look intentional? Suggest a treatment if it looks heavy
  (smaller / lower opacity / a lighter strip behind them / greyscale).

### Regression check (abbreviated — do not re-run everything)

- Full visual + geometry diff on **index, Project-Description, Attributions** only,
  at **1321 and 768**. Everything except the five changes above must still match.
- Interaction tests **A (nav dropdowns)** and **B (ring navigator)** only.
- **Console on all 7 pages.** Round 0 saw an intermittent
  `InvalidStateError: Transition was aborted` on the dev server, attributed to
  `@view-transition { navigation: auto }`. Now that NEW is a production build,
  report whether it still occurs. If it does, note on which pages and whether it
  reproduces on a second pass.

### Known and deliberately not fixed this round

- `Project-Description.html` overflows horizontally at 375px (present in both).
- `AI-Computational-Methods` / `AI-Ethics-Safety` are **intentional redirect stubs**
  (they carry a `<meta http-equiv="refresh">`), not unfinished pages.
- Attributions content is still "Team Member N / TODO" placeholder in both.

---

## Standing interaction test script (full suite — run only when asked)

**A. Top nav dropdowns** (width ≥ 1000px)
1. Click "Project" → menu appears, 6 rows with emoji + bold title + teal subtitle.
   DOM: parent `.nav-dropdown` gains `open`; trigger `aria-expanded="true"`.
2. Click "Lab" → Project closes, Lab opens (Lab has 4 rows, not 6 — expected).
3. Click empty page area → all closed, `aria-expanded="false"`.

**B. Ring navigator**
1. Click the round bottom-right button → full-screen overlay, circle with 5 labelled
   nodes; current page's node highlighted. DOM: `#ringNav` gains `open`.
2. Esc closes. 3. Click outside the circle closes. 4. The × closes.

**C. Home preface scroll** (1440×900 or widest available)
scrollY 0 / 120 / 250 / 400 / 600 — glow circle grows, background tints teal, scroll
cue fades after step 1. DOM at 400: `#bg-wash` opacity > 0.3, `.glow-circle` scale > 1.

**D. Home intro wheel** — scroll past "Four modules…" in +300px steps ×5. Highlight
advances 01→02→03→04; panel text changes; exactly one `.wheel-stop.active`; heading
stays pinned.

**E. Home TOC totems** — hover each triangle → `a.totem` gains `active`,
`.toc-preview` loses `idle`, caption shows title + desc + "Open … →". Pointer off the
group → back to idle. No orb follows the cursor.

**F. Attributions cards** — counts ≈ 10/7/6/3/2. Overlay opacity 0 → 1 on hover *or
focus* (focus now works, see Round 1 item 5).

**G. Responsive** — widths 1321/860/768/375. At ≤860 nav collapses to "Menu"
(`.site-nav` gains `nav-open`); at ≤760 the home intro-wheel stacks to one column.
Report any horizontal scrollbar on the body.

**H. Console** — every page: errors and failed requests.

---

## Response format

```
ROUND: 1
NEW build reachable (4322): yes/no
--- INTENDED CHANGES ---
1 favicon        — OK / problem: ...
2 nav brand mark — OK / problem: ...
3 ring nav mark  — OK / problem: ...
4 footer seals   — OK / problem: ...
5 card keyboard  — OK / problem: ...   (overlay opacity on focus: 0 -> ?)
--- AESTHETIC ---
A logo at 30px: <opinion + recommendation>
B footer seals on dark: <opinion + recommendation>
--- REGRESSION ---
index / Project-Description / Attributions at 1321 + 768 — PASS or diffs
A nav dropdowns — PASS/FAIL
B ring navigator — PASS/FAIL
--- CONSOLE ---
<per page; does InvalidStateError still occur on the production build?>
--- NOTES ---
<anything else>
```
