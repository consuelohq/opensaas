import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import manifestJson from '../../../tooling/tool-manifest.json';

import { getCurrentTask, getAreaFromBranch, resolveTaskBranch } from './branch-resolver';
import { createToolResult, createTraceId, getErrorMessage, isTimeoutError, isToolResult } from './errors';
import { logToolExecution } from './logger';
import { getInputSchema } from './schemas';
import { executeCodeCall } from '../code-call/runtime';
import type { CodeCallInput } from '../code-call/types';
import { executeWorkerCall } from '../worker/runtime';

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
const { resolvePrRefNumber } = require('../pr-ref');
const { syncTddEvidence, syncTestSelectionEvidence, syncValidationEvidence } = require('../task-workpad');

export const manifestEntries = manifestJson as ToolManifestEntry[];

type TaskSessionMetadata = {
  taskSession: string;
  tmuxSession?: string;
  branch?: string;
  taskBranch?: string;
  worktree?: string;
  worktreePath?: string;
};
type TaskSessionResolution =
  | { ok: true; branch: string; metadata: TaskSessionMetadata }
  | { ok: false; code: 'TASK_SESSION_NOT_FOUND' | 'VALIDATION_ERROR'; message: string };

const MAX_LOG_COMMAND_CHARS = 4000;

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
      'fs.patch is not a workspace tool; use fs.apply_patch instead.',
      'Call it with exactly one of patchText or patchFile.',
      'The fs.apply_patch manifest entry is included at data.manifestEntry.',
    ].join(' '),
    data: {
      requestedTool: 'fs.patch',
      replacementTool: 'fs.apply_patch',
      action: 'Call workspace fs.apply_patch with exactly one of patchText or patchFile.',
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
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode);
      return result as ToolResult<TData>;
    }
    if (entry.sessionRequired === true && !taskSessionResolution?.ok) {
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
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode);
      return result as ToolResult<TData>;
    }
    const scopedInput = taskSessionResolution?.ok ? {
      ...normalizedInput,
      branch: taskSessionResolution.branch,
      taskWorktree: taskSessionResolution.metadata.worktree || taskSessionResolution.metadata.worktreePath,
    } : normalizedInput;

    const internalResult = await executeInternalTool<TData>(entry, scopedInput, {
      cwd,
      env,
      runner,
      startedAt,
      traceId,
      requestId,
      options,
    });
    if (internalResult) return internalResult;

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
      logResult(entry, toolName, result, entry.underlying, undefined, `workspace ${toolName}`, options.logMode);
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
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode);
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
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode);
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
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode);
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
      logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode);
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
    logResult(entry, toolName, result, plannedCommandForLog, branchResolution.branch, facadeCmdForLog, options.logMode);
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
    logResult(entry, toolName, result, entry?.underlying || '', undefined, undefined, options.logMode);
    return result as ToolResult<TData>;
  }
}


type JsonRecord = Record<string, unknown>;

