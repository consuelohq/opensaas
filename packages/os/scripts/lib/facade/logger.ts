import { redactJson } from '../redaction';
import { recordToolTraceSafely, type TraceEnvironment } from '../trace-persistence';
import type { ToolCapabilities } from './types';

export type LogEntry = {
  level: 'info' | 'warn' | 'error' | 'debug';
  tool: string;
  branch?: string;
  command: string;
  implementationCommand?: string;
  durationMs?: number;
  exitCode?: number;
  traceId: string;
  requestId?: string;
  event?: string;
  message: string;
  capabilities?: Pick<ToolCapabilities, 'readOnly' | 'mutating'>;
  ok?: boolean;
  code?: string;
  ts?: string;
};

export function log(entry: Omit<LogEntry, 'ts'>): void {
  const line = JSON.stringify(redactJson({ ...entry, ts: new Date().toISOString() }));
  process.stderr.write(`${line}\n`);
}

export function logToolExecution(entry: {
  tool: string;
  branch?: string;
  taskSession?: string;
  worktree?: string;
  mcpTraceId?: string;
  command: string;
  implementationCommand?: string;
  durationMs: number;
  exitCode: number;
  traceId: string;
  requestId?: string;
  ok: boolean;
  code: string;
  capabilities: Pick<ToolCapabilities, 'readOnly' | 'mutating'>;
  input?: unknown;
  resolvedInput?: unknown;
  result?: unknown;
  stderr?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  env?: TraceEnvironment;
  emit?: boolean;
}): void {
  if (entry.emit !== false) {
    log({
      level: entry.ok ? 'info' : 'error',
      tool: entry.tool,
      branch: entry.branch,
      command: entry.command,
      implementationCommand: entry.implementationCommand,
      durationMs: entry.durationMs,
      exitCode: entry.exitCode,
      traceId: entry.traceId,
      requestId: entry.requestId,
      ok: entry.ok,
      code: entry.code,
      capabilities: entry.capabilities,
      event: 'tool.executed',
      message: 'tool.executed',
    });
  }

  recordToolTraceSafely({
    traceId: entry.traceId,
    mcpTraceId: entry.mcpTraceId,
    source: 'facade',
    tool: entry.tool,
    taskSession: entry.taskSession,
    branch: entry.branch,
    worktree: entry.worktree,
    status: entry.ok ? 'ok' : 'error',
    ok: entry.ok,
    code: entry.code,
    exitCode: entry.exitCode,
    durationMs: entry.durationMs,
    input: entry.input,
    resolvedInput: entry.resolvedInput,
    result: entry.result,
    stderr: entry.stderr,
    inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens,
    totalTokens: entry.totalTokens,
  }, { env: entry.env });
}
