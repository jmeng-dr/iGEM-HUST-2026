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

  var index = null, loading = null;
  var open = false, results = [], active = -1;
  var fab, overlay, input, list, status;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch("assets/search-index.json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { index = prepare(data); return index; })
      .catch(function () { index = []; return index; });
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
      for (var k = 0; k < ts.length; k++) {
        var s = scoreOne(e, ts[k]);
        if (!s) { all = false; break; }
        total += s;
      }
      if (!all) continue;
      /* A page's own entry outranks its subsections when the query names the page. */
      if (e.d === 1) total += 8;
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

  function render(q) {
    var ts = terms(q);
    list.innerHTML = "";
    active = -1;
    if (!q.trim()) {
      status.textContent = "";
      list.innerHTML =
        '<li class="search-empty">Try a part number, an enzyme, a protocol step — ' +
        "anything written on the wiki.</li>";
      return;
    }
    if (!results.length) {
      status.textContent = "No matches for “" + q + "”.";
      list.innerHTML = '<li class="search-empty">Nothing on the wiki matches that.</li>';
      return;
    }
    status.textContent = results.length + (results.length === 1 ? " result" : " results");
    results.forEach(function (e, i) {
      var li = document.createElement("li");
      li.className = "search-hit";
      li.id = "search-hit-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.innerHTML =
        '<a href="' + e.p + (e.a ? "#" + e.a : "") + '">' +
          '<span class="sh-where">' + esc(e.t) + (e.c ? " › " + esc(e.c) : "") + "</span>" +
          '<span class="sh-title">' + mark(e.h, ts) + "</span>" +
          (e.x ? '<span class="sh-text">' + snippet(e, ts) + "</span>" : "") +
        "</a>";
      list.appendChild(li);
    });
    setActive(0);
  }

  function setActive(i) {
    var items = list.querySelectorAll(".search-hit");
    if (!items.length) return;
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;
    items.forEach(function (el, n) {
      var on = n === i;
      el.classList.toggle("active", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
    });
    active = i;
    input.setAttribute("aria-activedescendant", items[i].id);
    items[i].scrollIntoView({ block: "nearest" });
  }

  var lastFocus = null;
  function show() {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    overlay.hidden = false;
    overlay.classList.add("open");
    fab.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("search-open");
    input.value = "";
    render("");
    input.focus();
    loadIndex().then(function () { if (open) render(input.value); });
  }
  function hide() {
    if (!open) return;
    open = false;
    overlay.classList.remove("open");
    overlay.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("search-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initPage() {
    fab = document.getElementById("searchFab");
    overlay = document.getElementById("searchOverlay");
    input = document.getElementById("searchInput");
    list = document.getElementById("searchResults");
    status = document.getElementById("searchStatus");
    if (!fab || !overlay || !input || !list) return;
    /* The palette is rebuilt with each page, so these are fresh nodes every time and can be
       bound without a guard; offAll() has already dropped the previous page's. */
    on(fab, "click", show);
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
    on(list, "click", function (e) { if (e.target.closest("a")) hide(); });
    on(document, "keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); show(); return; }
      if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); hide(); return; }
      /* "/" is the long-standing shortcut for search, but only when nothing is being typed
         into. */
      if (e.key === "/" && !open) {
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        show();
      }
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
    initPage();
  }
  /* Not recorded: offAll() would otherwise remove the hook that calls it. */
  document.addEventListener("astro:page-load", boot);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
