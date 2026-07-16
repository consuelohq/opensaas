import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const artPath = join(packageRoot, 'public/images/home/holding-world-editorial.png');
const badgePath = join(packageRoot, 'public/images/home/consuelo-footer-badge.png');

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
  test('should be a valid generated PNG with white figure regions and preserved blue ink', async () => {
    const bytes = await readFile(artPath);
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const metadata = await sharp(artPath).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeGreaterThan(1700);
    expect(metadata.height).toBeGreaterThan(1900);

    const hair = await countRegion(artPath, { left: 0.42, right: 0.83, top: 0.03, bottom: 0.38 });
    const garment = await countRegion(artPath, { left: 0.42, right: 0.88, top: 0.5, bottom: 0.96 });
    const hand = await countRegion(artPath, { left: 0.16, right: 0.52, top: 0.56, bottom: 0.82 });
    const globe = await countRegion(artPath, { left: 0.12, right: 0.42, top: 0.42, bottom: 0.72 });

    expect(hair.blue).toBeGreaterThan(8000);
    expect(garment.white).toBeGreaterThan(20_000);
    expect(garment.blue).toBeGreaterThan(2500);
    expect(hand.white).toBeGreaterThan(2500);
    expect(globe.blue).toBeGreaterThan(3000);
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
