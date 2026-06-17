import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createToolResult, createTraceId, getErrorMessage } from '../facade/errors';
import type { CodeCallContext, CodeCallData, CodeCallInput, CodeCallLanguage, CodeCallMistakeClass, CodeCallMode, CodeCallResult } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESULT_CHARS = 20_000;
const DIR_SNAPSHOT_FILE_LIMIT = 1000;

const LANGUAGE_ALIASES: Record<string, CodeCallLanguage> = {
  py: 'python',
  python: 'python',
  python3: 'python',
  bun: 'bun',
  node: 'bun',
  javascript: 'bun',
  typescript: 'bun',
  js: 'bun',
  ts: 'bun',
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
};

type ValidationFailure = {
  message: string;
  detectedMistakeClass: CodeCallMistakeClass;
};

type ResolvedCwd = {
  cwd: string;
  allowedRoots: string[];
};

type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  runtimeMissing: boolean;
};

type Snapshot =
  | { kind: 'git'; root: string; files: Map<string, string> }
  | { kind: 'dir'; root: string; files: Map<string, string> }
  | { kind: 'none'; root: string };

function elapsedMs(startedAt: number, now?: () => number): number {
  return Math.max(0, (now || Date.now)() - startedAt);
}

function normalizeLanguage(language: string): CodeCallLanguage | null {
  return LANGUAGE_ALIASES[language.trim().toLowerCase()] || null;
}

function runtimeForLanguage(language: CodeCallLanguage): string {
  if (language === 'python') return 'python3';
  if (language === 'bun') return 'bun';
  return 'bash';
}

function extensionForLanguage(language: CodeCallLanguage): string {
  if (language === 'python') return 'py';
  if (language === 'bun') return 'ts';
  return 'sh';
}

function realpathIfExists(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function isInsidePath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isManagedTaskWorktreePath(candidate: string): boolean {
  const resolved = realpathIfExists(candidate);
  const worktreeRoot = path.basename(path.dirname(resolved));
  const worktreeName = path.basename(resolved);

  return worktreeRoot === 'opensaas-worktrees' && worktreeName.startsWith('task-');
}

function findGitRoot(cwd: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function uniqueRealRoots(values: Array<string | undefined | null>): string[] {
  const roots: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const resolved = realpathIfExists(value);
    if (!roots.includes(resolved)) roots.push(resolved);
  }
  return roots;
}

function resolveSafeCwd(input: CodeCallInput, contextCwd: string): ResolvedCwd | ValidationFailure {
  const defaultCwd = path.resolve(input.taskWorktree || contextCwd);
  const requested = input.cwd
    ? path.resolve(path.isAbsolute(input.cwd) ? input.cwd : path.join(defaultCwd, input.cwd))
    : defaultCwd;

  try {
    if (!statSync(requested).isDirectory()) {
      return { message: `cwd is not a directory: ${input.cwd || requested}`, detectedMistakeClass: 'cwd_out_of_scope' };
    }
  } catch {
    return { message: `cwd does not exist: ${input.cwd || requested}`, detectedMistakeClass: 'cwd_out_of_scope' };
  }

  const resolvedCwd = realpathIfExists(requested);
  const roots = uniqueRealRoots([
    defaultCwd,
    input.taskWorktree,
    findGitRoot(defaultCwd),
    tmpdir(),
  ]);

  if (!roots.some((root) => isInsidePath(resolvedCwd, root))) {
    return {
      message: `cwd is outside approved workspace and temp roots: ${input.cwd || requested}`,
      detectedMistakeClass: 'cwd_out_of_scope',
    };
  }

  return { cwd: resolvedCwd, allowedRoots: roots };
}

function resolveSafeFile(filePath: string, cwd: string, allowedRoots: string[]): string | ValidationFailure {
  const candidate = path.resolve(path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath));
  const resolved = realpathIfExists(candidate);
  if (!allowedRoots.some((root) => isInsidePath(resolved, root))) {
    return {
      message: `file is outside approved workspace and temp roots: ${filePath}`,
      detectedMistakeClass: 'cwd_out_of_scope',
    };
  }
  try {
    if (!statSync(resolved).isFile()) {
      return { message: `file must be a regular file: ${filePath}`, detectedMistakeClass: 'invalid_source' };
    }
  } catch {
    return { message: `file does not exist: ${filePath}`, detectedMistakeClass: 'invalid_source' };
  }
  return resolved;
}

