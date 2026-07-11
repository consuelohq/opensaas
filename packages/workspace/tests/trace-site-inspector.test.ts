import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { afterEach, describe, expect, test } from 'vitest';

import {
  branchSummary,
  extractTraceError,
  stableTraceKey,
} from '../scripts/trace-site-inspector/model';
import {
  PRIVATE_MARKERS,
  SYNTHETIC_TRACE_FEED,
  assertSanitizedTracePreview,
  sanitizeTracePreviewHtml,
  standaloneTracePreviewHtml,
  buildSanitizedTracePreview,
  serializeTraceSeed,
} from '../scripts/trace-site-inspector/preview';

import {
  INSPECTOR_CSS_HREF,
  INSPECTOR_SCRIPT_SRC,
  patchTraceInspectorHtml,
} from '../scripts/trace-site-inspector/deploy';

import {
  mergeTraceRows,
  retainTraceWindow,
  shouldPrefetchTracePage,
} from '../scripts/trace-site-inspector/trace-list';

const roots: string[] = [];
afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true });
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'record-a',
  recordId: 'record-a',
  traceId: 'trace-a',
  branch: 'task/trace-site/example',
  name: 'code.call',
  status: 'success',
  durationMs: 120,
  inputTokens: 40,
  outputTokens: 60,
  tokens: 100,
  ...overrides,
});

describe('trace-site inspector model', () => {
  test('should deduplicate alias entries when calculating branch totals', () => {
    const first = row();
    const alias = { ...first };
    const failed = row({
      id: 'record-b',
      recordId: 'record-b',
      traceId: 'trace-b',
      name: 'fs.read',
      status: 'error',
      durationMs: 80,
      inputTokens: 15,
      outputTokens: 5,
      tokens: 20,
    });
    const otherBranch = row({
      id: 'record-c',
      recordId: 'record-c',
      branch: 'task/other',
    });

    expect(stableTraceKey(first)).toBe('record-a');
    expect(
      branchSummary([first, alias, failed, otherBranch], first),
    ).toMatchObject({
      branch: 'task/trace-site/example',
      calls: 2,
      failures: 1,
      durationMs: 200,
      inputTokens: 55,
      outputTokens: 65,
      totalTokens: 120,
    });
  });

  test('should prefer an actionable child failure when the parent error is generic', () => {
    const insight = extractTraceError(
      row({
        status: 'error',
        code: 'COMMAND_FAILED',
        exitCode: 1,
        rawStderr: 'command failed',
        batchResultsJson: [
          { ok: true, tool: 'fs.read', code: 'OK' },
          {
            ok: false,
            tool: 'fs.list',
            code: 'COMMAND_FAILED',
            exitCode: 1,
            stderr: 'packages/trace-site: No such file or directory',
            message: 'command failed',
          },
        ],
      }),
    );

    expect(insight.failedTool).toBe('fs.list');
    expect(insight.code).toBe('COMMAND_FAILED');
    expect(insight.exitCode).toBe(1);
    expect(insight.detail).toContain('No such file or directory');
    expect(insight.detail).not.toBe('command failed');
  });
});

describe('trace-site virtual list state', () => {
  test('should retain a bounded deduplicated window when appending cursor pages', () => {
    const current = Array.from({ length: 8 }, (_, index) =>
      row({
        id: `record-${index}`,
        recordId: `record-${index}`,
        traceId: `trace-${index}`,
        startTime: `2026-07-11T00:00:${String(20 - index).padStart(2, '0')}.000Z`,
      }),
    );
    const incoming = [
      { ...current[7] },
      ...Array.from({ length: 5 }, (_, index) =>
        row({
          id: `record-${index + 8}`,
          recordId: `record-${index + 8}`,
          traceId: `trace-${index + 8}`,
          startTime: `2026-07-11T00:00:${String(12 - index).padStart(2, '0')}.000Z`,
        }),
      ),
    ];

    const merged = mergeTraceRows(current, incoming, {
      direction: 'append',
      maxRows: 6,
      selectedKey: 'record-9',
    });

    expect(merged).toHaveLength(6);
    expect(merged.map(stableTraceKey)).toEqual([
      'record-7',
      'record-8',
      'record-9',
      'record-10',
      'record-11',
      'record-12',
    ]);
    expect(new Set(merged.map(stableTraceKey)).size).toBe(6);
  });

  test('should retain a contiguous selected window when append eviction would drop selection', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `record-${index}`,
        recordId: `record-${index}`,
        traceId: `trace-${index}`,
      }),
    );

    expect(
      retainTraceWindow(rows, 4, 'append', 'record-2').map(stableTraceKey),
    ).toEqual(['record-2', 'record-3', 'record-4', 'record-5']);
  });

  test('should retain a contiguous selected window when prepend eviction would drop selection', () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row({
        id: `record-${index}`,
        recordId: `record-${index}`,
        traceId: `trace-${index}`,
      }),
    );

    expect(
      retainTraceWindow(rows, 4, 'prepend', 'record-7').map(stableTraceKey),
    ).toEqual(['record-4', 'record-5', 'record-6', 'record-7']);
  });

  test('should request prefetch when the virtual range approaches an available next page', () => {
    expect(
      shouldPrefetchTracePage({
        lastVirtualIndex: 224,
        rowCount: 250,
        threshold: 25,
        nextCursor: 'cursor-2',
        fetching: false,
      }),
    ).toBe(true);
    expect(
      shouldPrefetchTracePage({
        lastVirtualIndex: 180,
        rowCount: 250,
        threshold: 25,
        nextCursor: 'cursor-2',
        fetching: false,
      }),
    ).toBe(false);
    expect(
      shouldPrefetchTracePage({
        lastVirtualIndex: 249,
        rowCount: 250,
        threshold: 25,
        nextCursor: null,
        fetching: false,
      }),
    ).toBe(false);
    expect(
      shouldPrefetchTracePage({
        lastVirtualIndex: 249,
        rowCount: 250,
        threshold: 25,
        nextCursor: 'cursor-2',
        fetching: true,
      }),
    ).toBe(false);
  });
});

