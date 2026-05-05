import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import manifestJson from '../../../tooling/tool-manifest.json';

import { getCurrentTask, getAreaFromBranch, resolveTaskBranch } from './branch-resolver';
import { createToolResult, createTraceId, getErrorMessage, isTimeoutError, isToolResult } from './errors';
import { logToolExecution } from './logger';
import { getInputSchema } from './schemas';
import type {
  BranchResolution,
  CommandArgument,
  CommandPlan,
  ExecuteToolOptions,
  RunnerResult,
  ToolInput,
  ToolManifestEntry,
  ToolResult,
  ToolRunner,
} from './types';

export const manifestEntries = manifestJson as ToolManifestEntry[];

export function getToolManifestEntry(toolName: string): ToolManifestEntry | null {
  const directMatch = manifestEntries.find((entry) => entry.name === toolName);
  if (directMatch) return directMatch;

  const scriptMatches = manifestEntries.filter((entry) => entry.command.script === toolName);
  return scriptMatches.length === 1 ? scriptMatches[0] : null;
}

export const defaultRunner: ToolRunner = (plan, timeoutMs) => new Promise((resolve, reject) => {
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
  }, timeoutMs);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  child.on('close', (code) => {
    clearTimeout(timeout);
    if (timedOut) {
      const error = new Error(`command timed out after ${timeoutMs}ms`) as Error & { timedOut: boolean };
      error.timedOut = true;
      reject(error);
      return;
    }
    resolve({ stdout, stderr, exitCode: code ?? 0 });
  });
});

