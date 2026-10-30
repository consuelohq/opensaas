import { redactJson } from '../redaction';
import { measureTracePayloadUsage } from '../trace-token-usage';
import { currentTraceRoutingContext } from '../trace-routing-context';
import { loadNodeYamlConfig, resolveConsueloHomeLayout } from '../consuelo-home';
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
  workSession?: string;
  workPath?: string;
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

  const usage = measureTracePayloadUsage(entry.input, entry.result, {
    inputTokens: entry.inputTokens, outputTokens: entry.outputTokens, totalTokens: entry.totalTokens,
  });
  let routing = currentTraceRoutingContext();
  // CLI-backed calls can cross a process boundary without AsyncLocalStorage.
  // The installed identity still proves which node executed this facade call.
  if (!routing?.resolvedNodeId) {
    try {
      const layout = resolveConsueloHomeLayout(
        entry.env?.CONSUELO_HOME ?? entry.env?.CONSUELO_OS_HOME,
      );
      const { node } = loadNodeYamlConfig(layout.nodeConfigPath);
      routing = {
        ...routing,
        resolvedNodeId: node.id,
        resolvedNodeName: node.name,
        routeSource: routing?.routeSource ?? 'local',
      };
    } catch {
      // Calls before provisioning or with an unreadable identity remain unknown.
    }
  }
  recordToolTraceSafely({
    traceId: entry.traceId,
    mcpTraceId: entry.mcpTraceId,
    source: 'facade',
    tool: entry.tool,
    taskSession: entry.taskSession,
    branch: entry.branch,
    worktree: entry.worktree,
    workSession: entry.workSession,
    workPath: entry.workPath,
    status: entry.ok ? 'ok' : 'error',
    ok: entry.ok,
    code: entry.code,
    exitCode: entry.exitCode,
    durationMs: entry.durationMs,
    input: entry.input,
    resolvedInput: entry.resolvedInput,
    result: entry.result,
    stderr: entry.stderr,
    inputTokens: usage.input ?? undefined,
    outputTokens: usage.output ?? undefined,
    totalTokens: usage.total ?? undefined,
    routing,
  }, { env: entry.env });
}
