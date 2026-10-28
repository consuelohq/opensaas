import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, test } from 'bun:test';
import sharp from 'sharp';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const artPath = join(packageRoot, 'public/generated/holding-world-editorial.png');
const badgePath = join(packageRoot, 'public/generated/consuelo-footer-badge.png');
const autoFillExclusionMaskPath = join(packageRoot, 'public/images/home/holding-world-auto-fill-exclusion-mask.svg');
const fillMaskPath = join(packageRoot, 'public/images/home/holding-world-white-fill-mask.svg');
const generatorPath = join(packageRoot, 'scripts/generate-footer-art.ts');

beforeAll(() => {
  const generated = Bun.spawnSync({
    cmd: ['bun', 'scripts/generate-footer-art.ts'],
    cwd: packageRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  expect(generated.exitCode).toBe(0);
});

const measureWhiteComponents = async (path) => {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixelCount = info.width * info.height;
  const white = new Uint8Array(pixelCount);
  let totalWhite = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * info.channels;
    if (
      data[offset + 3] > 220 &&
      data[offset] > 240 &&
      data[offset + 1] > 240 &&
      data[offset + 2] > 240
    ) {
      white[index] = 1;
      totalWhite += 1;
    }
  }

  const seen = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const components = [];

  for (let start = 0; start < pixelCount; start += 1) {
    if (white[start] === 0 || seen[start] === 1) continue;

    let queueStart = 0;
    let queueEnd = 0;
    let size = 0;
    let minX = info.width;
    let minY = info.height;
    let maxX = 0;
    let maxY = 0;
    queue[queueEnd] = start;
    queueEnd += 1;
    seen[start] = 1;

    while (queueStart < queueEnd) {
      const index = queue[queueStart];
      queueStart += 1;
      size += 1;
      const x = index % info.width;
      const y = Math.floor(index / info.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [index - 1, index + 1, index - info.width, index + info.width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= pixelCount || seen[neighbor] === 1 || white[neighbor] === 0) {
          continue;
        }
        const neighborX = neighbor % info.width;
        if (Math.abs(neighborX - x) > 1) continue;
        seen[neighbor] = 1;
        queue[queueEnd] = neighbor;
        queueEnd += 1;
      }
    }

    components.push({
      size,
      widthShare: (maxX - minX + 1) / info.width,
      heightShare: (maxY - minY + 1) / info.height,
    });
  }

  components.sort((a, b) => b.size - a.size);
  return { totalWhite, components };
};

const countRegion = async (path, bounds) => {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const left = Math.floor(info.width * bounds.left);
  const right = Math.ceil(info.width * bounds.right);
  const top = Math.floor(info.height * bounds.top);
  const bottom = Math.ceil(info.height * bounds.bottom);
  let blue = 0;
  let white = 0;

  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blueChannel = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha > 220 && red < 24 && green < 24 && blueChannel > 220) blue += 1;
      if (alpha > 220 && red > 240 && green > 240 && blueChannel > 240) white += 1;
    }
  }

  return { blue, white };
};

describe('cloud footer editorial artwork', () => {
  test('should use semantic smooth vector paths for the hand and sash fill mask', async () => {
    const [autoFillExclusionMask, fillMask, generator] = await Promise.all([
      readFile(autoFillExclusionMaskPath, 'utf8'),
      readFile(fillMaskPath, 'utf8'),
      readFile(generatorPath, 'utf8'),
    ]);

    expect(autoFillExclusionMask).toContain('id="body-exclusion"');
    expect(autoFillExclusionMask).toContain('id="arm-exclusion"');
    expect(autoFillExclusionMask).not.toContain('<polygon');
    expect(autoFillExclusionMask).toMatch(/<path[^>]+d="[^"]*[CQ][^"]*"/);
    expect(fillMask).toContain('id="sash-fill"');
    expect(fillMask).toContain('id="hand-fill"');
    expect(fillMask).not.toContain('<polygon');
    expect(fillMask).toMatch(/<path[^>]+d="[^"]*[CQ][^"]*"/);
    expect(generator).toContain('holding-world-white-fill-mask.svg');
    expect(generator).toContain('holding-world-auto-fill-exclusion-mask.svg');
    expect(generator).not.toContain('bodyUnderlayMask');
    expect(generator).not.toContain('whitenedInkPixels');
  });

  test('should be a valid generated PNG with white figure regions and preserved blue ink', async () => {
    const bytes = await readFile(artPath);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const metadata = await sharp(artPath).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeGreaterThan(1700);
    expect(metadata.height).toBeGreaterThan(1900);

    const hair = await countRegion(artPath, { left: 0.42, right: 0.83, top: 0.03, bottom: 0.38 });
    const outerRobe = await countRegion(artPath, { left: 0.66, right: 0.96, top: 0.5, bottom: 0.96 });
    const sleeve = await countRegion(artPath, { left: 0.38, right: 0.62, top: 0.54, bottom: 0.86 });
    const forearm = await countRegion(artPath, { left: 0.22, right: 0.5, top: 0.62, bottom: 0.82 });
    const palm = await countRegion(artPath, { left: 0.12, right: 0.36, top: 0.59, bottom: 0.75 });
    const globe = await countRegion(artPath, { left: 0.12, right: 0.42, top: 0.42, bottom: 0.72 });

    expect(hair.blue).toBeGreaterThan(8000);
    expect(outerRobe.white).toBeGreaterThan(3_000);
    expect(outerRobe.blue).toBeGreaterThan(2500);
    expect(sleeve.white).toBeGreaterThan(8500);
    expect(forearm.white).toBeGreaterThan(5500);
    expect(palm.white).toBeGreaterThan(3500);
    expect(globe.blue).toBeGreaterThan(3000);
  });

  test('should keep white figure regions separated instead of merging the arm and torso into one flood', async () => {
    const { totalWhite, components } = await measureWhiteComponents(artPath);
    const largest = components[0];

    expect(totalWhite).toBeGreaterThan(100_000);
    expect(largest.size / totalWhite).toBeLessThan(0.38);
    expect(largest.widthShare).toBeLessThan(0.55);
    expect(largest.heightShare).toBeLessThan(0.6);
  });

  test('should keep the inner sash and outstretched hand cleanly white', async () => {
    const handCore = await countRegion(artPath, {
      left: 0.15,
      right: 0.34,
      top: 0.62,
      bottom: 0.72,
    });
    const sashUpper = await countRegion(artPath, {
      left: 0.48,
      right: 0.68,
      top: 0.48,
      bottom: 0.66,
    });
    const sashMiddle = await countRegion(artPath, {
      left: 0.43,
      right: 0.68,
      top: 0.6,
      bottom: 0.84,
    });
    const sashLower = await countRegion(artPath, {
      left: 0.43,
      right: 0.68,
      top: 0.76,
      bottom: 0.96,
    });

    const whiteShare = ({ white, blue }) => white / (white + blue);

    expect(whiteShare(handCore)).toBeGreaterThan(0.8);
    expect(whiteShare(sashUpper)).toBeGreaterThan(0.9);
    expect(whiteShare(sashMiddle)).toBeGreaterThan(0.97);
    expect(whiteShare(sashLower)).toBeGreaterThan(0.95);
  });

  test('should generate a legible portrait badge from the editorial artwork', async () => {
    const metadata = await sharp(badgePath).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(242);
    expect(metadata.height).toBe(346);

    const center = await countRegion(badgePath, { left: 0.08, right: 0.92, top: 0.12, bottom: 0.84 });
    expect(center.blue).toBeGreaterThan(1500);
    expect(center.white).toBeGreaterThan(1500);
  });
});