function validateSourceInputs(input: CodeCallInput): ValidationFailure | null {
  const hasCode = typeof input.code === 'string' && input.code.length > 0;
  const hasCodeFile = typeof input.codeFile === 'string' && input.codeFile.length > 0;
  if (hasCode === hasCodeFile) {
    return {
      message: 'provide exactly one of code or codeFile',
      detectedMistakeClass: 'invalid_source',
    };
  }

  const hasStdin = typeof input.stdin === 'string';
  const hasStdinFile = typeof input.stdinFile === 'string' && input.stdinFile.length > 0;
  if (hasStdin && hasStdinFile) {
    return {
      message: 'provide at most one of stdin or stdinFile',
      detectedMistakeClass: 'invalid_source',
    };
  }

  return null;
}

function validateEditScope(input: CodeCallInput, resolvedCwd: string): ValidationFailure | null {
  const taskWorktree = typeof input.taskWorktree === 'string' && input.taskWorktree.trim().length > 0
    ? input.taskWorktree
    : isManagedTaskWorktreePath(resolvedCwd)
      ? resolvedCwd
      : undefined;

  if (!taskWorktree) {
    return {
      message: 'mode=edit requires taskSession or an explicit taskWorktree.',
      detectedMistakeClass: 'edit_without_task',
    };
  }

  const resolvedTaskWorktree = realpathIfExists(taskWorktree);

  if (!isInsidePath(resolvedCwd, resolvedTaskWorktree)) {
    return {
      message: 'mode=edit cwd must be inside the explicit taskWorktree.',
      detectedMistakeClass: 'edit_mode_gated',
    };
  }

  const branch = typeof input.branch === 'string' ? input.branch : '';

  if (branch && !branch.startsWith('task/')) {
    return {
      message: 'mode=edit refuses non-task branches. Pass a taskSession or task worktree for isolated edits.',
      detectedMistakeClass: 'edit_mode_gated',
    };
  }

  return null;
}

function detectTransportMistake(source: string, language: CodeCallLanguage): ValidationFailure | null {
  const trimmed = source.trim();
  if (/^python3?\s+-c\b/.test(trimmed)) {
    return {
      message: 'Send raw multiline Python in code instead of wrapping it in python3 -c shell transport.',
      detectedMistakeClass: 'shell_escaped_code',
    };
  }
  if (/^(node|bun)\s+(-e|--eval)\b/.test(trimmed)) {
    return {
      message: 'Send raw JavaScript or TypeScript in code with language="bun" instead of node -e or bun -e shell transport.',
      detectedMistakeClass: 'shell_escaped_code',
    };
  }
  if (/^bash\s+-lc\b/.test(trimmed) || /(python3?|node|bun)\s+-[^\n]*<<['"]?[A-Z]/.test(trimmed)) {
    return {
      message: 'Send the inner program through code, codeFile, stdin, or stdinFile instead of an execution heredoc wrapper.',
      detectedMistakeClass: 'shell_escaped_code',
    };
  }
  if (/base64\s+(-d|--decode)|Buffer\.from\([^)]*base64|atob\(/s.test(trimmed)) {
    return {
      message: 'Send large payloads through codeFile or stdinFile instead of manual base64 transport.',
      detectedMistakeClass: 'shell_escaped_code',
    };
  }
  if (language === 'bash' && /(rm\s+-rf\s+\/|git\s+reset\s+--hard|curl\s+[^|]+\|\s*(sh|bash))/.test(trimmed)) {
    return {
      message: 'Bash code.call blocks destructive shell patterns. Use a typed workspace tool or a narrower command.',
      detectedMistakeClass: 'unsafe_shell',
    };
  }
  return null;
}

function stageSource(source: string, language: CodeCallLanguage, traceId: string): { stageDir: string; sourcePath: string } {
  const stageRoot = path.join(tmpdir(), 'opensaas-code-call');
  mkdirSync(stageRoot, { recursive: true });
  const stageDir = mkdtempSync(path.join(stageRoot, `${traceId}-`));
  const sourcePath = path.join(stageDir, `program.${extensionForLanguage(language)}`);
  const stagedSource = language === 'bash' && !source.trimStart().startsWith('set ')
    ? `set -euo pipefail\n${source}`
    : source;
  writeFileSync(sourcePath, stagedSource, 'utf8');
  return { stageDir, sourcePath };
}

function parsePorcelain(stdout: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    const rawPath = line.slice(3).replace(/^"|"$/g, '');
    const normalizedPath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) || rawPath : rawPath;
    files.set(normalizedPath, line.slice(0, 2));
  }
  return files;
}

