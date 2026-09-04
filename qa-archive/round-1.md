ROUND: 1
NEW build reachable (4322): yes - genuine production build confirmed
  (pages load only /assets/js/nav.js and /assets/js/home.js; no /@vite/client,
   no Astro dev-toolbar, no [vite] console lines anywhere)

--- INTENDED CHANGES ---

1 favicon - OK (verified on all 7 pages)
    Every page carries:
      <link rel="icon" href="/assets/img/favicon-32.png" sizes="32x32" type="image/png">
      <link rel="apple-touch-icon" href="/assets/img/favicon-180.png" sizes="180x180">
      <meta name="theme-color" content="#0e6e6a">
    Both files decode: favicon-32.png = 32x32, favicon-180.png = 180x180. No 404s.
    ORIGINAL has neither (confirmed Round 0).
    PROBLEM: there is no 16x16 asset. Tabs render at 16px, so Chrome downscales the
    32. I rendered the file at 16px, 32px and 6x nearest-neighbour to inspect it.
    At 32px it reads (dark-green mass + blue diagonal). At 16px it collapses into a
    green smudge with one faint blue pixel run - not recognisable. The pale pink
    ribbon occupies roughly the top third of the canvas and contributes nothing at
    that size; it is what eats the pixel budget. Recommend a hand-simplified 16x16
    (green disc + one blue stroke, no ribbon) and ideally an SVG, rather than
    relying on downscaling.

2 nav brand mark - OK, and unusually cleanly done
    img.brand-mark, /assets/img/logo.webp, natural 512x535, rendered 29x30.
    span.swatch is gone. Present on all 7 pages.
    Nav bar height UNCHANGED: 1306x61 on NEW, identical to ORIGINAL's 1306x61.
    Does NOT push the nav items - item origins are byte-identical to ORIGINAL:
        Home @801,12   Project @876,12   Lab @969,12
        Human Practices @1040,12   Team @1198,12
    (a.brand itself widened 152 -> 167px, absorbed entirely by existing left slack)
    Vertical centring: mark centre y 30.3, wordmark centre y 30.3, nav centre y 30.7
    - mark and wordmark share a centre line, 0.4px high in the bar. Centred.
    Renders on both navs, not broken: dark home nav (bg rgba(11,15,16,0.82)) and
    light interior nav (bg rgba(250,246,238,0.92)); complete=true, naturalWidth>0.
    The artwork carries both dark-green and bright-blue mass so it holds on cream
    and on near-black.
    Nit: computed object-fit is `fill`. Harmless today because the box ratio matches
    the asset, but it will stretch the logo the day someone swaps in an asset with a
    different aspect ratio. `contain` costs nothing and removes the trap.

3 ring nav mark - OK
    Same /assets/img/logo.webp inside #ringNav at height 38px (rendered 36x38),
    loaded, in div.rnc-brand beside the wordmark. The dot is gone from the ring too.
    Mark and wordmark share a centre line exactly (delta 0px). The brand block is
    centred inside the ring circle. Ring still opens with the correct node active
    (Project on Project-Description, Home on index).

4 footer seals - OK at every width tested
    Three images, all loaded, none clipped:
        seal-hust.webp     natural 300x234 -> 74x58
        seal-college.webp  natural 300x300 -> 58x58
        seal-qiming.webp   natural 120x120 -> 58x58
    Row: div.container.footer-institutions - flex, justify-content center,
    align-items center, gap 46px, padding 0 64px 18px, margin 0 113px 16px,
    border-bottom 0.667px rgba(255,255,255,0.1)  <- the hairline.
    Centred exactly: row midpoint 653 == container midpoint 653.
    Spacing reads deliberate: 18px from seals down to the hairline, then 16px to the
    copyright line. The hairline sits closer to the seals than to the copyright,
    which is the right way round.
    Responsive (measured in exact-width iframes, all single-row, all centred,
    no clipping, no horizontal scrollbar):
        768px -> seals 58px, gap 30.7px, row centre 376 == container centre 376
        600px -> seals 44px, gap 24px,   row centre 292 == container centre 292
        375px -> seals 44px, gap 20px,   row centre 180 == container centre 180
    The 44px-at-<=600 rule works as specified. flex-wrap:wrap is set but never
    actually wraps - at 375px the three seals plus gaps total 184px inside 335px of
    content width, so there is real headroom.
    Footer height 66 -> 159px; every page's document grew by exactly +93px.
    Nit: seal-qiming.webp ships only a 120x120 source for a 58 CSS px slot. Fine at
    1x and 1.5x, but zero headroom at 2x (needs 116 device px, has 120) - and it is
    the one seal with fine radiating line work. The other two ship 300px sources.
    Re-export Qiming at 240px for parity.

