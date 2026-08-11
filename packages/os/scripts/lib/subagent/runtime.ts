import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createToolResult } from '../facade/errors';
import { logToolExecution } from '../facade/logger';
import type { ExecuteToolOptions, RunnerResult, ToolInput, ToolManifestEntry, ToolResult } from '../facade/types';
import {
  cancelDurableSubagentRun,
  deriveSubagentRunId,
  readDurableSubagentLogs,
  readDurableSubagentRun,
  reconcileDurableSubagentRun,
  resolveSubagentRunDirectory,
  startDurableSubagentRun,
  waitForDurableSubagentRun,
  type DurableSubagentRun,
} from './lifecycle';
import {
  recordSubagentTraceEventsSafely,
  type SubagentTraceEvent,
} from '../trace-persistence';

export type SubagentProvider = 'codex' | 'pi' | 'opencode' | 'grok';
export type SubagentBundle = 'core' | 'media';
export type SubagentMode = 'work';
export type SubagentPolicy = 'read' | 'edit';
export type SubagentOutputFormat = 'text' | 'json';
export type SubagentAction = 'run' | 'start' | 'status' | 'wait' | 'logs' | 'cancel';
export type SubagentStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled' | 'completion_unknown' | 'not_configured' | 'not_supported' | 'timed_out';
export type SubagentWorkspaceOnly = 'preferred' | 'strict' | false;
export type SubagentCapabilities = {
  modelSelection: boolean;
  reasoningEffort: boolean;
  strictWorkspaceOnly: boolean;
  edit: boolean;
  detachedExecution: boolean;
};

export type SubagentData = {
  provider: SubagentProvider;
  model?: string;
  bundle: SubagentBundle;
  outputFormat: SubagentOutputFormat;
  mode: SubagentMode;
  policy: SubagentPolicy;
  action?: SubagentAction;
  status: SubagentStatus;
  runId?: string;
  requestId?: string;
  reasoningEffort?: string;
  capabilities: SubagentCapabilities;
  unsupportedCapabilities?: string[];
  cwd: string;
  instructionPath: string;
  command: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  finalMessage?: string;
  summary?: SubagentRunSummary;
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
    workspaceOnly: SubagentWorkspaceOnly;
    rawShellUsed: boolean;
  };
};

type SubagentContext = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  startedAt: number;
  traceId: string;
  requestId?: string;
  options: ExecuteToolOptions;
};

type SubagentProviderConfig = {
  bin: string;
  defaultMode: SubagentMode;
  defaultPolicy: SubagentPolicy;
  workspaceOnly: SubagentWorkspaceOnly;
  model?: string;
  reasoningEffort?: string;
  provider?: string;
  extensionPaths?: string[];
  mcpConfig?: string;
  tools?: string[];
};

export const SUBAGENT_OUTPUT_LIMIT = 8000;
const SUBAGENT_COMPACT_OUTPUT_LIMIT = 1200;
const SUBAGENT_MAX_TIMEOUT_MS = 1_800_000;
const SUBAGENT_REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;

const subagentDefaults: Record<SubagentProvider, {
  mode: SubagentMode;
  policy: SubagentPolicy;
  workspaceOnly: SubagentWorkspaceOnly;
}> = {
  codex: { mode: 'work', policy: 'read', workspaceOnly: 'preferred' },
  pi: { mode: 'work', policy: 'read', workspaceOnly: 'strict' },
  opencode: { mode: 'work', policy: 'read', workspaceOnly: 'preferred' },
  grok: { mode: 'work', policy: 'read', workspaceOnly: 'preferred' },
};

const subagentCapabilities: Record<SubagentProvider, SubagentCapabilities> = {
  codex: { modelSelection: true, reasoningEffort: true, strictWorkspaceOnly: false, edit: true, detachedExecution: true },
  pi: { modelSelection: true, reasoningEffort: false, strictWorkspaceOnly: true, edit: true, detachedExecution: false },
  opencode: { modelSelection: true, reasoningEffort: false, strictWorkspaceOnly: false, edit: false, detachedExecution: false },
  grok: { modelSelection: true, reasoningEffort: false, strictWorkspaceOnly: false, edit: false, detachedExecution: false },
};

function capabilitiesForProvider(provider: SubagentProvider): SubagentCapabilities {
  return subagentCapabilities[provider];
}

function normalizeSubagentProvider(input: ToolInput): { provider: SubagentProvider } {
  return { provider: input.provider as SubagentProvider };
}

function subagentConfig(provider: SubagentProvider, input: ToolInput = {}, env: NodeJS.ProcessEnv = process.env): SubagentProviderConfig {
  const requestedModel = typeof input.model === 'string' ? input.model : undefined;
  const defaults = subagentDefaults[provider];
  if (provider === 'codex') return {
    bin: env.WORKSPACE_SUBAGENT_CODEX_BIN || 'codex',
    defaultMode: defaults.mode,
    defaultPolicy: defaults.policy,
    workspaceOnly: defaults.workspaceOnly,
    model: requestedModel || env.WORKSPACE_SUBAGENT_CODEX_MODEL,
    reasoningEffort: typeof input.reasoningEffort === 'string' ? input.reasoningEffort : undefined,
  };
  if (provider === 'opencode') return {
    bin: env.WORKSPACE_SUBAGENT_OPENCODE_BIN || 'opencode',
    defaultMode: defaults.mode,
    defaultPolicy: defaults.policy,
    workspaceOnly: defaults.workspaceOnly,
    model: requestedModel || env.WORKSPACE_SUBAGENT_OPENCODE_MODEL,
  };
  if (provider === 'grok') return {
    bin: env.WORKSPACE_SUBAGENT_GROK_BIN || 'grok',
    defaultMode: defaults.mode,
    defaultPolicy: defaults.policy,
    workspaceOnly: defaults.workspaceOnly,
    model: requestedModel || env.WORKSPACE_SUBAGENT_GROK_MODEL,
  };
  return {
    bin: env.WORKSPACE_SUBAGENT_PI_BIN || 'pi',
    defaultMode: defaults.mode,
    defaultPolicy: defaults.policy,
    workspaceOnly: defaults.workspaceOnly,
    model: requestedModel || env.WORKSPACE_SUBAGENT_PI_MODEL,
    provider: env.WORKSPACE_SUBAGENT_PI_PROVIDER,
    extensionPaths: (env.WORKSPACE_SUBAGENT_PI_EXTENSIONS || '').split(',').map((item) => item.trim()).filter(Boolean),
    mcpConfig: env.WORKSPACE_SUBAGENT_PI_MCP_CONFIG,
    tools: (env.WORKSPACE_SUBAGENT_PI_TOOLS || '').split(',').map((item) => item.trim()).filter(Boolean),
  };
}

