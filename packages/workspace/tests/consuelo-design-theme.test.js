import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../scripts/consuelo-design.ts', import.meta.url), 'utf8');

test('keeps the generated sites archive theme and search surfaces styled', () => {
  for (const marker of [
    '--paper:#f6efe4',
    '--ink:#251d17',
    '@media (prefers-color-scheme: dark)',
    '--paper:#0f0f0d',
    '--ink:#f2eee6',
    '.search-input::placeholder',
    '.pagefind-ui__result-excerpt mark',
  ]) {
    expect(source).toContain(marker);
  }
});

test('keeps design wiki page publishes versioned and rollback-safe', () => {
  for (const marker of [
    'type DesignArchivePageVersion = {',
    'type DesignArchivePage = {',
    'version: 2;',
    'pages: Record<string, DesignArchivePage>;',
    'function archiveVersionIdFromDate',
    'function archiveVersionRelativeArtifactPath',
    'function archiveCurrentRelativeArtifactPath',
    'function normalizeArchivePayload',
    'function renderVersionHistoryPage',
    'currentVersionId',
    'previousVersionId',
    'versions: [version, ...previousVersions]',
    'data-version-count',
    'function entryForVersionRoute',
    '/versions/',
    'Archived versions',
  ]) {
    expect(source).toContain(marker);
  }
});

test('emits valid generated version-history server strings', () => {
  expect(source).toContain(`'<li><a href="' + safe(version.path) + '">'`);
  expect(source).toContain(`data-version-count="' + versions.length + '"><main`);
  expect(source).toContain('char === ">" ? "&gt;" : "&quot;"');
});

test('restarts generated archive server after rewriting it', () => {
  expect(source).toContain("writeArchiveServer(ip);\n  const target = `http://${ip}:${DESIGN_ARCHIVE_PORT}`;\n  await stopArchiveServer();");
});

test('guards design wiki publishes against stale page revisions', () => {
  for (const marker of [
    'baseVersion?: string;',
    'forcePublish: boolean;',
    "--base-version",
    "--base-revision",
    "--force-publish",
    'function currentArchiveVersionForPath',
    'function assertArchiveRevisionWritable',
    'stale design wiki publish rejected',
    'requiredBaseVersion',
    'currentVersionId',
  ]) {
    expect(source).toContain(marker);
  }
});


test('polishes design archive into the sites shell with filtering and command palette', () => {
  for (const marker of [
    "const DESIGN_ARCHIVE_LEGACY_PATH = '/design-wiki';",
    "const DESIGN_ARCHIVE_PATH = '/sites';",
    "https://sites.consuelohq.com",
    '<title>Consuelo Sites</title>',
    'Consuelo Sites',
    '<h1>Office</h1>',
    'Private tailnet sites, guides, and published artifacts from Consuelo.',
    'data-filter="guide"',
    'data-filter="spec"',
    'data-filter="plan"',
    'data-filter="uncategorized"',
    'data-command-palette',
    'Keyboard Cockpit',
    'Slash opens this menu. Press G, then a command letter, to jump directly.',
    "window.open(href, '_blank', 'noopener,noreferrer')",
    "target=\"_blank\" rel=\"noopener noreferrer\"",
    "location.hash = activeFilter === 'all' ? '' : activeFilter;",
    'font-family: "Geist Mono", "Geist", ui-monospace',
    'archivePaths',
    'legacyArchivePath',
  ]) {
    expect(source).toContain(marker);
  }
});


test('generates archive server slash aliases without regex escaping drift', () => {
  expect(source).toContain('const cleanArchivePath = url.pathname.endsWith("/") && url.pathname !== "/" ? url.pathname.slice(0, -1) : url.pathname;');
  expect(source).toContain('cleanArchivePath === archivePath');
  expect(source).toContain('cleanArchivePath === legacyArchivePath');
});


test('keeps archive search data parseable as raw JSON for client interactions', () => {
  expect(source).toContain('const searchDataJson = JSON.stringify(searchEntries)');
  expect(source).toContain('<script type="application/json" id="archive-search-data">${searchDataJson}</script>');
  expect(source).not.toContain('id="archive-search-data">${escapeHtml(JSON.stringify(searchEntries))}</script>');
});

test('routes public Sites root to Office and points Documentation to the public blog', () => {
  for (const marker of [
    "const DESIGN_ARCHIVE_OFFICE_PATH = '/office';",
    "const DESIGN_ARCHIVE_DOCS_URL = 'https://consuelohq.com/blog/';",
    'function renderArchiveRootRedirect',
    'rootRedirectPath',
    'officePath',
    'Bun.file(rootRedirectPath)',
    'Bun.file(indexPath)',
    '<a href="${escapeHtml(DESIGN_ARCHIVE_DOCS_URL)}" target="_blank" rel="noopener noreferrer">Documentation</a>',
    "{ key: 'D', title: 'Documentation', description: 'Open the Consuelo blog.', kind: 'link', url: '${escapeHtml(DESIGN_ARCHIVE_DOCS_URL)}' }",
  ]) {
    expect(source).toContain(marker);
  }
});


