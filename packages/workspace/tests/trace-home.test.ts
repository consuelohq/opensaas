import { describe, expect, test } from 'vitest';
import {
  buildTraceHomeModel,
  classifyTaskCallCommand,
  renderTraceHome,
  resolveTraceDb,
  type TraceHomeRow,
} from '../../../scripts/operator/trace-home';

function row(overrides: Partial<TraceHomeRow>): TraceHomeRow {
  return {
    rownum: 1,
    record_id: 'record-1',
    ts: '2026-06-01T20:00:33.000Z',
    trace_id: 'trc_1',
    tool: 'status',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/example',
    worktree: '.task/workspace-agents/example',
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

const fixtureRows: TraceHomeRow[] = [
  row({
    rownum: 1,
    record_id: 'batch-1',
    trace_id: 'trc_batch',
    tool: 'batch',
    branch: 'task/os/os-local-testing-readiness',
    duration_ms: 1200,
    total_tokens: 538,
    input_json: JSON.stringify({
      steps: [
        { tool: 'fs.trash', input: { path: '.task/os/os-local-testing-readiness/codex-direct.pid' } },
        { tool: 'fs.trash', input: { path: '.task/os/os-local-testing-readiness/codex-direct-started.txt' } },
      ],
    }),
    resolved_input_json: JSON.stringify([
      { tool: 'fs.trash', input: { path: '.task/os/os-local-testing-readiness/codex-direct.pid' } },
      { tool: 'fs.trash', input: { path: '.task/os/os-local-testing-readiness/codex-direct-started.txt' } },
    ]),
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'batch completed',
      data: {
        results: [
          { ok: true, code: 'OK', tool: 'fs.trash', durationMs: 220, totalTokens: 89, changed: true, detail: 'changed .task/os/os-local-testing-readiness/codex-direct.pid' },
          { ok: true, code: 'OK', tool: 'fs.trash', durationMs: 180, totalTokens: 93, changed: true, detail: 'changed .task/os/os-local-testing-readiness/codex-direct-started.txt' },
        ],
      },
    }),
  }),
  row({
    rownum: 2,
    record_id: 'good-task-call',
    trace_id: 'trc_good',
    ts: '2026-06-01T20:01:10.000Z',
    tool: 'task.call',
    branch: 'task/os/os-local-testing-readiness',
    duration_ms: 140,
    total_tokens: 3400,
    resolved_input_json: JSON.stringify({ command: ['bun', '--cwd', 'packages/os', 'run', 'tools:search', '--', '--ti'] }),
    result_json: JSON.stringify({ ok: true, code: 'OK', message: 'command completed' }),
  }),
  row({
    rownum: 3,
    record_id: 'suspect-task-call',
    trace_id: 'trc_suspect',
    ts: '2026-06-01T20:01:22.000Z',
    tool: 'task.call',
    branch: 'task/workspace/clarify-tools-search-steering-usage',
    status: 'failed',
    code: 'COMMAND_FAILED',
    exit_code: 1,
    duration_ms: 1000,
    input_tokens: 287,
    output_tokens: 72,
    total_tokens: 359,
    resolved_input_json: JSON.stringify({ command: ['bash', '-lc', "sed -n '1,260p' packages/os/scripts/install.ts"] }),
    stderr: "tmux: ... script 'verify' exited with code 1\n",
    result_json: JSON.stringify({ ok: false, code: 'COMMAND_FAILED', message: 'command failed', exitCode: 1 }),
  }),
  row({
    rownum: 4,
    record_id: 'bad-task-call',
    trace_id: 'trc_bad',
    ts: '2026-06-01T20:01:32.000Z',
    tool: 'task.call',
    branch: 'task/workspace/clarify-tools-search-steering-usage',
    duration_ms: 900,
    total_tokens: 1200,
    resolved_input_json: JSON.stringify({ command: ['bash', '-lc', 'rm -rf .task/tmp && git reset --hard'] }),
    result_json: JSON.stringify({ ok: true, code: 'OK', message: 'command completed' }),
  }),
  row({
    rownum: 5,
    record_id: 'review-1',
    trace_id: 'trc_review',
    ts: '2026-06-01T20:01:45.000Z',
    tool: 'review.run',
    branch: 'task/workspace/clarify-tools-search-steering-usage',
    duration_ms: 122100,
    total_tokens: 19700,
    result_json: JSON.stringify({ ok: true, code: 'OK', message: 'review.run completed' }),
  }),
  row({
    rownum: 6,
    record_id: 'code-run-1',
    trace_id: 'trc_code',
    ts: '2026-06-01T20:02:10.000Z',
    tool: 'code.run',
    branch: 'task/workspace/clarify-tools-search-steering-usage',
    duration_ms: 8470,
    total_tokens: 42900,
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'design/update-consuelo-roadmap-mvs-positioning',
      data: {
        operations: [
          { ok: true, code: 'OK', tool: 'fs.read', durationMs: 80, totalTokens: 212, detail: 'packages/os/README.md' },
          { ok: true, code: 'OK', tool: 'fs.search', durationMs: 1210, totalTokens: 3200, detail: 'pattern: trace:watch' },
          { ok: true, code: 'OK', tool: 'task.call', durationMs: 720, totalTokens: 1100, detail: 'bun run test:unit' },
          { ok: true, code: 'OK', tool: 'git.diff', durationMs: 410, totalTokens: 1400, detail: 'workspace changes (3 files)' },
        ],
      },
    }),
  }),
];