export async function executeSubagent(
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
): Promise<ToolResult<SubagentData>> {
  const action = normalizeSubagentAction(input.action);
  if (isAttachmentAction(action)) {
    return executeSubagentAttachmentAction(entry, input, context, action);
  }
  const providerInfo = normalizeSubagentProvider(input);
  const provider = providerInfo.provider;
  const providerConfig = subagentConfig(provider, input, context.env);
  const defaults = { mode: providerConfig.defaultMode, policy: providerConfig.defaultPolicy, workspaceOnly: providerConfig.workspaceOnly };
  const mode: SubagentMode = 'work';
  const policy = (input.policy as SubagentPolicy | undefined) || defaults.policy;
  const bundle = normalizeSubagentBundle(input.bundle);
  const outputFormat = normalizeSubagentOutputFormat(input.outputFormat);
  const requestId = typeof input.requestId === 'string' ? input.requestId : undefined;
  const reasoningEffort = typeof input.reasoningEffort === 'string' ? input.reasoningEffort : undefined;
  const capabilities = capabilitiesForProvider(provider);
  const workspaceOnly = normalizeWorkspaceOnly(input.workspaceOnly, defaults.workspaceOnly);
  const taskSession = typeof input.taskSession === 'string' ? input.taskSession : undefined;
  const branch = typeof input.branch === 'string' ? input.branch : undefined;
  const baseAudit = {
    ...(taskSession ? { taskSession } : {}),
    ...(branch ? { branch } : {}),
    workspaceOnly,
    rawShellUsed: false,
  };

  const cwdResolution = resolveSubagentCwd(input, context.cwd);
  const instructionResolution = cwdResolution.ok
    ? resolveSubagentInstructionPath(input, cwdResolution.cwd, context.cwd)
    : null;
  const resultBase = {
    provider,
    ...(providerConfig.model ? { model: providerConfig.model } : {}),
    bundle,
    outputFormat,
    mode,
    policy,
    action,
    ...(requestId ? { requestId } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    capabilities,
    cwd: cwdResolution.ok ? cwdResolution.cwd : context.cwd,
    instructionPath: instructionResolution?.ok ? instructionResolution.instructionPath : String(input.instructionPath || ''),
  };

  if (reasoningEffort && !capabilities.reasoningEffort) {
    return subagentToolResult(entry, context, {
      ...resultBase,
      status: 'not_supported',
      command: [],
      stdout: '',
      stderr: `provider ${provider} does not support reasoning effort selection`,
      exitCode: 1,
      audit: baseAudit,
      ok: true,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: `provider ${provider} does not support reasoning effort selection`,
      unsupportedCapabilities: ['reasoningEffort'],
    });
  }

  if (policy === 'edit' && !capabilities.edit) {
    return subagentToolResult(entry, context, {
      ...resultBase,
      status: 'not_supported',
      command: [],
      stdout: '',
      stderr: `provider ${provider} does not support edit execution`,
      exitCode: 1,
      audit: baseAudit,
      ok: true,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: `provider ${provider} does not support edit execution`,
      unsupportedCapabilities: ['edit'],
    });
  }

  if (action === 'start' && !capabilities.detachedExecution) {
    return subagentToolResult(entry, context, {
      ...resultBase,
      status: 'not_supported',
      command: [],
      stdout: '',
      stderr: `provider ${provider} does not support detached subagent execution`,
      exitCode: 1,
      audit: baseAudit,
      ok: true,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: `provider ${provider} does not support durable subagent action start`,
      unsupportedCapabilities: ['detachedExecution'],
    });
  }

  if (!cwdResolution.ok) {
    return subagentToolResult(entry, context, {
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
    return subagentToolResult(entry, context, {
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
  const dangerous = findDangerousSubagentInstruction(instruction);
  if (dangerous) {
    return subagentToolResult(entry, context, {
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
    return subagentToolResult(entry, context, {
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
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: 'subagent strict workspaceOnly is not supported by provider',
      unsupportedCapabilities: ['strictWorkspaceOnly'],
    });
  }

  if (provider === 'pi') {
    return executePiSubagent(entry, context, {
      provider,
      ...(providerConfig.model ? { model: providerConfig.model } : {}),
      bundle,
      outputFormat,
      mode,
      policy,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      instruction,
      workspaceOnly,
      audit: baseAudit,
      timeoutMs: subagentTimeoutMs(entry, input),
    });
  }

  if (provider === 'opencode') {
    return executeOpencodeSubagent(entry, context, {
      provider,
      ...(providerConfig.model ? { model: providerConfig.model } : {}),
      bundle,
      outputFormat,
      mode,
      policy,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      instruction,
      workspaceOnly,
      audit: baseAudit,
      timeoutMs: subagentTimeoutMs(entry, input),
    });
  }

  if (provider === 'grok') {
    return executeGrokSubagent(entry, context, {
      provider,
      ...(providerConfig.model ? { model: providerConfig.model } : {}),
      bundle,
      outputFormat,
      mode,
      policy,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      instruction,
      workspaceOnly,
      audit: baseAudit,
      timeoutMs: subagentTimeoutMs(entry, input),
    });
  }

  if (provider === 'codex') {
    return executeCodexLifecycleSubagent(entry, context, {
      ...resultBase,
      provider,
      model: providerConfig.model,
      reasoningEffort,
      bundle,
      outputFormat,
      mode,
      policy,
      cwd: cwdResolution.cwd,
      instructionPath: instructionResolution.instructionPath,
      instruction,
      workspaceOnly,
      audit: baseAudit,
      timeoutMs: subagentTimeoutMs(entry, input),
      requestId,
      action,
      capabilities,
    });
  }

  return executeCodexSubagent(entry, context, {
    provider,
    ...(providerConfig.model ? { model: providerConfig.model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    bundle,
    outputFormat,
    mode,
    policy,
    cwd: cwdResolution.cwd,
    instructionPath: instructionResolution.instructionPath,
    instruction,
    workspaceOnly,
    audit: baseAudit,
    timeoutMs: subagentTimeoutMs(entry, input),
  });
}

function normalizeSubagentAction(value: unknown): SubagentAction {
  return value === 'start' || value === 'status' || value === 'wait' || value === 'logs' || value === 'cancel'
    ? value
    : 'run';
}

function isAttachmentAction(action: SubagentAction): action is 'status' | 'wait' | 'logs' | 'cancel' {
  return action === 'status' || action === 'wait' || action === 'logs' || action === 'cancel';
}

function persistedSubagentProvider(value: string): SubagentProvider | null {
  return value === 'codex' || value === 'pi' || value === 'opencode' || value === 'grok' ? value : null;
}

async function executeSubagentAttachmentAction(
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
  action: 'status' | 'wait' | 'logs' | 'cancel',
): Promise<ToolResult<SubagentData>> {
  const invalidBase = {
    provider: 'codex' as const,
    bundle: 'core' as const,
    outputFormat: 'json' as const,
    mode: 'work' as const,
    policy: 'read' as const,
    action,
    capabilities: capabilitiesForProvider('codex'),
    cwd: context.cwd,
    instructionPath: '',
    audit: { workspaceOnly: false as const, rawShellUsed: false },
  };
  const runId = typeof input.runId === 'string' ? input.runId : undefined;
  if (!runId) {
    return subagentToolResult(entry, context, {
      ...invalidBase,
      status: 'failed',
      command: [],
      stdout: '',
      stderr: 'runId is required for status, wait, logs, and cancel',
      exitCode: 1,
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'runId is required for attachment actions',
    });
  }

  const read = readDurableSubagentRun(runId, context.env);
  if (!read.ok) {
    return subagentToolResult(entry, context, {
      ...invalidBase,
      status: 'failed',
      runId,
      command: [],
      stdout: '',
      stderr: read.message,
      exitCode: 1,
      ok: false,
      code: read.code === 'RUN_NOT_FOUND'
        ? 'NOT_FOUND'
        : read.code === 'VALIDATION_ERROR'
          ? 'VALIDATION_ERROR'
          : 'COMMAND_FAILED',
      message: read.message,
    });
  }

  const provider = persistedSubagentProvider(read.run.provider);
  if (!provider) {
    return subagentToolResult(entry, context, {
      ...invalidBase,
      status: 'failed',
      runId,
      command: read.run.command,
      stdout: '',
      stderr: `persisted provider is unsupported: ${read.run.provider}`,
      exitCode: 1,
      ok: false,
      code: 'COMMAND_FAILED',
      message: 'persisted subagent provider is unsupported',
    });
  }

  const parser = durableSubagentParser(provider, read.run.traceId || context.traceId);
  let run = reconcileDurableSubagentRun(read.run, context.env, parser);
  if (action === 'wait') {
    const waitMs = typeof input.waitMs === 'number' ? Math.min(Math.max(0, input.waitMs), SUBAGENT_MAX_TIMEOUT_MS) : SUBAGENT_MAX_TIMEOUT_MS;
    const waited = await waitForDurableSubagentRun(run, context.env, waitMs, parser);
    run = waited.run;
    return durableSubagentResult(
      entry,
      context,
      run,
      action,
      waited.timedOut ? 'WAIT_TIMEOUT' : durableTerminalOutcomeCode(run),
    );
  }
  if (action === 'cancel') {
    run = cancelDurableSubagentRun(run, context.env, parser);
    return durableSubagentResult(entry, context, run, action, run.status === 'cancelled' ? 'OK' : durableTerminalOutcomeCode(run));
  }
  return durableSubagentResult(entry, context, run, action, 'OK');
}

function durableTerminalOutcomeCode(
  run: DurableSubagentRun,
): 'OK' | 'TIMEOUT' | 'COMMAND_FAILED' {
  if (run.status === 'timed_out') return 'TIMEOUT';
  if (run.status === 'failed' || run.status === 'completion_unknown' || run.status === 'cancelled') return 'COMMAND_FAILED';
  return 'OK';
}

function durableSubagentParser(provider: SubagentProvider, traceId: string) {
  return (stdout: string, stderr: string) => {
    const parsed = parseSubagentOutput(provider, stdout);
    const events = parseSubagentTraceEvents(provider, stdout);
    return {
      completed: Boolean(parsed.finalMessage),
      ...(parsed.finalMessage ? { finalMessage: parsed.finalMessage } : {}),
      ...(parsed.usage ? { usage: parsed.usage } : {}),
      summary: buildSubagentRunSummary({ traceId, events, finalMessage: parsed.finalMessage, stdout: `${stdout}${stderr}` }),
    };
  };
}

function durableSubagentResult(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  run: DurableSubagentRun,
  action: SubagentAction,
  code: 'OK' | 'WAIT_TIMEOUT' | 'TIMEOUT' | 'COMMAND_FAILED' | 'IDEMPOTENCY_CONFLICT',
): ToolResult<SubagentData> {
  const provider = persistedSubagentProvider(run.provider) || 'codex';
  const logs = readDurableSubagentLogs(run);
  const status = action === 'wait' && run.status === 'starting' ? 'running' : run.status;
  const bundle: SubagentBundle = run.bundle === 'media' ? 'media' : 'core';
  const outputFormat: SubagentOutputFormat = run.outputFormat === 'text' ? 'text' : 'json';
  const workspaceOnly: SubagentWorkspaceOnly = run.workspaceOnly === 'strict' || run.workspaceOnly === 'preferred'
    ? run.workspaceOnly
    : false;
  const successfulCancel = action === 'cancel' && status === 'cancelled' && code === 'OK';
  const successfulAttachmentRead = (action === 'status' || action === 'logs') && code === 'OK';
  const rawShellUsed = run.rawShellUsed ?? (provider === 'codex');
  const responseStderr = run.error && !logs.stderr.includes(run.error)
    ? [logs.stderr, run.error].filter(Boolean).join('\n')
    : logs.stderr;
  if (status !== 'starting' && status !== 'running') {
    const auditLogs = readDurableSubagentLogs(run, { full: true });
    const events = parseSubagentTraceEvents(provider, auditLogs.stdout);
    recordSubagentTraceEventsSafely({
      provider,
      parentTraceId: run.traceId || context.traceId,
      cwd: run.cwd,
      taskSession: run.taskSession,
      branch: run.branch,
      stdoutLogPath: run.stdoutLogPath,
      events,
    }, { env: context.env });
  }
  return subagentToolResult(entry, context, {
    provider,
    ...(run.model ? { model: run.model } : {}),
    ...(run.reasoningEffort ? { reasoningEffort: run.reasoningEffort } : {}),
    bundle,
    outputFormat,
    mode: 'work',
    policy: run.policy === 'edit' ? 'edit' : 'read',
    action,
    ...(run.runId ? { runId: run.runId } : {}),
    ...(run.requestId ? { requestId: run.requestId } : {}),
    capabilities: capabilitiesForProvider(provider),
    status,
    cwd: run.cwd,
    instructionPath: run.instructionPath,
    command: run.command,
    stdout: logs.stdout,
    stderr: responseStderr,
    exitCode: successfulCancel ? 0 : run.exitCode ?? (status === 'completed' ? 0 : 1),
    ...(run.finalMessage ? { finalMessage: run.finalMessage } : {}),
    ...(run.summary !== undefined ? { summary: run.summary as SubagentData['summary'] } : {}),
    ...(run.usage ? { usage: run.usage } : {}),
    stdoutLogPath: run.stdoutLogPath,
    stderrLogPath: run.stderrLogPath,
    stdoutChars: run.stdoutChars ?? logs.stdout.length,
    stderrChars: run.stderrChars ?? logs.stderr.length,
    audit: {
      ...(run.taskSession ? { taskSession: run.taskSession } : {}),
      ...(run.branch ? { branch: run.branch } : {}),
      workspaceOnly,
      rawShellUsed,
    },
    ok: code === 'WAIT_TIMEOUT' || successfulAttachmentRead || (code === 'OK' && (
      status === 'completed' || status === 'running' || status === 'starting' || successfulCancel
    )),
    code,
    message: code === 'WAIT_TIMEOUT'
      ? 'subagent wait timed out; run identity is preserved'
      : code === 'IDEMPOTENCY_CONFLICT'
        ? 'requestId is already associated with a different subagent run specification'
        : run.error || `subagent run ${status}`,
  });
}

async function executeCodexLifecycleSubagent(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: 'codex';
    model?: string;
    reasoningEffort?: string;
    bundle: SubagentBundle;
    outputFormat: SubagentOutputFormat;
    mode: SubagentMode;
    policy: SubagentPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: SubagentWorkspaceOnly;
    audit: SubagentData['audit'];
    timeoutMs: number;
    requestId?: string;
    action: 'run' | 'start';
    capabilities: SubagentCapabilities;
  },
): Promise<ToolResult<SubagentData>> {
  const config = subagentConfig('codex', input, context.env);
  const codex = findExecutable(config.bin, context.env);
  if (!codex) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, 'exec'],
      stdout: '',
      stderr: 'codex CLI was not found on PATH',
      exitCode: 127,
      ok: true,
      code: 'OK',
      message: 'codex provider is not configured',
    });
  }
  const help = readCommandHelp(codex, ['exec', '--help'], context.env);
  if (!help || !help.includes('codex exec') || !/stdin|-\s+is used|read from stdin/i.test(help)) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [codex, 'exec', '--help'],
      stdout: '',
      stderr: 'codex exec does not advertise a supported non-interactive stdin mode',
      exitCode: 1,
      ok: true,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: 'codex provider is not supported by this Codex CLI',
      unsupportedCapabilities: ['detachedExecution'],
    });
  }
  const plan = buildCodexArgs(help, input);
  if (!plan.ok) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [codex, 'exec'],
      stdout: '',
      stderr: plan.message,
      exitCode: 1,
      ok: true,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: plan.message,
      unsupportedCapabilities: plan.unsupportedCapabilities,
    });
  }

  const runId = deriveSubagentRunId(input.requestId, context.traceId);
  const command = [codex, ...plan.args];
  const instructionDigest = createHash('sha256').update(input.instruction, 'utf8').digest('hex');
  const runDirectory = resolveSubagentRunDirectory(runId, context.env);
  const stagedInstructionPath = path.join(runDirectory, 'instruction.md');
  const handoffRoot = path.join(os.tmpdir(), 'opensaas-handoffs');
  const provenance = JSON.stringify({
    sourcePath: input.instructionPath,
    sourceKind: isPathWithin(path.resolve(input.instructionPath), handoffRoot) ? 'canonical-os-handoff' : 'repo-or-task',
    stagedPath: stagedInstructionPath,
    instructionSha256: instructionDigest,
    traceId: context.traceId,
    stagedAt: new Date().toISOString(),
  }, null, 2);
  const fingerprint = JSON.stringify({
    provider: 'codex',
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    bundle: input.bundle,
    outputFormat: input.outputFormat,
    policy: input.policy,
    workspaceOnly: input.workspaceOnly,
    taskSession: input.audit.taskSession,
    cwd: input.cwd,
    instructionPath: input.instructionPath,
    instructionSha256: instructionDigest,
    timeoutMs: input.timeoutMs,
    command,
  });
  const started = startDurableSubagentRun({
    requestId: input.requestId,
    fingerprint,
    provider: 'codex',
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    bundle: input.bundle,
    outputFormat: input.outputFormat,
    policy: input.policy,
    workspaceOnly: input.workspaceOnly,
    taskSession: input.audit.taskSession,
    branch: input.audit.branch,
    rawShellUsed: true,
    cwd: input.cwd,
    instructionPath: stagedInstructionPath,
    command,
    env: context.env,
    stdin: subagentInstruction({ ...input, instructionPath: stagedInstructionPath, taskSession: input.audit.taskSession }),
    artifacts: [
      { path: stagedInstructionPath, content: input.instruction, mode: 0o600 },
      { path: `${stagedInstructionPath}.provenance.json`, content: provenance, mode: 0o600 },
    ],
    timeoutMs: input.timeoutMs,
    traceId: context.traceId,
  });
  if (!started.ok) {
    if (started.run) return durableSubagentResult(entry, context, started.run, input.action, started.code);
    return subagentToolResult(entry, context, {
      ...input,
      status: 'failed',
      command,
      stdout: '',
      stderr: started.message,
      exitCode: 1,
      ok: false,
      code: started.code,
      message: started.message,
    });
  }

  let run = started.run;
  if (input.action === 'run') {
    const waited = await waitForDurableSubagentRun(run, context.env, input.timeoutMs, durableSubagentParser('codex', context.traceId));
    run = waited.run;
    return durableSubagentResult(entry, context, run, input.action, waited.timedOut ? 'TIMEOUT' : durableTerminalOutcomeCode(run));
  }
  return durableSubagentResult(entry, context, run, input.action, 'OK');
}

