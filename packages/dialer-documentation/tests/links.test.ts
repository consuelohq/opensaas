import { expect, it } from 'bun:test';
import { collectInvalidDocumentationLinks } from '../scripts/lib/docs-links.mjs';

it('resolves relative Markdown and HTML destinations against the source page route', () => {
  const routes = new Set(['/', '/start/', '/inbound/readiness/', '/inbound/routing/']);
  const input = [
    '[working sibling](../routing/)', '[missing sibling](../missing/)',
    '<a href="./gone/">Missing nested page</a>',
    '[start](/start/)', '[missing root](/unknown/)',
    '[public asset](/favicon.svg)', '[external](https://example.org/docs/)',
    '[anchor](#details)', '<a href="mailto:help@example.org">Email</a>',
  ].join('\n');
  const invalid = collectInvalidDocumentationLinks(input, '/inbound/readiness/', {
    routes,
    assetExists: (path) => path === '/favicon.svg',
  });
  expect(invalid).toEqual(['../missing/', './gone/', '/unknown/']);
});

it('preserves root-route, local query/fragment and external URL behavior', () => {
  const routes = new Set(['/', '/outbound/']);
  expect(collectInvalidDocumentationLinks([
    '[root](/)', '[working](./?mode=copy#top)',
    '<a href="/outbound/">Outbound</a>',
    '[external](//example.org/path)', '[email](mailto:test@example.org)',
    '[anchor](#install)',
  ].join('\n'), '/outbound/', { routes, assetExists: () => false })).toEqual([]);
});
