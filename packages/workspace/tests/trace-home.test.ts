import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { classifyTaskCallCommand, classifyTaskExecCommand } from '../scripts/trace-home/command-quality';
import { parseArgs } from '../scripts/trace-home/cli';
import { resolveTraceDb } from '../scripts/trace-home/db';
import { buildTraceHomeModel, formatTime } from '../scripts/trace-home/model';
import { stripWrapperInternals } from '../scripts/trace-home/sanitize';
import { renderTraceHome } from '../scripts/trace-home/text-renderer';
import type { TraceHomeRow } from '../scripts/trace-home/types';
import { constructTraceHomeApp } from '../scripts/trace-home/tui/app';
import {
  initialTraceHomeState,
  reduceTraceHomeState,
  stateToBuildOptions,
} from '../scripts/trace-home/tui/state';


function expectedLocalTimestamp(value: string): string {
  const date = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;
}

function row(overrides: Partial<TraceHomeRow>): TraceHomeRow {
  return {
    rownum: 1,
    record_id: 'record-1',
    ts: '2026-06-01T20:00:33.000Z',
    trace_id: 'trc_1',
    tool: 'status',
    task_session: 'tsk_1',
    branch: 'task/workspace/example',
    worktree: '.task/workspace/example',
    status: 'ok',
    code: 'OK',
    exit_code: 0,
    duration_ms: 100,
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    input_json: '{}',
    resolved_input_json: '{}',
    result_json: JSON.stringify({ ok: true, code: 'OK', message: 'command completed' }),
    stderr: '',
    ...overrides,
  };
}

const broad = ['r', 'm', ' ', '-', 'r', 'f'].join('');
const wrapper = 'execFile' + "Sync('gh', args, { encoding: 'utf8'";
const fixtureRows: TraceHomeRow[] = [
  row({
    rownum: 1,
    record_id: 'batch-1',
    trace_id: 'trc_batch',
    tool: 'batch',
    branch: 'task/os/os-local-testing-readiness',
    duration_ms: 1200,
    total_tokens: 538,
    resolved_input_json: JSON.stringify([
      { tool: 'fs.trash', input: { path: '.task/a' } },
      { tool: 'fs.trash', input: { path: '.task/b' } },
    ]),
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      data: {
        results: [
          { ok: true, code: 'OK', tool: 'fs.trash', durationMs: 220, totalTokens: 89, detail: 'changed .task/a' },
          { ok: true, code: 'OK', tool: 'fs.trash', durationMs: 180, totalTokens: 93, detail: 'changed .task/b' },
        ],
      },
    }),
  }),
  row({
    rownum: 2,
    record_id: 'task-exec-good',
    trace_id: 'trc_good',
    tool: 'task.exec',
    duration_ms: 140,
    total_tokens: 3400,
    resolved_input_json: JSON.stringify({ command: ['bun', 'test', 'packages/workspace/tests/trace-home.test.ts'] }),
  }),
  row({
    rownum: 3,
    record_id: 'task-call-suspect',
    trace_id: 'trc_suspect',
    tool: 'task.call',
    status: 'failed',
    code: 'COMMAND_FAILED',
    exit_code: 1,
    duration_ms: 1000,
    total_tokens: 359,
    resolved_input_json: JSON.stringify({ command: ['bash', '-lc', "sed -n '1,260p' packages/workspace/scripts/trace-home/model.ts"] }),
    stderr: wrapper + '\njob is still in progress; logs unavailable',
    result_json: JSON.stringify({ ok: false, code: 'COMMAND_FAILED', message: 'command failed' }),
  }),
  row({
    rownum: 4,
    record_id: 'task-exec-bad',
    trace_id: 'trc_bad',
    tool: 'task.exec',
    duration_ms: 900,
    total_tokens: 1200,
    resolved_input_json: JSON.stringify({ command: ['bash', '-lc', `${broad} .task/tmp`] }),
  }),
  row({
    rownum: 5,
    record_id: 'code-run-1',
    trace_id: 'trc_code',
    tool: 'code.run',
    duration_ms: 8470,
    total_tokens: 42900,
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      data: {
        operations: [
          { ok: true, code: 'OK', tool: 'fs.read', durationMs: 80, totalTokens: 212, detail: 'README.md' },
          { ok: true, code: 'OK', tool: 'fs.search', durationMs: 1210, totalTokens: 3200, detail: 'pattern: trace:home' },
          { ok: true, code: 'OK', tool: 'git.diff', durationMs: 410, totalTokens: 1400, detail: 'changes' },
        ],
      },
    }),
  }),
];