function buildCodexArgs(
  help: string,
  input: { model?: string; reasoningEffort?: string; cwd: string; policy: SubagentPolicy },
): { ok: true; args: string[] } | { ok: false; message: string; unsupportedCapabilities: string[] } {
  const args = ['exec'];
  if (input.model) {
    if (!help.includes('--model')) return { ok: false, message: 'Codex CLI does not support requested model selection', unsupportedCapabilities: ['modelSelection'] };
    args.push('--model', input.model);
  }
  if (input.reasoningEffort) {
    if (!SUBAGENT_REASONING_EFFORTS.includes(input.reasoningEffort as typeof SUBAGENT_REASONING_EFFORTS[number])) {
      return { ok: false, message: `unsupported reasoning effort: ${input.reasoningEffort}`, unsupportedCapabilities: ['reasoningEffort'] };
    }
    if (!help.includes('--config') && !help.includes('-c')) return { ok: false, message: 'Codex CLI does not support reasoning-effort config overrides', unsupportedCapabilities: ['reasoningEffort'] };
    args.push('-c', `model_reasoning_effort="${input.reasoningEffort}"`);
  }
  if (help.includes('--cd')) args.push('--cd', input.cwd);
  if (help.includes('--sandbox')) args.push('--sandbox', input.policy === 'read' ? 'read-only' : 'workspace-write');
  if (help.includes('--ask-for-approval')) args.push('--ask-for-approval', 'never');
  if (help.includes('--json')) args.push('--json');
  args.push('-');
  return { ok: true, args };
}

