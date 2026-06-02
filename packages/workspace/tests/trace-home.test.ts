import { describe, expect, test } from 'vitest';
import {
  buildTraceHomeModel,
  classifyTaskCallCommand,
  renderTraceHome,
  resolveTraceDb,
  sanitizeDefaultText,
  terminalSequences,
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

const githubWrapperError = "execFileSync('gh', args, { encoding: 'utf8' });\nError: job is still in progress; logs unavailable\n    at githubRaw (/repo/packages/workspace/scripts/gh.js:44:10)";

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
    stderr: 'tmux: ... script verify exited with code 1\n',
    result_json: JSON.stringify({ ok: false, code: 'COMMAND_FAILED', message: 'command failed', exitCode: 1 }),
  }),
  row({
    rownum: 4,
    record_id: 'task-exec-suspect',
    trace_id: 'trc_exec_suspect',
    ts: '2026-06-01T20:01:25.000Z',
    tool: 'task.exec',
    branch: 'task/workspace/clarify-tools-search-steering-usage',
    duration_ms: 850,
    total_tokens: 500,
    resolved_input_json: JSON.stringify({ command: ['bash', '-lc', 'grep -R trace:watch scripts/operator'] }),
  }),
  row({
    rownum: 5,
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
    rownum: 6,
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
    rownum: 7,
    record_id: 'github-wrapper',
    trace_id: 'trc_gh',
    ts: '2026-06-01T20:01:50.000Z',
    tool: 'github',
    branch: 'task/workspace/clarify-tools-search-steering-usage',
    status: 'failed',
    code: 'COMMAND_FAILED',
    exit_code: 1,
    duration_ms: 1200,
    total_tokens: 100,
    resolved_input_json: JSON.stringify({ operation: 'raw', rawArgs: ['run', 'view', '123', '--log'] }),
    stderr: githubWrapperError,
    result_json: JSON.stringify({ ok: false, code: 'COMMAND_FAILED', message: githubWrapperError }),
  }),
  row({
    rownum: 8,
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

    expect(model.header).toMatchObject({ title: 'trace:home', live: true, rows: 8, errors: 2, branches: 2 });
    expect(model.rows).toHaveLength(8);
    expect(model.rows[0].children).toHaveLength(2);
    expect(model.rows[7].children.map((child) => child.tool)).toEqual(['fs.read', 'fs.search', 'task.call', 'git.diff']);

    expect(model.summary).toMatchObject({ rows: 8, errors: 2, running: 0, branches: 2, since: '10:01:12' });
    expect(model.topTools.map((tool) => tool.tool)).toEqual(['code.run', 'review.run', 'task.call', 'batch', 'task.exec', 'github']);
    expect(model.rawShell).toMatchObject({ total: 4, good: 1, suspect: 2, bad: 1 });

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

  test('sanitizes wrapper internals from default table, inspect, and json output', () => {
    const model = buildTraceHomeModel(fixtureRows, {
      selectedTraceId: 'trc_gh',
      sinceLabel: '10:01:12',
    });
    const output = renderTraceHome(model, { width: 151, height: 44, color: false });

    expect(sanitizeDefaultText(githubWrapperError)).not.toContain("execFileSync('gh', args");
    expect(output).not.toContain("execFileSync('gh', args");
    expect(model.selected?.stderr).toContain('job still in progress; logs unavailable yet');
    expect(model.rawJson).not.toContain("execFileSync('gh', args");
    expect(output).toContain('github raw');
  });

  test('classifies task.call and task.exec command quality', () => {
    expect(classifyTaskCallCommand(['bun', '--cwd', 'packages/os', 'run', 'tools:search']).quality).toBe('good');
    expect(classifyTaskCallCommand(['task.exec', 'bash', '-lc', "sed -n '1,260p' packages/os/scripts/install.ts"]).quality).toBe('suspect');
    expect(classifyTaskCallCommand(['bash', '-lc', 'grep -R trace:watch scripts/operator']).quality).toBe('suspect');
    expect(classifyTaskCallCommand(['bash', '-lc', 'rm -rf .task/tmp && git reset --hard']).quality).toBe('bad');
  });

  test('builds selected tree context for batch and code.run children', () => {
    const model = buildTraceHomeModel(fixtureRows, { selectedTraceId: 'trc_code', sinceLabel: '10:01:12' });
    const tree = model.tree.lines.join('\n');

    expect(tree).toContain('> code.run');
    expect(tree).toContain('├─ ✓ fs.read');
    expect(tree).toContain('├─ ✓ fs.search');
    expect(tree).toContain('├─ ✓ task.call');
    expect(tree).toContain('├─ ✓ git.diff');
  });

  test('renders deterministic fixed-size frame output', () => {
    const model = buildTraceHomeModel(fixtureRows, {
      selectedTraceId: 'trc_suspect',
      sinceLabel: '10:01:12',
      live: true,
    });
    const output = renderTraceHome(model, { width: 120, height: 36, color: false });
    const lines = output.split('\n');

    expect(lines).toHaveLength(36);
    expect(lines[0]).toContain('trace:home');
    expect(output).toContain('SUMMARY');
    expect(output).toContain('trace:inspect');
    expect(output).toContain('trace:tree');
    expect(output).toContain('trace:json');
    expect(output).toContain('enter: open');
  });

  test('exposes alternate-screen lifecycle sequences for live mode', () => {
    expect(terminalSequences.enter).toContain('\u001b[?1049h');
    expect(terminalSequences.exit).toContain('\u001b[?1049l');
    expect(terminalSequences.exit).toContain('\u001b[?25h');
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
});
