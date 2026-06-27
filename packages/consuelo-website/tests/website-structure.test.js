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
  test('should use site home and marketing names when defining the public marketing shell', () => {
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

  test('should keep public shell routes on the SEO capable marketing layout when routes use shared site chrome', () => {
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
        '../data/contact-content',
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

  test('should preserve SEO layout wiring and critical site links when data modules are split', async () => {
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


  test('should preserve review-comment contracts when validating marketing data and route behavior', async () => {
    expectFile('src/data/contact-content.ts');

    const homeFaq = readSource('src/components/home/HomeFaq.astro');
    expect(homeFaq).toContain('set:html={item.answer}');
    expect(homeFaq).not.toContain('{item.answer}</p>');

    const homeContent = readSource('src/data/home-content.ts');
    expect(homeContent).toContain('linkHref: siteLinks.privacy');

    const { ghlMarketplaceUrl } = await import(pathToFileURL(join(sourceRoot, 'data/site-links.ts')).href);
    expect(ghlMarketplaceUrl).toContain('marketplace.gohighlevel.com');
    expect(ghlMarketplaceUrl).toContain('redirect_uri=https%3A%2F%2Fapp.consuelohq.com%2Fapi%2Foauth%2Fcallback');
    expect(ghlMarketplaceUrl).not.toContain('github.dev');

    const navigation = await import(pathToFileURL(join(sourceRoot, 'data/site-navigation.ts')).href);
    expect(navigation.siteMobileMenuLinks.map((link) => link.label)).toEqual([
      'Mercury',
      'Enterprise',
      'Login',
      'Free',
    ]);

    const contactRoute = readSource('src/pages/contact.astro');
    expect(contactRoute).toContain("../data/contact-content");
    expect(contactRoute).toContain('contactFaqItems.map');
    expect(contactRoute).not.toContain('mercuryFaqItems');
  });

  test('should initialize analytics by default when consent banner is removed', () => {
    const layout = readSource('src/layouts/MarketingLayout.astro');
    expect(layout).toContain('{posthogKey && (');
    expect(layout).toContain('posthog.init(posthogKey');
    expect(layout).not.toContain('analyticsEnabled');
    expect(layout).not.toContain('consuelo-cookie-consent');
    expect(layout).not.toContain('cookie-banner');
    expect(layout).not.toContain('cookie-accept');
    expect(layout).not.toContain('cookie-decline');
    expect(layout).not.toContain('We use cookies to understand how you use our site and improve your experience.');
    expect(layout.indexOf('posthog.init(posthogKey')).toBeGreaterThan(layout.indexOf('!function(t,e)'));

    const privacyRoute = readSource('src/pages/privacy.astro');
    expect(privacyRoute).not.toContain('analyticsEnabled={false}');
    expect(privacyRoute).not.toContain('cookie banner');
    expect(privacyRoute).not.toContain('Decline');
    expect(privacyRoute).not.toContain('Cookies for tracking consent status');
    expect(privacyRoute).not.toContain('rely on <strong>consent</strong>');
    expect(privacyRoute).toContain('analytics data to improve our website and product experience');

    const deviceRoute = readSource('src/pages/login/device.astro');
    expect(deviceRoute).not.toContain('analyticsEnabled={false}');

    expectNoFile('src/components/CookieConsent.tsx');
    expectNoFile('src/components/ui/Toast.astro');
  });

  test('should keep the GHL redirect on shared site links when the route is a noindex redirect', () => {
    const ghlRoute = readSource('src/pages/ghl.astro');
    expect(ghlRoute).toContain("../data/site-links");
    expect(ghlRoute).toContain('http-equiv="refresh"');
    expect(ghlRoute).toContain('noindex,nofollow');
    expect(ghlRoute).not.toContain('launch-content');
    expect(ghlRoute).not.toContain('MarketingLayout');
  });

  test('should keep blog route surfaces outside the marketing shell rename when preserving blog behavior', () => {
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
