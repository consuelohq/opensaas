import { describe, expect, it } from 'vitest';
import { buildObservabilityTracesSite } from '../scripts/lib/observability-traces-site';
import { sanitizeTraceHistoryRowForTest } from '../scripts/lib/trace-sites-local-read-backend';
import {
  branchSummary,
  traceTokenUsage,
} from '../scripts/lib/trace-site-inspector/model';
import {
  createInspectorState,
  reduceInspectorState,
} from '../scripts/lib/trace-site-inspector/inspector-state';
import {
  formatTokenCount,
  inspectorReadingValue,
  renderInspectorPayload,
} from '../scripts/lib/trace-site-inspector/reading-view';

describe('trace inspector reading and metrics', () => {
  it('preserves missing versus recorded-zero counts through the actual history adapter', () => {
    const missing = sanitizeTraceHistoryRowForTest({
      rowid: 1,
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      input_json: '"' + 'x'.repeat(40) + '"',
      result_json: '"' + 'y'.repeat(40) + '"',
    });
    expect(traceTokenUsage(missing).total.value).toBeNull();
    const zero = sanitizeTraceHistoryRowForTest({
      rowid: 2,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
    expect(traceTokenUsage(zero).total).toEqual({ value: 0, estimated: false });
  });
  it('delivers the maintained reading style with the generated trace page', () => {
    expect(buildObservabilityTracesSite()).toContain(
      'id="consuelo-trace-inspector-reading"',
    );
  });
  it('preserves recorded zero and accepts persisted token aliases', () => {
    expect(
      traceTokenUsage({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        input: 'long payload',
      }),
    ).toEqual({
      input: { value: 0, estimated: false },
      output: { value: 0, estimated: false },
      total: { value: 0, estimated: false },
    });
    expect(
      traceTokenUsage({ input_tokens: 12, output_tokens: 8 }).total,
    ).toEqual({ value: 20, estimated: false });
  });

  it('keeps absent historical usage unknown instead of estimating payload size', () => {
    const usage = traceTokenUsage({
      rawInputJson: 'x'.repeat(40),
      rawResultJson: 'y'.repeat(80),
    });
    expect(usage.input).toEqual({ value: null, estimated: false });
    expect(usage.output).toEqual({ value: null, estimated: false });
    expect(usage.total).toEqual({ value: null, estimated: false });
    expect(formatTokenCount(usage.total)).toBe('—');
  });

  it('does not invent a directional split from a recorded total or invent a missing count', () => {
    const usage = traceTokenUsage({ totalTokens: 30 });
    expect(usage.input.value).toBeNull();
    expect(usage.output.value).toBeNull();
    expect(usage.total).toEqual({ value: 30, estimated: false });
    expect(formatTokenCount(usage.input)).toBe('—');
    expect(traceTokenUsage({}).total.value).toBeNull();
  });

  it('counts failed steps once when their batch and standalone history row are also loaded', () => {
    const child = {
      traceId: 'child-1',
      name: 'fs.read',
      ok: false,
      code: 'NOT_FOUND',
      inputTokens: 3,
      outputTokens: 4,
    };
    const parent = {
      traceId: 'batch-1',
      name: 'batch',
      branch: 'task/trace-site/test',
      ok: false,
      code: 'FAILED',
      inputTokens: 10,
      outputTokens: 20,
      batchResultsJson: [child],
    };
    const summary = branchSummary(
      [parent, { ...child, id: 'history-row-2', branch: parent.branch }],
      parent,
    );
    expect(summary.failures).toBe(1);
    expect(summary.calls).toBe(2);
    expect(summary.usage.total).toEqual({ value: 30, estimated: false });
    expect(summary.totalTokens).toBe(30);
  });

  it('finds failed children even when their batch envelope succeeded', () => {
    const parent = {
      traceId: 'batch-2',
      name: 'batch',
      ok: true,
      branch: 'task/test',
      batchResultsJson: [
        {
          traceId: 'child-2',
          tool: 'code.call',
          ok: false,
          code: 'COMMAND_FAILED',
        },
      ],
    };
    expect(branchSummary([parent], parent).failures).toBe(1);
  });

  it('counts one failed operation through multiple nested batch wrappers', () => {
    const parent = {
      traceId: 'outer',
      name: 'batch',
      ok: false,
      code: 'FAILED',
      batchResultsJson: [
        {
          traceId: 'inner',
          tool: 'batch',
          ok: false,
          code: 'FAILED',
          data: {
            results: [
              {
                traceId: 'leaf',
                tool: 'fs.read',
                ok: false,
                code: 'NOT_FOUND',
              },
            ],
          },
        },
      ],
    };
    expect(branchSummary([parent], parent).failures).toBe(1);
  });

  it('does not collapse anonymous loaded calls into one record', () => {
    const rows = [{ name: 'fs.read' }, { name: 'fs.search' }];
    expect(branchSummary(rows, rows[0]).calls).toBe(2);
  });

  it('keeps an unknown branch token direction unknown rather than showing a partial sum as complete', () => {
    const rows = [
      { id: 'a', branch: 'task/test', inputTokens: 2, outputTokens: 3 },
      { id: 'b', branch: 'task/test', totalTokens: 10 },
    ];
    const summary = branchSummary(rows, rows[0]);
    expect(summary.usage.input.value).toBeNull();
    expect(summary.usage.total.value).toBe(15);
  });

  it('opens Output and preserves the chosen section across selection and live updates', () => {
    let state = createInspectorState();
    expect(state.activeSection).toBe('output');
    state = reduceInspectorState(state, {
      type: 'set-section',
      section: 'input',
    });
    state = reduceInspectorState(state, {
      type: 'select',
      key: 'call-1',
      row: { id: 'call-1' },
    });
    state = reduceInspectorState(state, {
      type: 'rows-replaced',
      rows: [{ id: 'call-1', output: 'updated' }],
    });
    expect(state.activeSection).toBe('input');
    expect(state.selectedRow?.output).toBe('updated');
  });

  it('moves input transport bookkeeping into Details while preserving the raw trace', () => {
    const input = {
      requestId: 'request-123',
      taskSession: 'tsk_test',
      language: 'python',
      code: 'print(1)',
    };
    const row = { rawInputJson: JSON.stringify(input) };
    expect(inspectorReadingValue(row, 'input')).toEqual({
      language: 'python',
      code: 'print(1)',
    });
    expect(inspectorReadingValue(row, 'details')).toMatchObject({
      requestId: 'request-123',
      taskSession: 'tsk_test',
    });
    expect(JSON.parse(row.rawInputJson)).toEqual(input);
  });

  it('unwraps transport envelopes for Output while preserving domain objects', () => {
    const result = {
      ok: true,
      code: 'OK',
      message: 'command completed',
      data: { stdout: 'hello', exitCode: 0 },
    };
    expect(
      inspectorReadingValue(
        { rawResultJson: JSON.stringify(result) },
        'output',
      ),
    ).toEqual({ stdout: 'hello' });
    const domain = { data: { records: [1, 2] }, page: 2 };
    expect(inspectorReadingValue({ outputObj: domain }, 'output')).toEqual(
      domain,
    );
  });

  it('renders adjacent short fields and gives complete long values their own block', () => {
    const body = 'A complete document\n'.repeat(350) + 'END OF DOCUMENT';
    const html = renderInspectorPayload({ language: 'python', content: body });
    expect(html).toContain('<dt>language</dt>');
    expect(html).toContain('<dd>');
    expect(html).toContain('tiLongField');
    expect(html).toContain('END OF DOCUMENT');
    expect(html).not.toContain('Preview limited');
  });

  it('escapes field names and values and preserves zero and false', () => {
    const html = renderInspectorPayload({
      '<script>': '<img src=x onerror=alert(1)>',
      code: 0,
      enabled: false,
    });
    expect(html).not.toContain('<img ');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('0');
    expect(html).toContain('false');
  });
});
