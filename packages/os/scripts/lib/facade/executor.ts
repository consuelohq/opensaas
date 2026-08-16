import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';

import manifestJson from '../../../manifests/generated/tool.manifest.json';
import {
  executeDeploymentFacade,
  type DeploymentFacadeInput,
} from '../../../tools/deployment-provider/facade';
import { redactDeploymentTraceInput } from '../../../tools/deployment-provider/redaction';

import { runBatch } from './batch';
import { getCurrentTask, getAreaFromBranch, resolveTaskBranch } from './branch-resolver';
import { createToolResult, createTraceId, getErrorMessage, isTimeoutError, isToolResult } from './errors';
import { logToolExecution } from './logger';
import { PROCESS_TERMINATION_GRACE_MS, registerProcessTreeCleanup, shouldUseDetachedProcessGroup, terminateProcessTree } from './process-tree';
import { getInputSchema } from './schemas';
import { resolveBrowserConfig } from '../browser/config';
import { executeCodeCall } from '../code-call/runtime';
import { nodeResourceLockPath, withNodeResourceLock } from '../node-resource-lock';
import { resolveActiveWorkspaceProjectCwd } from '../workspace-project-cwd';
import {
  resolveWorkSessionFsScope,
  WorkSessionFsScopeError,
} from '../work-session-fs';
import type { CodeCallInput } from '../code-call/types';
import { executeSubagent } from '../subagent/runtime';
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
const require = createRequire(import.meta.url);
const { syncTddEvidence, syncTestSelectionEvidence, syncValidationEvidence } = require('../task-workpad');
const { recoverDurableTaskSession } = require('../task-session');
const { readDurableTaskSessionMetadata, touchDurableTaskSessionMetadata } = require('../task-registry');
const { getTaskWorktreeRoot } = require('../paths');

type CanonicalManifestEntry = {
  kind: 'os-skill' | 'facade-tool';
  definition: ToolManifestEntry;
};

type CanonicalToolManifest = {
  tools: CanonicalManifestEntry[];
};

const fullToolManifest = manifestJson as CanonicalToolManifest;

export const manifestEntries = fullToolManifest.tools
  .filter((entry) => entry.kind === 'facade-tool')
  .map((entry) => entry.definition);

type TaskSessionMetadata = {
  taskSession?: string;
  id?: string;
  taskId?: string;
  tmuxSession?: string;
  branch?: string;
  taskBranch?: string;
  worktree?: string;
  worktreePath?: string;
};
type TaskSessionResolution =
  | { ok: true; branch: string; metadata: TaskSessionMetadata }
  | { ok: false; code: 'TASK_SESSION_NOT_FOUND' | 'VALIDATION_ERROR'; message: string };
type WorkSessionResolution =
  | { ok: true; workSession: string; root: string }
  | { ok: false; code: 'WORK_SESSION_NOT_FOUND' | 'PERMISSION_DENIED' | 'VALIDATION_ERROR'; message: string };

const runtimePackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
function refreshTaskSessionActivity(
  entry: ToolManifestEntry,
  resolution: TaskSessionResolution | null,
  result: ToolResult<unknown>,
  input: ToolInput,
  env: NodeJS.ProcessEnv,
): void {
  if (!entry.capabilities.mutating || !resolution?.ok || !result.ok || input.dryRun === true) return;
  try {
    const home = env.CONSUELO_HOME || env.CONSUELO_OS_HOME;
    touchDurableTaskSessionMetadata(resolution.metadata.taskSession, home ? { home } : {});
  } catch (error: unknown) {
    process.stderr.write(`warning: failed to refresh durable task activity ${resolution.metadata.taskSession}: ${getErrorMessage(error)}\n`);
  }
}

const MAX_LOG_COMMAND_CHARS = 4000;
const WORK_SESSION_FS_TOOLS = new Set(['fs.write', 'fs.apply_patch', 'fs.trash']);
const WORK_SESSION_AUTHORITY_TOOLS = new Set([...WORK_SESSION_FS_TOOLS, 'code.call']);

function isWorkSessionFsTool(toolName: string): boolean {
  return WORK_SESSION_FS_TOOLS.has(toolName);
}

function supportsWorkSessionAuthority(toolName: string): boolean {
  return WORK_SESSION_AUTHORITY_TOOLS.has(toolName);
}

export function getToolManifestEntry(toolName: string): ToolManifestEntry | null {
  const directMatch = manifestEntries.find((entry) => entry.name === toolName);
  if (directMatch) return directMatch;

  const scriptMatches = manifestEntries.filter((entry) => entry.command.script === toolName);
  return scriptMatches.length === 1 ? scriptMatches[0] : null;
}

function buildUnknownToolGuidance(toolName: string): { message: string; data: unknown | null } {
  if (toolName !== 'fs.patch') {
    return { message: `unknown tool: ${toolName}`, data: null };
  }

  const manifestEntry = getToolManifestEntry('fs.apply_patch');
  return {
    message: [
      'unknown tool: fs.patch.',
      'fs.patch is not an OS tool; use fs.apply_patch instead.',
      'Call it with exactly one of patchText or patchFile.',
      'The fs.apply_patch manifest entry is included at data.manifestEntry.',
    ].join(' '),
    data: {
      requestedTool: 'fs.patch',
      replacementTool: 'fs.apply_patch',
      action: 'Call fs.apply_patch with exactly one of patchText or patchFile.',
      exampleCall: {
        tool: 'fs.apply_patch',
        input: {
          taskSession: '<taskSession>',
          patchFile: '/tmp/change.patch',
          dryRun: true,
        },
      },
      manifestEntry,
    },
  };
}


