import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../scripts/office.ts', import.meta.url), 'utf8');

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
  expect(source).toContain("async function ensureArchiveServer(ip: string): Promise<string> {\n  try {\n    writeArchiveServer(ip);\n    const target = `http://${ip}:${DESIGN_ARCHIVE_PORT}`;\n    await stopArchiveServer();");
  expect(source).toContain('failed to ensure Consuelo Sites archive server');
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
    "window.location.assign(href)",
    "location.hash = activeFilter === 'all' ? '' : activeFilter;",
    'font-family: "Geist Mono", "Geist", ui-monospace',
    'archivePaths',
    'legacyArchivePath',
  ]) {
    expect(source).toContain(marker);
  }
  expect(source).toContain('<h3><a href="${escapeHtml(publicUrlForArchiveEntry(entry))}">${escapeHtml(displayTitleForArchiveEntry(entry))}</a></h3>');
  expect(source).toContain("'<h3><a href=\"' + escapeText(href) + '\">'");
  expect(source).not.toContain("window.open(href, '_blank'");
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
    'font-size: clamp(10.3px, 2.62vw, 12.7px)',
    'main { padding: clamp(28px, 5.4vw, 42px) clamp(10px, 2.5vw, 24px); }',
    '.block { margin: 22px 0; }',
    '.rule { margin: 22px 0; }',
    'li { margin: 2.35px 0; }',
    '@media (max-width: 430px)',
    'font-size: clamp(9.9px, 2.42vw, 11.5px)',
    'main { padding: 40px 10px; }',
    'li, .blog-item { white-space: nowrap; }',
  ]) {
    expect(source).toContain(marker);
  }
  expect(source).not.toContain('.blog-item { white-space: normal;');
});



test('tunes mobile launcher closer to the Pierre reference', () => {
  for (const marker of [
    'main { padding: 40px 10px; }',
    'font-size: clamp(9.9px, 2.42vw, 11.5px)',
    '.block { margin: 22px 0; }',
    '.rule { margin: 22px 0; }',
    'li { margin: 2.35px 0; }',
  ]) {
    expect(source).toContain(marker);
  }
});


test('adds numeric launcher hotkeys for Sites navigation', () => {
  for (const marker of [
    'data-hotkey="1"',
    'data-hotkey="2"',
    'data-hotkey="3"',
    'data-hotkey="4"',
    'data-hotkey="5"',
    'const siteHotkeys = {',
    '"1": "https://app.consuelohq.com/welcome"',
    '"2": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}"',
    '"3": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing"',
    '"4": "https://diffs.consuelohq.com"',
    '"5": "${DESIGN_DOCS_URL}"',
    'document.addEventListener("keydown"',
    'window.location.assign(href)',
  ]) {
    expect(source).toContain(marker);
  }
});

test('caches the root launcher at the browser and edge while keeping archive paths conservative', () => {
  for (const marker of [
    'const launcherCacheControl = "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";',
    'function h(type, cache)',
    'cache === "launcher" ? launcherCacheControl : "no-store"',
    'h("text/html; charset=utf-8", "launcher")',
  ]) {
    expect(source).toContain(marker);
  }
});
