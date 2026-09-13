/* Site search — the palette behind the floating button, and Ctrl/Cmd-K.
 *
 * The index (assets/search-index.json, built by scripts/build-search-index.mjs) is one
 * entry per heading: page, anchor, heading, depth, breadcrumb, and the prose up to the next
 * heading. Splitting by heading is what lets a result say WHERE in a 30k-character page the
 * match is, which is most of the value on this site.
 *
 * Fetched on FIRST OPEN, not on load. It is 89 KB, and a reader who never searches should
 * not pay for it; by the time the panel has animated in it is there.
 *
 * Ranking is deliberately simple and explainable rather than clever. Every query term must
 * appear somewhere in the entry — an AND, because on a corpus this small an OR returns
 * everything — and the score is the sum of where each term was found: a heading is worth
 * more than a breadcrumb, which is worth more than body text, with a bonus for matching at
 * a word boundary and again for matching at the very start of the heading. No fuzzy
 * matching: on 158 entries a typo returning nothing is more honest than a typo returning
 * something unrelated.
 */
(function () {
  var listeners = [];
  function on(t, type, fn, opts) { t.addEventListener(type, fn, opts); listeners.push([t, type, fn, opts]); }
  function offAll() { listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = []; }

  var index = null, loading = null, unavailable = false;
  var open = false, results = [], active = -1;
  var triggers = [], overlay, input, list, status;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch("assets/search-index.json")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { index = prepare(data); return index; })
      /* An index that failed to load is NOT an empty corpus, and must not be reported as
         one: "no matches for everything" reads as a broken search with no way to tell.
         Under `npm run dev` this is the normal state until something has been built. */
      .catch(function () { unavailable = true; index = []; return index; });
    return loading;
  }

  /* Typographic dashes and quotes are folded to their ASCII shape on BOTH sides. The wiki is
     written properly — "Box–Behnken" carries an en dash, "we're" a curly apostrophe — and a
     reader typing it on a keyboard produces neither, so without this the two never meet. */
  function fold(str) {
    return str.toLowerCase()
      .replace(/[‐-―−]/g, "-")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
  }
  function terms(q) {
    return fold(q).split(/\s+/).filter(function (t) { return t.length > 1; });
  }

  /* Folded once when the index arrives rather than on every keystroke: 158 entries times a
     term times a keypress is work that never changes. */
  function prepare(data) {
    data.forEach(function (e) {
      e._h = fold(e.h); e._c = fold(e.c || ""); e._x = fold(e.x || "");
      /* The file name counts as part of the page's name. iGEM's own vocabulary is in the
         URLs — a judge types "attributions", and this site calls that page "Team". */
      e._t = e.d === 1
        ? fold((e.t || "") + " " + e.p.replace(/\.html$/, "").replace(/-/g, " "))
        : "";
    });
    return data;
  }

  /* HOW OFTEN, not how prominently.
   *
   * The old ranking was a pile of weighted bonuses: 40 for the term being anywhere in the
   * heading, 30 more if the heading started with it, 12 for the breadcrumb, 6 for the body,
   * 4 more if the body hit was at a word start. It answered the question "which section
   * looks most like a match" — and it could put a section that names the word once in its
   * title above one that is actually about it and says it eleven times.
   *
   * The count answers the question the reader asked. Occurrences across the heading, the
   * breadcrumb and the section's text, added up over every word in the query.
   *
   * Ties keep the order the index was built in, which is site order: the pages in the order
   * the bar lists them, and within a page the sections top to bottom. Array.sort is stable,
   * so this needs no code — but it does need the index to be built in that order, which is
   * what the ORDER list in build-search-index.mjs is for. */
  function countIn(hay, t) {
    if (!hay) return 0;
    var n = 0;
    for (var i = hay.indexOf(t); i >= 0; i = hay.indexOf(t, i + t.length)) n++;
    return n;
  }
  function scoreOne(entry, t) {
    return countIn(entry._h, t) + countIn(entry._c, t) + countIn(entry._x, t);
  }

  /* Is this term a piece of the page's NAME, in the sense that someone typing it is asking
     for the page? Not the same question as "does the name contain these letters", which is
     what this used to test and which is far too generous: "es" is inside "description" and
     inside "practices", so two letters were enough to make Project and Human Practices claim
     to have been asked for by name and take the top two rows — as page-level entries, with no
     body to highlight and no snippet to show, so they arrived blank as well as wrong.
     A name is made of words. The term has to start one, and be long enough to be a name and
     not a fragment: "pro" asking for Project is a reasonable reading, "es" is not. */
  function namesIt(name, t) {
    if (!name || t.length < 3) return false;
    for (var i = name.indexOf(t); i >= 0; i = name.indexOf(t, i + 1)) {
      if (i === 0 || /[\s\-–—/(]/.test(name.charAt(i - 1))) return true;
    }
    return false;
  }

  function search(q) {
    var ts = terms(q);
    if (!ts.length || !index) return [];
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i], total = 0, all = true;
      /* THE ONE THING THAT STILL OUTRANKS A COUNT: asking for a page by its name.
         A page's own entry has no body text to count, so on frequency alone it loses to
         every section that mentions the name in passing — and "project" would answer with
         whichever paragraph says the word most often instead of the Project page. The wiki's
         vocabulary is in its URLs and its titles, so a query that IS a page's name is a
         request for that page, and it goes first. */
      var namesPage = e.d === 1 && !!e._t;
      for (var k = 0; k < ts.length; k++) {
        if (namesPage && !namesIt(e._t, ts[k])) namesPage = false;
        var n = scoreOne(e, ts[k]);
        if (!n && !namesPage) { all = false; break; }
        total += n;
      }
      if (!all) continue;
      hits.push({ e: e, n: total, name: namesPage ? 1 : 0 });
    }
    hits.sort(function (a, b) { return (b.name - a.name) || (b.n - a.n); });
    return hits.slice(0, 24).map(function (h) { return h.e; });
  }

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function mark(text, ts) {
    var out = esc(text);
    ts.forEach(function (t) {
      out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "\u0001$1\u0002");
    });
    return out.split("\u0001").join("<mark>").split("\u0002").join("</mark>");
  }

  /* UP TO TWO WINDOWS of the body text, each opened on a cluster of matches.
   *
   * One window opened on the first occurrence made the list misreport its own order. Results
   * are ranked by how often the query appears, but a window is 190 characters against a
   * median section of 387: a long section with six hits spread through it showed one, while a
   * short section with three hits together showed all three — and short sections sit lower
   * down, so the further you scrolled the more lit words you saw. The ranking was right and
   * the evidence for it read backwards.
   *
   * Two windows rather than a longer one. Lengthening it buys the same 190 characters again
   * whether or not there is anything in them, and the matches in a long section are not
   * spread evenly — they come in clusters, with paragraphs of setting-up in between. Two
   * clusters, joined by an ellipsis, cover about as much of a median section as it has.
   *
   * Not split per paragraph, which was the other way to close the gap. A section is the unit
   * a reader wants: "the part that is about this", not "the sentences containing the word".
   * At the median a section IS one paragraph anyway, so splitting would change nothing for
   * half the site and, for the other half, would turn one section that says a word six times
   * into six results that say it once — and the ranking would then be about which paragraph
   * repeats itself, not which section is on the subject. */
  /* Half the text a row used to carry: two windows of 95 characters rather than two of 190.
     Halved on the WINDOW rather than by dropping to a single fragment, which would have cost
     the same characters — because the fragment count is what makes the lit words agree with
     the ranking, and the width is only how much setting each one comes wrapped in. A row is
     for deciding whether to click, not for reading. */
  var WINDOW = 95, LEAD = 30, FRAGMENTS = 2;
  function snippet(entry, ts) {
    var x = entry.x || "";
    if (!x) return "";
    var low = x.toLowerCase();
    var hits = [];
    ts.forEach(function (t) {
      for (var i = low.indexOf(t); i >= 0; i = low.indexOf(t, i + t.length)) hits.push(i);
    });
    hits.sort(function (a, b) { return a - b; });
    if (!hits.length) hits.push(0);

    /* Take the densest window, drop every hit it covers, repeat. Dropping rather than
       advancing past it is what stops the second fragment from being a near-duplicate of the
       first, offset by a few words. */
    var spans = [];
    var left = hits.slice();
    while (spans.length < FRAGMENTS && left.length) {
      var from = 0, best = -1, covered = 0;
      for (var k = 0; k < left.length; k++) {
        var start = Math.max(0, left[k] - LEAD);
        var n = 0;
        for (var j = k; j < left.length && left[j] < start + WINDOW; j++) n++;
        /* Strictly greater, so a tie keeps the EARLIER window: reading a section from as
           near its beginning as the evidence allows is the better of two equal answers. */
        if (n > best) { best = n; from = start; covered = n; }
      }
      spans.push(from);
      left = left.filter(function (h) { return h < from || h >= from + WINDOW; });
      if (!covered) break;
    }
    spans.sort(function (a, b) { return a - b; });

    /* Overlapping or touching windows are one window. Two fragments that share text would
       show the same sentence twice with an ellipsis between them. */
    var merged = [];
    spans.forEach(function (f) {
      var last = merged[merged.length - 1];
      if (last && f <= last.to) { last.to = Math.max(last.to, f + WINDOW); return; }
      merged.push({ from: f, to: f + WINDOW });
    });

    var out = "";
    merged.forEach(function (m, i) {
      var cut = x.slice(m.from, m.to);
      if (m.from > 0) cut = "…" + cut.replace(/^\S*\s/, "");
      if (m.to < x.length) cut = cut.replace(/\s\S*$/, "") + "…";
      out += (i ? " " : "") + mark(cut, ts);
    });
    return out;
  }

  /* ---------- arriving at a result ---------- */

  /* Two consumers, two deliberately separate keys. nav.js reads searchLandAt to centre the
     landing and clears it in its own astro:page-load handler, which runs before this file's
     because that is the order the scripts sit in; sharing one key would quietly make the
     flash depend on that order. */
  function recordLanding(a, ts) {
    var url;
    try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
    if (url.pathname === location.pathname) {
      /* No page swap is coming, so no handover is needed — and nav.js takes the centring
         straight off the link's data-jump. */
      flashTerms(url.hash.slice(1), ts);
      return;
    }
    try {
      sessionStorage.setItem("searchLandAt", url.hash || "");
      sessionStorage.setItem("searchFlash", JSON.stringify({ h: url.hash || "", t: ts }));
    } catch (err) { /* private mode: the landing is simply not centred or flashed */ }
  }

  /* The block a heading owns: everything after it up to the next heading of any level —
     exactly the span the index entry was built from, so what lights up is what matched. */
  function ownSection(head) {
    var els = [head], n = head.nextElementSibling;
    while (n && !/^H[1-6]$/.test(n.tagName)) { els.push(n); n = n.nextElementSibling; }
    return els;
  }

  function flashTerms(id, ts) {
    var head = id ? document.getElementById(id) : null;
    if (!head || !ts || !ts.length) return;
    var budget = 80;                    // a section lit end to end is a stain, not a cue
    var marks = [];
    ownSection(head).forEach(function (root) {
      if (budget <= 0) return;
      var texts = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
      while ((n = walk.nextNode())) texts.push(n);
      texts.forEach(function (node) {
        if (budget <= 0 || !node.parentNode) return;
        if (node.parentNode.classList &&
            node.parentNode.classList.contains("search-flash")) return;   // never nest
        var raw = node.nodeValue, low = fold(raw);
        if (low.length !== raw.length) return;   // a fold that changed length cannot index
        var spans = [];
        ts.forEach(function (t) {
          for (var i = low.indexOf(t); i >= 0; i = low.indexOf(t, i + t.length)) {
            spans.push([i, i + t.length]);
          }
        });
        if (!spans.length) return;
        spans.sort(function (a, b) { return a[0] - b[0]; });
        var frag = document.createDocumentFragment(), at = 0;
        spans.forEach(function (sp) {
          if (sp[0] < at || budget <= 0) return;      // already inside a mark
          if (sp[0] > at) frag.appendChild(document.createTextNode(raw.slice(at, sp[0])));
          var m = document.createElement("mark");
          m.className = "search-flash";
          m.textContent = raw.slice(sp[0], sp[1]);
          frag.appendChild(m);
          marks.push(m);
          budget--;
          at = sp[1];
        });
        if (at < raw.length) frag.appendChild(document.createTextNode(raw.slice(at)));
        node.parentNode.replaceChild(frag, node);
      });
    });
    if (!marks.length) return;
    /* Put the text back exactly as it was. Under client-side routing a page stays in the
       DOM for as long as the reader is on it, so a highlight left behind would still be
       burning ten minutes later, on a page nobody is searching any more. */
    setTimeout(function () {
      marks.forEach(function (m) {
        var p = m.parentNode;
        if (!p) return;
        p.replaceChild(document.createTextNode(m.textContent), m);
        p.normalize();
      });
    }, 2200);   // just past the end of the animation, which fades to transparent
  }

  /* ONE ENGINE, TWO PRESENTATIONS: the inline field in the bar on a wide viewport, the
     full-screen palette behind the floating button on a narrow one. Both draw the same rows
     from the same ranking, so the drawing takes its container as an argument rather than
     closing over one — the alternative is two copies of the row markup that drift apart. */
  function paint(listEl, statusEl, q, res, hint) {
    var ts = terms(q);
    listEl.innerHTML = "";
    if (unavailable) {
      statusEl.textContent = "Search is unavailable.";
      listEl.innerHTML =
        '<li class="search-empty">The search index could not be loaded. ' +
        "On a local dev server, run <code>npm run build</code> once; the index is built " +
        "with the site.</li>";
      return;
    }
    if (!q.trim()) {
      statusEl.textContent = "";
      listEl.innerHTML = hint ? '<li class="search-empty">' + hint + "</li>" : "";
      return;
    }
    if (!res.length) {
      statusEl.textContent = "No matches for “" + q + "”.";
      listEl.innerHTML = '<li class="search-empty">Nothing on the wiki matches that.</li>';
      return;
    }
    statusEl.textContent = res.length + (res.length === 1 ? " result" : " results");
    res.forEach(function (e, i) {
      var li = document.createElement("li");
      li.className = "search-hit";
      li.id = listEl.id + "-hit-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.innerHTML =
        '<a data-jump="center" href="' + e.p + (e.a ? "#" + e.a : "") + '">' +
          /* The breadcrumb is marked too, not just escaped. A page's own entry has no body to
             show and a hero h1 that need not contain the query at all, so when it matched on
             its NAME there was nothing lit anywhere in the row — it read as a result that had
             arrived for no reason. The name is what matched; the name is where to show it. */
          '<span class="sh-where">' + mark(e.t, ts) + (e.c ? " › " + mark(e.c, ts) : "") + "</span>" +
          '<span class="sh-title">' + mark(e.h, ts) + "</span>" +
          (e.x ? '<span class="sh-text">' + snippet(e, ts) + "</span>" : "") +
        "</a>";
      listEl.appendChild(li);
    });
  }

  /* Scroll the LIST, never the document. scrollIntoView({block:"nearest"}) walks up every
     scrollable ancestor, so as soon as the results ran past the bottom of the window it
     scrolled the page as well — the reader pressed Down to look at result three and the
     article behind the panel moved. */
  function reveal(box, el) {
    var b = box.getBoundingClientRect(), e = el.getBoundingClientRect();
    if (e.top < b.top) box.scrollTop -= b.top - e.top;
    else if (e.bottom > b.bottom) box.scrollTop += e.bottom - b.bottom;
  }

  function highlight(listEl, inputEl, i) {
    var items = listEl.querySelectorAll(".search-hit");
    if (!items.length) return -1;
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;
    items.forEach(function (el, n) {
      var on = n === i;
      el.classList.toggle("active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
    inputEl.setAttribute("aria-activedescendant", items[i].id);
    reveal(listEl, items[i]);
    return i;
  }

  var HINT = "Try a part number, an enzyme, a protocol step — anything written on the wiki.";
  function render(q) {
    paint(list, status, q, results, HINT);
    active = q.trim() && results.length ? highlight(list, input, 0) : -1;
  }
  function setActive(i) { active = highlight(list, input, i); }

  /* The scroll lock. The page keeps its scrollbar — drawn, in place, and not moving —
     because `overflow:hidden` on <html> would remove it and shift the whole page sideways
     by its width. What is blocked is the scroll itself: wheel and touch are swallowed
     unless they land inside the results list and that list still has somewhere to go.
     Keyboard scrolling needs no handling — focus is in the text field, where Space and
     PageDown edit the caret rather than the page. */
  function blockScroll(e) {
    var l = e.target && e.target.closest && e.target.closest(".search-results");
    if (l && l.scrollHeight > l.clientHeight) return;
    e.preventDefault();
  }
  /* Attached only while the palette is open, and NOT through on()/offAll(). A non-passive
     wheel listener standing on document permanently would cost the browser its fast scroll
     path on every page — which on the home page is a whole scroll choreography. */
  function lockScroll(yes) {
    var m = yes ? "addEventListener" : "removeEventListener";
    document[m]("wheel", blockScroll, { passive: false });
    document[m]("touchmove", blockScroll, { passive: false });
  }

  /* Whichever control this viewport is actually using. offsetParent is null while the field
     is display:none, which is the CSS breakpoint's own answer to that question — no second
     copy of the media query to keep in step with the first. */
  function focusSearch() {
    if (navExpand(true)) return;
    show();
  }

  /* The sheet is anchored to the bottom of the window, which is exactly where a phone puts
     its keyboard. Android Chrome resizes the layout viewport when the keyboard opens and so
     solves this for us; iOS does not — the sheet stays where it was, under the keyboard,
     with the caret in it and nothing visible. visualViewport reports how much of the window
     is covered, and the overlay is padded by that much so the field rides above it. */
  function fitKeyboard() {
    var vv = window.visualViewport;
    if (!vv || !overlay) return;
    var covered = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
    overlay.style.setProperty("--kb", Math.round(covered) + "px");
  }
  function watchKeyboard(yes) {
    var vv = window.visualViewport;
    if (!vv) return;
    var m = yes ? "addEventListener" : "removeEventListener";
    vv[m]("resize", fitKeyboard);
    vv[m]("scroll", fitKeyboard);
    if (yes) fitKeyboard();
    else if (overlay) overlay.style.removeProperty("--kb");
  }

  var lastFocus = null;
  function show() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    overlay.classList.add("open");
    triggers.forEach(function (t) { t.setAttribute("aria-expanded", "true"); });
    document.documentElement.classList.add("search-open");
    document.documentElement.style.scrollPaddingTop = "0px";   // as above, for the palette
    lockScroll(true);
    watchKeyboard(true);
    input.value = "";
    render("");
    input.focus({ preventScroll: true });
    /* Recomputed, not just re-rendered: anything typed while the index was still in
       flight scored against an empty corpus, and nothing else would run the query again. */
    loadIndex().then(function () {
      if (!open) return;
      results = search(input.value);
      render(input.value);
    });
  }
  function hide() {
    if (!open) return;
    open = false;
    overlay.classList.remove("open");
    overlay.hidden = true;
    triggers.forEach(function (t) { t.setAttribute("aria-expanded", "false"); });
    document.documentElement.classList.remove("search-open");
    document.documentElement.style.scrollPaddingTop = "";
    lockScroll(false);
    watchKeyboard(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); } }
  }

  function initPage() {
    /* The palette belongs to the floating button alone now. Above the breakpoint the bar
       has a real field and there is nothing to open. */
    triggers = [document.getElementById("searchFab")].filter(Boolean);
    overlay = document.getElementById("searchOverlay");
    input = document.getElementById("searchInput");
    list = document.getElementById("searchResults");
    status = document.getElementById("searchStatus");
    if (!triggers.length || !overlay || !input || !list) return;

    /* The palette is rebuilt with each page, so these are fresh nodes every time and can be
       bound without a guard; offAll() has already dropped the previous page's. */
    triggers.forEach(function (t) { on(t, "click", show); });
    on(overlay, "mousedown", function (e) { if (e.target === overlay) hide(); });
    on(input, "input", function () {
      results = search(input.value);
      render(input.value);
    });
    on(input, "keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Enter") {
        var el = list.querySelector(".search-hit.active a");
        if (el) { e.preventDefault(); hide(); el.click(); }
      }
    });
    on(list, "click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      recordLanding(a, terms(input.value));
      hide();
    });

    on(document, "keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); focusSearch(); return; }
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); hide(); return; }
      /* "/" is the long-standing shortcut for search, but only when nothing is being typed
         into. */
      if (e.key === "/" && !open) {
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        focusSearch();
      }
    });
  }

  /* ---------- the inline field in the bar ---------- */
  /* The bar carries transition:persist, so this is the SAME node for the whole visit: bound
     ONCE, or every navigation would stack another listener on it. What does belong per page
     is clearing it — the field would otherwise still hold the query that brought you here,
     under a page it no longer describes. */
  var navWrap, navInput, navDrop, navList, navStatus, navRes = [], navAt = -1, navBound = false;

  /* Open the field, if this viewport has one. Returns false when it does not, which is the
     signal to fall back to the palette — and the test is getComputedStyle, so the breakpoint
     stays defined in exactly one place, the stylesheet. */
  function navExpand(on) {
    if (!navWrap || !navInput) return false;
    if (getComputedStyle(navInput).display === "none") return false;
    navWrap.classList.toggle("open", on);
    /* Switch off html{scroll-padding-top} while the field has focus. The browser keeps
       trying to lift the caret clear of that padding, and a caret inside a position:sticky
       bar can NEVER get clear of it — the bar stays where it is however far the page
       scrolls — so it tried again on every keystroke and walked the article upwards.
       Measured: typing "cnc" moved the page 174px with the padding on, 0px with it off.
       The padding is there for anchor landings, which nobody is doing while typing here. */
    document.documentElement.style.scrollPaddingTop = on ? "0px" : "";
    /* preventScroll, or the page jumps. Focusing an element makes the browser scroll to
       reveal it, and it reckons that from the element's position in the DOCUMENT — the bar
       is position:sticky, so its layout position is the very top of the page, and at the
       instant of focus the field is still 0px wide with its opening transition barely
       started. Clicking search from halfway down an article dragged the article upwards. */
    if (on) { navInput.focus({ preventScroll: true }); navInput.select(); }
    else { navInput.value = ""; navOpen(false); navInput.blur(); }
    return true;
  }

  function navOpen(on) {
    if (!navDrop) return;
    navDrop.hidden = !on;
    navInput.setAttribute("aria-expanded", on ? "true" : "false");
    if (!on) { navAt = -1; navInput.removeAttribute("aria-activedescendant"); }
  }
  function navRun() {
    if (!navInput) return;
    var q = navInput.value;
    if (!q.trim()) { navOpen(false); return; }
    navRes = search(q);
    paint(navList, navStatus, q, navRes, "");
    navOpen(true);
    navAt = navRes.length ? highlight(navList, navInput, 0) : -1;
  }
  /* Set by a cross-page hit on the way out, spent by boot() on the way in. A plain module
     variable is enough: client-side routing keeps this script and its scope alive across
     the swap — the same reason the field itself is still the same element. */
  var foldOnArrival = false;

  function navReset() {
    if (!navInput) return;
    navInput.value = "";
    navRes = [];
    navOpen(false);
    if (navWrap) navWrap.classList.remove("open");
  }
  function navInit() {
    navWrap = document.getElementById("navSearch");
    navInput = document.getElementById("navSearchInput");
    navDrop = document.getElementById("navSearchDrop");
    navList = document.getElementById("navSearchResults");
    navStatus = document.getElementById("navSearchStatus");
    if (!navInput || !navDrop || navBound) return;
    navBound = true;
    navInput.title = "Search  " +
      (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K");
    /* Through loadIndex every time: the first keystroke is usually what triggers the fetch,
       and without waiting on it that keystroke would score against an empty corpus and
       report "no matches" for a word that is on the site. */
    var btn = document.getElementById("navSearchBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        if (navWrap.classList.contains("open")) navExpand(false);   // a second click closes
        else focusSearch();
      });
    }
    /* Also on focus, so that TABBING to the field opens it. Without this a keyboard user
       lands in a control with no width, no rule and no caret. */
    navInput.addEventListener("focus", function () { navWrap.classList.add("open"); });
    navInput.addEventListener("input", function () { loadIndex().then(navRun); });
    navInput.addEventListener("focus", function () {
      if (navInput.value.trim()) loadIndex().then(navRun);
    });
    navInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); navAt = highlight(navList, navInput, navAt + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); navAt = highlight(navList, navInput, navAt - 1); }
      else if (e.key === "Enter") {
        var a = navList.querySelector(".search-hit.active a");
        if (a) { e.preventDefault(); a.click(); }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!navDrop.hidden) navOpen(false);      // first Escape drops the list
        else navExpand(false);                    // second folds the field away
      }
    });
    navList.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      /* A modified click is a request for a new tab, not a navigation here: leave the bar
         and the browser's default alone, and record nothing, because the landing the other
         tab makes is not this one. */
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      recordLanding(a, terms(navInput.value));
      /* FOLD ON THE OTHER SIDE, not on this one.
         Routing here is client-side and the bar carries transition:persist, so the field is
         the same element before and after — it could simply be folded on the way out. It
         could not: .site-nav is a named view-transition element, so for the length of the
         transition what is on screen is a STILL of it. The fold started, the still froze it
         half closed, and the next still had it shut — a flicker, not a gesture. Holding the
         navigation until the fold finished fixed the look and cost a fifth of a second on
         every cross-page hit, which is the wrong thing to spend on a search result.

         So the navigation goes now, and the fold is played once the swap is over and no
         snapshot is standing in front of it. Same-page hits have nothing in their way and
         fold here, as before. */
      var url;
      try { url = new URL(a.getAttribute("href"), location.href); } catch (err) { url = null; }
      if (url && url.pathname !== location.pathname) { foldOnArrival = true; navOpen(false); return; }
      /* Fold the whole thing away, not just the list — the bar was left holding the query
         under the answer to it. */
      navExpand(false);
    });
    /* Any click outside the field dismisses the list — including one on the bar itself, so
       that opening the Project menu does not leave results hanging underneath it. */
    document.addEventListener("click", function (e) {
      if (!navWrap.classList.contains("open")) return;
      if (e.target.closest && e.target.closest(".nav-search")) return;
      navExpand(false);
    });
  }

  function boot() {
    if (document.body && document.body.dataset.searchBooted === "1") return;
    if (document.body) document.body.dataset.searchBooted = "1";
    offAll();
    open = false;
    var o = document.getElementById("searchOverlay");
    if (o) { o.classList.remove("open"); o.hidden = true; }
    document.documentElement.classList.remove("search-open");
    lockScroll(false);
    navInit();
    if (foldOnArrival) {
      foldOnArrival = false;
      /* Two frames: astro:page-load can still land with the transition's snapshot on screen,
         and a fold that starts under it is a fold nobody sees. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!navExpand(false)) navReset();
        });
      });
    } else {
      navReset();     // the bar persists across pages; its field must not
    }
    initPage();

    /* A result on ANOTHER page: the click that carried it happened before the swap, so the
       intent travels in sessionStorage and is spent here. Two frames, so nav.js has made
       its landing and the layout has settled before text is rewritten underneath it. */
    var pending = null;
    try {
      pending = sessionStorage.getItem("searchFlash");
      if (pending) sessionStorage.removeItem("searchFlash");
    } catch (err) { return; }
    if (!pending) return;
    try {
      var d = JSON.parse(pending);
      if (!d || d.h !== (location.hash || "")) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { flashTerms(d.h.slice(1), d.t || []); });
      });
    } catch (err) { /* a malformed handover is not worth a broken page */ }
  }
  /* Not recorded: offAll() would otherwise remove the hook that calls it. */
  document.addEventListener("astro:page-load", boot);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
