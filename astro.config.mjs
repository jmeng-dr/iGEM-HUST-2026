import { defineConfig } from 'astro/config';

// The static wiki uses `Page-Name.html` URLs and relative links between pages.
// `build.format: 'file'` makes Astro emit `dist/Page-Name.html` (not
// `dist/Page-Name/index.html`), so every existing `href="Project-Description.html"`
// link — in the nav, the ring navigator, and inline cross-references — keeps working
// untouched. `compressHTML: false` keeps the generated markup readable and leaves
// <pre> whitespace exactly as authored.
export default defineConfig({
  build: { format: 'file' },
  trailingSlash: 'never',
  compressHTML: false,
});