export const defaultRunner: ToolRunner = (plan, timeoutMs) => new Promise((resolve, reject) => {
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    detached: shouldUseDetachedProcessGroup(),
    env: plan.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  let killTimer: NodeJS.Timeout | null = null;
  const cleanupProcessTree = registerProcessTreeCleanup(child);
  const timeout = setTimeout(() => {
    timedOut = true;
    terminateProcessTree(child, 'SIGTERM');
    killTimer = setTimeout(() => {
      terminateProcessTree(child, 'SIGKILL');
    }, PROCESS_TERMINATION_GRACE_MS);
  }, timeoutMs);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', (error) => {
    clearTimeout(timeout);
    if (killTimer) clearTimeout(killTimer);
    cleanupProcessTree();
    reject(error);
  });
  child.on('close', (code) => {
    clearTimeout(timeout);
    if (killTimer) clearTimeout(killTimer);
    cleanupProcessTree();
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
  // An MCP call supplies no cwd, and the server process runs from the immutable runtime release,
  // which is not a repository. Falling straight through to process.cwd() left every repo-aware
  // facade tool unable to find a git root. Prefer the workspace's configured project checkout.
  const cwd = resolveGitRoot(
    options.cwd || resolveActiveWorkspaceProjectCwd() || process.cwd(),
  );
  const env = options.env || process.env;
  const runner = options.runner || defaultRunner;
  const requestId = typeof input.requestId === 'string' ? input.requestId : undefined;
  let entry = getToolManifestEntry(toolName);

  try {
    if (!entry) {
      const guidance = buildUnknownToolGuidance(toolName);
      const result = createToolResult({
        ok: false,
        code: 'NOT_FOUND',
        message: guidance.message,
        data: guidance.data,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, '', undefined, undefined, options.logMode, { input, env });
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
      logResult(entry, toolName, result, entry.underlying, undefined, undefined, options.logMode, { input, env });
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
      logResult(entry, toolName, result, entry.underlying, undefined, undefined, options.logMode, { input, env });
      return result as ToolResult<TData>;
    }

    const normalizedInput = normalizeInput(toolName, parsed.data as ToolInput);
    const taskHandle = typeof normalizedInput.taskSession === 'string' ? normalizedInput.taskSession.trim() : '';
    const workHandle = typeof normalizedInput.workSession === 'string' ? normalizedInput.workSession.trim() : '';
    if (taskHandle && workHandle) {
      const result = createToolResult({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Provide taskSession or workSession, but not both.',
        data: null,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode, {
        input,
        resolvedInput: normalizedInput,
        env,
      });
      return result as ToolResult<TData>;
    }
    const taskSessionResolution = resolveTaskSessionInput(normalizedInput, cwd, env);
    if (taskSessionResolution && !taskSessionResolution.ok) {
      const result = createToolResult({
        ok: false,
        code: taskSessionResolution.code,
        message: taskSessionResolution.message,
        data: null,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode, {
        input,
        resolvedInput: normalizedInput,
        env,
      });
      return result as ToolResult<TData>;
    }
    const workSessionResolution = resolveWorkSessionInput(toolName, normalizedInput, cwd, env);
    if (workSessionResolution && !workSessionResolution.ok) {
      const result = createToolResult({
        ok: false,
        code: workSessionResolution.code,
        message: workSessionResolution.message,
        data: null,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode, {
        input,
        resolvedInput: normalizedInput,
        env,
      });
      return result as ToolResult<TData>;
    }
    if (entry.sessionRequired === true && !taskSessionResolution?.ok && !workSessionResolution?.ok) {
      const recovery = buildTaskSessionRequiredRecovery(toolName, entry, normalizedInput);
      const result = createToolResult({
        ok: false,
        code: 'TASK_SESSION_REQUIRED',
        message: recovery.message,
        data: recovery.data,
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode, {
        input,
        resolvedInput: normalizedInput,
        env,
      });
      return result as ToolResult<TData>;
    }
    const scopedInput = taskSessionResolution?.ok
      ? {
        ...normalizedInput,
        branch: taskSessionResolution.branch,
        taskWorktree: taskSessionResolution.metadata.worktree || taskSessionResolution.metadata.worktreePath,
      }
      : workSessionResolution?.ok
        ? {
          ...normalizedInput,
          workSessionRoot: workSessionResolution.root,
        }
        : normalizedInput;

    if (entry.capabilities.mutating && scopedInput.dryRun === true && !entry.command.dryRunFlag) {
      const result = createToolResult({
        ok: true,
        code: 'DRY_RUN',
        message: 'dry run: command was validated but not executed',
        data: { command: `workspace ${toolName}`, resolvedArgs: scopedInput },
        durationMs: elapsedMs(startedAt, options.now),
        traceId,
        requestId,
        now: options.now,
      });
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode, {
        input,
        resolvedInput: scopedInput,
        env,
      });
      return result as ToolResult<TData>;
    }

    const internalResult = await executeInternalTool<TData>(entry, scopedInput, {
      cwd,
      env,
      rawInput: input,
      runner,
      startedAt,
      traceId,
      requestId,
      options,
    });
    if (internalResult) {
      refreshTaskSessionActivity(entry, taskSessionResolution, internalResult as ToolResult<unknown>, scopedInput, env);
      return internalResult;
    }

    const branchResolution = resolveBranchIfNeeded(entry, scopedInput, cwd, env, options);
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
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode, {
        input,
        resolvedInput: scopedInput,
        env,
      });
      return result as ToolResult<TData>;
    }

    const commandInput = {
      ...scopedInput,
      ...(branchResolution.branch ? { branch: branchResolution.branch } : {}),
    };
    const plan = buildCommandPlan(entry, commandInput, cwd, env);
    const plannedCommand = formatCommand(plan);
    const plannedCommandForLog = formatCommandForLog(plan);
    const facadeCmd = formatFacadeCommand(toolName, commandInput);
    const facadeCmdForLog = formatFacadeCommandForLog(toolName, commandInput);

    const timeoutMs = getTimeoutMs(entry, commandInput);
    const runResult = (toolName === 'browser' || toolName.startsWith('browser.'))
      ? await withNodeResourceLock({
        lockPath: nodeResourceLockPath(resolveBrowserConfig(env).profilePath),
        operationId: `browser:${toolName}`,
        waitTimeoutMs: timeoutMs,
      }, () => runWithRetry(entry, plan, timeoutMs, runner))
      : await runWithRetry(entry, plan, timeoutMs, runner);
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
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode, {
        input,
        resolvedInput: commandInput,
        env,
      });
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
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode, {
        input,
        resolvedInput: commandInput,
        env,
      });
      return result as ToolResult<TData>;
    }

    if (isToolResult(parsedStdout.data)) {
      const passthrough = parsedStdout.data as ToolResult<TData>;
      const result = {
        ...passthrough,
        data: compactFacadeData(toolName, passthrough.data),
        now: typeof passthrough.now === 'string' ? passthrough.now : new Date((options.now || Date.now)()).toISOString(),
        stderr: stripCommandEcho(String(passthrough.stderr || '')),
        ...(requestId && !passthrough.requestId ? { requestId } : {}),
      };
      maybeSyncWorkpadValidation(toolName, commandInput, result as ToolResult<unknown>);
      refreshTaskSessionActivity(entry, taskSessionResolution, result as ToolResult<unknown>, commandInput, env);
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode, {
        input,
        resolvedInput: commandInput,
        env,
      });
      return result;
    }

    const ok = runResult.exitCode === 0;
    const result = createToolResult({
      ok,
      code: ok ? 'OK' : 'COMMAND_FAILED',
      message: ok ? 'command completed' : 'command failed',
      data: compactFacadeData(toolName, parsedStdout.data) as TData,
      stderr: cleanStderr,
      exitCode: runResult.exitCode,
      durationMs: elapsedMs(startedAt, options.now),
      traceId,
      requestId,
      now: options.now,
    });
    maybeSyncWorkpadValidation(toolName, commandInput, result as ToolResult<unknown>);
    refreshTaskSessionActivity(entry, taskSessionResolution, result as ToolResult<unknown>, commandInput, env);
    logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode, {
      input,
      resolvedInput: commandInput,
      env,
    });
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
      now: options.now,
    });
    logResult(entry, toolName, result, entry?.underlying || '', undefined, undefined, options.logMode, { input, env });
    return result as ToolResult<TData>;
  }
}


