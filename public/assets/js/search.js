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

  function scoreOne(entry, t) {
    var h = entry._h, c = entry._c, x = entry._x;
    var s = 0;
    var i = h.indexOf(t);
    if (i >= 0) {
      s += 40;
      if (i === 0) s += 30;                                   // the heading starts with it
      else if (/[\s(\-–—/]/.test(h[i - 1])) s += 15;          // a whole word within it
    }
    /* The page's NAME, and only on the page's own entry. A wiki's pages are known by their
       names — "project", "team", "wet lab" — and not one of those words need appear in the
       h1 the page actually opens with: Project opens "From waste cotton to wearable
       structural colour", Team opens "Who built what". Without this, searching the name of
       a page did not find the page. Scored on section entries too it would flood — every
       heading on Project would match "project". */
    if (entry._t && entry._t.indexOf(t) >= 0) s += 45;
    if (c.indexOf(t) >= 0) s += 12;
    var j = x.indexOf(t);
    if (j >= 0) {
      s += 6;
      if (j === 0 || /[\s(\-–—/]/.test(x[j - 1])) s += 4;
    }
    return s;
  }

  function search(q) {
    var ts = terms(q);
    if (!ts.length || !index) return [];
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i], total = 0, all = true;
      var namesPage = e.d === 1 && !!e._t;
      for (var k = 0; k < ts.length; k++) {
        var s = scoreOne(e, ts[k]);
        if (!s) { all = false; break; }
        if (namesPage && e._t.indexOf(ts[k]) < 0) namesPage = false;
        total += s;
      }
      if (!all) continue;
      /* When the query IS the name of a page, that page wins outright. A flat bonus was not
         enough: "wet lab" put the Team page's "Wet Lab" roster section above the Wet Lab
         page, and "project" put a redirect stub reading "This content now lives on Project"
         above Project itself, because a heading match with a word-start bonus outscores
         anything a page entry could carry. Asking for a page by name and being given a
         signpost to it is a bad answer. */
      if (e.d === 1) total += namesPage ? 60 : 8;
      hits.push({ e: e, s: total });
    }
    hits.sort(function (a, b) { return b.s - a.s; });
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

  /* A window of the body text around the first term, so the snippet shows the match rather
     than always the first sentence of the section. */
  function snippet(entry, ts) {
    var x = entry.x || "";
    if (!x) return "";
    var at = -1;
    for (var i = 0; i < ts.length && at < 0; i++) at = x.toLowerCase().indexOf(ts[i]);
    if (at < 0) at = 0;
    var from = Math.max(0, at - 60);
    var cut = x.slice(from, from + 190);
    if (from > 0) cut = "…" + cut.replace(/^\S*\s/, "");
    if (from + 190 < x.length) cut = cut.replace(/\s\S*$/, "") + "…";
    return mark(cut, ts);
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
    }, 1300);   // just past the end of the animation, which fades to transparent
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
          '<span class="sh-where">' + esc(e.t) + (e.c ? " › " + esc(e.c) : "") + "</span>" +
          '<span class="sh-title">' + mark(e.h, ts) + "</span>" +
          (e.x ? '<span class="sh-text">' + snippet(e, ts) + "</span>" : "") +
        "</a>";
      listEl.appendChild(li);
    });
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
    items[i].scrollIntoView({ block: "nearest" });
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

  var lastFocus = null;
  function show() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    overlay.classList.add("open");
    triggers.forEach(function (t) { t.setAttribute("aria-expanded", "true"); });
    document.documentElement.classList.add("search-open");
    lockScroll(true);
    input.value = "";
    render("");
    input.focus();
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
    lockScroll(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
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
    if (on) { navInput.focus(); navInput.select(); }
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
      recordLanding(a, terms(navInput.value));
      /* Fold the whole thing away, not just the list. On a cross-page hit navReset() would
         do it at the other end, but a hit on THIS page never swaps, so nothing else would —
         and the bar was left holding the query under the answer to it. */
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
    navReset();       // the bar persists across pages; its field must not
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