function captureGitSnapshot(cwd: string): Snapshot | null {
  const root = findGitRoot(cwd);
  if (!root) return null;
  try {
    const stdout = execFileSync('git', ['status', '--porcelain', '-uall'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { kind: 'git', root, files: parsePorcelain(stdout) };
  } catch {
    return { kind: 'none', root: cwd };
  }
}

function captureDirectorySnapshot(root: string): Snapshot {
  const files = new Map<string, string>();
  let count = 0;
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      count += 1;
      if (count > DIR_SNAPSHOT_FILE_LIMIT) throw new Error('directory snapshot limit exceeded');
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const stat = statSync(absolute);
      files.set(relative, `${stat.size}:${stat.mtimeMs}`);
    }
  };

  try {
    walk(root);
    return { kind: 'dir', root, files };
  } catch {
    return { kind: 'none', root };
  }
}

function captureSnapshot(cwd: string): Snapshot {
  return captureGitSnapshot(cwd) || captureDirectorySnapshot(cwd);
}

function changedFiles(before: Snapshot, after: Snapshot): string[] {
  if (before.kind === 'none' || after.kind === 'none') return [];
  if (before.kind !== after.kind || before.root !== after.root) return [];

  const changed = new Set<string>();
  for (const [file, marker] of after.files) {
    if (before.files.get(file) !== marker) changed.add(file);
  }
  for (const file of before.files.keys()) {
    if (!after.files.has(file)) changed.add(file);
  }
  return [...changed].sort();
}

function runRuntime(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; stdin?: string; timeoutMs: number }): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const finish = (result: RunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error: NodeJS.ErrnoException) => {
      finish({
        stdout,
        stderr: stderr || getErrorMessage(error),
        exitCode: 1,
        timedOut: false,
        runtimeMissing: error.code === 'ENOENT',
      });
    });
    child.on('close', (code) => {
      finish({ stdout, stderr, exitCode: code ?? 0, timedOut, runtimeMissing: false });
    });
    child.stdin.end(options.stdin || '');
  });
}

function writeFullLog(stageDir: string, name: string, value: string): string {
  const logPath = path.join(stageDir, name);
  writeFileSync(logPath, value, 'utf8');
  return logPath;
}

function truncateOutput(stageDir: string, stdout: string, stderr: string, maxResultChars: number): {
  stdout: string;
  stderr: string;
  truncated: boolean;
  stdoutLogPath?: string;
  stderrLogPath?: string;
} {
  const result = { stdout, stderr, truncated: false, stdoutLogPath: undefined as string | undefined, stderrLogPath: undefined as string | undefined };
  if (stdout.length > maxResultChars) {
    result.stdoutLogPath = writeFullLog(stageDir, 'stdout.log', stdout);
    result.stdout = stdout.slice(0, maxResultChars);
    result.truncated = true;
  }
  if (stderr.length > maxResultChars) {
    result.stderrLogPath = writeFullLog(stageDir, 'stderr.log', stderr);
    result.stderr = stderr.slice(0, maxResultChars);
    result.truncated = true;
  }
  return result;
}

function runtimeEnv(input: CodeCallInput, baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    ...(typeof input.branch === 'string' && input.branch ? { TASK_BRANCH: input.branch } : {}),
    ...(typeof input.taskWorktree === 'string' && input.taskWorktree ? { TASK_WORKTREE: input.taskWorktree } : {}),
  };
}

function buildData(input: {
  ok: boolean;
  exitCode: number;
  language: CodeCallLanguage;
  requestedLanguage?: string;
  runtime: string;
  mode: CodeCallMode;
  cwd: string;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  filesChanged?: string[];
  truncated?: boolean;
  traceId: string;
  message?: string;
  code?: string;
  detectedMistakeClass?: CodeCallMistakeClass;
  stdoutLogPath?: string;
  stderrLogPath?: string;
}): CodeCallData {
  return {
    ok: input.ok,
    exitCode: input.exitCode,
    language: input.language,
    ...(input.requestedLanguage && input.requestedLanguage !== input.language ? { requestedLanguage: input.requestedLanguage } : {}),
    runtime: input.runtime,
    mode: input.mode,
    cwd: input.cwd,
    durationMs: input.durationMs,
    stdout: input.stdout || '',
    stderr: input.stderr || '',
    filesChanged: input.filesChanged || [],
    truncated: input.truncated || false,
    traceId: input.traceId,
    ...(input.message ? { message: input.message } : {}),
    ...(input.code ? { code: input.code } : {}),
    ...(input.detectedMistakeClass ? { detectedMistakeClass: input.detectedMistakeClass } : {}),
    ...(input.stdoutLogPath ? { stdoutLogPath: input.stdoutLogPath } : {}),
    ...(input.stderrLogPath ? { stderrLogPath: input.stderrLogPath } : {}),
  };
}

