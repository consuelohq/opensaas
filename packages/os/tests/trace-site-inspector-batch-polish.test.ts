import { describe, expect, it } from 'vitest';
import {
  childTraceRecords,
  stableTraceKey,
  traceTokenUsage,
} from '../scripts/lib/trace-site-inspector/model';
import {
  createInspectorState,
  reduceInspectorState,
} from '../scripts/lib/trace-site-inspector/inspector-state';
import { renderInspectorReading } from '../scripts/lib/trace-site-inspector/reading-view';
import { formatTraceTableRow } from '../scripts/lib/trace-site-inspector/table-formatters';

describe('batch identity and reading polish', () => {
  it('gives each occurrence of a child an identity separate from its native trace alias', () => {
    const parent = {
      id: 'batch-row',
      traceId: 'batch',
      batchResultsJson: [{ traceId: 'child', tool: 'linear.issue', ok: true }],
    };
    const child = childTraceRecords(parent)[0];
    expect(stableTraceKey(child)).not.toBe('child');
    expect(stableTraceKey(child)).toContain('batch-row');
    expect(stableTraceKey(child)).not.toBe(
      stableTraceKey(childTraceRecords({ ...parent, id: 'other-batch' })[0]),
    );
  });
  it('keeps selection identity equal to the selected record through alias refresh', () => {
    const row = { id: 'facade:child', traceId: 'child', name: 'linear.issue' };
    let state = reduceInspectorState(createInspectorState(), {
      type: 'select',
      key: 'child',
      row,
    });
    expect(state.selectedKey).toBe(stableTraceKey(row));
    state = reduceInspectorState(state, { type: 'rows-replaced', rows: [row] });
    expect(state.selectedKey).toBe(stableTraceKey(state.selectedRow));
  });
  it('prefers an exact selected key over another record sharing its native trace ID', () => {
    const child = { id: 'child', traceId: 'shared', name: 'linear.issue' };
    const other = { id: 'other', traceId: 'child', name: 'linear.issue' };
    let state = reduceInspectorState(createInspectorState(), {
      type: 'select',
      key: 'child',
      row: child,
    });
    state = reduceInspectorState(state, {
      type: 'rows-replaced',
      rows: [other, child],
    });
    expect(state.selectedRow).toEqual(child);
  });
  it('opens call details by default and humanizes timestamps while preserving raw JSON', () => {
    const row = {
      name: 'linear.issue',
      startTime: '2026-10-29T18:21:04.304Z',
      outputObj: {
        createdAt: '2026-10-29T18:21:04.304Z',
        description: '## Current operational state\n\n* A **captured** result.',
      },
    };
    const html = renderInspectorReading(row);
    expect(html).toMatch(/<details class="tiDiagnostics"[^>]* open/);
    expect(html).toContain('<h2>Current operational state</h2>');
    expect(html).toContain('<strong>captured</strong>');
    expect(html).toContain('<time ');
    expect(html).toContain('Oct 29, 2026');
    expect(row.startTime).toBe('2026-10-29T18:21:04.304Z');
  });
  it('recovers counts embedded in recorded result envelopes and sums complete batch children once', () => {
    expect(
      traceTokenUsage({
        tokenCountsRecorded: { input: false, output: false, total: false },
        inputTokens: 0,
        outputTokens: 0,
        tokens: 0,
        rawResultJson: {
          ok: true,
          code: 'OK',
          inputTokens: 7,
          outputTokens: 752,
          totalTokens: 759,
          data: { title: 'Issue' },
        },
      }).total.value,
    ).toBe(759);
    expect(
      traceTokenUsage({
        name: 'batch',
        batchResultsJson: [
          { traceId: 'a', inputTokens: 7, outputTokens: 12 },
          { traceId: 'b', inputTokens: 4, outputTokens: 8 },
        ],
      }).total.value,
    ).toBe(31);
    expect(
      traceTokenUsage({
        name: 'batch',
        batchResultsJson: [
          { traceId: 'a', inputTokens: 7, outputTokens: 12 },
          { traceId: 'b' },
        ],
      }).total.value,
    ).toBeNull();
  });
  it.each([
    [
      "wc -l src/routes.ts docs/README.md; cat docs/README.md; rg -n 'routing' src",
      ['routes.ts', 'README.md'],
    ],
    [
      "gcloud compute snapshots list --project=example --format='value(storageBytes)' --quiet",
      ['gcloud', 'snapshots'],
    ],
    [
      "printf 'STATUS'; gcloud compute ssh example --zone=us-east1-b --command='systemctl status consuelo-os'",
      ['gcloud', 'ssh'],
    ],
    [
      "const p=Bun.spawnSync({cmd:['bun','packages/os/scripts/release.ts','--action','attach'],stdout:'pipe'});",
      ['release.ts'],
    ],
  ])(
    'extracts the actual file or operational subject from remaining code patterns',
    (code, subjects) => {
      const summary = formatTraceTableRow({
        name: 'code.call',
        rawInputJson: { language: 'bash', mode: 'read', code },
      }).inputLabel;
      for (const subject of subjects) expect(summary).toContain(subject);
      expect(summary).not.toContain('inspect source');
    },
  );
});

