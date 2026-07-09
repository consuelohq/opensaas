import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { createToolResult } from '../facade/errors';
import { logToolExecution } from '../facade/logger';
import type { ExecuteToolOptions, RunnerResult, ToolInput, ToolManifestEntry, ToolResult } from '../facade/types';

export type WorkerProvider = 'cdx' | 'pi' | 'opc' | 'mini';
export type NormalizedWorkerProvider = 'cdx' | 'pi' | 'opc';
export type WorkerMode = 'check' | 'step' | 'work';
export type WorkerPolicy = 'read' | 'safe' | 'edit' | 'ship';
export type WorkerStatus = 'completed' | 'failed' | 'not_configured' | 'not_supported' | 'timed_out' | 'approval_required';
export type WorkerWorkspaceOnly = 'preferred' | 'strict' | false;

export type WorkerCallData = {
  provider: NormalizedWorkerProvider;
  requestedProvider?: WorkerProvider;
  profile?: string;
  mode: WorkerMode;
  policy: WorkerPolicy;
  status: WorkerStatus;
  cwd: string;
  instructionPath: string;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  finalMessage?: string;
  summary?: string;
  rawLogPath?: string;
  stdoutLogPath?: string;
  stderrLogPath?: string;
  stdoutChars?: number;
  stderrChars?: number;
  usage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    reasoningOutputTokens?: number;
  };
  durationMs: number;
  audit: {
    taskSession?: string;
    branch?: string;
    workspaceOnly: WorkerWorkspaceOnly;
    rawShellUsed: boolean;
  };
};

type WorkerContext = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  startedAt: number;
  traceId: string;
  requestId?: string;
  options: ExecuteToolOptions;
};

type WorkerProviderConfig = {
  bin: string;
  defaultMode: WorkerMode;
  defaultPolicy: WorkerPolicy;
  workspaceOnly: WorkerWorkspaceOnly;
  model?: string;
  provider?: string;
  extensionPaths?: string[];
  mcpConfig?: string;
  tools?: string[];
};

export const WORKER_OUTPUT_LIMIT = 8000;
const WORKER_COMPACT_OUTPUT_LIMIT = 1200;
const WORKER_MAX_TIMEOUT_MS = 1_800_000;

const workerDefaults: Record<NormalizedWorkerProvider, {
  mode: WorkerMode;
  policy: WorkerPolicy;
  workspaceOnly: WorkerWorkspaceOnly;
}> = {
  cdx: { mode: 'work', policy: 'edit', workspaceOnly: 'preferred' },
  pi: { mode: 'step', policy: 'safe', workspaceOnly: 'strict' },
  opc: { mode: 'work', policy: 'safe', workspaceOnly: 'preferred' },
};

function normalizeWorkerProvider(input: ToolInput): { provider: NormalizedWorkerProvider; requestedProvider: WorkerProvider; profile?: string; warning?: string } {
  const requestedProvider = input.provider as WorkerProvider;
  const profile = typeof input.profile === 'string' ? input.profile : undefined;
  if (requestedProvider === 'mini') {
    return { provider: 'pi', requestedProvider, profile: profile || 'mini', warning: 'provider mini is deprecated; use provider pi with profile mini' };
  }
  return { provider: requestedProvider as NormalizedWorkerProvider, requestedProvider, profile };
}

function workerConfig(provider: NormalizedWorkerProvider, profile?: string, env: NodeJS.ProcessEnv = process.env): WorkerProviderConfig {
  if (provider === 'cdx') return {
    bin: env.WORKSPACE_WORKER_CDX_BIN || 'codex',
    defaultMode: 'work',
    defaultPolicy: 'edit',
    workspaceOnly: 'preferred',
  };
  if (provider === 'opc') return {
    bin: env.WORKSPACE_WORKER_OPC_BIN || 'opencode',
    defaultMode: 'work',
    defaultPolicy: 'safe',
    workspaceOnly: 'preferred',
    model: env.WORKSPACE_WORKER_OPC_MODEL,
  };
  return {
    bin: env.WORKSPACE_WORKER_PI_BIN || 'pi',
    defaultMode: profile === 'mini' ? 'step' : 'step',
    defaultPolicy: profile === 'mini' ? 'safe' : 'safe',
    workspaceOnly: 'strict',
    model: env.WORKSPACE_WORKER_PI_MODEL || env.WORKSPACE_WORKER_MINI_MODEL,
    provider: env.WORKSPACE_WORKER_PI_PROVIDER,
    extensionPaths: (env.WORKSPACE_WORKER_PI_EXTENSIONS || '').split(',').map((item) => item.trim()).filter(Boolean),
    mcpConfig: env.WORKSPACE_WORKER_PI_MCP_CONFIG,
    tools: (env.WORKSPACE_WORKER_PI_TOOLS || '').split(',').map((item) => item.trim()).filter(Boolean),
  };
}

