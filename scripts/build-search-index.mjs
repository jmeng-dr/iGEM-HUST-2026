/* Build-time search index, and the heading ids it needs.
 *
 * Run from astro.config.mjs's astro:build:done hook, over the emitted HTML rather than the
 * source partials — so what is indexed is exactly what a reader sees, including anything a
 * page assembles at build time (the Attributions roster, for one).
 *
 * It does two things in ONE pass, deliberately:
 *
 *   1. Gives every h2/h3/h4 that lacks one a stable id, using the same slug rule pagenav.js
 *      uses at runtime. Most subsection headings have no id in the source — pagenav invents
 *      them on the fly for its rail — and an index cannot link to an id that does not exist
 *      until a script has run. Writing them into the HTML makes the anchors real before any
 *      JS, and pagenav then finds them instead of inventing its own.
 *
 *   2. Emits one index entry per heading: the page, the anchor, the heading, its depth, the
 *      breadcrumb of headings above it, and the prose that follows it up to the next
 *      heading. Splitting by heading is what lets a result say WHERE in a long page the
 *      match is, which on pages of 25-30k characters is most of the value.
 *
 * Regex over our own generated markup rather than a parser: the headings are plain, and a
 * dependency for this would be a dependency in the deploy.
 */
import fs from 'node:fs';
import path from 'node:path';

/* Must stay in step with slug() in public/assets/js/pagenav.js. */
function slug(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\w一-龥]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'section'
  );
}

/* Badges live inside headings — "Module 4: Reflectin layer <span class=tag-new>innovation
 * layer</span>", "Human Practices <span class=credit-tag>7 members</span>" — and folding
 * them in makes a result read as a longer title than the page actually has. Dropped before
 * the tags are stripped, the same way pagenav.js drops them for its rail. */
const BADGES =
  /<span[^>]*class="[^"]*\b(?:credit-tag|tag-new|tag-rev|req-badge|status|pending)\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi;

const strip = (html) =>
  html
    .replace(BADGES, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

export function buildSearchIndex(root) {
  const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  const entries = [];

  for (const file of pages) {
    const full = path.join(root, file);
    let html = fs.readFileSync(full, 'utf8');

    /* Only the readable part of the page: the hero for its h1, and the body. The nav and
       footer repeat on every page and would match everything. */
    const bodyStart = html.indexOf('class="page-body');
    const scope = bodyStart === -1 ? html : html.slice(bodyStart);

    const title =
      (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || file)
        .replace(/\s*\|\s*iGEM Team Wiki\s*$/i, '')
        .trim();
    const heroH1 = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');

    /* Pass 1: make sure every heading in the readable scope has an id. */
    const used = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    let patched = scope;
    patched = patched.replace(
      /<h([234])([^>]*)>([\s\S]*?)<\/h\1>/g,
      (whole, depth, attrs, inner) => {
        if (/\sid="/.test(attrs)) return whole;
        let id = slug(strip(inner));
        let n = 2;
        while (used.has(id)) id = `${slug(strip(inner))}-${n++}`;
        used.add(id);
        return `<h${depth}${attrs} id="${id}">${inner}</h${depth}>`;
      },
    );
    if (patched !== scope) {
      html = html.slice(0, bodyStart === -1 ? 0 : bodyStart) + patched;
      fs.writeFileSync(full, html);
    }

    /* Pass 2: split the scope at headings and index each run. */
    const marks = [...patched.matchAll(/<h([234])([^>]*)>([\s\S]*?)<\/h\1>/g)];
    const trail = [];
    marks.forEach((m, i) => {
      const depth = Number(m[1]);
      const id = m[2].match(/\sid="([^"]+)"/)?.[1];
      const heading = strip(m[3]);
      if (!id || !heading) return;

      trail.length = Math.max(0, depth - 2);
      trail[depth - 2] = heading;

      const from = m.index + m[0].length;
      const to = i + 1 < marks.length ? marks[i + 1].index : patched.length;
      entries.push({
        p: file,
        a: id,
        h: heading,
        d: depth,
        c: trail.slice(0, depth - 2).filter(Boolean).join(' › '),
        t: title,
        x: strip(patched.slice(from, to)).slice(0, 1200),
      });
    });

    /* The page itself, so a search for its name finds it even with no heading match. */
    entries.push({ p: file, a: '', h: heroH1 || title, d: 1, c: '', t: title, x: '' });
  }

  const out = path.join(root, 'assets', 'search-index.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(entries));
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`[search-index] ${entries.length} entries from ${pages.length} pages, ${kb} KB`);
}
