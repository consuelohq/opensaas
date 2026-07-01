import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getCurrentTask, resolveTaskBranch } from '../../scripts/lib/facade/branch-resolver';
import { runBatch } from '../../scripts/lib/facade/batch';
import { executeTool, getToolManifestEntry, manifestEntries } from '../../scripts/lib/facade/executor';
import { parseSubagentOutput, parseSubagentTraceEvents } from '../../scripts/lib/subagent/runtime';
import { getInputSchema } from '../../scripts/lib/facade/schemas';
import type { CommandArgument, CommandPlan, ToolInput, ToolRunner } from '../../scripts/lib/facade/types';

const TEST_BRANCH = 'task/workspace-agents/test';
const TEST_UUID = 'abc123def4567890abc123def4567890';

function stableOptions(runner: ToolRunner, plans: CommandPlan[] = []) {
  return {
    cwd: '/tmp/not-a-repo',
    runner: async (plan: CommandPlan, timeoutMs: number) => {
      plans.push(plan);
      return runner(plan, timeoutMs);
    },
    branchResolver: ({ explicitBranch }: { explicitBranch?: string }) => ({
      ok: true as const,
      branch: explicitBranch || TEST_BRANCH,
      source: explicitBranch ? 'explicit' : 'test',
    }),
    now: () => 1000,
    randomUUID: () => TEST_UUID,
    currentTask: {
      branch: TEST_BRANCH,
      area: 'workspace-agents',
      prNumber: 225,
      worktree: '/tmp/worktree',
    },
    candidates: [
      {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        prNumber: 225,
        worktree: '/tmp/worktree',
      },
    ],
  };
}

function successfulRunner(): ToolRunner {
  return async () => ({
    stdout: JSON.stringify({ value: 'ok' }),
    stderr: '',
    exitCode: 0,
  });
}

function failingRunner(): ToolRunner {
  return async () => ({
    stdout: JSON.stringify({ value: 'failed' }),
    stderr: 'boom',
    exitCode: 2,
  });
}

function timeoutRunner(): ToolRunner {
  return async () => {
    throw { timedOut: true, message: 'timed out' };
  };
}

function passthroughRunner(): ToolRunner {
  return async () => ({
    stdout: JSON.stringify({
      ok: true,
      code: 'OK',
      message: 'passthrough',
      data: { value: 'ok' },
      stderr: '',
      exitCode: 0,
      durationMs: 4,
      traceId: 'trc_passthrough',
      apiVersion: '1.0.0',
    }),
    stderr: '',
    exitCode: 0,
  });
}

function exampleInput(entryName: string): ToolInput {
  const entry = manifestEntries.find((item) => item.name === entryName);
  if (!entry) throw new Error(`missing entry: ${entryName}`);
  const input = { ...entry.exampleInput };
  delete input.dryRun;
  return input;
}

function writeTaskSession(tempRoot: string, taskSession: string, branch: string = TEST_BRANCH): void {
  mkdirSync(join(tempRoot, '.task'), { recursive: true });
  writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
    taskSession,
    tmuxSession: 'opensaas-test',
    branch,
    worktree: tempRoot,
  }, null, 2));
}

function writeNamespacedTaskSession(tempRoot: string, taskSession: string, branch: string): void {
  const [, area, ...slugParts] = branch.split('/');
  const slug = slugParts.join('-');
  const taskDir = join(tempRoot, '.task', area, slug);
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(join(taskDir, 'session.json'), JSON.stringify({
    taskSession,
    tmuxSession: 'opensaas-test',
    branch,
    worktree: tempRoot,
  }, null, 2));
}

function writeInstruction(tempRoot: string, content = 'Do a safe read-only check.'): string {
  const instructionPath = join(tempRoot, 'subagent-instructions.md');
  writeFileSync(instructionPath, content);
  return instructionPath;
}

function writeFakeCodex(tempRoot: string): string {
  const binDir = join(tempRoot, 'bin');
  mkdirSync(binDir, { recursive: true });
  const bin = join(binDir, 'codex');
  writeFileSync(bin, [
    '#!/usr/bin/env bash',
    'if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then',
    '  echo "Usage: codex exec [OPTIONS] [PROMPT]"',
    '  echo "instructions are read from stdin"',
    '  echo "--cd <DIR>"',
    '  echo "--sandbox <SANDBOX_MODE>"',
    '  echo "--ask-for-approval <APPROVAL_POLICY>"',
    '  echo "--json"',
    '  exit 0',
    'fi',
    'node -e \'process.stdout.write("x".repeat(9000)); process.stderr.write("e".repeat(9000));\'',
    '',
  ].join('\n'));
  chmodSync(bin, 0o700);
  return binDir;
}


function writeFakePi(tempRoot: string): string {
  const binDir = join(tempRoot, 'bin');
  mkdirSync(binDir, { recursive: true });
  const bin = join(binDir, 'pi');
  writeFileSync(bin, [
    '#!/usr/bin/env bash',
    'cat <<\'JSON\'',
    '{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"pong"}],"usage":{"input":1,"output":1,"cacheRead":0}}}',
    'JSON',
    '',
  ].join('\n'));
  chmodSync(bin, 0o700);
  return binDir;
}

const SNAPSHOT_EXCLUDED_TOOLS = new Set(['fs.read', 'fs.search', 'tools.search']);

function executableEntries() {
  return manifestEntries.filter((entry) => !entry.command.internal && entry.sessionRequired !== true && !SNAPSHOT_EXCLUDED_TOOLS.has(entry.name));
}