async function executeCodexSubagent(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: SubagentProvider;
    model?: string;
    reasoningEffort?: string;
    bundle: SubagentBundle;
    outputFormat: SubagentOutputFormat;
    mode: SubagentMode;
    policy: SubagentPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: SubagentWorkspaceOnly;
    audit: SubagentData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<SubagentData>> {
  const config = subagentConfig('codex', input, context.env);
  const codex = findExecutable(config.bin, context.env);
  if (!codex) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, 'exec'],
      stdout: '',
      stderr: 'codex CLI was not found on PATH',
      exitCode: 127,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'codex provider is not configured',
    });
  }

  const help = readCommandHelp(codex, ['exec', '--help'], context.env);
  if (!help || !help.includes('codex exec') || !/stdin|-\s+is used|read from stdin/i.test(help)) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [codex, 'exec', '--help'],
      stdout: '',
      stderr: 'codex exec does not advertise a supported non-interactive stdin mode',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'codex provider is not supported by this Codex CLI',
    });
  }

  const argsPlan = buildCodexArgs(help, input);
  if (!argsPlan.ok) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [codex, 'exec', '--help'],
      stdout: '',
      stderr: argsPlan.message,
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: argsPlan.message,
      unsupportedCapabilities: argsPlan.unsupportedCapabilities,
    });
  }
  const args = argsPlan.args;

  const command = [codex, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runSubagentProcess({
    command: codex,
    args,
    cwd: input.cwd,
    env: context.env,
    stdin: subagentInstruction({ ...input, taskSession: input.audit.taskSession }),
    timeoutMs: input.timeoutMs,
  });
  const status: SubagentStatus = run.timedOut ? 'timed_out' : run.exitCode === 0 ? 'completed' : 'failed';
  return subagentToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactSubagentOutput({
      provider: 'codex',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr: run.stderr,
      taskSession: input.audit.taskSession,
      branch: input.audit.branch,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: run.exitCode === 0 && !run.timedOut,
    code: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut ? 'codex provider timed out' : run.exitCode === 0 ? 'codex provider completed' : 'codex provider failed',
  });
}