type JsonRecord = Record<string, unknown>;

const FACADE_FINDING_SAMPLE_LIMIT = 8;
const FACADE_VERIFY_SAMPLE_LIMIT = 10;
const FACADE_VERIFY_TEXT_LIMIT = 600;
const FACADE_MESSAGE_PREVIEW_LIMIT = 240;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function previewText(value: unknown, limit = FACADE_MESSAGE_PREVIEW_LIMIT): string {
  const text = String(value || '').replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}... truncated ${text.length - limit} chars` : text;
}

function compactVerifyList(value: unknown, sampleLimit = FACADE_VERIFY_SAMPLE_LIMIT): JsonRecord {
  const items = asArray(value);
  return {
    total: items.length,
    sample: items.slice(0, sampleLimit).map(compactVerifyValue),
    truncated: items.length > sampleLimit,
    omitted: Math.max(0, items.length - sampleLimit),
  };
}

function compactVerifyValue(value: unknown): unknown {
  if (typeof value === 'string') return previewText(value, FACADE_VERIFY_TEXT_LIMIT);
  if (Array.isArray(value)) return compactVerifyList(value);
  if (!isRecord(value)) return value;

  const compacted: JsonRecord = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue === 'string' && ['message', 'stderr', 'stdout', 'output', 'outputTail', 'tail'].includes(key)) {
      compacted[key] = previewText(entryValue, FACADE_VERIFY_TEXT_LIMIT);
      continue;
    }
    compacted[key] = compactVerifyValue(entryValue);
  }
  return compacted;
}

function compactFacadeFinding(value: unknown, index: number, owner: 'your_change' | 'pre_existing'): JsonRecord {
  const finding = isRecord(value) ? value : {};
  const fullMessage = finding.message ?? finding.msg ?? '';
  const message = previewText(fullMessage);
  const prefix = owner === 'your_change' ? 'your' : 'pre';
  return {
    id: typeof finding.id === 'string' ? finding.id : `${prefix}_finding_${String(index + 1).padStart(4, '0')}`,
    owner,
    rule: typeof finding.rule === 'string' ? finding.rule : 'UNKNOWN',
    file: typeof finding.file === 'string' ? finding.file : '',
    line: typeof finding.line === 'number' ? finding.line : 0,
    message,
    messageChars: String(fullMessage || '').length,
    messageTruncated: message !== String(fullMessage || ''),
  };
}

function sanitizeRecoveryInput(input: ToolInput): ToolInput {
  const sensitivePattern = /(authorization|cookie|token|secret|password|passwd|api[_-]?key|credential|session)/i;
  const sanitize = (value: unknown, key = ''): unknown => {
    if (sensitivePattern.test(key)) return '[redacted]';
    if (Array.isArray(value)) return value.map((item) => sanitize(item));
    if (isRecord(value)) {
      return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey),
      ]));
    }
    return value;
  };
  return sanitize(input) as ToolInput;
}

function isRepoStateBound(entry: ToolManifestEntry): boolean {
  if (entry.command.script === 'task:fs') return true;
  if (entry.command.branchMode === 'required') return true;
  return false;
}

function taskSessionRequiredReason(toolName: string, entry: ToolManifestEntry, repoStateBound: boolean): string {
  if (repoStateBound && entry.capabilities.readOnly) {
    return `${toolName} reads repository state through a task worktree so the result is branch-aware and fresh.`;
  }
  if (repoStateBound) {
    return `${toolName} must run inside an isolated task worktree so durable repo changes do not touch main or another agent's work.`;
  }
  return `${toolName} requires taskSession because its manifest marks the tool as task-scoped.`;
}

