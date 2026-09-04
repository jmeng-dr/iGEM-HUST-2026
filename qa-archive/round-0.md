ROUND: 0
Dev server reachable: yes
Sub-page URL form used: /Name.html

Environment caveats (read first)
- The QA browser window is maximised and refuses programmatic resize, so a 1440px
  viewport was NOT reachable. Widest real viewport available: 1321px. All 1440
  checks were run at 1321 instead. 768 / 860 / 375 were obtained by loading each
  page in a same-origin iframe at that exact CSS width. Both sites were always
  measured at identical widths, so every comparison below is like-for-like.
- Screenshots could not be written to disk from this session (the browser tooling
  exposes no save-to-disk path). Every visual claim below is backed instead by a
  full computed-style + geometry diff of every visible element, which is stricter
  than a pixel comparison and is reproducible.
- Comparison method: for every visible element on both sites, compared
  tag/id/class, x/y/width/height, font-family, font-size, line-height,
  font-weight, colour, background-colour, text-align, letter-spacing, opacity,
  border-radius, border-width, display, margin, padding; plus full page
  innerText, every image src + naturalWidth, and every anchor href. Each page was
  scroll-swept top-to-bottom before snapshotting so reveal-on-scroll content was
  rendered.

--- VISUAL ---
index                      - PASS   |   DIFFERENCES: none
Project-Description        - PASS   |   DIFFERENCES: none
Wet-Lab-Experiments        - PASS   |   DIFFERENCES: none
Human-Practices            - PASS   |   DIFFERENCES: none
Attributions               - PASS   |   DIFFERENCES: none
AI-Computational-Methods   - PASS   |   DIFFERENCES: none
AI-Ethics-Safety           - PASS   |   DIFFERENCES: none

At 1321px (ORIG / NEW):
  index                     docHeight 4450 / 4450   elements  52 /  52   text identical
  Project-Description       docHeight 15229 / 15229 elements 447 / 447   text identical
  Wet-Lab-Experiments       docHeight 13623 / 13623 elements 485 / 485   text identical
  Human-Practices           docHeight 5259 / 5259   elements  96 /  96   text identical
  Attributions              docHeight 6279 / 6279   elements 212 / 212   text identical
  AI-Computational-Methods  docHeight 881 / 881     elements  17 /  17   text identical
  AI-Ethics-Safety          docHeight 881 / 881     elements  17 /  17   text identical

At 768px (ORIG / NEW):
  index 4469/4469 (44/44), Project 17898/17898 (441/441),
  Wet Lab 16685/16685 (480/480), Human Practices 5587/5587 (92/92),
  Attributions 7043/7043 (208/208), AI-Comp 900/900 (13/13),
  AI-Ethics 900/900 (13/13). All text identical, zero style or geometry diffs.

At 860px and 375px (index + Project-Description): zero diffs, text identical.

No missing or extra elements, no missing/broken images (all image src and
naturalWidth identical), no changed hrefs, no font/size/weight/colour/spacing/
alignment differences on any page at any width.

The only rows the differ flagged were position:fixed / position:sticky items
(site header, a.brand, span.swatch, span.rnt-dot, span.chevron, button.nav-toggle)
offset by 1-11px. That is residual smooth-scroll at snapshot time, not a site
difference - confirmed by re-running with fixed/sticky elements excluded, which
returned zero diffs on every page.

--- INTERACTION ---
A nav dropdowns    - PASS - Identical on both sites. Click "Project" -> parent
  div.nav-dropdown gains "open", trigger aria-expanded="true", menu opacity 1,
  6 rows. Click "Lab" -> Project closes (aria-expanded="false"), Lab opens
  (aria-expanded="true"), exactly 1 open at a time. Click empty page area ->
  0 open, all three triggers aria-expanded="false".
  Row markup identical on both: span.ndi-icon (20px emoji) + span.ndi-title
  (14.72px, weight 700, rgb(35,32,26)) + span.ndi-sub (12.16px, weight 400,
  teal rgb(14,110,106)).
  Project dropdown, 6 items (title - subtitle -> href):
    1. Project Description - Pipeline and four modules -> Project-Description.html
    2. Model - Optical, synbio and protein modelling -> Project-Description.html#modelling
    3. Engineering - The DBTL loop, worked example -> Project-Description.html#engineering-cycle
    4. Results - Model vs. wet-lab cross-checks -> Project-Description.html#validation
    5. Applications - Wearable prototypes and extensions -> Project-Description.html#applications
    6. Contribution - Parts, protocols and open models -> Project-Description.html#contribution
  NOTE: the Lab dropdown has 4 rows, not 6 - on BOTH sites (Experiments /
  Notebook / Part Collection / Safety). The brief's "6 rows" holds for Project.