async function executeOpencodeSubagent(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: SubagentProvider;
    model?: string;
    bundle: SubagentBundle;
    outputFormat: SubagentOutputFormat;
    mode: SubagentMode;
    policy: SubagentPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: SubagentWorkspaceOnly;
    audit: SubagentData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<SubagentData>> {
  const config = subagentConfig('opencode', input, context.env);
  const opencode = findExecutable(config.bin, context.env);
  if (!opencode) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, 'run'],
      stdout: '',
      stderr: 'opencode CLI was not found on PATH',
      exitCode: 127,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'opencode provider is not configured',
    });
  }

  if (input.policy === 'edit') {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [opencode, 'run'],
      stdout: '',
      stderr: 'opencode edit policy is disabled until permission behavior is validated',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'opencode provider edit policy is not supported yet',
    });
  }

  const help = readCommandHelp(opencode, ['run', '--help'], context.env);
  if (!help || !help.includes('opencode run') || !help.includes('--file') || !help.includes('--dir')) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [opencode, 'run', '--help'],
      stdout: '',
      stderr: 'opencode run does not advertise --file and --dir support',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'opencode provider is not supported by this OpenCode CLI',
    });
  }

  const args = ['run', '--dir', input.cwd, '--file', input.instructionPath];
  if (config.model) args.push('--model', config.model);
  if (help.includes('--format')) args.push('--format', 'json');
  if (help.includes('--pure')) args.push('--pure');
  args.push(subagentInstruction({ ...input, instruction: 'Follow the attached instruction file.' }));

  const command = [opencode, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runSubagentProcess({
    command: opencode,
    args,
    cwd: input.cwd,
    env: context.env,
    timeoutMs: input.timeoutMs,
  });
  const status: SubagentStatus = run.timedOut ? 'timed_out' : run.exitCode === 0 ? 'completed' : 'failed';
  return subagentToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactSubagentOutput({
      provider: 'opencode',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr: run.stderr,
      taskSession: input.audit.taskSession,
      branch: input.audit.branch,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: run.exitCode === 0 && !run.timedOut,
    code: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut ? 'opencode provider timed out' : run.exitCode === 0 ? 'opencode provider completed' : 'opencode provider failed',
  });
}

async function executePiSubagent(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: SubagentProvider;
    model?: string;
    bundle: SubagentBundle;
    outputFormat: SubagentOutputFormat;
    mode: SubagentMode;
    policy: SubagentPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: SubagentWorkspaceOnly;
    audit: SubagentData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<SubagentData>> {
  const config = subagentConfig('pi', input, context.env);
  const pi = findExecutable(config.bin, context.env);
  if (!pi) {
    return subagentToolResult(entry, context, {
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
  args.push(subagentInstruction(input));

  const command = [pi, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runSubagentProcess({
    command: pi,
    args,
    cwd: input.cwd,
    env: context.env,
    timeoutMs: input.timeoutMs,
  });
  const status: SubagentStatus = run.timedOut ? 'timed_out' : run.exitCode === 0 ? 'completed' : 'failed';
  return subagentToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactSubagentOutput({
      provider: 'pi',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr: run.stderr,
      taskSession: input.audit.taskSession,
      branch: input.audit.branch,
    }),
    exitCode: run.exitCode,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: run.exitCode === 0 && !run.timedOut,
    code: run.timedOut ? 'TIMEOUT' : run.exitCode === 0 ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut ? 'pi provider timed out' : run.exitCode === 0 ? 'pi provider completed' : 'pi provider failed',
  });
}


async function executeGrokSubagent(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: {
    provider: SubagentProvider;
    model?: string;
    bundle: SubagentBundle;
    outputFormat: SubagentOutputFormat;
    mode: SubagentMode;
    policy: SubagentPolicy;
    cwd: string;
    instructionPath: string;
    instruction: string;
    workspaceOnly: SubagentWorkspaceOnly;
    audit: SubagentData['audit'];
    timeoutMs: number;
  },
): Promise<ToolResult<SubagentData>> {
  const config = subagentConfig('grok', input, context.env);
  const fallbackBinaries = context.env.WORKSPACE_SUBAGENT_GROK_BIN ? [] : ['agent'];
  const grok = findExecutable(config.bin, context.env, fallbackBinaries);
  if (!grok) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_configured',
      command: [config.bin, '-p'],
      stdout: '',
      stderr: 'grok CLI was not found in configured or standard executable locations',
      exitCode: 127,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'grok provider is not configured',
    });
  }

  const help = readCommandHelp(grok, ['--help'], context.env);
  if (
    input.policy === 'read' &&
    (
      !help?.includes('--permission-mode') ||
      !help.includes('--max-turns') ||
      !help.includes('--deny')
    )
  ) {
    return subagentToolResult(entry, context, {
      ...input,
      status: 'not_supported',
      command: [grok, '--help'],
      stdout: '',
      stderr: 'grok read policy requires auto permission mode, mutation denies, and bounded turns',
      exitCode: 1,
      audit: input.audit,
      ok: true,
      code: 'OK',
      message: 'grok provider cannot enforce the requested read policy',
    });
  }

  const prompt = [
    subagentInstruction(input),
    ...(input.policy === 'read'
      ? ['Read-only review policy: do not edit files or run shell commands. Use workspace MCP tools for repository and GitHub context.']
      : []),
  ].join('\n\n');
  const args = ['--no-auto-update'];
  if (input.policy === 'read') {
    args.push(
      '--permission-mode',
      'auto',
      '--max-turns',
      '32',
      '--deny',
      'Edit',
      '--deny',
      'Write',
      '--deny',
      'Bash',
    );
    if (help?.includes('--no-memory')) args.push('--no-memory');
    if (help?.includes('--no-subagents')) args.push('--no-subagents');
  }
  if (config.model) args.push('--model', config.model);
  args.push('-p', prompt);
  args.push('--output-format', input.outputFormat === 'json' ? 'json' : 'text');

  const command = [grok, ...args];
  const started = (context.options.now || Date.now)();
  const run = await runSubagentProcess({
    command: grok,
    args,
    cwd: input.cwd,
    env: context.env,
    timeoutMs: input.timeoutMs,
  });
  const completionFailure = !run.timedOut && run.exitCode === 0
    ? grokCompletionFailure(run.stdout)
    : undefined;
  const completed = !run.timedOut && run.exitCode === 0 && !completionFailure;
  const status: SubagentStatus = run.timedOut ? 'timed_out' : completed ? 'completed' : 'failed';
  const stderr = [run.stderr.trim(), completionFailure].filter(Boolean).join('\n');
  return subagentToolResult(entry, context, {
    ...input,
    status,
    command,
    ...compactSubagentOutput({
      provider: 'grok',
      cwd: input.cwd,
      traceId: context.traceId,
      stdout: run.stdout,
      stderr,
      taskSession: input.audit.taskSession,
      branch: input.audit.branch,
    }),
    exitCode: completed ? 0 : 1,
    durationMs: elapsedMs(started, context.options.now),
    audit: { ...input.audit, rawShellUsed: true },
    ok: completed,
    code: run.timedOut ? 'TIMEOUT' : completed ? 'OK' : 'COMMAND_FAILED',
    message: run.timedOut
      ? 'grok provider timed out'
      : completed
        ? 'grok provider completed'
        : completionFailure || 'grok provider failed',
  });
}

