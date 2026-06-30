import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type SitesCommandResult = {
  ok: boolean;
  command: string;
  home: string;
  sitesDir: string;
  indexPath: string;
  pagesDir?: string;
  pagesRegistryPath?: string;
  officeIndexPath: string;
  officeDataPath: string;
  officeAssetsDir: string;
  tracesIndexPath: string;
  diffsIndexPath: string;
  docsIndexPath: string;
  url: string;
  artifacts: number;
  generatedAt: string | null;
  indexExists: boolean;
  officeIndexExists: boolean;
  officeDataExists: boolean;
  tracesIndexExists: boolean;
  diffsIndexExists: boolean;
  docsIndexExists: boolean;
  message: string;
  pageId?: string;
  pagePath?: string;
  sectionId?: string;
  agentId?: string | null;
  leaseAction?: 'acquire' | 'release' | 'status';
  leasesPath?: string;
  leases?: unknown[];
  rebased?: boolean;
  stagedTarget?: string;
  contentPath?: string;
  pageTitle?: string;
  pageKind?: string;
  currentVersionId?: string | null;
  publishedVersionId?: string | null;
  requiredBaseVersion?: string | null;
  versionCount?: number;
  currentPath?: string;
  versionPath?: string;
  renderTemplate?: string;
  inputPath?: string;
  outputPath?: string;
  rendered?: boolean;
  rendererStdout?: string;
  error?: { code: string; message: string };
};

let tempHome: string;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'consuelo-os-sites-cli-'));
});

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true });
});

function runBunEval(code: string): string {
  return execFileSync('bun', ['-e', code], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CONSUELO_HOME: tempHome,
      CONSUELO_GRAPHQL_URL: '',
      CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
    },
    encoding: 'utf8',
  });
}

function runSitesCommand(args: string[]): SitesCommandResult {
  return JSON.parse(runBunEval(`
    const { runSitesCommand } = await import('./scripts/os.ts');
    const result = await runSitesCommand(${JSON.stringify(args)}, { home: ${JSON.stringify(tempHome)}, openUrl: false });
    process.stdout.write(JSON.stringify(result));
  `)) as SitesCommandResult;
}