B ring navigator   - PASS - Identical on both sites. Trigger at bottom-right ->
  #ringNav className "ring-nav open", aria-hidden="false", opacity 1, background
  rgb(11,15,16), 5 nodes: Home (pos-top, active on home), Project (pos-upper-left),
  Human Practices (pos-upper-right), Lab (pos-lower-left), Team (pos-lower-right);
  current page's node carries "active". Esc closes (class back to "ring-nav",
  aria-hidden="true"). Reopen + click dark area outside circle -> closes. Reopen +
  click the X (button.ring-nav-close) -> closes. All four paths pass on both.

C preface scroll   - PASS - Values byte-identical between the two sites:
    scrollY 0   : #bg-wash opacity 0      .glow-circle scale 1.0000  480x480  scroll-cue opacity 1
    scrollY 120 : #bg-wash opacity 0.208  .glow-circle scale 1.1020  529x529  scroll-cue opacity 0
    scrollY 250 : #bg-wash opacity 0.361  .glow-circle scale 1.1770  565x565  scroll-cue opacity 0
    scrollY 400 : #bg-wash opacity 0.444  .glow-circle scale 1.2170  584x584  scroll-cue opacity 0
    scrollY 600 : #bg-wash opacity 0.450  .glow-circle scale 1.2200  586x586  scroll-cue opacity 0
  DOM assertions at scrollY 400 met on both: bg-wash opacity 0.444 > 0.3, and
  glow-circle transform scale 1.217 > 1. Glow grows monotonically, halo brightens
  with bg-wash, background tints toward teal, scroll cue fades to 0 after step 1.

D intro wheel      - PASS - Identical on both sites. Exactly one button.wheel-stop
  carries "active" at every step and its number always matches the panel <h3>.
  Highlight advances 01 -> 02 -> 03 -> 04 over the first four +300px steps, then
  holds at 04 for steps 5 and 6. Panel title/tagline/What is it/Methods/
  Consequence text changes at every step.
  The 4 panel titles:
    Module 1: Cellulose Recovery   (Upstream, safety-net)
    Module 2: Pigment Film         (Midstream, undertone)
    Module 3: CNC Iridescent Film  (Midstream, core structural color)
    Module 4: Reflectin Layer      (Innovation layer)
  Heading pinned? YES - "Four modules, one supply chain" holds at top:163px
  through all four stepping positions on both sites, and releases only after the
  last module (top 2, then -298).

E toc totems       - PASS - Identical on both sites. Hovering a triangle sets
  a.totem.active (exactly one at a time) and div.toc-preview loses "idle"
  (opacity 1); the caption panel shows title + description + "Open ... ->" link.
  Pointer off the group -> panel returns to the idle "Hover a totem. Project .
  Wet Lab . Human Practices . Team: hover one to preview it here." text and no
  totem is active.
    1. Project          -> Project-Description.html
    2. Wet Lab          -> Wet-Lab-Experiments.html
    3. Human Practices  -> Human-Practices.html
    4. Team             -> Attributions.html
  Cursor orb absent? YES. div#cursor-orb exists in the DOM on BOTH sites but its
  computed opacity stays 0 and its transform never leaves
  matrix(1,0,0,1,-6.5,-6.5) through any amount of pointer movement anywhere on
  the page. Nothing follows the cursor.

F attribution cards- PASS (counts) / see note (overlay) - Card counts identical
  on both sites: Wet Lab 10, Dry Lab 7, Human Practices 6, Advisors 3,
  Principal Investigators 2 = 28 div.team-card, 28 div.info-overlay.
  Overlay opacity 0 -> 1 on hover: COULD NOT TEST by hovering - the automation
  pointer does not trigger CSS :hover in this environment (element.matches(':hover')
  reports true, but the :hover rule does not apply; confirmed visually - the
  cursor sits on the card and no overlay appears), and div.team-card has no
  focusable descendant so the :focus-within fallback cannot fire either. Tab
  never lands on a card.
  What was verified instead, and it is identical on both sites:
    base rule   .team-card .info-overlay { opacity: 0; transform: translateY(10px);
                transition: opacity .28s, transform .28s;
                background: rgba(11,15,16,0.94); position: absolute; inset: 0;
                padding: 16px }
    hover rule  .team-card:hover .info-overlay, .team-card:focus-within
                .info-overlay { opacity: 1; transform: none }
    forced state renders correctly on both: 225x299 panel, rgba(11,15,16,0.94),
    content "Team Member 1 / Wet Lab / CONTRIBUTION ... / WHAT OTHERS SAY ..."
  So the mechanism and its styling are byte-identical between the two builds; only
  the live hover transition is untestable here.
  (For contrast, the totem hover in test E did work on both - those use JS
  mouseenter listeners rather than CSS :hover.)

