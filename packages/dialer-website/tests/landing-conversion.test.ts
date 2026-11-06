import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Dialer landing conversion routes', () => {
  it('shows direct plan selection and the future interactive demo without a checkout interstitial', () => {
    const hero = source('src/components/home/HomeHero.astro');
    const navigation = source('src/data/site-navigation.ts');
    const close = source('src/data/dialer-content.ts');
    expect(hero).toContain('href="/pricing"');
    expect(hero).toContain('href="/demo"');
    expect(close).toContain("secondaryLabel: 'INTERACTIVE DEMO'");
    expect(navigation).not.toContain("href: '/get-started'");
    expect(navigation).not.toContain('/how-it-works');
  });

  it('keeps product capabilities on the landing page and provides one clear demo action', () => {
    const index = source('src/pages/index.astro');
    const features = source('src/components/home/HomeFeaturePreview.astro');
    expect(index).toContain('<PricingTechnology variant="home" />');
    expect(index.indexOf('<PricingTechnology variant="home" />')).toBeGreaterThan(
      index.indexOf('<HomeHero'),
    );
    expect(index.indexOf('<PricingTechnology variant="home" />')).toBeLessThan(
      index.indexOf('<HomeFeaturePreview'),
    );
    expect(features).toContain('id={item.icon}');
    expect(features).toContain('CAPABILITIES');
    expect(features).not.toContain('/how-it-works');
    expect(features).toContain('href="/demo"');
  });

  it('removes the explanatory page without breaking old incoming links', () => {
    const redirects = source('public/_redirects');
    expect(existsSync(resolve(root, 'src/pages/how-it-works.astro'))).toBe(false);
    expect(redirects).toContain('/how-it-works /#features 301');
    expect(redirects).toContain('/how-it-works/ /#features 301');
    expect(existsSync(resolve(root, 'src/pages/demo.astro'))).toBe(true);
  });

  it('uses the official mark in the full-width floating navigation on home and pricing', () => {
    const header = source('src/components/site/SiteHeader.astro');
    expect(header).toContain('class="returning-nav__logo"');
    expect(header).toContain('src="/images/home/consuelo-mark.svg"');
    expect(header).toContain("'.pricing-plans'");
    expect(header).toContain("'[data-cloud-reveal]'");
    expect(header).toContain('inset: 0 0 auto');
    expect(header).toContain("prefers-reduced-motion: reduce");
  });

  it('removes the footer divider and keeps the wordmark from underlining', () => {
    const footer = source('src/components/site/SiteFooter.astro');
    expect(footer).not.toMatch(/border-top:\s*1px/);
    expect(footer).toContain('a:not(.dialer-footer__brand):hover');
  });
});