function failureResult(input: {
  envelopeCode: 'CODE_CALL_VALIDATION_ERROR' | 'COMMAND_FAILED' | 'TIMEOUT';
  message: string;
  detectedMistakeClass: CodeCallMistakeClass;
  language: CodeCallLanguage;
  requestedLanguage?: string;
  runtime: string;
  mode: CodeCallMode;
  cwd: string;
  startedAt: number;
  traceId: string;
  requestId?: string;
  now?: () => number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  filesChanged?: string[];
  truncated?: boolean;
  stdoutLogPath?: string;
  stderrLogPath?: string;
}): CodeCallResult {
  const durationMs = elapsedMs(input.startedAt, input.now);
  return createToolResult({
    ok: false,
    code: input.envelopeCode,
    message: input.message,
    data: buildData({
      ok: false,
      exitCode: input.exitCode ?? 1,
      language: input.language,
      requestedLanguage: input.requestedLanguage,
      runtime: input.runtime,
      mode: input.mode,
      cwd: input.cwd,
      durationMs,
      stdout: input.stdout,
      stderr: input.stderr,
      filesChanged: input.filesChanged,
      truncated: input.truncated,
      traceId: input.traceId,
      message: input.message,
      code: input.envelopeCode,
      detectedMistakeClass: input.detectedMistakeClass,
      stdoutLogPath: input.stdoutLogPath,
      stderrLogPath: input.stderrLogPath,
    }),
    stderr: input.stderr,
    exitCode: input.exitCode ?? 1,
    durationMs,
    traceId: input.traceId,
    requestId: input.requestId,
    now: input.now,
  });
}

