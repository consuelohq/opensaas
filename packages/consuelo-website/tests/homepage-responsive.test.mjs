import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path) => readFile(join(packageRoot, path), 'utf8');

describe('Consuelo OS homepage presentation', () => {
  test('should keep the mobile hero compact with one full-width sign-in action', async () => {
    const hero = await readSource('src/components/home/HomeHero.astro');

    expect(hero).not.toContain('DOWNLOAD LOCALLY');
    expect(hero).toContain('width: min(100%, 31rem);');
    expect(hero).toContain('min-height: calc(100svh - 4rem);');
    expect(hero.match(/data-hero-line/g)).toHaveLength(3);
  });

  test('should use a refresh-visible preview notice without persistent storage', async () => {
    const notice = await readSource('src/components/home/PreviewNotice.astro');

    expect(notice).toContain('Consuelo OS is currently in preview.');
    expect(notice).toContain('support@consuelohq.com');
    expect(notice).toContain('data-preview-notice-dismiss');
    expect(notice).not.toMatch(/localStorage|sessionStorage|cookie/i);
  });

  test('should use the blue placeholder and omit the homepage waitlist footer', async () => {
    const features = await readSource('src/components/home/HomeFeaturePreview.astro');
    const homepage = await readSource('src/pages/index.astro');

    expect(features).not.toContain('integrations-blue.svg');
    expect(features).toContain('<PreviewNotice />');
    expect(homepage).not.toContain('SiteFooter');
  });
});
