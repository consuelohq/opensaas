import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const source = readFileSync(new URL('../scripts/office.ts', import.meta.url), 'utf8');
const launcherSource = readFileSync(new URL('../../os/scripts/lib/launcher-onboarding.ts', import.meta.url), 'utf8');
const rootLauncherSources = `${source}\n${launcherSource}`;

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
    "const DESIGN_DECISION_INFRASTRUCTURE_URL = 'https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/';",
    "const DESIGN_WRITING_DECISION_LOOPS_PATH = '/writing/on-decision-loops';",
    "import { type LauncherLocalAgent, renderLauncherOnboarding } from '../../os/scripts/lib/launcher-onboarding';",
    "import { resolveConsueloHomeLayout } from '../../os/scripts/lib/consuelo-home';",
    'function sitesLauncherMcpUrl',
    'function sitesLauncherLocalAgents',
    "path.join(layout.nodeSecurityGeneratedDir, 'chatgpt-mcp.json')",
    "path.join(layout.home, 'security', 'generated', 'chatgpt-mcp.json')",
    "path.join(layout.legacyOsHome, 'security', 'generated', 'chatgpt-mcp.json')",
    "path.join(layout.home, 'config.json')",
    'https://os.consuelohq.com/mcp',
    'LAUNCHER_AGENT_LABELS',
    'function officePathForArchiveEntry',
    'function renderSitesLauncherHtml',
    'function renderSitesLauncher',
    'renderSitesLauncherHtml({ includeHotkeysScript: true })',
    'return renderSitesLauncherHtml({ includeHotkeysScript: false });',
    'const officeArchivePath = ',
    'const archivePaths = Array.from(new Set([officeArchivePath, archivePath, legacyArchivePath]));',
    'function stripArtifactAlias',
    'if (url.pathname === "/") return new Response(renderSitesLauncher()',
    'const canonicalPathname = stripArtifactAlias(routePathname);',
  ]) {
    expect(source).toContain(marker);
  }

  for (const marker of [
    'href="/careers/systems-engineer">Systems Engineer</a>',
    'Here is the URL to connect <a href="${CHATGPT_CONNECTORS_URL}"',
    'to your workspace.',
    'Sites',
    'Go to market',
    'Artifacts',
    'Observability',
    'Code review',
    'Guides and Tips',
    'Documentation',
    'Writing',
    'Decision loops',
    'No local agents connected to workspace yet.',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
  for (const oldMarker of [
    '[GTM]',
    '[Office]',
    '[Tracing]',
    '[Diffs]',
    '[Documentation]',
    '[On Decision Loops]',
    'https://app.consuelohq.com/welcome',
    'href="https://consuelohq.com/contact/"',
  ]) {
    expect(rootLauncherSources).not.toContain(oldMarker);
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
    "const DESIGN_DECISION_INFRASTRUCTURE_URL = 'https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/';",
    '<a class="brand" href="${escapeHtml(DESIGN_ARCHIVE_OFFICE_PATH)}">Office</a>',
  ]) {
    expect(source).toContain(marker);
  }
  for (const marker of [
    'Consuelo OS',
    'Sites',
    'Guides and Tips',
    'Writing',
    'Go to market',
    'Artifacts',
    'Observability',
    'Code review',
    'Documentation',
    'Decision loops',
    'href="/careers/systems-engineer">Systems Engineer</a>',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
  expect(source).not.toContain('Legacy wiki</a></div>');
});
test('keeps launcher routes local and theme-aware', () => {
  for (const marker of [
    'function publicRouteAlias',
    'for (const alias of ["/observability", "/tracing"])',
    'if (clean === alias) return "/trace-burn-intelligence";',
    'if (clean.startsWith(alias + "/")) return "/trace-burn-intelligence" + clean.slice(alias.length);',
    'function proxyDiffsRoute',
    'https://diffs.consuelohq.com',
    "[DESIGN_ARCHIVE_OBSERVABILITY_PATH, `${target}${DESIGN_ARCHIVE_TRACE_ARTIFACT_PATH}`]",
    "[DESIGN_ARCHIVE_TRACING_LEGACY_PATH, `${target}${DESIGN_ARCHIVE_TRACE_ARTIFACT_PATH}`]",
    "['/diffs', `${target}/diffs`]",
    'const routePathname = publicRouteAlias(url.pathname);',
    'const canonicalPathname = stripArtifactAlias(routePathname);',
    'renderLauncherOnboarding({',
  ]) {
    expect(source).toContain(marker);
  }
  for (const marker of [
    'color-scheme: light dark',
    '--site-color-paper: #faf7f2',
    '@media (prefers-color-scheme: dark)',
    '--site-color-paper: #0f0f0d',
    'text-underline-offset: 4px',
    'overflow-x: auto; white-space: nowrap;',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
  expect(source).not.toContain('/writing/on-rendering-diffs');
  expect(rootLauncherSources).toContain('/writing/on-decision-loops');
  expect(source).toContain('renderSitesLauncherHtml({ includeHotkeysScript: true })');
  expect(source).toContain('return renderSitesLauncherHtml({ includeHotkeysScript: false });');
  expect(source).not.toContain('Software Is Becoming Decision Infrastructure</a></li>');
});

test('keeps shared launcher compact but tappable on phone and tablet viewports', () => {
  for (const marker of [
    '@media (max-width: 860px)',
    'main { grid-template-columns: 1fr; }',
    '.content { gap: 54px; }',
    '.url-row, .meta-grid { grid-template-columns: 1fr; }',
    'button { min-height: 44px; }',
    'grid-template-columns: minmax(0, 1fr) auto',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
  expect(rootLauncherSources).not.toContain('.blog-item { white-space: normal;');
});

test('keeps shared launcher structured for onboarding and navigation', () => {
  for (const marker of [
    'class="content" aria-label="Consuelo OS onboarding"',
    'class="panel" aria-label="Cloud agents"',
    'class="url-row"',
    'class="meta-grid"',
    'class="status" aria-label="Local agents"',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
});

test('adds numeric launcher hotkeys for Sites navigation', () => {
  for (const marker of [
    'const siteHotkeys = {',
    '"1": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/gtm"',
    '"2": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}"',
    '"3": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OBSERVABILITY_PATH}"',
    '"4": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs"',
    '"5": "${DESIGN_DOCS_URL}"',
    'document.addEventListener("keydown"',
    'window.location.assign(href)',
  ]) {
    expect(source).toContain(marker);
  }
  for (const marker of [
    'https://sites.consuelohq.com/gtm',
    'https://sites.consuelohq.com/office',
    'https://sites.consuelohq.com/observability',
    'https://sites.consuelohq.com/diffs',
  ]) {
    expect(rootLauncherSources).toContain(marker);
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
