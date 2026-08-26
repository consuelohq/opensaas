import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  createInspectorState,
  reduceInspectorState,
} from '../scripts/lib/trace-site-inspector/inspector-state';
import {
  branchName,
  childTraceRecords,
  totalTokens,
} from '../scripts/lib/trace-site-inspector/model';
import {
  nextTraceInteractionIndex,
  traceIdentityCopyText,
} from '../scripts/lib/trace-site-inspector/interactions';
import {
  formatTraceTableRow,
  matchesTraceTableFilters,
} from '../scripts/lib/trace-site-inspector/table-formatters';

const here = dirname(fileURLToPath(import.meta.url));
const inspectorRoot = resolve(here, '../scripts/lib/trace-site-inspector');

function queryFilters(query: string) {
  return {
    query,
    tools: new Set<string>(),
    branches: new Set<string>(),
    nodes: new Set<string>(),
    routes: new Set<string>(),
    statuses: new Set<string>(),
  };
}

describe('Trace Burn keyboard and row interaction contracts', () => {
  it('uses safe tool aliases instead of falling back to trace', () => {
    expect(formatTraceTableRow({ toolName: 'fs.read', traceId: 'trc_1' }).toolLabel).toBe('fs.read');
    expect(formatTraceTableRow({ facadeTool: 'github', traceId: 'trc_2' }).toolLabel).toBe('github');
    expect(formatTraceTableRow({
      name: 'fs.search',
      traceId: 'trc_3',
      input: { pattern: 'childTraceRecords' },
    }).toolLabel).toBe('fs.search');
  });

  it('should fall through empty work paths when choosing the session label', () => {
    expect(branchName({ workPath: '', workSession: 'wrk_session_1' })).toBe('wrk_session_1');
    expect(branchName({ workPath: '', branch: 'task/os/example', taskSession: 'tsk_1' })).toBe('task/os/example');
    expect(branchName({ workPath: 'Raycast Extension', workSession: 'wrk_session_2' })).toBe('Raycast Extension');
  });

  it('uses persisted token counts first and estimates historical payload burn when counts are absent', () => {
    expect(totalTokens({ inputTokens: 12, outputTokens: 8, rawInputJson: 'x'.repeat(400) })).toBe(20);
    expect(totalTokens({ rawInputJson: 'x'.repeat(40), rawResultJson: 'y'.repeat(40) })).toBe(20);
  });

  it('materializes stored batch children with their tool names and token counts', () => {
    const children = childTraceRecords({
      traceId: 'trc_parent',
      name: 'batch',
      batchResultsJson: [
        { tool: 'fs.read', traceId: 'trc_child', inputTokens: 3, outputTokens: 5, ok: true },
      ],
    });
    expect(children).toHaveLength(1);
    expect(formatTraceTableRow(children[0]).toolLabel).toBe('fs.read');
    expect(totalTokens(children[0])).toBe(8);
  });

  it('maps batch result envelopes to their originating steps without turning tool results into ghost traces', () => {
    const children = childTraceRecords({
      traceId: 'trc_parent_envelopes',
      name: 'batch',
      rawResolvedInputJson: {
        steps: [
          {
            tool: 'fs.read',
            input: { path: 'packages/os/scripts/lib/trace-site-inspector/model.ts' },
          },
          {
            tool: 'explore',
            input: { query: 'find inspector', limit: 2 },
          },
        ],
      },
      batchResultsJson: [
        {
          name: 'trace',
          ok: true,
          code: 'OK',
          message: 'command completed',
          data: { type: 'text-page' },
        },
        {
          ok: true,
          code: 'OK',
          message: 'command completed',
          data: {
            query: 'find inspector',
            results: [
              { path: 'packages/os/a.ts', score: 1 },
              { path: 'packages/os/b.ts', score: 0.9 },
            ],
          },
        },
      ],
    });

    expect(children).toHaveLength(2);
    expect(children.map((child) => formatTraceTableRow(child).toolLabel)).toEqual([
      'fs.read',
      'explore',
    ]);
    expect(formatTraceTableRow(children[0]).inputLabel).toBe('read model.ts');
    expect(formatTraceTableRow(children[1]).inputLabel).toBe('find inspector');
  });

  it('closing the inspector clears the selected row instead of leaving a stale highlight', () => {
    const selected = createInspectorState({
      selectedKey: 'trc_1',
      selectedRow: { traceId: 'trc_1', name: 'fs.read' },
      layout: 'split',
    });
    expect(reduceInspectorState(selected, { type: 'close' })).toMatchObject({
      selectedKey: '',
      selectedRow: null,
      layout: 'collapsed',
    });
  });

  it('moves deterministically through trace targets and copies tool plus trace id', () => {
    expect(nextTraceInteractionIndex(5, -1, 1)).toBe(0);
    expect(nextTraceInteractionIndex(5, 0, 1)).toBe(1);
    expect(nextTraceInteractionIndex(5, 4, 1)).toBe(4);
    expect(nextTraceInteractionIndex(5, 2, -1)).toBe(1);
    expect(traceIdentityCopyText({ name: 'code.call', traceId: 'trc_abc' })).toBe('code.call · trc_abc');
  });

  it('matches trace search by free text, structured fields, and date', () => {
    const row = {
      traceId: 'trc_search_1',
      name: 'fs.read',
      branch: 'feature/trace-search',
      startTime: '2026-08-13T17:42:10.000Z',
      status: 'success',
      code: 'OK',
      inputJson: { path: 'packages/os/scripts/os.ts' },
      resultJson: { message: 'read complete' },
    };

    expect(matchesTraceTableFilters(row, queryFilters('fs.read'))).toBe(true);
    expect(matchesTraceTableFilters(row, queryFilters('feature/trace-search'))).toBe(true);
    expect(matchesTraceTableFilters(row, queryFilters('2026-08-13'))).toBe(true);
    expect(matchesTraceTableFilters(
      row,
      queryFilters('tool:fs.read branch:feature/trace-search date:2026-08-13 status:success'),
    )).toBe(true);
    expect(matchesTraceTableFilters(row, queryFilters('tool:code.call'))).toBe(false);
  });

  it('wires toggle filters, Vim navigation, slash search, and last-interaction copy into the OS browser runtime', () => {
    const browser = readFileSync(resolve(inspectorRoot, 'browser.ts'), 'utf8');
    const virtualList = readFileSync(resolve(inspectorRoot, 'virtual-list-browser.ts'), 'utf8');
    expect(browser).toContain("event.key === 'ArrowUp'");
    expect(browser).toContain("event.key === 'ArrowDown'");
    expect(browser).toContain("event.key.toLowerCase() === 'j'");
    expect(browser).toContain("event.key.toLowerCase() === 'k'");
    expect(browser).toContain("event.key === '/'");
    expect(browser).toContain("event.key === 'Enter'");
    expect(browser).toContain("event.key.toLowerCase() === 'c'");
    expect(browser).toContain("event.key.toLowerCase() === 'f'");
    expect(browser).toContain("event.key === 'Escape'");
    expect(browser).toContain('virtualList?.toggleFilters()');
    expect(browser).toContain('openTraceSearch');
    expect(browser).toContain('closeTraceSearch');
    expect(browser).toContain('data-trace-search');
    expect(browser).toContain('data-trace-search-close');
    expect(browser).toContain('lastTraceInteraction');
    expect(browser).toContain('consuelo.trace-return-home.preference');
    expect(browser).toContain('Do not ask again');
    expect(browser).toContain('Return home?');
    expect(virtualList).toContain('moveFocus');
    expect(virtualList).toContain('clearSelection');
    expect(virtualList).toContain('toggleFilters');
    expect(virtualList).toContain('setQuery');
  });
});