export async function executeWorkerCall(
  entry: ToolManifestEntry,
  input: ToolInput,
  context: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
): Promise<ToolResult<WorkerCallData>> {
  const providerInfo = normalizeWorkerProvider(input);
  const provider = providerInfo.provider;
  const providerConfig = workerConfig(provider, providerInfo.profile, context.env);
  const defaults = { mode: providerConfig.defaultMode, policy: providerConfig.defaultPolicy, workspaceOnly: providerConfig.workspaceOnly };
  const mode = (input.mode as WorkerMode | undefined) || defaults.mode;
  const policy = (input.policy as WorkerPolicy | undefined) || defaults.policy;
  const workspaceOnly = normalizeWorkspaceOnly(input.workspaceOnly, defaults.workspaceOnly);
  const taskSession = typeof input.taskSession === 'string' ? input.taskSession : undefined;
  const branch = typeof input.branch === 'string' ? input.branch : undefined;
  const baseAudit = {
    ...(taskSession ? { taskSession } : {}),
    ...(branch ? { branch } : {}),
    workspaceOnly,
    rawShellUsed: false,
  };

  const cwdResolution = resolveWorkerCwd(input, context.cwd);
  const instructionResolution = cwdResolution.ok
    ? resolveWorkerInstructionPath(input, cwdResolution.cwd, context.cwd)
    : null;
  const resultBase = {
    provider,
    ...(providerInfo.requestedProvider !== provider ? { requestedProvider: providerInfo.requestedProvider } : {}),
    ...(providerInfo.profile ? { profile: providerInfo.profile } : {}),
    mode,
    policy,
    cwd: cwdResolution.ok ? cwdResolution.cwd : context.cwd,
    instructionPath: instructionResolution?.ok ? instructionResolution.instructionPath : String(input.instructionPath || ''),
  };

  if ((policy === 'edit' || policy === 'ship') && !taskSession) {
    return workerToolResult(entry, context, {
      ...resultBase,
      status: 'failed',
      command: [],
      stdout: '',
      stderr: 'policy requires taskSession',
      exitCode: 1,
      audit: baseAudit,
      ok: false,
      code: 'TASK_SESSION_REQUIRED',
      message: 'worker.call requires taskSession for edit and ship policies',
    });
  }

  if (policy === 'ship') {
    const hasApproval = typeof input.approval === 'object' && input.approval !== null;
    return workerToolResult(entry, context, {
      ...resultBase,
      status: hasApproval ? 'not_supported' : 'approval_required',
      command: [],
      stdout: '',
      stderr: hasApproval
        ? 'ship approval plumbing is not implemented for worker.call'
        : 'ship policy requires explicit approval',
      exitCode: 1,
      audit: baseAudit,
      ok: true,
      code: 'OK',
      message: hasApproval
        ? 'worker.call ship approval is not supported yet'
        : 'worker.call ship approval is required',
    });
  }

  if (!cwdResolution.ok) {
    return workerToolResult(entry, context, {
      ...resultBase,
      status: 'failed',
      command: [],
      stdout: '',
      stderr: cwdResolution.message,
      exitCode: 1,
      audit: baseAudit,
      ok: false,
      code: 'COMMAND_FAILED',
      message: cwdResolution.message,
    });
  }

  if (!instructionResolution?.ok) {
    return workerToolResult(entry, context, {
      ...resultBase,
      status: 'failed',
      command: [],
      stdout: '',
      stderr: instructionResolution?.message || 'instructionPath could not be resolved',
      exitCode: 1,
      audit: baseAudit,
      ok: false,
      code: 'COMMAND_FAILED',
      message: instructionResolution?.message || 'instructionPath could not be resolved',
    });
  }

  const instruction = fs.readFileSync(instructionResolution.instructionPath, 'utf8');
  const dangerous = findDangerousWorkerInstruction(instruction);
  if (dangerous) {
    return workerToolResult(entry, context, {
      ...resultBase,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      status: 'failed',
      command: [],
      stdout: '',
      stderr: dangerous,
      exitCode: 1,
      audit: baseAudit,
      ok: false,
      code: 'COMMAND_FAILED',
      message: dangerous,
    });
  }

  if (workspaceOnly === 'strict' && provider !== 'pi') {
    return workerToolResult(entry, context, {
      ...resultBase,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      status: 'not_supported',
      command: [],
      stdout: '',
      stderr: 'strict workspaceOnly cannot be enforced for this provider',
      exitCode: 1,
      audit: baseAudit,
      ok: true,
      code: 'OK',
      message: 'worker.call strict workspaceOnly is not supported by provider',
    });
  }

  if (provider === 'pi') {
    return executePiWorker(entry, context, {
      provider,
      ...(providerInfo.requestedProvider !== provider ? { requestedProvider: providerInfo.requestedProvider } : {}),
      ...(providerInfo.profile ? { profile: providerInfo.profile } : {}),
      mode,
      policy,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      instruction,
      workspaceOnly,
      audit: baseAudit,
      timeoutMs: workerTimeoutMs(entry, input),
    });
  }

  if (provider === 'opc') {
    return executeOpcWorker(entry, context, {
      provider,
      ...(providerInfo.requestedProvider !== provider ? { requestedProvider: providerInfo.requestedProvider } : {}),
      ...(providerInfo.profile ? { profile: providerInfo.profile } : {}),
      mode,
      policy,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      instruction,
      workspaceOnly,
      audit: baseAudit,
      timeoutMs: workerTimeoutMs(entry, input),
    });
  }

  return executeCdxWorker(entry, context, {
    provider,
    ...(providerInfo.requestedProvider !== provider ? { requestedProvider: providerInfo.requestedProvider } : {}),
    ...(providerInfo.profile ? { profile: providerInfo.profile } : {}),
    mode,
    policy,
    cwd: cwdResolution.cwd,
    instructionPath: instructionResolution.instructionPath,
    instruction,
    workspaceOnly,
    audit: baseAudit,
    timeoutMs: workerTimeoutMs(entry, input),
  });
}

