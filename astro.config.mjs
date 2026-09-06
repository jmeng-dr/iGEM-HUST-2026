import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSearchIndex } from './scripts/build-search-index.mjs';

// Astro emits its own bundles as root-absolute URLs (/_astro/...). Every asset this site
// references by hand is relative, deliberately, so that one build works at a domain root,
// at a GitHub Pages project prefix and at iGEM's /hust-china/ without reconfiguration —
// and Astro's own output has to follow the same rule or the router simply 404s off the
// root. Setting `base` would fix it for exactly one deployment target and break the other
// two, so the emitted references are rewritten instead. Safe because build.format:'file'
// puts every page at the top level of the output, so "relative" means the same thing from
// all of them.
function relativeAstroAssets() {
  return {
    name: 'relative-astro-assets',
    hooks: {
      'astro:build:done': ({ dir }) => {
        // fileURLToPath, not dir.pathname: the latter is percent-encoded and keeps a
        // leading slash before the drive letter, neither of which fs understands.
        const root = fileURLToPath(dir);
        let touched = 0;
        const walk = (d) => {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) { walk(f); continue; }
            if (!/\.(html|css|js)$/.test(e.name)) continue;
            const before = fs.readFileSync(f, 'utf8');
            const after = before.split('"/_astro/').join('"_astro/').split("'/_astro/").join("'_astro/");
            if (after !== before) { fs.writeFileSync(f, after); touched++; }
          }
        };
        walk(root);
        console.log(`[relative-astro-assets] rewrote /_astro/ in ${touched} file(s)`);
        /* After the rewrite, so the ids this adds are not clobbered, and over the emitted
           HTML so what gets indexed is exactly what a reader sees. */
        buildSearchIndex(root);
      },
    },
  };
}

// The static wiki uses `Page-Name.html` URLs and relative links between pages.
// `build.format: 'file'` makes Astro emit `dist/Page-Name.html` (not
// `dist/Page-Name/index.html`), so every existing `href="Project-Description.html"`
// link — in the nav, the ring navigator, and inline cross-references — keeps working
// untouched. `compressHTML: false` keeps the generated markup readable and leaves
// <pre> whitespace exactly as authored.
//
// There is deliberately no `base` here. Every asset is referenced RELATIVELY
// (`assets/...`, not `/assets/...`), and because `format: 'file'` puts every page at the
// top level of the output, "relative" means the same thing on every page. So the build is
// portable to any prefix — a GitHub Pages project site at /repo/, iGEM's own wiki at
// /hust-china/, or a domain root — with no configuration and no rebuild. Setting `base`
// would not have achieved this on its own: Astro does not rewrite hardcoded absolute paths,
// least of all the ones inside the raw partials, which it never parses.
export default defineConfig({
  integrations: [relativeAstroAssets()],
  build: { format: 'file' },
  trailingSlash: 'never',
  compressHTML: false,
});
