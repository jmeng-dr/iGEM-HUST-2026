import { defineConfig } from 'astro/config';

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
  build: { format: 'file' },
  trailingSlash: 'never',
  compressHTML: false,
});
