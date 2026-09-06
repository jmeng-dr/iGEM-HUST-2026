/* "On this page" rail — a sticky in-page table of contents for the long interior
   pages. Built from the DOM rather than a hand-maintained list, so it can never
   drift out of sync with the headings it points at.

   Two deliberate constraints:

   1. It lives in the page's outer MARGIN and never occupies a grid column. The
      content column keeps the full width it has; the rail simply does not exist
      below a viewport wide enough to hold it in the gutter (see .page-sidenav in
      style.css). Squeezing the prose to make room would undo the column width the
      page is deliberately set to.

      It is wrapped in .page-sidenav-rail, which is absolutely positioned inside
      .page-body and stretched to its full height; the rail itself is sticky within
      that. The rail was previously position:fixed, anchored to the VIEWPORT, which
      gave it no relationship to the document at all: it hung at a constant 150px
      whatever was behind it, so its left rule cut straight across the boundary
      between the hero band and the body band and it read as a detached floating
      panel. Bounded by .page-body, it can no longer escape above the first heading
      or below the last one.

   2. Section ids come from the enclosing <section id="..."> where one exists, so
      the rail points at exactly the same anchors the top-nav dropdowns already use
      (#modelling, #safety, #parts...). Only headings whose section has no id get a
      generated one.
*/
(function () {
  /* Client-side routing swaps the document, so this runs again on every navigation. The
     rail itself is rebuilt each time — it belongs to the page it indexes — but its window
     listeners must not be, or a new pair would stack up per navigation and keep pointing at
     rails that no longer exist. They are attached once and read the module state below. */
  var entries = [], links = [], ticking = false;

  function update() {
    ticking = false;
    if (!links.length) return;
    var line = 140;                          // just below the sticky nav
    var current = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].el.getBoundingClientRect().top <= line) current = i;
      else break;
    }
    /* At the very bottom, select the last item — the final section is often too short to
       ever cross the line on its own. */
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = entries.length - 1;
    }
    links.forEach(function (a, i) {
      a.classList.toggle("active", i === current);
      if (i === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  function build() {
    /* Both DOMContentLoaded and astro:page-load fire on the first load. The flag lives on
       <body>, which the router replaces on every swap, so it clears itself per page. */
    if (document.body) {
      if (document.body.dataset.railBuilt === "1") return;
      document.body.dataset.railBuilt = "1";
    }
    entries = [];
    links = [];
    var stale = document.querySelector(".page-sidenav-rail");
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);

    var body = document.querySelector(".page-body");
    if (!body) return;                       // home page, redirect stubs

    var headings = Array.prototype.slice.call(body.querySelectorAll("h2"));
    if (headings.length < 3) return;          // not enough structure to be worth a rail

    function slug(text) {
      return text.trim().toLowerCase()
        .replace(/[^\w一-龥]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "section";
    }

    /* Label source #1: the top-nav dropdowns already name these exact anchors
       (#modelling -> "Model", #parts -> "Part Collection", #safety -> "Safety").
       Reusing those keeps one vocabulary for one destination and means the rail can
       never drift from the menu. */
    var here = (location.pathname.split("/").pop() || "index.html");
    var navLabels = {};
    document.querySelectorAll(".site-nav .nav-drop-item").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var parts = href.split("#");
      /* Only borrow the label when the menu entry points at THIS page. Several pages
         reuse the same fragment — Wet Lab has #validation ("Validation checkpoints")
         and so does Project ("Results") — and keying on the fragment alone made the
         rail label Wet Lab's section "Results". */
      var file = parts[0].split("/").pop();
      if (parts[1] && (file === here || file === "")) {
        var title = a.querySelector(".ndi-title");
        if (title) navLabels[parts[1]] = title.textContent.trim();
      }
    });

    /* Label source #2: the heading itself, trimmed to its keyword. Full headings
       ("Results: model vs experiment cross-checks") are far too long for a 210px
       rail. Drop the subtitle after a colon or dash, and the clause after a comma —
       but NOT for "Module 1: Cellulose recovery", where the tail is the whole
       point. */
    function shorten(text) {
      var t = text.trim();
      /* "Module 1: Cellulose recovery" -> "1 · Cellulose recovery". Four consecutive
         entries all starting "Module" repeat a word that carries no distinguishing
         information in a rail; the number alone keeps the ordering and the sequence
         is obvious from the list itself. */
      var numbered = t.match(/^(?:module|part|step)\s*(\d+)\s*[:—–]\s*(.+)$/i);
      if (numbered) return numbered[1] + " · " + numbered[2];
      if (!/^(module|part|step|strategy|route)\s*\d/i.test(t)) {
        t = t.split(/\s*[:—–]\s+/)[0];
      }
      var head = t.split(/,\s+/)[0];
      if (head.length >= 8) t = head;
      head = t.split(/\s+&\s+/)[0];
      if (head.length >= 8) t = head;
      return t;
    }

    /* Badges live inside the headings ("Wet Lab <span class=credit-tag>11 members").
       Strip them before reading the text. */
    function headingText(h) {
      var c = h.cloneNode(true);
      c.querySelectorAll(".credit-tag, .req-badge, .tag-new, .tag-rev").forEach(function (n) { n.remove(); });
      return c.textContent.replace(/\s+/g, " ").trim();
    }

    var seen = {};
    entries = headings.map(function (h) {
      var section = h.closest("section");
      var id = (section && section.id) || h.id;
      if (!id) {
        id = slug(h.textContent);
        while (seen[id]) id += "-x";
        (section || h).id = id;
      }
      seen[id] = true;
      return { id: id, el: h, label: navLabels[id] || shorten(headingText(h)) };
    });

    var nav = document.createElement("nav");
    nav.className = "page-sidenav";
    nav.setAttribute("aria-label", "On this page");
    var html = '<p class="psn-title">On this page</p><ul>';
    entries.forEach(function (e) {
      html += '<li><a href="#' + e.id + '">' + e.label.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</a></li>";
    });
    nav.innerHTML = html + "</ul>";
    var rail = document.createElement("div");
    rail.className = "page-sidenav-rail";
    rail.appendChild(nav);
    body.appendChild(rail);

    links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    links.forEach(function (a, i) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var target = document.getElementById(entries[i].id) || entries[i].el;
        target.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", "#" + entries[i].id);
      });
    });

    update();
  }

  /* astro:page-load covers the first load as well as every navigation; the readyState check
     is the fallback for a build without <ClientRouter />. */
  document.addEventListener("astro:page-load", build);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
