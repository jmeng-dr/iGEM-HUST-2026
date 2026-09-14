import sharp from 'sharp';
import fs from 'node:fs';

/* BUILD THE FIVE DIAL PIECES FROM THE ARTIST'S EXPORTS.
 *
 * The four fans arrive on 2048 squares that agree about nothing: the wheel's centre is not the
 * middle of the picture, the pieces sit at different distances from it, and — the part no
 * amount of moving can fix — they are not all right angles. Measured off their straight radial
 * edges the included angles are 89.6, 91.8, 83.6 and 92.0 degrees. Four quarters that are not
 * quarters cannot tile a circle, and stacked as delivered they give a lumpy diamond with no
 * hole in it.
 *
 * WHY THE EDGES AND NOT THE ARC. The outline is a clean arc for part of its length and then
 * birds and leaves reaching half a radius past it, so fitting a circle to it is fitting to the
 * decoration — two runs of the same RANSAC disagreed by 5% on the radius. The radial edges
 * carry no ornament, it all lives outside the rim, and they are long and dead straight: a
 * Hough transform picks them out cleanly and their intersection is the apex exactly.
 *
 * THE CORRECTION, per piece, in this order:
 *   1. turn   — by (90 - bisector), so the fan points straight up. Rotation changes no angle,
 *               so this step is free.
 *   2. squash — scale vertically about the apex by tan(half-angle), which takes the half-angle
 *               to exactly 45 degrees and the fan to exactly a quarter. This is the only step
 *               that deforms anything: piece 3 loses about a tenth of its height, the others
 *               move by 3% or less. It is what the fans being drawn out of true costs.
 *   3. place  — one uniform scale and one translation per piece, so every apex lands on the
 *               middle of the output square and every rim on the same radius.
 *
 * The INNER arcs are left where they fall. They end up within a few per cent of each other and
 * the hub is sized to cover the largest of them; the OUTER edge is the one that has to read as
 * a circle.
 */

const SRC = 2048, OUT = 1400;
const RIM_OUT = 468;    // rim in output px: 468 of the 700 available leaves room for the longest
                        // ornament, which reaches about 1.49x the rim on piece 1

/* Apex and the direction of each radial edge, in degrees measured the usual way (x right,
   y UP), from the Hough fit and checked against a drawn overlay. Measured at 1024. */
const FIT_N = 1024;
const FANS = [
  { src: '滑块1', out: 'dial-1', ax: 511, ay: 824, right: 44.8, left: 135.2 },
  { src: '滑块2', out: 'dial-2', ax: 517, ay: 815, right: 43.5, left: 135.3 },
  { src: '滑块3', out: 'dial-3', ax: 538, ay: 893, right: 48.2, left: 131.8 },
  { src: '滑块4', out: 'dial-4', ax: 529, ay: 851, right: 44.1, left: 136.1 },
];

for (const f of FANS) {
  f.bisector = (f.right + f.left) / 2;
  f.half = (f.left - f.right) / 2;
  f.rot = 90 - f.bisector;
  f.squash = Math.tan(f.half * Math.PI / 180);
  console.log(f.src, 'included', (f.half * 2).toFixed(1) + 'deg',
    ' bisector', f.bisector.toFixed(1) + 'deg',
    ' -> turn', f.rot.toFixed(2) + 'deg  squash', f.squash.toFixed(4));
}

const MID = OUT;              // the source is downscaled to this before anything else
const BED = MID * 2;          // on a bed big enough that a turn cannot throw anything off