async function executeCdxWorker(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: NormalizedWorkerProvider;
    requestedProvider?: WorkerProvider;
    profile?: string;
    mode: WorkerMode;
    policy: WorkerPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: WorkerWorkspaceOnly;
    audit: WorkerCallData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<WorkerCallData>> {
  const config = workerConfig('cdx', input.profile, context.env);
  const codex = findExecutable(config.bin, context.env);
  if (!codex) {
    return workerToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, 'exec'],
      stdout: '',
      stderr: 'codex CLI was not found on PATH',
      exitCode: 127,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'cdx provider is not configured',
    });
  }

  const help = readCommandHelp(codex, ['exec', '--help'], context.env);
  if (help && (!help.includes('codex exec') || !/stdin|-\s+is used|read from stdin/i.test(help))) {
    return workerToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [codex, 'exec', '--help'],
      stdout: '',
      stderr: 'codex exec does not advertise a supported non-interactive stdin mode',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'cdx provider is not supported by this Codex CLI',
    });
  }

  const args = ['exec'];
  if (help.includes('--cd')) args.push('--cd', input.cwd);
  if (help.includes('--sandbox')) args.push('--sandbox', input.policy === 'read' || input.policy === 'safe' ? 'read-only' : 'workspace-write');
  if (help.includes('--ask-for-approval')) args.push('--ask-for-approval', 'never');
  if (help.includes('--json')) args.push('--json');
  args.push('-');

  const command = [codex, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runWorkerProcess({
    command: codex,
    args,
    cwd: input.cwd,
    env: context.env,
    stdin: workerInstruction(input.instruction, input.workspaceOnly),
    timeoutMs: input.timeoutMs,
  });
  const status: WorkerStatus = run.timedOut ? 'timed_out' : run.exitCode === 0 ? 'completed' : 'failed';
  return workerToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactWorkerOutput({
      provider: 'cdx',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr: run.stderr,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: run.exitCode === 0 && !run.timedOut,
    code: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut ? 'cdx provider timed out' : run.exitCode === 0 ? 'cdx provider completed' : 'cdx provider failed',
  });
}

