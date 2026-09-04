# REVIEW — coordination between Claude Code and the browser-QA session

This file is the shared checklist for visual review. **Claude Code** updates the
"Round" section below after each batch of changes. The **browser session** reads it,
checks the listed URLs against the originals, and returns a report in the format at
the bottom. The **human** copies text between the two.

There is no automatic channel between the two sessions — every hand-off is a paste.

---

## URLs — both served over http (no file:// needed)

| | New (Astro) | Original (static) |
|---|---|---|
| Home | http://localhost:4321/ | http://localhost:8080/index.html |
| Project | http://localhost:4321/Project-Description.html | http://localhost:8080/Project-Description.html |
| Wet Lab | http://localhost:4321/Wet-Lab-Experiments.html | http://localhost:8080/Wet-Lab-Experiments.html |
| Human Practices | http://localhost:4321/Human-Practices.html | http://localhost:8080/Human-Practices.html |
| Attributions | http://localhost:4321/Attributions.html | http://localhost:8080/Attributions.html |
| AI Comp Methods | http://localhost:4321/AI-Computational-Methods.html | http://localhost:8080/AI-Computational-Methods.html |
| AI Ethics/Safety | http://localhost:4321/AI-Ethics-Safety.html | http://localhost:8080/AI-Ethics-Safety.html |

Both servers confirmed (200) on all 7 pages + assets. On the new site, `/Name` and
`/Name.html` both work.

## Hand-off (minimal human involvement)

- This file is also served at **http://localhost:4321/qa/round.md** — the browser
  session opens that URL to get its instructions; the human does not paste them.
- The browser session saves its report as **`C:\Users\junya\Downloads\qa-report.md`**
  and screenshots as **`C:\Users\junya\Downloads\qa-*.png`** — Claude Code reads them
  from there. The human only says "go" / "done".

---

## Round 0 — faithful-port baseline (current)

**Goal:** the Astro pages must be visually identical to the originals. No design
changes yet.

**Please check (all 7 pages, at 1440px and 768px):**
- [ ] Fonts, spacing, colours, alignment match the original
- [ ] Top nav: 3 dropdowns open and show icon + title + subtitle cards
- [ ] Footer identical; floating bottom-right button opens the full-screen ring menu
- [ ] Home: cream glow circle; scroll brightens it + washes bg teal; "Four modules"
      section pins and steps through 4 modules; hovering the triangle totems fades
      in a caption overlay
- [ ] Project: tables + the grey code block under "Model" (whitespace intact)
- [ ] Attributions: member-card grids fill; hover flips a card
- [ ] Wet Lab / Project: coloured DBTL cards, status pills render

**Known open items:** none yet.

---

## Interaction tests — run on BOTH sites, report divergence

For each: before screenshot, after screenshot, and the DOM check. If an action does
nothing, say so. If you cannot perform it, write "COULD NOT TEST: <why>".

**A. Top nav dropdowns** (any page, width ≥ 1000px)
1. Click the "Project" trigger → its menu appears, 6 rows each with emoji + bold
   title + teal subtitle. DOM: parent `.nav-dropdown` gains `open`; trigger
   `aria-expanded="true"`.
2. Click "Lab" trigger → Project menu closes, Lab opens.
3. Click empty page area → menu closes; `aria-expanded="false"`.
4. Quote the 6 item titles + subtitles of one dropdown.

**B. Ring navigator** (any page)
1. Click the round button fixed bottom-right → full-screen dark overlay; a circle
   with 5 labelled nodes (Home, Project, Human Practices, Lab, Team); current
   page's node highlighted. DOM: `#ringNav` gains `open`, `aria-hidden="false"`.
2. Press Esc → closes. 3. Reopen, click dark area outside circle → closes.
4. Reopen, click the × → closes.

**C. Home — preface scroll** (localhost:4321/, 1440×900)
Set `window.scrollY` to 0, 120, 250, 400, 600; screenshot each. Across the series
the cream glow circle grows a little and its halo brightens; the background tints
from near-black toward teal; the "scroll" cue fades out after the first step.
DOM at scrollY≈400: `getComputedStyle(document.getElementById('bg-wash')).opacity`
> 0.3; `.glow-circle` transform scale > 1.

**D. Home — intro wheel** (1440×900)
Scroll past the "Four modules, one supply chain" heading, then in +300px steps ×5.
The left list of 4 items should advance its highlight 01→02→03→04 and the right
panel text should change (title / tagline / What is it / Methods / Consequence).
Screenshot each step. DOM: exactly one `.wheel-stop.active` at a time; its number
matches the panel `<h3>`. Report the 4 panel titles. Note whether the heading
stays pinned while stepping.

**E. Home — TOC totems** (scroll to "Hover a totem")
1. Hover the first triangle; if nothing happens, press Tab until a totem is
   focused → a dark caption panel fades in over the image with a title +
   description + "Open … →" link; the triangle lightens/lifts. DOM: that
   `a.totem` gains `active`; `.toc-preview` loses `idle`.
2. Repeat for all 4; report the 4 titles + each "Open →" `href`.
3. Move pointer off the whole group → panel returns to idle "Hover a totem" text.
4. Confirm NO dot/orb follows the cursor anywhere on this page.

**F. Attributions — cards** (localhost:4321/Attributions.html)
1. Count cards under each heading (expect ≈ 10 / 7 / 6 / 3 / 2).
2. Hover one card; if nothing, Tab into it → an overlay with "Contribution" /
   "What others say" fades in over the name plate. DOM:
   `getComputedStyle(.info-overlay).opacity` goes 0 → 1.

**G. Responsive** (Home + one interior page)
Widths 1440, 860, 768, 375; screenshot each. At ≤860 the top nav collapses to a
"Menu" button; clicking toggles it (DOM: `.site-nav` gains `nav-open`); dropdowns
become a stacked accordion. At ≤760 on Home the intro-wheel stacks to one column.
Report any horizontal scrollbar on the page body at any width (there should be none).

**H. Console** — every page: report any console error or failed request.

---

## Response format — save as C:\Users\junya\Downloads\qa-report.md

```
ROUND: 0
Dev server reachable: yes/no
Sub-page URL form used: /Name.html

index          — PASS   (or)   DIFFERENCES:
  - <concrete difference>
Project-Description — PASS / DIFFERENCES: ...
Wet-Lab-Experiments — ...
Human-Practices — ...
Attributions — ...
AI-Computational-Methods — ...
AI-Ethics-Safety — ...

Console errors: <list, or "none">
Screenshots: <attached / saved as "<page> — new|orig — 1440|768">
Overall aesthetic notes (optional): <brief>
```
