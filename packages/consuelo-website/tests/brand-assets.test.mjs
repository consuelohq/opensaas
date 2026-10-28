import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(packageRoot, '../..');
const readWebsite = (path) => readFile(join(packageRoot, path), 'utf8');
const readRepo = (path) => readFile(join(repoRoot, path), 'utf8');

describe('Consuelo canonical brand assets', () => {
  test('should use the black Consuelo mark on a rounded white app tile', async () => {
    const [favicon, logo, faviconPng, appleTouchIcon] = await Promise.all([
      readWebsite('public/favicon.svg'),
      readWebsite('public/logo.svg'),
      readFile(join(packageRoot, 'public/favicon-32x32.png')),
      readFile(join(packageRoot, 'public/apple-touch-icon.png')),
    ]);

    for (const svg of [favicon, logo]) {
      expect(svg).toContain('data-consuelo-app-icon');
      expect(svg).toContain('fill="#FFFFFF"');
      expect(svg).toContain('fill="#000000"');
      expect(svg).toMatch(/<rect[^>]+rx="216"/);
      expect(svg).not.toContain('#0000F2');
    }

    const [faviconMetadata, touchMetadata] = await Promise.all([
      sharp(faviconPng).metadata(),
      sharp(appleTouchIcon).metadata(),
    ]);
    expect([faviconMetadata.width, faviconMetadata.height]).toEqual([32, 32]);
    expect([touchMetadata.width, touchMetadata.height]).toEqual([180, 180]);
  });

  test('should point every public surface at the canonical icon', async () => {
    const [seoHead, siteSeo, docsConfig, docsFallback, artifactRenderer] = await Promise.all([
      readWebsite('src/components/SeoHead.astro'),
      readWebsite('src/lib/site-seo.ts'),
      readRepo('packages/documentation/astro.config.mjs'),
      readRepo('packages/documentation/public/favicon.svg'),
      readRepo('packages/os/scripts/artifact-render.ts'),
    ]);

    expect(seoHead).toContain('href="/favicon.svg"');
    expect(siteSeo).toContain("logo: resolveImageUrl('/favicon.svg')");
    expect(docsConfig).toContain("favicon: 'https://consuelohq.com/favicon.svg'");
    expect(docsFallback).toContain('data-consuelo-app-icon');
    expect(artifactRenderer).toContain('https://consuelohq.com/favicon.svg');
    expect(artifactRenderer).toContain('https://consuelohq.com/favicon-32x32.png');
    expect(artifactRenderer).toContain('https://consuelohq.com/apple-touch-icon.png');
  });
});