async function executeOpcWorker(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: NormalizedWorkerProvider;
    requestedProvider?: WorkerProvider;
    profile?: string;
    mode: WorkerMode;
    policy: WorkerPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: WorkerWorkspaceOnly;
    audit: WorkerCallData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<WorkerCallData>> {
  const config = workerConfig('opc', input.profile, context.env);
  const opencode = findExecutable(config.bin, context.env);
  if (!opencode) {
    return workerToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, 'run'],
      stdout: '',
      stderr: 'opencode CLI was not found on PATH',
      exitCode: 127,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'opc provider is not configured',
    });
  }

  if (input.policy === 'edit') {
    return workerToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [opencode, 'run'],
      stdout: '',
      stderr: 'opencode edit policy is disabled until permission behavior is validated',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'opc provider edit policy is not supported yet',
    });
  }

  const help = readCommandHelp(opencode, ['run', '--help'], context.env);
  if (!help || !help.includes('opencode run') || !help.includes('--file') || !help.includes('--dir')) {
    return workerToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [opencode, 'run', '--help'],
      stdout: '',
      stderr: 'opencode run does not advertise --file and --dir support',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'opc provider is not supported by this OpenCode CLI',
    });
  }

  const args = ['run', '--dir', input.cwd, '--file', input.instructionPath];
  if (config.model) args.push('--model', config.model);
  if (help.includes('--format')) args.push('--format', 'json');
  if (help.includes('--pure')) args.push('--pure');
  args.push(workerInstruction('Follow the attached instruction file.', input.workspaceOnly));

  const command = [opencode, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runWorkerProcess({
    command: opencode,
    args,
    cwd: input.cwd,
    env: context.env,
    timeoutMs: input.timeoutMs,
  });
  const status: WorkerStatus = run.timedOut ? 'timed_out' : run.exitCode === 0 ? 'completed' : 'failed';
  return workerToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactWorkerOutput({
      provider: 'opc',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr: run.stderr,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: run.exitCode === 0 && !run.timedOut,
    code: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut ? 'opc provider timed out' : run.exitCode === 0 ? 'opc provider completed' : 'opc provider failed',
  });
}

async function executePiWorker(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: NormalizedWorkerProvider;
    requestedProvider?: WorkerProvider;
    profile?: string;
    mode: WorkerMode;
    policy: WorkerPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: WorkerWorkspaceOnly;
    audit: WorkerCallData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<WorkerCallData>> {
  const config = workerConfig('pi', input.profile, context.env);
  const pi = findExecutable(config.bin, context.env);
  if (!pi) {
    return workerToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, '-p'],
      stdout: '',
      stderr: 'pi CLI was not found on PATH',
      exitCode: 127,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'pi provider is not configured',
    });
  }

  const args = ['-p', '--mode', 'json', '--no-session'];
  if (config.provider) args.push('--provider', config.provider);
  if (config.model) args.push('--model', config.model);
  if (config.mcpConfig) args.push('--mcp-config', config.mcpConfig);
  for (const extensionPath of config.extensionPaths || []) args.push('--extension', extensionPath);
  if (config.tools?.length) args.push('--tools', config.tools.join(','));
  if (input.workspaceOnly === 'strict' && !config.tools?.length && !config.mcpConfig) args.push('--no-builtin-tools');
  args.push(workerInstruction(input.instruction, input.workspaceOnly));

  const command = [pi, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runWorkerProcess({
    command: pi,
    args,
    cwd: input.cwd,
    env: context.env,
    timeoutMs: input.timeoutMs,
  });
  const status: WorkerStatus = run.timedOut ? 'timed_out' : run.exitCode === 0 ? 'completed' : 'failed';
  return workerToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactWorkerOutput({
      provider: 'pi',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr: run.stderr,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: run.exitCode === 0 && !run.timedOut,
    code: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut ? 'pi provider timed out' : run.exitCode === 0 ? 'pi provider completed' : 'pi provider failed',
  });
}

