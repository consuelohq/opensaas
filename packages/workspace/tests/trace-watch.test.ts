import { describe, expect, test } from 'vitest';

import {
  compactSuccessDetail,
  nestedOperationsForRow,
  renderRow,
  summarizeCodeCallForTraceWatch,
  type Args,
} from '../../../scripts/operator/trace-watch';

type TraceWatchRow = Record<string, unknown>;

const baseArgs: Args = {
  errors: false,
  json: false,
  rawJson: false,
  color: false,
  once: true,
  help: false,
  nested: true,
  limit: 0,
  interval: 1000,
};

function codeCallRow(overrides: Partial<TraceWatchRow> = {}): TraceWatchRow {
  return {
    rownum: 1,
    record_id: 'code-call-1',
    ts: '2026-06-18T05:04:56.000Z',
    trace_id: 'trc_code_call',
    tool: 'code.call',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples',
    worktree: '.task/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples',
    status: 'ok',
    code: 'OK',
    exit_code: 0,
    duration_ms: 7440,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    input_json: '{}',
    resolved_input_json: JSON.stringify({
      language: 'bun',
      mode: 'verify',
      code: 'const commands = [["bun", "--cwd", "packages/workspace", "test", "tests/tool-manifest.test.ts"]]; Bun.spawnSync({ cmd: commands[0] })',
      maxResultChars: 60000,
    }),
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'code.call completed',
      data: {
        ok: true,
        exitCode: 0,
        language: 'bun',
        runtime: 'bun',
        mode: 'verify',
        stdout: JSON.stringify({
          ok: true,
          results: [
            { command: 'bun --cwd packages/workspace test tests/tool-manifest.test.ts', ok: true, exitCode: 0, durationMs: 1200 },
            { command: 'bun --cwd packages/os test tests/tool-manifest.test.ts', ok: true, exitCode: 0, durationMs: 900 },
          ],
        }),
        stderr: '',
        filesChanged: [],
        truncated: false,
      },
    }),
    stderr: '',
    result_json_chars: 0,
    stderr_chars: 0,
    ...overrides,
  };
}

function captureRow(row: TraceWatchRow): string {
  const lines: string[] = [];
  const originalLog = console.log;
  try {
    console.log = (value?: unknown) => {
      lines.push(String(value ?? ''));
    };
    renderRow(baseArgs, row);
  } finally {
    console.log = originalLog;
  }
  return lines.join('\\n');
}

