import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
} from '../scripts/trace-site-inspector/preview';

import {
  INSPECTOR_CSS_HREF,
  INSPECTOR_SCRIPT_SRC,
  INSPECTOR_VERSION,
  patchTraceInspectorHtml,
} from '../scripts/trace-site-inspector/deploy';

import {
  mergeTraceRows,
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
  test('uses stable trace identity and deduplicates alias entries in branch totals', () => {
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

  test('prefers a nested actionable child failure over a generic command failure', () => {
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
  test('merges cursor pages, deduplicates identities, and retains a bounded window around selection', () => {
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

  test('prefetches from virtual range proximity only when another cursor page is available', () => {
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
  test('patches versioned overlay assets exactly once', () => {
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

  test('ships real preview sections and desktop/mobile layout rules', () => {
    const browserSource = readFileSync(
      new URL('../scripts/trace-site-inspector/browser.ts', import.meta.url),
      'utf8',
    );
    const css = readFileSync(
      new URL('../scripts/trace-site-inspector/inspector.css', import.meta.url),
      'utf8',
    );
    const virtualListSource = readFileSync(
      new URL(
        '../scripts/trace-site-inspector/virtual-list-browser.ts',
        import.meta.url,
      ),
      'utf8',
    );

    for (const section of [
      'summary',
      'input',
      'output',
      'error',
      'metadata',
      'raw',
    ]) {
      expect(browserSource).toContain(`id: '${section}'`);
    }
    expect(browserSource).toContain('sessionStorage');
    expect(browserSource).toContain('MutationObserver');

    expect(virtualListSource).toContain("from '@tanstack/virtual-core'");
    expect(virtualListSource).toContain('new Virtualizer');
    expect(virtualListSource).toContain('shouldPrefetchTracePage');
    expect(virtualListSource).not.toContain('@tanstack/react-virtual');
    expect(virtualListSource).not.toContain("from 'react'");
    expect(INSPECTOR_VERSION).toBe('v29');
    expect(css).toContain('.cmdkMenuLaunch');
    expect(css).toContain('.lfMenuButton');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('100dvh');
    expect(css).toContain('.tiInspector.mobile-menu-open');
  });
});

describe('sanitized Cloudflare trace preview', () => {
  test('replaces private seed data with synthetic rows and rejects private markers', () => {
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

  test('generates a large virtualized preview without server-rendering every trace row', () => {
    const html = standaloneTracePreviewHtml();

    expect(SYNTHETIC_TRACE_FEED.rows.length).toBeGreaterThanOrEqual(5_000);
    expect(html).toContain('data-trace-virtual-list');
    expect(html).toContain('data-trace-virtual-content');
    expect(html).not.toContain('class="trxRow"');
    expect(html).toContain('data-trace-total="5000"');
  });

  test('fails closed when private markers remain', () => {
    for (const marker of PRIVATE_MARKERS) {
      expect(() =>
        assertSanitizedTracePreview(`safe prefix ${marker} unsafe suffix`),
      ).toThrow(marker);
    }
  });
});
