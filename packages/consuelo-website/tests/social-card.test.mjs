import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { homepageSeo } from '../src/lib/homepage-seo';

const testDirectory = dirname(fileURLToPath(import.meta.url));

const getPngSize = (image) => ({
  width: image.readUInt32BE(16),
  height: image.readUInt32BE(20),
});

describe('Consuelo homepage social card', () => {
  test('should use the dedicated on-brand Consuelo OS preview', async () => {
    const [committed, generator] = await Promise.all([
      readFile(join(testDirectory, '../public/consuelo-os-og.png')),
      readFile(join(testDirectory, '../scripts/generate-social-card.ts'), 'utf8'),
    ]);

    expect(committed.subarray(1, 4).toString()).toBe('PNG');
    expect(getPngSize(committed)).toEqual({ width: 1200, height: 630 });
    expect(homepageSeo.socialCardHeadline).toBe(
      'Your workspace, connected to every agent.',
    );
    expect(homepageSeo.image).toBe('/consuelo-os-og.png');
    expect(generator).toContain('YOUR WORKSPACE,');
    expect(generator).toContain('CONNECTED TO');
    expect(generator).toContain('EVERY AGENT.');
  });
});
