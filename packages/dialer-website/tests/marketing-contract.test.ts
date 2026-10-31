import { describe, expect, it } from 'bun:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pricingPlans } from '../src/data/pricing-content';
const root = resolve(import.meta.dir, '..');
const page = (path = '') =>
  readFileSync(resolve(root, 'dist', path, 'index.html'), 'utf8');
describe('Dialer marketing delivery', () => {
  it('redirects legacy device login to the canonical OS authority without duplicating its UI', () => {
    expect(existsSync(resolve(root, 'src/pages/login/device.astro'))).toBe(
      false,
    );
    const redirects = readFileSync(resolve(root, 'public/_redirects'), 'utf8');
    for (const path of ['/login/device', '/login/device/']) {
      expect(redirects).toContain(
        `${path} https://os.consuelohq.com/login/device 302`,
      );
    }
  });
  it('preserves the legacy OS feed URL when Dialer owns the root', () => {
    expect(readFileSync(resolve(root, 'public/_redirects'), 'utf8')).toContain(
      '/rss.xml https://os.consuelohq.com/about/rss.xml 302',
    );
  });
  it('preserves every displaced static OS page through the migration map', () => {
    const collect = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory()
          ? collect(path)
          : path.endsWith('.astro')
            ? [path]
            : [];
      });
    const routes = (directory: string) =>
      collect(directory)
        .map(
          (path) =>
            '/' +
            relative(directory, path)
              .replaceAll('\\', '/')
              .replace(/\.astro$/, '')
              .replace(/(^|\/)index$/, ''),
        )
        .map((route) => route.replace(/\/$/, '') || '/');
    const owned = new Set(routes(resolve(root, 'src/pages')));
    const patterns = readFileSync(resolve(root, 'public/_redirects'), 'utf8')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split(/\s+/)[0]);
    const matches = (route: string) =>
      patterns.some((pattern) =>
        pattern.includes('*')
          ? route.startsWith(pattern.split('*')[0])
          : route === pattern,
      );
    const displaced = routes(
      resolve(root, '../consuelo-website/src/pages'),
    ).filter(
      (route) => route !== '/404' && !route.includes('[') && !owned.has(route),
    );
    expect(displaced.length).toBeGreaterThan(5);
    expect(displaced.filter((route) => !matches(route))).toEqual([]);
    for (const route of ['/tags/ai/', '/og/example.png'])
      expect(matches(route), route).toBe(true);
  });
  it('publishes product-owned sitemaps without authentication or OS URLs', () => {
    const production = process.env.PUBLIC_SITE_CHANNEL === 'production';
    const origin = production
      ? 'https://consuelohq.com'
      : 'https://consuelo-dialer-website-preview.pages.dev';
    const index = readFileSync(resolve(root, 'dist/sitemap-index.xml'), 'utf8');
    const sitemap = readFileSync(resolve(root, 'dist/sitemap-0.xml'), 'utf8');
    expect(index).toContain(origin + '/sitemap-0.xml');
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname.replace(/\/$/, '') || '/',
    );
    for (const path of ['/', '/pricing', '/get-started'])
      expect(paths).toContain(path);
    expect(paths).not.toContain('/guides');
    expect(
      paths.some((path) => /^\/(calls|login|about|404)(\/|\.|$)/.test(path)),
    ).toBe(false);
    expect(sitemap).not.toContain('os.consuelohq.com');
    expect(
      readFileSync(resolve(root, 'public/_redirects'), 'utf8'),
    ).not.toMatch(/^\/sitemap-(?:index|0)\.xml\s/m);
    const robots = readFileSync(resolve(root, 'dist/robots.txt'), 'utf8');
    if (production)
      expect(robots).toContain(
        'Sitemap: https://consuelohq.com/sitemap-index.xml',
      );
  });
  it('publishes paid product metadata without an inherited free offer', () => {
    const entries = [
      ...page().matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ].flatMap((match) => {
      const value = JSON.parse(match[1]);
      return value['@graph'] ?? [value];
    });
    const application = entries.find(
      (entry) => entry['@type'] === 'SoftwareApplication',
    );
    expect(application?.name).toBe('Consuelo Dialer');
    if (application?.offers) {
      const listedPrices = pricingPlans.map((plan) =>
        Number(plan.price.replace('$', '')),
      );
      expect(listedPrices).toContain(Number(application.offers.price));
    }
  });

  it('restores the current pricing share image from committed source bytes', async () => {
    const sharp = (await import('sharp')).default;
    const name = 'consuelo-dialer-pricing-og-20261030.png';
    const bytes = readFileSync(resolve(root, 'dist', name));
    const encoded = readFileSync(
      resolve(root, 'assets/encoded', name + '.base64'),
      'utf8',
    );
    expect(bytes.equals(Buffer.from(encoded.trim(), 'base64'))).toBe(true);
    const metadata = await sharp(bytes).metadata();
    expect([metadata.width, metadata.height]).toEqual([1200, 630]);
    expect(page('pricing')).toContain(name);
  });
  it('ships decodable generated application icons', async () => {
    const sharp = (await import('sharp')).default;
    for (const [name, size] of [
      ['favicon-32x32.png', 32],
      ['apple-touch-icon.png', 180],
    ] as const) {
      const metadata = await sharp(resolve(root, 'dist', name)).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
    }
  });
  it('has its own package and an isolated preview deployment', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const config = JSON.parse(
      readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8'),
    );
    expect(pkg.name).toBe('consuelo-dialer-website');
    expect(config.name).toBe('consuelo-dialer-website-preview');
    expect(config.routes).toBeUndefined();
    expect(config.pages_build_output_dir).toBe('./dist');
    expect(existsSync(resolve(root, 'functions'))).toBe(false);
  });
  it('renders the Dialer funnel without OS installation or authentication links', () => {
    const html = page();
    expect(html).toContain('Consuelo Dialer');
    expect(html).toContain('GET STARTED');
    expect(html).toContain('live conversations');
    expect(html).not.toContain('install.consuelohq.com');
    expect(html).not.toContain('href="https://os.consuelohq.com');
    expect(html).not.toContain('curl -');
    expect(html).not.toContain('CONSUELO OS');
  });
  it('renders four approved launch plans and a plan-specific setup journey', () => {
    const html = page('pricing');
    expect((html.match(/data-plan-code=/g) ?? []).length).toBe(4);
    for (const code of ['starter', 'professional', 'agency', 'enterprise']) {
      expect(html).toContain(`/get-started?plan=${code}`);
    }
    for (const amount of ['$99', '$149', '$199'])
      expect(html).toContain(amount);
    expect(html).not.toContain('SUBSCRIBE');
    expect(page('get-started')).toContain('data-purchase-panel');
    expect(page('get-started')).not.toContain('data-checkout-form');
  });
  it('ships real destinations for public navigation and a preview indexing boundary', () => {
    for (const route of [
      'pricing',
      'get-started',
      'how-it-works',
      'contact',
      'privacy',
      'terms',
    ]) {
      expect(existsSync(resolve(root, 'dist', route, 'index.html'))).toBe(true);
    }
    for (const route of [
      '',
      'pricing',
      'get-started',
      'how-it-works',
      'contact',
      'privacy',
      'terms',
      'support',
    ]) {
      expect(page(route)).toContain('href="https://docs.consuelohq.com/"');
      expect(page(route)).not.toMatch(/href="\/guides(?:[\/?#"])/);
    }
    expect(existsSync(resolve(root, 'dist/guides/index.html'))).toBe(false);
    const redirects = readFileSync(resolve(root, 'public/_redirects'), 'utf8');
    for (const route of ['/guides', '/guides/', '/docs', '/docs/']) {
      expect(redirects).toContain(`${route} https://docs.consuelohq.com/ 301`);
    }
    const production = process.env.PUBLIC_SITE_CHANNEL === 'production';
    expect(readFileSync(resolve(root, 'dist', 'robots.txt'), 'utf8')).toContain(
      production ? 'Allow: /' : 'Disallow: /',
    );
    expect(page()).toContain(production ? 'index,follow' : 'noindex');
    expect(page()).toContain(
      `rel="canonical" href="${production ? 'https://consuelohq.com' : 'https://consuelo-dialer-website-preview.pages.dev'}/"`,
    );
  });
});
