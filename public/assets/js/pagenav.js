/* "On this page" rail — a sticky in-page table of contents for the long interior
   pages. Built from the DOM rather than a hand-maintained list, so it can never
   drift out of sync with the headings it points at.

   Two deliberate constraints:

   1. It lives in the page's outer MARGIN, position:fixed, and never occupies a
      grid column. The content column keeps the full width it has; the rail simply
      does not exist below a viewport wide enough to hold it in the gutter
      (see .page-sidenav in style.css). Squeezing the prose to make room would undo
      the column width the page is deliberately set to.

   2. Section ids come from the enclosing <section id="..."> where one exists, so
      the rail points at exactly the same anchors the top-nav dropdowns already use
      (#modelling, #safety, #parts...). Only headings whose section has no id get a
      generated one.
*/
(function () {
  document.addEventListener("DOMContentLoaded", function () {
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

    var seen = {};
    var entries = headings.map(function (h) {
      var section = h.closest("section");
      var id = (section && section.id) || h.id;
      if (!id) {
        id = slug(h.textContent);
        while (seen[id]) id += "-x";
        (section || h).id = id;
      }
      seen[id] = true;
      return { id: id, el: h, label: h.textContent.trim() };
    });

    var nav = document.createElement("nav");
    nav.className = "page-sidenav";
    nav.setAttribute("aria-label", "On this page");
    var html = '<p class="psn-title">On this page</p><ul>';
    entries.forEach(function (e) {
      html += '<li><a href="#' + e.id + '">' + e.label.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</a></li>";
    });
    nav.innerHTML = html + "</ul>";
    body.appendChild(nav);

    var links = Array.prototype.slice.call(nav.querySelectorAll("a"));
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    links.forEach(function (a, i) {
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        var target = document.getElementById(entries[i].id) || entries[i].el;
        target.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", "#" + entries[i].id);
      });
    });

    /* Active item: the last heading that has passed the top of the viewport.
       Simpler and steadier than an IntersectionObserver here, because the headings
       are far apart and several can be off-screen at once. */
    var ticking = false;
    function update() {
      ticking = false;
      var line = 140;                        // just below the sticky nav
      var current = 0;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].el.getBoundingClientRect().top <= line) current = i;
        else break;
      }
      /* At the very bottom, select the last item — the final section is often too
         short to ever cross the line on its own. */
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
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  });
})();
