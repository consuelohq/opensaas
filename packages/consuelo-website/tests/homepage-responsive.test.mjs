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
    expect(hero.match(/<span data-hero-line>/g)).toHaveLength(3);
  });

  test('should fit three authored hero lines with Pretext when the container changes', async () => {
    const hero = await readSource('src/components/home/HomeHero.astro');

    expect(hero).toContain("import { layout, prepare } from '@chenglou/pretext'");
    expect(hero).toContain("const heroLines = Array.from");
    expect(hero).toContain('new ResizeObserver');
    expect(hero).toContain("document.fonts.ready");
    expect(hero).toContain("heading.style.setProperty('--hero-title-size'");
    expect(hero).toContain('.os-hero h1 > span {');
    expect(hero).toContain('display: block;');
    expect(hero).not.toContain('.os-hero h1 > span:nth-child(2)::after');
  });

  test('should reveal a fixed full-viewport cloud footer behind the scrolling page', async () => {
    const [homepage, footer] = await Promise.all([
      readSource('src/pages/index.astro'),
      readSource('src/components/home/HomeCloudCta.astro'),
    ]);

    expect(homepage).toContain('class="home-scroll-layer"');
    expect(homepage.indexOf('</div>')).toBeLessThan(homepage.indexOf('<HomeCloudCta'));
    expect(footer).toContain('position: fixed;');
    expect(footer).toContain('height: 100dvh;');
    expect(footer).toContain('opacity: var(--cloud-reveal-opacity');
    expect(footer).toContain('pointer-events: var(--cloud-reveal-pointer-events');
    expect(footer).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(footer).toContain("window.addEventListener('scroll', scheduleReveal, { passive: true })");
    expect(footer).toContain('window.requestAnimationFrame(updateReveal)');
    expect(footer).toContain('data-cloud-title-line');
    expect(footer).toContain('CONSUELO OS');
    expect(footer).toContain('MIT LICENSE');
    expect(footer).toContain('bottom: 0;');
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

  test('should use editable local artwork and the compact inline sign-in arrow', async () => {
    const [hero, features] = await Promise.all([
      readSource('src/components/home/HomeHero.astro'),
      readSource('src/components/home/HomeFeaturePreview.astro'),
    ]);

    expect(hero).toContain('/images/home/dither/cloud-1.png');
    expect(hero).toContain('/images/home/dither/cloud-4.png');
    expect(features).toContain('/images/home/dither/cloud-2.png');
    expect(hero).toContain('class="os-hero__button-arrow"');
    expect(hero).toContain('viewBox="0 0 6 9"');
    expect(hero).toContain('<rect x="4" y="4" width="1" height="1" />');
    expect(hero).toContain('shape-rendering: crispEdges;');
    expect(hero).not.toContain('PixelArrow');
  });
});