describe('trace-site inspector deployment contract', () => {
  test('should patch versioned overlay assets once when deployment runs repeatedly', () => {
    const html =
      '<!doctype html><html><head><title>Trace</title></head><body><main></main></body></html>';
    const once = patchTraceInspectorHtml(html);
    const twice = patchTraceInspectorHtml(once);

    expect(once).toContain(INSPECTOR_CSS_HREF);
    expect(once).toContain(INSPECTOR_SCRIPT_SRC);
    expect(
      twice.match(new RegExp(INSPECTOR_CSS_HREF.replaceAll('/', '\\/'), 'g')),
    ).toHaveLength(1);
    expect(
      twice.match(new RegExp(INSPECTOR_SCRIPT_SRC.replaceAll('/', '\\/'), 'g')),
    ).toHaveLength(1);
  });

  test('should preserve interactive inspector behavior when the trace list is virtualized', async () => {
    const root = mkdtempSync(join(tmpdir(), 'trace-inspector-runtime-'));
    roots.push(root);
    const archiveRoot = join(root, 'site');
    mkdirSync(join(archiveRoot, '_astro'), { recursive: true });
    const runtimeRows = Array.from({ length: 500 }, (_, index) =>
      row({
        id: `runtime-record-${index}`,
        recordId: `runtime-record-${index}`,
        traceId: `runtime-trace-${index}`,
        displayTime: `00:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
        output: `runtime output ${index}`,
      }),
    );
    const runtimeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;height:100%}.trxShell{display:grid;grid-template-columns:45% 55%;height:100vh}.trxTableScroll{height:100vh;overflow:auto}.trxRail{height:100vh}.trxRailInner,[data-inspector]{height:100%}
      </style></head><body>
        <div class="trxShell detail-open">
          <div class="trxTableScroll"><div data-trace-rows></div></div>
          <div class="trxRail"><button type="button" data-ti-back>Back</button><div class="trxRailInner"><div data-inspector></div></div></div>
        </div>
        <script id="trace-seed-data" type="application/json">${serializeTraceSeed({ meta: { nextCursor: 'cursor-2' }, rows: runtimeRows })}</script>
      </body></html>`;
    const scriptPath = join(archiveRoot, '_astro', 'trace-inspector-v29.js');
    const cssPath = join(archiveRoot, '_astro', 'trace-inspector-v29.css');
    execFileSync(
      'bun',
      [
        'build',
        new URL('../scripts/trace-site-inspector/browser.ts', import.meta.url)
          .pathname,
        '--target=browser',
        '--format=esm',
        `--outfile=${scriptPath}`,
      ],
      { stdio: 'pipe' },
    );
    copyFileSync(
      new URL('../scripts/trace-site-inspector/inspector.css', import.meta.url),
      cssPath,
    );

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      page.setDefaultTimeout(5_000);
      let prefetchCursor = '';
      await page.exposeFunction('capturePrefetchCursor', (cursor: string) => {
        prefetchCursor = cursor;
      });
      await page.setContent(runtimeHtml, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        history.replaceState(null, '', '#trace=runtime-record-0');
        document.addEventListener('trace:prefetch-request', (event) => {
          const detail = (event as CustomEvent<{ cursor: string }>).detail;
          event.preventDefault();
          void (
            window as Window & {
              capturePrefetchCursor: (cursor: string) => Promise<void>;
            }
          ).capturePrefetchCursor(detail.cursor);
        });
      });
      await page.addStyleTag({ path: cssPath });
      await page.addScriptTag({ path: scriptPath, type: 'module' });
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.trxRow').length > 0 &&
          Boolean(document.querySelector('.tiInspector')),
      );

      const desktop = await page.evaluate(() => {
        const list = document.querySelector<HTMLElement>('.trxTableScroll');
        return {
          total: Number(list?.dataset.traceTotal ?? 0),
          mounted: document.querySelectorAll('.trxRow').length,
          tabs: Array.from(
            document.querySelectorAll<HTMLElement>('[data-ti-tab]'),
          ).map((tab) => tab.dataset.tiTab),
        };
      });
      expect(desktop.total).toBe(500);
      expect(desktop.mounted).toBeGreaterThan(0);
      expect(desktop.mounted).toBeLessThan(100);
      expect(desktop.tabs).toEqual([
        'summary',
        'input',
        'output',
        'error',
        'metadata',
        'raw',
      ]);

      await page.evaluate(() => {
        const list = document.querySelector<HTMLElement>('.trxTableScroll');
        if (list) list.scrollTop = list.scrollHeight;
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector<HTMLElement>('.trxTableScroll')
            ?.dataset.traceRange?.endsWith('499') ?? false,
      );
      await expect.poll(() => prefetchCursor).toBe('cursor-2');

      await page.setViewportSize({ width: 390, height: 844 });
      const mobile = await page.evaluate(() => ({
        viewport: [innerWidth, innerHeight],
        mounted: document.querySelectorAll('.trxRow').length,
        backDisplay: getComputedStyle(
          document.querySelector<HTMLElement>('.tiMobileBack')!,
        ).display,
      }));
      expect(mobile.viewport).toEqual([390, 844]);
      expect(mobile.mounted).toBeLessThan(100);
      expect(mobile.backDisplay).not.toBe('none');

      await page.locator('.tiMobileBack').click();
      await page.waitForFunction(
        () =>
          !(window as Window & { __traceSelectedKey?: string })
            .__traceSelectedKey &&
          !document.querySelector('[data-inspector] .tiInspector'),
      );
    } finally {
      await browser.close();
    }
  }, 15_000);
});

describe('sanitized Cloudflare trace preview', () => {
  test('should replace private seed data when building a sanitized preview', () => {
    const privateHtml =
      '<!doctype html><html><head></head><body><script id="trace-seed-data" type="application/json">{"path":"/Users/private/worktree","trace":"trc_private"}</script></body></html>';
    const sanitized = sanitizeTracePreviewHtml(privateHtml);

    expect(sanitized).toContain('Cloudflare preview · synthetic traces only');
    expect(sanitized).toContain('demo-trace-005');
    expect(sanitized).not.toContain('/Users/private');
    expect(sanitized).not.toContain('trc_private');
    expect(() => assertSanitizedTracePreview(sanitized)).not.toThrow();
    expect(SYNTHETIC_TRACE_FEED.meta.synthetic).toBe(true);
    expect(SYNTHETIC_TRACE_FEED.failures.length).toBeGreaterThan(1);
    expect(
      SYNTHETIC_TRACE_FEED.failures.some(
        (failure) => failure.recordId === 'demo-record-005',
      ),
    ).toBe(true);
  });

  test('should avoid server-rendering trace rows when generating a large preview', () => {
    const html = standaloneTracePreviewHtml();

    expect(SYNTHETIC_TRACE_FEED.rows.length).toBeGreaterThanOrEqual(5_000);
    expect(html).toContain('data-trace-virtual-list');
    expect(html).toContain('data-trace-virtual-content');
    expect(html).not.toContain('class="trxRow"');
    expect(html).toContain('data-trace-total="5000"');
  });

  test('should escape script-closing markup when serializing trace seed data', () => {
    expect(serializeTraceSeed({ output: '</script><img src=x>' })).toBe(
      '{"output":"\\u003c/script>\\u003cimg src=x>"}',
    );
  });

  test('should emit line-based Cloudflare files when building preview output', async () => {
    const root = mkdtempSync(join(tmpdir(), 'trace-preview-files-'));
    roots.push(root);
    const archiveRoot = join(root, 'archive');
    const outputRoot = join(root, 'public');
    mkdirSync(join(archiveRoot, '_astro'), { recursive: true });
    writeFileSync(
      join(archiveRoot, '_astro', 'trace-inspector-v29.css'),
      'body{}',
    );
    writeFileSync(
      join(archiveRoot, '_astro', 'trace-inspector-v29.js'),
      'export{}',
    );

    await buildSanitizedTracePreview({ archiveRoot, outputRoot });

    const headers = readFileSync(join(outputRoot, '_headers'), 'utf8');
    const redirect = readFileSync(join(outputRoot, 'index.html'), 'utf8');
    const feed = readFileSync(
      join(outputRoot, 'trace-burn-intelligence', 'live-traces.json'),
      'utf8',
    );
    expect(headers.split('\n')).toEqual([
      '/trace-burn-intelligence/*',
      '  Cache-Control: no-store',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: no-referrer',
      '',
    ]);
    expect(headers).not.toContain('\\n');
    expect(redirect.endsWith('\n')).toBe(true);
    expect(redirect).not.toContain('\\n');
    expect(feed.endsWith('\n')).toBe(true);
    expect(feed.endsWith('\\n')).toBe(false);
  });

  test('should fail closed when a private marker remains in preview output', () => {
    for (const marker of PRIVATE_MARKERS) {
      expect(() =>
        assertSanitizedTracePreview(`safe prefix ${marker} unsafe suffix`),
      ).toThrow(marker);
    }
  });
});