function grokCompletionFailure(stdout: string): string | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return 'grok provider exited without a final message';

  let value: Record<string, unknown>;
  try {
    value = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const stopReason = stringValue(value.stopReason);
  if (stopReason) {
    const normalized = stopReason.replace(/[^a-z]/gi, '').toLowerCase();
    if (!['endturn', 'completed', 'stop'].includes(normalized)) {
      return `grok provider ended with stop reason ${stopReason}`;
    }
  }

  const finalMessage =
    stringValue(value.finalMessage) ||
    stringValue(value.message) ||
    stringValue(value.text) ||
    stringValue(value.output);
  if (!finalMessage?.trim()) return 'grok provider exited without a final message';
  return undefined;
}

function subagentToolResult(
  entry: ToolManifestEntry,
  context: {
    env: NodeJS.ProcessEnv;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
  input: Omit<SubagentData, 'durationMs' | 'capabilities'> & {
    durationMs?: number;
    capabilities?: SubagentCapabilities;
    ok: boolean;
    code: 'OK' | 'COMMAND_FAILED' | 'TIMEOUT' | 'TASK_SESSION_REQUIRED' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CAPABILITY_NOT_SUPPORTED' | 'WAIT_TIMEOUT' | 'IDEMPOTENCY_CONFLICT';
    message: string;
  },
): ToolResult<SubagentData> {
  const data: SubagentData = {
    provider: input.provider,
    ...(input.model ? { model: input.model } : {}),
    bundle: input.bundle,
    outputFormat: input.outputFormat,
    mode: input.mode,
    policy: input.policy,
    ...(input.action ? { action: input.action } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
    capabilities: input.capabilities || capabilitiesForProvider(input.provider),
    ...(input.unsupportedCapabilities ? { unsupportedCapabilities: input.unsupportedCapabilities } : {}),
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
  logResult(
    entry,
    entry.name,
    result,
    input.command.join(' '),
    input.audit.branch,
    `workspace ${entry.name}`,
    context.options.logMode,
    data,
    context.env,
  );
  return result;
}


function normalizeSubagentBundle(value: unknown): SubagentBundle {
  return value === 'media' ? 'media' : 'core';
}

function normalizeSubagentOutputFormat(value: unknown): SubagentOutputFormat {
  return value === 'json' ? 'json' : 'text';
}

function subagentBundleInstruction(bundle: SubagentBundle, outputFormat: SubagentOutputFormat): string {
  if (bundle === 'media') {
    return [
      'Use the media steering bundle only. Do not layer core steering on top of media steering.',
      'Preserve Ko voice. Do not over-clean wording. Return the requested social/media result in the requested format.',
      outputFormat === 'json' ? 'Return valid JSON only.' : 'Return concise text only.',
    ].join('\n');
  }
  return [
    'Use core steering.',
    'Follow the instruction file exactly. Prefer workspace tooling when available.',
    outputFormat === 'json' ? 'Return valid JSON only.' : 'Return concise text only.',
  ].join('\n');
}


function normalizeWorkspaceOnly(value: unknown, fallback: SubagentWorkspaceOnly): SubagentWorkspaceOnly {
  if (value === true || value === 'preferred') return 'preferred';
  if (value === 'strict') return 'strict';
  if (value === false) return false;
  return fallback;
}

function subagentTimeoutMs(entry: ToolManifestEntry, input: ToolInput): number {
  const requested = typeof input.timeoutMs === 'number' ? input.timeoutMs : entry.defaultTimeout;
  return Math.min(Math.max(1, requested), SUBAGENT_MAX_TIMEOUT_MS);
}

function resolveSubagentCwd(input: ToolInput, rootCwd: string): { ok: true; cwd: string } | { ok: false; message: string } {
  const repoRoot = resolveGitRoot(rootCwd);
  const taskWorktree = typeof input.taskWorktree === 'string' ? path.resolve(input.taskWorktree) : undefined;
  const defaultCwd = taskWorktree || repoRoot;
  const requested = typeof input.cwd === 'string' ? input.cwd : defaultCwd;
  const resolved = path.resolve(defaultCwd, requested);
  const roots = [repoRoot, taskWorktree].filter((item): item is string => Boolean(item)).map((item) => path.resolve(item));
  if (!roots.some((root) => isPathWithin(resolved, root))) {
    return { ok: false, message: 'subagent cwd must stay inside the repo root or task worktree' };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { ok: false, message: 'subagent cwd must be an existing directory' };
  }
  return { ok: true, cwd: resolved };
}

function resolveSubagentInstructionPath(
  input: ToolInput,
  cwd: string,
  rootCwd: string,
): { ok: true; instructionPath: string } | { ok: false; message: string } {
  const rawPath = typeof input.instructionPath === 'string' ? input.instructionPath : '';
  const resolved = path.resolve(cwd, rawPath);
  const repoRoot = resolveGitRoot(rootCwd);
  const taskWorktree = typeof input.taskWorktree === 'string' ? path.resolve(input.taskWorktree) : undefined;
  const handoffRoot = path.join(os.tmpdir(), 'opensaas-handoffs');
  const roots = [repoRoot, taskWorktree, handoffRoot].filter((item): item is string => Boolean(item)).map((item) => path.resolve(item));
  if (!roots.some((root) => isPathWithin(resolved, root))) {
    return { ok: false, message: 'subagent instructionPath must stay inside the repo root or task worktree' };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { ok: false, message: 'subagent instructionPath must point to an existing file' };
  }
  return { ok: true, instructionPath: resolved };
}

function isPathWithin(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findDangerousSubagentInstruction(instruction: string): string | null {
  const patterns = [
    { pattern: /\brm\s+-rf\s+\//i, reason: 'subagent blocked dangerous instruction: rm -rf /' },
    { pattern: /\bgit\s+push\b[^\n;]*--force/i, reason: 'subagent blocked dangerous instruction: git push --force' },
    { pattern: /\bsudo\b/i, reason: 'subagent blocked dangerous instruction: sudo' },
    { pattern: /\bchmod\s+-R\s+777\b/i, reason: 'subagent blocked dangerous instruction: chmod -R 777' },
    { pattern: /\bcurl\b[\s\S]{0,120}\|\s*(?:sh|bash)\b/i, reason: 'subagent blocked dangerous instruction: curl pipe shell' },
  ];
  return patterns.find(({ pattern }) => pattern.test(instruction))?.reason || null;
}

function findExecutable(binary: string, env: NodeJS.ProcessEnv, fallbackBinaries: string[] = []): string | null {
  for (const candidateBinary of [binary, ...fallbackBinaries]) {
    if (path.isAbsolute(candidateBinary)) {
      if (isExecutable(candidateBinary)) return candidateBinary;
      continue;
    }

    for (const directory of executableSearchDirectories(env)) {
      const candidate = path.join(directory, candidateBinary);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

function executableSearchDirectories(env: NodeJS.ProcessEnv): string[] {
  const directories = (env.PATH ?? process.env.PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const home = env.HOME ?? process.env.HOME;
  if (home) {
    directories.push(
      path.join(home, '.grok', 'bin'),
      path.join(home, '.local', 'bin'),
      path.join(home, '.bun', 'bin'),
      path.join(home, '.opencode', 'bin'),
    );
  }
  return Array.from(new Set(directories));
}

function isExecutable(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
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

function subagentInstruction(input: { instruction: string; instructionPath: string; workspaceOnly: SubagentWorkspaceOnly; bundle: SubagentBundle; outputFormat: SubagentOutputFormat; policy?: SubagentPolicy; taskSession?: string }): string {
  const guidance = input.workspaceOnly === 'strict'
    ? 'Use only workspace tooling/MCP/facade operations. Return NOT_SUPPORTED if that cannot be enforced.'
    : input.workspaceOnly === 'preferred'
      ? 'Use workspace tooling first. Raw shell is allowed only as a fallback and must be reported.'
      : 'Use the provider default execution model.';
  return [
    subagentBundleInstruction(input.bundle, input.outputFormat),
    guidance,
    `Instruction file: ${input.instructionPath}`,
    'Read the instruction file first. Treat that file as the full user request.',
    input.policy === 'edit'
      ? input.taskSession
        ? 'Use the existing taskSession for task-scoped mutation. task.push publishes only the task branch. task.pr merges to the stream; do not call task.pr when the handoff says stop after push.'
        : 'Self-bootstrap edit mode: your first repository action must be task.start before any task-scoped repository mutation. task.push publishes only the task branch. task.pr merges to the stream; do not call task.pr when the handoff says stop after push.'
      : 'status/wait/logs attach to an existing run and never spawn. requestId makes start retries idempotent.',
  ].join('\n\n');
}

function compactSubagentOutput(input: {
  provider: SubagentProvider;
  cwd: string;
  traceId: string;
  stdout: string;
  stderr: string;
  taskSession?: string;
  branch?: string;
}): Pick<SubagentData, 'stdout' | 'stderr' | 'finalMessage' | 'summary' | 'rawLogPath' | 'stdoutLogPath' | 'stderrLogPath' | 'stdoutChars' | 'stderrChars' | 'usage'> {
  const parsed = parseSubagentOutput(input.provider, input.stdout);
  const logs = persistSubagentLogs(input);
  const finalMessage = parsed.finalMessage?.trim();
  const events = parseSubagentTraceEvents(input.provider, input.stdout);
  const stderrSummary = compactText(input.stderr);
  const summary = buildSubagentRunSummary({ traceId: input.traceId, events, finalMessage, stdout: input.stdout });
  recordSubagentTraceEventsSafely({
    provider: input.provider,
    parentTraceId: input.traceId,
    cwd: input.cwd,
    taskSession: input.taskSession,
    branch: input.branch,
    stdoutLogPath: logs.stdoutLogPath,
    events,
  });
  return {
    stdout: summary.compact,
    stderr: stderrSummary,
    ...(finalMessage ? { finalMessage } : {}),
    summary,
    ...(logs.rawLogPath ? { rawLogPath: logs.rawLogPath } : {}),
    stdoutLogPath: logs.stdoutLogPath,
    stderrLogPath: logs.stderrLogPath,
    stdoutChars: input.stdout.length,
    stderrChars: input.stderr.length,
    ...(parsed.usage ? { usage: parsed.usage } : {}),
  };
}

export function parseSubagentTraceEvents(
  provider: SubagentProvider,
  stdout: string,
): SubagentTraceEvent[] {
  if (provider !== 'codex') return [];
  return parseCodexTraceEvents(stdout);
}

function parseCodexTraceEvents(stdout: string): SubagentTraceEvent[] {
  const events: SubagentTraceEvent[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.type === 'item.completed') {
      const item = isRecord(event.item) ? event.item : undefined;
      if (!item) continue;
      if (item.type === 'mcp_tool_call') {
        const server = stringValue(item.server) || 'unknown';
        const mcpTool = stringValue(item.tool) || 'unknown';
        const args = isRecord(item.arguments) ? item.arguments : undefined;
        const facadeTool = mcpTool === 'call' && args
          ? stringValue(args.tool)
          : undefined;
        const isGetSteering = mcpTool === 'get_steering';
        const tool = isGetSteering
          ? 'codex.get_steering'
          : facadeTool
            ? `codex.${facadeTool}`
            : `codex.${server}.${mcpTool}`;
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
          tool: 'codex.command_execution',
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
          tool: 'codex.agent_message',
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
      const usage = isRecord(event.usage) ? event.usage : undefined;
      const inputTokens = numberValue(usage?.input_tokens) || 0;
      const outputTokens = numberValue(usage?.output_tokens) || 0;
      const reasoningTokens = numberValue(usage?.reasoning_output_tokens) || 0;
      events.push({
        eventType: 'turn.completed',
        tool: 'codex.turn.completed',
        status: 'ok',
        ok: true,
        code: 'OK',
        result: { usage },
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens + reasoningTokens,
      });
    }
  }
  return events;
}

function estimateTokens(value: unknown): number {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return text ? Math.ceil(text.length / 4) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseSubagentOutput(provider: SubagentProvider, stdout: string): {
  finalMessage?: string;
  summaryText?: string;
  usage?: SubagentData['usage'];
} {
  if (provider === 'codex') return parseCodexJsonEvents(stdout);

  if (provider === 'pi') return parsePiJsonEvents(stdout);

  const trimmed = stdout.trim();
  if (!trimmed) return {};
  try {
    const value = JSON.parse(trimmed) as Record<string, unknown>;
    const finalMessage = stringValue(value.finalMessage) || stringValue(value.message) || stringValue(value.text) || stringValue(value.output);
    return {
      ...(finalMessage ? { finalMessage, summaryText: finalMessage } : {}),
    };
  } catch {
    return { finalMessage: trimmed, summaryText: compactText(trimmed) };
  }
}

function parseCodexJsonEvents(stdout: string): {
  finalMessage?: string;
  summaryText?: string;
  usage?: SubagentData['usage'];
} {
  let finalMessage: string | undefined;
  let usage: SubagentData['usage'] | undefined;
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
    ...(finalMessage ? { finalMessage, summaryText: finalMessage } : {}),
    ...(usage ? { usage } : {}),
  };
}



function parsePiJsonEvents(stdout: string): {
  finalMessage?: string;
  summaryText?: string;
  usage?: SubagentData['usage'];
} {
  let finalMessage: string | undefined;
  let usage: SubagentData['usage'] | undefined;
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
    ...(finalMessage ? { finalMessage, summaryText: finalMessage } : {}),
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

function extractPiUsageFallback(stdout: string): SubagentData['usage'] | undefined {
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



function buildSubagentRunSummary(input: {
  traceId: string;
  events: SubagentTraceEvent[];
  finalMessage?: string;
  stdout: string;
}): SubagentRunSummary {
  const toolsCalled = unique(input.events.map((event) => event.facadeTool || event.tool).filter(Boolean));
  const filesRead = unique(input.events.flatMap((event) => eventLooksRead(event) ? extractPathHints(event) : []));
  const filesEdited = unique(input.events.flatMap((event) => eventLooksEdit(event) ? extractPathHints(event) : []));
  const traceEvents = input.events.slice(0, 12).map((event, index) => ({
    tool: event.facadeTool || event.tool,
    status: event.status,
    traceId: `${input.traceId}:subagent:${String(index + 1).padStart(4, '0')}`,
    ...(event.input !== undefined ? { input: compactText(asJsonText(event.input), 180) } : {}),
    ...(event.result !== undefined ? { output: compactText(asJsonText(event.result), 180) } : {}),
  }));
  const parts = [];
  if (toolsCalled.length) parts.push(`${toolsCalled.length} tools: ${toolsCalled.slice(0, 5).join(', ')}${toolsCalled.length > 5 ? ', ...' : ''}`);
  if (filesRead.length) parts.push(`read ${filesRead.slice(0, 4).join(', ')}${filesRead.length > 4 ? ', ...' : ''}`);
  if (filesEdited.length) parts.push(`edited ${filesEdited.slice(0, 4).join(', ')}${filesEdited.length > 4 ? ', ...' : ''}`);
  const fallback = input.finalMessage || compactText(input.stdout);
  const compact = parts.length ? parts.join(' - ') : (fallback || 'completed - no subagent trace events');
  return { traceId: input.traceId, compact, filesRead, filesEdited, toolsCalled, traceEvents };
}

function eventLooksRead(event: SubagentTraceEvent): boolean {
  const tool = `${event.facadeTool || event.tool} ${asJsonText(event.input)}`.toLowerCase();
  return /fs\.read|read|search|list/.test(tool) && !eventLooksEdit(event);
}

function eventLooksEdit(event: SubagentTraceEvent): boolean {
  const tool = `${event.facadeTool || event.tool} ${asJsonText(event.input)} ${asJsonText(event.result)}`.toLowerCase();
  return /fs\.write|applypatch|apply_patch|edit|changed|fileschanged|files changed/.test(tool);
}

function extractPathHints(value: unknown): string[] {
  const out: string[] = [];
  const visit = (item: unknown): void => {
    if (typeof item === 'string') {
      const matches = item.match(/[A-Za-z0-9_.\/-]+\.[A-Za-z0-9_.-]+/g) || [];
      out.push(...matches.filter((entry) => !entry.startsWith('http')));
      return;
    }
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (!isRecord(item)) return;
    for (const [key, child] of Object.entries(item)) {
      if (/path|file|files|filesChanged/i.test(key)) visit(child);
    }
  };
  visit(value);
  return out;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 20);
}

function asJsonText(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value ?? ''); } catch { return String(value ?? ''); }
}

function persistSubagentLogs(input: {
  provider: SubagentProvider;
  cwd: string;
  traceId: string;
  stdout: string;
  stderr: string;
}): { rawLogPath?: string; stdoutLogPath: string; stderrLogPath: string } {
  const runId = `${input.traceId}-${input.provider}`.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  const logDir = path.join(input.cwd, '.task', 'subagent-runs', runId);
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

function compactText(value: string, limit = SUBAGENT_COMPACT_OUTPUT_LIMIT): string {
  const trimmed = value.trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}\n... [truncated ${trimmed.length - limit} chars; see subagent log path]`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function boundSubagentOutput(value: string): string {
  if (value.length <= SUBAGENT_OUTPUT_LIMIT) return value;
  return `${value.slice(0, SUBAGENT_OUTPUT_LIMIT)}\n... [truncated ${value.length - SUBAGENT_OUTPUT_LIMIT} chars]`;
}

async function runSubagentProcess(input: {
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
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const finish = (result: RunnerResult & { timedOut: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        child.kill('SIGKILL');
        finish({ stdout, stderr, exitCode: 1, timedOut: true });
      }, 5000);
      killTimer.unref?.();
    }, input.timeoutMs);
    timeout.unref?.();

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout = boundSubagentOutput(stdout + chunk); });
    child.stderr.on('data', (chunk) => { stderr = boundSubagentOutput(stderr + chunk); });
    child.on('error', (error) => {
      finish({ stdout, stderr: error.message, exitCode: 1, timedOut: false });
    });
    child.on('close', (code) => {
      finish({ stdout, stderr, exitCode: timedOut ? 1 : code ?? 0, timedOut });
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
  data?: SubagentData,
  env?: NodeJS.ProcessEnv,
): void {
  const emit = logMode !== 'silent' && !(logMode === 'errors' && result.ok);
  const usage = data?.usage;
  const totalTokens = usage
    ? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) + (usage.reasoningOutputTokens ?? 0)
    : undefined;

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
    taskSession: data?.audit.taskSession,
    worktree: data?.cwd,
    input: data ? {
      provider: data.provider,
      model: data.model,
      bundle: data.bundle,
      outputFormat: data.outputFormat,
      mode: data.mode,
      policy: data.policy,
      instructionPath: data.instructionPath,
    } : undefined,
    resolvedInput: data,
    result,
    stderr: result.stderr,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    totalTokens,
    env,
    emit,
    capabilities: {
      readOnly: entry?.capabilities.readOnly ?? true,
      mutating: entry?.capabilities.mutating ?? false,
    },
  });
}