5 card keyboard - OK. The overlay opens on focus: opacity 0 -> 1, confirmed.
    All 28 div.team-card now carry tabindex="0" (28/28). First card sits at
    position 20 in the document tab order, after the nav.
    Focus ring: .team-card:focus-visible { outline: 3px solid var(--kingfisher-3);
    outline-offset: 2px } - resolves and paints, computed
    "solid rgb(47,143,214), offset 2px", and :focus-visible matches.
    Overlay: measured 0 before focus, 1 after focus, transform translateY(10px) ->
    none. Also confirmed visually - screenshot shows the first card with a blue ring
    and the panel reading "Team Member 1 / Wet Lab / CONTRIBUTION ... /
    WHAT OTHERS SAY ...". This closes the Round 0 item I could not hover-test.
    ORIGINAL still has the bug: 0 of 28 cards carry tabindex, first card tabIndex
    = -1, unreachable. Expected difference, confirmed.
    Two caveats, both honest limits rather than defects:
      - The literal Tab KEY still cannot be driven in this environment. Synthetic
        Tab presses do not move focus (21 presses left activeElement on BODY; one
        press from a focused nav link did not advance). Same class of limitation as
        the synthetic :hover in Round 0. I verified the behaviour with programmatic
        .focus(), which is exactly what Tab produces, plus the visual confirmation
        above. A human should still do one manual Tab pass to be certain the order
        feels right - 20 stops of nav before the first card is a lot, and a skip
        link would be worth considering.
      - The ring reads BLUE, not teal: --kingfisher-3 resolves to rgb(47,143,214).
        The brief describes it as teal. Cosmetic, but flagging in case the token
        chosen was not the one intended.

--- AESTHETIC ---

A logo at 30px: keep it, but it is sitting on the floor. Go to 34-36px.
   I rendered the asset at 24 / 30 / 38 / 48 / 150px side by side.
   At 150px it is a hand-drawn kingfisher motif: a dense dark-green mass of
   leaf/feather forms, one bright blue kingfisher feather sweeping up-right, and a
   pale pink ribbon feather crossing it - three distinct elements.
   At 48px all three still read. At 38px the green mass and blue feather read and
   the ribbon starts to dissolve. At 30px you get a dark-green blob plus one
   confident blue diagonal - and that diagonal is what saves it. It is NOT a
   coloured smudge, because a single high-contrast stroke survives downscaling.
   At 24px it does become a smudge.
   So: not too detailed at 30px, but there is no margin left, and it is carried by
   one stroke. Recommendation - 34-36px. The bar is 61px tall and the mark is 30px,
   so 36px still leaves 12px of breathing room top and bottom, and per the geometry
   above it will not change the bar height or move a single nav item. That buys back
   the ribbon and makes the bird legible rather than merely present.
   Is the old plain dot cleaner? Cleaner, yes - and anonymous. The dot said nothing;
   this says kingfisher, which is the entire project. Detail that reads at 36px
   beats tidiness that reads at any size. Keep the logo.
   (The 16px favicon in item 1 is the same asset hitting the same wall much harder.
   Fix that with a redrawn 16px, not by shrinking this one.)