describe('trace home model', () => {
  test('fills every dashboard section from fixture traces', () => {
    const model = buildTraceHomeModel(fixtureRows, {
      now: new Date('2026-06-01T20:03:00.000Z'),
      selectedTraceId: 'trc_suspect',
      sinceLabel: '10:01:12',
    });

    expect(model.header).toMatchObject({ title: 'trace:home', live: true, rows: 6, errors: 1, branches: 2 });
    expect(model.rows).toHaveLength(6);
    expect(model.rows[0].children).toHaveLength(2);
    expect(model.rows[5].children.map((child) => child.tool)).toEqual(['fs.read', 'fs.search', 'task.call', 'git.diff']);

    expect(model.summary).toMatchObject({ rows: 6, errors: 1, running: 0, branches: 2, since: '10:01:12' });
    expect(model.topTools.map((tool) => tool.tool)).toEqual(['code.run', 'review.run', 'task.call', 'batch']);
    expect(model.rawShell).toMatchObject({ total: 3, good: 1, suspect: 1, bad: 1 });

    expect(model.selected?.traceId).toBe('trc_suspect');
    expect(model.selected?.commandQuality).toMatchObject({
      quality: 'suspect',
      reason: 'Repository file inspection via shell.',
      replacement: "fs.read({ path: 'packages/os/scripts/install.ts' })",
    });
    expect(model.selected?.tabs).toEqual(['COMMAND', 'STDOUT', 'STDERR', 'JSON', 'CHILDREN (0)', 'METRICS']);

    expect(model.tree.lines.join('\n')).toContain('batch (1.20s)');
    expect(model.tree.lines.join('\n')).toContain('code.run (8.47s)');
    expect(model.rawJson).toContain('"classification"');
  });

  test('renders the mockup-aligned sections in deterministic text mode', () => {
    const model = buildTraceHomeModel(fixtureRows, {
      now: new Date('2026-06-01T20:03:00.000Z'),
      selectedTraceId: 'trc_suspect',
      sinceLabel: '10:01:12',
    });
    const output = renderTraceHome(model, { width: 151, height: 44, color: false });

    for (const section of [
      'trace:home',
      'SUMMARY',
      'TOP TOOLS (TOKENS)',
      'RAW SHELL (TASK.CALL)',
      'trace:inspect',
      'trace:tree',
      'trace:json',
      'COMMAND QUALITY',
      'Repository file inspection via shell.',
      'enter: open',
      'space: pause live',
      '/: search',
    ]) {
      expect(output).toContain(section);
    }
  });

  test('resolves trace database path with OpenWorkspace env priority', () => {
    expect(
      resolveTraceDb(undefined, {
        OPENWORKSPACE_TRACE_DB: '/tmp/openworkspace-traces.db',
        TRACE_DB: '/tmp/legacy-traces.db',
      }),
    ).toBe('/tmp/openworkspace-traces.db');
    expect(resolveTraceDb(undefined, { TRACE_DB: '/tmp/legacy-traces.db' })).toBe('/tmp/legacy-traces.db');
    expect(resolveTraceDb('/tmp/explicit-traces.db', { OPENWORKSPACE_TRACE_DB: '/tmp/openworkspace-traces.db' })).toBe('/tmp/explicit-traces.db');
  });
  test('classifies task.call command quality with nuance', () => {
    expect(classifyTaskCallCommand(['bun', '--cwd', 'packages/os', 'run', 'tools:search']).quality).toBe('good');
    expect(classifyTaskCallCommand(['bash', '-lc', "sed -n '1,260p' packages/os/scripts/install.ts"]).quality).toBe('suspect');
    expect(classifyTaskCallCommand(['bash', '-lc', 'rm -rf .task/tmp && git reset --hard']).quality).toBe('bad');
  });
});