describe('trace:watch code.call telemetry', () => {
  test('summarizes structured Bun verification packets in the visible watcher row', () => {
    const row = codeCallRow();
    const summary = summarizeCodeCallForTraceWatch(row);

    expect(summary).toMatchObject({
      language: 'bun',
      mode: 'verify',
      sourceKind: 'inline',
      stdoutShape: 'json',
      changedCount: 0,
      truncated: false,
      intent: 'multi-command-verification',
      quality: 'good',
    });
    expect(summary.sourceLines).toBeGreaterThan(0);
    expect(compactSuccessDetail(row)).toContain('bun/verify');
    expect(compactSuccessDetail(row)).toContain('multi-command-verification');
    expect(compactSuccessDetail(row)).toContain('changed 0');

    const rendered = captureRow(row);
    expect(rendered).toContain('bun/verify');
    expect(rendered).toContain('multi-command-verification');
    expect(rendered).toContain('good');
    expect(rendered).toContain('changed 0');
  });

  test('renders child command rows from code.call JSON stdout results', () => {
    const operations = nestedOperationsForRow(codeCallRow());

    expect(operations).toHaveLength(2);
    expect(operations.map((operation) => operation.tool)).toEqual(['code.call step', 'code.call step']);
    expect(operations.map((operation) => operation.detail)).toEqual([
      'bun --cwd packages/workspace test tests/tool-manifest.test.ts',
      'bun --cwd packages/os test tests/tool-manifest.test.ts',
    ]);

    const rendered = captureRow(codeCallRow());
    expect(rendered).toContain('code.call step');
    expect(rendered).toContain('bun --cwd packages/workspace test tests/tool-manifest.test.ts');
    expect(rendered).toContain('bun --cwd packages/os test tests/tool-manifest.test.ts');
  });

  test('flags Bash used only as Bun transport as suspect', () => {
    const row = codeCallRow({
      resolved_input_json: JSON.stringify({
        language: 'bash',
        mode: 'verify',
        code: 'bun --cwd packages/workspace test tests/tool-manifest.test.ts',
        maxResultChars: 20000,
      }),
      result_json: JSON.stringify({
        ok: true,
        code: 'OK',
        message: 'code.call completed',
        data: {
          ok: true,
          exitCode: 0,
          language: 'bash',
          runtime: 'bash',
          mode: 'verify',
          stdout: '',
          stderr: '',
          filesChanged: [],
          truncated: false,
        },
      }),
    });

    const summary = summarizeCodeCallForTraceWatch(row);

    expect(summary).toMatchObject({
      language: 'bash',
      mode: 'verify',
      intent: 'package-script-orchestration',
      quality: 'suspect',
      reason: 'Bash used only to invoke Bun.',
      replacement: 'use language="bun" and Bun.spawnSync(...)',
    });
    expect(compactSuccessDetail(row)).toContain('suspect');
    expect(compactSuccessDetail(row)).toContain('Bash used only to invoke Bun');
    expect(captureRow(row)).toContain('language="bun"');
  });

  test('reports codegen edit packets with changed count and truncation', () => {
    const row = codeCallRow({
      duration_ms: 582,
      resolved_input_json: JSON.stringify({
        language: 'bun',
        mode: 'edit',
        code: 'const commands = [["bun", "run", "--cwd", "packages/workspace", "generate-tool-manifest"]]; await Bun.write("packages/workspace/TOOLS.md", "updated")',
        maxResultChars: 50000,
      }),
      result_json: JSON.stringify({
        ok: true,
        code: 'OK',
        message: 'code.call completed',
        data: {
          ok: true,
          exitCode: 0,
          language: 'bun',
          runtime: 'bun',
          mode: 'edit',
          stdout: JSON.stringify({
            ok: true,
            results: [
              { command: 'bun run --cwd packages/workspace generate-tool-manifest', ok: true, exitCode: 0 },
            ],
          }),
          stderr: '',
          filesChanged: ['packages/workspace/TOOLS.md', 'packages/workspace/manifests/tool-manifest.json'],
          truncated: true,
        },
      }),
    });

    expect(summarizeCodeCallForTraceWatch(row)).toMatchObject({
      language: 'bun',
      mode: 'edit',
      intent: 'codegen',
      quality: 'good',
      changedCount: 2,
      truncated: true,
    });
    expect(compactSuccessDetail(row)).toContain('codegen');
    expect(compactSuccessDetail(row)).toContain('changed 2');
    expect(compactSuccessDetail(row)).toContain('truncated');
  });

  test('uses SQL-derived code.call columns when result_json is compacted', () => {
    const row = codeCallRow({
      result_json: '{"ok":true',
      code_call_language: 'bun',
      code_call_mode: 'verify',
      code_call_stdout: JSON.stringify({
        ok: true,
        results: [
          { command: 'bun --cwd packages/workspace test tests/trace-watch.test.ts', ok: true, exitCode: 0 },
        ],
      }),
      code_call_files_changed_count: 0,
      code_call_truncated: 0,
    });

    expect(summarizeCodeCallForTraceWatch(row)).toMatchObject({
      language: 'bun',
      mode: 'verify',
      stdoutShape: 'json',
      intent: 'focused-test',
      quality: 'good',
      changedCount: 0,
      truncated: false,
    });
    expect(nestedOperationsForRow(row).map((operation) => operation.detail)).toEqual([
      'bun --cwd packages/workspace test tests/trace-watch.test.ts',
    ]);
  });
});