async function corrected(f) {
  const scaled = await sharp('../wiki/home-轮盘-' + f.src + '.png').resize(MID, MID).png().toBuffer();
  const ax = f.ax / FIT_N * MID, ay = f.ay / FIT_N * MID;
  let img = await sharp({ create: { width: BED, height: BED, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.round(BED / 2 - ax), top: Math.round(BED / 2 - ay) }])
    .png().toBuffer();

  if (Math.abs(f.rot) > 0.01) {
    const turned = await sharp(img).rotate(-f.rot, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    const m = await sharp(turned).metadata();
    img = await sharp(turned).extract({
      left: Math.round((m.width - BED) / 2), top: Math.round((m.height - BED) / 2),
      width: BED, height: BED,
    }).png().toBuffer();
  }
  if (Math.abs(f.squash - 1) > 0.001) {
    /* Only the RATIO of the two axes matters here — step 3 rescales every piece uniformly
       afterwards — so a fan that needs stretching vertically is squeezed horizontally instead.
       Same shape, and the bed never has to grow. The apex is the middle of the bed either way,
       so it does not move. */
    if (f.squash < 1) {
      const h = Math.round(BED * f.squash);
      const sq = await sharp(img).resize(BED, h, { fit: 'fill' }).png().toBuffer();
      img = await sharp({ create: { width: BED, height: BED, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: sq, left: 0, top: Math.round((BED - h) / 2) }]).png().toBuffer();
    } else {
      const w = Math.round(BED / f.squash);
      const sq = await sharp(img).resize(w, BED, { fit: 'fill' }).png().toBuffer();
      img = await sharp({ create: { width: BED, height: BED, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: sq, left: Math.round((BED - w) / 2), top: 0 }]).png().toBuffer();
    }
  }
  return img;
}

/* With the fan corrected, its wedge is known to be 45 to 135 degrees about the middle of the
   bed, so the rim is simply the last radius at which that wedge is still solid. Ornament past
   it never fills the wedge, which is what makes this immune to the decoration. */
async function arcs(buf) {
  const n = 1024;
  const { data, info } = await sharp(buf).resize(n, n, { fit: 'fill' }).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const C = info.channels, c = n / 2;
  let rim = 0, inner = 0;
  for (let r = 6; r < c; r += 0.5) {
    let hit = 0, tot = 0;
    for (let deg = 50; deg <= 130; deg += 1) {
      const t = deg * Math.PI / 180;
      const x = Math.round(c + Math.cos(t) * r), y = Math.round(c - Math.sin(t) * r);
      if (x < 0 || y < 0 || x >= n || y >= n) continue;
      tot++; if (data[(y * n + x) * C + 3] >= 110) hit++;
    }
    if (tot && hit / tot > 0.85) { if (!inner) inner = r; rim = r; }
  }
  return { rim: rim / n * BED, inner: inner / n * BED };
}

const made = [];
for (const f of FANS) {
  const buf = await corrected(f);
  const a = await arcs(buf);
  made.push({ f, buf, ...a });
  console.log(f.src, ' after correction: inner', a.inner.toFixed(0), ' rim', a.rim.toFixed(0));
}
console.log('rim spread', (Math.max(...made.map(m => m.rim)) / Math.min(...made.map(m => m.rim))).toFixed(3) + 'x');

let hubR = 0;
for (const m of made) {
  const k = RIM_OUT / m.rim;
  const w = Math.round(BED * k);
  hubR = Math.max(hubR, m.inner * k);
  const scaledBed = await sharp(m.buf).resize(w, w).png().toBuffer();
  /* The scaled bed is wider than the output square (it is twice the working size), so the
     output is CUT from the middle of it rather than pasted onto a blank one — the apex is the
     middle of the bed, so the middle is exactly what we want. */
  const off = Math.round((w - OUT) / 2);
  const png = await sharp(scaledBed)
    .extract({ left: off, top: off, width: OUT, height: OUT }).png().toBuffer();
  fs.writeFileSync('public/assets/img/' + m.f.out + '.webp', await sharp(png).webp({ quality: 82, effort: 6 }).toBuffer());
  fs.writeFileSync('public/assets/img/' + m.f.out + '.avif', await sharp(png).avif({ quality: 50, effort: 6 }).toBuffer());
  console.log(m.f.out, 'written  rim ->', RIM_OUT, ' inner ->', (m.inner * k).toFixed(0));
}

/* The hub covers the hole, and then some. Sized to the LARGEST of the four inner arcs and then
   a fifth again: the four inner arcs do not agree — 210 to 232 px once the fans have been
   squashed to true quarters — so a hub that only just fits the biggest of them still leaves a
   gap against the other three. Overlapping is free, because the hub is drawn on top; falling
   short is not, because a seam between the centre and the ring is the first thing the eye finds
   on a medallion. */
const HUB_OVERLAP = 1.2;
{
  const want = (hubR + 8) * HUB_OVERLAP;
  const scale = want / 737;              // 737 is the hub's own outer radius in its 2048 square
  const w = Math.round(SRC * scale);
  const img = await sharp('../wiki/home-轮盘-中心轴.png').resize(w, w).png().toBuffer();
  const off = Math.round(OUT / 2 - w / 2);
  const png = await sharp({ create: { width: OUT, height: OUT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, left: off, top: off }]).png().toBuffer();
  fs.writeFileSync('public/assets/img/dial-axis.webp', await sharp(png).webp({ quality: 82, effort: 6 }).toBuffer());
  fs.writeFileSync('public/assets/img/dial-axis.avif', await sharp(png).avif({ quality: 50, effort: 6 }).toBuffer());
  console.log('dial-axis written  radius', want.toFixed(0));
}
