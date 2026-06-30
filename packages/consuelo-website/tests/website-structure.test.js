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

  test('should support weekly changelog entries while preserving legacy entries', () => {
    const changelog = readSource('src/pages/changelog.astro');

    expect(changelog).toContain('type ChangelogWeek');
    expect(changelog).toContain('item.weeks');
    expect(changelog).toContain("set:html={item.text ?? ''}");
    expect(changelog).toContain('cl-week__header');
    expect(changelog).toContain('overflow-wrap: anywhere');
    expect(changelog).toContain('grid-template-columns: 160px minmax(0, 1fr)');
  });

  test('should render only the first-pass warm editorial hero baseline on the homepage', () => {
    const homepage = readSource('src/pages/index.astro');
    expect(homepage).toContain("../layouts/MarketingLayout.astro");
    expect(homepage).toContain("../components/site/SiteHeader.astro");
    expect(homepage).toContain("../components/site/SiteFooter.astro");
    expect(homepage).toContain("../components/home/HomeHero.astro");
    expect(homepage).toContain('<MarketingLayout');
    expect(homepage).toContain('<SiteHeader pageSections={[]} />');
    expect(homepage).toContain('<HomeHero sectionId="intro" />');
    expect(homepage).toContain('<SiteFooter');

    [
      'HomeOverview',
      'HomeStats',
      'HomePrivacy',
      'HomeFaq',
      'HomeMercuryPromo',
      'homeFaqItems',
      'homePageSections',
      'bootHomeHeroMotion',
      'bootProofSvgMotion',
      'getFaqSchema',
    ].forEach((oldSurface) => {
      expect(homepage).not.toContain(oldSurface);
    });
  });

  test('should build the homepage hero from the existing SVG asset and website design tokens', () => {
    const hero = readSource('src/components/home/HomeHero.astro');

    expect(hero).toContain('/images/consuelo-integrations-hero.svg?v=20260628-portrait');
    expect(hero).toContain('Give every agent');
    expect(hero).toContain('workspace');
    expect(hero).toContain('<em>superpowers</em>');
    expect(hero).not.toContain('<em>superpowers</em>.');
    expect(hero).toContain('superpowers');
    expect(hero).toContain('BATTERIES INCLUDED');
    expect(hero).toContain('MIT LICENSE');
    expect(hero).toContain('USE CONSUELO OS CLOUD');
    expect(hero).toContain('Go to OS portal');

    expect(hero).toContain('homeTabs.map');
    expect(hero).toContain('role="tablist"');
    expect(hero).toContain('data-tab-button');
    expect(hero).toContain('data-copy-button');

    expect(hero).toContain('site-section');
    expect(hero).toContain('site-container');
    expect(hero).toContain('site-eyebrow');
    expect(hero).toContain('site-card');

    expect(hero).toContain('var(--site-color-paper)');
    expect(hero).toContain('var(--site-color-ink)');
    expect(readSource('src/styles/tokens.css')).toContain('--site-color-accent');
    expect(hero).toContain('var(--site-font-display)');
    expect(hero).toContain('var(--site-font-body)');
    expect(hero).toContain('var(--site-font-mono)');
    expect(hero).toContain('var(--site-space-');
    expect(hero).toContain('var(--site-radius-');
    expect(hero).toContain('box-shadow: var(--site-shadow-control);')

    expect(hero).not.toContain('--launch-');
    expect(hero).not.toContain('#FAF7F2');
    expect(hero).not.toContain('#C0512F');
  });

  test('should tune the homepage hero toward the Hermes-inspired editorial layout', async () => {
    const hero = readSource('src/components/home/HomeHero.astro');
    const layout = readSource('src/layouts/MarketingLayout.astro');
    const svg = readSource('public/images/consuelo-integrations-hero.svg');
    const { homeTabs } = await import(pathToFileURL(join(sourceRoot, 'data/home-content.ts')).href);

    expect(hero).toContain('aria-label="Give every agent workspace superpowers"');
    expect(hero).toContain('<span class="home-hero__title-line home-hero__title-line--desktop" aria-hidden="true">Give every agent</span>');
    expect(hero).toContain('<span class="home-hero__title-line home-hero__title-line--mobile" aria-hidden="true">Give every</span>');
    expect(hero).toContain('<span class="home-hero__title-line home-hero__title-line--mobile" aria-hidden="true">agent</span>');
    expect(hero).toContain('<span class="home-hero__title-line" aria-hidden="true">workspace</span>');
    expect(hero).toContain('<span class="home-hero__title-line" aria-hidden="true"><em>superpowers</em></span>');
    expect(hero).not.toContain('<span class="home-hero__title-line"><em>superpowers</em>.</span>');
    expect(hero).not.toContain('aria-label="Give every agent Give every agent workspace superpowers"');
    expect(hero).toContain("import { prepare, layout } from '@chenglou/pretext';");
    expect(hero).toContain('data-pretext-title');
    expect(hero).toContain('data-pretext-lines');
    expect(hero).toContain('INSTALL VIA TERMINAL');
    expect(hero).toContain('<figure class="home-hero__diagram"');
    expect(hero).not.toContain('<figure class="home-hero__diagram site-card"');
    expect(hero).not.toContain('radial-gradient');
    expect(hero).not.toContain('var(--site-shadow-raised)');

    expect(layout).toContain('width: 100%;');
    expect(layout).not.toContain('border-left: 1px solid var(--site-color-line);');
    expect(layout).not.toContain('border-right: 1px solid var(--site-color-line);');

    expect(homeTabs.map((tab) => tab.label)).toEqual(['macOS / Linux', 'ChatGPT']);
    expect(homeTabs[0].value).toContain('curl -fsSL https://os.consuelohq.com/install.sh | bash');

    expect(svg).toContain('--tile-bg: #FAF7F2;');
    expect(svg).toContain('--wire: rgba(192, 81, 47, 0.28);');
    expect(svg).not.toContain('--tile-bg: #FFFFFF;');
    expect(svg).not.toContain('--label: #0B1F3A;');
    expect(svg).toContain(".label { font: 500 15px 'monoFont', 'monoFont Fallback', 'Courier New', monospace;");
    expect(svg).not.toContain('Inter, ui-sans-serif');
  });

  test('should keep the next hero pass responsive and visually quieter', () => {
    const hero = readSource('src/components/home/HomeHero.astro');

    expect(hero).toContain('grid-template-columns: minmax(0, 35rem) minmax(0, 41rem);');
    expect(hero).toContain('color: var(--site-color-muted);');
    expect(hero).toContain('font-size: clamp(3.35rem, 5.75vw, 6.05rem);');
    expect(hero).toContain('border-radius: calc(var(--site-radius-sm) * 0.25);');
    expect(hero).toContain('@media (max-width: 1180px)');
    expect(hero).toContain('@media (max-width: 860px)');
    expect(hero).toContain('@media (max-width: 560px)');
    expect(hero).not.toContain('font-size: clamp(4.2rem, 8.8vw, 8.5rem);');
    expect(hero).not.toContain('font-size: clamp(2.8rem, 16vw, 4.5rem);');
    expect(hero).not.toContain('max-width: 54rem;');
    expect(hero).not.toContain("'Claude'");
    expect(hero).not.toContain("'Cursor'");
  });

  test('should keep the mobile hero scaled down against the dark office background', () => {
    const hero = readSource('src/components/home/HomeHero.astro');
    const tokens = readSource('src/styles/tokens.css');

    expect(hero).toContain('font-size: clamp(2.95rem, 10vw, 4.7rem);');
    expect(hero).toContain('font-size: clamp(3.35rem, 14.2vw, 4.7rem);');
    expect(hero).toContain('padding-block: clamp(4.75rem, 18vw, 6.5rem) var(--site-space-7);');
    expect(hero).toContain('font-size: clamp(0.64rem, 2.6vw, 0.72rem);');
    expect(hero).toContain('padding: 0.92rem clamp(1rem, 4.2vw, 1.18rem);');

    expect(tokens).toContain('--site-color-dark-paper: #0F0F0D;');
    expect(tokens).toContain('--site-color-dark-surface: #191814;');
    expect(tokens).toContain('--site-color-dark-surface-raised: #221F1A;');
    expect(tokens).toContain('--site-color-dark-control: #191814;');
    expect(tokens).toContain('--site-color-dark-control-panel: #221F1A;');
    expect(tokens).toContain('--site-color-control: var(--site-color-dark-control);');
    expect(tokens).toContain('--site-color-control-panel: var(--site-color-dark-control-panel);');
    expect(tokens).not.toContain('--site-color-dark-paper: #0B0D0C;');
    expect(tokens).not.toContain('--site-color-dark-paper: #211915;');
  });

  test('should keep hero controls bordered, compact, mono, and quiet like the Hermes reference', () => {
    const hero = readSource('src/components/home/HomeHero.astro');
    const tokens = readSource('src/styles/tokens.css');

    expect(hero).toContain('width: fit-content;');
    expect(hero).toContain('border: 1px solid var(--site-color-line);');
    expect(hero).toContain('box-shadow: var(--site-shadow-control);');
    expect(hero).toContain('font-family: var(--site-font-mono);');
    expect(hero).toContain('font-size: var(--site-text-xs);');
    expect(hero).toContain('font-weight: 400;');
    expect(hero).toContain('font: 400 var(--site-text-xs) / 1 var(--site-font-mono);');
    expect(hero).toContain('border-bottom: 1px solid var(--site-color-line);');
    expect(hero).toContain('border-bottom-color: transparent;');
    expect(hero).toContain('width: min(100%, 30rem);');
    expect(hero).toContain('--home-hero-value-size: clamp(0.48rem, 2.1vw, 0.64rem);');
    expect(hero).toContain('gap: clamp(1.45rem, 5.8vw, 2.15rem);');
    expect(hero).toContain('padding: 0.78rem 1.22rem;');
    expect(hero).toContain('gap: clamp(1.55rem, 8.6vw, 2.05rem);');
    expect(hero).toContain('padding: 0.82rem clamp(1rem, 4.2vw, 1.18rem) 0;');
    expect(hero).toContain('padding: 0 0 0.82rem;');
    expect(hero).toContain('padding: 0.92rem clamp(1rem, 4.2vw, 1.18rem);');

    expect(hero).not.toContain('background: color-mix(in srgb, var(--site-color-accent) 7%, transparent);');
    expect(hero).not.toContain('font: 700 var(--site-text-xs) / 1 var(--site-font-mono);');

    expect(tokens).toContain('--site-shadow-control:');
    expect(tokens).toContain('--site-color-control: #FFFFFF;');
    expect(tokens).toContain('--site-color-control-panel: #FBF7F0;');
  });

  test('should include the rebuilt Consuelo OS header contract from the header stream', () => {
    const header = readSource('src/components/site/SiteHeader.astro');
    const packageJson = readSource('package.json');

    expectFile('tests/site-header.test.mjs');
    expect(packageJson).toContain('\"test:header\"');
    expect(header).toContain('data-desktop-header-slot');
    expect(header).toContain('data-mobile-header-slot');
    expect(header).toContain('Consuelo OS');
    expect(header).toContain('Portal');
    expect(header).toContain('Install');
    expect(header).toContain('aria-label="Discord"');
    expect(header).toContain('aria-label="GitHub"');
    expect(header).toContain('launch-header__socials');
    expect(header).not.toContain('launch-header__menu-toggle');
    expect(header).not.toContain('siteMobileMenuLinks');
    expect(header).not.toContain('Login');
    expect(header).not.toContain('Free');
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
    expect(siteSeo).toContain("themeColorDark: '#0F0F0D'");

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
    expect(navigation.homePageSections.every((section) => typeof section.id === 'string')).toBe(true);
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
    expect(design).toContain('Warm editorial');
    expect(design).toContain('#FAF7F2');
    expect(design).toContain('#C0512F');
    expect(design).toContain('tokens.css');
    expect(design).toContain('primitives.css');
    expect(design).toContain('Do not invent');

    const tokens = readRepo('packages/consuelo-website/src/styles/tokens.css');
    expect(tokens).toContain('--site-color-paper');
    expect(tokens).toContain('--site-color-ink');
    expect(tokens).toContain('--site-color-accent');
    expect(tokens).toContain('--site-color-dark-paper');
    expect(tokens).toContain('--site-space-section');
    expect(tokens).toContain('--site-radius-card');
    expect(tokens).toContain('@media (prefers-color-scheme: dark)');
    expect(tokens).toContain("--site-font-display: 'displayFont', 'displayFont Fallback', 'Times New Roman', serif;");
    expect(tokens).toContain('--site-font-body: var(--site-font-display);');
    expect(tokens).toContain("--site-font-mono: 'monoFont', 'monoFont Fallback', 'Courier New', monospace;");
    expect(tokens).not.toContain("--site-font-display: 'Georgia'");
    expect(tokens).not.toContain("--site-font-body: 'Geist'");
    expect(tokens).not.toContain("--site-font-mono: 'Geist Mono'");

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
