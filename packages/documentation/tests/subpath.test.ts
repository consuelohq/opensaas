import { describe, expect, it } from 'bun:test';
import { getBreadcrumbs } from '../src/lib/docs-navigation';
import { pagePathToMarkdownHref } from '../src/lib/markdown-pages';

describe('OS documentation mounted below the auth origin', () => {
  it('keeps legacy root URLs working', () => {
    expect(pagePathToMarkdownHref('/')).toBe('/index.md');
    expect(getBreadcrumbs('/start/install-consuelo-os/').at(-1)?.href).toBe('/start/install-consuelo-os/');
  });
  it('finds the mounted page and keeps breadcrumb destinations in /docs/', () => {
    const crumbs = getBreadcrumbs('/docs/start/install-consuelo-os/', '/docs');
    expect(crumbs.at(-1)?.current).toBe(true);
    expect(crumbs.every((crumb) => !crumb.href || crumb.href.startsWith('/docs/'))).toBe(true);
    expect(crumbs.at(-1)?.href).toBe('/docs/start/install-consuelo-os/');
  });
  it('exports the mounted home and nested pages at their matching Markdown URLs', () => {
    expect(pagePathToMarkdownHref('/docs/', '/docs')).toBe('/docs/index.md');
    expect(pagePathToMarkdownHref('/docs/start/?lang=es#setup', '/docs')).toBe('/docs/start.md');
  });
});
