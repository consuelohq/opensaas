// Generates the dithered hero atmosphere assets (clouds).
// Run once, commit the PNG outputs: bun packages/consuelo-website/scripts/generate-dither-clouds.mjs
//
// The Hermes-style texture is 8x8 Bayer ordered dithering of a real luminance
// image — dot density follows brightness, which uniform SVG dot patterns can't do.

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'images', 'home', 'dither');

// ---------------------------------------------------------------- noise

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function makeValueNoise(seed, gridSize) {
  const rand = mulberry32(seed);
  const lattice = new Float64Array(gridSize * gridSize);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = rand();
  const at = (x, y) =>
    lattice[((y % gridSize) + gridSize) % gridSize * gridSize + (((x % gridSize) + gridSize) % gridSize)];
  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const top = lerp(at(x0, y0), at(x0 + 1, y0), tx);
    const bottom = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
    return lerp(top, bottom, ty);
  };
}

function fbm(noise, x, y, octaves) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += noise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return value / total;
}

// ---------------------------------------------------------------- dither

// 8x8 Bayer matrix, thresholds 0..63.
const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

// Luminance (0..1, per dither cell) -> white-on-transparent RGBA at 1px per
// cell, then nearest-neighbor upscaled so each surviving cell becomes a crisp
// square "dot" of dotPx with a transparent gutter around it.
async function ditherToPng(luminance, width, height, { dotPx, pitchPx }, outPath) {
  try {
    const rgba = Buffer.alloc(width * height * 4, 0);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const threshold = (BAYER[y % 8][x % 8] + 0.5) / 64;
        if (luminance[y * width + x] > threshold) {
          const i = (y * width + x) * 4;
          rgba[i] = 255;
          rgba[i + 1] = 255;
          rgba[i + 2] = 255;
          rgba[i + 3] = 255;
        }
      }
    }

    // Scale each cell to pitchPx, then trim every dot down to dotPx by
    // compositing a transparent-gutter grid on top.
    const scaled = await sharp(rgba, { raw: { width, height, channels: 4 } })
      .resize(width * pitchPx, height * pitchPx, { kernel: 'nearest' })
      .raw()
      .toBuffer();

    const outW = width * pitchPx;
    const outH = height * pitchPx;
    for (let y = 0; y < outH; y += 1) {
      for (let x = 0; x < outW; x += 1) {
        if (x % pitchPx >= dotPx || y % pitchPx >= dotPx) {
          scaled[(y * outW + x) * 4 + 3] = 0;
        }
      }
    }

    await sharp(scaled, { raw: { width: outW, height: outH, channels: 4 } })
      .png({ palette: true, colors: 2 })
      .toFile(outPath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to generate ${outPath}: ${message}`);
  }
}

// ---------------------------------------------------------------- clouds

function cloudLuminance({ seed, width, height, octaves, scale, density, flatBase }) {
  const noise = makeValueNoise(seed, 64);
  const warp = makeValueNoise(seed + 1013, 64);
  const field = new Float64Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      // Elliptical falloff, biased so clouds are flatter on the bottom, with
      // the radius warped by low-frequency noise so the silhouette goes lumpy
      // instead of reading as a dotted oval.
      const dx = (x - cx) / cx;
      const rawDy = (y - cy) / cy;
      const dy = rawDy > 0 ? rawDy * (1 + flatBase) : rawDy;
      const lump = warp(2.4 + (x / width) * 2.3, 5.1 + (y / height) * 1.7);
      const dist = Math.sqrt(dx * dx + dy * dy) + (lump - 0.5) * 0.85;
      const falloff = Math.max(0, 1 - smooth(Math.min(1, Math.max(0, dist))));
      const n = fbm(noise, (x / width) * scale, (y / height) * scale * 1.6, octaves);
      // Remap noise into a puffy body with ragged edges.
      const body = Math.max(0, n * 1.6 - 0.45) * falloff;
      field[y * width + x] = Math.min(1, body * 3) * density;
    }
  }
  return field;
}

// ---------------------------------------------------------------- main

mkdirSync(OUT_DIR, { recursive: true });

const CLOUDS = [
  // Small-dot clouds carry most of the look (ko's favorite part of the reference).
  { name: 'cloud-1', seed: 11, width: 300, height: 150, octaves: 5, scale: 3.1, density: 0.42, flatBase: 0.5, dotPx: 2, pitchPx: 3 },
  { name: 'cloud-2', seed: 47, width: 340, height: 130, octaves: 5, scale: 3.7, density: 0.38, flatBase: 0.9, dotPx: 2, pitchPx: 3 },
  { name: 'cloud-3', seed: 83, width: 160, height: 90, octaves: 4, scale: 2.6, density: 0.45, flatBase: 0.3, dotPx: 3, pitchPx: 5 },
  { name: 'cloud-4', seed: 29, width: 190, height: 80, octaves: 5, scale: 3.3, density: 0.4, flatBase: 0.7, dotPx: 3, pitchPx: 5 },
];

for (const cloud of CLOUDS) {
  const field = cloudLuminance(cloud);
  const out = join(OUT_DIR, `${cloud.name}.png`);
  await ditherToPng(field, cloud.width, cloud.height, cloud, out);
  process.stdout.write(`wrote ${out}\n`);
}

// Contact sheet on brand blue for quick eyeballing (not committed).
const previews = CLOUDS.map((c) => `${c.name}.png`);
const composites = [];
let offsetY = 40;
let sheetW = 0;
for (const file of previews) {
  const meta = await sharp(join(OUT_DIR, file)).metadata();
  composites.push({ input: join(OUT_DIR, file), left: 40, top: offsetY });
  offsetY += meta.height + 40;
  sheetW = Math.max(sheetW, meta.width + 80);
}
await sharp({
  create: { width: sheetW, height: offsetY, channels: 4, background: { r: 0, g: 0, b: 242, alpha: 1 } },
})
  .composite(composites)
  .png()
  .toFile(join(HERE, 'preview-sheet.png'));
process.stdout.write(`wrote ${join(HERE, 'preview-sheet.png')} (preview only)\n`);
