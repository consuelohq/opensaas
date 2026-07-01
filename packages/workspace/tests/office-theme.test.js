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
    'function sitesLauncherMcpUrl',
    'function sitesLauncherLocalAgents',
    "path.join(home, 'security', 'generated', 'chatgpt-mcp.json')",
    "path.join(home, 'config.json')",
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
    'Welcome to Consuelo OS',
    'Here is the URL to connect',
    'Connect to your cloud agents',
    'href="/careers/systems-engineer">Systems Engineer</a>',
    'Go to market',
    'Artifacts',
    'Observability',
    'Code review',
    'Documentation',
    'Decision loops',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
  expect(source).not.toContain('Legacy wiki</a></div>');
});

test('keeps launcher routes local and theme-aware', () => {
  for (const marker of [
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
  for (const marker of [
    'color-scheme: light dark',
    '--site-color-paper: #faf7f2',
    '--site-color-ink: #1c1a17',
    '@media (prefers-color-scheme: dark)',
    '--site-color-paper: #0f0f0d',
    '--site-color-ink: #f7efe7',
    'font-family: var(--site-font-body)',
    'color-mix(in srgb, var(--site-color-accent) 70%, transparent)',
  ]) {
    expect(launcherSource).toContain(marker);
  }
  expect(source).not.toContain('/writing/on-rendering-diffs');
  expect(source).toContain('renderSitesLauncherHtml({ includeHotkeysScript: true })');
  expect(source).toContain('return renderSitesLauncherHtml({ includeHotkeysScript: false });');
  expect(source).not.toContain('min-height: 100vh; background: Canvas; color: CanvasText; font-size: 13px; line-height: 1.25; font-weight: 700');
  expect(source).not.toContain('Software Is Becoming Decision Infrastructure</a></li>');
});

test('keeps launcher responsive and tappable on phone and tablet viewports', () => {
  for (const marker of [
    '@media (max-width: 860px)',
    'main { grid-template-columns: 1fr; }',
    '.content { gap: 54px; }',
    '.panel { border-left: 0; border-top: 1px solid var(--site-color-line); }',
    '.url-row, .meta-grid { grid-template-columns: 1fr; }',
    'button { min-height: 44px; }',
  ]) {
    expect(launcherSource).toContain(marker);
  }
  expect(launcherSource).not.toContain('font-size: 100vw');
});



test('keeps Sites launcher aligned to the OS onboarding renderer', () => {
  for (const marker of [
    'renderLauncherOnboarding({',
    'mcpUrl: sitesLauncherMcpUrl()',
    'localAgents: sitesLauncherLocalAgents()',
    'launcherHtml.replace',
    'CHATGPT_CONNECTORS_URL',
    'Connected to ${connectedLocalAgentCount} local ${localAgentNoun}',
  ]) {
    expect(rootLauncherSources).toContain(marker);
  }
});


test('adds numeric launcher hotkeys for Sites navigation', () => {
  for (const marker of [
    'const siteHotkeys = {',
    '"1": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/gtm"',
    '"2": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}${DESIGN_ARCHIVE_OFFICE_PATH}"',
    '"3": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/tracing"',
    '"4": "${DESIGN_ARCHIVE_PUBLIC_ORIGIN}/diffs"',
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
