import { describe, expect, it } from 'vitest';

import {
  formatTraceTableRow,
  isDefaultTraceTableRowVisible,
  matchesTraceTableFilters,
  traceFilterFacets,
  type TraceTableFilterState,
  type TraceTableRecord,
} from '../scripts/lib/trace-site-inspector/table-formatters';
import {
  branchName,
  childTraceRecords,
} from '../scripts/lib/trace-site-inspector/model';
import {
  deriveTraceHistoryCursor,
  parseTraceHistoryResponse,
  traceHistoryUrl,
  traceLiveUrl,
} from '../scripts/lib/trace-site-inspector/pagination-browser';
import {
  mergeTraceRows,
  shouldPrefetchTracePage,
} from '../scripts/lib/trace-site-inspector/trace-list';

const record = (
  overrides: Partial<TraceTableRecord> = {},
): TraceTableRecord => ({
  name: 'code.call',
  status: 'success',
  ok: true,
  code: 'OK',
  input: '{}',
  ...overrides,
});

const filterState = (
  overrides: Partial<TraceTableFilterState> = {},
): TraceTableFilterState => ({
  query: '',
  branches: new Set(),
  tools: new Set(),
  nodes: new Set(),
  routes: new Set(),
  statuses: new Set(),
  ...overrides,
});

