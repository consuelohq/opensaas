import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const read = (name: string) => readFileSync(resolve(root, name), 'utf8');
const contentFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? contentFiles(path) : /\.mdx?$/.test(path) ? [path] : [];
});

describe('standalone Dialer documentation', () => {
  it('has independent package and deployment identities without production bindings', () => {
    expect(existsSync(resolve(root, 'package.json'))).toBe(true);
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.name).toBe('consuelo-dialer-documentation');
    const config = JSON.parse(read('wrangler.jsonc'));
    expect(config.name).toBe('consuelo-dialer-docs');
    expect(config.routes ?? []).toEqual([]);
    expect(config.kv_namespaces ?? []).toEqual([]);
    expect(read('astro.config.mjs')).toContain('Consuelo Dialer');
  });

  it('connects every Dialer sidebar, footer and breadcrumb to authored content', async () => {
    const nav = await import('../src/lib/docs-navigation');
    expect(nav.docsSections.map((section) => section.slug)).toEqual([
      'start', 'outbound', 'inbound', 'team', 'analytics', 'billing', 'troubleshooting', 'reference',
    ]);
    const slugs = new Set(contentFiles(resolve(root, 'src/content/docs')).map((path) =>
      path.replace(resolve(root, 'src/content/docs') + '/', '').replace(/\.mdx?$/, '').replace(/\/index$/, ''),
    ));
    type Item = { slug: string } | { items: Item[] };
    const visit = (items: Item[]) => items.forEach((item) => {
      if ('slug' in item) expect(slugs.has(item.slug)).toBe(true);
      else visit(item.items);
    });
    nav.docsSidebar.forEach((group) => visit(group.items));
    nav.footerSections.forEach((group) => group.links.forEach((link) => expect(slugs.has(link.href.replace(/^\/|\/$/g, ''))).toBe(true)));
    expect(nav.getBreadcrumbs('/outbound/local-presence/').map((crumb) => crumb.label)).toEqual(['Outbound', 'Local presence']);
    expect(slugs.size).toBeGreaterThanOrEqual(20);
  });

  it('keeps OS onboarding out of public pages and preserves honest feature boundaries', () => {
    const sources = contentFiles(resolve(root, 'src/content/docs')).map((path) => readFileSync(path, 'utf8'));
    expect(sources.join('\n')).not.toMatch(/install\.consuelohq\.com|consuelo connect|Install Consuelo OS|zero latency|100% answer/i);
    expect(read('src/content/docs/inbound/index.mdx')).toContain('preview');
    expect(read('src/content/docs/analytics/transcripts.mdx')).toContain('Groq');
    expect(read('src/content/docs/analytics/transcripts.mdx')).toContain('Whisper');
    expect(read('src/content/docs/analytics/transcripts.mdx')).toContain('planned');
    expect(read('src/components/PageTitle.astro')).not.toContain('homeInstallCommand');
  });
});
