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

## Response format (browser session → paste back to Claude Code)

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
