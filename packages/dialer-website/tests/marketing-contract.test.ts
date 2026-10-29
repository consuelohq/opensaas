import { describe, expect, it } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pricingPlans } from '../src/data/pricing-content';
const root = resolve(import.meta.dir, '..');
const page = (path = '') => readFileSync(resolve(root, 'dist', path, 'index.html'), 'utf8');
describe('Dialer marketing delivery', () => {
  it('redirects legacy device login to the canonical OS authority without duplicating its UI', () => {
    expect(existsSync(resolve(root, 'src/pages/login/device.astro'))).toBe(false);
    const redirects = readFileSync(resolve(root, 'public/_redirects'), 'utf8');
    for (const path of ['/login/device', '/login/device/']) {
      expect(redirects).toContain(`${path} https://os.consuelohq.com/login/device 302`);
    }
  });
  it('preserves the legacy OS feed URL when Dialer owns the root', () => {
    expect(readFileSync(resolve(root, 'public/_redirects'), 'utf8')).toContain('/rss.xml https://os.consuelohq.com/about/rss.xml 302');
  });
  it('publishes paid product metadata without an inherited free offer', () => {
    const entries = [...page().matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .flatMap((match) => { const value = JSON.parse(match[1]); return value['@graph'] ?? [value]; });
    const application = entries.find((entry) => entry['@type'] === 'SoftwareApplication');
    expect(application?.name).toBe('Consuelo Dialer');
    if (application?.offers) {
      const listedPrices = pricingPlans.map((plan) => Number(plan.price.replace('$', '')));
      expect(listedPrices).toContain(Number(application.offers.price));
    }
  });

  it('ships decodable generated application icons', async () => {
    const sharp = (await import('sharp')).default;
    for (const [name, size] of [['favicon-32x32.png', 32], ['apple-touch-icon.png', 180]] as const) {
      const metadata = await sharp(resolve(root, 'dist', name)).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
    }
  });
  it('has its own package and an isolated preview deployment', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const config = JSON.parse(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8'));
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
  it('renders exactly three monthly plans and a plan-specific setup journey', () => {
    const html = page('pricing');
    expect((html.match(/data-plan-code=/g) ?? []).length).toBe(3);
    for (const code of ['single', 'standard', 'power']) {
      expect(html).toContain(`/get-started?plan=${code}`);
    }
    for (const amount of ['$59', '$99', '$159']) expect(html).toContain(amount);
    expect(html).not.toContain('SUBSCRIBE');
    expect(page('get-started')).toContain('data-selected-plan');
  });
  it('ships real destinations for public navigation and a preview indexing boundary', () => {
    for (const route of ['pricing', 'get-started', 'guides', 'how-it-works', 'contact', 'privacy', 'terms']) {
      expect(existsSync(resolve(root, 'dist', route, 'index.html'))).toBe(true);
    }
    const production = process.env.PUBLIC_SITE_CHANNEL === 'production';
    expect(readFileSync(resolve(root, 'dist', 'robots.txt'), 'utf8')).toContain(production ? 'Allow: /' : 'Disallow: /');
    expect(page()).toContain(production ? 'index,follow' : 'noindex');
    expect(page()).toContain(`rel="canonical" href="${production ? 'https://consuelohq.com' : 'https://consuelo-dialer-website-preview.pages.dev'}/"`);
  });
});