function buildTaskSessionRequiredRecovery(toolName: string, entry: ToolManifestEntry, input: ToolInput): {
  message: string;
  data: Record<string, unknown>;
} {
  const safeInput = sanitizeRecoveryInput(input);
  const repoStateBound = isRepoStateBound(entry);
  const reason = taskSessionRequiredReason(toolName, entry, repoStateBound);
  if (isWorkSessionFsTool(toolName)) {
    return {
      message: `${toolName} requires mutation authority. Use taskSession for managed repository work, or start a work session and pass workSession for ordinary filesystem work.`,
      data: {
        tool: toolName,
        reason,
        repoStateBound,
        originalCall: {
          tool: toolName,
          input: safeInput,
        },
        recovery: {
          action: 'start_task_or_work_session_then_retry',
          steps: [
            'For repository edits, call session.start with kind=task (or task.start for compatibility) and pass the returned taskSession.',
            'For ordinary filesystem edits, call session.start with kind=work and the directory path, then pass the returned workSession.',
            `Rerun ${toolName} with the same mutation input and exactly one session authority.`,
          ],
        },
      },
    };
  }
  return {
    message: `${toolName} requires taskSession. Start a task with task.start, capture data.taskSession, then rerun ${toolName} with the same input plus taskSession.`,
    data: {
      tool: toolName,
      reason,
      repoStateBound,
      originalCall: {
        tool: toolName,
        input: safeInput,
      },
      recovery: {
        action: 'start_task_session_then_retry',
        steps: [
          'Call task.start for the relevant area and capture data.taskSession.',
          `Rerun ${toolName} with the same input plus that taskSession.`,
          entry.capabilities.mutating
            ? 'If files change, continue through review.run, verify, task.push, and task.pr.'
            : 'For read-only investigation, report the result without creating durable repo changes.',
        ],
      },
    },
  };
}

function summarizeFacadeFindings(findings: JsonRecord[]): JsonRecord {
  const byRule = new Map<string, number>();
  const byFile = new Map<string, { file: string; count: number; rules: Set<string> }>();
  for (const finding of findings) {
    const rule = typeof finding.rule === 'string' ? finding.rule : 'UNKNOWN';
    const file = typeof finding.file === 'string' && finding.file ? finding.file : '(project)';
    byRule.set(rule, (byRule.get(rule) || 0) + 1);
    const fileEntry = byFile.get(file) || { file, count: 0, rules: new Set<string>() };
    fileEntry.count += 1;
    fileEntry.rules.add(rule);
    byFile.set(file, fileEntry);
  }
  return {
    total: findings.length,
    byRule: [...byRule.entries()].map(([rule, count]) => ({ rule, count })),
    byFile: [...byFile.values()]
      .map((entry) => ({ file: entry.file, count: entry.count, rules: [...entry.rules].sort() }))
      .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file)),
    sample: findings.slice(0, FACADE_FINDING_SAMPLE_LIMIT),
    truncated: findings.length > FACADE_FINDING_SAMPLE_LIMIT,
    omitted: Math.max(0, findings.length - FACADE_FINDING_SAMPLE_LIMIT),
  };
}

function compactReviewData(data: unknown): unknown {
  if (!isRecord(data)) return data;
  if (data.schema === 'review.summary.v1') {
    return {
      ...data,
      mustFixTotal: asArray(data.mustFix).length,
      mustFix: asArray(data.mustFix).slice(0, FACADE_FINDING_SAMPLE_LIMIT).map((finding, index) => compactFacadeFinding(finding, index, 'your_change')),
      preExistingDigest: isRecord(data.preExistingDigest)
        ? { ...data.preExistingDigest, sample: asArray(data.preExistingDigest.sample).slice(0, FACADE_FINDING_SAMPLE_LIMIT).map((finding, index) => compactFacadeFinding(finding, index, 'pre_existing')) }
        : data.preExistingDigest,
    };
  }

  const yours = asArray(data.yours).map((finding, index) => compactFacadeFinding(finding, index, 'your_change'));
  const preExisting = asArray(data.preExisting).map((finding, index) => compactFacadeFinding(finding, index, 'pre_existing'));
  const testResults = asArray(data.testResults);
  const failedSuites = testResults.filter((result) => isRecord(result) && result.passed === false);
  const documentationCheckRan = Object.prototype.hasOwnProperty.call(data, 'documentationOpportunities');
  const documentationOpportunities = asArray(data.documentationOpportunities);
  const checksRun = ['static_rules', 'eslint', 'typecheck', 'spec_compliance'];
  if (documentationCheckRan) checksRun.push('documentation_opportunities');
  if (testResults.length > 0) checksRun.push('tests');
  return {
    schema: 'review.summary.v1',
    base: data.base,
    branch: data.branch,
    files: data.files,
    affectedProjects: data.affectedProjects,
    checksRun,
    summary: {
      yourIssues: yours.length,
      preExistingIssues: preExisting.length,
      failedTestSuites: failedSuites.length,
      blockingIssues: yours.length + failedSuites.length,
      documentationOpportunities: documentationOpportunities.length,
    },
    mustFixTotal: yours.length,
    mustFix: yours.slice(0, FACADE_FINDING_SAMPLE_LIMIT),
    byRule: {
      yourChanges: summarizeFacadeFindings(yours).byRule,
      preExisting: summarizeFacadeFindings(preExisting).byRule,
    },
    byFile: {
      yourChanges: summarizeFacadeFindings(yours).byFile,
      preExisting: summarizeFacadeFindings(preExisting).byFile,
    },
    preExistingDigest: summarizeFacadeFindings(preExisting),
    documentationOpportunities: documentationOpportunities.slice(0, FACADE_FINDING_SAMPLE_LIMIT),
    testSummary: {
      totalSuites: testResults.length,
      passedSuites: testResults.length - failedSuites.length,
      failedSuites: failedSuites.length,
      failures: failedSuites.slice(0, FACADE_FINDING_SAMPLE_LIMIT),
    },
    fullEvidence: {
      command: typeof data.base === 'string' ? `bun run review -- --base ${data.base} --json` : 'bun run review -- --json',
      note: 'Facade compacted full review JSON for agent output. Full raw findings remain available from review --json in the task worktree.',
    },
    confidence: data.confidence ?? null,
  };
}

