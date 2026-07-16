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

  test('should keep three authored hero lines stable without a post-paint fitter', async () => {
    const hero = await readSource('src/components/home/HomeHero.astro');

    expect(hero).not.toContain('@chenglou/pretext');
    expect(hero).not.toContain('new ResizeObserver');
    expect(hero).not.toContain('document.fonts.ready');
    expect(hero).not.toContain("heading.style.setProperty('--hero-title-size'");
    expect(hero).toContain('font-size: clamp(2.15rem, 9.25vw, 6.25rem);');
    expect(hero).toContain('.os-hero h1 > span {');
    expect(hero).toContain('display: block;');
    expect(hero).not.toContain('.os-hero h1 > span:nth-child(2)::after');
  });

  test('should preload the Latin variable fonts used by the landing page', async () => {
    const layout = await readSource('src/layouts/MarketingLayout.astro');

    expect(layout).toContain("bodoni-moda-latin-wght-normal.woff2?url");
    expect(layout).toContain("inter-latin-wght-normal.woff2?url");
    expect(layout.match(/rel="preload"/g)).toHaveLength(2);
    expect(layout.match(/as="font"/g)).toHaveLength(2);
    expect(layout.match(/type="font\/woff2"/g)).toHaveLength(2);
    expect(layout.match(/font-display: block/g)).toHaveLength(2);
    expect(layout).not.toContain("import '@fontsource-variable/bodoni-moda'");
    expect(layout).not.toContain("import '@fontsource-variable/inter'");
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
    expect(footer).toContain('CONSUELO OS <span>V0.10.3</span>');
    expect(footer).toContain('MIT LICENSE');
    expect(footer).toContain('bottom: 0;');
    expect(footer).toContain('window.innerHeight * 1.4');
    expect(footer).toContain('Math.pow(progress, 1.15)');
  });

  test('should compose the cloud footer as an illustration-led poster', async () => {
    const footer = await readSource('src/components/home/HomeCloudCta.astro');

    expect(footer).not.toContain('@chenglou/pretext');
    expect(footer).not.toContain("heading.style.setProperty('--cloud-title-size'");
    expect(footer).toContain('font-size: clamp(2.8rem, 4.4vw, 4rem);');
    expect(footer).toContain('font-size: clamp(3.05rem, 7.1vw, 3.85rem);');
    expect(footer).toContain('font-size: clamp(3.1rem, 14.7vw, 3.8rem);');
    expect(footer).toContain('data-cloud-word-line>CONSUELO</span>');
    expect(footer).toContain('data-cloud-word-line>CLOUD</span>');
    expect(footer).toContain('/generated/holding-world-editorial.png');
    expect(footer).not.toContain('filter: brightness(0) invert(1)');
    expect(footer).toContain('KEEP THE SAME WORKSPACE AND LET CONSUELO');
    expect(footer).toContain('RUN THE HOME NODE FOR YOU');
    expect(footer).toContain('--cloud-gutter: clamp(4.75rem, 8.5vw, 8rem);');
    expect(footer).toContain('/generated/consuelo-footer-badge.png');
    expect(footer).toContain('aspect-ratio: 121 / 173;');
    expect(footer).toContain('justify-items: end;');
    expect(footer).toContain('text-align: right;');
    expect(footer).toContain('.cloud-cta__badge {\n      display: none;');
  });

  test('should generate footer binaries before dev and build without tracking them', async () => {
    const [packageJson, gitignore, generator] = await Promise.all([
      readSource('package.json'),
      readSource('.gitignore'),
      readSource('scripts/generate-footer-art.ts'),
    ]);

    expect(packageJson).toContain('"dev": "bun run generate:footer-art && astro dev"');
    expect(packageJson).toContain('"start": "bun run generate:footer-art && astro dev"');
    expect(packageJson).toContain(
      '"build": "bun run generate:footer-art && astro check && astro build"',
    );
    expect(gitignore).toContain('public/generated/');
    expect(generator).toContain("public/generated/holding-world-editorial.png");
    expect(generator).toContain("public/generated/consuelo-footer-badge.png");
    expect(generator).toContain('bodyUnderlayMask');
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
