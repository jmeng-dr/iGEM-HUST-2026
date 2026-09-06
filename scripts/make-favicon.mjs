/* Regenerate the browser-tab icon from the team logo.
 *
 *   node scripts/make-favicon.mjs
 *
 * The artwork as drawn, on nothing. An earlier version sat the logo on a solid teal roundel,
 * on the reasoning that a small mark needs a ground to hold it together at 16px; in a tab
 * strip that ground reads as a dark green disc that is not part of the identity, and the
 * browser already supplies a ground of its own.
 *
 * Trimmed to its own ink and then padded to a square, so no output size distorts it and the
 * mark is centred rather than sitting wherever the source canvas left it.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', '..', 'New Site', 'image', 'logo2.0.png');
const OUT = path.join(here, '..', 'public', 'assets', 'img');
const SIZES = [16, 32, 48, 180, 512];

const t = await sharp(SRC).trim().ensureAlpha().png().toBuffer({ resolveWithObject: true });
const side = Math.max(t.info.width, t.info.height);
const square = await sharp(t.data)
  .extend({
    top: Math.floor((side - t.info.height) / 2), bottom: Math.ceil((side - t.info.height) / 2),
    left: Math.floor((side - t.info.width) / 2), right: Math.ceil((side - t.info.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png().toBuffer();

console.log(`logo trimmed to ${t.info.width}x${t.info.height}, squared to ${side}x${side}`);
for (const s of SIZES) {
  await sharp(square)
    .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, `favicon-${s}.png`));
  console.log(`  favicon-${s}.png`);
}