export async function executeTool<TData = unknown>(
  toolName: string,
  input: ToolInput = {},
  options: ExecuteToolOptions = {},
): Promise<ToolResult<TData>> {
  const startedAt = (options.now || Date.now)();
  const traceId = createTraceId(options.randomUUID);
  const cwd = resolveGitRoot(options.cwd || process.cwd());
  const env = options.env || process.env;
  const runner = options.runner || defaultRunner;
  const requestId = typeof input.requestId === 'string' ? input.requestId : undefined;
  let entry = getToolManifestEntry(toolName);

  try {
    if (!entry) {
      const result = createToolResult({
        ok: false,
        code: 'NOT_FOUND',
        message: `unknown tool: ${toolName}`,
        data: null,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, '', undefined, undefined, options.logMode);
      return result as ToolResult<TData>;
    }

    const schema = getInputSchema(entry.inputSchema);
    if (!schema) {
      const result = createToolResult({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: `missing input schema: ${entry.inputSchema}`,
        data: null,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, undefined, options.logMode);
      return result as ToolResult<TData>;
    }

    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const result = createToolResult({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; '),
        data: { issues: parsed.error.issues },
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, undefined, options.logMode);
      return result as ToolResult<TData>;
    }

    const normalizedInput = normalizeInput(toolName, parsed.data as ToolInput);

    const internalResult = await executeInternalTool<TData>(entry, normalizedInput, {
      cwd,
      env,
      runner,
      startedAt,
      traceId,
      requestId,
      options,
    });
    if (internalResult) return internalResult;

    const branchResolution = resolveBranchIfNeeded(entry, normalizedInput, cwd, env, options);
    if (!branchResolution.ok) {
      const result = createToolResult({
        ok: false,
        code: branchResolution.code,
        message: branchResolution.message,
        data: { candidates: branchResolution.candidates },
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode);
      return result as ToolResult<TData>;
    }

    const commandInput = {
      ...normalizedInput,
      ...(branchResolution.branch ? { branch: branchResolution.branch } : {}),
    };
    const plan = buildCommandPlan(entry, commandInput, cwd, env);
    const plannedCommand = formatCommand(plan);
    const facadeCmd = formatFacadeCommand(toolName, commandInput);

    if (entry.capabilities.mutating && commandInput.dryRun === true && !entry.command.dryRunFlag) {
      const result = createToolResult({
        ok: true,
        code: 'DRY_RUN',
        message: 'dry run: command was validated but not executed',
        data: { command: plannedCommand, resolvedArgs: commandInput },
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, plannedCommand, branchResolution.branch, facadeCmd, options.logMode);
      return result as ToolResult<TData>;
    }

    const timeoutMs = getTimeoutMs(entry, commandInput);
    const runResult = await runWithRetry(entry, plan, timeoutMs, runner);
    const cleanStderr = stripCommandEcho(runResult.stderr);
    if (runResult.timedOut) {
      const result = createToolResult({
        ok: false,
        code: 'TIMEOUT',
        message: `command timed out after ${timeoutMs}ms`,
        data: null,
        stderr: cleanStderr,
        exitCode: 1,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, plannedCommand, branchResolution.branch, facadeCmd, options.logMode);
      return result as ToolResult<TData>;
    }

    const parsedStdout = parseStdout(runResult.stdout, Boolean(entry.command.jsonFlag));
    if (parsedStdout.parseError && entry.command.jsonFlag) {
      const result = createToolResult({
        ok: false,
        code: 'PARSE_ERROR',
        message: parsedStdout.parseError,
        data: { raw: runResult.stdout },
        stderr: cleanStderr,
        exitCode: runResult.exitCode,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, plannedCommand, branchResolution.branch, facadeCmd, options.logMode);
      return result as ToolResult<TData>;
    }

    if (isToolResult(parsedStdout.data)) {
      const passthrough = parsedStdout.data as ToolResult<TData>;
      const result = {
        ...passthrough,
        now: typeof passthrough.now === 'string' ? passthrough.now : new Date((options.now || Date.now)()).toISOString(),
        stderr: stripCommandEcho(String(passthrough.stderr || '')),
        ...(requestId && !passthrough.requestId ? { requestId } : {}),
      };
      logResult(entry, toolName, result, plannedCommand, branchResolution.branch, facadeCmd, options.logMode);
      return result;
    }

    const ok = runResult.exitCode === 0;
    const result = createToolResult({
      ok,
      code: ok ? 'OK' : 'COMMAND_FAILED',
      message: ok ? 'command completed' : 'command failed',
      data: parsedStdout.data as TData,
      stderr: cleanStderr,
      exitCode: runResult.exitCode,
      durationMs: elapsedMs(startedAt, options.now),
      traceId,
      requestId,
      now: options.now,
    });
    logResult(entry, toolName, result, plannedCommand, branchResolution.branch, facadeCmd, options.logMode);
    return result;
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const result = createToolResult({
      ok: false,
      code: 'COMMAND_FAILED',
      message: `facade execution failed: ${message}`,
      data: null,
      stderr: message,
      durationMs: elapsedMs(startedAt, options.now),
      traceId,
      requestId,
    });
    logResult(entry, toolName, result, entry?.underlying || '', undefined, undefined, options.logMode);
    return result as ToolResult<TData>;
  }
}

function normalizeInput(toolName: string, input: ToolInput): ToolInput {
  if (toolName === "task.start" && !input.area && typeof input.stream === "string") {
    return { ...input, area: input.stream.replace(/^stream\//, "") };
  }

  if (toolName === "fs.http" && !input.method) {
    return { ...input, method: "get" };
  }

  if (toolName === "review.run") {
    return { ...input, mine: true };
  }

  return input;
}
async function executeInternalTool<TData>(
  entry: ToolManifestEntry,
  input: ToolInput,
  context: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    runner: ToolRunner;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
): Promise<ToolResult<TData> | null> {
  const internal = entry.command.internal;
  if (!internal) return null;

  if (internal === 'task.current') {
    const task = getCurrentTask({
      cwd: context.cwd,
      env: context.env,
      pinnedBranch: context.options.pinnedBranch,
      currentTask: context.options.currentTask,
      candidates: context.options.candidates,
    });
    const result = createToolResult({
      ok: true,
      code: 'OK',
      message: task ? 'current task resolved' : 'no current task found',
      data: task,
      durationMs: elapsedMs(context.startedAt, context.options.now),
      traceId: context.traceId,
      requestId: context.requestId,
    });
    logResult(entry, entry.name, result, entry.underlying, task?.branch, undefined, context.options.logMode);
    return result as ToolResult<TData>;
  }

  if (internal === 'task.pin') {
    const resolution = resolveBranchIfNeeded(
      { ...entry, command: { ...entry.command, branchMode: 'required' } },
      input,
      context.cwd,
      context.env,
      context.options,
    );
    if (!resolution.ok) {
      const result = createToolResult({
        ok: false,
        code: resolution.code,
        message: resolution.message,
        data: { candidates: resolution.candidates },
        durationMs: elapsedMs(context.startedAt, context.options.now),
        traceId: context.traceId,
        requestId: context.requestId,
        now: options.now,
      });
      logResult(entry, entry.name, result, entry.underlying, undefined, undefined, context.options.logMode);
      return result as ToolResult<TData>;
    }

    context.options.setPinnedBranch?.(resolution.branch);

    // persist pin to repo root .task/current.json so it survives across CLI calls
    try {
      const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd: context.cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const metaDir = path.join(repoRoot, ".task");
      fs.mkdirSync(metaDir, { recursive: true });
      const area = getAreaFromBranch(resolution.branch) || "unknown";
      const meta = { area, taskBranch: resolution.branch, pinnedAt: new Date().toISOString() };
      fs.writeFileSync(path.join(metaDir, "current.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
    } catch { /* non-critical — in-memory pin still works for this session */ }
    const result = createToolResult({
      ok: true,
      code: 'OK',
      message: 'task branch pinned',
      data: { branch: resolution.branch },
      durationMs: elapsedMs(context.startedAt, context.options.now),
      traceId: context.traceId,
      requestId: context.requestId,
    });
    logResult(entry, entry.name, result, entry.underlying, resolution.branch, undefined, context.options.logMode);
    return result as ToolResult<TData>;
  }

  if (internal === 'task.ensureSynced') {
    const resolution = resolveBranchIfNeeded(
      { ...entry, command: { ...entry.command, branchMode: 'required' } },
      input,
      context.cwd,
      context.env,
      context.options,
    );
    if (!resolution.ok) {
      const result = createToolResult({
        ok: false,
        code: resolution.code,
        message: resolution.message,
        data: { candidates: resolution.candidates },
        durationMs: elapsedMs(context.startedAt, context.options.now),
        traceId: context.traceId,
        requestId: context.requestId,
        now: options.now,
      });
      logResult(entry, entry.name, result, entry.underlying, undefined, undefined, context.options.logMode);
      return result as ToolResult<TData>;
    }

    const area = getAreaFromBranch(resolution.branch) || 'workspace-agents';
    const plan: CommandPlan = {
      command: 'bun',
      args: ['run', 'stream:context', '--', '--area', area, '--json'],
      cwd: resolveWorkspaceCommandCwd(context.cwd, 'stream:context'),
      env: { ...context.env },
    };
    const runResult = await context.runner(plan, entry.defaultTimeout);
    const data = parseStdout(runResult.stdout, true).data as Record<string, unknown> | null;
    const aheadBehind = data && typeof data === 'object' ? data.aheadBehind as Record<string, unknown> | undefined : undefined;
    const behind = typeof aheadBehind?.behind === 'number' ? aheadBehind.behind : undefined;
    const result = createToolResult({
      ok: runResult.exitCode === 0,
      code: runResult.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
      message: behind === 0 ? 'stream appears synced' : 'stream may need sync',
      data: {
        synced: behind === 0,
        branch: resolution.branch,
        area,
        behind,
        ...(behind && behind > 0 ? { action: `run stream:sync -- --area ${area}` } : {}),
      },
      stderr: stripCommandEcho(runResult.stderr),
      exitCode: runResult.exitCode,
      durationMs: elapsedMs(context.startedAt, context.options.now),
      traceId: context.traceId,
      requestId: context.requestId,
    });
    logResult(entry, entry.name, result, formatCommand(plan), resolution.branch, `workspace ${entry.name}`, context.options.logMode);
    return result as ToolResult<TData>;
  }

  const result = createToolResult({
    ok: false,
    code: 'NOT_FOUND',
    message: `unknown internal tool: ${internal}`,
    data: null,
    durationMs: elapsedMs(context.startedAt, context.options.now),
    traceId: context.traceId,
    requestId: context.requestId,
  });
  logResult(entry, entry.name, result, entry.underlying, undefined, undefined, context.options.logMode);
  return result as ToolResult<TData>;
}

function resolveBranchIfNeeded(
  entry: ToolManifestEntry,
  input: ToolInput,
  cwd: string,
  env: NodeJS.ProcessEnv,
  options: ExecuteToolOptions,
): BranchResolution {
  const branchMode = entry.command.branchMode || 'none';
  if (branchMode === 'none') return { ok: true, branch: '', source: 'none' };

  const explicitBranch = typeof input.branch === 'string' ? input.branch : undefined;
  const resolution = (options.branchResolver || resolveTaskBranch)({
    explicitBranch,
    cwd,
    env,
    pinnedBranch: options.pinnedBranch,
    currentTask: options.currentTask,
    candidates: options.candidates,
  });

  if (branchMode === 'optional' && !resolution.ok && resolution.code === 'WORKTREE_NOT_FOUND') {
    return { ok: true, branch: '', source: 'none' };
  }

  return resolution;
}

function buildCommandPlan(
  entry: ToolManifestEntry,
  input: ToolInput,
  cwd: string,
  env: NodeJS.ProcessEnv,
): CommandPlan {
  const branch = typeof input.branch === 'string' ? input.branch : '';
  const script = entry.command.script === 'task:fs' && !branch ? 'fs' : entry.command.script;
  const args = ['run', script, '--'];

  if (entry.command.branchArgumentStyle === 'prefix' && branch) {
    args.push('--branch', branch);
  }

  if (entry.command.subcommand) {
    args.push(entry.command.subcommand);
  }

  for (const argument of entry.command.arguments) {
    if (argument.source === 'branch' && entry.command.branchArgumentStyle === 'prefix') continue;
    appendArgument(args, argument, input);
  }

  if (entry.command.jsonFlag) args.push(entry.command.jsonFlag);
  if (entry.command.dryRunFlag && input.dryRun === true) args.push(entry.command.dryRunFlag);

  return {
    command: 'bun',
    args,
    cwd: resolveWorkspaceCommandCwd(cwd, script),
    env: { ...env, ...(branch ? { TASK_BRANCH: branch } : {}) },
  };
}

function appendArgument(args: string[], argument: CommandArgument, input: ToolInput): void {
  const value = input[argument.source];
  if (value === undefined || value === null || value === false) return;

  const kind = argument.kind || 'value';

  if (kind === 'boolean') {
    if (argument.flag && value === true) args.push(argument.flag);
    return;
  }

  if (kind === 'array' || kind === 'commandArray') {
    if (!Array.isArray(value)) return;
    if (value.length === 0) return;
    if (argument.flag) args.push(argument.flag);
    args.push(...value.map(String));
    return;
  }

  if (kind === 'record') {
    if (typeof value !== 'object' || value === null) return;
    for (const [key, recordValue] of Object.entries(value as Record<string, unknown>)) {
      args.push(`${key}:${String(recordValue)}`);
    }
    return;
  }

  if (argument.flag) args.push(argument.flag);
  args.push(String(value));
}

function getTimeoutMs(entry: ToolManifestEntry, input: ToolInput): number {
  return typeof input.timeout === 'number' ? input.timeout : entry.defaultTimeout;
}

async function runWithRetry(
  entry: ToolManifestEntry,
  plan: CommandPlan,
  timeoutMs: number,
  runner: ToolRunner,
): Promise<RunnerResult & { timedOut: boolean }> {
  const maxAttempts = entry.capabilities.safeToRetry ? 2 : 1;
  let lastStderr = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runner(plan, timeoutMs);
      return { ...result, timedOut: false };
    } catch (error: unknown) {
      lastStderr = getErrorMessage(error);
      if (!isTimeoutError(error) || attempt === maxAttempts) {
        return {
          stdout: '',
          stderr: lastStderr,
          exitCode: 1,
          timedOut: isTimeoutError(error),
        };
      }
    }
  }

  return {
    stdout: '',
    stderr: lastStderr,
    exitCode: 1,
    timedOut: true,
  };
}

function parseStdout(stdout: string, expectsJson: boolean): { data: unknown; parseError?: string } {
  const trimmed = stdout.trim();
  if (!trimmed) return { data: null };

  const start = findJsonStart(trimmed);
  if (start !== -1) {
    try {
      return { data: JSON.parse(trimmed.slice(start)) as unknown };
    } catch (error: unknown) {
      if (expectsJson) return { data: null, parseError: `failed to parse JSON stdout: ${getErrorMessage(error)}` };
    }
  }

  return { data: { raw: stdout } };
}

function findJsonStart(value: string): number {
  const objectStart = value.indexOf('{');
  const arrayStart = value.indexOf('[');
  if (objectStart === -1) return arrayStart;
  if (arrayStart === -1) return objectStart;
  return Math.min(objectStart, arrayStart);
}

function elapsedMs(startedAt: number, now?: () => number): number {
  return Math.max(0, (now || Date.now)() - startedAt);
}

function formatCommand(plan: CommandPlan): string {
  return [plan.command, ...plan.args].join(' ');
}

function formatFacadeCommand(toolName: string, input: ToolInput): string {
  const filtered = Object.fromEntries(
    Object.entries(input).filter(([k]) => k !== 'requestId' && k !== 'timeout'),
  );
  const hasArgs = Object.keys(filtered).length > 0;
  return hasArgs ? `workspace ${toolName} '${JSON.stringify(filtered)}'` : `workspace ${toolName}`;
}

function stripCommandEcho(stderr: string): string {
  return stderr
    .split('\n')
    .filter((line) => !line.startsWith('$ ') || !line.includes('packages/workspace/scripts/'))
    .filter((line) => !line.startsWith('→ task: ') && !line.startsWith('→ cwd: ') && !line.startsWith('→ running: '))
    .join('\n')
    .trim();
}

function resolveGitRoot(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error: unknown) {
    return cwd;
  }
}

function resolveWorkspaceCommandCwd(cwd: string, script: string): string {
  if (!script.startsWith('task:') && !script.startsWith('stream:')) return cwd;
  return resolveControllerRoot(cwd) || cwd;
}

function resolveControllerRoot(cwd: string): string | null {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const firstWorktree = output.match(/^worktree (.+)$/m);
    return firstWorktree?.[1] || null;
  } catch (error: unknown) {
    return null;
  }
}

function logResult(
  entry: ToolManifestEntry | null,
  toolName: string,
  result: ToolResult<unknown>,
  implementationCommand: string,
  branch?: string,
  facadeCommand?: string,
  logMode: ExecuteToolOptions["logMode"] = "all",
): void {
  if (logMode === "silent") return;
  if (logMode === "errors" && result.ok) return;

  logToolExecution({
    tool: entry?.name || toolName,
    branch,
    command: facadeCommand || `workspace ${entry?.name || toolName}`,
    implementationCommand: implementationCommand || undefined,
    durationMs: result.durationMs,
    exitCode: result.exitCode,
    traceId: result.traceId,
    requestId: result.requestId,
    ok: result.ok,
    code: result.code,
    capabilities: {
      readOnly: entry?.capabilities.readOnly ?? true,
      mutating: entry?.capabilities.mutating ?? false,
    },
  });
}