function compactVerifyData(data: unknown): unknown {
  if (!isRecord(data)) return data;
  const review = isRecord(data.review)
    ? {
      ...data.review,
      data: compactReviewData(data.review.data),
    }
    : data.review;

  return {
    schema: 'verify.summary.v1',
    branch: data.branch,
    base: data.base,
    headSha: data.headSha,
    files: compactVerifyList(data.files),
    review: compactVerifyValue(review),
    db: compactVerifyValue(data.db),
    docs: compactVerifyValue(data.docs),
    passed: data.passed,
    publishValid: data.publishValid,
    mode: data.mode,
    stampPath: data.stampPath,
  };
}

function compactFacadeData(toolName: string, data: unknown): unknown {
  if (toolName === 'review.run') return compactReviewData(data);
  if (toolName === 'verify') return compactVerifyData(data);
  return data;
}

function maybeSyncWorkpadValidation(toolName: string, input: ToolInput, result: ToolResult<unknown>): void {
  const validationTools = ['review.run', 'verify', 'checkFiles', 'audit', 'artifacts.check'];
  const tddPhase = typeof input.tddPhase === 'string' ? input.tddPhase : '';
  if (!validationTools.includes(toolName) && !tddPhase) return;
  const taskWorktree = typeof input.taskWorktree === 'string' ? input.taskWorktree : '';
  const taskBranch = typeof input.branch === 'string' ? input.branch : '';
  if (!taskWorktree || !taskBranch.startsWith('task/')) return;
  try {
    if (tddPhase) {
      syncTddEvidence(taskWorktree, { taskBranch }, {
        phase: tddPhase,
        command: Array.isArray(input.command) ? input.command.join(' ') : toolName,
        ok: result.ok,
        exitCode: result.exitCode,
        traceId: result.traceId,
        output: typeof result.stderr === 'string' && result.stderr ? result.stderr : JSON.stringify(result.data || {}),
      });
    }

    if (validationTools.includes(toolName)) {
      syncValidationEvidence(taskWorktree, { taskBranch }, {
        command: toolName,
        ok: result.ok,
        detail: typeof result.code === 'string' ? result.code : undefined,
      });
    }

    if (toolName === 'verify' && isRecord(result.data) && isRecord(result.data.testSelection)) {
      const testSelection = result.data.testSelection;
      if (isRecord(testSelection.data)) {
        syncTestSelectionEvidence(taskWorktree, { taskBranch }, testSelection.data);
      }
    }
  } catch {
    // Workpad sync is best-effort evidence; tool execution result remains authoritative.
  }
}

