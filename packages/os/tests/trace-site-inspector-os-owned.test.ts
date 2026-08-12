import { describe, expect, it } from 'vitest';

import {
  formatTraceTableRow,
  isDefaultTraceTableRowVisible,
  matchesTraceTableFilters,
  traceFilterFacets,
  type TraceTableFilterState,
  type TraceTableRecord,
} from '../scripts/lib/trace-site-inspector/table-formatters';
import { childTraceRecords } from '../scripts/lib/trace-site-inspector/model';
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

const record = (overrides: Partial<TraceTableRecord> = {}): TraceTableRecord => ({
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
        record({ name: 'authentication.mcp', status: 'success', ok: true, code: 'OK' }),
      ),
    ).toBe(false);
  });

  it('keeps failed authentication and authorization rows visible', () => {
    expect(
      isDefaultTraceTableRowVisible(
        record({ name: 'authentication.mcp', status: 'error', ok: false, code: 'UNAUTHORIZED' }),
      ),
    ).toBe(true);
    expect(
      isDefaultTraceTableRowVisible(
        record({ name: 'authorization.mcp', status: 'error', ok: false, code: 'MISSING_SCOPE' }),
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

    expect(matchesTraceTableFilters(parent, filterState({
      query: 'cloud',
      nodes: new Set(['Cloud Node']),
      routes: new Set(['Explicit']),
    }))).toBe(true);
    expect(matchesTraceTableFilters(parent, filterState({
      nodes: new Set(['Local Mac']),
    }))).toBe(false);
  });

  it('summarizes wait and status plumbing without request-details placeholders', () => {
    const wait = formatTraceTableRow(
      record({
        name: 'wait',
        input: JSON.stringify({ seconds: 17, reason: 'heartbeat reconciliation' }),
      }),
    );
    const status = formatTraceTableRow(
      record({ name: 'status', input: '{}' }),
    );

    expect(wait.inputLabel).toBe('wait 17s · heartbeat reconciliation');
    expect(status.inputLabel).toBe('workspace status');
  });

  it('does not surface irreversible historical redaction placeholders as the row summary', () => {
    const read = formatTraceTableRow(
      record({ name: 'fs.read', input: JSON.stringify({ path: '[REDACTED_SECRET]' }) }),
    );
    const changed = formatTraceTableRow(
      record({
        name: 'code.call',
        input: JSON.stringify({ language: 'bun', mode: 'edit', code: 'Bun.write("file.ts", "ok")' }),
        rawResultJson: JSON.stringify({ data: { filesChanged: ['[REDACTED_SECRET]'] } }),
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
        rawInputJson: JSON.stringify({ language: 'bun', mode: 'read', code: '[REDACTED_SECRET]' }),
      }),
    );
    const list = formatTraceTableRow(
      record({ name: 'fs.list', input: JSON.stringify({ path: '[REDACTED_SECRET]' }) }),
    );

    expect(code.inputLabel).toBe('inspect source');
    expect(code.inputLabel).not.toContain('[REDACTED');
    expect(list.inputLabel).toBe('list files');
    expect(list.inputLabel).not.toContain('[REDACTED');
  });

  it('owns older/newer cursor URLs and parses authenticated history pages', () => {
    const history = traceHistoryUrl('id:row_42', 250);
    const live = traceLiveUrl('000000000042', 25);

    expect(history).toContain('/gateway/traces/recent?');
    expect(history).toContain('direction=older');
    expect(history).toContain('cursor=id%3Arow_42');
    expect(history).toContain('includeRawPayload=true');
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
    const merged = mergeTraceRows(
      rows.slice(0, 3),
      [rows[2], rows[3]],
      { direction: 'history', maxRows: 4 },
    );

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
        input: JSON.stringify({ route: '/gateway/traces/recent', requiredScope: 'trace:read' }),
      }),
    );

    expect(formatted.inputLabel).toBe('/gateway/traces/recent · trace:read');
    expect(formatted.inputLabel).not.toBe('request details');
  });
});