B footer seals on dark: it looks intentional and does not dominate - but the row
   is not a set, and that is what makes the eye snag.
   I sampled the actual pixels. Footer background luminance is 14 (near black).
   Seal average luminance, and how much of each seal's box is near-white:
        HUST     avg 192,  42% near-white
        College  avg 160,  39% near-white
        Qiming   avg 152,  27% near-white
   So yes, they are comfortably the brightest objects in the footer - roughly a
   12-14x luminance jump off the background. But at 58px with 46px gaps inside a
   159px footer, the row still reads as a restrained institutional strip rather than
   three headlights, and the existing opacity 0.92 is already doing quiet work.
   The real problem is internal inconsistency:
     - HUST and College are blue line-art on WHITE grounds - two bright discs.
     - Qiming is the inverse: a solid BLUE disc with white rays.
     - HUST is a wide oval (74px), the other two are circles (58px).
   Bright / bright / dark, and wide / round / round. Against rgb(11,15,16) the two
   white discs punch while Qiming recedes into the background - it reads as three
   logos that happened to land next to each other, not as one row. HUST at 192 vs
   Qiming at 152 is a visible tonal step, not a subtle one.
   Recommended treatment, in order of value:
     1. Put a strip behind them. A full-bleed band of rgba(255,255,255,0.04-0.05)
        behind the row, using the existing hairline as its bottom edge, so the white
        discs sit ON something instead of floating on black. This fixes the punch
        without touching the seals, and it makes Qiming's dark disc read as
        deliberate contrast rather than a hole. Highest value by a distance.
     2. Drop to ~48px and opacity ~0.80. Cheap; these are supporting credits, not
        brand marks.
     3. Do NOT greyscale. It would flatten Qiming's blue ground into mud, and
        institutional seals usually carry brand rules forbidding recolouring.
   If you only do one thing, do the strip.

--- REGRESSION ---
index / Project-Description / Attributions at 1321 + 768 - PASS.
  Six page-width combinations, full per-element computed-style and geometry diff,
  measured in exact-width iframes on both origins. Page text is character-for-
  character identical on all six. Every single diff maps to an intended change and
  nothing else:
    - span.swatch missing in NEW              (change 2)
    - img.brand-mark extra in NEW             (change 2)
    - a.brand 152x34 -> 167x34, same origin   (change 2)
    - 3x img.footer-seal extra in NEW         (change 4)
    - footer 1306x66 -> 1306x159              (change 4)
    - copyright line / "Attributions" / "AI & Safety" all shifted down exactly 93px
    - docHeight: index 4487->4580, project 15229->15322, attributions 6279->6372
      (at 768: 4469->4561, 17898->17991, 7043->7136)
  New images accounted for: logo.webp (nav + ring), seal-hust, seal-college,
  seal-qiming. No images lost. No hrefs changed. No font, size, weight, colour,
  spacing or alignment change anywhere outside the footer and brand.
  Only unexplained row in the whole run: 768_index span.chevron top 853 -> 854,
  1px, the usual scroll-animation residue.
  Horizontal scrollbar: none, either site, at 1321 or 768.
A nav dropdowns - PASS. Project opens with 6 rows, .nav-dropdown gains "open",
  aria-expanded="true"; Lab click closes Project and opens Lab (4 rows, expected);
  click on empty area closes all, all three aria-expanded="false". Row anatomy
  unchanged: ndi-icon + ndi-title (weight 700) + ndi-sub (teal rgb(14,110,106)).
  All 6 Project hrefs unchanged from Round 0.
B ring navigator - PASS. Opens with class "ring-nav open", aria-hidden="false",
  5 nodes with the current page's node "active". All four close paths work:
  Esc, click outside the circle, and the X - each returns "ring-nav" /
  aria-hidden="true".

--- CONSOLE ---
Per page, production build (4322):
    index                          AbortError: Transition was skipped
    Project-Description.html       AbortError: Transition was skipped
    Wet-Lab-Experiments.html       AbortError: Transition was skipped
    Human-Practices.html           AbortError: Transition was skipped  (intermittent)
    Attributions.html              AbortError: Transition was skipped
    AI-Computational-Methods.html  none
    AI-Ethics-Safety.html          none