function normalizeInput(toolName: string, input: ToolInput): ToolInput {
  if (toolName === "task.start" && !input.area && typeof input.stream === "string") {
    return { ...input, area: input.stream.replace(/^stream\//, "") };
  }
  if (toolName === "fs.http" && !input.method) {
    return { ...input, method: "get" };
  }

  if (toolName === "fs.search" && typeof input.path === "string" && !Array.isArray(input.paths)) {
    const { path: searchPath, ...rest } = input;
    return { ...rest, paths: [searchPath] };
  }

  if (toolName === "fs.read" && Array.isArray(input.files)) {
    return { ...input, filesJson: JSON.stringify(input.files) };
  }

  if (toolName === "review.run") {
    return { ...input, mine: true };
  }

  if (toolName === "media.svg") {
    const normalized: ToolInput = { ...input };
    for (const key of ["document", "operations", "checks", "render", "selectors"] as const) {
      if (normalized[key] !== undefined) normalized[`${key}Json`] = JSON.stringify(normalized[key]);
    }
    return normalized;
  }

  return input;
}

async function executeInternalTool<TData>(
  entry: ToolManifestEntry,
  input: ToolInput,
  context: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    rawInput: ToolInput;
    runner: ToolRunner;
    startedAt: number;
    traceId: string;
    requestId?: string;
    options: ExecuteToolOptions;
  },
): Promise<ToolResult<TData> | null> {
  const internal = entry.command.internal;
  if (!internal) return null;

  try {

  if (internal === 'batch') {
    const steps = Array.isArray(input.steps) ? input.steps : [];
    const result = await runBatch(steps, context.options, {
      taskSession: typeof input.taskSession === 'string' ? input.taskSession : undefined,
      branch: typeof input.branch === 'string' ? input.branch : undefined,
      taskWorktree: typeof input.taskWorktree === 'string' ? input.taskWorktree : undefined,
    }) as ToolResult<TData>;
    logResult(entry, entry.name, result, entry.underlying, undefined, `workspace ${entry.name}`, context.options.logMode, {
      input: context.rawInput,
      resolvedInput: input,
      env: context.env,
    });
    return result;
  }

  if (internal === 'code.call') {
    const codeCallInput = typeof input.timeout === 'number'
      ? input
      : { ...input, timeout: entry.defaultTimeout };
    const result = await executeCodeCall(codeCallInput as CodeCallInput, {
      cwd: context.cwd,
      env: context.env,
      now: context.options.now,
      randomUUID: context.options.randomUUID,
      traceId: context.traceId,
      requestId: context.requestId,
    }) as ToolResult<TData>;
    logResult(entry, entry.name, result, entry.underlying, undefined, `workspace ${entry.name}`, context.options.logMode, {
      input: context.rawInput,
      resolvedInput: codeCallInput,
      env: context.env,
    });
    return result;
  }

  if (internal === 'deployment') {
    const deploymentInput = {
      ...input,
      tool: entry.name,
    } as DeploymentFacadeInput;
    const outcome = await Effect.runPromise(Effect.either(executeDeploymentFacade(deploymentInput)));
    const result = outcome._tag === 'Right'
      ? createToolResult({
        ok: true,
        code: 'OK',
        message: `${entry.name} completed`,
        data: outcome.right,
        durationMs: elapsedMs(context.startedAt, context.options.now),
        traceId: context.traceId,
        requestId: context.requestId,
        now: context.options.now,
      })
      : createToolResult({
        ok: false,
        code: outcome.left.code,
        message: outcome.left.message,
        data: {
          provider: outcome.left.provider,
          operation: outcome.left.operation,
          ...(outcome.left.diagnostics ? { diagnostics: outcome.left.diagnostics } : {}),
          ...(outcome.left.approval ? { approval: outcome.left.approval } : {}),
          ...(outcome.left.recovery ? { recovery: outcome.left.recovery } : {}),
        },
        stderr: '',
        exitCode: 1,
        durationMs: elapsedMs(context.startedAt, context.options.now),
        traceId: context.traceId,
        requestId: context.requestId,
        now: context.options.now,
      });
    const traceInput = redactDeploymentTraceInput(entry.name, context.rawInput);
    const resolvedTraceInput = redactDeploymentTraceInput(entry.name, input);
    logResult(entry, entry.name, result, entry.underlying, undefined, `workspace ${entry.name}`, context.options.logMode, {
      input: traceInput,
      resolvedInput: resolvedTraceInput,
      env: context.env,
    });
    return result as ToolResult<TData>;
  }

  if (internal === 'subagent') {
    return executeSubagent(entry, input, context) as Promise<ToolResult<TData>>;
  }

  if (internal === 'task.current') {
    const scopedBranch = typeof input.branch === 'string' ? input.branch : undefined;
    const scopedWorktree = typeof input.taskWorktree === 'string' ? input.taskWorktree : undefined;
    const scopedTask = scopedBranch && scopedWorktree ? {
      branch: scopedBranch,
      area: getAreaFromBranch(scopedBranch) || 'unknown',
      worktree: scopedWorktree,
    } : null;
    const task = getCurrentTask({
      explicitBranch: scopedBranch,
      cwd: context.cwd,
      env: context.env,
      currentTask: scopedTask ?? context.options.currentTask,
      candidates: scopedTask ? [scopedTask] : context.options.candidates,
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
    logResult(entry, entry.name, result, entry.underlying, task?.branch, undefined, context.options.logMode, {
      input: context.rawInput,
      resolvedInput: input,
      env: context.env,
    });
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
        now: context.options.now,
      });
      logResult(entry, entry.name, result, entry.underlying, undefined, undefined, context.options.logMode, {
        input: context.rawInput,
        resolvedInput: input,
        env: context.env,
      });
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
    logResult(entry, entry.name, result, formatCommandForLog(plan), resolution.branch, `workspace ${entry.name}`, context.options.logMode, {
      input: context.rawInput,
      resolvedInput: { ...input, branch: resolution.branch },
      env: context.env,
    });
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
  logResult(entry, entry.name, result, entry.underlying, undefined, undefined, context.options.logMode, {
    input: context.rawInput,
    resolvedInput: input,
    env: context.env,
  });
  return result as ToolResult<TData>;
  } catch (error: unknown) {
    if (error instanceof Error && !Object.hasOwn(error, 'consueloTool')) {
      Object.defineProperty(error, 'consueloTool', {
        value: entry.name,
        enumerable: false,
        configurable: true,
      });
    }
    throw error;
  }
}


function resolveTaskSessionInput(input: ToolInput, cwd: string, env: NodeJS.ProcessEnv): TaskSessionResolution | null {
  const taskHandle = typeof input.taskSession === 'string' ? input.taskSession.trim() : undefined;
  if (!taskHandle) return null;

  const metadata = findTaskSessionMetadata(cwd, taskHandle, env);
  if (!metadata) return {
    ok: false,
    code: 'TASK_SESSION_NOT_FOUND',
    message: 'taskSession was not found. Pass the taskSession returned by task.start or the matching task branch.',
  };

  const branch = metadata.branch || metadata.taskBranch || '';
  const explicitBranch = typeof input.branch === 'string' ? input.branch : undefined;
  if (explicitBranch && explicitBranch !== branch) return {
    ok: false,
    code: 'VALIDATION_ERROR',
    message: 'input.branch does not match taskSession branch. Pass the taskSession returned by task.start and do not override its branch.',
  };

  return { ok: true, branch, metadata };
}

function resolveWorkSessionInput(
  toolName: string,
  input: ToolInput,
  cwd: string,
  env: NodeJS.ProcessEnv,
): WorkSessionResolution | null {
  const workSession = typeof input.workSession === 'string' ? input.workSession.trim() : '';
  if (!workSession) return null;
  if (!supportsWorkSessionAuthority(toolName)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `${toolName} does not support workSession authority.`,
    };
  }
  if (typeof input.branch === 'string' && input.branch.trim()) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'workSession calls cannot also select a task branch. Use taskSession for repository edits.',
    };
  }
  try {
    const scope = resolveWorkSessionFsScope({
      workSession,
      env,
      managedRepoRoot: cwd,
    });
    return { ok: true, workSession: scope.workSession, root: scope.root };
  } catch (error: unknown) {
    if (error instanceof WorkSessionFsScopeError) {
      return { ok: false, code: error.code, message: error.message };
    }
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: `Unable to validate workSession: ${getErrorMessage(error)}`,
    };
  }
}


function getWorktreeRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKSPACE_WORKTREE_ROOT || env.OPENSAAS_WORKTREE_ROOT || path.join(os.tmpdir(), 'opensaas-worktrees');
}

function isTaskSessionMetadata(value: unknown, expectedTaskHandle: string): value is TaskSessionMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TaskSessionMetadata>;
  const branch = candidate.branch || candidate.taskBranch;
  const handles = [candidate.taskSession, candidate.branch, candidate.taskBranch, candidate.taskId, candidate.id]
    .filter((handle): handle is string => typeof handle === 'string' && handle.length > 0);
  return handles.includes(expectedTaskHandle) && typeof branch === 'string' && branch.length > 0;
}

function addSessionCandidates(candidates: Array<{ path: string; warn: boolean }>, worktreePath: string, warn: boolean): void {
  candidates.push({ path: path.join(worktreePath, '.task', 'session.json'), warn });
  const taskRoot = path.join(worktreePath, '.task');
  if (!fs.existsSync(taskRoot)) return;

  for (const areaEntry of fs.readdirSync(taskRoot, { withFileTypes: true })) {
    if (!areaEntry.isDirectory()) continue;
    if (areaEntry.name === 'tasks' || areaEntry.name === 'reviews') continue;
    const areaPath = path.join(taskRoot, areaEntry.name);
    for (const taskEntry of fs.readdirSync(areaPath, { withFileTypes: true })) {
      if (!taskEntry.isDirectory()) continue;
      candidates.push({ path: path.join(areaPath, taskEntry.name, 'session.json'), warn });
    }
  }
}

function findTaskSessionMetadata(cwd: string, taskSession: string, env: NodeJS.ProcessEnv): TaskSessionMetadata | null {
  try {
    const home = env.CONSUELO_HOME || env.CONSUELO_OS_HOME;
    const registryOptions = home ? { home } : {};
    const durable = readDurableTaskSessionMetadata(taskSession, registryOptions);
    const durableWorktree = durable?.worktreePath || durable?.worktree;
    if (
      durable
      && durable.status === 'active'
      && typeof durableWorktree === 'string'
      && fs.existsSync(durableWorktree)
      && isTaskSessionMetadata(durable, taskSession)
    ) {
      return durable;
    }
    if (durable) {
      const recovered = recoverDurableTaskSession(taskSession, registryOptions);
      if (recovered && isTaskSessionMetadata(recovered, taskSession)) return recovered;
    }
  } catch (error: unknown) {
    process.stderr.write(`warning: failed to recover durable task session ${taskSession}: ${getErrorMessage(error)}\n`);
  }

  const candidates: Array<{ path: string; warn: boolean }> = [];
  addSessionCandidates(candidates, cwd, true);

  if (typeof env.TASK_WORKTREE === 'string' && env.TASK_WORKTREE.length > 0) {
    addSessionCandidates(candidates, env.TASK_WORKTREE, true);
  }

  const home = env.CONSUELO_HOME || env.CONSUELO_OS_HOME;
  const taskWorktreeRoots = Array.from(new Set([
    getTaskWorktreeRoot(undefined, env),
    getWorktreeRoot(env),
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)));
  for (const absoluteWorktreeRoot of taskWorktreeRoots) {
    if (!fs.existsSync(absoluteWorktreeRoot)) continue;
    for (const name of fs.readdirSync(absoluteWorktreeRoot)) {
      if (!name.startsWith('task-')) continue;
      addSessionCandidates(candidates, path.join(absoluteWorktreeRoot, name), false);
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate.path, 'utf8')) as unknown;
      if (isTaskSessionMetadata(parsed, taskSession)) return parsed;
    } catch (error: unknown) {
      if (candidate.warn && fs.existsSync(candidate.path)) {
        process.stderr.write(`warning: failed to parse task session metadata ${candidate.path}: ${getErrorMessage(error)}\n`);
      }
    }
  }

  return null;
}