describe('trace home', () => {
  test('model fills dashboard sections from fixture traces', () => {
    const model = buildTraceHomeModel(fixtureRows, { selectedTraceId: 'trc_suspect', sinceLabel: '10:01:12' });
    expect(model.header).toMatchObject({ title: 'trace:home', live: true, rows: 5, errors: 1, branches: 2 });
    expect(model.visibleRows).toHaveLength(5);
    expect(model.rows[0].children).toHaveLength(2);
    expect(model.rows[4].children.map((child) => child.tool)).toEqual(['fs.read', 'fs.search', 'git.diff']);
    expect(model.rawShell).toMatchObject({ total: 3, good: 1, suspect: 1, bad: 1 });
    expect(model.topTools[0].tool).toBe('code.run');
    expect(model.inspect?.tabs).toContain('JSON');
  });

  test('model formats trace time as the local full timestamp', () => {
    const timestamp = '2026-06-01T20:00:33.000Z';

    expect(formatTime(timestamp)).toBe(expectedLocalTimestamp(timestamp));
    expect(formatTime(timestamp)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('model returns the placeholder timestamp when input is invalid', () => {
    expect(formatTime('bad-input')).toBe('---- -- -- --:--:--');
  });

  test('renderer prioritizes timestamp, tool-status alignment, and the full branch', () => {
    const timestamp = '2026-06-01T20:00:33.000Z';
    const model = buildTraceHomeModel([
      row({
        rownum: 99,
        record_id: 'layout-1',
        trace_id: 'trc_layout',
        tool: 'code.call',
        branch: 'task/workspace-agents/polish-trace-watch-layout-and-timestamps',
        ts: timestamp,
        duration_ms: 4321,
        total_tokens: 1900,
        result_json: JSON.stringify({ ok: true, code: 'OK', message: 'code.call completed' }),
      }),
    ], { selectedTraceId: 'trc_layout', live: false });

    const output = renderTraceHome(model, { width: 151, height: 44, color: false });

    expect(output).toContain('TIMESTAMP            TOOL');
    expect(output).toContain(`${expectedLocalTimestamp(timestamp)}  ✓ code.call`);
    expect(output).toContain('workspace-agents/polish-trace-watch-layout-and-timestamps');
  });

  test('sanitization hides wrapper internals and summarizes GitHub raw failure', () => {
    const model = buildTraceHomeModel(fixtureRows, { selectedTraceId: 'trc_suspect' });
    expect(stripWrapperInternals(wrapper)).not.toContain('execFileSync');
    expect(model.rawJson).not.toContain('execFileSync');
    expect(model.selected?.message).toContain('github raw failed');
  });

  test('command classification covers task.call and task.exec', () => {
    expect(classifyTaskCallCommand(['bun', 'test']).quality).toBe('good');
    expect(classifyTaskExecCommand(['bash', '-lc', "sed -n '1,20p' packages/workspace/index.ts"]).quality).toBe('suspect');
    expect(classifyTaskExecCommand(['bash', '-lc', `${broad} .task/tmp`]).quality).toBe('bad');
  });

  test('command classification marks direct file inspection as suspect', () => {
    expect(classifyTaskCallCommand(['rg', 'trace:home', 'packages/workspace']).quality).toBe('suspect');
    expect(classifyTaskExecCommand(['git', 'status']).quality).toBe('suspect');
    expect(classifyTaskExecCommand(['git', 'show', 'HEAD:packages/workspace/package.json']).replacement).toBe("fs.read({ path: 'packages/workspace/package.json' })");
  });

  test('trace db resolution derives latest trace database from trace root', () => {
    const traceRoot = mkdtempSync(join(tmpdir(), 'trace-home-'));
    try {
      const older = join(traceRoot, 'older');
      const newer = join(traceRoot, 'newer');
      mkdirSync(older);
      mkdirSync(newer);
      const olderDb = join(older, 'traces.db');
      const newerDb = join(newer, 'traces.db');
      writeFileSync(olderDb, 'older');
      writeFileSync(newerDb, 'newer');
      utimesSync(olderDb, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
      utimesSync(newerDb, new Date('2026-02-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'));

      expect(resolveTraceDb(undefined, { OPENWORKSPACE_TRACE_ROOT: traceRoot })).toBe(newerDb);
      expect(resolveTraceDb('/tmp/explicit.db', { OPENWORKSPACE_TRACE_ROOT: traceRoot })).toBe('/tmp/explicit.db');
      expect(resolveTraceDb(undefined, { TRACE_DB: '/tmp/env.db', OPENWORKSPACE_TRACE_ROOT: traceRoot })).toBe('/tmp/env.db');
    } finally {
      rmSync(traceRoot, { recursive: true, force: true });
    }
  });

  test('parseArgs preserves live TUI selection and raw json options', () => {
    expect(parseArgs(['--trace-id', 'trc_example', '--raw-json'])).toMatchObject({
      selectedTraceId: 'trc_example',
      rawJson: true,
    });
  });

  test('deterministic once renderer includes all major sections', () => {
    const output = renderTraceHome(buildTraceHomeModel(fixtureRows, { selectedTraceId: 'trc_suspect', live: false }), { width: 151, height: 44, color: false });
    for (const section of ['trace:home', 'live trace table', 'SUMMARY', 'TOP TOOLS (TOKENS)', 'RAW SHELL', 'trace:inspect', 'trace:tree', 'trace:json', 'enter: open', 'space: pause live']) expect(output).toContain(section);
  });

  test('OpenTUI app construction can be imported without launching a terminal', () => {
    const model = buildTraceHomeModel(fixtureRows);
    const app = constructTraceHomeApp(model);
    expect(app.frame).toContain('trace:home');
  });

  test('keyboard reducer covers pause, selection, failed-only, group, help, and open', () => {
    let state = { ...initialTraceHomeState, selectedTraceId: 'trc_suspect' };
    state = reduceTraceHomeState(state, { type: 'pause' });
    state = reduceTraceHomeState(state, { type: 'move', delta: 1, rowCount: 5 });
    state = reduceTraceHomeState(state, { type: 'failed' });
    state = reduceTraceHomeState(state, { type: 'group' });
    state = reduceTraceHomeState(state, { type: 'help' });
    state = reduceTraceHomeState(state, { type: 'open' });
    expect(state).toMatchObject({ paused: true, selectedIndex: 0, failedOnly: true, group: 'branch', help: true, activePane: 'inspect' });
    expect(state.selectedTraceId).toBeUndefined();
  });

  test('state build options preserve initial selected trace id and raw json', () => {
    expect(stateToBuildOptions({
      ...initialTraceHomeState,
      selectedTraceId: 'trc_example',
      rawJson: true,
    })).toMatchObject({ selectedTraceId: 'trc_example', rawJson: true });
  });
});