Failed requests: NONE on any of the 7 pages (12-14 resources each, all 200/304).
Fonts, CSS, JS, logo and all three seals resolve everywhere.

Does the InvalidStateError still occur? It has changed form and got WORSE, and my
Round 0 conclusion was wrong - I owe you a correction.
  - The message is now "AbortError: Transition was skipped" rather than
    "InvalidStateError: Transition was aborted because of invalid state". Same
    family (cross-document view transitions), different failure point.
  - It is NOT rare. On a deliberately slow pass (6s dwell per page) it fired on 4 of
    5 pages. Round 0's "intermittent" was an artefact of how fast I was navigating.
  - It is NOT an automation artefact. I reproduced it with a real mouse click on the
    "Team" nav link from the home page: click -> lands on /Attributions.html ->
    AbortError in the console. This is a genuine user-facing error.
  - It is NEW-only. The identical slow 5-page pass on ORIGINAL (8080) produced ZERO
    console messages, and the identical real click Home -> Team on ORIGINAL produced
    zero. So my Round 0 line that "the original simply did not happen to trip it" is
    not supported - the original does not trip it under conditions where NEW trips
    it every time.
  - And yet the two builds look identical at the source level. I checked: both serve
    byte-identical nav.js (3664 chars) and home.js (8994 chars); both style.css
    declare `@view-transition { navigation: auto }` AND
    `view-transition-name: site-nav` on the header; both resolve the same two
    view-transition-names at runtime (html -> root, header.site-nav -> site-nav);
    both have exactly one 71-char inline script. NEW's style.css is 15980 vs
    ORIGINAL's 15065 - the +915 chars are the new footer-institutions and brand-mark
    rules.
    So the difference is NOT in the transition declarations. It is most likely in
    how `astro preview` serves the documents versus the frozen static server -
    response headers or timing causing the incoming transition to be skipped. I did
    not chase it further because the fix does not depend on the cause.
  - Fix, regardless of cause: the error is an unhandled promise rejection from a
    skipped ViewTransition. Whatever holds the transition promise should swallow it -
    attach a `.catch(() => {})` to `.ready` / `.finished`. A skipped transition is a
    normal, expected outcome and should not surface as a console exception. Worth
    also confirming this on the real iGEM host, since the serving layer looks
    implicated.

--- NOTES ---
- All five intended changes verified. Items 2, 3 and 4 are implemented well;
  item 2 in particular is impressively surgical - same bar height, same item
  positions, same centre line, on both the light and dark nav.
- Item 5 genuinely closes the Round 0 accessibility finding, and it also finally
  gave me a way to verify the overlay I could not hover-test.
- The regression half is completely clean. Nothing outside the five changes moved.
- Redirect stubs confirmed working as documented: AI-Computational-Methods.html and
  AI-Ethics-Safety.html both carry a meta refresh; following the latter in a real
  navigation landed on /Wet-Lab-Experiments.html#safety. Both stubs also correctly
  carry the new favicon, theme-color, brand mark and footer seals.
- Environment note so nobody chases it: a declared `outline: 3px` computes to
  2.667px in this browser session, i.e. Chrome page zoom is ~89%, not 100%. It
  affects absolute px figures only. Every measurement above was taken identically on
  both sites, and the 1321/768/600/375 figures come from exact-width iframes, so all
  comparisons and ratios are unaffected.
- Follow-ups, none blocking: real 16x16 favicon; `object-fit: contain` on
  .brand-mark; higher-res Qiming seal; the view-transition rejection handler; and
  possibly a skip link, given the first card is the 21st tab stop.
- Still open from Round 0 and deliberately not fixed this round, as you noted:
  Project-Description horizontal overflow at 375px (both sites), and the
  "Team Member N / TODO" placeholder content on Attributions (both sites).
- Screenshots: not saved. This session has no screenshot-to-disk path. The
  per-element computed-style + geometry diff above is the evidence, per the brief.