export async function executeCodeCall(input: CodeCallInput, context: CodeCallContext = {}): Promise<CodeCallResult> {
  const startedAt = (context.now || Date.now)();
  const traceId = context.traceId || createTraceId(context.randomUUID);
  const requestId = input.requestId || context.requestId;
  const requestedLanguage = input.language;
  const language = normalizeLanguage(requestedLanguage);
  const mode = input.mode;
  const fallbackLanguage = language || 'python';
  const contextCwd = context.cwd || process.cwd();
  const runtime = language ? runtimeForLanguage(language) : '';

  if (!language) {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: `unsupported language: ${requestedLanguage}`,
      detectedMistakeClass: 'unsupported_language',
      language: fallbackLanguage,
      requestedLanguage,
      runtime,
      mode,
      cwd: '',
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  const cwdResolution = resolveSafeCwd(input, contextCwd);
  if ('detectedMistakeClass' in cwdResolution) {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: cwdResolution.message,
      detectedMistakeClass: cwdResolution.detectedMistakeClass,
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd: '',
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  if (mode === 'edit') {
    const editScopeFailure = validateEditScope(input, cwdResolution.cwd);
    if (editScopeFailure) {
      return failureResult({
        envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
        message: editScopeFailure.message,
        detectedMistakeClass: editScopeFailure.detectedMistakeClass,
        language,
        requestedLanguage,
        runtime,
        mode,
        cwd: cwdResolution.cwd,
        startedAt,
        traceId,
        requestId,
        now: context.now,
      });
    }
  }

  if (mode === 'edit' && input.dryRun === true) {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: 'mode=edit does not support dryRun. Use mode=verify for non-mutating validation.',
      detectedMistakeClass: 'edit_mode_gated',
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd: cwdResolution.cwd,
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  const sourceFailure = validateSourceInputs(input);
  if (sourceFailure) {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: sourceFailure.message,
      detectedMistakeClass: sourceFailure.detectedMistakeClass,
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd: cwdResolution.cwd,
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  const sourcePath = input.codeFile ? resolveSafeFile(input.codeFile, cwdResolution.cwd, cwdResolution.allowedRoots) : null;
  if (sourcePath && typeof sourcePath !== 'string') {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: sourcePath.message,
      detectedMistakeClass: sourcePath.detectedMistakeClass,
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd: cwdResolution.cwd,
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  const stdinPath = input.stdinFile ? resolveSafeFile(input.stdinFile, cwdResolution.cwd, cwdResolution.allowedRoots) : null;
  if (stdinPath && typeof stdinPath !== 'string') {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: stdinPath.message,
      detectedMistakeClass: stdinPath.detectedMistakeClass,
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd: cwdResolution.cwd,
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  const source = typeof input.code === 'string' ? input.code : readFileSync(sourcePath as string, 'utf8');
  const stdin = typeof input.stdin === 'string'
    ? input.stdin
    : stdinPath
      ? readFileSync(stdinPath, 'utf8')
      : undefined;
  const transportFailure = detectTransportMistake(source, language);
  if (transportFailure) {
    return failureResult({
      envelopeCode: 'CODE_CALL_VALIDATION_ERROR',
      message: transportFailure.message,
      detectedMistakeClass: transportFailure.detectedMistakeClass,
      language,
      requestedLanguage,
      runtime,
      mode,
      cwd: cwdResolution.cwd,
      startedAt,
      traceId,
      requestId,
      now: context.now,
    });
  }

  const staged = stageSource(source, language, traceId);
  let keepStageDir = false;
  try {
    const before = captureSnapshot(cwdResolution.cwd);
    const timeoutMs = input.timeout ?? DEFAULT_TIMEOUT_MS;
    const run = await runRuntime(runtime, [staged.sourcePath], {
      cwd: cwdResolution.cwd,
      env: runtimeEnv(input, context.env || process.env),
      stdin,
      timeoutMs,
    });
    const after = captureSnapshot(cwdResolution.cwd);
    const filesChanged = changedFiles(before, after);
    const output = truncateOutput(staged.stageDir, run.stdout, run.stderr, input.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS);
    keepStageDir = output.truncated;

    if (run.timedOut) {
      return failureResult({
        envelopeCode: 'TIMEOUT',
        message: `code.call timed out after ${timeoutMs}ms`,
        detectedMistakeClass: 'timeout',
        language,
        requestedLanguage,
        runtime,
        mode,
        cwd: cwdResolution.cwd,
        startedAt,
        traceId,
        requestId,
        now: context.now,
        exitCode: 1,
        stdout: output.stdout,
        stderr: output.stderr,
        filesChanged,
        truncated: output.truncated,
        stdoutLogPath: output.stdoutLogPath,
        stderrLogPath: output.stderrLogPath,
      });
    }

    if (run.runtimeMissing) {
      return failureResult({
        envelopeCode: 'COMMAND_FAILED',
        message: `runtime is missing: ${runtime}`,
        detectedMistakeClass: 'runtime_missing',
        language,
        requestedLanguage,
        runtime,
        mode,
        cwd: cwdResolution.cwd,
        startedAt,
        traceId,
        requestId,
        now: context.now,
        exitCode: 1,
        stdout: output.stdout,
        stderr: output.stderr,
        filesChanged,
        truncated: output.truncated,
        stdoutLogPath: output.stdoutLogPath,
        stderrLogPath: output.stderrLogPath,
      });
    }

    if (filesChanged.length > 0 && mode !== 'edit') {
      return failureResult({
        envelopeCode: 'COMMAND_FAILED',
        message: `${mode} mode changed files; use an edit-capable task workflow for mutations.`,
        detectedMistakeClass: 'mutation_in_read_mode',
        language,
        requestedLanguage,
        runtime,
        mode,
        cwd: cwdResolution.cwd,
        startedAt,
        traceId,
        requestId,
        now: context.now,
        exitCode: 1,
        stdout: output.stdout,
        stderr: output.stderr,
        filesChanged,
        truncated: output.truncated,
        stdoutLogPath: output.stdoutLogPath,
        stderrLogPath: output.stderrLogPath,
      });
    }

    const ok = run.exitCode === 0;
    const durationMs = elapsedMs(startedAt, context.now);
    return createToolResult({
      ok,
      code: ok ? 'OK' : 'COMMAND_FAILED',
      message: ok ? 'code.call completed' : 'code.call command failed',
      data: buildData({
        ok,
        exitCode: run.exitCode,
        language,
        requestedLanguage,
        runtime,
        mode,
        cwd: cwdResolution.cwd,
        durationMs,
        stdout: output.stdout,
        stderr: output.stderr,
        filesChanged,
        truncated: output.truncated,
        traceId,
        message: ok ? undefined : 'runtime exited non-zero',
        code: ok ? undefined : 'COMMAND_FAILED',
        stdoutLogPath: output.stdoutLogPath,
        stderrLogPath: output.stderrLogPath,
      }),
      stderr: output.stderr,
      exitCode: run.exitCode,
      durationMs,
      traceId,
      requestId,
      now: context.now,
    });
  } finally {
    if (!keepStageDir) rmSync(staged.stageDir, { recursive: true, force: true });
  }
}
