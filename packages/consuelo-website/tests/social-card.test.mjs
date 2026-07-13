import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

import { renderHomepageSocialCard } from '../scripts/generate-social-card';
import { homepageSeo } from '../src/lib/homepage-seo';

const testDirectory = dirname(fileURLToPath(import.meta.url));

describe('Consuelo homepage social card', () => {
  test('should render the current homepage position at the social preview size', async () => {
    const image = await renderHomepageSocialCard();
    const metadata = await sharp(image).metadata();

    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(homepageSeo.socialCardHeadline).toBe(
      'Your workspace, connected to every agent.',
    );
  });

  test('should keep the committed card synchronized with its generator', async () => {
    const generated = await renderHomepageSocialCard();
    const committed = await readFile(join(testDirectory, '../public/og.png'));

    expect(generated.equals(committed)).toBe(true);
  });
});
