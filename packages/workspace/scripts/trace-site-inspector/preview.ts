#!/usr/bin/env bun

import {
  access,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { INSPECTOR_CSS_HREF, INSPECTOR_SCRIPT_SRC } from './deploy';

export type SyntheticTraceRow = Record<string, unknown>;

const generatedAt = '2026-07-11T00:00:00.000Z';
const branch = 'demo/trace-inspector';

const featuredRows: SyntheticTraceRow[] = [
  {
    id: 'demo-trace-006',
    recordId: 'demo-record-006',
    startTime: '2026-07-11T00:00:18.000Z',
    time: '00:00:18',
    displayTime: '00:00:18',
    name: 'code.call',
    traceName: 'code.call',
    branch,
    taskSession: 'demo-session',
    status: 'success',
    ok: true,
    code: 'OK',
    durationMs: 420,
    latency: '0.42s',
    tokens: 680,
    inputTokens: 220,
    outputTokens: 460,
    cost: 0.002,
    costLabel: '$0.0020',
    trace: 'demo-trace-006',
    traceId: 'demo-trace-006',
    input:
      'Inspect the trace inspector source and report the active preview contract.',
    output: 'Completed source inspection with one focused read.',
    summary: 'bun/read · inspector source reviewed',
    rawInputJson: JSON.stringify({
      language: 'bun',
      mode: 'read',
      target: 'trace inspector source',
    }),
    rawResolvedInputJson: JSON.stringify({
      language: 'bun',
      mode: 'read',
      target: 'trace inspector source',
      bounded: true,
    }),
    rawResultJson: JSON.stringify({
      ok: true,
      code: 'OK',
      filesRead: 1,
      message: 'inspection complete',
    }),
    rawStderr: '',
    metadata: { source: 'synthetic-preview', privacy: 'no private trace data' },
  },
  {
    id: 'demo-trace-005',
    recordId: 'demo-record-005',
    startTime: '2026-07-11T00:00:14.000Z',
    time: '00:00:14',
    displayTime: '00:00:14',
    name: 'batch',
    traceName: 'batch',
    branch,
    taskSession: 'demo-session',
    status: 'error',
    ok: false,
    code: 'COMMAND_FAILED',
    exitCode: 1,
    durationMs: 1060,
    latency: '1.06s',
    tokens: 1180,
    inputTokens: 430,
    outputTokens: 750,
    cost: 0.0035,
    costLabel: '$0.0035',
    trace: 'demo-trace-005',
    traceId: 'demo-trace-005',
    input: 'Read a missing fixture after a successful metadata lookup.',
    output: 'batch failed · one child call returned COMMAND_FAILED',
    summary: '2 operations · 1 failed',
    rawInputJson: JSON.stringify({ steps: ['metadata.read', 'fixture.read'] }),
    rawResolvedInputJson: JSON.stringify({
      steps: ['metadata.read', 'fixture.read'],
      stopOnError: true,
    }),
    rawResultJson: JSON.stringify({
      ok: false,
      code: 'COMMAND_FAILED',
      message: 'batch stopped after a failed step',
    }),
    rawStderr: 'command failed',
    batchResultsJson: [
      {
        ok: true,
        tool: 'metadata.read',
        code: 'OK',
        durationMs: 110,
        totalTokens: 180,
      },
      {
        ok: false,
        tool: 'fixture.read',
        code: 'COMMAND_FAILED',
        exitCode: 1,
        durationMs: 240,
        totalTokens: 320,
        message: 'command failed',
        stderr: 'fixtures/trace-detail.json: No such file or directory',
      },
    ],
    metadata: { source: 'synthetic-preview', privacy: 'no private trace data' },
  },
  {
    id: 'demo-trace-004',
    recordId: 'demo-record-004',
    startTime: '2026-07-11T00:00:10.000Z',
    time: '00:00:10',
    displayTime: '00:00:10',
    name: 'fs.read',
    traceName: 'fs.read',
    branch,
    taskSession: 'demo-session',
    status: 'success',
    ok: true,
    code: 'OK',
    durationMs: 180,
    latency: '0.18s',
    tokens: 240,
    inputTokens: 80,
    outputTokens: 160,
    cost: 0.0007,
    costLabel: '$0.0007',
    trace: 'demo-trace-004',
    traceId: 'demo-trace-004',
    input: 'Read the focused fixture.',
    output: 'Read 72 lines.',
    summary: 'fixture read completed',
    rawInputJson: JSON.stringify({
      path: 'fixtures/trace-detail.json',
      from: 1,
      to: 72,
    }),
    rawResolvedInputJson: JSON.stringify({
      path: 'fixtures/trace-detail.json',
      from: 1,
      to: 72,
      bounded: true,
    }),
    rawResultJson: JSON.stringify({ ok: true, lines: 72 }),
    rawStderr: '',
    metadata: { source: 'synthetic-preview', privacy: 'no private trace data' },
  },
  {
    id: 'demo-trace-003',
    recordId: 'demo-record-003',
    startTime: '2026-07-11T00:00:07.000Z',
    time: '00:00:07',
    displayTime: '00:00:07',
    name: 'tools.search',
    traceName: 'tools.search',
    branch,
    taskSession: 'demo-session',
    status: 'success',
    ok: true,
    code: 'OK',
    durationMs: 310,
    latency: '0.31s',
    tokens: 390,
    inputTokens: 120,
    outputTokens: 270,
    cost: 0.0012,
    costLabel: '$0.0012',
    trace: 'demo-trace-003',
    traceId: 'demo-trace-003',
    input: 'Find the smallest read operation for a trace fixture.',
    output: 'Recommended fs.read.',
    summary: 'one relevant tool found',
    rawInputJson: JSON.stringify({ query: 'read trace fixture', limit: 5 }),
    rawResolvedInputJson: JSON.stringify({
      query: 'read trace fixture',
      limit: 5,
      readOnly: true,
    }),
    rawResultJson: JSON.stringify({ recommended: 'fs.read', matches: 1 }),
    rawStderr: '',
    metadata: { source: 'synthetic-preview', privacy: 'no private trace data' },
  },
  {
    id: 'demo-trace-002',
    recordId: 'demo-record-002',
    startTime: '2026-07-11T00:00:04.000Z',
    time: '00:00:04',
    displayTime: '00:00:04',
    name: 'code.call',
    traceName: 'code.call',
    branch,
    taskSession: 'demo-session',
    status: 'success',
    ok: true,
    code: 'OK',
    durationMs: 520,
    latency: '0.52s',
    tokens: 820,
    inputTokens: 260,
    outputTokens: 560,
    cost: 0.0024,
    costLabel: '$0.0024',
    trace: 'demo-trace-002',
    traceId: 'demo-trace-002',
    input: 'Normalize trace rows and preserve stable selection.',
    output: 'Selection remained stable across the feed update.',
    summary: 'state normalization completed',
    rawInputJson: JSON.stringify({
      operation: 'normalizeRows',
      preserveSelection: true,
    }),
    rawResolvedInputJson: JSON.stringify({
      operation: 'normalizeRows',
      preserveSelection: true,
      stableKey: 'recordId',
    }),
    rawResultJson: JSON.stringify({ ok: true, selectedKey: 'demo-record-002' }),
    rawStderr: '',
    metadata: { source: 'synthetic-preview', privacy: 'no private trace data' },
  },
  {
    id: 'demo-trace-001',
    recordId: 'demo-record-001',
    startTime: '2026-07-11T00:00:01.000Z',
    time: '00:00:01',
    displayTime: '00:00:01',
    name: 'get_steering',
    traceName: 'get_steering',
    branch,
    taskSession: 'demo-session',
    status: 'success',
    ok: true,
    code: 'OK',
    durationMs: 40,
    latency: '0.04s',
    tokens: 160,
    inputTokens: 20,
    outputTokens: 140,
    cost: 0.0005,
    costLabel: '$0.0005',
    trace: 'demo-trace-001',
    traceId: 'demo-trace-001',
    input: '{}',
    output: 'Loaded the synthetic preview contract.',
    summary: 'preview steering loaded',
    rawInputJson: '{}',
    rawResolvedInputJson: '{}',
    rawResultJson: JSON.stringify({ ok: true, mode: 'synthetic-preview' }),
    rawStderr: '',
    metadata: { source: 'synthetic-preview', privacy: 'no private trace data' },
  },
];

const historyTools = [
  'fs.read',
  'code.call',
  'tools.search',
  'review.run',
  'verify',
];
const historyRows: SyntheticTraceRow[] = Array.from(
  { length: 5_000 - featuredRows.length },
  (_, index) => {
    const sequence = index + featuredRows.length + 1;
    const startTime = new Date(
      Date.parse('2026-07-10T23:59:59.000Z') - index * 1_000,
    ).toISOString();
    const tool = historyTools[index % historyTools.length] ?? 'trace';
    const durationMs = 35 + (index % 1_200);
    const inputTokens = 12 + (index % 180);
    const outputTokens = 24 + (index % 360);
    return {
      id: `demo-trace-${String(sequence).padStart(5, '0')}`,
      recordId: `demo-record-${String(sequence).padStart(5, '0')}`,
      startTime,
      time: startTime.slice(11, 19),
      displayTime: startTime.slice(11, 19),
      name: tool,
      traceName: tool,
      branch: `demo/history-${String(Math.floor(index / 20) + 1).padStart(3, '0')}`,
      taskSession: `demo-history-${Math.floor(index / 20) + 1}`,
      status: index % 97 === 0 ? 'error' : 'success',
      ok: index % 97 !== 0,
      code: index % 97 === 0 ? 'COMMAND_FAILED' : 'OK',
      exitCode: index % 97 === 0 ? 1 : 0,
      durationMs,
      latency: `${durationMs}ms`,
      tokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      cost: 0,
      costLabel: '$0.0000',
      trace: `demo-trace-${String(sequence).padStart(5, '0')}`,
      traceId: `demo-trace-${String(sequence).padStart(5, '0')}`,
      input: `Synthetic history request ${sequence}`,
      output:
        index % 97 === 0
          ? 'Synthetic bounded failure for virtual-list testing.'
          : `Synthetic history result ${sequence}`,
      summary: `${tool} · synthetic history row ${sequence}`,
      rawStderr:
        index % 97 === 0 ? 'synthetic preview failure: no private data' : '',
      metadata: { source: 'synthetic-preview', sequence },
    };
  },
);

const rows: SyntheticTraceRow[] = [...featuredRows, ...historyRows];

const totalTokens = rows.reduce((sum, row) => sum + Number(row.tokens ?? 0), 0);
const totalCost = rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);

