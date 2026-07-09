import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createToolResult } from '../facade/errors';
import { logToolExecution } from '../facade/logger';
import type { ExecuteToolOptions, RunnerResult, ToolInput, ToolManifestEntry, ToolResult } from '../facade/types';

const requireFromModule = createRequire(import.meta.url);

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
  workerTrace?: WorkerTraceSummary;
  durationMs: number;
  audit: {
    taskSession?: string;
    branch?: string;
    workspaceOnly: WorkerWorkspaceOnly;
    rawShellUsed: boolean;
  };
};

export type WorkerTraceSummary = {
  eventCount: number;
  workspaceMcpCallCount: number;
  workspaceCallCount: number;
  getSteeringCount: number;
  nativeCommandExecutionCount: number;
  agentMessageCount: number;
};

type WorkerTraceEvent = {
  eventType: string;
  itemId?: string;
  tool: string;
  facadeTool?: string;
  status: string;
  ok: boolean;
  code: string;
  command?: string;
  input?: unknown;
  result?: unknown;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
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

type TraceStatement = {
  run(...args: unknown[]): unknown;
};

type TraceDatabase = {
  exec(sql: string): void;
  query(sql: string): { all(...args: unknown[]): Array<{ name: string }> };
  prepare(sql: string): TraceStatement;
  close(): void;
};

type TraceDatabaseConstructor = new (path: string, options?: { create?: boolean }) => TraceDatabase;

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
      audit: input.audit,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: input.audit,
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
      audit: input.audit,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: input.audit,
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
      audit: input.audit,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: input.audit,
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
    ...(input.workerTrace ? { workerTrace: input.workerTrace } : {}),
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
  audit?: WorkerCallData['audit'];
}): Pick<WorkerCallData, 'stdout' | 'stderr' | 'finalMessage' | 'summary' | 'rawLogPath' | 'stdoutLogPath' | 'stderrLogPath' | 'stdoutChars' | 'stderrChars' | 'usage' | 'workerTrace'> {
  const parsed = parseWorkerOutput(input.provider, input.stdout);
  const logs = persistWorkerLogs(input);
  const workerTrace = persistWorkerTraceEvents({
    provider: input.provider,
    cwd: input.cwd,
    traceId: input.traceId,
    stdout: input.stdout,
    taskSession: input.audit?.taskSession,
    branch: input.audit?.branch,
    stdoutLogPath: logs.stdoutLogPath,
  });
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
    ...(workerTrace && workerTrace.eventCount > 0 ? { workerTrace } : {}),
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


function persistWorkerTraceEvents(input: {
  provider: NormalizedWorkerProvider;
  cwd: string;
  traceId: string;
  stdout: string;
  taskSession?: string;
  branch?: string;
  stdoutLogPath?: string;
}): WorkerTraceSummary | undefined {
  const events = parseWorkerTraceEvents(input.provider, input.stdout);
  const summary = summarizeWorkerTraceEvents(events);
  if (events.length === 0) return summary;
  try {
    const dbPath = traceDbPath(input.cwd);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const { Database } = requireFromModule('bun:sqlite') as { Database: TraceDatabaseConstructor };
    const db = new Database(dbPath, { create: true });
    try {
      ensureTraceSchema(db);
      const now = new Date().toISOString();
      const insert = db.prepare(`
        INSERT OR REPLACE INTO tool_traces(
          id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, worktree,
          status, ok, code, exit_code, duration_ms,
          input_json, resolved_input_json, result_json, stderr,
          input_tokens, output_tokens, total_tokens
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [index, event] of events.entries()) {
        const childTraceId = `${input.traceId}:worker:${String(index + 1).padStart(4, '0')}`;
        const inputJson = {
          provider: input.provider,
          eventType: event.eventType,
          itemId: event.itemId,
          tool: event.tool,
          facadeTool: event.facadeTool,
          command: event.command,
          input: event.input,
          stdoutLogPath: input.stdoutLogPath,
        };
        const resultJson = {
          provider: input.provider,
          parentTraceId: input.traceId,
          eventType: event.eventType,
          status: event.status,
          ok: event.ok,
          code: event.code,
          tool: event.tool,
          facadeTool: event.facadeTool,
          command: event.command,
          result: compactJson(event.result, 4000),
          rawResultChars: jsonSize(event.result),
          stdoutLogPath: input.stdoutLogPath,
        };
        insert.run(
          `${input.traceId}:worker:${stableHash(`${index}:${event.itemId || event.tool}:${event.eventType}`)}`,
          now,
          childTraceId,
          input.traceId,
          'worker',
          event.tool,
          input.taskSession || null,
          input.branch || null,
          input.cwd,
          event.status,
          event.ok ? 1 : 0,
          event.code,
          event.ok ? 0 : 1,
          event.eventType === 'turn.completed' ? 0 : null,
          JSON.stringify(inputJson),
          null,
          JSON.stringify(resultJson),
          event.ok ? null : stringValue(event.result) || event.code,
          event.inputTokens ?? null,
          event.outputTokens ?? null,
          event.totalTokens ?? null,
        );
      }
    } finally {
      db.close();
    }
  } catch {
    // Worker trace ingestion must not fail the worker result.
  }
  return summary;
}

export function parseWorkerTraceEvents(provider: NormalizedWorkerProvider, stdout: string): WorkerTraceEvent[] {
  if (provider !== 'cdx') return [];
  return parseCodexTraceEvents(stdout);
}

function parseCodexTraceEvents(stdout: string): WorkerTraceEvent[] {
  const events: WorkerTraceEvent[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: Record<string, unknown>;
    try { event = JSON.parse(trimmed) as Record<string, unknown>; }
    catch { continue; }
    if (event.type === 'item.completed') {
      const item = event.item as Record<string, unknown> | undefined;
      if (!item) continue;
      if (item.type === 'mcp_tool_call') {
        const server = stringValue(item.server) || 'unknown';
        const mcpTool = stringValue(item.tool) || 'unknown';
        const args = isRecord(item.arguments) ? item.arguments : undefined;
        const facadeTool = server === 'workspace' && mcpTool === 'call' && args ? stringValue(args.tool) : undefined;
        const isGetSteering = server === 'workspace' && mcpTool === 'get_steering';
        const tool = isGetSteering ? 'cdx.get_steering' : facadeTool ? `cdx.${facadeTool}` : `cdx.${server}.${mcpTool}`;
        const error = item.error;
        const result = item.result;
        const inputTokens = estimateTokens(args || item.arguments || {});
        const outputTokens = estimateTokens(result || error || {});
        events.push({
          eventType: 'mcp_tool_call',
          itemId: stringValue(item.id),
          tool,
          facadeTool,
          status: error ? 'error' : 'ok',
          ok: !error,
          code: error ? 'COMMAND_FAILED' : 'OK',
          input: { server, tool: mcpTool, arguments: args || item.arguments },
          result: error || result,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        });
      } else if (item.type === 'command_execution') {
        const command = stringValue(item.command) || '';
        const exitCode = typeof item.exit_code === 'number' ? item.exit_code : 0;
        const output = stringValue(item.aggregated_output) || '';
        const inputTokens = estimateTokens(command);
        const outputTokens = estimateTokens(output);
        events.push({
          eventType: 'command_execution',
          itemId: stringValue(item.id),
          tool: 'cdx.command_execution',
          status: exitCode === 0 ? 'ok' : 'error',
          ok: exitCode === 0,
          code: exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
          command,
          input: { command },
          result: { exitCode, output: compactText(output) },
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        });
      } else if (item.type === 'agent_message') {
        const text = stringValue(item.text) || '';
        const outputTokens = estimateTokens(text);
        events.push({
          eventType: 'agent_message',
          itemId: stringValue(item.id),
          tool: 'cdx.agent_message',
          status: 'ok',
          ok: true,
          code: 'OK',
          result: text,
          inputTokens: 0,
          outputTokens,
          totalTokens: outputTokens,
        });
      }
    }
    if (event.type === 'turn.completed') {
      const rawUsage = isRecord(event.usage) ? event.usage : undefined;
      const inputTokens = numberValue(rawUsage?.input_tokens) || 0;
      const outputTokens = numberValue(rawUsage?.output_tokens) || 0;
      const reasoningTokens = numberValue(rawUsage?.reasoning_output_tokens) || 0;
      events.push({
        eventType: 'turn.completed',
        tool: 'cdx.turn.completed',
        status: 'ok',
        ok: true,
        code: 'OK',
        result: { usage: rawUsage },
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens + reasoningTokens,
      });
    }
  }
  return events;
}

function isWorkspaceMcpTraceEvent(event: WorkerTraceEvent): boolean {
  return event.eventType === 'mcp_tool_call'
    && (Boolean(event.facadeTool) || event.tool === 'cdx.get_steering' || event.tool.startsWith('cdx.workspace.'));
}

function summarizeWorkerTraceEvents(events: WorkerTraceEvent[]): WorkerTraceSummary {
  return {
    eventCount: events.length,
    workspaceMcpCallCount: events.filter(isWorkspaceMcpTraceEvent).length,
    workspaceCallCount: events.filter((event) => Boolean(event.facadeTool)).length,
    getSteeringCount: events.filter((event) => event.tool === 'cdx.get_steering').length,
    nativeCommandExecutionCount: events.filter((event) => event.eventType === 'command_execution').length,
    agentMessageCount: events.filter((event) => event.eventType === 'agent_message').length,
  };
}

function traceDbPath(cwd: string): string {
  return process.env.OPENWORKSPACE_TRACE_DB || defaultTraceDbPath(cwd);
}

function defaultTraceDbPath(cwd: string): string {
  const root = process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'OpenWorkspace', 'traces')
    : path.join(os.homedir(), '.local', 'share', 'openworkspace', 'traces');
  return path.join(root, stableHash(repoIdentifier(cwd)).slice(0, 24), 'traces.db');
}

function repoIdentifier(cwd: string): string {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    if (remote) return remote;
  } catch {}
  return cwd;
}

function ensureTraceSchema(db: TraceDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tool_traces (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      mcp_trace_id TEXT,
      source TEXT NOT NULL,
      tool TEXT NOT NULL,
      task_session TEXT,
      branch TEXT,
      worktree TEXT,
      status TEXT NOT NULL,
      ok INTEGER NOT NULL,
      code TEXT,
      exit_code INTEGER,
      duration_ms INTEGER,
      input_json TEXT,
      resolved_input_json TEXT,
      result_json TEXT,
      stderr TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER
    );
    CREATE INDEX IF NOT EXISTS tool_traces_ts_idx ON tool_traces(ts);
    CREATE INDEX IF NOT EXISTS tool_traces_trace_id_idx ON tool_traces(trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_mcp_trace_id_idx ON tool_traces(mcp_trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_tool_idx ON tool_traces(tool);
    CREATE INDEX IF NOT EXISTS tool_traces_status_idx ON tool_traces(status);
    CREATE INDEX IF NOT EXISTS tool_traces_task_session_idx ON tool_traces(task_session);
    CREATE INDEX IF NOT EXISTS tool_traces_branch_idx ON tool_traces(branch);
  `);
  const columns = db.query('PRAGMA table_info(tool_traces)').all().map((row) => row.name);
  for (const column of ['input_tokens', 'output_tokens', 'total_tokens']) {
    if (!columns.includes(column)) db.exec(`ALTER TABLE tool_traces ADD COLUMN ${column} INTEGER`);
  }
}

function estimateTokens(value: unknown): number {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function jsonSize(value: unknown): number {
  try { return JSON.stringify(value ?? '').length; }
  catch { return String(value ?? '').length; }
}

function compactJson(value: unknown, limit: number): unknown {
  try {
    const text = JSON.stringify(value ?? null);
    if (text.length <= limit) return value;
    return { preview: text.slice(0, limit), chars: text.length, truncated: true, omitted: text.length - limit };
  } catch {
    const text = String(value ?? '');
    return text.length <= limit ? text : { preview: text.slice(0, limit), chars: text.length, truncated: true, omitted: text.length - limit };
  }
}

function stableHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