function resolveBranchIfNeeded(
  entry: ToolManifestEntry,
  input: ToolInput,
  cwd: string,
  env: NodeJS.ProcessEnv,
  options: ExecuteToolOptions,
): BranchResolution {
  if (typeof input.workSessionRoot === 'string' && isWorkSessionFsTool(entry.name)) {
    return { ok: true, branch: '', source: 'work-session' };
  }
  const branchMode = entry.command.branchMode || 'none';
  if (branchMode === 'none') return { ok: true, branch: '', source: 'none' };

  const explicitBranch = typeof input.branch === 'string' ? input.branch : undefined;
  const resolution = (options.branchResolver || resolveTaskBranch)({
    explicitBranch,
    cwd,
    env,
    currentTask: options.currentTask,
    candidates: options.candidates,
  });

  const hasExplicitRepoTarget = Boolean(explicitBranch);
  if (
    branchMode === 'optional'
    && !hasExplicitRepoTarget
    && !resolution.ok
    && (resolution.code === 'WORKTREE_NOT_FOUND' || resolution.code === 'AMBIGUOUS_TASK_SELECTION')
  ) {
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
  if (isWorkSessionFsTool(entry.name) && typeof input.workSessionRoot === 'string') {
    const args = [path.join(runtimePackageRoot, 'scripts', 'fs.js')];
    if (entry.command.subcommand) args.push(entry.command.subcommand);
    for (const argument of entry.command.arguments) appendArgument(args, argument, input);
    if (entry.command.jsonFlag) args.push(entry.command.jsonFlag);
    if (entry.command.dryRunFlag && input.dryRun === true) args.push(entry.command.dryRunFlag);
    return {
      command: 'bun',
      args,
      cwd: input.workSessionRoot,
      env: {
        ...env,
        ...(typeof input.workSession === 'string' ? { WORK_SESSION: input.workSession } : {}),
      },
    };
  }
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
    cwd: entry.command.executionScope === 'runtime' ? runtimePackageRoot : resolveWorkspaceCommandCwd(cwd, script, input),
    env: {
      ...env,
      ...(branch ? { TASK_BRANCH: branch } : {}),
      ...(typeof input.taskWorktree === 'string' ? { TASK_WORKTREE: input.taskWorktree } : {}),
    },
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
    if (argument.flag) {
      for (const item of value) args.push(argument.flag, String(item));
    } else {
      args.push(...value.map(String));
    }
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

function formatCommandForLog(plan: CommandPlan): string {
  return truncateCommandForLog(formatCommand(plan));
}

function formatFacadeCommand(toolName: string, input: ToolInput): string {
  const filtered = Object.fromEntries(
    Object.entries(input).filter(([k]) => k !== 'requestId' && k !== 'timeout'),
  );
  const hasArgs = Object.keys(filtered).length > 0;
  return hasArgs ? `workspace ${toolName} '${JSON.stringify(filtered)}'` : `workspace ${toolName}`;
}

function formatFacadeCommandForLog(toolName: string, input: ToolInput): string {
  return truncateCommandForLog(formatFacadeCommand(toolName, input));
}

function truncateCommandForLog(command: string): string {
  if (command.length <= MAX_LOG_COMMAND_CHARS) return command;
  return `${command.slice(0, MAX_LOG_COMMAND_CHARS)}... [truncated ${command.length - MAX_LOG_COMMAND_CHARS} chars]`;
}

function stripCommandEcho(stderr: string): string {
  return stderr
    .split('\n')
    .filter((line) => !line.startsWith('$ ') || !line.includes('packages/os/scripts/'))
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

function resolveWorkspaceCommandCwd(cwd: string, script: string, input?: ToolInput): string {
  if ((script === 'code-run' || script === 'code-call') && typeof input?.taskWorktree === 'string') return input.taskWorktree;
  if (!script.startsWith('task:') && !script.startsWith('stream:')) return cwd;
  if (typeof input?.taskWorktree === 'string') return input.taskWorktree;
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
  traceContext: {
    input?: unknown;
    resolvedInput?: unknown;
    env?: NodeJS.ProcessEnv;
  } = {},
): void {
  const emit = logMode !== "silent" && !(logMode === "errors" && result.ok);
  const resolvedInput = isRecord(traceContext.resolvedInput) ? traceContext.resolvedInput : {};
  const rawInput = isRecord(traceContext.input) ? traceContext.input : {};
  const taskSession = typeof resolvedInput.taskSession === 'string'
    ? resolvedInput.taskSession
    : typeof rawInput.taskSession === 'string'
      ? rawInput.taskSession
      : undefined;
  const worktree = typeof resolvedInput.taskWorktree === 'string'
    ? resolvedInput.taskWorktree
    : typeof resolvedInput.worktree === 'string'
      ? resolvedInput.worktree
      : undefined;
  const workSession = typeof resolvedInput.workSession === 'string'
    ? resolvedInput.workSession
    : typeof rawInput.workSession === 'string'
      ? rawInput.workSession
      : undefined;
  const workPath = typeof resolvedInput.workSessionRoot === 'string'
    ? resolvedInput.workSessionRoot
    : undefined;
  const mcpTraceId = typeof resolvedInput.mcpTraceId === 'string'
    ? resolvedInput.mcpTraceId
    : typeof resolvedInput.parentTraceId === 'string'
      ? resolvedInput.parentTraceId
      : typeof rawInput.mcpTraceId === 'string'
        ? rawInput.mcpTraceId
        : typeof rawInput.parentTraceId === 'string'
          ? rawInput.parentTraceId
          : undefined;
  const effectiveBranch = branch ?? (typeof resolvedInput.branch === 'string' ? resolvedInput.branch : undefined);

  logToolExecution({
    tool: entry?.name || toolName,
    branch: effectiveBranch,
    command: facadeCommand || `workspace ${entry?.name || toolName}`,
    implementationCommand: implementationCommand || undefined,
    durationMs: result.durationMs,
    exitCode: result.exitCode,
    traceId: result.traceId,
    requestId: result.requestId,
    ok: result.ok,
    code: result.code,
    taskSession,
    worktree,
    workSession,
    workPath,
    mcpTraceId,
    input: traceContext.input,
    resolvedInput: traceContext.resolvedInput,
    result,
    stderr: result.stderr,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    env: traceContext.env,
    emit,
    capabilities: {
      readOnly: entry?.capabilities.readOnly ?? true,
      mutating: entry?.capabilities.mutating ?? false,
    },
  });
}

