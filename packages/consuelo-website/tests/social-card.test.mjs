import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

import { homepageSeo } from '../src/lib/homepage-seo';

const testDirectory = dirname(fileURLToPath(import.meta.url));

describe('Consuelo homepage social card', () => {
  test('should render the versioned card on Hermes blue when sharing the homepage', async () => {
    const [committed, generator] = await Promise.all([
      readFile(join(testDirectory, '../public/consuelo-os-og-20260714.png')),
      readFile(join(testDirectory, '../scripts/generate-social-card.ts'), 'utf8'),
    ]);
    const metadata = await sharp(committed).metadata();
    const corner = await sharp(committed)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();

    expect(committed.subarray(1, 4).toString()).toBe('PNG');
    expect({ width: metadata.width, height: metadata.height }).toEqual({
      width: 1200,
      height: 630,
    });
    expect([...corner]).toEqual([0, 0, 242]);
    expect(homepageSeo.socialCardHeadline).toBe(
      'Your workspace, connected to every agent.',
    );
    expect(homepageSeo.image).toBe('/consuelo-os-og-20260714.png');
    expect(generator).toContain('YOUR WORKSPACE,');
    expect(generator).toContain('CONNECTED TO');
    expect(generator).toContain('EVERY AGENT.');
    expect(generator).toContain("const cardBackground = '#0000F2';");
    expect(generator).not.toContain("const cardBackground = '#000000';");
  });
});