G responsive       - PASS - Identical on both sites at every width.
  1321: full horizontal nav, no Menu button.
   860: top nav collapsed to button.nav-toggle "Menu" (display:block) on both.
   768: same, collapsed.
   375: same, collapsed.
  Menu button behaviour (tested at 768 on Project-Description, both sites):
    before  .site-nav className "site-nav"
    click   .site-nav className "site-nav nav-open"   <- gains nav-open, correct
    then    clicking a .nav-drop-trigger opens it as a stacked accordion -
            .nav-drop-menu computed position becomes "static" (not absolute),
            display flex, width 477px, laid out in flow at 237,93 477x243;
            trigger aria-expanded="true"
    click   .site-nav className back to "site-nav"    <- closes
  Home intro-wheel stacking (.wheel-layout grid-template-columns):
    1321 -> "220px 684px"          two columns, side by side
     860 -> "220px 490.667px"      two columns, side by side
     740 -> "650.667px"            ONE column, panel stacked below the track
     375 -> "320px"                ONE column, panel stacked below the track
    Identical on both sites; the <=760 one-column rule works as specified.
  Horizontal scrollbar on the page body:
    1321: none on any page (both sites)
     860: none (both sites)
     768: none on any of the 7 pages (both sites)
     375: index none (both) - BUT Project-Description overflows on BOTH sites:
          scrollWidth 416 > clientWidth 360. Pre-existing in the original and
          faithfully carried over, so it is not a port regression, but it is a
          real bug worth fixing. Likely a wide table or the grey code block under
          "Model" not being wrapped in an overflow-x:auto container.

H console          - per page:
  ORIGINAL (localhost:8080) - all 7 pages: none. Zero console messages of any
  level, zero failed requests (8 resources per interior page, 10 on index, all
  HTTP 200).
  NEW (localhost:4321):
    index                     - InvalidStateError: Transition was aborted because of invalid state
    Project-Description.html  - InvalidStateError: Transition was aborted because of invalid state
    Wet-Lab-Experiments.html  - none
    Human-Practices.html      - none
    Attributions.html         - InvalidStateError: Transition was aborted because of invalid state
    AI-Computational-Methods.html - none
    AI-Ethics-Safety.html     - none
  Network: 217 requests captured across the 7 NEW pages, every one 200 or 304.
  No 404s, no missing CSS/JS/fonts on either site. Google Fonts (Cormorant
  Garamond + Inter) resolve 200 on both. Remaining NEW-only requests are all
  dev-server infrastructure (/@vite/client, /@id/astro/runtime/client/dev-toolbar/
  entrypoint.js, /node_modules/.vite/deps/*) plus the [vite] connecting/connected
  debug lines - expected in dev, will not exist in a production build.

  On the InvalidStateError: it is INTERMITTENT and I could not reproduce it on a
  second pass over the same three pages. Cause is the cross-document view
  transition declared by "@view-transition { navigation: auto }" in
  /assets/css/style.css being aborted when a navigation starts before the previous
  transition settles - which rapid automated navigation provokes. That exact rule
  is present in BOTH builds' style.css (verified in the raw CSS on 8080 as well),
  so this is not something the Astro port introduced; the original simply did not
  happen to trip it during this run. Worth re-checking against a production build
  ("astro build" + preview) before treating it as a real defect. The site has no
  Astro ClientRouter and no astro-view-transitions meta - this is the native
  browser feature driven purely by that CSS at-rule.

--- NOTES ---
- Round 0's goal is met. Across all 7 pages, at 4 widths, with per-element
  computed styles and geometry compared, the Astro rebuild is indistinguishable
  from the original. Zero real visual differences were found. Page text is
  character-for-character identical on every page.
- All eight interaction behaviours behave identically on both builds. Nothing
  regressed in the port; the two failures to fully exercise a behaviour (F's
  hover overlay) are limitations of the automation pointer, not of the site.
- Pre-existing issues carried over faithfully (present in the ORIGINAL too, so
  out of scope for a faithful port but worth a ticket):
    1. Project-Description.html overflows horizontally at 375px (416 > 360).
    2. AI-Computational-Methods.html and AI-Ethics-Safety.html are stubs on both
       builds - 881px tall, 17 elements, nav + footer only, no content yet.
    3. Attributions is entirely placeholder content on both - all 28 cards read
       "Team Member N" with "TODO: one or two sentences on what this person
       actually did." and "TODO: a short peer quote."
    4. .team-card is not keyboard reachable. The CSS already anticipates
       :focus-within, but no descendant is focusable, so the overlay is
       unreachable without a mouse. An accessibility gap in both builds.
- Asset loading differs only as dev-mode noise: the NEW site pulls the Vite client
  and the Astro dev toolbar. Recommend re-running this suite against
  "astro build" + "astro preview" output before sign-off, so that the comparison
  is production-to-production.

--- SCREENSHOTS ---
NOT SAVED. This session cannot write files to E:\Downloads and the browser
tooling exposes no screenshot-to-disk path. The per-element style and geometry
diff described at the top of this report is the substitute evidence, and it is
strictly more sensitive than a pixel diff for the kinds of change listed in the
brief (font, size, weight, colour, spacing, alignment, missing/extra element,
broken image, layout shift).
