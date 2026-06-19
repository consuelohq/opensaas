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

function batchRow(childResult: Record<string, unknown>, stepInput: Record<string, unknown>): TraceWatchRow {
  const ok = childResult.ok === true;
  return {
    rownum: 2,
    record_id: 'batch-1',
    ts: '2026-06-18T06:12:42.000Z',
    trace_id: 'trc_batch',
    tool: 'batch',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/strengthen-code-call-examples',
    worktree: '.task/workspace-agents/strengthen-code-call-examples',
    status: ok ? 'ok' : 'error',
    code: ok ? 'OK' : 'COMMAND_FAILED',
    exit_code: ok ? 0 : 1,
    duration_ms: 1400,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    input_json: '{}',
    resolved_input_json: JSON.stringify({ steps: [{ tool: 'code.call', input: stepInput }] }),
    result_json: JSON.stringify({
      ok,
      code: ok ? 'OK' : 'COMMAND_FAILED',
      message: ok ? 'batch completed' : 'batch stopped after a failed step',
      data: { results: [childResult], completed: 1 },
    }),
    stderr: '',
    result_json_chars: 0,
    stderr_chars: 0,
  };
}

function fsWriteFailureRow(): TraceWatchRow {
  return {
    rownum: 3,
    record_id: 'fs-write-1',
    ts: '2026-06-18T06:45:42.000Z',
    trace_id: 'trc_fs_write',
    tool: 'fs.write',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    worktree: '.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    status: 'error',
    code: 'COMMAND_FAILED',
    exit_code: 1,
    duration_ms: 192,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    input_json: '{}',
    resolved_input_json: JSON.stringify({
      path: '.task/workspace-agents/example/workpad.md',
      content: '# workpad\n\n' + 'large attempted content '.repeat(40),
    }),
    result_json: JSON.stringify({
      ok: false,
      code: 'COMMAND_FAILED',
      message: 'command failed',
    }),
    stderr: '# workpad\n\n' + 'large attempted content '.repeat(40) + '\nerror: .task/workspace-agents/example/workpad.md already exists. use --force to overwrite or --append to add.',
    stderr_chars: 1200,
  };
}

function fsReadSuccessRow(): TraceWatchRow {
  return {
    rownum: 4,
    record_id: 'fs-read-1',
    ts: '2026-06-18T07:43:24.000Z',
    trace_id: 'trc_fs_read',
    tool: 'fs.read',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    worktree: '.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    status: 'ok',
    code: 'OK',
    exit_code: 0,
    duration_ms: 615,
    input_tokens: 10,
    output_tokens: 20,
    total_tokens: 30,
    input_json: '{}',
    resolved_input_json: JSON.stringify({ path: 'scripts/operator/trace-watch.ts' }),
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'command completed',
      data: { type: 'text-page', path: 'scripts/operator/trace-watch.ts', totalLines: 969 },
    }),
    stderr: '',
  };
}

function verifySuccessRow(): TraceWatchRow {
  return {
    rownum: 5,
    record_id: 'verify-1',
    ts: '2026-06-18T06:30:43.000Z',
    trace_id: 'trc_verify',
    tool: 'verify',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    worktree: '.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    status: 'ok',
    code: 'OK',
    exit_code: 0,
    duration_ms: 5854,
    input_tokens: 1,
    output_tokens: 1608,
    total_tokens: 1609,
    input_json: '{}',
    resolved_input_json: JSON.stringify({ base: 'origin/stream/workspace-agents' }),
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'command completed',
      data: {
        passed: true,
        publishValid: true,
        files: [
          'packages/workspace/tests/trace-watch.test.ts',
          'scripts/operator/trace-watch.ts',
          '.task/workspace-agents/example/workpad.md',
          '.task/workspace-agents/example/verify.json',
        ],
        testSelection: {
          data: {
            selectedSuites: [{ name: 'trace watch build' }],
            runResults: [{ name: 'trace watch build', status: 'passed' }],
            failedSuites: [],
          },
        },
        because: { lines: ['review ran static_rules, eslint, typecheck, spec_compliance and passed'] },
      },
    }),
    stderr: '',
  };
}