function workerToolResult(
  entry: ToolManifestEntry,
  context: {
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: Omit<WorkerCallData, 'durationMs'> & {
    durationMs?: number;
    ok: boolean;
    code: 'OK' | 'COMMAND_FAILED' | 'TIMEOUT' | 'TASK_SESSION_REQUIRED';
    message: string;
  },
): ToolResult<WorkerCallData> {
  const data: WorkerCallData = {
    provider: input.provider,
    ...(input.requestedProvider ? { requestedProvider: input.requestedProvider } : {}),
    ...(input.profile ? { profile: input.profile } : {}),
    mode: input.mode,
    policy: input.policy,
    status: input.status,
    cwd: input.cwd,
    instructionPath: input.instructionPath,
    command: input.command,
    stdout: input.stdout,
    stderr: input.stderr,
    exitCode: input.exitCode,
    ...(input.finalMessage ? { finalMessage: input.finalMessage } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.rawLogPath ? { rawLogPath: input.rawLogPath } : {}),
    ...(input.stdoutLogPath ? { stdoutLogPath: input.stdoutLogPath } : {}),
    ...(input.stderrLogPath ? { stderrLogPath: input.stderrLogPath } : {}),
    ...(typeof input.stdoutChars === 'number' ? { stdoutChars: input.stdoutChars } : {}),
    ...(typeof input.stderrChars === 'number' ? { stderrChars: input.stderrChars } : {}),
    ...(input.usage ? { usage: input.usage } : {}),
    durationMs: input.durationMs ?? elapsedMs(context.startedAt, context.options.now),
    audit: input.audit,
  };
  const result = createToolResult({
    ok: input.ok,
    code: input.code,
    message: input.message,
    data,
    stderr: input.stderr,
    exitCode: input.exitCode,
    durationMs: data.durationMs,
    traceId: context.traceId,
    requestId: context.requestId,
    now: context.options.now,
  });
  logResult(entry, entry.name, result, input.command.join(' '), input.audit.branch, `workspace ${entry.name}`, context.options.logMode);
  return result;
}

function normalizeWorkspaceOnly(value: unknown, fallback: WorkerWorkspaceOnly): WorkerWorkspaceOnly {
  if (value === true || value === 'preferred') return 'preferred';
  if (value === 'strict') return 'strict';
  if (value === false) return false;
  return fallback;
}

function workerTimeoutMs(entry: ToolManifestEntry, input: ToolInput): number {
  const requested = typeof input.timeoutMs === 'number' ? input.timeoutMs : entry.defaultTimeout;
  return Math.min(Math.max(1, requested), WORKER_MAX_TIMEOUT_MS);
}

function resolveWorkerCwd(input: ToolInput, rootCwd: string): { ok: true; cwd: string } | { ok: false; message: string } {
  const repoRoot = resolveGitRoot(rootCwd);
  const taskWorktree = typeof input.taskWorktree === 'string' ? path.resolve(input.taskWorktree) : undefined;
  const defaultCwd = taskWorktree || repoRoot;
  const requested = typeof input.cwd === 'string' ? input.cwd : defaultCwd;
  const resolved = path.resolve(defaultCwd, requested);
  const roots = [repoRoot, taskWorktree].filter((item): item is string => Boolean(item)).map((item) => path.resolve(item));
  if (!roots.some((root) => isPathWithin(resolved, root))) {
    return { ok: false, message: 'worker.call cwd must stay inside the repo root or task worktree' };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { ok: false, message: 'worker.call cwd must be an existing directory' };
  }
  return { ok: true, cwd: resolved };
}

function resolveWorkerInstructionPath(
  input: ToolInput,
  cwd: string,
  rootCwd: string,
): { ok: true; instructionPath: string } | { ok: false; message: string } {
  const rawPath = typeof input.instructionPath === 'string' ? input.instructionPath : '';
  const resolved = path.resolve(cwd, rawPath);
  const repoRoot = resolveGitRoot(rootCwd);
  const taskWorktree = typeof input.taskWorktree === 'string' ? path.resolve(input.taskWorktree) : undefined;
  const roots = [repoRoot, taskWorktree].filter((item): item is string => Boolean(item)).map((item) => path.resolve(item));
  if (!roots.some((root) => isPathWithin(resolved, root))) {
    return { ok: false, message: 'worker.call instructionPath must stay inside the repo root or task worktree' };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { ok: false, message: 'worker.call instructionPath must point to an existing file' };
  }
  return { ok: true, instructionPath: resolved };
}

function isPathWithin(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findDangerousWorkerInstruction(instruction: string): string | null {
  const patterns = [
    { pattern: /\brm\s+-rf\s+\//i, reason: 'worker.call blocked dangerous instruction: rm -rf /' },
    { pattern: /\bgit\s+push\b[^\n;]*--force/i, reason: 'worker.call blocked dangerous instruction: git push --force' },
    { pattern: /\bsudo\b/i, reason: 'worker.call blocked dangerous instruction: sudo' },
    { pattern: /\bchmod\s+-R\s+777\b/i, reason: 'worker.call blocked dangerous instruction: chmod -R 777' },
    { pattern: /\bcurl\b[\s\S]{0,120}\|\s*(?:sh|bash)\b/i, reason: 'worker.call blocked dangerous instruction: curl pipe shell' },
  ];
  return patterns.find(({ pattern }) => pattern.test(instruction))?.reason || null;
}

function findExecutable(binary: string, env: NodeJS.ProcessEnv): string | null {
  const pathValue = env.PATH ?? process.env.PATH ?? '';
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep scanning PATH.
    }
  }
  return null;
}

function readCommandHelp(command: string, args: string[], env: NodeJS.ProcessEnv): string | null {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function workerInstruction(instruction: string, workspaceOnly: WorkerWorkspaceOnly): string {
  const guidance = workspaceOnly === 'strict'
    ? 'Use only workspace tooling/MCP/facade operations. Return NOT_SUPPORTED if that cannot be enforced.'
    : workspaceOnly === 'preferred'
      ? 'Use workspace tooling first. Raw shell is allowed only as a fallback and must be reported.'
      : 'Use the provider default execution model.';
  return `${guidance}\n\n${instruction}`;
}


function compactWorkerOutput(input: {
  provider: NormalizedWorkerProvider;
  cwd: string;
  traceId: string;
  stdout: string;
  stderr: string;
}): Pick<WorkerCallData, 'stdout' | 'stderr' | 'finalMessage' | 'summary' | 'rawLogPath' | 'stdoutLogPath' | 'stderrLogPath' | 'stdoutChars' | 'stderrChars' | 'usage'> {
  const parsed = parseWorkerOutput(input.provider, input.stdout);
  const logs = persistWorkerLogs(input);
  const finalMessage = parsed.finalMessage?.trim();
  const stderrSummary = compactText(input.stderr);
  return {
    stdout: finalMessage || compactText(input.stdout),
    stderr: stderrSummary,
    ...(finalMessage ? { finalMessage } : {}),
    ...(parsed.summary ? { summary: parsed.summary } : finalMessage ? { summary: finalMessage } : {}),
    ...(logs.rawLogPath ? { rawLogPath: logs.rawLogPath } : {}),
    stdoutLogPath: logs.stdoutLogPath,
    stderrLogPath: logs.stderrLogPath,
    stdoutChars: input.stdout.length,
    stderrChars: input.stderr.length,
    ...(parsed.usage ? { usage: parsed.usage } : {}),
  };
}

export function parseWorkerOutput(provider: NormalizedWorkerProvider, stdout: string): {
  finalMessage?: string;
  summary?: string;
  usage?: WorkerCallData['usage'];
} {
  if (provider === 'cdx') return parseCodexJsonEvents(stdout);

  if (provider === 'pi') return parsePiJsonEvents(stdout);

  const trimmed = stdout.trim();
  if (!trimmed) return {};
  try {
    const value = JSON.parse(trimmed) as Record<string, unknown>;
    const finalMessage = stringValue(value.finalMessage) || stringValue(value.message) || stringValue(value.text) || stringValue(value.output);
    return {
      ...(finalMessage ? { finalMessage, summary: finalMessage } : {}),
    };
  } catch {
    return { finalMessage: trimmed, summary: compactText(trimmed) };
  }
}

function parseCodexJsonEvents(stdout: string): {
  finalMessage?: string;
  summary?: string;
  usage?: WorkerCallData['usage'];
} {
  let finalMessage: string | undefined;
  let usage: WorkerCallData['usage'] | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      if (event.type === 'item.completed') {
        const item = event.item as Record<string, unknown> | undefined;
        if (item?.type === 'agent_message' && typeof item.text === 'string') finalMessage = item.text;
      }
      if (event.type === 'turn.completed') {
        const rawUsage = event.usage as Record<string, unknown> | undefined;
        if (rawUsage) usage = {
          ...(numberValue(rawUsage.input_tokens) !== undefined ? { inputTokens: numberValue(rawUsage.input_tokens) } : {}),
          ...(numberValue(rawUsage.cached_input_tokens) !== undefined ? { cachedInputTokens: numberValue(rawUsage.cached_input_tokens) } : {}),
          ...(numberValue(rawUsage.output_tokens) !== undefined ? { outputTokens: numberValue(rawUsage.output_tokens) } : {}),
          ...(numberValue(rawUsage.reasoning_output_tokens) !== undefined ? { reasoningOutputTokens: numberValue(rawUsage.reasoning_output_tokens) } : {}),
        };
      }
    } catch {
      // Ignore non-JSON provider chatter.
    }
  }
  if (!finalMessage) finalMessage = extractFirstJsonText(stdout);
  return {
    ...(finalMessage ? { finalMessage, summary: finalMessage } : {}),
    ...(usage ? { usage } : {}),
  };
}