export const SYNTHETIC_TRACE_FEED = {
  meta: {
    generatedAt,
    rowCount: rows.length,
    failureCount: rows.filter((row) => row.status === 'error').length,
    maxRowid: rows.length,
    tokens: totalTokens,
    cost: totalCost,
    synthetic: true,
  },
  rows,
  failures: rows.filter((row) => row.status === 'error'),
};

export const PRIVATE_MARKERS = [
  '/Users/',
  'kokayi',
  'opensaas-worktrees',
  'Application Support/OpenWorkspace',
  'task/trace-site/',
  'tsk_',
  'trc_',
];

export function serializeTraceSeed(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

export function sanitizeTracePreviewHtml(html: string): string {
  const seed = serializeTraceSeed(SYNTHETIC_TRACE_FEED);
  const replaced = html.replace(
    /(<script[^>]*id=["']trace-seed-data["'][^>]*>)[\s\S]*?(<\/script>)/,
    `$1${seed}$2`,
  );
  if (replaced === html)
    throw new Error('trace preview seed script was not found');
  const badge =
    '<div class="trace-synthetic-preview" role="status">Cloudflare preview · synthetic traces only</div>';
  const style =
    '<style>.trace-synthetic-preview{position:fixed;right:14px;bottom:14px;z-index:10000;border:1px solid rgba(243,234,211,.2);border-radius:999px;background:#0b0907;color:#d8cdbb;padding:8px 11px;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 12px 36px rgba(0,0,0,.4)}@media(max-width:760px){.trace-synthetic-preview{right:8px;bottom:8px;font-size:9px}}</style>';
  const withStyle = replaced.includes('trace-synthetic-preview')
    ? replaced
    : replaced.replace('</head>', `${style}</head>`);
  return withStyle.includes(badge)
    ? withStyle
    : withStyle
        .replace('<body', `<body data-trace-preview="synthetic"`)
        .replace('</body>', `${badge}</body>`);
}

export function assertSanitizedTracePreview(
  text: string,
  source = 'preview',
): void {
  for (const marker of PRIVATE_MARKERS) {
    if (text.includes(marker))
      throw new Error(`${source} contains private marker: ${marker}`);
  }
}

export function standaloneTracePreviewHtml(): string {
  const seed = serializeTraceSeed(SYNTHETIC_TRACE_FEED);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Trace Burn Intelligence \u00B7 Synthetic Preview</title>
  <link rel="stylesheet" href="${INSPECTOR_CSS_HREF}">
  <style>
    :root{color-scheme:dark;--bg:#050403;--panel:#0b0907;--line:rgba(243,234,211,.13);--text:#eee4d2;--muted:#9f9583;--amber:#c6a15b;--green:#99ad7b;--red:#d06d52}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}button{font:inherit;color:inherit}
    .preview-page{min-height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr);padding:18px;background:radial-gradient(circle at 80% -10%,rgba(198,161,91,.11),transparent 34%),var(--bg)}
    .preview-top{min-height:68px;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:0 2px 16px}.preview-top .eyebrow{color:var(--muted);font-size:10px;font-weight:800;letter-spacing:.17em;text-transform:uppercase}.preview-top h1{margin:7px 0 0;font:700 clamp(24px,4vw,42px)/.95 Georgia,serif;letter-spacing:-.04em}.preview-note{max-width:470px;margin:0;color:var(--muted);font-size:11px;line-height:1.5;text-align:right}.cmdkMenuLaunch{border:1px solid var(--line);border-radius:999px;background:var(--panel);padding:8px 10px;color:var(--amber);font-size:10px}
    #tbmLiveTraceModal{min-height:0;display:block}.trxShell{height:calc(100dvh - 104px);min-height:560px;overflow:hidden;border:1px solid var(--line);border-radius:13px;background:#080706;box-shadow:0 28px 90px rgba(0,0,0,.46)}
    .preview-layout{height:100%;min-height:0;display:grid;grid-template-columns:minmax(380px,42%) minmax(0,1fr)}
    .preview-list{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);border-right:1px solid var(--line);background:#090806}.preview-list header{padding:15px;border-bottom:1px solid var(--line)}.preview-list header span{display:block;color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.preview-list header h2{margin:6px 0 4px;font-size:15px}.preview-list header p{margin:0;color:var(--muted);font-size:10px;line-height:1.45}.preview-rows{position:relative;min-height:0;overflow:auto;overscroll-behavior:contain;contain:strict}.preview-rows [data-trace-virtual-content]{position:relative;width:100%;min-height:100%}
    .trxRow{width:100%;height:44px;min-width:1802px;display:grid;grid-template-columns:34px 112px 166px 78px 82px minmax(300px,.95fr) minmax(420px,1.3fr) minmax(360px,1.12fr) 180px 78px 92px;align-items:center;gap:7px;padding:10px 11px;border:0;border-bottom:1px solid rgba(243,234,211,.08);background:transparent;text-align:left;cursor:pointer}.trxRow:hover,.trxRow.selected{background:rgba(198,161,91,.09)}.trxRow span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.preview-status.success{color:var(--green)}.preview-status.error{color:var(--red)}.preview-tool{color:var(--amber);font-weight:700}.preview-time,.preview-branch,.preview-tokens,.preview-latency{color:var(--muted)}
    .trxRail{min-width:0;min-height:0;height:100%;overflow:hidden}.trxRailInner{width:100%;height:100%;min-height:0;padding:0;overflow:hidden}
    .trace-synthetic-preview{position:fixed;right:14px;bottom:14px;z-index:10000;border:1px solid rgba(243,234,211,.2);border-radius:999px;background:#0b0907;color:#d8cdbb;padding:8px 11px;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 12px 36px rgba(0,0,0,.4)}
    @media(max-width:900px){.preview-page{padding:0}.preview-top{min-height:58px;align-items:center;padding:10px 12px}.preview-top h1{font-size:21px}.preview-top .eyebrow,.preview-note{display:none}.cmdkMenuLaunch{display:inline-flex!important}.trxShell{height:calc(100dvh - 58px);min-height:0;border:0;border-radius:0}.preview-layout{display:block}.preview-list{height:100%;border-right:0}.preview-list header{padding:13px}.trxRow{min-width:1542px;grid-template-columns:34px 112px 176px 66px 68px 250px 290px 270px 140px 70px 78px}.preview-latency{display:block}.trxRail{display:none}.trxShell.detail-open .trxRail{display:block}.trace-synthetic-preview{right:8px;bottom:8px;font-size:9px}}
  </style>
</head>
<body data-trace-preview="synthetic">
  <div class="preview-page">
    <header class="preview-top">
      <div><div class="eyebrow">Internal observability UI</div><h1>Trace Burn Intelligence</h1></div>
      <p class="preview-note">Sanitized Cloudflare deployment using synthetic traces. The private Tailnet site remains the data-connected surface.</p>
      <button class="cmdkMenuLaunch" type="button" aria-label="Preview menu">Menu /</button>
    </header>
    <main id="tbmLiveTraceModal" class="open">
      <section class="trxShell detail-open">
        <div class="preview-layout">
          <section class="preview-list" aria-label="Synthetic trace list">
            <header><span>Trace stream</span><h2>Synthetic branch</h2><p>Select a call to inspect branch token totals, payloads, metadata, and actionable errors.</p></header>
            <div class="preview-rows" data-trace-virtual-list data-trace-total="${SYNTHETIC_TRACE_FEED.rows.length}"><div data-trace-virtual-content></div></div>
          </section>
          <aside class="trxRail" aria-label="Trace detail"><div class="trxRailInner" data-inspector></div></aside>
        </div>
      </section>
    </main>
  </div>
  <div class="trace-synthetic-preview" role="status">Cloudflare preview \u00B7 synthetic traces only</div>
  <script id="trace-seed-data" type="application/json">${seed}</script>
  <script>
    (() => {
      const feed = JSON.parse(document.getElementById('trace-seed-data').textContent || '{"rows":[]}');
      const traceMap = new Map();
      for (const row of feed.rows || []) {
        traceMap.set(String(row.recordId || row.id), row);
        if (row.traceId) traceMap.set(String(row.traceId), row);
      }
      window.__traceRowsByTraceId = traceMap;
      const shell = document.querySelector('.trxShell');
      const inspector = document.querySelector('[data-inspector]');
      const select = (key) => {
        for (const button of document.querySelectorAll('.trxRow')) {
          const active = button.dataset.traceKey === key;
          button.classList.toggle('selected', active);
          button.setAttribute('aria-selected', String(active));
        }
        shell.classList.add('detail-open');
        history.replaceState(null, '', '#trace=' + encodeURIComponent(key));
      };
      document.addEventListener('click', (event) => {
        const row = event.target.closest('.trxRow');
        if (row) select(row.dataset.traceKey || '');
        if (event.target.closest('[data-ti-back]')) {
          shell.classList.remove('detail-open');
          for (const button of document.querySelectorAll('.trxRow')) button.classList.remove('selected');
          if (inspector) inspector.innerHTML = '';
          history.replaceState(null, '', location.pathname);
        }
      });
      select('demo-record-005');
    })();
  </script>
  <script type="module" src="${INSPECTOR_SCRIPT_SRC}"></script>
</body>
</html>`;
}

export async function buildSanitizedTracePreview(input: {
  archiveRoot: string;
  outputRoot: string;
}): Promise<{ outputRoot: string; siteRoot: string; files: string[] }> {
  const outputRoot = resolve(input.outputRoot);
  try {
    const archiveRoot = resolve(input.archiveRoot);
    const siteRoot = join(outputRoot, 'trace-burn-intelligence');
    await access(join(archiveRoot, '_astro', basename(INSPECTOR_CSS_HREF)));
    await access(join(archiveRoot, '_astro', basename(INSPECTOR_SCRIPT_SRC)));
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(join(siteRoot, '_astro'), { recursive: true });

    const html = standaloneTracePreviewHtml();
    assertSanitizedTracePreview(html, 'standalone sanitized preview');
    const feed = JSON.stringify(SYNTHETIC_TRACE_FEED, null, 2) + '\n';
    assertSanitizedTracePreview(feed, 'synthetic feed');
    const assets = [
      basename(INSPECTOR_CSS_HREF),
      basename(INSPECTOR_SCRIPT_SRC),
    ];
    const copied: string[] = [];
    for (const name of assets) {
      const destination = join(siteRoot, '_astro', name);
      await copyFile(join(archiveRoot, '_astro', name), destination);
      copied.push(destination);
    }

    await writeFile(join(siteRoot, 'index.html'), html);
    await writeFile(join(siteRoot, 'live-traces.json'), feed);
    await writeFile(
      join(outputRoot, 'index.html'),
      '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/trace-burn-intelligence/"><title>Trace preview</title><a href="/trace-burn-intelligence/">Open sanitized trace preview</a>\n',
    );
    await writeFile(
      join(outputRoot, '_headers'),
      '/trace-burn-intelligence/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n',
    );

    return {
      outputRoot,
      siteRoot,
      files: [
        join(siteRoot, 'index.html'),
        join(siteRoot, 'live-traces.json'),
        ...copied,
      ],
    };
  } catch (error: unknown) {
    await rm(outputRoot, { recursive: true, force: true }).catch(
      () => undefined,
    );
    throw new Error(
      `Failed to build sanitized trace preview: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
function parseArgs(argv: string[]): {
  archiveRoot: string;
  outputRoot: string;
} {
  let archiveRoot = '';
  let outputRoot = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--archive-root') archiveRoot = argv[++index] ?? '';
    else if (arg === '--output-root') outputRoot = argv[++index] ?? '';
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!archiveRoot || !outputRoot)
    throw new Error('--archive-root and --output-root are required');
  return { archiveRoot, outputRoot };
}

if (import.meta.main) {
  buildSanitizedTracePreview(parseArgs(process.argv.slice(2)))
    .then((result) =>
      process.stdout.write(
        `${JSON.stringify({ ok: true, ...result }, null, 2)}\n`,
      ),
    )
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