it('recovers saved batch counters for standalone history rows across page boundaries', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { recordToolTraceSafely } =
    await import('../scripts/lib/trace-persistence');
  const { createLocalTraceSitesReadBackend } =
    await import('../scripts/lib/trace-sites-local-read-backend');
  const dir = mkdtempSync(join(tmpdir(), 'trace-batch-usage-'));
  const dbPath = join(dir, 'traces.db');
  try {
    const child = {
      traceId: 'usage-child',
      ok: true,
      code: 'OK',
      inputTokens: 7,
      outputTokens: 100,
      totalTokens: 107,
      data: { description: 'Captured issue' },
    };
    recordToolTraceSafely(
      {
        traceId: 'usage-parent',
        source: 'test',
        tool: 'batch',
        ok: true,
        status: 'ok',
        result: { ok: true, code: 'OK', data: { results: [child] } },
      },
      { dbPath },
    );
    recordToolTraceSafely(
      {
        traceId: 'usage-child',
        mcpTraceId: 'usage-parent',
        source: 'test',
        tool: 'linear.issue',
        ok: true,
        status: 'ok',
        result: {
          ok: true,
          code: 'OK',
          data: { description: 'Captured issue' },
        },
      },
      { dbPath },
    );
    const page = await createLocalTraceSitesReadBackend({ dbPath })
      .readHistoryPage!({
      workspaceId: 'wrk_test',
      workspaceHost: 'test.example',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'latest',
      limit: 1,
    });
    expect(page.rows).toHaveLength(1);
    expect(traceTokenUsage(page.rows[0]).total.value).toBe(107);
    recordToolTraceSafely(
      {
        traceId: 'usage-parent',
        source: 'duplicate-source',
        tool: 'batch',
        ok: true,
        status: 'ok',
        result: { ok: true, code: 'OK', data: { results: [child] } },
      },
      { dbPath },
    );
    const all = await createLocalTraceSitesReadBackend({ dbPath })
      .readHistoryPage!({
      workspaceId: 'wrk_test',
      workspaceHost: 'test.example',
      site: 'trace-burn-intelligence',
      sourceMode: 'local-networked',
      cursor: 'latest',
      limit: 10,
    });
    const parents = all.rows.filter((row) => row.traceId === 'usage-parent');
    expect(parents).toHaveLength(2);
    for (const parent of parents)
      expect(traceTokenUsage(parent).total.value).toBe(107);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('preserves reported zero and total-only usage and keeps cyclic unmeasurable payloads unknown', async () => {
  const { measureTracePayloadUsage } =
    await import('../scripts/lib/trace-token-usage');
  expect(
    measureTracePayloadUsage('large input', {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }),
  ).toEqual({ input: 0, output: 0, total: 0 });
  expect(measureTracePayloadUsage('large input', { totalTokens: 50 })).toEqual({
    input: null,
    output: null,
    total: 50,
  });
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(measureTracePayloadUsage(cyclic, undefined)).toEqual({
    input: null,
    output: 0,
    total: null,
  });
});
it('does not schedule redundant refreshes for an unchanged selected record', () => {
  const row = { id: 'same', traceId: 'same' };
  const state = reduceInspectorState(createInspectorState(), {
    type: 'select',
    key: 'same',
    row,
  });
  expect(
    reduceInspectorState(state, { type: 'rows-replaced', rows: [row] }),
  ).toBe(state);
  expect(reduceInspectorState(state, { type: 'rows-added', rows: [] })).toBe(
    state,
  );
});