describe('Sites artifact database loading', () => {
  it('should guard database stat before opening SQLite', () => {
    const source = readFileSync('scripts/lib/sites.ts', 'utf8');
    expect(source).toContain('try {\n    stat = fs.statSync(dbPath);');
    expect(source).toContain('} catch {\n    return [];\n  }');
    expect(source.indexOf('stat = fs.statSync(dbPath);')).toBeLessThan(source.indexOf('const Database = loadBunSqliteDatabase();'));
  });
});
describe('Sites CLI', () => {
  it('prints, refreshes, opens, and reports the local Sites paths', () => {
    const pathResult = runSitesCommand(['path', '--json']);

    expect(pathResult.ok).toBe(true);
    expect(pathResult.command).toBe('path');
    expect(pathResult.sitesDir).toBe(join(tempHome, 'sites'));
    expect(pathResult.indexPath).toBe(join(tempHome, 'sites', 'index.html'));
    expect(pathResult.pagesDir).toBe(join(tempHome, 'sites', 'pages'));
    expect(pathResult.pagesRegistryPath).toBe(join(tempHome, 'sites', '.data', 'pages', 'registry.json'));
    expect(pathResult.officeIndexPath).toBe(join(tempHome, 'sites', 'office', 'index.html'));
    expect(pathResult.officeDataPath).toBe(join(tempHome, 'sites', 'office', 'data', 'artifacts.json'));
    expect(pathResult.tracesIndexPath).toBe(join(tempHome, 'sites', 'traces', 'index.html'));
    expect(pathResult.diffsIndexPath).toBe(join(tempHome, 'sites', 'diffs', 'index.html'));
    expect(pathResult.docsIndexPath).toBe(join(tempHome, 'sites', 'docs', 'index.html'));
    expect(pathResult).not.toHaveProperty('githubIndexPath');
    expect(pathResult.url.startsWith('file:')).toBe(true);

    const refreshResult = runSitesCommand(['refresh', '--json']);

    expect(refreshResult.ok).toBe(true);
    expect(refreshResult.artifacts).toBe(0);
    expect(existsSync(refreshResult.indexPath)).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'pages', 'index.html'))).toBe(true);
    expect(existsSync(refreshResult.officeIndexPath)).toBe(true);
    expect(existsSync(refreshResult.officeDataPath)).toBe(true);
    expect(existsSync(refreshResult.tracesIndexPath)).toBe(true);
    expect(existsSync(refreshResult.diffsIndexPath)).toBe(true);
    expect(existsSync(refreshResult.docsIndexPath)).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'github', 'index.html'))).toBe(false);
    expect(existsSync(join(tempHome, 'pages', 'office', 'index.html'))).toBe(false);
    expect(JSON.parse(readFileSync(refreshResult.officeDataPath, 'utf8')).artifacts).toEqual([]);

    const statusResult = runSitesCommand(['status', '--json']);

    expect(statusResult).toMatchObject({
      ok: true,
      command: 'status',
      indexExists: true,
      officeIndexExists: true,
      officeDataExists: true,
      tracesIndexExists: true,
      diffsIndexExists: true,
      docsIndexExists: true,
      artifacts: 0,
    });

    const cliStatus = JSON.parse(execFileSync('bun', ['./scripts/os.ts', 'sites', 'status', '--json'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONSUELO_HOME: tempHome,
        CONSUELO_GRAPHQL_URL: '',
        CONSUELO_INTERNAL_GRAPHQL_API_KEY: '',
      },
      encoding: 'utf8',
    })) as SitesCommandResult;
    expect(cliStatus).toMatchObject({
      ok: true,
      command: 'status',
      indexPath: join(tempHome, 'sites', 'index.html'),
      officeDataPath: join(tempHome, 'sites', 'office', 'data', 'artifacts.json'),
    });
    expect(cliStatus).not.toHaveProperty('githubIndexPath');

    const openResult = runSitesCommand(['open', '--json']);
    expect(openResult).toMatchObject({ ok: true, command: 'open' });
  });


  it('renders the Sites launcher with the public Markdown terminal UI and local OS routes', () => {
    const refreshResult = runSitesCommand(['refresh', '--json']);
    const html = readFileSync(refreshResult.indexPath, 'utf8');

    for (const marker of [
      '<title>Consuelo OS Sites</title>',
      'CONSUELO OS █',
      'CONTACT:</span> SUPPORT@CONSUELOHQ.COM',
      'LOCATION:</span> USA',
      'STATUS:</span> ONLINE',
      'OPEN POSITION:',
      '[Systems Engineer](</span><a href="/careers/systems-engineer"',
      '>/careers/systems-engineer</a>',
      'SITES:',
      '[GTM](</span><a href="https://app.consuelohq.com/welcome"',
      '>https://app.consuelohq.com/welcome</a>',
      '[Office](</span><a href="https://sites.consuelohq.com/office"',
      'data-route-path="/office"',
      '>https://sites.consuelohq.com/office</a>',
      '[Tracing](</span><a href="https://sites.consuelohq.com/traces"',
      'data-route-path="/traces"',
      '>https://sites.consuelohq.com/traces</a>',
      '[Diffs](</span><a href="https://sites.consuelohq.com/diffs"',
      'data-route-path="/diffs"',
      '>https://sites.consuelohq.com/diffs</a>',
      '[Documentation](</span><a href="https://docs.consuelohq.com/"',
      '>https://docs.consuelohq.com/</a>',
      'WRITING:',
      '[On Decision Loops](</span><a href="https://consuelohq.com/blog/software-is-becoming-decision-infrastructure/"',
      'font-family: "Geist Mono", "Geist", ui-monospace',
      'font-weight: 400',
      'letter-spacing: 0.02em',
      '@media (max-width: 430px)',
      'const fallbackSitesOrigin = "https://sites.consuelohq.com";',
      'const siteHotkeys = {',
      'resolveWorkspaceHref',
      '"2": "/office"',
      '"3": "/traces"',
      '"4": "/diffs"',
      '"5": "https://docs.consuelohq.com/"',
      'window.location.assign(href.startsWith("/") ? resolveWorkspaceHref(href) : href)',
    ]) {
      expect(html).toContain(marker);
    }

    expect(html.match(/target="_blank"/g)?.length).toBeGreaterThanOrEqual(7);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('Versioned local Sites pages with current pointers');
    expect(html).not.toContain('<div class="grid">');
  });

  it('publishes Sites pages with immutable versions and stale base-version protection', () => {
    const firstTarget = join(tempHome, 'first-page');
    mkdirSync(firstTarget, { recursive: true });
    writeFileSync(join(firstTarget, 'index.html'), '<!doctype html><h1>First version</h1>');

    const first = runSitesCommand([
      'publish',
      '--target', firstTarget,
      '--path', '/pages/trace-burn-intelligence',
      '--title', 'Trace Burn Intelligence',
      '--kind', 'trace',
      '--json',
    ]);

    expect(first).toMatchObject({ ok: true, command: 'publish', pageId: 'trace-burn-intelligence', pageKind: 'trace', versionCount: 1 });
    expect(first.publishedVersionId).toBeTruthy();
    expect(existsSync(join(tempHome, 'sites', 'pages', 'trace-burn-intelligence', 'index.html'))).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'pages', 'trace-burn-intelligence', 'versions', first.publishedVersionId!, 'index.html'))).toBe(true);

    const missingBase = runSitesCommand([
      'publish',
      '--target', firstTarget,
      '--path', '/pages/trace-burn-intelligence',
      '--title', 'Trace Burn Intelligence',
      '--kind', 'trace',
      '--json',
    ]);
    expect(missingBase.ok).toBe(false);
    expect(missingBase.error?.code).toBe('STALE_SITES_PUBLISH');
    expect(missingBase.requiredBaseVersion).toBe(first.publishedVersionId);

    const wrongBase = runSitesCommand([
      'publish',
      '--target', firstTarget,
      '--path', '/pages/trace-burn-intelligence',
      '--title', 'Trace Burn Intelligence',
      '--kind', 'trace',
      '--base-version', 'old-version',
      '--json',
    ]);
    expect(wrongBase.ok).toBe(false);
    expect(wrongBase.error?.code).toBe('STALE_SITES_PUBLISH');

    const secondTarget = join(tempHome, 'second-page');
    mkdirSync(secondTarget, { recursive: true });
    writeFileSync(join(secondTarget, 'index.html'), '<!doctype html><h1>Second version</h1>');

    const second = runSitesCommand([
      'publish',
      '--target', secondTarget,
      '--path', '/pages/trace-burn-intelligence',
      '--title', 'Trace Burn Intelligence',
      '--kind', 'trace',
      '--base-version', first.publishedVersionId!,
      '--sections', 'hero,ledger',
      '--json',
    ]);

    expect(second).toMatchObject({ ok: true, pageId: 'trace-burn-intelligence', versionCount: 2, currentVersionId: second.publishedVersionId, requiredBaseVersion: first.publishedVersionId });
    expect(second.publishedVersionId).not.toBe(first.publishedVersionId);
    expect(readFileSync(join(tempHome, 'sites', 'pages', 'trace-burn-intelligence', 'index.html'), 'utf8')).toContain('Second version');
    expect(existsSync(join(tempHome, 'sites', 'pages', 'trace-burn-intelligence', 'versions', first.publishedVersionId!, 'index.html'))).toBe(true);
    expect(existsSync(join(tempHome, 'sites', 'pages', 'trace-burn-intelligence', 'versions', second.publishedVersionId!, 'index.html'))).toBe(true);

    const registry = JSON.parse(readFileSync(join(tempHome, 'sites', '.data', 'pages', 'registry.json'), 'utf8'));
    const page = registry.pages['trace-burn-intelligence'];
    expect(page.currentVersionId).toBe(second.publishedVersionId);
    expect(page.versions).toHaveLength(2);
    expect(page.versions[1].parentVersionId).toBe(first.publishedVersionId);
    expect(page.versions[1].changedSectionIds).toEqual(['hero', 'ledger']);

    const forced = runSitesCommand([
      'publish',
      '--target', firstTarget,
      '--path', '/pages/trace-burn-intelligence',
      '--title', 'Trace Burn Intelligence',
      '--kind', 'trace',
      '--force-publish',
      '--json',
    ]);
    expect(forced.ok).toBe(true);
    expect(forced.versionCount).toBe(3);
  });



  it('keeps reserved page versions protected and returns structured publish errors', () => {
    const firstTarget = join(tempHome, 'reserved-first');
    mkdirSync(firstTarget, { recursive: true });
    writeFileSync(join(firstTarget, 'index.html'), '<!doctype html><h1>First version</h1>');
    const first = runSitesCommand(['publish', '--target', firstTarget, '--path', '/pages/review-check', '--title', 'Review Check', '--kind', 'guide', '--json']);
    expect(first.ok).toBe(true);

    const secondTarget = join(tempHome, 'reserved-second');
    mkdirSync(join(secondTarget, 'versions', first.publishedVersionId!), { recursive: true });
    writeFileSync(join(secondTarget, 'index.html'), '<!doctype html><h1>Second version</h1>');
    writeFileSync(join(secondTarget, 'versions', first.publishedVersionId!, 'index.html'), '<!doctype html><h1>Injected history</h1>');
    const second = runSitesCommand(['publish', '--target', secondTarget, '--path', '/pages/review-check', '--title', 'Review Check', '--kind', 'guide', '--base-version', first.publishedVersionId!, '--json']);
    expect(second.ok).toBe(true);
    expect(readFileSync(join(tempHome, 'sites', 'pages', 'review-check', 'versions', first.publishedVersionId!, 'index.html'), 'utf8')).toContain('First version');
    expect(readFileSync(join(tempHome, 'sites', 'pages', 'review-check', 'index.html'), 'utf8')).toContain('Second version');

    const invalidKind = runSitesCommand(['publish', '--target', firstTarget, '--path', '/pages/bad-kind', '--title', 'Bad Kind', '--kind', 'bogus', '--json']);
    expect(invalidKind.ok).toBe(false);
    expect(invalidKind.error?.code).toBe('INVALID_SITES_PUBLISH_KIND');

    writeFileSync(join(tempHome, 'sites', '.data', 'pages', 'registry.json'), '{ malformed');
    const malformedRegistry = runSitesCommand(['publish', '--target', firstTarget, '--path', '/pages/review-check', '--title', 'Review Check', '--kind', 'guide', '--force-publish', '--json']);
    expect(malformedRegistry.ok).toBe(false);
    expect(malformedRegistry.error?.code).toBe('MALFORMED_SITES_PAGE_REGISTRY');
  });

  it('renders typed guide pages through the canonical reader shell before publishing to Sites', () => {
    const contentPath = join(tempHome, 'guide-content.json');
    const outPath = join(tempHome, 'rendered-guide', 'index.html');
    writeFileSync(contentPath, JSON.stringify({
      template: 'guide',
      title: 'How To Speak - Communication Field Guide',
      eyebrow: 'communication guide',
      thesis: 'A good talk is an attention system with a promise, landmarks, and a portable takeaway.',
      metadata: { status: 'test', owner: 'Ko / Consuelo', date: '2026-06-09' },
      map: [{ label: 'Deep idea', href: '#deep-idea' }, { label: 'Source', href: '#source' }, { label: 'Task', href: '#ship-checklist' }],
      sections: [
        { id: 'deep-idea', eyebrow: 'deep idea', title: 'Speaking is attention design', body: ['Give the audience a capability, not a transcript.'], callout: { label: 'field rule', title: 'Promise the useful thing first.', body: 'The renderer owns the shell; Sites only supplies typed input.' } },
        { id: 'source', eyebrow: 'source', title: 'Source stack', cards: [{ title: 'Primary source', body: 'Patrick Winston talk transcript.', tag: 'packet' }] }
      ],
      components: [
        { type: 'table', title: 'Speaking checklist', table: { columns: ['Move', 'Purpose'], rows: [['Promise', 'Tell people what they can do after the talk.']] } }
      ],
      ledgerTitle: 'Ship checklist',
      ledger: [{ title: 'Guide render', items: [{ status: 'done', text: 'Render through the canonical reader shell.' }] }]
    }, null, 2));

    const render = runSitesCommand(['render', '--template', 'guide', '--input', contentPath, '--out', outPath, '--json']);

    expect(render).toMatchObject({ ok: true, command: 'render', renderTemplate: 'guide', inputPath: contentPath, outputPath: outPath, rendered: true });
    const html = readFileSync(outPath, 'utf8');
    expect(html).toContain('data-reader-shell-template="guide"');
    expect(html).toContain('window.__readerShell');
    expect(html).toContain('data-reader-component="table"');
    expect(html).toContain('reader-nav-task');

    const publish = runSitesCommand(['publish', '--target', join(tempHome, 'rendered-guide'), '--path', '/pages/how-to-speak', '--title', 'How To Speak', '--kind', 'guide', '--json']);
    expect(publish).toMatchObject({ ok: true, command: 'publish', pageKind: 'guide', versionCount: 1 });
    expect(readFileSync(join(tempHome, 'sites', 'pages', 'how-to-speak', 'index.html'), 'utf8')).toContain('data-reader-shell-template="guide"');
  });


  it('patches reader sections with auto-merge, same-section conflict, and leases', () => {
    const firstTarget = join(tempHome, 'reader-page');
    mkdirSync(firstTarget, { recursive: true });
    writeFileSync(join(firstTarget, 'content.json'), JSON.stringify({
      template: 'guide',
      title: 'Trace Burn Intelligence',
      eyebrow: 'trace guide',
      thesis: 'Trace burn is a sectioned page for concurrent agent work.',
      metadata: { status: 'test', owner: 'Ko / Consuelo', date: '2026-06-09' },
      sections: [
        { id: 'hero', eyebrow: 'hero', title: 'Hero', body: ['First hero.'] },
        { id: 'scoring', eyebrow: 'scoring', title: 'Scoring', body: ['First scoring.'] },
        { id: 'ledger', eyebrow: 'ledger', title: 'Ledger', body: ['First ledger.'] }
      ],
      ledger: [{ title: 'Checklist', items: [{ status: 'done', text: 'Seed page.' }] }]
    }, null, 2));
    writeFileSync(join(firstTarget, 'index.html'), '<!doctype html><h1>Trace Burn Intelligence</h1>');

    const first = runSitesCommand(['publish', '--target', firstTarget, '--path', '/pages/trace-burn-intelligence', '--title', 'Trace Burn Intelligence', '--kind', 'guide', '--sections', 'hero,scoring,ledger', '--json']);
    expect(first.ok).toBe(true);

    const scoringPatch = join(tempHome, 'scoring-section.json');
    writeFileSync(scoringPatch, JSON.stringify({ id: 'scoring', eyebrow: 'scoring', title: 'Scoring updated', body: ['Agent A updated scoring.'] }, null, 2));
    const scoring = runSitesCommand(['patch', '--page', 'trace-burn-intelligence', '--section', 'scoring', '--input', scoringPatch, '--base-version', first.publishedVersionId!, '--agent', 'agent-a', '--json']);
    expect(scoring).toMatchObject({ ok: true, command: 'patch', pageId: 'trace-burn-intelligence', sectionId: 'scoring', rebased: false });
    expect(scoring.publishedVersionId).toBeTruthy();

    const ledgerPatch = join(tempHome, 'ledger-section.json');
    writeFileSync(ledgerPatch, JSON.stringify({ id: 'ledger', eyebrow: 'ledger', title: 'Ledger updated', body: ['Agent B updated ledger.'] }, null, 2));
    const ledger = runSitesCommand(['patch', '--page', 'trace-burn-intelligence', '--section', 'ledger', '--input', ledgerPatch, '--base-version', first.publishedVersionId!, '--agent', 'agent-b', '--json']);
    expect(ledger).toMatchObject({ ok: true, command: 'patch', pageId: 'trace-burn-intelligence', sectionId: 'ledger', rebased: true });

    const conflictingScoring = runSitesCommand(['patch', '--page', 'trace-burn-intelligence', '--section', 'scoring', '--input', scoringPatch, '--base-version', first.publishedVersionId!, '--agent', 'agent-c', '--json']);
    expect(conflictingScoring.ok).toBe(false);
    expect(conflictingScoring.error?.code).toBe('SECTION_CONFLICT');

    const lease = runSitesCommand(['lease', 'acquire', '--page', 'trace-burn-intelligence', '--section', 'hero', '--agent', 'agent-a', '--ttl-minutes', '30', '--json']);
    expect(lease).toMatchObject({ ok: true, command: 'lease', leaseAction: 'acquire', pageId: 'trace-burn-intelligence', sectionId: 'hero', agentId: 'agent-a' });
    const blockedLease = runSitesCommand(['lease', 'acquire', '--page', 'trace-burn-intelligence', '--section', 'hero', '--agent', 'agent-b', '--ttl-minutes', '30', '--json']);
    expect(blockedLease.ok).toBe(false);
    expect(blockedLease.error?.code).toBe('LEASE_CONFLICT');
    const release = runSitesCommand(['lease', 'release', '--page', 'trace-burn-intelligence', '--section', 'hero', '--agent', 'agent-a', '--json']);
    expect(release).toMatchObject({ ok: true, leaseAction: 'release' });
  });

});


