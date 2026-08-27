import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildObservabilityTracesClientScript,
  buildObservabilityTracesSite,
  resolveObservabilitySessionValue,
} from '../scripts/lib/observability-traces-site';

const canonicalAssetDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../assets/vendor/observability-traces-v38',
);

const osTraceInspectorDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../scripts/lib/trace-site-inspector',
);

const assetHash = (name: string) =>
  createHash('sha256')
    .update(readFileSync(resolve(canonicalAssetDir, name)))
    .digest('hex');

describe('Observability Traces canonical Trace Burn surface', () => {
  it('renders the established v38 table shell instead of the Observability cockpit reimplementation', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('<title>Trace Burn Intelligence</title>');
    expect(html).toContain('class="trxShell closed"');
    expect(html).toContain('data-trace-shell');
    expect(html).toContain('data-trace-rows');
    expect(html).toContain('data-inspector');
    expect(html).toContain('data-show-filters');
    expect(html).toContain('data-trace-count');
    expect(html).toContain(
      '<div class="trxHead"><div></div><div>Time</div><div>Tool</div><div>Latency</div><div>Tokens</div><div>Session</div><div>Input</div><div>Output</div><div>Node</div><div>Trace</div><div>Cost</div></div>',
    );
    expect(html).not.toContain('<div>Status</div>');
    expect(html).toContain('consuelo-trace-node-observability');
    expect(html).toContain('data-workspace-route-trigger');
    expect(html).toContain('aria-label="Workspace routes"');
    expect(html).toContain('aria-current="page" href="/tracing"');
    expect(html).toContain('class="workspace-route-option workspace-route-primary"');
    expect(html).toContain('href="/configuration"');
    expect(html).toContain('href="/artifacts"');
    expect(html).toContain('href="/diffs"');
    expect(html).toContain('href="/nodes"');
    expect(html).toContain('href="/tools"');
    expect(html).toContain('href="/secrets"');
    expect(html).toContain('href="https://docs.consuelohq.com/"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer" href="https://docs.consuelohq.com/"');
    expect(html).toContain('.workspace-route-trigger > span:first-child');
    expect(html).toContain('>Connect</p>');
    expect(html).toContain('>Guides</p>');
    expect(html).toContain('--workspace-chrome-bg:');
    expect(html).toContain('--workspace-menu-bg:');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('left: 50vw;');
    expect(html).not.toContain('<div>Machine</div>');

    expect(html).not.toContain('Live tracing cockpit');
    expect(html).not.toContain('Search traces...');
    expect(html).not.toContain('Rows per page');
    expect(html).not.toContain('Page 1 of');
    expect(html).not.toContain('Recent errors');
    expect(html).not.toContain('class="kpis"');
    expect(html).not.toContain('class="hero"');
  });

  it('keeps the shared tracing chrome and table viewport-bounded across visible desktop and mobile states', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('id="consuelo-trace-workspace-integration"');
    expect(html).toContain('Inspect live tool traces.');
    expect(html).not.toContain('Inspect live agent and tool execution.');
    expect(html).toContain('#tbmLiveTraceModal[aria-hidden="false"]');
    expect(html).toContain('display:flex!important');
    expect(html).toContain('grid-template-rows:38px minmax(0,1fr)!important');
    expect(html).toContain(
      '.trxChrome[data-workspace-chrome] .workspace-route-control{overflow:visible!important}',
    );
    expect(html).toContain(
      '#tbmLiveTraceModal .trxTableScroll{width:100%!important;max-width:100%!important;min-width:0!important;overflow:auto!important;',
    );
    expect(html).toContain('scroll-padding-inline-end:18px!important');
    expect(html).toContain(
      '#tbmLiveTraceModal .trxTable{width:max-content!important;max-width:none!important;padding-right:18px!important;',
    );
    expect(html).toContain(
      '#tbmLiveTraceModal .trxHead,#tbmLiveTraceModal .trxRow{grid-template-columns:34px 112px 176px 82px 82px minmax(360px,1.1fr) minmax(350px,.96fr) minmax(350px,.96fr) 150px 180px 92px!important}',
    );
    expect(html).toContain(
      '@media(max-width:760px){#tbmLiveTraceModal[aria-hidden="false"]{padding:0!important;',
    );
    expect(html).toContain(
      '#tbmLiveTraceModal .trxHead,#tbmLiveTraceModal .trxRow{min-width:1550px!important;grid-template-columns:34px 108px 150px 78px 76px 260px 240px 240px 140px 140px 84px!important}',
    );
    expect(html).toContain(
      '#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .trxRail{display:block!important;position:fixed!important;',
    );
    expect(html).toContain('width:100vw!important;max-width:100vw!important');
    expect(html).toContain(
      '#tbmLiveTraceModal[aria-hidden="false"] .trxShell:not(.closed) .tiInspector{width:100%!important;max-width:100%!important;',
    );
  });

  it('follows system light/dark mode with the launcher palette and preserves tracing hierarchy', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('id="consuelo-trace-system-theme"');
    expect(html).toContain('--trace-bg:#f4efe7');
    expect(html).toContain('--trace-cream:#29251f');
    expect(html).toContain('--trace-muted:#756d63');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('--trace-bg:#080706');
    expect(html).toContain('--trace-cream:#f3ead3');
    expect(html).toContain('.trxLatency,#tbmLiveTraceModal .trxTokens,#tbmLiveTraceModal .trxJson');
    expect(html).toContain('.trxToolName,#tbmLiveTraceModal .trxCost');
    expect(html).toContain('--branch-color-light');
    expect(html).toContain('--branch-color-dark');
  });

  it('projects task branches and work filesystem paths into the same Session value', () => {
    expect(resolveObservabilitySessionValue({
      workPath: '/Users/ko/Developer/raycast-extension',
      branch: 'task/workspace-agent/example',
      taskSession: 'tsk_example',
      workSession: 'wrk_example',
    })).toBe('/Users/ko/Developer/raycast-extension');
    expect(resolveObservabilitySessionValue({
      branch: 'task/workspace-agent/example',
      taskSession: 'tsk_example',
    })).toBe('task/workspace-agent/example');
    expect(resolveObservabilitySessionValue({ workSession: 'wrk_example' })).toBe('wrk_example');
    expect(resolveObservabilitySessionValue({})).toBe('no-branch');
  });

  it('labels the existing branch facet as Sessions', () => {
    const source = readFileSync(resolve(osTraceInspectorDir, 'virtual-list-browser.ts'), 'utf8');
    expect(source).toContain("createFilterSection('branches', 'Sessions'");
    expect(source).not.toContain("createFilterSection('branches', 'Branches'");
  });

  it('uses the exact v38 interaction assets with only same-origin gateway transport', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('trace-overview-polish-v22');
    expect(html).toContain('consuelo-trace-inspector-bootstrap');
    expect(html).toContain('consuelo-trace-history-transport');
    expect(html).toContain('/gateway/traces/recent');
    expect(html).toContain("credentials:'same-origin'");
    expect(html).toContain('includeRawPayload');
    const browserSource = [
      'browser.ts',
      'pagination-browser.ts',
      'virtual-list-browser.ts',
    ]
      .map((name) => readFileSync(resolve(osTraceInspectorDir, name), 'utf8'))
      .join('\n');
    expect(browserSource).toContain('installTracePaginationTransport');
    expect(browserSource).toContain('installLivePolling');
    expect(browserSource).toContain('traceLiveUrl');
    expect([
      ...browserSource.matchAll(
        /trxOutputCell[\s\S]{0,260}appendNodeCell\(button,[\s\S]{0,180}trxTraceCell/g,
      ),
    ]).toHaveLength(2);

    expect(html).not.toContain('/trace-burn-intelligence/_astro/');
    expect(html).not.toContain('<script src="https://');
    expect(html).not.toContain('cdn.jsdelivr.net');
  });

  it('recovers an expired private workspace browser session before showing an empty trace table', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('consuelo-private-workspace-session-recovery');
    expect(html).toContain("response.status !== 401");
    expect(html).toContain("payload.error !== 'workspace_session_required'");
    expect(html).toContain("'/login/google/start'");
    expect(html).toContain("searchParams.set('purpose', 'web')");
    expect(html).toContain(
      "window.location.pathname + window.location.search + window.location.hash",
    );
    expect(html).toContain('window.location.assign(loginUrl.toString())');
  });

  it('returns to the workspace launcher when the v38 red window control is clicked', () => {
    const html = buildObservabilityTracesSite();

    expect(html).toContain('data-close-traces');
    expect(html).toContain("querySelector('button[data-close-traces]')");
    expect(html).toContain("location.assign('/')");
  });

  it('ships no serialized trace backlog or private network origin in the static snapshot', () => {
    const html = buildObservabilityTracesSite();
    const seed = /<script[^>]*id="trace-seed-data"[^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];

    expect(seed).toBeDefined();
    expect(JSON.parse(seed ?? '{}')).toMatchObject({ rows: [], failures: [] });
    expect(html).not.toContain('localhost');
    expect(html).not.toContain('127.0.0.1');
    expect(html).not.toMatch(/\b100\.(?:[6-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}\b/);
    expect(html).not.toMatch(/\b10(?:\.\d{1,3}){3}\b/);
    expect(html).not.toMatch(/\b192\.168(?:\.\d{1,3}){2}\b/);
    expect(html).not.toMatch(/\bc-[a-f0-9]+\.consuelohq\.com\b/i);
    expect(html).not.toMatch(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i);
  });

  it('consumes a short-lived prefetched trace preview before the live refresh without persisting it', () => {
    const clientScript = buildObservabilityTracesClientScript();
    const html = buildObservabilityTracesSite();

    expect(clientScript).toContain("const TRACE_PREFETCH_KEY = 'consuelo:tracing-prefetch:v1'");
    expect(clientScript).toContain('sessionStorage.getItem(TRACE_PREFETCH_KEY)');
    expect(clientScript).toContain('sessionStorage.removeItem(TRACE_PREFETCH_KEY)');
    expect(clientScript).toContain('Date.now() - Number(cached.savedAt || 0)');
    expect(clientScript).toContain('const prefetchedFeed = readPrefetchedTraceFeed()');
    expect(clientScript).toContain('let state = createState(prefetchedFeed || fallbackFeed)');
    expect(html).not.toContain('trace-seed-data">{"savedAt"');
  });

  it('owns the maintained Trace Burn browser source in OS with no deprecated workspace dependency', () => {
    const sourceFiles = [
      'model.ts',
      'inspector-state.ts',
      'pagination-browser.ts',
      'trace-list.ts',
      'table-formatters.ts',
      'virtual-list-browser.ts',
      'browser.ts',
    ];
    const source = sourceFiles
      .map((name) => readFileSync(resolve(osTraceInspectorDir, name), 'utf8'))
      .join('\n');
    const runtime = readFileSync(resolve(canonicalAssetDir, 'inspector.js'), 'utf8');
    const packageJson = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'),
      'utf8',
    );

    expect(source).not.toContain('packages/workspace');
    expect(source).toContain('const compactLayout = availableWidth <= 760;');
    expect(source).toContain(
      "open && !compactLayout\n      ? `${Math.floor(tableWidth)}px 8px minmax(420px, ${inspectorWidth}px)`",
    );
    expect(runtime).not.toContain('packages/workspace/scripts/trace-site-inspector');
    expect(packageJson).toContain('\"@tanstack/virtual-core\"');
  });

  it('keeps the copied v38 visual shell assets byte-identical while OS owns the rebuilt browser runtime', () => {
    expect(assetHash('template.html')).toBe(
      '07ac31363ae72831ae79b3785e65630b1e67ee0eee1542acb93a2f56c005bda7',
    );
    expect(assetHash('base.css')).toBe(
      '5115930cfadcbcefc00cabe3ef870a0c719ec9accef439678daa2a097b5ba295',
    );
    expect(assetHash('mobile.css')).toBe(
      'dda1c35064cc31c86bce73a4114031ae779957b2071f1ed9fde6ea8f3618fbad',
    );
    expect(assetHash('inspector.css')).toBe(
      'e01968c5feb6e52ac5aa95e30cc2eebf55f827f0a0ea3f72b7272348894ce751',
    );
    expect(assetHash('table-overview.js')).toBe(
      'a43187999737a2545d2248d93f1aebb29ffee5c4900a6fa64fab2c942339547f',
    );
    expect(assetHash('gsap.js')).toBe(
      '92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb',
    );
    expect(assetHash('scroll.js')).toBe(
      '8e0d8d1827ce101fee60b046400b32333d0c4f558875eeec88d629c9b9010e4c',
    );
  });

  it('retains the stream public-Astro client export without changing the internal v38 site builder', () => {
    const clientScript = buildObservabilityTracesClientScript();
    const html = buildObservabilityTracesSite();

    expect(clientScript).toContain('/gateway/traces/recent');
    expect(clientScript).not.toContain('cdn.jsdelivr.net');
    expect(clientScript).not.toContain('<script src="https://');
    expect(clientScript).not.toContain('ReactDOM');
    expect(html).toContain('<title>Trace Burn Intelligence</title>');
    expect(html).not.toContain('Live tracing cockpit');
  });

  it('keeps the stream public Astro source buildable while the internal generated surface remains v38', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../consuelo-website/src/pages/os/observability/traces.astro'),
      'utf8',
    );

    expect(source).toContain('buildObservabilityTracesClientScript');
    expect(source).toContain('<MarketingLayout');
    expect(source).toContain('set:html={traceClientScript}');
    expect(source).not.toContain('packages/workspace');
  });

});