describe('OS-owned Trace Burn table formatting', () => {
  it('hides successful MCP authentication audit rows from the default product table', () => {
    expect(
      isDefaultTraceTableRowVisible(
        record({
          name: 'authentication.mcp',
          status: 'success',
          ok: true,
          code: 'OK',
        }),
      ),
    ).toBe(false);
  });

  it('keeps failed authentication and authorization rows visible', () => {
    expect(
      isDefaultTraceTableRowVisible(
        record({
          name: 'authentication.mcp',
          status: 'error',
          ok: false,
          code: 'UNAUTHORIZED',
        }),
      ),
    ).toBe(true);
    expect(
      isDefaultTraceTableRowVisible(
        record({
          name: 'authorization.mcp',
          status: 'error',
          ok: false,
          code: 'MISSING_SCOPE',
        }),
      ),
    ).toBe(true);
  });

  it('summarizes safe MCP authentication metadata instead of generic request details', () => {
    const formatted = formatTraceTableRow(
      record({
        name: 'authentication.mcp',
        input: JSON.stringify({
          authMode: 'oauth',
          route: '/mcp',
          requiredScope: 'mcp:read',
        }),
      }),
    );

    expect(formatted.inputLabel).toBe('OAuth · /mcp · mcp:read');
    expect(formatted.inputLabel).not.toBe('request details');
  });

  it('should format node routing metadata when a trace resolves an explicit node', () => {
    const parent = record({
      resolvedNodeId: 'node_cloud',
      resolvedNodeName: 'Cloud Node',
      defaultNodeId: 'node_home',
      routeSource: 'explicit',
    });

    expect(formatTraceTableRow(parent)).toMatchObject({
      nodeId: 'node_cloud',
      nodeLabel: 'Cloud Node',
      routeSource: 'explicit',
      routeLabel: 'Explicit',
    });
  });

  it('should inherit direct parent routing metadata when a batch child omits routing fields', () => {
    const parent = record({
      resolvedNodeId: 'node_cloud',
      resolvedNodeName: 'Cloud Node',
      defaultNodeId: 'node_home',
      routeSource: 'explicit',
      batchResultsJson: JSON.stringify([
        { tool: 'fs.read', ok: true, code: 'OK', input: { path: 'README.md' } },
      ]),
    });

    const child = childTraceRecords(parent)[0];
    expect(formatTraceTableRow(child)).toMatchObject({
      nodeId: 'node_cloud',
      nodeLabel: 'Cloud Node',
      routeLabel: 'Explicit',
    });
  });

  it('should inherit metadata-only parent routing when a batch child omits routing fields', () => {
    const parent = record({
      metadata: {
        requestedNodeId: 'node_cloud',
        resolvedNodeId: 'node_cloud',
        resolvedNodeName: 'Metadata Cloud Node',
        defaultNodeId: 'node_home',
        routeSource: 'task',
      },
      batchResultsJson: JSON.stringify([
        { tool: 'fs.read', ok: true, code: 'OK', input: { path: 'README.md' } },
      ]),
    });

    const child = childTraceRecords(parent)[0];
    expect(formatTraceTableRow(child)).toMatchObject({
      nodeId: 'node_cloud',
      nodeLabel: 'Metadata Cloud Node',
      routeSource: 'task',
      routeLabel: 'Task',
    });
  });

  it('uses the work-session path as the existing session label and inherits it into batch children', () => {
    const parent = record({
      workSession: 'wrk_raycast',
      workPath: '/Users/[user]/Developer/raycast-extensions/example',
      batchResultsJson: JSON.stringify([
        {
          tool: 'fs.read',
          ok: true,
          code: 'OK',
          input: { path: 'package.json' },
        },
      ]),
    });

    expect(branchName(parent)).toBe(
      '/Users/[user]/Developer/raycast-extensions/example',
    );
    const child = childTraceRecords(parent)[0];
    expect(child).toMatchObject({
      workSession: 'wrk_raycast',
      workPath: '/Users/[user]/Developer/raycast-extensions/example',
    });
    expect(branchName(child)).toBe(
      '/Users/[user]/Developer/raycast-extensions/example',
    );
    expect(traceFilterFacets([parent]).branches).toEqual([
      { value: '/Users/[user]/Developer/raycast-extensions/example', count: 1 },
    ]);
  });

  it('keeps the existing task branch fallback for task-session traces', () => {
    expect(
      branchName(
        record({
          branch: 'task/workspace-agent/session-observability',
          taskSession: 'tsk_session_observability',
        }),
      ),
    ).toBe('task/workspace-agent/session-observability');
  });

  it('should expose only non-empty node and route facets when traces include mixed routing metadata', () => {
    const routed = record({
      resolvedNodeId: 'node_cloud',
      resolvedNodeName: 'Cloud Node',
      routeSource: 'explicit',
    });
    const historic = record({ traceId: 'historic-without-routing' });

    expect(traceFilterFacets([routed, historic])).toMatchObject({
      nodes: [{ value: 'Cloud Node', count: 1 }],
      routes: [{ value: 'Explicit', count: 1 }],
    });
  });

  it('should match node and route filters when routing labels are selected', () => {
    const parent = record({
      resolvedNodeId: 'node_cloud',
      resolvedNodeName: 'Cloud Node',
      routeSource: 'explicit',
    });

    expect(
      matchesTraceTableFilters(
        parent,
        filterState({
          query: 'cloud',
          nodes: new Set(['Cloud Node']),
          routes: new Set(['Explicit']),
        }),
      ),
    ).toBe(true);
    expect(
      matchesTraceTableFilters(
        parent,
        filterState({
          nodes: new Set(['Local Mac']),
        }),
      ),
    ).toBe(false);
  });

  it('summarizes wait and status plumbing without request-details placeholders', () => {
    const wait = formatTraceTableRow(
      record({
        name: 'wait',
        input: JSON.stringify({
          seconds: 17,
          reason: 'heartbeat reconciliation',
        }),
      }),
    );
    const status = formatTraceTableRow(record({ name: 'status', input: '{}' }));

    expect(wait.inputLabel).toBe('wait 17s · heartbeat reconciliation');
    expect(status.inputLabel).toBe('workspace status');
  });

  it('does not surface irreversible historical redaction placeholders as the row summary', () => {
    const read = formatTraceTableRow(
      record({
        name: 'fs.read',
        input: JSON.stringify({ path: '[REDACTED_SECRET]' }),
      }),
    );
    const changed = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'bun',
          mode: 'edit',
          code: 'Bun.write("file.ts", "ok")',
        }),
        rawResultJson: JSON.stringify({
          data: { filesChanged: ['[REDACTED_SECRET]'] },
        }),
      }),
    );

    expect(read.inputLabel).toBe('read file');
    expect(read.inputLabel).not.toContain('[REDACTED');
    expect(changed.outputLabel).toBe('changed 1 file');
    expect(changed.outputLabel).not.toContain('[REDACTED');
  });

  it('uses neutral fallbacks for historically redacted code and list paths', () => {
    const code = formatTraceTableRow(
      record({
        name: 'code.call',
        input: 'bun/read · inspect [REDACTED_SECRET]',
        rawInputJson: JSON.stringify({
          language: 'bun',
          mode: 'read',
          code: '[REDACTED_SECRET]',
        }),
      }),
    );
    const list = formatTraceTableRow(
      record({
        name: 'fs.list',
        input: JSON.stringify({ path: '[REDACTED_SECRET]' }),
      }),
    );

    expect(code.inputLabel).toBe('inspect source');
    expect(code.inputLabel).not.toContain('[REDACTED');
    expect(list.inputLabel).toBe('list files');
    expect(list.inputLabel).not.toContain('[REDACTED');
  });

  it('owns older/newer cursor URLs and parses authenticated history pages', () => {
    const history = traceHistoryUrl('id:row_42', 250);
    const search = traceHistoryUrl(
      'latest',
      100,
      'branch:feature/search date:2026-08-13',
    );
    const live = traceLiveUrl('000000000042', 25);

    expect(history).toContain('/gateway/traces/recent?');
    expect(history).toContain('direction=older');
    expect(history).toContain('cursor=id%3Arow_42');
    expect(history).toContain('includeRawPayload=true');
    expect(search).toContain('cursor=latest');
    expect(search).toContain(
      'query=branch%3Afeature%2Fsearch+date%3A2026-08-13',
    );
    expect(live).toContain('direction=newer');
    expect(live).toContain('cursor=000000000042');

    expect(
      parseTraceHistoryResponse({
        ok: true,
        data: {
          direction: 'older',
          rows: [{ id: 'row_41', recordId: 'row_41', traceId: 'trc_41' }],
          nextCursor: '000000000041',
        },
      }),
    ).toMatchObject({
      rows: [{ recordId: 'row_41', traceId: 'trc_41' }],
      nextCursor: '000000000041',
    });
  });

  it('deduplicates infinite-scroll history and preserves the selected trace window', () => {
    const rows = Array.from({ length: 4 }, (_, index) =>
      record({
        id: `row_${index + 1}`,
        recordId: `row_${index + 1}`,
        traceId: `trc_${index + 1}`,
      }),
    );
    const merged = mergeTraceRows(rows.slice(0, 3), [rows[2], rows[3]], {
      direction: 'history',
      maxRows: 4,
    });

    expect(merged.map((row) => row.recordId)).toEqual([
      'row_1',
      'row_2',
      'row_3',
      'row_4',
    ]);
    expect(deriveTraceHistoryCursor(merged)).toBe('id:row_4');
    expect(
      shouldPrefetchTracePage({
        lastVirtualIndex: 92,
        rowCount: 100,
        threshold: 8,
        nextCursor: '000000000001',
        fetching: false,
      }),
    ).toBe(true);
  });

  it('uses safe structured identifiers as a useful generic summary', () => {
    const formatted = formatTraceTableRow(
      record({
        name: 'gateway.audit',
        input: JSON.stringify({
          route: '/gateway/traces/recent',
          requiredScope: 'trace:read',
        }),
      }),
    );

    expect(formatted.inputLabel).toBe('/gateway/traces/recent · trace:read');
    expect(formatted.inputLabel).not.toBe('request details');
  });

  it('should provide semantic labels when formatting common trace tools', () => {
    const cases: Array<{
      name: string;
      input?: Record<string, unknown>;
      rawResultJson?: string;
      inputLabel: string;
      outputLabel: string;
    }> = [
      {
        name: 'fs.read',
        input: { path: '/tmp/config-overrides.json' },
        inputLabel: 'read config-overrides.json',
        outputLabel: 'read complete',
      },
      {
        name: 'fs.write',
        input: { path: '/tmp/ba-plus-server.ts', content: 'ok' },
        inputLabel: 'write ba-plus-server.ts',
        outputLabel: 'write complete',
      },
      {
        name: 'fs.list',
        input: { path: '/tmp/src' },
        inputLabel: 'list src',
        outputLabel: 'list complete',
      },
      {
        name: 'fs.search',
        input: { pattern: 'trace input summary', path: 'packages/os' },
        inputLabel: 'trace input summary',
        outputLabel: 'search complete',
      },
      {
        name: 'tools.search',
        input: { query: 'mac.call' },
        inputLabel: 'mac.call',
        outputLabel: 'search complete',
      },
      {
        name: 'fs.apply_patch',
        input: {
          patch: '*** Begin Patch\n*** Update File: app.ts\n*** End Patch',
        },
        inputLabel: 'patch 1 file · app.ts',
        outputLabel: 'patched 1 file · app.ts',
      },
      {
        name: 'status',
        input: {},
        inputLabel: 'workspace status',
        outputLabel: 'status loaded',
      },
      {
        name: 'stream.context',
        input: { area: 'os', stream: 'stream/os' },
        inputLabel: 'os',
        outputLabel: 'context loaded',
      },
      {
        name: 'mac.call',
        input: { command: 'sw_vers' },
        inputLabel: 'run sw_vers',
        outputLabel: 'sw_vers complete',
      },
      {
        name: 'github',
        input: { operation: 'pr.view', repo: 'consuelohq/opensaas', pr: 2447 },
        rawResultJson: JSON.stringify({
          data: { summary: { state: 'OPEN', number: 2447 } },
        }),
        inputLabel: 'PR #2447 · consuelohq/opensaas',
        outputLabel: 'open · #2447',
      },
      {
        name: 'batch',
        input: { steps: [{ tool: 'fs.read' }, { tool: 'status' }] },
        rawResultJson: JSON.stringify({
          data: { results: [{ ok: true }, { ok: true }] },
        }),
        inputLabel: '2 operations · fs.read, status',
        outputLabel: '2 operations complete',
      },
      {
        name: 'review.run',
        input: { base: 'origin/stream/os' },
        rawResultJson: JSON.stringify({
          data: { summary: { blockingIssues: 0 } },
        }),
        inputLabel: 'origin/stream/os',
        outputLabel: 'review passed · 0 issues',
      },
      {
        name: 'verify',
        input: { base: 'origin/stream/os' },
        inputLabel: 'origin/stream/os',
        outputLabel: 'verification passed',
      },
      {
        name: 'task.start',
        input: { title: 'semantic summaries' },
        rawResultJson: JSON.stringify({
          data: { branch: 'task/os/semantic-summaries' },
        }),
        inputLabel: 'semantic summaries',
        outputLabel: 'created task/os/semantic-summaries',
      },
      {
        name: 'task.push',
        input: { message: 'Improve summaries' },
        rawResultJson: JSON.stringify({
          data: { message: 'Improve summaries' },
        }),
        inputLabel: 'Improve summaries',
        outputLabel: 'pushed · Improve summaries',
      },
      {
        name: 'task.pr',
        input: { stream: 'stream/os' },
        rawResultJson: JSON.stringify({
          data: { stream: 'stream/os', taskPrMerged: true },
        }),
        inputLabel: 'stream/os',
        outputLabel: 'merged into stream/os',
      },
      {
        name: 'git.diff',
        input: { base: 'origin/stream/os', head: 'HEAD' },
        inputLabel: 'origin/stream/os…HEAD',
        outputLabel: 'diff complete',
      },
      {
        name: 'browser.open',
        input: { url: 'https://internal.consuelohq.com/observability/traces' },
        inputLabel: 'https://internal.consuelohq.com/observability/traces',
        outputLabel: 'page loaded',
      },
      {
        name: 'browser.snap',
        input: { selector: '.trxTable' },
        inputLabel: '.trxTable',
        outputLabel: 'snapshot ready',
      },
      {
        name: 'browser.eval',
        input: { expression: 'document.title' },
        inputLabel: 'document.title',
        outputLabel: 'evaluation complete',
      },
      {
        name: 'get_steering',
        input: {},
        inputLabel: 'workspace guidance',
        outputLabel: 'steering loaded',
      },
      {
        name: 'refresh_steering',
        input: { reason: 'config changed' },
        inputLabel: 'config changed',
        outputLabel: 'steering refreshed',
      },
    ];

    for (const testCase of cases) {
      const formatted = formatTraceTableRow(
        record({
          name: testCase.name,
          input: JSON.stringify(testCase.input ?? {}),
          rawInputJson: JSON.stringify(testCase.input ?? {}),
          rawResultJson: testCase.rawResultJson,
          output: 'command completed',
        }),
      );
      expect(
        {
          inputLabel: formatted.inputLabel,
          outputLabel: formatted.outputLabel,
        },
        testCase.name,
      ).toEqual({
        inputLabel: testCase.inputLabel,
        outputLabel: testCase.outputLabel,
      });
      expect(formatted.inputLabel).not.toBe('request details');
      expect(formatted.outputLabel).not.toBe('command completed');
    }
  });

  it('should extract file targets when code calls use indirect or shell paths', () => {
    const bunRead = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'bun',
          mode: 'read',
          code: "const path = '/tmp/config-overrides.json'; await Bun.file(path).text();",
        }),
      }),
    );
    const pythonEdit = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'python',
          mode: 'edit',
          code: "from pathlib import Path\np = Path('/tmp/ba-plus-server.ts')\np.write_text('ok')",
        }),
      }),
    );
    const bashRead = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'bash',
          mode: 'read',
          code: "sed -n '1,120p' packages/os/scripts/cli.ts",
        }),
      }),
    );
    const bunWrite = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'bun',
          mode: 'read',
          code: "await Bun.write('/tmp/settings.json', 'ok');",
        }),
      }),
    );
    const rgSearch = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'bash',
          mode: 'read',
          code: 'rg needle packages/os/scripts/cli.ts',
        }),
      }),
    );
    const grepSearch = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({
          language: 'bash',
          mode: 'read',
          code: 'grep needle packages/os/scripts/cli.ts',
        }),
      }),
    );

    expect(bunRead.inputLabel).toBe('read config-overrides.json');
    expect(pythonEdit.inputLabel).toBe('edit ba-plus-server.ts');
    expect(bashRead.inputLabel).toBe('read cli.ts');
    expect(bunWrite.inputLabel).toBe('write settings.json');
    expect(rgSearch.inputLabel).toBe('search needle');
    expect(grepSearch.inputLabel).toBe('search needle');
  });

  it('should preserve action summaries when results contain generic success messages', () => {
    for (const message of [
      'command completed',
      'mac command completed',
      'completed',
      'success',
    ]) {
      const formatted = formatTraceTableRow(
        record({
          name: 'mac.call',
          input: JSON.stringify({ command: 'defaults read com.apple.dock' }),
          rawResultJson: JSON.stringify({ message }),
          output: message,
        }),
      );
      expect(formatted.inputLabel).toBe('run defaults read com.apple.dock');
      expect(formatted.outputLabel).toBe('defaults complete');
    }
  });
});