function reviewRunSuccessRow(): TraceWatchRow {
  return {
    rownum: 6,
    record_id: 'review-1',
    ts: '2026-06-18T06:30:28.000Z',
    trace_id: 'trc_review',
    tool: 'review.run',
    task_session: 'tsk_1',
    branch: 'task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    worktree: '.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands',
    status: 'ok',
    code: 'OK',
    exit_code: 0,
    duration_ms: 4321,
    input_tokens: 1,
    output_tokens: 1608,
    total_tokens: 1609,
    input_json: '{}',
    resolved_input_json: JSON.stringify({ noTests: true }),
    result_json: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'command completed',
      data: {
        schema: 'review.summary.v1',
        files: 3,
        summary: {
          blockingIssues: 0,
          yourIssues: 0,
          preExistingIssues: 5,
          failedTestSuites: 0,
        },
      },
    }),
    stderr: '',
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
  return lines.join('\n');
}

describe('trace:watch file and verification row details', () => {
  test('keeps failed fs.write target path visible before verbose stderr content', () => {
    const rendered = captureRow(fsWriteFailureRow());
    const firstLine = rendered.split('\n')[0] || '';

    expect(firstLine).toContain('.task/workspace-agents/example/workpad.md');
    expect(rendered).toContain('already exists');
    expect(firstLine).not.toContain('large attempted content');
  });

  test('shows fs.read target paths on successful rows', () => {
    const rendered = captureRow(fsReadSuccessRow());
    const firstLine = rendered.split('\n')[0] || '';

    expect(firstLine).toContain('scripts/operator/trace-watch.ts');
    expect(firstLine).toContain('text-page');
  });

  test('summarizes verify file and suite counts in the main row', () => {
    const rendered = captureRow(verifySuccessRow());
    const firstLine = rendered.split('\n')[0] || '';

    expect(firstLine).toContain('verify passed');
    expect(firstLine).toContain('publish-valid');
    expect(firstLine).toContain('files 4');
    expect(firstLine).toContain('suites 1');
    expect(firstLine).toContain('runs 1');
  });

  test('uses SQL-derived verify counts when result JSON is compacted', () => {
    const rendered = captureRow({
      ...verifySuccessRow(),
      result_json: '{"ok":true',
      verify_files_count: 2,
      verify_selected_suites_count: 1,
      verify_run_results_count: 1,
      verify_failed_suites_count: 0,
      verify_passed: 1,
      verify_publish_valid: 1,
    });
    const firstLine = rendered.split('\n')[0] || '';

    expect(firstLine).toContain('verify passed');
    expect(firstLine).toContain('publish-valid');
    expect(firstLine).toContain('files 2');
    expect(firstLine).toContain('suites 1');
    expect(firstLine).toContain('runs 1');
  });

  test('summarizes review file and issue counts in the main row', () => {
    const rendered = captureRow(reviewRunSuccessRow());
    const firstLine = rendered.split('\n')[0] || '';

    expect(firstLine).toContain('review passed');
    expect(firstLine).toContain('files 3');
    expect(firstLine).toContain('issues 0');
    expect(firstLine).toContain('pre-existing 5');
  });

  test('uses SQL-derived review counts when result JSON is compacted', () => {
    const rendered = captureRow({
      ...reviewRunSuccessRow(),
      result_json: '{"ok":true',
      review_files_count: 3,
      review_blocking_issues: 0,
      review_your_issues: 0,
      review_pre_existing_issues: 5,
      review_failed_test_suites: 0,
    });
    const firstLine = rendered.split('\n')[0] || '';

    expect(firstLine).toContain('review passed');
    expect(firstLine).toContain('files 3');
    expect(firstLine).toContain('issues 0');
    expect(firstLine).toContain('pre-existing 5');
  });
});

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
    expect(operations.map((operation) => operation.tool)).toEqual(['code.call cmd', 'code.call cmd']);
    expect(operations.every((operation) => operation.totalTokens === undefined)).toBe(true);
    expect(operations.map((operation) => operation.detail)).toEqual([
      'bun --cwd packages/workspace test tests/tool-manifest.test.ts',
      'bun --cwd packages/os test tests/tool-manifest.test.ts',
    ]);

    const rendered = captureRow(codeCallRow());
    expect(rendered).toContain('code.call cmd');
    const nestedLines = rendered.split('\n').filter((line) => line.includes('↳')).join('\n');
    expect(nestedLines).not.toContain('0 tokens');
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

  test('uses compact SQL-derived code.call results when stdout JSON is sliced', () => {
    const compactResults = [
      { command: 'fake alpha', ok: true, exitCode: 0, durationMs: 12, stdoutChars: 9506, stderrChars: 0 },
      { command: 'fake beta', ok: true, exitCode: 0, durationMs: 13, stdoutChars: 9505, stderrChars: 0 },
      { command: 'fake gamma', ok: true, exitCode: 0, durationMs: 14, stdoutChars: 9506, stderrChars: 0 },
      { command: 'fake delta', ok: true, exitCode: 0, durationMs: 15, stdoutChars: 9506, stderrChars: 0 },
      { command: 'fake epsilon', ok: true, exitCode: 0, durationMs: 16, stdoutChars: 9508, stderrChars: 0 },
    ];
    const slicedStdout = JSON.stringify({ ok: true, results: compactResults.map((result) => ({
      ...result,
      stdout: 'x'.repeat(result.stdoutChars),
      stderr: '',
    })) }).slice(0, 12000);
    const row = codeCallRow({
      result_json: '{"ok":true',
      code_call_language: 'bun',
      code_call_mode: 'read',
      code_call_stdout: slicedStdout,
      code_call_results_json: JSON.stringify(compactResults),
      code_call_files_changed_count: 0,
      code_call_truncated: 0,
    });

    expect(summarizeCodeCallForTraceWatch(row)).toMatchObject({
      language: 'bun',
      mode: 'read',
      stdoutShape: 'json',
      quality: 'good',
      changedCount: 0,
      truncated: false,
    });
    expect(nestedOperationsForRow(row).map((operation) => operation.detail)).toEqual([
      'fake alpha',
      'fake beta',
      'fake gamma',
      'fake delta',
      'fake epsilon',
    ]);
    expect(captureRow(row)).toContain('code.call cmd');
  });

  test('labels failed test command packets as test failures without invented zero token counts', () => {
    const row = codeCallRow({
      status: 'error',
      code: 'COMMAND_FAILED',
      exit_code: 1,
      result_json: JSON.stringify({
        ok: false,
        code: 'COMMAND_FAILED',
        message: 'code.call command failed',
        data: {
          ok: false,
          exitCode: 1,
          language: 'bun',
          runtime: 'bun',
          mode: 'verify',
          stdout: JSON.stringify({
            ok: false,
            results: [
              { command: 'bun --cwd packages/workspace test tests/tool-manifest.test.ts', ok: false, exitCode: 1 },
            ],
          }),
          stderr: '',
          filesChanged: [],
          truncated: false,
        },
      }),
    });

    const operations = nestedOperationsForRow(row);
    const rendered = captureRow(row);

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      tool: 'code.call cmd',
      ok: false,
      code: 'TESTS_FAILED',
      detail: 'bun --cwd packages/workspace test tests/tool-manifest.test.ts',
    });
    expect(operations[0].totalTokens).toBeUndefined();
    expect(rendered).toContain('TESTS_FAILED');
    expect(rendered).toContain('tests failed');
    expect(rendered).toContain('code.call cmd');
    expect(rendered).not.toContain('COMMAND_FAILED');
    const nestedLines = rendered.split('\n').filter((line) => line.includes('↳')).join('\n');
    expect(nestedLines).not.toContain('0 tokens');
  });

  test('renders batch code.call children with code.call summaries and nested token totals', () => {
    const stepInput = {
      language: 'bun',
      mode: 'verify',
      codeFile: 'scripts/code-call-examples/multi-package-focused-tests.ts',
      maxResultChars: 60000,
    };
    const row = batchRow({
      ok: true,
      code: 'OK',
      message: 'code.call completed',
      durationMs: 340,
      inputTokens: 700,
      outputTokens: 400,
      totalTokens: 0,
      detail: '',
      changed: true,
      data: {
        ok: true,
        exitCode: 0,
        language: 'bun',
        runtime: 'bun',
        mode: 'verify',
        stdout: JSON.stringify({
          ok: true,
          results: [
            { command: 'bun --cwd packages/workspace test tests/workflow-intent.test.ts tests/tool-manifest.test.ts', ok: true, exitCode: 0 },
            { command: 'bun --cwd packages/os test tests/tool-manifest.test.ts', ok: true, exitCode: 0 },
          ],
        }),
        stderr: '',
        filesChanged: [],
        truncated: false,
      },
    }, stepInput);

    const operations = nestedOperationsForRow(row);
    const rendered = captureRow(row);

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      tool: 'code.call',
      ok: true,
      code: 'OK',
      inputTokens: 700,
      outputTokens: 400,
      totalTokens: 0,
      changed: false,
    });
    expect(operations[0].detail).toContain('bun/verify');
    expect(operations[0].detail).toContain('multi-command-verification');
    expect(operations[0].detail).toContain('changed 0');
    expect(rendered).toContain('1.1k tokens');
    expect(rendered).toContain('bun/verify');
    expect(rendered).toContain('multi-command-verification');
    expect(rendered).not.toContain('code.call completed');
    const nestedLines = rendered.split('\n').filter((line) => line.includes('↳')).join('\n');
    expect(nestedLines).not.toContain('0 tokens');
    expect(nestedLines).not.toContain('| changed |');
  });

  test('labels failed test code.call children inside batch rows as tests failed', () => {
    const stepInput = {
      language: 'bun',
      mode: 'verify',
      code: 'const proc = Bun.spawnSync({ cmd: ["bun", "--cwd", "packages/workspace", "test", "tests/tool-manifest.test.ts"] })',
      maxResultChars: 20000,
    };
    const row = batchRow({
      ok: false,
      code: 'COMMAND_FAILED',
      message: 'code.call command failed',
      durationMs: 670,
      inputTokens: 900,
      outputTokens: 1100,
      totalTokens: 2000,
      data: {
        ok: false,
        exitCode: 1,
        language: 'bun',
        runtime: 'bun',
        mode: 'verify',
        stdout: JSON.stringify({
          ok: false,
          results: [
            { command: 'bun --cwd packages/workspace test tests/tool-manifest.test.ts', ok: false, exitCode: 1 },
          ],
        }),
        stderr: '',
        filesChanged: [],
        truncated: false,
      },
    }, stepInput);

    const operations = nestedOperationsForRow(row);
    const rendered = captureRow(row);
    const nestedLines = rendered.split('\n').filter((line) => line.includes('↳')).join('\n');

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      tool: 'code.call',
      ok: false,
      code: 'TESTS_FAILED',
      totalTokens: 2000,
    });
    expect(operations[0].detail).toContain('tests failed');
    expect(rendered).toContain('TESTS_FAILED');
    expect(nestedLines).toContain('2.0k tokens');
    expect(nestedLines).not.toContain('COMMAND_FAILED');
    expect(nestedLines).not.toContain('0 tokens');
  });

  test('renders nested token counts when code.call result packets include token fields', () => {
    const row = codeCallRow({
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
              {
                command: 'workspace tool with model work',
                ok: true,
                exitCode: 0,
                inputTokens: 1200,
                outputTokens: 300,
                totalTokens: 1500,
              },
            ],
          }),
          stderr: '',
          filesChanged: [],
          truncated: false,
        },
      }),
    });

    const operations = nestedOperationsForRow(row);
    const rendered = captureRow(row);

    expect(operations[0]).toMatchObject({
      tool: 'code.call cmd',
      inputTokens: 1200,
      outputTokens: 300,
      totalTokens: 1500,
    });
    expect(rendered).toContain('1.5k tokens');
    const nestedLines = rendered.split('\n').filter((line) => line.includes('↳')).join('\n');
    expect(nestedLines).not.toContain('0 tokens');
  });
});
