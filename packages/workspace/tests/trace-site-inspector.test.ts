import {
  copyFileSync,
  existsSync,
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
import { afterEach, describe, expect, test, vi } from 'vitest';

const browserTest = playwrightChromiumAvailable() ? test : test.skip;

function playwrightChromiumAvailable(): boolean {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

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
  TRUSTED_TRACE_HISTORY_TRANSPORT_SCRIPT,
  patchTraceInspectorHtml,
} from '../scripts/trace-site-inspector/deploy';

import { createArchiveTraceHistoryResponse } from '../scripts/trace-site-inspector/archive-history';

import {
  mergeTraceRows,
  retainTraceWindow,
  shouldPrefetchTracePage,
} from '../scripts/trace-site-inspector/trace-list';
import {
  deriveTraceHistoryCursor,
  parseTraceLiveResponse,
  parseTraceHistoryResponse,
  traceHistoryUrl,
  traceLiveUrl,
} from '../scripts/trace-site-inspector/pagination-browser';
import {
  createInspectorState,
  filterInspectorCalls,
  inspectorSections,
  isWorkpadTrace,
  normalizeBranchBreadcrumb,
  reduceInspectorState,
  workpadTraceValue,
} from '../scripts/trace-site-inspector/inspector-state';
import {
  formatTraceTableRow,
  matchesTraceTableFilters,
  traceFilterFacets,
} from '../scripts/trace-site-inspector/table-formatters';
import { childTraceRecords } from '../scripts/trace-site-inspector/model';

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

describe('trace-site semantic table formatting', () => {
  test('should give code.call a language-mode label and remove the redundant prefix', () => {
    const formatted = formatTraceTableRow(
      row({
        name: 'code.call',
        rawResolvedInputJson: {
          language: 'bun',
          mode: 'read',
          code: 'await Promise.all(files.map((file) => Bun.file(file).text()))',
        },
        input: 'bun/read - read 7 files: auth.ts, types.ts, stores.ts',
        output: 'completed - no file changes',
      }),
    );

    expect(formatted).toMatchObject({
      toolLabel: 'bun.read',
      inputLabel: 'read 7 files: auth.ts, types.ts, stores.ts',
      outputLabel: 'read complete',
      isError: false,
    });
    expect(formatted.inputLabel).not.toContain(' - ');
  });

  test('should summarize live code.call rows whose table input is stringified JSON', () => {
    const payload = {
      language: 'bun',
      mode: 'read',
      code: 'const source = await Bun.file("packages/workspace/src/generated/workspace.d.ts").text()',
    };
    const formatted = formatTraceTableRow(
      row({
        name: 'code.call',
        rawResolvedInputJson: JSON.stringify(payload),
        input: JSON.stringify(payload),
      }),
    );

    expect(formatted.toolLabel).toBe('bun.read');
    expect(formatted.inputLabel).toBe('read workspace.d.ts');
    expect(formatted.inputLabel).not.toContain('{');
  });

  test('should summarize spawned verification, deployment, and patch commands at a glance', () => {
    const cases = [
      {
        mode: 'verify',
        code: 'const child = Bun.spawnSync(["bun", "x", "vitest", "run", "packages/workspace/tests/trace-site-inspector.test.ts"], { stdout: "pipe" })',
        tableInput:
          'bun/verify - const child = Bun.spawnSync(["bun", "x", "vitest", "run", "packages/workspace/tests/trace-site-inspector.test.ts"], { stdout: "pipe" })',
        expected: 'test trace-site-inspector.test.ts',
      },
      {
        mode: 'edit',
        code: 'Bun.spawnSync(["bun", "packages/workspace/scripts/trace-site-inspector/deploy.ts", "--dry-run"])',
        expected: 'run deploy.ts',
      },
      {
        mode: 'edit',
        code: 'const patch = "*** Begin Patch\n*** Update File: packages/a.ts\n*** Add File: packages/b.ts\n*** End Patch"',
        expected: 'edit 2 files · a.ts, b.ts',
      },
    ];

    for (const item of cases) {
      const payload = { language: 'bun', mode: item.mode, code: item.code };
      expect(
        formatTraceTableRow(
          row({
            name: 'code.call',
            rawResolvedInputJson: payload,
            input: item.tableInput ?? item.code,
          }),
        ).inputLabel,
      ).toBe(item.expected);
    }
  });

  test('should identify workpad activity and replace raw source code with readable actions', () => {
    const workpadEdit = formatTraceTableRow(
      row({
        name: 'code.call',
        rawResolvedInputJson: {
          language: 'bun',
          mode: 'edit',
          code: `const text = await Bun.file('.task/workspace/ship/workpad.md').text(); await Bun.write('.task/workspace/ship/workpad.md', text + '\\nproof')`,
        },
      }),
    );
    expect(workpadEdit).toMatchObject({
      toolLabel: 'workpad.edit',
      inputLabel: 'edit workpad.md',
    });

    const search = formatTraceTableRow(
      row({
        name: 'code.call',
        rawResolvedInputJson: {
          language: 'bun',
          mode: 'read',
          code: `const matches = source.matchAll(/(?:Tests?|test)\\s+(\\d+)\\s+failed/gi); return [...matches].map((match) => match[1])`,
        },
      }),
    );
    expect(search.inputLabel).toBe('inspect test failures');
    expect(search.inputLabel).not.toMatch(/[{}()"';]/);
  });

  test('should format frequent tools with concise human-readable labels and summaries', () => {
    const cases = [
      {
        trace: row({
          name: 'tools.search',
          rawResolvedInputJson: { query: 'trace formatter keywords', limit: 8 },
        }),
        tool: 'search',
        input: 'trace formatter keywords',
      },
      {
        trace: row({
          name: 'fs.apply_patch',
          rawResolvedInputJson: {
            patch:
              '*** Begin Patch\n*** Update File: packages/a.ts\n*** Add File: packages/b.ts\n*** End Patch',
          },
          output: 'patch applied',
        }),
        tool: 'fs.patch',
        input: 'patch 2 files · a.ts, b.ts',
      },
      {
        trace: row({
          name: 'github',
          rawResolvedInputJson: {
            operation: 'pr.view',
            repo: 'consuelohq/opensaas',
            pr: 1496,
          },
        }),
        tool: 'github.pr.view',
        input: 'PR #1496 · consuelohq/opensaas',
      },
      {
        trace: row({
          name: 'review.run',
          rawResolvedInputJson: { base: 'stream/trace-site' },
        }),
        tool: 'review',
        input: 'stream/trace-site',
      },
      {
        trace: row({
          name: 'fs.search',
          rawResolvedInputJson: { query: 'data-filter' },
        }),
        tool: 'files.search',
        input: 'data-filter',
      },
    ];

    for (const item of cases) {
      const formatted = formatTraceTableRow(item.trace);
      expect(formatted.toolLabel).toBe(item.tool);
      expect(formatted.inputLabel).toBe(item.input);
    }
  });

  test('should surface actionable failures in both table text columns', () => {
    const formatted = formatTraceTableRow(
      row({
        name: 'code.call',
        status: 'error',
        code: 'COMMAND_FAILED',
        rawResolvedInputJson: {
          language: 'python',
          mode: 'verify',
          code: 'run_tests()',
        },
        input: 'python/verify - test trace-site',
        output: 'failed - 2 tests failed',
        rawStderr: 'AssertionError: expected 401, received 200',
      }),
    );

    expect(formatted.toolLabel).toBe('python.verify');
    expect(formatted.inputLabel).toBe('test trace-site');
    expect(formatted.outputLabel).toContain('expected 401, received 200');
    expect(formatted.isError).toBe(true);
  });

  test('should enrich live batch children from their ordered input steps', () => {
    const parent = row({
      name: 'batch',
      rawResolvedInputJson: {
        steps: [
          {
            tool: 'code.call',
            input: {
              language: 'bun',
              mode: 'read',
              code: 'await Bun.file("child-a.txt").text()',
            },
          },
          {
            tool: 'tools.search',
            input: { query: 'missing fixture' },
          },
        ],
      },
      batchResultsJson: [
        {
          traceId: 'child-a',
          ok: true,
          code: 'OK',
          durationMs: 11,
          data: { output: 'child A output' },
        },
        {
          traceId: 'child-b',
          ok: false,
          code: 'COMMAND_FAILED',
          durationMs: 22,
          message: 'child B failed',
        },
      ],
    });
    const children = childTraceRecords(parent);

    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({
      name: 'code.call',
      input: {
        language: 'bun',
        mode: 'read',
        code: 'await Bun.file("child-a.txt").text()',
      },
    });
    expect(formatTraceTableRow(children[0]).toolLabel).toBe('bun.read');
    expect(formatTraceTableRow(children[1])).toMatchObject({
      toolLabel: 'search',
      inputLabel: 'missing fixture',
      isError: true,
    });
  });

  test('should expose counted semantic tool and branch checkbox facets', () => {
    const rows = [
      row({
        recordId: 'read-a',
        id: 'read-a',
        name: 'code.call',
        branch: 'task/trace-site/a',
        rawResolvedInputJson: { language: 'bun', mode: 'read' },
      }),
      row({
        recordId: 'read-b',
        id: 'read-b',
        name: 'code.call',
        branch: 'task/trace-site/a',
        rawResolvedInputJson: { language: 'bun', mode: 'read' },
      }),
      row({
        recordId: 'verify',
        id: 'verify',
        name: 'verify',
        branch: 'task/trace-site/b',
        status: 'error',
      }),
    ];
    const facets = traceFilterFacets(rows);

    expect(facets.tools.slice(0, 2)).toEqual([
      { value: 'bun.read', count: 2 },
      { value: 'verify', count: 1 },
    ]);
    expect(facets.branches).toEqual([
      { value: 'task/trace-site/a', count: 2 },
      { value: 'task/trace-site/b', count: 1 },
    ]);
    expect(
      matchesTraceTableFilters(rows[0], {
        query: '',
        tools: new Set(['bun.read']),
        branches: new Set(['task/trace-site/a']),
        statuses: new Set(['success']),
      }),
    ).toBe(true);
    expect(
      matchesTraceTableFilters(rows[2], {
        query: '',
        tools: new Set(['bun.read']),
        branches: new Set(),
        statuses: new Set(),
      }),
    ).toBe(false);
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

  test('should retain newest rows and current selection when appending older history', () => {
    const current = Array.from({ length: 6 }, (_, index) =>
      row({
        id: `record-${index}`,
        recordId: `record-${index}`,
        traceId: `trace-${index}`,
      }),
    );
    const older = Array.from({ length: 3 }, (_, index) =>
      row({
        id: `record-${index + 6}`,
        recordId: `record-${index + 6}`,
        traceId: `trace-${index + 6}`,
      }),
    );

    expect(
      mergeTraceRows(current, older, {
        direction: 'history',
        maxRows: 6,
        selectedKey: 'record-4',
      }).map(stableTraceKey),
    ).toEqual([
      'record-0',
      'record-1',
      'record-2',
      'record-3',
      'record-4',
      'record-5',
    ]);
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

  test('should derive and parse the same-origin older-history transport contract', () => {
    const rows = [
      row({ id: 'record-1', recordId: 'record-1' }),
      row({ id: 'record-2', recordId: 'record-2' }),
    ];

    expect(deriveTraceHistoryCursor(rows)).toBe('id:record-2');
    expect(deriveTraceHistoryCursor(rows, '000000000123')).toBe('000000000123');
    expect(traceHistoryUrl('id:record-2', 75)).toBe(
      '/gateway/traces/recent?direction=older&cursor=id%3Arecord-2&limit=75&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
    );
    expect(
      parseTraceHistoryResponse({
        ok: true,
        data: {
          direction: 'older',
          rows,
          nextCursor: null,
        },
      }),
    ).toEqual({ rows, nextCursor: null });
    expect(() =>
      parseTraceHistoryResponse({
        ok: true,
        data: { direction: 'older', rows: 'not-an-array', nextCursor: null },
      }),
    ).toThrow('rows');
  });

  test('should derive and parse the one-second SQLite newer-trace cursor contract', () => {
    expect(traceLiveUrl('000000000123', 100)).toBe(
      '/gateway/traces/recent?direction=newer&cursor=000000000123&limit=100&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
    );
    const rows = [row({ id: 'live-1', recordId: 'live-1' })];
    expect(
      parseTraceLiveResponse({
        ok: true,
        data: {
          direction: 'newer',
          rows,
          nextCursor: '000000000124',
        },
      }),
    ).toEqual({ rows, nextCursor: '000000000124' });
  });

  test('should expose older history only through the trusted private archive boundary', async () => {
    const readHistoryPage = vi.fn(async () => ({
      rows: [row({ id: 'older-1', recordId: 'older-1' })],
      nextCursor: null,
    }));
    const backend = {
      readRecentEvents: vi.fn(),
      readCachedAggregate: vi.fn(),
      readHistoryPage,
    };

    const denied = await createArchiveTraceHistoryResponse({
      request: new Request(
        'https://private.example/gateway/traces/recent?direction=older&cursor=id%3Arecord-2&limit=75&site=trace-burn-intelligence&sourceMode=local-networked',
      ),
      dbPath: '/private/traces.db',
      backend,
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      ok: false,
      error: { code: 'RAW_PAYLOAD_ACCESS_DENIED' },
    });
    expect(readHistoryPage).not.toHaveBeenCalled();

    const allowed = await createArchiveTraceHistoryResponse({
      request: new Request(
        'https://private.example/gateway/traces/recent?direction=older&cursor=id%3Arecord-2&limit=75&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
      ),
      dbPath: '/private/traces.db',
      backend,
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      ok: true,
      publicBoundary: 'consuelo-sites-private-archive',
      data: {
        direction: 'older',
        rows: [{ recordId: 'older-1' }],
        nextCursor: null,
      },
    });
    expect(readHistoryPage).toHaveBeenCalledWith({
      workspaceId: 'private-tailnet-archive',
      workspaceHost: 'private.example',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'id:record-2',
      limit: 75,
    });
  });

  test('should expose newer rows through the same trusted SQLite cursor boundary', async () => {
    const readNewerPage = vi.fn(async () => ({
      rows: [row({ id: 'live-1', recordId: 'live-1' })],
      nextCursor: '000000000124',
    }));
    const response = await createArchiveTraceHistoryResponse({
      request: new Request(
        'https://private.example/gateway/traces/recent?direction=newer&cursor=000000000123&limit=100&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
      ),
      dbPath: '/private/traces.db',
      backend: {
        readRecentEvents: vi.fn(),
        readCachedAggregate: vi.fn(),
        readNewerPage,
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        direction: 'newer',
        rows: [{ recordId: 'live-1' }],
        nextCursor: '000000000124',
      },
    });
    expect(readNewerPage).toHaveBeenCalledOnce();
  });

  test('should enrich paginated batch children from their ordered batch steps', async () => {
    const root = mkdtempSync(join(tmpdir(), 'trace-history-batch-'));
    roots.push(root);
    const dbPath = join(root, 'traces.db');
    const inputJson = JSON.stringify({
      steps: [
        { tool: 'fs.read', input: { path: 'child-a.txt' } },
        { tool: 'fs.list', input: { path: 'missing' } },
      ],
    });
    const resultJson = JSON.stringify({
      data: {
        results: [
          {
            ok: true,
            code: 'OK',
            traceId: 'child-a-trace',
            durationMs: 11,
            inputTokens: 1,
            outputTokens: 2,
            data: { output: 'child A output' },
          },
          {
            ok: false,
            code: 'COMMAND_FAILED',
            traceId: 'child-b-trace',
            durationMs: 22,
            inputTokens: 3,
            outputTokens: 4,
            message: 'child B failed',
            data: { output: 'child B output' },
          },
        ],
      },
    });
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
    execFileSync('sqlite3', [
      dbPath,
      `CREATE TABLE tool_traces (trace_id TEXT, tool TEXT, input_json TEXT, result_json TEXT); INSERT INTO tool_traces VALUES ('batch-trace', 'batch', ${quote(inputJson)}, ${quote(resultJson)});`,
    ]);

    const backend = {
      readRecentEvents: vi.fn(),
      readCachedAggregate: vi.fn(),
      readHistoryPage: vi.fn(async () => ({
        rows: [
          row({
            id: 'batch-history',
            recordId: 'batch-history',
            traceId: 'batch-trace',
            name: 'batch',
          }),
        ],
        nextCursor: null,
      })),
    };
    const response = await createArchiveTraceHistoryResponse({
      request: new Request(
        'https://private.example/gateway/traces/recent?direction=older&cursor=id%3Abatch-history&limit=75&site=trace-burn-intelligence&sourceMode=local-networked&includeRawPayload=true',
      ),
      dbPath,
      backend,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        rows: [
          {
            recordId: 'batch-history',
            batchResultsCount: 2,
            batchResultsJson: [
              {
                tool: 'fs.read',
                name: 'fs.read',
                traceName: 'fs.read',
                traceId: 'child-a-trace',
                status: 'success',
                code: 'OK',
                durationMs: 11,
                inputTokens: 1,
                outputTokens: 2,
                input: { path: 'child-a.txt' },
                output: 'child A output',
                rawResultJson: { ok: true },
              },
              {
                tool: 'fs.list',
                name: 'fs.list',
                traceName: 'fs.list',
                traceId: 'child-b-trace',
                status: 'error',
                code: 'COMMAND_FAILED',
                durationMs: 22,
                inputTokens: 3,
                outputTokens: 4,
                input: { path: 'missing' },
                output: 'child B output',
                rawResultJson: { ok: false, message: 'child B failed' },
              },
            ],
          },
        ],
        nextCursor: null,
      },
    });
  });
});

describe('trace-site inspector state contract', () => {
  test('should keep the selected trace open when live rows replace the visible feed', () => {
    const selected = row({
      id: 'selected-record',
      recordId: 'selected-record',
      traceId: 'selected-trace',
      output: 'selected output',
    });
    let state = createInspectorState();
    state = reduceInspectorState(state, {
      type: 'select',
      key: stableTraceKey(selected),
      row: selected,
    });
    state = reduceInspectorState(state, {
      type: 'rows-replaced',
      rows: [row({ id: 'new-live-record', traceId: 'new-live-trace' })],
    });

    expect(state.selectedKey).toBe('selected-record');
    expect(state.selectedRow).toMatchObject({ output: 'selected output' });
    expect(state.layout).toBe('split');
  });

  test('should preserve selection through resize, collapse, and full-screen transitions', () => {
    const selected = row({
      id: 'selected-record',
      recordId: 'selected-record',
      traceId: 'selected-trace',
    });
    let state = reduceInspectorState(createInspectorState(), {
      type: 'select',
      key: stableTraceKey(selected),
      row: selected,
    });
    state = reduceInspectorState(state, { type: 'resize', width: 720 });
    state = reduceInspectorState(state, { type: 'toggle-fullscreen' });
    state = reduceInspectorState(state, { type: 'toggle-fullscreen' });
    state = reduceInspectorState(state, { type: 'toggle-collapse' });

    expect(state.selectedKey).toBe('selected-record');
    expect(state.selectedRow).toEqual(selected);
    expect(state.width).toBe(720);
    expect(state.layout).toBe('collapsed');
  });

  test('should expose stacked typed sections and one formatted-or-json mode', () => {
    const selected = row({
      rawResolvedInputJson: { path: 'workpad.md' },
      outputObj: { ok: true },
      metadata: { provider: 'langfuse' },
      rawStderr: 'test failed',
      status: 'error',
    });
    const sections = inspectorSections(selected);

    expect(sections.map((section) => section.id)).toEqual([
      'input',
      'output',
      'error',
      'metadata',
    ]);
    expect(createInspectorState().displayMode).toBe('formatted');
    expect(
      reduceInspectorState(createInspectorState(), {
        type: 'set-display-mode',
        mode: 'json',
      }).displayMode,
    ).toBe('json');
  });

  test('should expose a dedicated workpad mode only for workpad activity', () => {
    const workpad = row({
      name: 'fs.read',
      rawResolvedInputJson: { path: '.task/workspace/ship/workpad.md' },
      rawResultJson: { data: { stdout: '# Workpad\\n\\nCurrent proof.' } },
    });
    expect(isWorkpadTrace(workpad)).toBe(true);
    expect(workpadTraceValue(workpad)).toContain('# Workpad');
    expect(
      reduceInspectorState(createInspectorState(), {
        type: 'set-display-mode',
        mode: 'workpad',
      }).displayMode,
    ).toBe('workpad');
    expect(isWorkpadTrace(row({ name: 'fs.read', input: 'README.md' }))).toBe(
      false,
    );
  });

  test('should normalize branch breadcrumbs and search calls without changing state', () => {
    const state = reduceInspectorState(createInspectorState(), {
      type: 'set-call-query',
      query: 'read',
    });
    const calls = [
      row({ id: 'read', name: 'fs.read', input: 'workpad.md' }),
      row({ id: 'verify', name: 'verify', input: 'unit tests' }),
    ];

    expect(normalizeBranchBreadcrumb('task/security/fix-auth')).toEqual({
      stream: 'security',
      task: 'fix-auth',
      label: 'security / fix-auth',
    });
    expect(filterInspectorCalls(calls, state.callQuery)).toHaveLength(1);
    expect(state.selectedKey).toBe('');
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

  test('should remove the retired cockpit, toolbar, and pagination markup from the trace page', () => {
    const html = `<!doctype html><html><head><title>Trace</title></head><body>
      <div class="screen"><main>retired trace cockpit</main></div>
      <section class="trxShell">
        <div class="trxToolbar"><input placeholder="Search traces..."><select><option>1 day</option></select></div>
        <div class="trxBody">
          <main class="trxTablePane">
            <div class="trxTableScroll"><div data-trace-rows></div></div>
            <footer class="trxFooter">Rows per page 100 Page 1 of 3</footer>
          </main>
          <div class="trxResizer"></div>
          <aside class="trxRail"><div data-inspector>obsolete inspector</div></aside>
        </div>
      </section>
    </body></html>`;

    const patched = patchTraceInspectorHtml(html);

    expect(patched).not.toContain('retired trace cockpit');
    expect(patched).not.toContain('Search traces...');
    expect(patched).not.toContain('Rows per page');
    expect(patched).not.toContain('Page 1 of 3');
    expect(patched).toContain('data-show-filters');
    expect(patched).toContain('data-trace-count');
  });

  browserTest(
    'should render semantic rows, durable checkbox filters, hover detail, and a reversible system font',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'trace-table-runtime-'));
      roots.push(root);
      const scriptPath = join(root, 'trace-inspector-v37.js');
      const cssPath = join(root, 'trace-inspector-v37.css');
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
        new URL(
          '../scripts/trace-site-inspector/inspector.css',
          import.meta.url,
        ),
        cssPath,
      );

      const semanticRows = [
        row({
          id: 'code-root',
          recordId: 'code-root',
          traceId: 'code-trace',
          name: 'code.call',
          input: 'bun/read - read workpad.md',
          output: 'completed - no file changes',
          rawResolvedInputJson: {
            language: 'bun',
            mode: 'read',
            code: "await Bun.file('workpad.md').text()",
          },
          rawResultJson: { ok: true, data: { stdout: 'workspace notes' } },
        }),
        row({
          id: 'error-root',
          recordId: 'error-root',
          traceId: 'error-trace',
          name: 'code.call',
          status: 'error',
          code: 'COMMAND_FAILED',
          input: 'python/verify - test trace-site',
          output: 'failed - COMMAND_FAILED',
          rawResolvedInputJson: {
            language: 'python',
            mode: 'verify',
            code: 'pytest trace_site_test.py',
          },
          rawResultJson: {
            ok: false,
            code: 'COMMAND_FAILED',
            message: '2 tests failed in trace_site_test.py',
          },
        }),
        row({
          id: 'batch-root',
          recordId: 'batch-root',
          traceId: 'batch-trace',
          name: 'batch',
          rawResolvedInputJson: {
            steps: [
              {
                tool: 'code.call',
                input: {
                  language: 'bun',
                  mode: 'read',
                  code: "await Bun.file('batch-child.md').text()",
                },
              },
            ],
          },
          batchResultsJson: [
            {
              traceId: 'batch-child-trace',
              status: 'success',
              code: 'OK',
              durationMs: 14,
              inputTokens: 4,
              outputTokens: 8,
              rawResultJson: { ok: true, data: { stdout: 'child contents' } },
            },
          ],
        }),
        ...[
          'fs.read',
          'fs.write',
          'fs.apply_patch',
          'fs.search',
          'tools.search',
          'verify',
          'review.run',
          'task.start',
          'task.push',
          'github',
          'browser',
        ].map((name, index) =>
          row({
            id: `facet-${index}`,
            recordId: `facet-${index}`,
            traceId: `facet-trace-${index}`,
            name,
            input: `facet input ${index}`,
            rawResolvedInputJson:
              name === 'github'
                ? { operation: 'pr.view', number: 1500 }
                : name === 'browser'
                  ? { action: 'eval', script: 'document.title' }
                  : undefined,
          }),
        ),
      ];
      const runtimeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;height:100%}.tbxModal{display:none;position:fixed;inset:0;z-index:10000}.trxShell{display:grid;height:100vh}#tbmLiveTraceModal .trxBody{display:grid;grid-template-columns:minmax(0,1fr) 9px minmax(520px,var(--rail,820px))!important}.trxTablePane{display:grid;grid-template-rows:auto 1fr auto;height:100%;min-height:0}.trxTableScroll{height:100%;overflow:auto}.trxRow{display:grid;grid-template-columns:24px 60px 120px 70px 70px 150px minmax(220px,1fr) minmax(220px,1fr) 130px 70px 90px;align-items:center;width:100%;height:44px}.trxFooter{display:flex;justify-content:space-between;padding:8px}
      </style></head><body>
        <div id="tbmLiveTraceModal" class="tbxModal"><div class="trxShell closed"><div class="trxChrome"></div><div class="trxBody"><div class="trxTablePane"><input data-search aria-label="Search traces"><div class="trxTableScroll"><div data-trace-rows></div></div><footer class="trxFooter"><button type="button" data-show-filters>filters</button><span><b data-trace-count>14</b> traces</span></footer></div><div class="trxResizer" data-retired-divider></div><div class="trxRail"><div data-inspector></div></div></div></div></div>
        <script id="trace-seed-data" type="application/json">${serializeTraceSeed({ rows: semanticRows })}</script>
      </body></html>`;

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
        });
        page.setDefaultTimeout(3_000);
        await page.setContent(runtimeHtml, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
          document
            .querySelector('[data-retired-divider]')
            ?.addEventListener('pointerdown', () => {
              (
                window as Window & { __retiredDividerUsed?: boolean }
              ).__retiredDividerUsed = true;
            });
        });
        await page.addStyleTag({ path: cssPath });
        await page.addScriptTag({ path: scriptPath, type: 'module' });
        await page.waitForFunction(
          () =>
            document
              .querySelector('.trxRow[data-trace-key="code-root"]')
              ?.querySelector('.trxToolName')?.textContent === 'workpad.read' &&
            Boolean(document.querySelector('.trxFilterPanel')),
        );

        expect(await page.locator('#tbmLiveTraceModal').isVisible()).toBe(true);
        expect(
          await page.locator('.trxRow[data-trace-key="code-root"]').isVisible(),
        ).toBe(true);
        expect(
          await page
            .locator('.trxRow[data-trace-key="code-root"] .trxInputCell')
            .textContent(),
        ).toBe('read workpad.md');
        expect(
          await page
            .locator('.trxRow[data-trace-key="batch-child-trace"] .trxToolName')
            .textContent(),
        ).toBe('bun.read');
        expect(
          await page
            .locator(
              '.trxRow[data-trace-key="batch-child-trace"] .trxInputCell',
            )
            .textContent(),
        ).toContain('batch-child.md');

        const errorColors = await page
          .locator('.trxRow[data-trace-key="error-root"]')
          .evaluate((element) => ({
            input: getComputedStyle(
              element.querySelector<HTMLElement>('.trxInputCell')!,
            ).color,
            output: getComputedStyle(
              element.querySelector<HTMLElement>('.trxOutputCell')!,
            ).color,
            branch: getComputedStyle(
              element.querySelector<HTMLElement>('.trxBranch')!,
            ).color,
          }));
        expect(errorColors).toMatchObject({
          input: 'rgb(239, 118, 95)',
          output: 'rgb(239, 118, 95)',
        });
        expect(errorColors.branch).not.toBe(errorColors.input);

        expect(await page.locator('html').getAttribute('class')).toContain(
          'trace-system-font',
        );
        await page.locator('[data-show-filters]').click();
        expect(await page.locator('.trxFilterPanel').isVisible()).toBe(true);
        expect(
          await page
            .locator('[data-filter-section="tools"] .trxFilterValue')
            .count(),
        ).toBe(10);
        expect(
          await page.locator('[data-trace-filter-more="tools"]').textContent(),
        ).toMatch(/^Show \d+ more$/);

        await page.locator('[data-trace-filter-more="tools"]').click();

        await page
          .locator(
            '[data-filter-section="tools"] [data-trace-filter-value="workpad.read"] [data-trace-filter-only]',
          )
          .click();
        await page.waitForFunction(
          () =>
            (
              window as Window & {
                __traceVirtualList?: {
                  diagnostics: () => { filtered: number } | null;
                };
              }
            ).__traceVirtualList?.diagnostics()?.filtered === 1,
        );
        expect(await page.locator('.trxFilterPanel').isVisible()).toBe(true);

        await page.locator('[data-trace-font-toggle]').click();
        expect(await page.locator('html').getAttribute('class')).not.toContain(
          'trace-system-font',
        );
        await page.locator('[data-trace-filter-close]').click();
        expect(await page.locator('.trxFilterPanel').isVisible()).toBe(false);

        const inputCell = page.locator(
          '.trxRow[data-trace-key="code-root"] .trxInputCell',
        );
        expect(await inputCell.getAttribute('title')).toBeNull();
        await inputCell.hover();
        await page.waitForTimeout(850);
        expect(await page.locator('.trxHoverCard').isVisible()).toBe(false);
        await page.waitForFunction(
          () => !document.querySelector<HTMLElement>('.trxHoverCard')?.hidden,
        );
        expect(await page.locator('.trxHoverCard').textContent()).toContain(
          "await Bun.file('workpad.md').text()",
        );
        expect(await page.locator('.trxHoverCard').textContent()).not.toContain(
          '⌕',
        );

        await page.locator('.trxRow[data-trace-key="code-root"]').click();
        await page.waitForFunction(() =>
          Boolean(document.querySelector('[data-ti-mode="workpad"]')),
        );
        const inspectorIdentity = await page
          .locator('.tiInspector')
          .evaluate((element) => {
            (element as HTMLElement).dataset.testIdentity = 'stable';
            return element.getBoundingClientRect().height;
          });
        expect(inspectorIdentity).toBeGreaterThan(0);
        expect(
          await page.locator('.tiHeaderMetrics .tiHeaderMetric').count(),
        ).toBe(6);
        expect(await page.locator('.tiBranchTotals').count()).toBe(0);
        await page.locator('[data-ti-call-search]').fill('bun.read');
        expect(
          await page.locator('.tiInspector').getAttribute('data-test-identity'),
        ).toBe('stable');
        await page.locator('[data-ti-mode="workpad"]').click();
        expect(
          await page.locator('[data-ti-section="workpad"]').innerText(),
        ).toContain('workspace notes');

        const footerLayout = await page
          .locator('.trxFooter')
          .evaluate((footer) => {
            const children = [...footer.children] as HTMLElement[];
            return {
              count: children.length,
              columns: getComputedStyle(footer).gridTemplateColumns,
              labels: children.map((child) => child.textContent?.trim()),
            };
          });
        expect(footerLayout.count).toBe(3);
        expect(footerLayout.labels[0]).toBe('filters');
        expect(footerLayout.labels[1]).toContain('traces');
        expect(footerLayout.labels[2]).toBe('Scroll to top');

        const rowCheckbox = page.locator(
          '.trxRow[data-trace-key="code-root"] .trxCheck',
        );
        await page.mouse.move(0, 0);
        await page.waitForFunction(
          () =>
            getComputedStyle(
              document.querySelector<HTMLElement>(
                '.trxRow[data-trace-key="code-root"] .trxCheck',
              )!,
            ).opacity === '0',
        );
        expect(
          await rowCheckbox.evaluate((node) => getComputedStyle(node).opacity),
        ).toBe('0');
        await page.locator('.trxRow[data-trace-key="code-root"]').hover();
        await page.waitForFunction(
          () =>
            getComputedStyle(
              document.querySelector<HTMLElement>(
                '.trxRow[data-trace-key="code-root"] .trxCheck',
              )!,
            ).opacity === '1',
        );
      } finally {
        await browser.close();
      }
    },
    20_000,
  );

  browserTest(
    'should select batch children independently and never paint the obsolete detail layout',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'trace-inspector-selection-'));
      roots.push(root);
      const scriptPath = join(root, 'trace-inspector-v37.js');
      const cssPath = join(root, 'trace-inspector-v37.css');
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
        new URL(
          '../scripts/trace-site-inspector/inspector.css',
          import.meta.url,
        ),
        cssPath,
      );

      const batchParent = row({
        id: 'batch-parent',
        recordId: 'batch-parent',
        traceId: 'parent-trace',
        name: 'batch',
        status: 'error',
        code: 'COMMAND_FAILED',
        input: 'parent input',
        output: 'parent output',
        inputTokens: 10,
        outputTokens: 20,
        tokens: 30,
        batchResultsJson: [
          {
            id: 'child-a',
            recordId: 'child-a',
            traceId: 'child-a-trace',
            tool: 'fs.read',
            name: 'fs.read',
            status: 'success',
            code: 'OK',
            input: 'child A input',
            output: 'child A output',
            rawInputJson: { path: 'child-a.txt' },
            rawResultJson: { ok: true, value: 'child A raw result' },
            durationMs: 11,
            inputTokens: 1,
            outputTokens: 2,
          },
          {
            id: 'child-b',
            recordId: 'child-b',
            traceId: 'child-b-trace',
            tool: 'fs.list',
            name: 'fs.list',
            status: 'error',
            code: 'COMMAND_FAILED',
            input: 'child B input',
            output: 'child B output',
            rawInputJson: { path: 'missing' },
            rawResultJson: { ok: false, error: 'child B raw result' },
            durationMs: 22,
            inputTokens: 3,
            outputTokens: 4,
          },
        ],
      });
      const branchPeer = row({
        id: 'peer-root',
        recordId: 'peer-root',
        traceId: 'peer-trace',
        name: 'review.run',
        input: 'peer input',
        output: 'peer output',
      });
      const staleBatchParent = {
        ...batchParent,
        batchResultsJson: [
          {
            traceId: 'child-a-trace',
            status: 'success',
            code: 'OK',
            durationMs: 11,
            inputTokens: 1,
            outputTokens: 2,
          },
          {
            traceId: 'child-b-trace',
            status: 'error',
            code: 'COMMAND_FAILED',
            durationMs: 22,
            inputTokens: 3,
            outputTokens: 4,
          },
        ],
      };
      const fillerRows = Array.from({ length: 180 }, (_, index) =>
        row({
          id: `filler-${index}`,
          recordId: `filler-${index}`,
          traceId: `filler-trace-${index}`,
          name: 'code.call',
          input: `filler input ${index}`,
          output: `filler output ${index}`,
        }),
      );
      const runtimeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;height:100%}.trxShell{display:grid;height:100vh}.trxBody{min-height:0}.trxShell.closed .trxRail{display:none}.trxTablePane{display:grid;grid-template-rows:auto 1fr auto;min-height:0}.trxTableScroll{height:100%;overflow:auto}.trxRail{height:100%}.trxRailInner,[data-inspector]{height:100%}.trxRow{height:44px}.trxFooter{display:flex;justify-content:space-between;padding:8px}
    </style></head><body>
      <div class="trxShell closed">
        <div class="trxChrome"></div>
        <div class="trxBody">
          <div class="trxTablePane">
            <input data-search aria-label="Search traces" />
            <div class="trxTableScroll"><div data-trace-rows></div></div>
            <footer class="trxFooter"><span><b data-trace-count>182</b> traces</span></footer>
          </div>
          <div class="trxRail"><div class="trxRailInner" data-inspector><div class="legacy-detail-layout"><aside>TRACE duplicate parent summary</aside><main>obsolete detail</main></div></div></div>
        </div>
      </div>
      <script id="trace-seed-data" type="application/json">${serializeTraceSeed({ meta: { nextCursor: 'cursor-selection' }, rows: [staleBatchParent, branchPeer, ...fillerRows] })}</script>
      <script>
        history.replaceState(null, '', '#trace=batch-parent');
        window.__traceFirstPaintStates = [];
        window.__legacyTraceRowClicks = 0;
        window.__legacyTraceBackClicks = 0;
        document.addEventListener('click', (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest('.trxRow')) {
            window.__legacyTraceRowClicks += 1;
            window.__traceSelectedKey = 'legacy-overwrite';
            const mount = document.querySelector('[data-inspector]');
            if (mount) mount.innerHTML = '';
          }
          if (target?.closest('[data-ti-back]')) {
            window.__legacyTraceBackClicks += 1;
            document.querySelector('.trxShell')?.classList.add('detail-open');
          }
        });
        requestAnimationFrame(() => window.__traceFirstPaintStates.push({
          legacy: Boolean(document.querySelector('.legacy-detail-layout')),
          boot: Boolean(document.querySelector('.tiInspectorBoot')),
          firstSidebar: document.querySelector('.tiSidebar .tiEyebrow')?.textContent || ''
        }));
      </script>
    </body></html>`;
      const patchedHtml = patchTraceInspectorHtml(runtimeHtml);
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
        });
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.setDefaultTimeout(7_000);
        await page.route('http://trace.test/**', async (route) => {
          const pathname = new URL(route.request().url()).pathname;
          if (pathname.endsWith('trace-inspector-v37.css')) {
            await route.fulfill({
              contentType: 'text/css',
              body: readFileSync(cssPath),
            });
            return;
          }
          if (pathname.endsWith('trace-inspector-v37.js')) {
            await new Promise((resolve) => setTimeout(resolve, 180));
            await route.fulfill({
              contentType: 'text/javascript',
              body: readFileSync(scriptPath),
            });
            return;
          }
          if (pathname.endsWith('/live-traces.json')) {
            await route.fulfill({
              contentType: 'application/json',
              body: JSON.stringify({
                meta: { nextCursor: 'cursor-selection' },
                rows: [batchParent, branchPeer, ...fillerRows],
              }),
            });
            return;
          }
          await route.fulfill({ contentType: 'text/html', body: patchedHtml });
        });
        await page.goto('http://trace.test/trace-burn-intelligence', {
          waitUntil: 'commit',
        });
        await page.waitForFunction(
          () =>
            ((window as Window & { __traceFirstPaintStates?: unknown[] })
              .__traceFirstPaintStates?.length ?? 0) > 0,
        );
        expect(
          await page.evaluate(
            () =>
              (
                window as Window & {
                  __traceFirstPaintStates?: Array<{
                    legacy: boolean;
                    boot: boolean;
                    firstSidebar: string;
                  }>;
                }
              ).__traceFirstPaintStates?.[0],
          ),
        ).toEqual({ legacy: false, boot: true, firstSidebar: '' });

        await expect
          .poll(() =>
            page.evaluate(() =>
              [...document.querySelectorAll<HTMLElement>('.trxRow')].map(
                (element) => element.dataset.traceKey,
              ),
            ),
          )
          .toEqual(expect.arrayContaining(['child-a', 'child-b']));
        expect(pageErrors).toEqual([]);
        expect(
          await page.evaluate(() => ({
            selected:
              (window as Window & { __traceSelectedKey?: string })
                .__traceSelectedKey ?? '',
            selectedRows: document.querySelectorAll('.trxRow.selected').length,
            closed: document
              .querySelector('.trxShell')
              ?.classList.contains('closed'),
            detailOpen: document
              .querySelector('.trxShell')
              ?.classList.contains('detail-open'),
            railHidden:
              document.querySelector('.trxRail')?.getAttribute('aria-hidden') ??
              '',
            hash: location.hash,
          })),
        ).toEqual({
          selected: '',
          selectedRows: 0,
          closed: true,
          detailOpen: false,
          railHidden: 'true',
          hash: '',
        });
        const initialRows = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('.trxRow')]
            .filter((element) =>
              ['batch-parent', 'child-a', 'child-b'].includes(
                element.dataset.traceKey ?? '',
              ),
            )
            .map((element) => ({
              key: element.dataset.traceKey,
              rowKey: element.dataset.rowKey,
              selected: element.getAttribute('aria-selected'),
            })),
        );
        expect(initialRows).toEqual([
          {
            key: 'batch-parent',
            rowKey: 'batch-parent::trace',
            selected: 'false',
          },
          {
            key: 'child-a',
            rowKey: 'batch-parent::0:fs.read',
            selected: 'false',
          },
          {
            key: 'child-b',
            rowKey: 'batch-parent::1:fs.list',
            selected: 'false',
          },
        ]);

        const assertSelection = async (
          key: string,
          expected: string[],
          rejected: string[],
        ) => {
          await page.locator(`.trxRow[data-trace-key="${key}"]`).click();
          await page.waitForFunction(
            (selectionKey) =>
              (window as Window & { __traceSelectedKey?: string })
                .__traceSelectedKey === selectionKey &&
              document.querySelector<HTMLElement>('.tiInspector')?.dataset
                .tiTraceKey === selectionKey,
            key,
          );
          await page.locator('[data-ti-mode="formatted"]').click();
          const state = await page.evaluate(() => ({
            selected: (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey,
            selectedRows: [
              ...document.querySelectorAll<HTMLElement>('.trxRow.selected'),
            ].map((element) => element.dataset.traceKey),
            activePeers: [
              ...document.querySelectorAll<HTMLElement>('.tiPeer.active'),
            ].map((element) => element.dataset.traceKey),
            text: document.querySelector<HTMLElement>('[data-inspector]')
              ?.innerText,
            firstSidebar: document.querySelector<HTMLElement>(
              '.tiSidebar .tiEyebrow',
            )?.textContent,
            traceCard: Boolean(document.querySelector('.tiTraceCard')),
            detailOpen: document
              .querySelector('.trxShell')
              ?.classList.contains('detail-open'),
            closed: document
              .querySelector('.trxShell')
              ?.classList.contains('closed'),
            inspectorWidth:
              document.querySelector('.tiInspector')?.getBoundingClientRect()
                .width ?? 0,
          }));
          expect(state.selected).toBe(key);
          expect(state.selectedRows).toEqual([key]);
          expect(state.activePeers).toEqual([key]);
          expect(state.firstSidebar).toBeUndefined();
          expect(state.traceCard).toBe(false);
          expect(state.detailOpen).toBe(true);
          expect(state.closed).toBe(false);
          expect(state.inspectorWidth).toBeGreaterThan(0);
          for (const value of expected) expect(state.text).toContain(value);
          for (const value of rejected) expect(state.text).not.toContain(value);
        };

        const assertPanel = async (
          section: string,
          expected: string,
          rejected?: string,
        ) => {
          const json = section === 'raw';
          await page
            .locator(`[data-ti-mode="${json ? 'json' : 'formatted'}"]`)
            .click();
          const text = await page
            .locator(`[data-ti-section="${json ? 'json' : section}"]`)
            .innerText();
          expect(text).toContain(expected);
          if (rejected) expect(text).not.toContain(rejected);
        };

        await assertSelection(
          'batch-parent',
          [
            'batch',
            'error',
            'COMMAND_FAILED',
            '120ms',
            '30 tok',
            'parent-trace',
          ],
          ['child A raw result'],
        );
        await assertPanel('input', 'parent input', 'child A input');
        await assertPanel('output', 'parent output', 'child A output');
        await assertSelection(
          'child-a',
          ['fs.read', 'success', 'OK', '11ms', '3 tok', 'child-a-trace'],
          ['parent output', 'child B raw result'],
        );
        await assertPanel('input', 'child-a.txt', 'parent input');
        await assertPanel('output', 'child A raw result', 'parent output');
        await assertPanel('raw', 'child A raw result', 'child B raw result');
        await assertSelection(
          'child-b',
          [
            'fs.list',
            'error',
            'COMMAND_FAILED',
            '22ms',
            '7 tok',
            'child-b-trace',
          ],
          ['parent output', 'child A raw result'],
        );
        await assertPanel('input', 'missing', 'parent input');
        await assertPanel('output', 'child B raw result', 'parent output');
        await assertPanel('raw', 'child B raw result', 'child A raw result');
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __legacyTraceRowClicks?: number })
                .__legacyTraceRowClicks,
          ),
        ).toBe(0);

        await page.locator('.tiPeer[data-trace-key="child-a"]').click();
        await page.waitForFunction(
          () =>
            (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey === 'child-a',
        );
        await page.locator('[data-ti-mode="formatted"]').click();
        expect(await page.locator('.tiPreview').innerText()).toContain(
          'child A output',
        );

        await page.locator('.tiPeer[data-trace-key="peer-root"]').click();
        await page.waitForFunction(
          () =>
            (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey === 'peer-root',
        );
        await page.locator('[data-search]').fill('review.run');
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __traceSelectedKey?: string })
                .__traceSelectedKey,
          ),
        ).toBe('peer-root');
        await page.locator('[data-search]').fill('');

        await page.locator('.trxRow[data-trace-key="child-b"]').click();
        await page.evaluate(() => {
          (
            window as Window & {
              __traceVirtualList?: {
                appendPage: (
                  rows: Array<Record<string, unknown>>,
                  cursor: string | null,
                ) => void;
              };
            }
          ).__traceVirtualList?.appendPage(
            [
              {
                id: 'older-root',
                recordId: 'older-root',
                traceId: 'older-trace',
                branch: 'task/trace-site/example',
                name: 'fs.read',
                status: 'success',
              },
            ],
            null,
          );
        });
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __traceSelectedKey?: string })
                .__traceSelectedKey,
          ),
        ).toBe('child-b');

        await page.locator('[data-ti-call-search]').fill('fs.read');
        await page.waitForFunction(
          () =>
            document.querySelectorAll('.tiPeer[data-trace-key]').length === 2,
        );
        expect(
          await page
            .locator('.tiPeer[data-trace-key]')
            .evaluateAll((peers) =>
              peers.map((peer) => (peer as HTMLElement).dataset.traceKey),
            ),
        ).toEqual(['child-a', 'older-root']);
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __traceSelectedKey?: string })
                .__traceSelectedKey,
          ),
        ).toBe('child-b');
        await page.locator('[data-ti-call-search]').fill('');

        await page.evaluate(
          ({ parent, peer }) => {
            (
              window as Window & {
                __traceVirtualList?: {
                  replaceRows: (
                    rows: Array<Record<string, unknown>>,
                    cursor: string | null,
                  ) => void;
                };
              }
            ).__traceVirtualList?.replaceRows(
              [
                {
                  id: 'new-live-record',
                  recordId: 'new-live-record',
                  traceId: 'new-live-trace',
                  branch: 'task/trace-site/example',
                  name: 'code.call',
                  status: 'success',
                  output: 'new live output',
                },
                parent,
                peer,
              ],
              'cursor-live',
            );
          },
          { parent: batchParent, peer: branchPeer },
        );
        await page.waitForFunction(
          () =>
            (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey === 'child-b' &&
            document.querySelector<HTMLElement>('.tiInspector')?.dataset
              .tiTraceKey === 'child-b' &&
            document
              .querySelector('.trxShell')
              ?.classList.contains('detail-open'),
        );

        await page.locator('[data-ti-call-rail]').click();
        await page.waitForFunction(() =>
          document
            .querySelector('.tiInspector')
            ?.classList.contains('is-call-rail-collapsed'),
        );
        await page.locator('[data-ti-call-rail]').click();
        await page.waitForFunction(
          () =>
            !document
              .querySelector('.tiInspector')
              ?.classList.contains('is-call-rail-collapsed'),
        );

        await page.locator('[data-ti-fullscreen]').click();
        await page.waitForFunction(() =>
          document
            .querySelector('.trxShell')
            ?.classList.contains('ti-inspector-fullscreen'),
        );
        const fullscreenLayout = await page
          .locator('.trxRail')
          .evaluate((element) => ({
            railWidth: element.getBoundingClientRect().width,
            viewportWidth: window.innerWidth,
          }));
        expect(fullscreenLayout.railWidth).toBeGreaterThan(
          fullscreenLayout.viewportWidth - 40,
        );
        await page.locator('[data-ti-fullscreen]').click();
        await page.waitForFunction(
          () =>
            !document
              .querySelector('.trxShell')
              ?.classList.contains('ti-inspector-fullscreen'),
        );

        const widthBefore = await page
          .locator('.trxRail')
          .evaluate((element) => element.getBoundingClientRect().width);
        expect(widthBefore).toBeLessThan(760);
        const managedLayout = await page
          .locator('.trxBody')
          .evaluate((element) => ({
            priority: element.style.getPropertyPriority(
              'grid-template-columns',
            ),
            value: element.style.getPropertyValue('grid-template-columns'),
          }));
        expect(managedLayout.priority).toBe('important');
        expect(managedLayout.value).toContain('minmax(420px');
        const divider = page.locator('.tiDivider');
        const dividerBox = await divider.boundingBox();
        expect(dividerBox).not.toBeNull();
        expect(await divider.getAttribute('data-retired-divider')).toBeNull();
        await page.mouse.move(
          dividerBox!.x + dividerBox!.width / 2,
          dividerBox!.y + dividerBox!.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          dividerBox!.x - 100,
          dividerBox!.y + dividerBox!.height / 2,
          { steps: 5 },
        );
        await page.mouse.up();
        await expect
          .poll(() =>
            page
              .locator('.trxRail')
              .evaluate((element) => element.getBoundingClientRect().width),
          )
          .toBeGreaterThan(widthBefore + 50);
        const resizedLayout = await page.evaluate(() => ({
          tableWidth:
            document.querySelector('.trxTablePane')?.getBoundingClientRect()
              .width ?? 0,
          closed: document
            .querySelector('.trxShell')
            ?.classList.contains('closed'),
          retiredScreen: Boolean(document.querySelector('body > .screen')),
          retiredToolbar: Boolean(document.querySelector('.trxToolbar')),
          retiredPagination: document.body.innerText.includes('Rows per page'),
        }));
        expect(resizedLayout.tableWidth).toBeGreaterThanOrEqual(540);
        expect(resizedLayout.closed).toBe(false);
        expect(resizedLayout.retiredScreen).toBe(false);
        expect(resizedLayout.retiredToolbar).toBe(false);
        expect(resizedLayout.retiredPagination).toBe(false);
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __retiredDividerUsed?: boolean })
                .__retiredDividerUsed,
          ),
        ).not.toBe(true);

        const expandedDividerBox = await divider.boundingBox();
        expect(expandedDividerBox).not.toBeNull();
        await page.mouse.move(
          expandedDividerBox!.x + expandedDividerBox!.width / 2,
          expandedDividerBox!.y + expandedDividerBox!.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(2, expandedDividerBox!.y + 20, { steps: 12 });
        await page.mouse.up();
        await expect
          .poll(() =>
            page
              .locator('.trxRail')
              .evaluate((element) => element.getBoundingClientRect().width),
          )
          .toBeGreaterThan(1_330);
        expect(
          await page.evaluate(() =>
            localStorage.getItem('consuelo.trace-inspector.width'),
          ),
        ).toMatch(/^\d+$/);

        await page.locator('[data-ti-mode="formatted"]').click();

        await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('.trxTableScroll');
          if (list) list.scrollTop = list.scrollHeight;
        });
        await page.waitForTimeout(100);
        expect(await page.locator('.tiPreview').innerText()).toContain(
          'child B output',
        );

        await page.locator('[data-ti-close]').dispatchEvent('click');
        expect(
          await page.evaluate(() => ({
            selected: (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey,
            detailOpen: document
              .querySelector('.trxShell')
              ?.classList.contains('detail-open'),
            closed: document
              .querySelector('.trxShell')
              ?.classList.contains('closed'),
            inspector: Boolean(document.querySelector('.tiInspector')),
          })),
        ).toEqual({
          selected: 'child-b',
          detailOpen: false,
          closed: true,
          inspector: true,
        });
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __legacyTraceBackClicks?: number })
                .__legacyTraceBackClicks,
          ),
        ).toBe(0);
        await page.evaluate(() => {
          (
            window as Window & {
              __traceVirtualList?: { scrollToKey: (key: string) => void };
            }
          ).__traceVirtualList?.scrollToKey('child-b');
        });
        await page.locator('.trxRow[data-trace-key="child-b"]').click();
        expect(
          await page.evaluate(() => ({
            detailOpen: document
              .querySelector('.trxShell')
              ?.classList.contains('detail-open'),
            closed: document
              .querySelector('.trxShell')
              ?.classList.contains('closed'),
          })),
        ).toEqual({ detailOpen: true, closed: false });
      } finally {
        await browser.close();
      }
    },
    25_000,
  );

  browserTest(
    'should preserve interactive inspector behavior when the trace list is virtualized',
    async () => {
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
        html,body{margin:0;height:100%}.trxShell{display:grid;height:100vh}.trxBody{min-height:0}.trxTablePane{display:grid;grid-template-rows:1fr auto;min-height:0}.trxTableScroll{height:100%;overflow:auto}.trxRail{height:100%}.trxRailInner,[data-inspector]{height:100%}.trxFooter{display:flex;justify-content:space-between;padding:8px}
      </style></head><body>
        <div class="trxShell detail-open">
          <div class="trxChrome"></div>
          <div class="trxBody">
            <div class="trxTablePane"><div class="trxTableScroll"><div data-trace-rows></div></div><footer class="trxFooter"><button type="button" data-show-filters>filters</button><span><b data-trace-count>500</b> traces</span></footer></div>
            <div class="trxRail"><button type="button" data-ti-back>Back</button><div class="trxRailInner"><div data-inspector></div></div></div>
          </div>
        </div>
        <script id="trace-seed-data" type="application/json">${serializeTraceSeed({ meta: { nextCursor: 'cursor-2' }, rows: runtimeRows })}</script>
      </body></html>`;
      const scriptPath = join(archiveRoot, '_astro', 'trace-inspector-v37.js');
      const cssPath = join(archiveRoot, '_astro', 'trace-inspector-v37.css');
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
        new URL(
          '../scripts/trace-site-inspector/inspector.css',
          import.meta.url,
        ),
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
          () => document.querySelectorAll('.trxRow').length > 0,
        );
        expect(
          await page.evaluate(() => ({
            inspector: Boolean(document.querySelector('.tiInspector')),
            closed: document
              .querySelector('.trxShell')
              ?.classList.contains('closed'),
            hash: location.hash,
          })),
        ).toEqual({ inspector: false, closed: true, hash: '' });
        await page
          .locator('.trxRow[data-trace-key="runtime-record-0"]')
          .click();
        await page.waitForFunction(() =>
          Boolean(document.querySelector('.tiInspector')),
        );

        const desktop = await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('.trxTableScroll');
          return {
            total: Number(list?.dataset.traceTotal ?? 0),
            mounted: document.querySelectorAll('.trxRow').length,
            sections: Array.from(
              document.querySelectorAll<HTMLElement>('[data-ti-section]'),
            ).map((section) => section.dataset.tiSection),
            modes: Array.from(
              document.querySelectorAll<HTMLElement>('[data-ti-mode]'),
            ).map((mode) => mode.dataset.tiMode),
          };
        });
        expect(desktop.total).toBe(500);
        expect(desktop.mounted).toBeGreaterThan(0);
        expect(desktop.mounted).toBeLessThan(100);
        expect(desktop.sections).toEqual([
          'input',
          'output',
          'error',
          'metadata',
        ]);
        expect(desktop.modes).toEqual(['formatted', 'json']);

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
          closeDisplay: getComputedStyle(
            document.querySelector<HTMLElement>('[data-ti-close]')!,
          ).display,
        }));
        expect(mobile.viewport).toEqual([390, 844]);
        expect(mobile.mounted).toBeLessThan(100);
        expect(mobile.closeDisplay).not.toBe('none');

        await page.locator('[data-ti-close]').click();
        await page.waitForFunction(
          () =>
            !document
              .querySelector('.trxShell')
              ?.classList.contains('detail-open'),
        );
        expect(
          await page.evaluate(() => ({
            selected: (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey,
            inspector: Boolean(
              document.querySelector('[data-inspector] .tiInspector'),
            ),
          })),
        ).toEqual({ selected: 'runtime-record-0', inspector: true });
      } finally {
        await browser.close();
      }
    },
    15_000,
  );

  browserTest(
    'should append older history pages while preserving inspector state and terminal behavior',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'trace-inspector-pagination-'));
      roots.push(root);
      const archiveRoot = join(root, 'site');
      mkdirSync(join(archiveRoot, '_astro'), { recursive: true });
      const runtimeRows = Array.from({ length: 250 }, (_, index) =>
        row({
          id: `runtime-record-${index}`,
          recordId: `runtime-record-${index}`,
          traceId: `runtime-trace-${index}`,
          displayTime: `00:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
          input: `runtime input ${index}`,
          output: `runtime output ${index}`,
        }),
      );
      const olderRows = [
        { ...runtimeRows[249] },
        ...Array.from({ length: 75 }, (_, index) => {
          const sequence = index + 250;
          return row({
            id: `runtime-record-${sequence}`,
            recordId: `runtime-record-${sequence}`,
            traceId: `runtime-trace-${sequence}`,
            displayTime: `older-${sequence}`,
            input: `runtime input ${sequence}`,
            output: `runtime output ${sequence}`,
          });
        }),
      ];
      const runtimeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
        html,body{margin:0;height:100%}.trxShell{display:grid;height:100vh}.trxBody{min-height:0}.trxTablePane{display:grid;grid-template-rows:auto 1fr auto;min-height:0}.trxTableScroll{height:100%;overflow:auto}.trxRail{height:100%}.trxRailInner,[data-inspector]{height:100%}.trxFooter{display:flex;justify-content:space-between;padding:8px}
      </style></head><body>
        <div class="trxShell detail-open">
          <div class="trxChrome"></div>
          <div class="trxBody">
            <div class="trxTablePane">
              <input data-search aria-label="Search traces" />
              <div class="trxTableScroll"><div data-trace-rows></div></div>
              <footer class="trxFooter"><span><b data-trace-count>250</b> traces</span></footer>
            </div>
            <div class="trxRail"><button type="button" data-ti-back>Back</button><div class="trxRailInner"><div data-inspector></div></div></div>
          </div>
        </div>
        <script id="trace-seed-data" type="application/json">${serializeTraceSeed({ meta: { nextCursor: 'cursor-2' }, rows: runtimeRows })}</script>
      </body></html>`;
      const scriptPath = join(archiveRoot, '_astro', 'trace-inspector-v37.js');
      const cssPath = join(archiveRoot, '_astro', 'trace-inspector-v37.css');
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
        new URL(
          '../scripts/trace-site-inspector/inspector.css',
          import.meta.url,
        ),
        cssPath,
      );

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 900 },
        });
        page.setDefaultTimeout(5_000);
        await page.setContent(runtimeHtml, { waitUntil: 'domcontentloaded' });
        await page.evaluate((pageRows) => {
          const target = window as Window & {
            __traceHistoryRequests?: string[];
            __traceLiveRequests?: string[];
            __consueloTraceHistoryTransport?: {
              fetchJson: (url: string) => Promise<unknown>;
            };
            __plainFetchCalls?: number;
          };
          target.__traceHistoryRequests = [];
          target.__traceLiveRequests = [];
          target.__plainFetchCalls = 0;
          window.fetch = async () => {
            target.__plainFetchCalls = (target.__plainFetchCalls ?? 0) + 1;
            throw new Error('The inspector must not call fetch directly.');
          };
          target.__consueloTraceHistoryTransport = {
            fetchJson: async (url: string) => {
              if (url === '/trace-burn-intelligence/live-traces.json') {
                return { rows: [] };
              }
              if (url.includes('direction=newer')) {
                target.__traceLiveRequests!.push(url);
                if (target.__traceLiveRequests!.length === 1) {
                  throw new Error('transient cursor read failure');
                }
                return {
                  ok: true,
                  data: {
                    direction: 'newer',
                    rows:
                      target.__traceLiveRequests!.length === 2
                        ? [
                            {
                              id: 'live-record-251',
                              recordId: 'live-record-251',
                              traceId: 'live-trace-251',
                              branch: 'task/trace-site/example',
                              name: 'fs.read',
                              status: 'success',
                              input: 'live input',
                              output: 'live output',
                            },
                          ]
                        : [],
                    nextCursor: '000000000251',
                  },
                };
              }
              target.__traceHistoryRequests!.push(url);
              await new Promise((resolve) => window.setTimeout(resolve, 150));
              return {
                ok: true,
                publicBoundary: 'consuelo-sites-private-archive',
                route: '/gateway/traces/recent',
                data: {
                  direction: 'older',
                  rows: pageRows,
                  nextCursor: null,
                },
              };
            },
          };
          history.replaceState(null, '', '#trace=runtime-record-10');
        }, olderRows);
        await page.addStyleTag({ path: cssPath });
        await page.addScriptTag({ path: scriptPath, type: 'module' });
        await page.waitForFunction(
          () => document.querySelectorAll('.trxRow').length > 0,
        );
        expect(
          await page.evaluate(() => ({
            inspector: Boolean(document.querySelector('.tiInspector')),
            closed: document
              .querySelector('.trxShell')
              ?.classList.contains('closed'),
            hash: location.hash,
          })),
        ).toEqual({ inspector: false, closed: true, hash: '' });
        await page
          .locator('.trxRow[data-trace-key="runtime-record-10"]')
          .click();
        await page.waitForFunction(() =>
          Boolean(document.querySelector('.tiInspector')),
        );
        await page.locator('[data-search]').fill('runtime');
        await page.locator('[data-ti-mode="formatted"]').click();
        await page.locator('.tiInspector').evaluate((element) => {
          (element as HTMLElement).dataset.testIdentity = 'stable-live';
        });
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('.trxTableScroll')?.dataset
              .traceTotal === '251',
        );
        const liveRequestsBeforeFocus = await page.evaluate(
          () =>
            (window as Window & { __traceLiveRequests?: string[] })
              .__traceLiveRequests?.length ?? 0,
        );
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForFunction(
          (count) =>
            ((window as Window & { __traceLiveRequests?: string[] })
              .__traceLiveRequests?.length ?? 0) > count,
          liveRequestsBeforeFocus,
        );

        const initial = await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('.trxTableScroll')!;
          return {
            total: Number(list.dataset.traceTotal),
            count: document.querySelector('[data-trace-count]')?.textContent,
            height: list.scrollHeight,
            selected: (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey,
            mode: document.querySelector<HTMLElement>('.tiInspector')?.dataset
              .tiDisplayMode,
            query: (document.querySelector('[data-search]') as HTMLInputElement)
              .value,
            virtualDomText: document.body.textContent?.includes('Virtual DOM'),
            inspectorIdentity:
              document.querySelector<HTMLElement>('.tiInspector')?.dataset
                .testIdentity,
            liveRequests:
              (window as Window & { __traceLiveRequests?: string[] })
                .__traceLiveRequests?.length ?? 0,
          };
        });
        expect(initial).toMatchObject({
          total: 251,
          count: '251',
          selected: 'runtime-record-10',
          mode: 'formatted',
          query: 'runtime',
          virtualDomText: false,
          inspectorIdentity: 'stable-live',
        });
        expect(initial.liveRequests).toBeGreaterThanOrEqual(3);

        await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('.trxTableScroll');
          if (list) list.scrollTop = list.scrollHeight;
        });
        await page.waitForFunction(
          () =>
            ((window as Window & { __traceHistoryRequests?: string[] })
              .__traceHistoryRequests?.length ?? 0) === 1,
        );
        await page.evaluate(() => {
          document.dispatchEvent(
            new CustomEvent('trace:prefetch-request', {
              cancelable: true,
              detail: {
                cursor: 'cursor-2',
                rowCount: 250,
                lastVirtualIndex: 249,
                accept: () => {},
                fail: () => {},
              },
            }),
          );
        });
        await page.waitForTimeout(40);
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __traceHistoryRequests?: string[] })
                .__traceHistoryRequests?.length ?? 0,
          ),
        ).toBe(1);

        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('.trxTableScroll')?.dataset
              .traceTotal === '326',
        );
        const appended = await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('.trxTableScroll')!;
          const topButton = document.querySelector<HTMLButtonElement>(
            '[data-trace-scroll-top]',
          );
          return {
            total: Number(list.dataset.traceTotal),
            count: document.querySelector('[data-trace-count]')?.textContent,
            height: list.scrollHeight,
            cursor: list.dataset.traceNextCursor,
            selected: (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey,
            mode: document.querySelector<HTMLElement>('.tiInspector')?.dataset
              .tiDisplayMode,
            query: (document.querySelector('[data-search]') as HTMLInputElement)
              .value,
            topButtonVisible: Boolean(topButton && !topButton.hidden),
            requestUrl: (
              window as Window & { __traceHistoryRequests?: string[] }
            ).__traceHistoryRequests?.[0],
            plainFetchCalls: (window as Window & { __plainFetchCalls?: number })
              .__plainFetchCalls,
          };
        });
        expect(appended).toMatchObject({
          total: 326,
          count: '326',
          cursor: '',
          selected: 'runtime-record-10',
          mode: 'formatted',
          query: 'runtime',
          topButtonVisible: true,
          plainFetchCalls: 0,
        });
        expect(appended.height).toBeGreaterThan(initial.height);
        expect(appended.requestUrl).toContain(
          '/gateway/traces/recent?direction=older&cursor=cursor-2',
        );

        await page.locator('[data-trace-scroll-top]').click();
        await page.waitForFunction(
          () =>
            (document.querySelector<HTMLElement>('.trxTableScroll')
              ?.scrollTop ?? 1) < 1,
        );
        expect(
          await page.evaluate(() => ({
            buttonHidden: document.querySelector<HTMLButtonElement>(
              '[data-trace-scroll-top]',
            )?.hidden,
            selected: (window as Window & { __traceSelectedKey?: string })
              .__traceSelectedKey,
            query: (document.querySelector('[data-search]') as HTMLInputElement)
              .value,
          })),
        ).toEqual({
          buttonHidden: true,
          selected: 'runtime-record-10',
          query: 'runtime',
        });

        await page.evaluate(() => {
          const list = document.querySelector<HTMLElement>('.trxTableScroll');
          if (list) list.scrollTop = list.scrollHeight;
        });
        await page.waitForTimeout(250);
        expect(
          await page.evaluate(
            () =>
              (window as Window & { __traceHistoryRequests?: string[] })
                .__traceHistoryRequests?.length ?? 0,
          ),
        ).toBe(1);
      } finally {
        await browser.close();
      }
    },
    15_000,
  );
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
    expect(SYNTHETIC_TRACE_FEED.meta.nextCursor).toBeNull();
    expect(sanitized).not.toContain('consuelo-trace-history-transport');
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
    expect(html).not.toContain('consuelo-trace-history-transport');
  });

  test('should install the trusted transport only in the private artifact HTML', () => {
    const html = '<!doctype html><html><head></head><body></body></html>';
    const patched = patchTraceInspectorHtml(html);

    expect(TRUSTED_TRACE_HISTORY_TRANSPORT_SCRIPT).toContain(
      '__consueloTraceHistoryTransport',
    );
    expect(patched).toContain('consuelo-trace-history-transport');
    expect(patched).toContain('__consueloTraceHistoryTransport');
  });

  test('should route private trace history through the canonical OS gateway', () => {
    const routesSource = readFileSync(
      new URL('../../os/scripts/server/routes/traces.ts', import.meta.url),
      'utf8',
    );
    const appSource = readFileSync(
      new URL('../../os/scripts/server/app.ts', import.meta.url),
      'utf8',
    );
    const gatewaySource = readFileSync(
      new URL('../../os/scripts/server/services/trace-gateway.ts', import.meta.url),
      'utf8',
    );

    expect(routesSource).toContain("'/gateway/traces/recent'");
    expect(routesSource).toContain('return traceGatewayEndpoints().handle(request)');
    expect(appSource.indexOf("app.route('/', createTraceRoutes())")).toBeLessThan(
      appSource.indexOf('app.notFound('),
    );
    expect(gatewaySource).toContain('resolveCanonicalTraceDbPath()');
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
      join(archiveRoot, '_astro', 'trace-inspector-v37.css'),
      'body{}',
    );
    writeFileSync(
      join(archiveRoot, '_astro', 'trace-inspector-v37.js'),
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
