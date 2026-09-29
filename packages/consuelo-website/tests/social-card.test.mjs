import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

import { socialCards } from '../scripts/generate-social-card';
import { homepageSeo } from '../src/lib/homepage-seo';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const pixelAt = async (image, left, top) =>
  [...await sharp(image)
    .extract({ left, top, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer()];

describe('Consuelo social cards', () => {
  test('should ship complete, decodable, compact cards for every page', async () => {
    for (const card of Object.values(socialCards)) {
      const committed = await readFile(
        join(testDirectory, '../assets/encoded', `${card.fileName}.base64`),
        'utf8',
      );
      const image = Buffer.from(committed.trim(), 'base64');
      const metadata = await sharp(image).metadata();

      expect(image.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect({ width: metadata.width, height: metadata.height }).toEqual({ width: 1200, height: 630 });
      expect(await pixelAt(image, 0, 0)).toEqual([0, 0, 242]);
      expect(await pixelAt(image, 35, 35)).toEqual([255, 255, 255]);
      expect(image.byteLength).toBeLessThan(250_000);
    }
  });

  test('should use the cloud card for the homepage share image', () => {
    expect(homepageSeo.image).toBe('/consuelo-os-og-20260929-clouds-v2.png');
  });
});