const FACADE_FINDING_SAMPLE_LIMIT = 8;
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
  return {
    schema: 'review.summary.v1',
    base: data.base,
    branch: data.branch,
    files: data.files,
    affectedProjects: data.affectedProjects,
    checksRun: testResults.length > 0
      ? ['static_rules', 'eslint', 'typecheck', 'spec_compliance', 'tests']
      : ['static_rules', 'eslint', 'typecheck', 'spec_compliance'],
    summary: {
      yourIssues: yours.length,
      preExistingIssues: preExisting.length,
      failedTestSuites: failedSuites.length,
      blockingIssues: yours.length + failedSuites.length,
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
  if (!isRecord(data) || !isRecord(data.review)) return data;
  return {
    ...data,
    review: {
      ...data.review,
      data: compactReviewData(data.review.data),
    },
  };
}

function compactFacadeData(toolName: string, data: unknown): unknown {
  if (toolName === 'review.run') return compactReviewData(data);
  if (toolName === 'verify') return compactVerifyData(data);
  return data;
}

function maybeSyncWorkpadValidation(toolName: string, input: ToolInput, result: ToolResult<unknown>): void {
  const validationTools = ['review.run', 'verify', 'checkFiles', 'audit', 'office.check'];
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
    return { ...input, paths: [input.path] };
  }

  if (toolName === "fs.read" && Array.isArray(input.files)) {
    return { ...input, filesJson: JSON.stringify(input.files) };
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

  if (internal === 'code.call') {
    return executeCodeCall(input as CodeCallInput, {
      cwd: context.cwd,
      env: context.env,
      now: context.options.now,
      randomUUID: context.options.randomUUID,
      traceId: context.traceId,
      requestId: context.requestId,
    }) as Promise<ToolResult<TData>>;
  }

  if (internal === 'worker.call') {
    return executeWorkerCall(entry, input, context) as Promise<ToolResult<TData>>;
  }

  if (internal === 'task.current') {
    const task = getCurrentTask({
      cwd: context.cwd,
      env: context.env,
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
    logResult(entry, entry.name, result, formatCommandForLog(plan), resolution.branch, `workspace ${entry.name}`, context.options.logMode);
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


function resolveTaskSessionInput(input: ToolInput, cwd: string, env: NodeJS.ProcessEnv): TaskSessionResolution | null {
  const taskSession = typeof input.taskSession === 'string' ? input.taskSession : undefined;
  if (!taskSession) return null;

  const metadata = findTaskSessionMetadata(cwd, taskSession, env);
  if (!metadata) return {
    ok: false,
    code: 'TASK_SESSION_NOT_FOUND',
    message: 'taskSession was not found. Use the taskSession returned by task.start and avoid root task pin fallback.',
  };

  const branch = metadata.branch || metadata.taskBranch;
  if (typeof input.branch === 'string' && input.branch !== branch) return {
    ok: false,
    code: 'VALIDATION_ERROR',
    message: 'Pass either taskSession or a matching explicit branch, not a conflicting branch.',
  };

  return { ok: true, branch, metadata };
}


function getWorktreeRoot(env: NodeJS.ProcessEnv = process.env): string {
  return env.WORKSPACE_WORKTREE_ROOT || env.OPENSAAS_WORKTREE_ROOT || path.join(os.tmpdir(), 'opensaas-worktrees');
}

function isTaskSessionMetadata(value: unknown, expectedTaskSession: string): value is TaskSessionMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TaskSessionMetadata>;
  const branch = candidate.branch || candidate.taskBranch;
  return candidate.taskSession === expectedTaskSession && typeof branch === 'string' && branch.length > 0;
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
  const candidates: Array<{ path: string; warn: boolean }> = [];
  addSessionCandidates(candidates, cwd, true);

  if (typeof env.TASK_WORKTREE === 'string' && env.TASK_WORKTREE.length > 0) {
    addSessionCandidates(candidates, env.TASK_WORKTREE, true);
  }

  const absoluteWorktreeRoot = getWorktreeRoot(env);
  if (fs.existsSync(absoluteWorktreeRoot)) {
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
  const branchMode = entry.command.branchMode || 'none';
  if (branchMode === 'none') return { ok: true, branch: '', source: 'none' };

  const explicitBranch = typeof input.branch === 'string' ? input.branch : undefined;
  const prReference = input.github ?? input.pr;
  const explicitPrNumber = typeof prReference === 'string' || typeof prReference === 'number'
    ? resolvePrRefNumber(String(prReference))
    : undefined;
  const resolution = (options.branchResolver || resolveTaskBranch)({
    explicitBranch,
    explicitPrNumber,
    cwd,
    env,
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
    cwd: resolveWorkspaceCommandCwd(cwd, script, input),
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

  if (kind === 'readFileArray') {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      if (typeof item === 'string') {
        args.push(item);
        continue;
      }
      if (typeof item !== 'object' || item === null) continue;
      const file = item as Record<string, unknown>;
      if (typeof file.path !== 'string' || file.path.length === 0) continue;
      args.push(file.path);
      for (const [source, flag] of [['offset', '--offset'], ['limit', '--limit'], ['from', '--from'], ['to', '--to']] as const) {
        if (typeof file[source] === 'number') args.push(flag, String(file[source]));
      }
    }
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

function resolveWorkspaceCommandCwd(cwd: string, script: string, input?: ToolInput): string {
  if ((script === 'code-run' || script === 'code-call') && typeof input?.taskWorktree === 'string') return input.taskWorktree;
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
