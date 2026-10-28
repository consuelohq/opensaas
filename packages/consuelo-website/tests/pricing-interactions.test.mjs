import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path) => readFile(join(packageRoot, path), 'utf8');

describe('Consuelo pricing interactions', () => {
  test('should make every plan a destination with an explicit hover and focus CTA state', async () => {
    const [page, content] = await Promise.all([
      readSource('src/pages/pricing.astro'),
      readSource('src/data/pricing-content.ts'),
    ]);

    expect(content).toContain('href: string');
    expect(page).toContain('href={plan.href}');
    expect(page).toContain('aria-label={`Choose ${plan.name} plan`}');
    expect(page).toContain('pricing-plan__cta-default');
    expect(page).toContain('pricing-plan__cta-active');
    expect(page).toContain('CHOOSE PLAN');
    expect(page).toContain('SUBSCRIBE');
    expect(page).toContain('.pricing-plan:hover,');
    expect(page).toContain('.pricing-plan:focus-visible');
    expect(page).toContain(
      'background: transparent;\n\t\tborder-color: transparent;\n\t\tcolor: white;',
    );
  });

  test('should preserve the requested artwork order across the four plans', async () => {
    const content = await readSource('src/data/pricing-content.ts');

    const artwork = [
      '/images/home/trace.svg',
      '/images/home/remember.svg',
      '/images/home/switch.svg',
      '/images/home/workflow.svg',
    ];

    const positions = artwork.map((asset) => content.indexOf(asset));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });
});

describe('Consuelo homepage interaction polish', () => {
  test('should load the established Bodoni and Inter brand typography locally', async () => {
    const [layout, tokens] = await Promise.all([
      readSource('src/layouts/MarketingLayout.astro'),
      readSource('src/styles/tokens.css'),
    ]);

    expect(layout).toContain("@fontsource-variable/bodoni-moda");
    expect(layout).toContain("@fontsource-variable/inter");
    expect(tokens).toContain("--site-font-display: 'Bodoni Moda Variable'");
    expect(tokens).toContain("--site-font-body: 'Inter Variable'");
  });

  test('should use inverse hover treatments for primary homepage actions', async () => {
    const [hero, cloudCta] = await Promise.all([
      readSource('src/components/home/HomeHero.astro'),
      readSource('src/components/home/HomeCloudCta.astro'),
    ]);

    expect(hero).toContain('background: transparent;\n    color: white;');
    expect(hero).toContain('.os-hero__command:hover,');
    expect(hero).toContain('background: white;\n    color: var(--site-color-brand);');
    expect(cloudCta).toContain('.cloud-cta a:hover,');
    expect(cloudCta).toContain('background: transparent;\n    color: white;');
  });

  test('should tighten FAQ rows while emphasizing the disclosure icon', async () => {
    const faq = await readSource('src/components/home/HomeFaq.astro');

    expect(faq).toContain('font-weight: 400;');
    expect(faq).toContain('font-size: 1.8rem;');
    expect(faq).toContain('font-weight: 700;');
    expect(faq).toContain('min-height: 4.1rem;');
  });
});