function parsePiJsonEvents(stdout: string): {
  finalMessage?: string;
  summary?: string;
  usage?: WorkerCallData['usage'];
} {
  let finalMessage: string | undefined;
  let usage: WorkerCallData['usage'] | undefined;
  let parsedAny = false;
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      parsedAny = true;
      const message = event.message as Record<string, unknown> | undefined;
      if (event.type === 'message_end' && message?.role === 'assistant') {
        const text = extractMessageText(message.content);
        if (text) finalMessage = text;
        const rawUsage = message.usage as Record<string, unknown> | undefined;
        if (rawUsage) usage = {
          ...(numberValue(rawUsage.input) !== undefined ? { inputTokens: numberValue(rawUsage.input) } : {}),
          ...(numberValue(rawUsage.cacheRead) !== undefined ? { cachedInputTokens: numberValue(rawUsage.cacheRead) } : {}),
          ...(numberValue(rawUsage.output) !== undefined ? { outputTokens: numberValue(rawUsage.output) } : {}),
        };
      }
    } catch {
      // Ignore non-JSON provider chatter.
    }
  }
  if (!finalMessage) finalMessage = extractFirstJsonText(stdout);
  if (!usage) usage = extractPiUsageFallback(stdout);
  if (!parsedAny && !finalMessage && !usage) return {};
  return {
    ...(finalMessage ? { finalMessage, summary: finalMessage } : {}),
    ...(usage ? { usage } : {}),
  };
}