describe('typed facade executor', () => {
  it('registers every manifest input schema', () => {
    const missing = manifestEntries
      .map((entry) => entry.inputSchema)
      .filter((name, index, names) => names.indexOf(name) === index)
      .filter((name) => !getInputSchema(name));
    expect(missing).toEqual([]);
  });

  it('exposes code.call as the language execution facade', () => {
    const entry = getToolManifestEntry('code.call');

    expect(entry?.methodPath).toEqual(['code', 'call']);
    expect(entry?.inputSchema).toBe('CodeCallInput');
    expect(entry?.outputSchema).toBe('CodeCallOutput');
    expect(entry?.command.internal).toBe('code.call');
    expect(getInputSchema('CodeCallInput')).toBeTruthy();
  });

  it('tools.search ranks intent keywords and returns usage guidance', async () => {
    const toolsSearchScript = join(import.meta.dirname, '..', '..', 'scripts', 'tools-search.ts');
    const packageRoot = join(import.meta.dirname, '..', '..');
    const runSearch = (query: string, limit = 5) => {
      const result = spawnSync('bun', [toolsSearchScript, query, '--limit', String(limit), '--json'], {
        cwd: packageRoot,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      return JSON.parse(result.stdout);
    };

    const linearPayload = runSearch('linear issue');
    const linearNames = linearPayload.matches.map((match: { name: string }) => match.name);
    expect(linearNames.slice(0, 3)).toContain('linear.issue');
    expect(linearNames).toContain('linear.search');
    const linearIssue = linearPayload.matches.find((match: { name: string }) => match.name === 'linear.issue');
    expect(linearIssue.inputSignature).toContain('identifier');
    expect(linearIssue.usage.workspaceCall).toContain('workspace.call');

    const ticketPayload = runSearch('ticket', 4);
    const ticketNames = ticketPayload.matches.map((match: { name: string }) => match.name);
    expect(ticketNames).toContain('linear.issue');

    expect(runSearch('file search', 4).matches[0].name).toBe('fs.search');
    expect(runSearch('railway-logs', 4).matches[0].name).toBe('railway.logs');
    expect(runSearch('browser screenshot', 4).matches[0].name).toBe('browser.screenshot');
    const codexSubagent = runSearch('codex subagent', 4).matches[0];
    expect(codexSubagent.name).toBe('subagent');

    const fileSearch = runSearch('file search', 4).matches[0];
    expect(fileSearch.name).toBe('fs.search');
    expect(fileSearch.usage.workspaceCall).toContain('taskSession');

    const missingPayload = runSearch('no-such-made-up-tool', 4);
    expect(missingPayload.totalMatches).toBe(0);
    expect(missingPayload.matches).toEqual([]);
    expect(missingPayload.guidance).toContain('No matching tools found');
  }, 15000);
  it('rejects contradictory tools.search capability filters', async () => {
    const result = await executeTool('tools.search', { query: 'linear issue', readOnly: true, mutating: true }, stableOptions(successfulRunner()));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('readOnly and mutating cannot both be true');
  });

  it('provides fs.patch facade guidance with the fs.apply_patch manifest entry', async () => {
    const result = await executeTool('fs.patch', { path: 'tmp/example.txt' }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toContain('fs.patch is not a workspace tool');
    expect(result.message).toContain('fs.apply_patch');

    const data = result.data as {
      requestedTool?: string;
      replacementTool?: string;
      manifestEntry?: {
        name?: string;
        inputSchema?: string;
        command?: { subcommand?: string };
      };
    };

    expect(data.requestedTool).toBe('fs.patch');
    expect(data.replacementTool).toBe('fs.apply_patch');
    expect(data.manifestEntry?.name).toBe('fs.apply_patch');
    expect(data.manifestEntry?.inputSchema).toBe('FsApplyPatchInput');
    expect(data.manifestEntry?.command?.subcommand).toBe('apply-patch');
  });

  it('keeps generic unknown tool messages compact', async () => {
    const result = await executeTool('missing.tool', {}, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('unknown tool: missing.tool');
    expect(result.data).toBeNull();
  });

  it('plans canonical context search through the context runtime', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('context', {
      operation: 'search',
      keyword: 'workspace',
      limit: 1,
    }, stableOptions(successfulRunner(), plans));

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(plans).toHaveLength(1);
    expect(plans[0].args).toEqual(expect.arrayContaining([
      'context',
      '--',
      'search',
      'workspace',
      '--limit',
      '1',
      '--json',
    ]));
  });

  it('plans canonical context trace through the context runtime', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('context', {
      operation: 'trace',
      status: 'error',
      limit: 1,
    }, stableOptions(successfulRunner(), plans));

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(plans).toHaveLength(1);
    expect(plans[0].args).toEqual(expect.arrayContaining([
      'context',
      '--',
      'trace',
      '--status',
      'error',
      '--limit',
      '1',
      '--json',
    ]));
  });

  it('rejects canonical context calls without an operation', async () => {
    const result = await executeTool('context', {
      keyword: 'workspace',
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('operation');
  });

  it.each(executableEntries().map((entry) => entry.name))('returns a success envelope for %s', async (toolName) => {
    const result = await executeTool(toolName, exampleInput(toolName), stableOptions(successfulRunner()));
    expect(result).toMatchSnapshot();
  });

  it.each(executableEntries().map((entry) => entry.name))('returns a failure envelope for %s', async (toolName) => {
    const result = await executeTool(toolName, exampleInput(toolName), stableOptions(failingRunner()));
    expect(result).toMatchSnapshot();
  });

  it.each(executableEntries().map((entry) => entry.name))('returns a timeout envelope for %s', async (toolName) => {
    const result = await executeTool(toolName, exampleInput(toolName), stableOptions(timeoutRunner()));
    expect(result.code).toBe('TIMEOUT');
    expect(result.ok).toBe(false);
  });

  it.each(manifestEntries.map((entry) => entry.name))('validates input for %s', async (toolName) => {
    const entry = manifestEntries.find((item) => item.name === toolName);
    if (!entry) throw new Error(`missing entry: ${toolName}`);
    const schema = getInputSchema(entry.inputSchema);
    if (!schema || schema.safeParse({}).success) return;

    const result = await executeTool(toolName, {}, stableOptions(successfulRunner()));
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it.each(manifestEntries.filter((entry) => !entry.command.internal && entry.capabilities.mutating && !entry.command.dryRunFlag && entry.sessionRequired !== true).map((entry) => entry.name))('supports synthetic dry-run for %s', async (toolName) => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(toolName, { ...exampleInput(toolName), dryRun: true }, stableOptions(successfulRunner(), plans));
    expect(result.code).toBe('DRY_RUN');
    expect(plans).toHaveLength(0);
  });

  it.each(manifestEntries.filter((entry) => entry.capabilities.mutating && entry.command.dryRunFlag && entry.sessionRequired !== true).map((entry) => entry.name))('passes native dry-run through for %s', async (toolName) => {
    const plans: CommandPlan[] = [];
    const result = await executeTool(toolName, { ...exampleInput(toolName), dryRun: true }, stableOptions(successfulRunner(), plans));
    const entry = getToolManifestEntry(toolName);
    expect(result.code).toBe('OK');
    expect(plans[0].args).toContain(entry?.command.dryRunFlag);
  });

  it('maps fs.write contentFile to --content-file', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-fs-write-content-file-'));
    try {
      writeTaskSession(tempRoot, 'tsk_fs_write_content_file');
      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.write', {
        taskSession: 'tsk_fs_write_content_file',
        path: 'tmp/example.txt',
        contentFile: '/tmp/example.txt',
        force: true,
      }, { ...stableOptions(successfulRunner(), plans), cwd: tempRoot });

      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('--content-file');
      expect(plans[0].args).toContain('/tmp/example.txt');
      expect(plans[0].args).not.toContain('--content');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects fs.write calls with both content and contentFile', async () => {
    const result = await executeTool('fs.write', {
      taskSession: 'tsk_conflict',
      path: 'tmp/example.txt',
      content: 'hello',
      contentFile: '/tmp/example.txt',
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('writes multiline content through fs write content-file and rejects stale patch command', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-fs-write-raw-'));
    const scriptPath = join(process.cwd(), 'packages/workspace/scripts/fs.js');
    const writePayload = join(tempRoot, 'write-payload.txt');
    try {
      writeFileSync(writePayload, 'line one\nline two\n');

      const writeResult = spawnSync('bun', [scriptPath, 'write', 'nested/example.txt', '--content-file', writePayload, '--mkdirs'], {
        cwd: tempRoot,
        encoding: 'utf8',
      });
      expect(writeResult.status).toBe(0);
      expect(readFileSync(join(tempRoot, 'nested/example.txt'), 'utf8')).toBe('line one\nline two\n');

      const stalePatchResult = spawnSync('bun', [scriptPath, 'patch', 'nested/example.txt', '--from', '1', '--to', '1', '--content', 'bad'], {
        cwd: tempRoot,
        encoding: 'utf8',
      });
      expect(stalePatchResult.status).toBe(1);
      expect(stalePatchResult.stderr).toContain('fs.patch has been removed');
      expect(stalePatchResult.stderr).toContain('apply-patch');
      expect(readFileSync(join(tempRoot, 'nested/example.txt'), 'utf8')).toBe('line one\nline two\n');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects fs write content-file directories', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-fs-write-dir-'));
    const scriptPath = join(process.cwd(), 'packages/workspace/scripts/fs.js');
    try {
      const result = spawnSync('bun', [scriptPath, 'write', 'example.txt', '--content-file', tempRoot], {
        cwd: tempRoot,
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('content file must be a regular file');
      expect(existsSync(join(tempRoot, 'example.txt'))).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes request ids through the envelope', async () => {
    const result = await executeTool('fs.read', {
      ...exampleInput('fs.read'),
      requestId: 'req_123',
    }, stableOptions(successfulRunner()));
    expect(result.requestId).toBe('req_123');
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('passes fs read page arguments to the CLI transport', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-fs-read-page-'));
    writeTaskSession(tempRoot, 'tsk_fs_read_page');
    const plans: CommandPlan[] = [];
    try {
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_fs_read_page',
        path: 'packages/workspace/scripts/fs.js',
        offset: 10,
        limit: 5,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans).toHaveLength(1);
      expect(plans[0].args).toEqual(expect.arrayContaining([
        'read',
        'packages/workspace/scripts/fs.js',
        '--offset',
        '10',
        '--limit',
        '5',
        '--json',
      ]));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes fs read multi-file page arguments to the CLI transport', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-fs-read-files-'));
    writeTaskSession(tempRoot, 'tsk_fs_read_files');
    const plans: CommandPlan[] = [];
    try {
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_fs_read_files',
        files: [
          { path: 'src/a.ts', offset: 1, limit: 2 },
          { path: 'src/b.ts', offset: 10, limit: 3 },
        ],
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans).toHaveLength(1);
      expect(plans[0].args).toEqual(expect.arrayContaining([
        'read',
        '--files-json',
        '[{"path":"src/a.ts","offset":1,"limit":2},{"path":"src/b.ts","offset":10,"limit":3}]',
        '--json',
      ]));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects mixed fs read pagination modes', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-fs-read-mixed-page-'));
    writeTaskSession(tempRoot, 'tsk_fs_read_mixed_page');
    const plans: CommandPlan[] = [];
    try {
      for (const topLevelPage of [{ offset: 10 }, { limit: 5 }, { from: 2 }, { to: 4 }]) {
        const result = await executeTool('fs.read', {
          taskSession: 'tsk_fs_read_mixed_page',
          files: [{ path: 'src/a.ts', offset: 1, limit: 2 }],
          ...topLevelPage,
        }, {
          ...stableOptions(successfulRunner(), plans),
          cwd: tempRoot,
          currentTask: null,
          candidates: [],
        });

        expect(result.ok).toBe(false);
        expect(result.code).toBe('VALIDATION_ERROR');
        expect(result.message).toContain('top-level pagination fields cannot be used with files');
      }

      expect(plans).toHaveLength(0);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('plans fs.search path alias through paths argument', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-search-path-'));
    writeTaskSession(tempRoot, 'tsk_search_path');
    const plans: CommandPlan[] = [];

    try {
      const result = await executeTool('fs.search', {
        taskSession: 'tsk_search_path',
        pattern: 'needle',
        path: 'packages/workspace/scripts',
        include: '*.ts',
        maxResults: 20,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('needle');
      expect(plans[0].args).toContain('packages/workspace/scripts');
      expect(plans[0].args).toContain('--include');
      expect(plans[0].args).toContain('*.ts');
      expect(plans[0].args).toContain('--max-results');
      expect(plans[0].args).toContain('20');
      expect(plans[0].args).toContain('--json');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('normalizes fs.search path alias without retaining path for downstream serialization', async () => {
    const entry = manifestEntries.find((item) => item.name === 'fs.search');
    if (!entry) throw new Error('missing fs.search manifest entry');
    const originalArguments = entry.command.arguments;
    const pathArgument: CommandArgument = { source: 'path', kind: 'value' };
    entry.command.arguments = [...originalArguments, pathArgument];

    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-search-canonical-path-'));
    writeTaskSession(tempRoot, 'tsk_search_canonical_path');
    const plans: CommandPlan[] = [];

    try {
      const result = await executeTool('fs.search', {
        taskSession: 'tsk_search_canonical_path',
        pattern: 'needle',
        path: 'packages/workspace/scripts',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].args.filter((arg) => arg === 'packages/workspace/scripts')).toHaveLength(1);
    } finally {
      entry.command.arguments = originalArguments;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects fs.search input with both path and paths', async () => {
    const result = await executeTool('fs.search', {
      taskSession: 'tsk_search_path_conflict',
      pattern: 'needle',
      path: 'packages/workspace/scripts',
      paths: ['packages/workspace/tests'],
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('provide either path or paths, not both');
  });

  it('runs http without taskSession', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('http', {
      method: 'get',
      url: 'https://example.com',
    }, {
      ...stableOptions(successfulRunner(), plans),
      currentTask: null,
      candidates: [],
    });

    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(1);
    expect(plans[0].args).toContain('https://example.com');
  });

  it('runs read-only fs tools without taskSession', async () => {
    const plans: CommandPlan[] = [];

    const readResult = await executeTool('fs.read', {
      path: 'AGENTS.md',
    }, {
      ...stableOptions(successfulRunner(), plans),
      branchResolver: () => ({
        ok: false,
        code: 'WORKTREE_NOT_FOUND',
        message: 'no active task worktree found',
        candidates: [],
      }),
      currentTask: null,
      candidates: [],
    });

    const searchResult = await executeTool('fs.search', {
      pattern: 'workspace',
      paths: ['AGENTS.md'],
      maxResults: 3,
    }, {
      ...stableOptions(successfulRunner(), plans),
      branchResolver: () => ({
        ok: false,
        code: 'WORKTREE_NOT_FOUND',
        message: 'no active task worktree found',
        candidates: [],
      }),
      currentTask: null,
      candidates: [],
    });

    expect(readResult.ok).toBe(true);
    expect(searchResult.ok).toBe(true);
    expect(plans).toHaveLength(2);
    expect(plans[0].args).not.toContain('--branch');
    expect(plans[1].args).not.toContain('--branch');
  });

  it('keeps mutating task tools fail-closed without unsafe finish hints', async () => {
    const result = await executeTool('fs.write', {
      path: 'tmp/example.txt',
      content: 'hello',
    }, {
      ...stableOptions(successfulRunner()),
      currentTask: null,
      candidates: [],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('TASK_SESSION_REQUIRED');
    expect(result.data).toMatchObject({
      tool: 'fs.write',
      repoStateBound: true,
      recovery: { action: 'start_task_session_then_retry' },
    });
    expect(JSON.stringify(result.data)).toContain('review.run');
    expect(JSON.stringify(result.data).toLowerCase()).not.toContain('clean');
  });

  it('uses options.env worktree root for taskSession discovery', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-env-'));
    const worktreeRoot = join(tempRoot, 'custom-worktrees');
    const worktree = join(worktreeRoot, 'task-workspace-agents-env');
    mkdirSync(join(worktree, '.task'), { recursive: true });
    writeFileSync(join(worktree, '.task', 'session.json'), JSON.stringify({
      taskSession: 'tsk_env_root',
      tmuxSession: 'opensaas-env',
      branch: 'task/workspace-agents/env-root',
      worktree,
    }, null, 2));

    try {
      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_env_root',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: join(tempRoot, 'empty-cwd'),
        env: { ...process.env, WORKSPACE_WORKTREE_ROOT: worktreeRoot },
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/env-root');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('should resolve namespaced taskSession metadata when unrelated worktrees are malformed', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-namespaced-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    const worktreeRoot = join(tempRoot, 'worktrees');
    process.env.WORKSPACE_WORKTREE_ROOT = worktreeRoot;
    try {
      writeNamespacedTaskSession(tempRoot, 'tsk_namespaced', 'task/workspace-agents/namespaced-session');
      mkdirSync(join(worktreeRoot, 'stream-os-sync-bad', '.task'), { recursive: true });
      writeFileSync(join(worktreeRoot, 'stream-os-sync-bad', '.task', 'session.json'), '<<<<<<< HEAD\n');
      mkdirSync(join(worktreeRoot, 'task-workspace-agents-bad', '.task'), { recursive: true });
      writeFileSync(join(worktreeRoot, 'task-workspace-agents-bad', '.task', 'session.json'), '<<<<<<< HEAD\n');

      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_namespaced',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/namespaced-session');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves taskSession metadata before branch planning', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_test',
        tmuxSession: 'opensaas-test',
        branch: 'task/workspace-agents/session-test',
        worktree: tempRoot,
      }, null, 2));

      const plans: CommandPlan[] = [];
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_test',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/session-test');
      expect(plans[0].args).toContain('--branch');
      expect(plans[0].args).toContain('task/workspace-agents/session-test');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('resolves review.run branch from taskSession before validation', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-review-session-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_review',
        tmuxSession: 'opensaas-review',
        branch: 'task/workspace-agents/review-session',
        worktree: tempRoot,
      }, null, 2));

      const plans: CommandPlan[] = [];
      const result = await executeTool('review.run', {
        taskSession: 'tsk_review',
        noTests: true,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/review-session');
      expect(plans[0].env.TASK_WORKTREE).toBe(tempRoot);
      expect(plans[0].args).toContain('--no-tests');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('compacts review.run full-json output into summary data', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-review-compact-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_review_compact',
        tmuxSession: 'opensaas-review-compact',
        branch: TEST_BRANCH,
        worktree: tempRoot,
      }, null, 2));
      const longMessage = 'x'.repeat(2000);
      const runner: ToolRunner = async () => ({
        stdout: JSON.stringify({
          base: 'origin/main',
          branch: TEST_BRANCH,
          files: 1,
          affectedProjects: [],
          yours: [{ rule: 'TYPECHECK', file: 'src/a.ts', line: 2, msg: longMessage }],
          preExisting: [{ rule: 'ESLINT', file: 'src/b.ts', line: 3, msg: longMessage }],
          testResults: [],
          confidence: null,
        }),
        stderr: '',
        exitCode: 0,
      });

      const plans: CommandPlan[] = [];
      const result = await executeTool('review.run', { taskSession: 'tsk_review_compact', noTests: true }, {
        ...stableOptions(runner, plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('--json');
      expect(plans[0].args).not.toContain('--summary-json');
      expect((result.data as { schema?: string }).schema).toBe('review.summary.v1');
      const data = result.data as { summary: { yourIssues: number; preExistingIssues: number }; mustFix: Array<{ message: string; messageTruncated: boolean }>; preExistingDigest: { sample: Array<{ message: string; messageTruncated: boolean }> } };
      expect(data.summary.yourIssues).toBe(1);
      expect(data.summary.preExistingIssues).toBe(1);
      expect(data.mustFix[0].message.length).toBeLessThan(600);
      expect(data.mustFix[0].messageTruncated).toBe(true);
      expect(data.preExistingDigest.sample[0].message.length).toBeLessThan(600);
      expect(data.preExistingDigest.sample[0].messageTruncated).toBe(true);
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('compacts nested verify review data from legacy full-json output', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-verify-compact-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_verify_compact',
        tmuxSession: 'opensaas-verify-compact',
        branch: TEST_BRANCH,
        worktree: tempRoot,
      }, null, 2));
      const longMessage = 'y'.repeat(1800);
      const runner: ToolRunner = async () => ({
        stdout: JSON.stringify({
          branch: TEST_BRANCH,
          base: 'origin/main',
          review: {
            passed: true,
            data: {
              base: 'origin/main',
              branch: TEST_BRANCH,
              files: 1,
              affectedProjects: [],
              yours: [{ rule: 'TYPECHECK', file: 'src/a.ts', line: 2, msg: longMessage }],
              preExisting: [],
              testResults: [],
              confidence: null,
            },
          },
          db: { skipped: true, passed: true },
          passed: true,
        }),
        stderr: '',
        exitCode: 0,
      });

      const result = await executeTool('verify', { taskSession: 'tsk_verify_compact', noDb: true, noStamp: true }, {
        ...stableOptions(runner),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      const data = result.data as { review: { data: { schema?: string; mustFix: Array<{ message: string; messageTruncated: boolean }> } } };
      expect(data.review.data.schema).toBe('review.summary.v1');
      expect(data.review.data.mustFix[0].message.length).toBeLessThan(600);
      expect(data.review.data.mustFix[0].messageTruncated).toBe(true);
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes the taskSession worktree to audit', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-audit-session-'));
    try {
      const callerCwd = join(tempRoot, 'caller');
      const worktreeRoot = join(tempRoot, 'worktrees');
      const worktree = join(worktreeRoot, 'task-workspace-agents-audit');
      mkdirSync(callerCwd, { recursive: true });
      writeTaskSession(worktree, 'tsk_audit', 'task/workspace-agents/audit-session');

      const plans: CommandPlan[] = [];
      const result = await executeTool('audit', {
        taskSession: 'tsk_audit',
        scripts: true,
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: callerCwd,
        env: { ...process.env, WORKSPACE_WORKTREE_ROOT: worktreeRoot },
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].cwd).toBe(callerCwd);
      expect(plans[0].env.TASK_BRANCH).toBe('task/workspace-agents/audit-session');
      expect(plans[0].env.TASK_WORKTREE).toBe(worktree);
      expect(plans[0].args).toContain('audit');
      expect(plans[0].args).toContain('--scripts');
      expect(plans[0].args).not.toContain('--branch');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('should accept taskSession when explicit branch matches session metadata', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-branch-match-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_match',
        tmuxSession: 'opensaas-test',
        branch: TEST_BRANCH,
        worktree: tempRoot,
      }, null, 2));
      const plans: CommandPlan[] = [];

      const result = await executeTool('fs.read', {
        taskSession: 'tsk_match',
        branch: TEST_BRANCH,
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner(), plans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('--branch');
      expect(plans[0].args).toContain(TEST_BRANCH);
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('should reject taskSession when explicit branch conflicts with session metadata', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-branch-conflict-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      mkdirSync(join(tempRoot, '.task'), { recursive: true });
      writeFileSync(join(tempRoot, '.task', 'session.json'), JSON.stringify({
        taskSession: 'tsk_conflict',
        tmuxSession: 'opensaas-test',
        branch: TEST_BRANCH,
        worktree: tempRoot,
      }, null, 2));

      const result = await executeTool('fs.read', {
        taskSession: 'tsk_conflict',
        branch: 'task/workspace-agents/other',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('fails unknown taskSession handles deterministically', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-session-missing-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      const result = await executeTool('fs.read', {
        taskSession: 'tsk_missing_isolated',
        path: 'AGENTS.md',
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('TASK_SESSION_NOT_FOUND');
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('runs neutral command aliases with legacy command semantics', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-alias-session-'));
    const previousRoot = process.env.WORKSPACE_WORKTREE_ROOT;
    process.env.WORKSPACE_WORKTREE_ROOT = join(tempRoot, 'worktrees');
    try {
      writeTaskSession(tempRoot, 'tsk_alias', 'task/workspace-agents/alias-session');
      const taskCallPlans: CommandPlan[] = [];
      const taskExecPlans: CommandPlan[] = [];
      const macCallPlans: CommandPlan[] = [];
      const macExecPlans: CommandPlan[] = [];

      const taskInput = { command: exampleInput('task.call').command, taskSession: 'tsk_alias' };
      const taskCall = await executeTool('task.call', taskInput, {
        ...stableOptions(successfulRunner(), taskCallPlans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });
      const taskExec = await executeTool('task.exec', { command: exampleInput('task.exec').command, taskSession: 'tsk_alias' }, {
        ...stableOptions(successfulRunner(), taskExecPlans),
        cwd: tempRoot,
        currentTask: null,
        candidates: [],
      });
      const macCall = await executeTool('mac.call', exampleInput('mac.call'), stableOptions(successfulRunner(), macCallPlans));
      const macExec = await executeTool('mac.exec', exampleInput('mac.exec'), stableOptions(successfulRunner(), macExecPlans));

      expect(taskCall.ok).toBe(true);
      expect(taskExec.ok).toBe(true);
      expect(macCall.ok).toBe(true);
      expect(macExec.ok).toBe(true);
      expect(getToolManifestEntry('task.exec')?.description).toContain('legacy alias for task.call');
      expect(getToolManifestEntry('mac.exec')?.description).toContain('legacy alias for mac.call');
      expect(taskCallPlans[0].args).toEqual(taskExecPlans[0].args);
      expect(taskCallPlans[0].env.TASK_BRANCH).toEqual(taskExecPlans[0].env.TASK_BRANCH);
      expect(macCallPlans[0].args).toEqual(macExecPlans[0].args);
    } finally {
      if (previousRoot === undefined) delete process.env.WORKSPACE_WORKTREE_ROOT;
      else process.env.WORKSPACE_WORKTREE_ROOT = previousRoot;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes request ids through nested tool envelopes', async () => {
    const result = await executeTool('mac.exec', {
      ...exampleInput('mac.exec'),
      requestId: 'req_passthrough',
    }, stableOptions(passthroughRunner()));
    expect(result.requestId).toBe('req_passthrough');
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('includes now on validation failures', async () => {
    const result = await executeTool('fs.read', {}, stableOptions(successfulRunner()));
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('resolves unique script aliases from the manifest', () => {
    expect(getToolManifestEntry('decide-next')?.name).toBe('decideNext');
    expect(getToolManifestEntry('confidence-score')?.name).toBe('confidenceScore');
    expect(getToolManifestEntry('task:fs')).toBeNull();
  });

  it('rejects unknown subagent providers', async () => {
    const result = await executeTool('subagent', {
      provider: 'agent',
      instructionPath: 'subagent-instructions.md',
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('requires subagent instructionPath', async () => {
    const result = await executeTool('subagent', {
      provider: 'codex',
      policy: 'read',
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('requires taskSession for subagent edit policy', async () => {
    const result = await executeTool('subagent', {
      provider: 'codex',
      policy: 'edit',
      instructionPath: 'subagent-instructions.md',
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('TASK_SESSION_REQUIRED');
  });

  it('rejects unsupported subagent ship policy', async () => {
    const result = await executeTool('subagent', {
      provider: 'codex',
      policy: 'ship',
      instructionPath: 'subagent-instructions.md',
    }, stableOptions(successfulRunner()));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('returns not_configured when codex is unavailable', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-subagent-cdx-'));
    try {
      const instructionPath = writeInstruction(tempRoot);
      const result = await executeTool('subagent', {
        provider: 'codex',
                policy: 'read',
        instructionPath,
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        env: { ...process.env, PATH: '' },
      });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('not_configured');
      expect(result.data.provider).toBe('codex');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns stable unavailable statuses for opencode and grok', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-subagent-unavailable-'));
    try {
      const instructionPath = writeInstruction(tempRoot);
      const opencode = await executeTool('subagent', { provider: 'opencode', policy: 'read', instructionPath }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        env: { ...process.env, PATH: '' },
      });
      const grok = await executeTool('subagent', { provider: 'grok', policy: 'read', instructionPath }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        env: { ...process.env, PATH: '' },
      });

      expect(opencode.ok).toBe(true);
      expect(opencode.data.status).toBe('not_configured');
      expect(opencode.data.provider).toBe('opencode');
      expect(grok.ok).toBe(true);
      expect(grok.data.status).toBe('not_configured');
      expect(grok.data.provider).toBe('grok');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('runs pi provider through the facade with configurable mini profile', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-subagent-pi-'));
    try {
      const binDir = writeFakePi(tempRoot);
      const instructionPath = writeInstruction(tempRoot);
      const result = await executeTool('subagent', {
        provider: 'pi',
                policy: 'read',
        instructionPath,
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        env: { ...process.env, PATH: `${binDir}${process.env.PATH ? `:${process.env.PATH}` : ''}` },
      });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.provider).toBe('pi');
            expect(result.data.command[0]).toContain('/pi');
      expect(result.data.command).toContain('--no-session');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('exposes a subagent Bun script wrapper over subagent', () => {
    const tempRoot = mkdtempSync(join(process.cwd(), 'tmp-subagent-cli-'));
    try {
      const instructionPath = writeInstruction(tempRoot);
      const fakePiPath = writeFakePi(tempRoot);
      const run = spawnSync('bun', [
        'packages/workspace/scripts/subagent.ts',
        '--provider', 'pi',
        '--policy', 'read',
        '--instruction-path', instructionPath,
        '--cwd', tempRoot,
      ], {
        cwd: process.cwd(),
        env: { ...process.env, PATH: `${fakePiPath}${process.env.PATH ? `:${process.env.PATH}` : ''}` },
        encoding: 'utf8',
      });

      expect(run.status).toBe(0);
      const result = JSON.parse(run.stdout);
      expect(result.ok).toBe(true);
      expect(result.data.provider).toBe('pi');
            expect(result.data.status).toBe('completed');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });


  it('extracts compact final messages from codex json output', () => {
    const huge = 's'.repeat(9000);
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'test' }),
      JSON.stringify({ type: 'item.completed', item: { type: 'mcp_tool_call', result: { content: [{ type: 'text', text: huge }] } } }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'pong' } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 1, reasoning_output_tokens: 0 } }),
    ].join('\n');

    const parsed = parseSubagentOutput('codex', stdout);

    expect(parsed.finalMessage).toBe('pong');
    expect(parsed.summaryText).toBe('pong');
    expect(parsed.usage?.inputTokens).toBe(10);
    expect(parsed.usage?.cachedInputTokens).toBe(2);
    expect(parsed.usage?.outputTokens).toBe(1);
  });
  it('normalizes codex subagent tool calls into trace events', () => {
    const stdout = [
      JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'mcp_tool_call', server: 'workspace', tool: 'get_steering', arguments: {}, result: { content: [{ type: 'text', text: 'steering' }] } } }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_1', type: 'mcp_tool_call', server: 'workspace', tool: 'call', arguments: { tool: 'fs.read', input: { path: 'README.md' } }, result: { ok: true, code: 'OK' } } }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_2', type: 'command_execution', command: 'native-search README', exit_code: 0, aggregated_output: 'match' } }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_3', type: 'agent_message', text: 'done' } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2, reasoning_output_tokens: 1 } }),
    ].join('\n');

    const events = parseSubagentTraceEvents('codex', stdout);

    expect(events.map((event) => event.tool)).toEqual([
      'codex.get_steering',
      'codex.fs.read',
      'codex.command_execution',
      'codex.agent_message',
      'codex.turn.completed',
    ]);
    expect(events[1].facadeTool).toBe('fs.read');
    expect(events[2].eventType).toBe('command_execution');
    expect(events[4].totalTokens).toBe(13);
  });

  it('extracts compact final messages from pi jsonl output', () => {
    const huge = 't'.repeat(9000);
    const stdout = [
      JSON.stringify({ type: 'session', id: 'test' }),
      JSON.stringify({ type: 'message_update', assistantMessageEvent: { type: 'thinking_delta', delta: huge } }),
      JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'pong' }], api: 'openai-codex-responses', provider: 'openai-codex', model: 'gpt-5.4', usage: { input: 11, output: 2, cacheRead: 3, totalTokens: 13 } } }),
    ].join('\n');
    const parsed = parseSubagentOutput("pi", stdout);
    expect(parsed.finalMessage).toBe('pong');
    expect(parsed.summaryText).toBe('pong');
    expect(parsed.usage?.inputTokens).toBe(11);
    expect(parsed.usage?.outputTokens).toBe(2);
    expect(parsed.usage?.cachedInputTokens).toBe(3);
  });

  it('bounds subagent output and includes audit metadata', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-subagent-output-'));
    try {
      const binDir = writeFakeCodex(tempRoot);
      const instructionPath = writeInstruction(tempRoot);
      const result = await executeTool('subagent', {
        provider: 'codex',
                policy: 'read',
        instructionPath,
        workspaceOnly: 'preferred',
      }, {
        ...stableOptions(successfulRunner()),
        cwd: tempRoot,
        env: { ...process.env, PATH: `${binDir}${process.env.PATH ? `:${process.env.PATH}` : ''}` },
      });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.stdout.length).toBeLessThan(8200);
      expect(result.data.stdout.length).toBeGreaterThan(0);
      expect(result.data.stderr.length).toBeLessThan(8200);
      expect(result.data.audit.workspaceOnly).toBe('preferred');
      expect(result.data.audit.rawShellUsed).toBe(false);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('branch resolver', () => {
  it('resolves current metadata when present', () => {
    const result = resolveTaskBranch({
      currentTask: {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        worktree: '/tmp/worktree',
      },
    });
    expect(result).toEqual({
      ok: true,
      branch: TEST_BRANCH,
      source: 'current.json',
      candidates: [
        {
          branch: TEST_BRANCH,
          area: 'workspace-agents',
          worktree: '/tmp/worktree',
        },
      ],
    });
  });

  it('returns ambiguity with candidates', () => {
    const result = resolveTaskBranch({
      currentTask: null,
      candidates: [
        { branch: TEST_BRANCH, area: 'workspace-agents', worktree: '/tmp/a' },
        { branch: 'task/workspace-agents/other', area: 'workspace-agents', worktree: '/tmp/b' },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AMBIGUOUS_TASK_SELECTION');
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('returns not found when no candidates exist', () => {
    const result = resolveTaskBranch({ currentTask: null, candidates: [] });
    expect(result).toEqual({
      ok: false,
      code: 'WORKTREE_NOT_FOUND',
      message: 'no active task worktree found; run task.start and pass taskSession, or pass explicit branch/taskWorktree',
      candidates: [],
    });
  });

  it('returns the environment-selected current task before stale metadata', () => {
    const result = getCurrentTask({
      env: { TASK_BRANCH: 'task/workspace-agents/env' },
      currentTask: {
        branch: TEST_BRANCH,
        area: 'workspace-agents',
        worktree: '/tmp/stale',
      },
      candidates: [
        { branch: TEST_BRANCH, area: 'workspace-agents', worktree: '/tmp/stale' },
        { branch: 'task/workspace-agents/env', area: 'workspace-agents', worktree: '/tmp/env' },
      ],
    });
    expect(result).toEqual({
      branch: 'task/workspace-agents/env',
      area: 'workspace-agents',
      worktree: '/tmp/env',
    });
  });
});

describe('batch facade tool', () => {
  it('routes batch through the internal executor', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('batch', {
      steps: [
        { tool: 'context.find', input: { keyword: 'workspace', limit: 1 } },
      ],
    }, stableOptions(successfulRunner(), plans));

    expect(result.ok).toBe(true);
    expect(result.code).toBe('OK');
    expect(result.data.completed).toBe(1);
    expect(plans).toHaveLength(1);
  });

  it('validates BatchInput step shape', () => {
    const schema = getInputSchema('BatchInput');

    expect(schema).not.toBeNull();
    expect(schema?.safeParse({
      steps: [{ tool: 'context.find', input: { keyword: 'workspace', limit: 1 } }],
    }).success).toBe(true);
    expect(schema?.safeParse({ steps: [] }).success).toBe(false);
    expect(schema?.safeParse({ steps: [{ input: {} }] }).success).toBe(false);
  });
});

describe('batch executor', () => {
  it('runs successful chains', async () => {
    const result = await runBatch([
      { tool: 'status', input: exampleInput('status') },
      { tool: 'stream.list', input: exampleInput('stream.list') },
    ], stableOptions(successfulRunner()));
    expect(result.ok).toBe(true);
    expect(result.data.completed).toBe(2);
    expect(result.now).toBe('1970-01-01T00:00:01.000Z');
  });

  it('stops after a failed step', async () => {
    const result = await runBatch([
      { tool: 'status', args: exampleInput('status') },
      { tool: 'stream.list', args: exampleInput('stream.list') },
    ], stableOptions(failingRunner()));
    expect(result.ok).toBe(false);
    expect(result.data.completed).toBe(1);
  });

  it('runs parallel read-only steps together', async () => {
    const plans: CommandPlan[] = [];
    const result = await runBatch([
      { tool: 'status', input: exampleInput('status'), parallel: true },
      { tool: 'stream.list', input: exampleInput('stream.list'), parallel: true },
    ], stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans).toHaveLength(2);
  });
});

describe('composed and mac wrappers', () => {
  it('builds git.diff command arguments', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-git-diff-'));
    try {
      writeTaskSession(tempRoot, 'tsk_git_diff');
      const plans: CommandPlan[] = [];
      const result = await executeTool('git.diff', {
        taskSession: 'tsk_git_diff',
        base: 'origin/main',
        stat: true,
        files: true,
        hunks: true,
        maxBytes: 20000,
      }, { ...stableOptions(successfulRunner(), plans), cwd: tempRoot });
      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('git:diff');
      expect(plans[0].args).toContain('--base');
      expect(plans[0].args).toContain('origin/main');
      expect(plans[0].args).toContain('--stat');
      expect(plans[0].args).toContain('--files');
      expect(plans[0].args).toContain('--hunks');
      expect(plans[0].args).toContain('--max-bytes');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds checkFiles command arguments', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-check-files-'));
    try {
      writeTaskSession(tempRoot, 'tsk_check_files');
      const plans: CommandPlan[] = [];
      const input = { ...exampleInput('checkFiles'), taskSession: 'tsk_check_files' };
      delete input.branch;
      const result = await executeTool('checkFiles', input, { ...stableOptions(successfulRunner(), plans), cwd: tempRoot });
      expect(result.ok).toBe(true);
      expect(plans[0].args).toContain('check-files');
      expect(plans[0].args).toContain('--stop-on-first-error');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('passes editFlow dry-run to the native script', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'workspace-edit-flow-'));
    try {
      writeTaskSession(tempRoot, 'tsk_edit_flow');
      const plans: CommandPlan[] = [];
      const input = { ...exampleInput('editFlow'), taskSession: 'tsk_edit_flow', dryRun: true };
      delete input.branch;
      const result = await executeTool('editFlow', input, { ...stableOptions(successfulRunner(), plans), cwd: tempRoot });
      expect(result.code).toBe('OK');
      expect(plans[0].args).toContain('--dry-run');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds mac operation commands', async () => {
    const plans: CommandPlan[] = [];
    const result = await executeTool('mac.exec', exampleInput('mac.exec'), stableOptions(successfulRunner(), plans));
    expect(result.ok).toBe(true);
    expect(plans[0].args).toContain('mac');
    expect(plans[0].args).toContain('exec');
  });
});


