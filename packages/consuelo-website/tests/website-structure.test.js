import { describe, expect, test } from 'bun:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageRoot, '../..');
const sourceRoot = join(packageRoot, 'src');

const readSource = (relativePath) =>
  readFileSync(join(packageRoot, relativePath), 'utf8');

const readRepo = (relativePath) =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

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
      'public/images/consuelo-integrations-hero.svg',
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

  test('should expose the Hermes-style pricing route without wiring it into shared navigation', async () => {
    expectFile('src/pages/pricing.astro');
    expectFile('src/data/pricing-content.ts');

    const pricingRoute = readSource('src/pages/pricing.astro');
    const redirects = readSource('public/_redirects');
    const pricingContent = await import(pathToFileURL(join(sourceRoot, 'data/pricing-content.ts')).href);
    const { siteLinks } = await import(pathToFileURL(join(sourceRoot, 'data/site-links.ts')).href);
    const navigation = await import(pathToFileURL(join(sourceRoot, 'data/site-navigation.ts')).href);

    expect(pricingRoute).toContain('../layouts/MarketingLayout.astro');
    expect(pricingRoute).toContain('../components/site/SiteHeader.astro');
    expect(pricingRoute).toContain('../data/pricing-content');
    expect(pricingRoute).toContain('title="Pricing"');
    expect(pricingRoute).toContain('{pricingHero.title}');
    expect(pricingRoute).toContain('Already have an account?');
    expect(pricingRoute).toContain('pricing-page__panel');
    expect(pricingRoute).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
    expect(pricingRoute).not.toContain('SiteFooter');
    expect(pricingRoute).not.toContain('FAQ');
    expect(pricingRoute).not.toContain('checkout');
    expect(redirects).not.toContain('/pricing /mercury');
    expect(redirects).toContain('/pricing /pricing/index.html 200');
    expect(redirects).toContain('/pricing/ /pricing/index.html 200');

    expect(pricingContent.pricingHero.title).toBe('CHOOSE A PLAN');
    expect(pricingContent.pricingHero.subtitle).toBe(
      'All paid plans include monthly credits for hosted Consuelo usage.',
    );
    expect(pricingContent.pricingPlans.map((plan) => plan.name)).toEqual([
      'Free',
      'Plus',
      'Super',
      'Ultra',
    ]);
    expect(pricingContent.pricingPlans.map((plan) => plan.imageLabel)).toEqual([
      'NO LOCK-IN',
      'STAYS LOCKED',
      'READ RECEIPTS',
      'READ RECEIPTS',
    ]);
    expect(pricingContent.pricingPlans.map((plan) => plan.price)).toEqual(['$0', '$20', '$100', '$200']);
    expect(pricingContent.pricingPlans.filter((plan) => plan.highlight).map((plan) => plan.name)).toEqual([
      'Plus',
    ]);
    expect(pricingContent.pricingPlans.every((plan) => plan.bullets.length === 4)).toBe(true);
    expect(siteLinks.pricing).toBe('/pricing');
    expect(siteLinks.pricing).not.toBe(siteLinks.mercury);
    expect(siteLinks.login).toBe('https://os.consuelohq.com/');
    expect(pricingContent.pricingAccountLink.href).toBe(siteLinks.login);

    expect(navigation.siteHeaderLinks.map((link) => link.href)).not.toContain('/pricing');
    expect(navigation.siteMobileMenuLinks.map((link) => link.href)).not.toContain('/pricing');
    expect(navigation.footerLinks.map((link) => link.href)).not.toContain('/pricing');
  });

  test('should support weekly changelog entries while preserving legacy entries', () => {
    const changelog = readSource('src/pages/changelog.astro');

    expect(changelog).toContain('type ChangelogWeek');
    expect(changelog).toContain('item.weeks');
    expect(changelog).toContain("set:html={item.text ?? ''}");
    expect(changelog).toContain('cl-week__header');
    expect(changelog).toContain('overflow-wrap: anywhere');
    expect(changelog).toContain('grid-template-columns: 160px minmax(0, 1fr)');
  });

  test('should compose the approved Consuelo OS homepage when rendering the public root', () => {
    const homepage = readSource('src/pages/index.astro');

    expect(homepage).toContain("../layouts/MarketingLayout.astro");
    expect(homepage).toContain("../components/site/SiteHeader.astro");
    expect(homepage).toContain("../components/site/SiteFooter.astro");
    expect(homepage).toContain("../components/home/HomeHero.astro");
    expect(homepage).toContain("../components/home/HomeFeaturePreview.astro");
    expect(homepage).toContain("../components/home/HomeCloudCta.astro");
    expect(homepage).toContain('getFaqSchema(homeFaqItems)');
    expect(homepage).toContain('Consuelo OS | Your workspace, connected to every agent');
    expect(homepage).not.toContain('HomePlatformCards');
  });

  test('should expose auth and the released installer when rendering the hero', () => {
    const hero = readSource('src/components/home/HomeHero.astro');
    const content = readSource('src/data/home-content.ts');

    expect(hero).toContain('YOUR WORKSPACE, CONNECTED TO EVERY AGENT.');
    expect(hero).toContain('Build it once. Use it from ChatGPT, Codex, Claude, and whatever comes next.');
    expect(hero).toContain('OPEN SOURCE');
    expect(hero).toContain('MIT LICENSE');
    expect(hero).toContain('SIGN IN');
    expect(hero).toContain('DOWNLOAD LOCALLY');
    expect(content).toContain("export const INSTALL_COMMAND = 'curl -fsSL https://install.consuelohq.com/os | bash'");
    expect(content).toContain('value: INSTALL_COMMAND');
    expect(hero).toContain("import { INSTALL_COMMAND } from '../../data/home-content'");
    expect(hero).toContain('<span data-copy-label>DOWNLOAD LOCALLY</span>');
    expect(hero).toContain('data-copy-install');
    expect(hero).toContain('if (!navigator.clipboard)');
    expect(hero).toContain('await navigator.clipboard.writeText(INSTALL_COMMAND)');
    expect(hero).toContain('catch');
    expect(hero).toContain("label.textContent = 'COPIED'");
    expect(hero).toContain('prefers-reduced-motion: reduce');
  });

  test('should use the approved Hermes blue and real open font stack when loading marketing tokens', () => {
    const tokens = readSource('src/styles/tokens.css');

    expect(tokens).toContain("@import '@fontsource-variable/bodoni-moda'");
    expect(tokens).toContain("@import '@fontsource-variable/inter'");
    expect(tokens).toContain("--site-color-brand: #0000F2");
    expect(tokens).toContain("--site-color-paper: #0000F2");
    expect(tokens).toContain("'Bodoni Moda Variable'");
    expect(tokens).toContain("'Inter Variable'");
    expect(tokens).toContain("'Geist Mono'");
    expect(tokens).not.toContain('#5379AE');
  });

  test('should provide a compact six-feature media grid and accessible FAQ when rendering the product panel', () => {
    const panel = readSource('src/components/home/HomeFeaturePreview.astro');
    const media = readSource('src/components/home/FeatureMedia.astro');
    const faq = readSource('src/components/home/HomeFaq.astro');
    const content = readSource('src/data/home-content.ts');

    expect(panel).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(panel).toContain('<FeatureMedia');
    expect(panel).toContain('imageSrc={item.assetSrc}');
    expect(panel).not.toContain("item.assetSrc ?? ''");
    expect(panel).toContain('<HomeFaq');
    expect(media).toContain('aspect-ratio: 475 / 178');
    expect(media).toContain('<video autoplay muted loop playsinline');
    expect(media).toContain('class="feature-media__poster"');
    expect(media).toContain('.feature-media__video');
    expect(media).toContain('display: none;');
    expect(faq).toContain('<details>');
    expect(faq).toContain('<summary>');
    expect(faq).toContain('color: var(--site-color-muted);');
    expect(panel).toContain('color: var(--site-color-muted);');
    expect(panel).not.toContain('#15156f');
    expect(faq).not.toContain('#25256f');
    expect(content).toContain('assetSrc: string;');
    expect(content).toContain("label: 'CONTROL'");
    expect(content).toContain("label: 'OBSERVE'");
    expect(content).toContain("label: 'SWITCH'");
  });

  test('should expose the approved navigation when rendering the OS header', () => {
    const header = readSource('src/components/site/SiteHeader.astro');

    expect(header).toContain('CONSUELO');
    expect(header).toContain('DOCS');
    expect(header).toContain('PRICING');
    expect(header).toContain('CLOUD');
    expect(header).toContain('aria-label="Discord"');
    expect(header).toContain('aria-label="GitHub"');
    expect(header).toContain('data-mobile-menu-toggle');
    expect(header).toContain("menu.querySelectorAll('a')");
    expect(header).toContain('closeMenu');
    expect(header).not.toContain('PORTAL');
    expect(header).not.toContain('INSTALL');
    expect(header).not.toContain('position: sticky;');
    expect(header).not.toContain('position: fixed;');
  });

  test('should preserve SEO layout wiring and critical site links when data modules are split', async () => {
    const layout = readSource('src/layouts/MarketingLayout.astro');
    expect(layout).toContain("../components/SeoHead.astro");
    expect(layout).toContain("../lib/site-seo");
    expect(layout).toContain("../config/analytics");

    const seoHead = readSource('src/components/SeoHead.astro');
    expect(seoHead).toContain('../lib/site-seo');
    expect(seoHead).toContain('application/ld+json');

    const siteSeo = readSource('src/lib/site-seo.ts');
    expect(siteSeo).toContain("themeColorDark: '#0000F2'");

    const { siteLinks, ghlMarketplaceUrl } = await import(pathToFileURL(join(sourceRoot, 'data/site-links.ts')).href);
    expect(siteLinks.app).toBe('https://app.consuelohq.com');
    expect(siteLinks.login).toBe('https://os.consuelohq.com/');
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
    expect(navigation.homePageSections.every((section) => typeof section.id === 'string')).toBe(true);
  });

  test('should preserve review-comment contracts when validating marketing data and route behavior', async () => {
    expectFile('src/data/contact-content.ts');

    const homeFaq = readSource('src/components/home/HomeFaq.astro');
    expect(homeFaq).toContain('<p>{item.answer}</p>');
    expect(homeFaq).not.toContain('set:html={item.answer}');

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

  test('should expose package-level design context when agents work on the website', () => {
    const requiredFiles = [
      'packages/consuelo-website/AGENTS.md',
      'packages/consuelo-website/DESIGN.md',
      'packages/consuelo-website/animations.md',
      'packages/consuelo-website/src/styles/tokens.css',
      'packages/consuelo-website/src/styles/primitives.css',
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(repoRoot, file)), file).toBe(true);
    }

    expect(existsSync(join(repoRoot, 'packages/consuelo-website/AGENT-SPECS.md'))).toBe(false);

    const agentRules = readRepo('packages/consuelo-website/AGENTS.md');
    expect(readRepo('areas/website/AGENTS.md')).toBe(agentRules);
    expect(agentRules).toContain('DESIGN.md');
    expect(agentRules).toContain('animations.md');
    expect(agentRules).toContain('tokens.css');
    expect(agentRules).toContain('primitives.css');
    expect(agentRules).toContain('MarketingLayout.astro');
    expect(agentRules).not.toContain('Foxi');
    expect(agentRules).not.toContain('cookie consent');
    expect(agentRules).not.toContain('Tailwind v4');
    expect(agentRules).not.toContain('SiteLayout.astro');

    const design = readRepo('packages/consuelo-website/DESIGN.md');
    expect(design).toContain('blue editorial system');
    expect(design).toContain('#0000F2');
    expect(design).toContain('Bodoni Moda Variable');
    expect(design).toContain('tokens.css');
    expect(design).toContain('primitives.css');
    expect(design).toContain('Do not invent');

    const tokens = readRepo('packages/consuelo-website/src/styles/tokens.css');
    expect(tokens).toContain('--site-color-paper');
    expect(tokens).toContain('--site-color-ink');
    expect(tokens).toContain('--site-color-accent');
    expect(tokens).toContain('--site-color-on-brand');
    expect(tokens).toContain('--site-space-section');
    expect(tokens).toContain('--site-radius-card');
    expect(tokens).not.toContain('@media (prefers-color-scheme: dark)');
    expect(tokens).toContain("--site-font-display: 'Bodoni Moda Variable'");
    expect(tokens).toContain("--site-font-body: 'Inter Variable'");
    expect(tokens).toContain("--site-font-mono: 'Geist Mono'");
    expect(tokens).not.toContain("'displayFont'");
    expect(tokens).not.toContain("'monoFont'");

    const primitives = readRepo('packages/consuelo-website/src/styles/primitives.css');
    expect(primitives).toContain('.site-container');
    expect(primitives).toContain('.site-section');
    expect(primitives).toContain('.site-button');
    expect(primitives).toContain('.site-card');
    expect(primitives).toContain('.site-stack');
    expect(primitives).toContain('.site-cluster');
    expect(primitives).toContain('.site-field:focus-visible');
    expect(primitives).toContain('outline: 2px solid var(--site-color-accent);');
    expect(primitives).not.toContain('outline: none;');
  });

  test('should resolve every Consuelo design manifest source path used by website agents', () => {
    const manifestPath = 'packages/consuelo-design/design-system/manifest.json';
    const manifest = JSON.parse(readRepo(manifestPath));
    const designPackageRoot = join(repoRoot, 'packages/consuelo-design');
    const roles = manifest.sourceOfTruth.map((entry) => entry.role);

    expect(roles).toEqual([
      'visual-design',
      'motion-design',
      'website-agent-rules',
      'website-design-tokens',
      'website-css-primitives',
      'design-tooling-agent-rules',
    ]);

    for (const entry of manifest.sourceOfTruth) {
      const resolvedPath = resolve(designPackageRoot, entry.path);
      expect(existsSync(resolvedPath), `missing manifest source path for ${entry.role}: ${entry.path}`).toBe(true);
    }

    expect(manifest.upstreamDesignSystemsPolicy).toContain('Do not import upstream/open-design/design-systems');
    expect(JSON.stringify(manifest.sourceOfTruth)).not.toContain('upstream/open-design/design-systems/warm-editorial');
  });

  test('should load and consume website design tokens and primitives through the marketing layout', () => {
    const layout = readSource('src/layouts/MarketingLayout.astro');
    expect(layout).toContain("../styles/tokens.css");
    expect(layout).toContain("../styles/primitives.css");
    expect(layout).not.toContain('upstream/open-design/design-systems');
    expect(layout).not.toContain('--launch-');
    expect(layout).not.toContain('var(--launch-');
    expect(layout).toContain('var(--site-color-paper)');
    expect(layout).toContain('var(--site-color-ink)');
    expect(layout).toContain('var(--site-font-mono)');
    expect(layout).toContain('var(--site-color-line)');
  });

  test('should keep the design operator contract on office headless defaults', () => {
    const agentRules = readRepo('areas/consuelo-design/AGENTS.md');
    expect(agentRules).toContain('Default `office.generate*` behavior');
    expect(agentRules).toContain('For `office.generateDigitalEguide`, use:');
    expect(agentRules).toContain('`generate <workflow>` returns a headless work order by default');
    expect(agentRules).toContain('Only `generate <workflow> --live` or an explicit `live: true` input starts a live Open Design working session');
    expect(agentRules).toContain('Only the live UI path should use project.pendingPrompt.');
    expect(agentRules).not.toContain('consueloDesign.generateDigitalEguide');
    expect(agentRules).not.toContain('means start/create/open a live Open Design working session');
    expect(agentRules).not.toContain('If a command says `generate website`, it should start or reuse Open Design');
  });
});
