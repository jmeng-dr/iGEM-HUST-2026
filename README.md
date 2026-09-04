# Diǎn Cuì wiki — Astro version

A structural conversion of the hand-written static wiki (the `.html` files one level
up in `../`) to [Astro](https://astro.build). **The rendered pages are meant to be
pixel-identical to the originals** — same CSS, same JS, same markup. Only the
*authoring* structure changed: the nav bar, footer and ring navigator now live in one
file each instead of being copy-pasted into every page.

Nothing in `../` was modified. This folder is entirely additive and can be deleted
without affecting the original site.

---

## Running it

Requires **Node.js ≥ 18.20.8** (20.3+ or 22+ recommended). Node is not currently
installed on this machine — install it from <https://nodejs.org> or
`winget install OpenJS.NodeJS.LTS`, then:

```bash
cd astro
npm install
npm run dev        # http://localhost:4321  — live reload, for editing
```

To check fidelity against the originals, build and serve the real output:

```bash
npm run build      # -> dist/  (one Page-Name.html per page, same URLs as before)
npm run preview    # http://localhost:4321
```

Open the same page from `dist/` and from `../` side by side and compare.

## How it maps to the old site

| Old | New |
| --- | --- |
| `../index.html` | `src/pages/index.astro` + `src/partials/index.body.html` |
| `../Project-Description.html` | `src/pages/Project-Description.astro` + `src/partials/Project-Description.body.html` |
| `../Wet-Lab-Experiments.html` | `src/pages/Wet-Lab-Experiments.astro` + `…body.html` |
| `../Human-Practices.html` | `src/pages/Human-Practices.astro` + `…body.html` |
| `../Attributions.html` | `src/pages/Attributions.astro` + `…body.html` + `…end.html` |
| `../AI-Computational-Methods.html` | `src/pages/AI-Computational-Methods.astro` + `…body.html` |
| `../AI-Ethics-Safety.html` | `src/pages/AI-Ethics-Safety.astro` + `…body.html` |
| `<header class="site-nav">` (×7 copies) | `src/components/SiteNav.astro` |
| `<footer class="site-footer">` (×7 copies) | `src/components/SiteFooter.astro` |
| ring navigator markup (×7 copies) | `src/components/RingNav.astro` |
| `<head>` (×7 copies) | `src/layouts/BaseLayout.astro` |
| `assets/css/*`, `assets/js/*` | `public/assets/…` (copied verbatim, served at the same paths) |

### `src/partials/*.html`

Raw HTML **sliced directly out of the original files** by
`scripts/slice.py` — never retyped:

- `*.body.html` — everything between `</header>` and `<footer class="site-footer">`
- `*.head.html` — the per-page bits of `<head>` (home.css link; the page-scoped
  `<style>` blocks on Project / Wet Lab / Attributions; the `<meta refresh>` on the
  two AI stubs)
- `Attributions.end.html` — the placeholder-card `<script>` that ran after `nav.js`
- `_nav.html`, `_ringnav.html` — the shared blocks, cut once

Each page imports its partial with Vite's `?raw` suffix and injects it with
`set:html`, so Astro never parses, scopes, or reformats the original content
(literal `{ }` in code samples, `<pre>` whitespace, and HTML entities all survive).

## What is deliberately identical

- All four asset files are byte-for-byte copies, served at `/assets/css/...` and
  `/assets/js/...` exactly as before.
- Page URLs stay `Project-Description.html` etc. (`build.format: 'file'`), so every
  existing relative link keeps working with no rewriting.
- End-of-body script order is preserved: inline year script → `nav.js` →
  (`home.js` on the home page / card script on Attributions).
- The home page keeps `<body class="home">`, the fixed dark nav variant, and the
  `#cursor-orb` / `#bg-wash` divs ahead of the header.

## Known caveats

- **Non-ASCII path.** This project sits under `E:\🐰\wiki\`. If `npm install` or the
  dev server misbehaves, the emoji in the path is the likely cause — move the
  `astro/` folder somewhere ASCII-only (or make a junction) and it will work.
- **Fonts** still load from Google Fonts, exactly as the original does. If this site
  is ever deployed to iGEM infrastructure, the fonts must be self-hosted (separate
  task, no visual change).
- `npm run dev` serves pages at extension-less URLs (`/Project-Description`); the
  built output under `npm run preview` serves them at `/Project-Description.html`.
  Both render the same page. Use `preview` for the fidelity comparison.
