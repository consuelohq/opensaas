import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoot = join(packageRoot, 'src');

const readSource = (relativePath) =>
  readFileSync(join(packageRoot, relativePath), 'utf8');

const expectFile = (relativePath) => {
  expect(existsSync(join(packageRoot, relativePath)), relativePath).toBe(true);
};

const expectNoFile = (relativePath) => {
  expect(existsSync(join(packageRoot, relativePath)), relativePath).toBe(false);
};

describe('Consuelo website structure', () => {
  test('uses site/home/marketing names for the public marketing shell', () => {
    [
      'src/layouts/MarketingLayout.astro',
      'src/components/site/SiteHeader.astro',
      'src/components/site/SiteFooter.astro',
      'src/components/site/LanguageSelector.astro',
      'src/components/home/HomeHero.astro',
      'src/components/home/HomeOverview.astro',
      'src/components/home/HomeStats.astro',
      'src/components/home/HomePrivacy.astro',
      'src/components/home/HomeFaq.astro',
      'src/components/home/HomeMercuryPromo.astro',
      'src/data/site-links.ts',
      'src/data/site-navigation.ts',
      'src/data/home-content.ts',
      'src/data/mercury-content.ts',
      'src/data/docs-navigation.ts',
      'src/data/docs-navigation-source.json',
      'COMPONENTS.md',
    ].forEach(expectFile);

    [
      'src/layouts/LaunchLayout.astro',
      'src/data/launch-content.ts',
      'src/data/launch-docs.ts',
      'src/data/launch-docs-source.json',
      'src/components/launch/LaunchHeader.astro',
      'src/components/launch/LaunchFooter.astro',
      'src/components/launch/LaunchHero.astro',
    ].forEach(expectNoFile);
  });

  test('keeps public shell routes on the SEO-capable marketing layout and site chrome', () => {
    const routeImports = {
      'src/pages/index.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
        '../components/home/HomeHero.astro',
        '../components/home/HomeOverview.astro',
        '../components/home/HomeStats.astro',
        '../components/home/HomePrivacy.astro',
        '../components/home/HomeFaq.astro',
        '../components/home/HomeMercuryPromo.astro',
      ],
      'src/pages/404.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
      ],
      'src/pages/terms.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
      ],
      'src/pages/privacy.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
      ],
      'src/pages/changelog.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
      ],
      'src/pages/contact.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
        '../data/mercury-content',
      ],
      'src/pages/mercury.astro': [
        '../layouts/MarketingLayout.astro',
        '../components/site/SiteHeader.astro',
        '../components/site/SiteFooter.astro',
        '../data/mercury-content',
        '../data/site-links',
      ],
      'src/pages/login/device.astro': [
        '../../layouts/MarketingLayout.astro',
        '../../components/site/SiteHeader.astro',
        '../../components/site/SiteFooter.astro',
      ],
    };

    for (const [route, imports] of Object.entries(routeImports)) {
      const source = readSource(route);
      for (const importPath of imports) {
        expect(source, route).toContain(importPath);
      }
      expect(source, route).not.toContain('components/launch');
      expect(source, route).not.toContain('LaunchLayout');
      expect(source, route).not.toContain('LaunchHeader');
      expect(source, route).not.toContain('LaunchFooter');
    }
  });

  test('preserves SEO layout wiring and critical site links', async () => {
    const layout = readSource('src/layouts/MarketingLayout.astro');
    expect(layout).toContain("../components/SeoHead.astro");
    expect(layout).toContain("../lib/site-seo");
    expect(layout).toContain("../config/analytics");

    const seoHead = readSource('src/components/SeoHead.astro');
    expect(seoHead).toContain('../lib/site-seo');
    expect(seoHead).toContain('application/ld+json');

    const { siteLinks, ghlMarketplaceUrl } = await import(pathToFileURL(join(sourceRoot, 'data/site-links.ts')).href);
    expect(siteLinks.app).toBe('https://app.consuelohq.com');
    expect(siteLinks.login).toBe(siteLinks.app);
    expect(siteLinks.free).toBe(siteLinks.app);
    expect(siteLinks.docs).toBe('https://docs.consuelohq.com');
    expect(siteLinks.changelog).toBe('/changelog');
    expect(siteLinks.mercury).toBe('/mercury');
    expect(siteLinks.privacy).toBe('/privacy');
    expect(siteLinks.terms).toBe('/terms');
    expect(ghlMarketplaceUrl).toContain('marketplace.gohighlevel.com');

    const navigation = await import(pathToFileURL(join(sourceRoot, 'data/site-navigation.ts')).href);
    expect(navigation.siteHeaderLinks.map((link) => link.label)).toEqual([
      'Docs',
      'Mercury',
      'Enterprise',
    ]);
    expect(navigation.siteMobileMenuLinks.map((link) => link.label)).toContain('Login');
    expect(navigation.homePageSections.map((section) => section.id)).toEqual([
      'intro',
      'overview',
      'proof',
      'privacy',
      'faq',
      'mercury',
      'waitlist',
    ]);
  });

  test('keeps the GHL redirect on the shared site links module', () => {
    const ghlRoute = readSource('src/pages/ghl.astro');
    expect(ghlRoute).toContain("../data/site-links");
    expect(ghlRoute).not.toContain('launch-content');
  });

  test('keeps blog route surfaces outside the marketing shell rename', () => {
    expectFile('src/pages/blog/index.astro');
    expectFile('src/layouts/Layout.astro');
    expectFile('src/layouts/PostLayout.astro');

    const blogIndex = readSource('src/pages/blog/index.astro');
    expect(blogIndex).toContain('@/layouts/Layout.astro');

    const backButton = readSource('src/components/BackButton.astro');
    expect(backButton).toContain('./site/LanguageSelector.astro');
    expect(backButton).toContain('href="/blog"');
  });
});
