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
  expect(source).toContain(`safe(officePathFor(version.path))`);
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
  expect(source).toContain('archivePaths.includes(url.pathname)');
  expect(source).toContain('archivePaths.includes(cleanArchivePath)');
});


test('keeps public Sites root launcher and Office archive routes distinct', () => {
  for (const marker of [
    "const DESIGN_ARCHIVE_OFFICE_PATH = '/office';",
    "const DESIGN_DOCS_URL = 'https://docs.consuelohq.com/';",
    "const DESIGN_DECISION_INFRASTRUCTURE_URL = '/writing/on-decision-loops';",
    'function officePathForArchiveEntry',
    'function renderSitesLauncher',
    'CONSUELO OS █',
    'CONTACT:</span> SUPPORT@CONSUELOHQ.COM',
    'SITES:',
    '[Office](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}"',
    '[Tracing](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing"',
    '[Diffs](</span><a href="https://diffs.consuelohq.com"',
    '${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs</a>',
    '[GTM](</span><a href="https://app.consuelohq.com/welcome"',
    '${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/gtm</a>',
    '[Documentation](</span><a href="${DESIGN_DOCS_URL}"',
    'WRITING:',
    'On Decision Loops',
    'const officeArchivePath = ',
    'const archivePaths = Array.from(new Set([officeArchivePath, archivePath, legacyArchivePath]));',
    'function stripArtifactAlias',
    'if (url.pathname === "/") return new Response(renderSitesLauncher()',
    'const canonicalPathname = stripArtifactAlias(routePathname);',
  ]) {
    expect(source).toContain(marker);
  }
});


test('keeps archive search data parseable as raw JSON for client interactions', () => {
  expect(source).toContain('const searchDataJson = JSON.stringify(searchEntries)');
  expect(source).toContain('<script type="application/json" id="archive-search-data">${searchDataJson}</script>');
  expect(source).not.toContain('id="archive-search-data">${escapeHtml(JSON.stringify(searchEntries))}</script>');
});

test('keeps root launcher copy and Office archive chrome separated', () => {
  for (const marker of [
    "const DESIGN_DOCS_URL = 'https://docs.consuelohq.com/';",
    "const DESIGN_DECISION_INFRASTRUCTURE_URL = '/writing/on-decision-loops';",
    'CONSUELO OS █',
    'SITES:',
    'WRITING:',
    '[Office](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}"',
    '[Tracing](</span><a href="${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing"',
    '[Diffs](</span><a href="https://diffs.consuelohq.com"',
    '${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs</a>',
    '[GTM](</span><a href="https://app.consuelohq.com/welcome"',
    '${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/gtm</a>',
    '[Documentation](</span><a href="${DESIGN_DOCS_URL}"',
    'On Decision Loops',
    '<a class="brand" href="${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}">Office</a>',
  ]) {
    expect(source).toContain(marker);
  }
  expect(source).not.toContain('Legacy wiki</a></div>');
});

test('keeps launcher routes local and theme-aware', () => {
  for (const marker of [
    'color-scheme: dark',
    'background: #070708',
    'color: #f2eee6',
    'color: #9aa6ff',
    'function publicRouteAlias',
    'if (clean === "/tracing") return "/trace-burn-intelligence";',
    'function proxyDiffsRoute',
    'https://diffs.consuelohq.com',
    "['/diffs', `${target}/diffs`]",
    'const routePathname = publicRouteAlias(url.pathname);',
    'const canonicalPathname = stripArtifactAlias(routePathname);',
  ]) {
    expect(source).toContain(marker);
  }
  expect(source).not.toContain('/writing/on-rendering-diffs');
  expect(source).toContain('font-weight: 400');
  expect(source).toContain('letter-spacing: 0.02em');
  expect(source).toContain('white-space: nowrap');
  expect(source).toContain('class="blog-item"');
  expect(source).toContain('font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  expect(source).toContain('.md-label { color: #f2eee6; }');
  expect(source).not.toContain('min-height: 100vh; background: Canvas; color: CanvasText; font-size: 13px; line-height: 1.25; font-weight: 700');
  expect(source).not.toContain('Software Is Becoming Decision Infrastructure</a></li>');
});

test('keeps launcher compact but tappable on phone and tablet viewports', () => {
  for (const marker of [
    '@media (max-width: 1024px)',
    'font-size: clamp(10.5px, 2.68vw, 13px)',
    'main { padding: clamp(20px, 4.8vw, 32px) clamp(10px, 2.5vw, 24px); }',
    '.block { margin: 24px 0; }',
    '.rule { margin: 24px 0; }',
    'li { margin: 2.2px 0; }',
    '@media (max-width: 430px)',
    'font-size: clamp(10.1px, 2.47vw, 11.8px)',
    'li, .blog-item { white-space: nowrap; }',
  ]) {
    expect(source).toContain(marker);
  }
  expect(source).not.toContain('.blog-item { white-space: normal;');
});
