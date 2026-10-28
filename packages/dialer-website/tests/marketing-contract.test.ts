import { describe, expect, it } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dir, '..');
const page = (path = '') => readFileSync(resolve(root, 'dist', path, 'index.html'), 'utf8');
describe('Dialer marketing delivery', () => {
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
    expect(readFileSync(resolve(root, 'dist', 'robots.txt'), 'utf8')).toContain('Disallow: /');
    expect(page()).toContain('noindex');
  });
});
