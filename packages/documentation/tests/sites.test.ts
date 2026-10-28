import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const packageFile = (path: string) => new URL(`../${path}`, import.meta.url);
const repoFile = (path: string) => new URL(`../../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(packageFile(path), 'utf8');

const sitesPages = [
  ['sites/index.mdx', 'Overview'],
  ['sites/create-a-site.mdx', 'Create a site'],
  ['sites/pages-and-content.mdx', 'Pages and content'],
  ['sites/preview-locally.mdx', 'Preview locally'],
  ['sites/publish.mdx', 'Publish'],
  ['sites/domains.mdx', 'Domains'],
  ['sites/troubleshooting.mdx', 'Troubleshooting'],
] as const;

describe('Sites documentation contract', () => {
  test('publishes the complete approved Sites hierarchy in navigation order', () => {
    const navigation = read('src/lib/docs-navigation.ts');
    const orderedLabels = [
      "label: 'Overview', slug: 'sites'",
      "label: 'Create a site'",
      "label: 'Pages and content'",
      "label: 'Preview locally'",
      "label: 'Publish'",
      "label: 'Domains'",
      "label: 'Troubleshooting'",
    ];
    let previousIndex = -1;
    for (const needle of orderedLabels) {
      const currentIndex = navigation.indexOf(needle, previousIndex + 1);
      expect(currentIndex).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    }
    for (const [sourcePath] of sitesPages) {
      expect(existsSync(packageFile(`src/content/docs/${sourcePath}`))).toBe(true);
    }
  });

  test('marks every Sites page as preview and records current evidence', () => {
    for (const [sourcePath] of sitesPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      expect(source).toContain('status: preview');
      expect(source).toContain('verifiedAt: 2026-07-13');
      expect(source).toContain('evidence:');
      expect(source).toContain('source:');
      expect(source).toContain('tests:');
      expect(source).toContain('runtime:');
      expect(source).not.toContain('Use this section to move from workspace content');
    }
  });

  test('references evidence files that exist in the current repository', () => {
    for (const [sourcePath] of sitesPages) {
      const source = read(`src/content/docs/${sourcePath}`);
      const evidencePaths = [
        ...source.matchAll(/^\s*- source: (packages\/[^\n]+)$/gm),
        ...source.matchAll(/^\s+- (packages\/[^\n]+)$/gm),
      ].map((match) => match[1]);
      expect(evidencePaths.length).toBeGreaterThan(0);
      for (const evidencePath of evidencePaths) {
        expect(existsSync(repoFile(evidencePath))).toBe(true);
      }
    }
  });

  test('teaches the verified local Sites model and command surface', () => {
    const overview = read('src/content/docs/sites/index.mdx');
    expect(overview).toContain('local');
    expect(overview).toContain('artifacts');
    expect(overview).toContain('sites/');
    expect(overview).not.toContain('go-to-market workflows');

    const create = read('src/content/docs/sites/create-a-site.mdx');
    expect(create).toContain('There is no');
    expect(create).toContain('sites create');
    expect(create).toContain('sites render');

    const preview = read('src/content/docs/sites/preview-locally.mdx');
    expect(preview).toContain('sites refresh');
    expect(preview).toContain('sites open');
    expect(preview).toContain('file:');
    expect(preview).toContain('does not start a development server');
  });

  test('documents immutable publishing, typed pages, patches, and leases', () => {
    const pages = read('src/content/docs/sites/pages-and-content.mdx');
    expect(pages).toContain('content.json');
    expect(pages).toContain('spec');
    expect(pages).toContain('plan');
    expect(pages).toContain('guide');
    expect(pages).toContain('SECTION_CONFLICT');
    expect(pages).toContain('LEASE_CONFLICT');

    const publish = read('src/content/docs/sites/publish.mdx');
    expect(publish).toContain('immutable');
    expect(publish).toContain('--base-version');
    expect(publish).toContain('STALE_SITES_PUBLISH');
    expect(publish).toContain('--force-publish');
  });

  test('states the current domain and hosted-publication boundary honestly', () => {
    const domains = read('src/content/docs/sites/domains.mdx');
    expect(domains).toContain('not currently self-service');
    expect(domains).toContain('Consuelo-managed');
    expect(domains).toContain('workspace hostname');
    expect(domains).not.toContain('Add any custom domain');
    expect(domains).toContain('There is no `sites domains add` command');
  });

  test('keeps a checked-in Sites claim ledger and removes the stale GTM umbrella page', () => {
    const ledger = read('evidence/sites-claims.md');
    for (const heading of ['Claim', 'Public page', 'Source code', 'Tests', 'Runtime verification', 'Status']) {
      expect(ledger).toContain(heading);
    }
    expect(ledger).toContain('immutable');
    expect(ledger).toContain('workspace hostname');

    expect(existsSync(packageFile('src/content/docs/tools/sites/overview.mdx'))).toBe(false);
    const redirects = read('src/lib/legacy-redirects.mjs');
    expect(redirects).toContain("'/tools/sites/overview': '/sites/'");
    expect(redirects).not.toContain("'/user-guide/dashboards/overview': '/tools/sites/overview'");
  });
});