function extractFirstJsonText(stdout: string): string | undefined {
  const patterns = [
    /\"type\"\s*:\s*\"agent_message\"[\s\S]*?\"text\"\s*:\s*\"((?:\\.|[^\"\\])*)\"/,
    /\\\"type\\\"\s*:\s*\\\"agent_message\\\"[\s\S]*?\\\"text\\\"\s*:\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"/,
    /\"text\"\s*:\s*\"((?:\\.|[^\"\\])*)\"/,
    /\\\"text\\\"\s*:\s*\\\"((?:\\\\.|[^\\\"\\\\])*)\\\"/,
  ];
  for (const pattern of patterns) {
    const match = stdout.match(pattern);
    if (!match) continue;
    const raw = match[1].replace(/\\\"/g, '\"');
    try {
      return JSON.parse(`\"${raw}\"`) as string;
    } catch {
      return raw;
    }
  }
  return undefined;
}

function extractPiUsageFallback(stdout: string): WorkerCallData['usage'] | undefined {
  const input = stdout.match(/\"input\"\s*:\s*(\d+)/)?.[1];
  const output = stdout.match(/\"output\"\s*:\s*(\d+)/)?.[1];
  const cacheRead = stdout.match(/\"cacheRead\"\s*:\s*(\d+)/)?.[1];
  if (!input && !output && !cacheRead) return undefined;
  return {
    ...(input ? { inputTokens: Number(input) } : {}),
    ...(output ? { outputTokens: Number(output) } : {}),
    ...(cacheRead ? { cachedInputTokens: Number(cacheRead) } : {}),
  };
}

function extractMessageText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;
  const text = content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const value = item as Record<string, unknown>;
      return typeof value.text === 'string' ? value.text : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
  return text || undefined;
}


function persistWorkerLogs(input: {
  provider: NormalizedWorkerProvider;
  cwd: string;
  traceId: string;
  stdout: string;
  stderr: string;
}): { rawLogPath?: string; stdoutLogPath: string; stderrLogPath: string } {
  const runId = `${input.traceId}-${input.provider}`.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  const logDir = path.join(input.cwd, '.task', 'worker-runs', runId);
  fs.mkdirSync(logDir, { recursive: true });
  const stdoutLogPath = path.join(logDir, 'stdout.log');
  const stderrLogPath = path.join(logDir, 'stderr.log');
  const summaryPath = path.join(logDir, 'summary.json');
  fs.writeFileSync(stdoutLogPath, input.stdout);
  fs.writeFileSync(stderrLogPath, input.stderr);
  fs.writeFileSync(summaryPath, JSON.stringify({
    provider: input.provider,
    traceId: input.traceId,
    stdoutChars: input.stdout.length,
    stderrChars: input.stderr.length,
    stdoutLogPath,
    stderrLogPath,
  }, null, 2));
  return { rawLogPath: summaryPath, stdoutLogPath, stderrLogPath };
}

function compactText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= WORKER_COMPACT_OUTPUT_LIMIT) return trimmed;
  return `${trimmed.slice(0, WORKER_COMPACT_OUTPUT_LIMIT)}\n... [truncated ${trimmed.length - WORKER_COMPACT_OUTPUT_LIMIT} chars; see worker log path]`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boundWorkerOutput(value: string): string {
  if (value.length <= WORKER_OUTPUT_LIMIT) return value;
  return `${value.slice(0, WORKER_OUTPUT_LIMIT)}\n... [truncated ${value.length - WORKER_OUTPUT_LIMIT} chars]`;
}

async function runWorkerProcess(input: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  stdin?: string;
}): Promise<RunnerResult & { timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      env: input.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, input.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr: error.message, exitCode: 1, timedOut: false });
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: timedOut ? 1 : code ?? 0, timedOut });
    });
    child.stdin.end(input.stdin || '');
  });
}

function elapsedMs(startedAt: number, now?: () => number): number {
  return Math.max(0, (now || Date.now)() - startedAt);
}

function resolveGitRoot(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return cwd;
  }
}

function logResult(
  entry: ToolManifestEntry | null,
  toolName: string,
  result: ToolResult<unknown>,
  implementationCommand: string,
  branch?: string,
  facadeCommand?: string,
  logMode: ExecuteToolOptions['logMode'] = 'all',
): void {
  if (logMode === 'silent') return;
  if (logMode === 'errors' && result.ok) return;

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
