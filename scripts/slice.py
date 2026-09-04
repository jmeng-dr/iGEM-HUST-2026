"""Slice the static Diǎn Cuì wiki into Astro partials WITHOUT retyping any content.

For each page we cut, verbatim:
  - the page <title>, optional <meta description>, <body> class
  - "head extra"  = <meta refresh> (AI pages) + anything after the style.css <link>
                    (index -> home.css link; Project/WetLab/Attributions -> <style> block)
  - "body"        = everything between </header> and <footer class="site-footer">
  - "body end"    = anything after the nav.js <script> and before </body> (Attributions card gen)
Shared blocks (nav inner, ring-nav) are cut once from Human-Practices.html.
"""
import re, pathlib, json

SRC = pathlib.Path("e:/🐰/wiki")
OUT = SRC / "astro" / "src"
PART = OUT / "partials"
PART.mkdir(parents=True, exist_ok=True)

PAGES = ["index", "Project-Description", "Wet-Lab-Experiments", "Human-Practices",
         "Attributions", "AI-Computational-Methods", "AI-Ethics-Safety"]

STYLE_ANCHOR = '<link rel="stylesheet" href="assets/css/style.css">'
NAVTAG = '<script src="assets/js/nav.js"></script>'

meta = {}
for name in PAGES:
    html = (SRC / f"{name}.html").read_text(encoding="utf-8")
    head = html[html.index("<head>") + 6: html.index("</head>")]

    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    m = re.search(r'<meta name="description" content="(.*?)">', html, re.S)
    description = m.group(1) if m else None
    bodyclass = re.search(r"<body([^>]*)>", html).group(1).strip()

    # ---- head extra -------------------------------------------------------
    extra = ""
    mr = re.search(r'<meta http-equiv="refresh"[^>]*>', html)
    if mr:
        extra += mr.group(0) + "\n"
    tail = head.split(STYLE_ANCHOR, 1)[1] if STYLE_ANCHOR in head else ""
    tail = tail.replace('href="assets/css/home.css"', 'href="/assets/css/home.css"').strip()
    extra = (extra + tail).strip()
    (PART / f"{name}.head.html").write_text(extra + ("\n" if extra else ""), encoding="utf-8")

    # ---- body ----------------------------------------------------------
    s = html.index("</header>") + len("</header>")
    e = html.index('<footer class="site-footer">')
    body = html[s:e].strip("\n")
    (PART / f"{name}.body.html").write_text(body + "\n", encoding="utf-8")

    # ---- body end (after nav.js, before </body>) ------------------------
    after = html.split(NAVTAG, 1)[1]
    after = after[:after.index("</body>")]
    after = after.replace('<script src="assets/js/home.js"></script>', "").strip()
    if after:
        (PART / f"{name}.end.html").write_text(after + "\n", encoding="utf-8")

    safety = "#safety" if '<a href="#safety">AI' in html else "Wet-Lab-Experiments.html#safety"
    meta[name] = dict(title=title, description=description, bodyclass=bodyclass,
                      safety=safety, head_extra_len=len(extra), body_len=len(body),
                      body_end=bool(after))

# ---- shared blocks, cut once from Human-Practices.html -------------------
hp = (SRC / "Human-Practices.html").read_text(encoding="utf-8")
nav_open = '<header class="site-nav">'
nav_inner = hp[hp.index(nav_open) + len(nav_open): hp.index("</header>")].strip("\n")
(PART / "_nav.html").write_text(nav_inner + "\n", encoding="utf-8")

rn_start = hp.index('<button class="ring-nav-trigger"')
marker = "</div>\n</div>\n\n<script>"
rn_end = hp.index(marker) + len("</div>\n</div>")
ring = hp[rn_start:rn_end].strip()
(PART / "_ringnav.html").write_text(ring + "\n", encoding="utf-8")

meta["_shared"] = dict(nav_inner_len=len(nav_inner), ringnav_len=len(ring),
                       nav_starts=nav_inner.lstrip()[:40], ring_ends=ring[-40:])
print(json.dumps(meta, ensure_ascii=False, indent=2))
