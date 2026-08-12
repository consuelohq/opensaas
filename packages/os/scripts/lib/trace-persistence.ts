import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

import type { AuthenticatedMcpAuthMode } from '../server/security/authenticated-principal';
import { expandHome, resolveConsueloHomeLayout } from './consuelo-home';
import { redactJson, redactTraceJson, redactTraceText } from './redaction';
import type { TraceRoutingContext } from './trace-routing-context';

const require = createRequire(import.meta.url);
let persistenceWarningEmitted = false;

export type TraceEnvironment = Record<string, string | undefined>;

export type ToolTraceInput = {
  id?: string;
  ts?: string;
  traceId: string;
  mcpTraceId?: string;
  source: string;
  tool: string;
  taskSession?: string;
  branch?: string;
  worktree?: string;
  status: string;
  ok: boolean;
  code?: string;
  exitCode?: number;
  durationMs?: number;
  input?: unknown;
  resolvedInput?: unknown;
  result?: unknown;
  stderr?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  routing?: TraceRoutingContext;
};

export type SubagentTraceEvent = {
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

export type SubagentTraceInput = {
  provider: string;
  parentTraceId: string;
  cwd: string;
  taskSession?: string;
  branch?: string;
  stdoutLogPath?: string;
  events: SubagentTraceEvent[];
};

type TracePersistenceOptions = {
  env?: TraceEnvironment;
  dbPath?: string;
};

type TraceStatement = {
  run: (...values: unknown[]) => unknown;
  all: (...values: unknown[]) => unknown[];
};

type TraceDatabase = {
  exec: (sql: string) => void;
  query: (sql: string) => TraceStatement;
  close: () => void;
};

type TraceDatabaseConstructor = new (
  filename: string,
  options?: { create?: boolean; readonly?: boolean },
) => TraceDatabase;

const TRACE_COLUMNS: Array<{ name: string; alterSql: string }> = [
  { name: 'id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN id TEXT;' },
  { name: 'ts', alterSql: 'ALTER TABLE tool_traces ADD COLUMN ts TEXT;' },
  { name: 'trace_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN trace_id TEXT;' },
  { name: 'mcp_trace_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN mcp_trace_id TEXT;' },
  { name: 'source', alterSql: 'ALTER TABLE tool_traces ADD COLUMN source TEXT;' },
  { name: 'tool', alterSql: 'ALTER TABLE tool_traces ADD COLUMN tool TEXT;' },
  { name: 'task_session', alterSql: 'ALTER TABLE tool_traces ADD COLUMN task_session TEXT;' },
  { name: 'branch', alterSql: 'ALTER TABLE tool_traces ADD COLUMN branch TEXT;' },
  { name: 'worktree', alterSql: 'ALTER TABLE tool_traces ADD COLUMN worktree TEXT;' },
  { name: 'requested_node_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN requested_node_id TEXT;' },
  { name: 'resolved_node_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN resolved_node_id TEXT;' },
  { name: 'resolved_node_name', alterSql: 'ALTER TABLE tool_traces ADD COLUMN resolved_node_name TEXT;' },
  { name: 'default_node_id', alterSql: 'ALTER TABLE tool_traces ADD COLUMN default_node_id TEXT;' },
  { name: 'route_source', alterSql: 'ALTER TABLE tool_traces ADD COLUMN route_source TEXT;' },
  { name: 'status', alterSql: 'ALTER TABLE tool_traces ADD COLUMN status TEXT;' },
  { name: 'ok', alterSql: 'ALTER TABLE tool_traces ADD COLUMN ok INTEGER;' },
  { name: 'code', alterSql: 'ALTER TABLE tool_traces ADD COLUMN code TEXT;' },
  { name: 'exit_code', alterSql: 'ALTER TABLE tool_traces ADD COLUMN exit_code INTEGER;' },
  { name: 'duration_ms', alterSql: 'ALTER TABLE tool_traces ADD COLUMN duration_ms INTEGER;' },
  { name: 'input_json', alterSql: 'ALTER TABLE tool_traces ADD COLUMN input_json TEXT;' },
  { name: 'resolved_input_json', alterSql: 'ALTER TABLE tool_traces ADD COLUMN resolved_input_json TEXT;' },
  { name: 'result_json', alterSql: 'ALTER TABLE tool_traces ADD COLUMN result_json TEXT;' },
  { name: 'stderr', alterSql: 'ALTER TABLE tool_traces ADD COLUMN stderr TEXT;' },
  { name: 'input_tokens', alterSql: 'ALTER TABLE tool_traces ADD COLUMN input_tokens INTEGER;' },
  { name: 'output_tokens', alterSql: 'ALTER TABLE tool_traces ADD COLUMN output_tokens INTEGER;' },
  { name: 'total_tokens', alterSql: 'ALTER TABLE tool_traces ADD COLUMN total_tokens INTEGER;' },
];

const INSERT_TOOL_TRACE_SQL = [
  'INSERT OR REPLACE INTO tool_traces (',
  'id, ts, trace_id, mcp_trace_id, source, tool, task_session, branch, worktree,',
  'requested_node_id, resolved_node_id, resolved_node_name, default_node_id, route_source,',
  'status, ok, code, exit_code, duration_ms,',
  'input_json, resolved_input_json, result_json, stderr,',
  'input_tokens, output_tokens, total_tokens',
  ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
].join(' ');

export function resolveCanonicalTraceDbPath(
  options: { env?: TraceEnvironment; home?: string } = {},
): string {
  const env = options.env ?? process.env;
  const explicit = env.CONSUELO_TRACE_DB?.trim() || env.TRACE_DB?.trim();
  if (explicit) return path.resolve(expandHome(explicit));
  const home = options.home ?? env.CONSUELO_HOME ?? env.CONSUELO_OS_HOME;
  return resolveConsueloHomeLayout(home).nodeTraceDbPath;
}

function recordToolTraceBatchSafely(
  inputs: ToolTraceInput[],
  options: TracePersistenceOptions = {},
): boolean {
  if (inputs.length === 0) return true;
  try {
    const dbPath = options.dbPath ?? resolveCanonicalTraceDbPath({ env: options.env });
    const db = openTraceDatabase(dbPath);
    try {
      ensureToolTraceSchema(db);
      for (const input of inputs) insertToolTrace(db, input);
    } finally {
      db.close();
    }
    return true;
  } catch (error: unknown) {
    writePersistenceWarning(error);
    return false;
  }
}

export function recordToolTraceSafely(
  input: ToolTraceInput,
  options: TracePersistenceOptions = {},
): boolean {
  return recordToolTraceBatchSafely([input], options);
}

export function recordSubagentTraceEventsSafely(
  input: SubagentTraceInput,
  options: TracePersistenceOptions = {},
): boolean {
  if (input.events.length === 0) return true;
  try {
    const dbPath = options.dbPath ?? resolveCanonicalTraceDbPath({ env: options.env });
    const db = openTraceDatabase(dbPath);
    try {
      ensureToolTraceSchema(db);
      const ts = new Date().toISOString();
      for (const [index, event] of input.events.entries()) {
        const childTraceId = `${input.parentTraceId}:subagent:${String(index + 1).padStart(4, '0')}`;
        const eventIdentity = `${index}:${event.itemId ?? event.tool}:${event.eventType}`;
        insertToolTrace(db, {
          id: `${input.parentTraceId}:subagent:${stableHash(eventIdentity)}`,
          ts,
          traceId: childTraceId,
          mcpTraceId: input.parentTraceId,
          source: 'subagent',
          tool: event.tool,
          taskSession: input.taskSession,
          branch: input.branch,
          worktree: input.cwd,
          status: event.status,
          ok: event.ok,
          code: event.code,
          exitCode: event.ok ? 0 : 1,
          durationMs: event.eventType === 'turn.completed' ? 0 : undefined,
          input: {
            provider: input.provider,
            eventType: event.eventType,
            itemId: event.itemId,
            tool: event.tool,
            facadeTool: event.facadeTool,
            command: event.command,
            input: event.input,
            stdoutLogPath: input.stdoutLogPath,
          },
          result: {
            provider: input.provider,
            parentTraceId: input.parentTraceId,
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
          },
          stderr: event.ok ? undefined : textValue(event.result) || event.code,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
        });
      }
    } finally {
      db.close();
    }
    return true;
  } catch (error: unknown) {
    writePersistenceWarning(error);
    return false;
  }
}

export function recordGatewayAuthorizationTraceSafely(input: {
  workspaceId: string;
  route: string;
  requiredScope: string;
  status: number;
  code: string;
  message: string;
}, options: TracePersistenceOptions = {}): boolean {
  return recordToolTraceSafely({
    traceId: createTraceId(),
    source: 'gateway',
    tool: 'authorization.mcp',
    status: 'error',
    ok: false,
    code: input.code,
    exitCode: input.status,
    input: {
      workspaceId: input.workspaceId,
      route: input.route,
      requiredScope: input.requiredScope,
    },
    result: {
      error: {
        code: input.code,
        message: input.message,
      },
    },
    stderr: input.message,
  }, options);
}

type GatewayAuthenticationTraceInput = {
  workspaceId: string;
  route: string;
  requiredScope: string;
  authMode: AuthenticatedMcpAuthMode;
  principalKey: string;
  requestedNodeId?: string;
  resolvedNodeId?: string;
  resolvedNodeName?: string;
  defaultNodeId?: string;
  routeSource?: string;
};

function gatewayAuthenticationToolTrace(
  input: GatewayAuthenticationTraceInput,
): ToolTraceInput {
  return {
    traceId: createTraceId(),
    source: 'gateway',
    tool: 'authentication.mcp',
    status: 'ok',
    ok: true,
    code: 'OK',
    exitCode: 0,
    routing: {
      ...(input.requestedNodeId ? { requestedNodeId: input.requestedNodeId } : {}),
      ...(input.resolvedNodeId ? { resolvedNodeId: input.resolvedNodeId } : {}),
      ...(input.resolvedNodeName ? { resolvedNodeName: input.resolvedNodeName } : {}),
      ...(input.defaultNodeId ? { defaultNodeId: input.defaultNodeId } : {}),
      ...(input.routeSource ? { routeSource: input.routeSource } : {}),
    },
    input: {
      workspaceId: input.workspaceId,
      route: input.route,
      requiredScope: input.requiredScope,
      authMode: input.authMode,
      principalKey: input.principalKey,
      ...(input.requestedNodeId ? { requestedNodeId: input.requestedNodeId } : {}),
      ...(input.resolvedNodeId ? { resolvedNodeId: input.resolvedNodeId } : {}),
      ...(input.resolvedNodeName ? { resolvedNodeName: input.resolvedNodeName } : {}),
      ...(input.defaultNodeId ? { defaultNodeId: input.defaultNodeId } : {}),
      ...(input.routeSource ? { routeSource: input.routeSource } : {}),
    },
    result: { ok: true },
  };
}

export function recordGatewayAuthenticationTraceSafely(
  input: GatewayAuthenticationTraceInput,
  options: TracePersistenceOptions = {},
): boolean {
  return recordToolTraceSafely(gatewayAuthenticationToolTrace(input), options);
}

const pendingGatewayAuthenticationTraces = new Map<string, ToolTraceInput[]>();
let gatewayAuthenticationFlushScheduled = false;

function flushGatewayAuthenticationTraces(): void {
  gatewayAuthenticationFlushScheduled = false;
  const pending = [...pendingGatewayAuthenticationTraces.entries()];
  pendingGatewayAuthenticationTraces.clear();
  for (const [dbPath, traces] of pending) {
    recordToolTraceBatchSafely(traces, { dbPath });
  }
}

export function queueGatewayAuthenticationTraceSafely(
  input: GatewayAuthenticationTraceInput,
  options: TracePersistenceOptions = {},
): void {
  try {
    const dbPath = options.dbPath ?? resolveCanonicalTraceDbPath({ env: options.env });
    const pending = pendingGatewayAuthenticationTraces.get(dbPath) ?? [];
    pending.push(gatewayAuthenticationToolTrace(input));
    pendingGatewayAuthenticationTraces.set(dbPath, pending);
    if (gatewayAuthenticationFlushScheduled) return;
    gatewayAuthenticationFlushScheduled = true;
    setTimeout(flushGatewayAuthenticationTraces, 0);
  } catch (error: unknown) {
    writePersistenceWarning(error);
  }
}

function openTraceDatabase(dbPath: string): TraceDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const { Database } = require('bun:sqlite') as { Database: TraceDatabaseConstructor };
  const db = new Database(dbPath, { create: true });
  db.exec('PRAGMA busy_timeout = 1000;');
  return db;
}

function ensureToolTraceSchema(db: TraceDatabase): void {
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
      requested_node_id TEXT,
      resolved_node_id TEXT,
      resolved_node_name TEXT,
      default_node_id TEXT,
      route_source TEXT,
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
  `);

  const columns = new Set(
    (db.query('PRAGMA table_info(tool_traces)').all() as Array<{ name?: unknown }>)
      .map((row) => typeof row.name === 'string' ? row.name : '')
      .filter(Boolean),
  );
  for (const column of TRACE_COLUMNS) {
    if (!columns.has(column.name)) {
      db.exec(column.alterSql);
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS tool_traces_ts_idx ON tool_traces(ts);
    CREATE INDEX IF NOT EXISTS tool_traces_trace_id_idx ON tool_traces(trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_mcp_trace_id_idx ON tool_traces(mcp_trace_id);
    CREATE INDEX IF NOT EXISTS tool_traces_tool_idx ON tool_traces(tool);
    CREATE INDEX IF NOT EXISTS tool_traces_status_idx ON tool_traces(status);
    CREATE INDEX IF NOT EXISTS tool_traces_task_session_idx ON tool_traces(task_session);
    CREATE INDEX IF NOT EXISTS tool_traces_branch_idx ON tool_traces(branch);
    CREATE INDEX IF NOT EXISTS tool_traces_resolved_node_id_idx ON tool_traces(resolved_node_id);
    CREATE INDEX IF NOT EXISTS tool_traces_route_source_idx ON tool_traces(route_source);
  `);
}

function insertToolTrace(db: TraceDatabase, input: ToolTraceInput): void {
  db.query(INSERT_TOOL_TRACE_SQL).run(
    input.id ?? `${input.source}:${input.traceId}`,
    input.ts ?? new Date().toISOString(),
    input.traceId,
    input.mcpTraceId ?? null,
    input.source,
    input.tool,
    input.taskSession ?? null,
    input.branch ?? null,
    input.worktree ?? null,
    input.routing?.requestedNodeId ?? null,
    input.routing?.resolvedNodeId ?? null,
    input.routing?.resolvedNodeName ?? null,
    input.routing?.defaultNodeId ?? null,
    input.routing?.routeSource ?? null,
    input.status,
    input.ok ? 1 : 0,
    input.code ?? null,
    input.exitCode ?? null,
    input.durationMs ?? null,
    safeJson(input.input),
    safeJson(input.resolvedInput),
    safeJson(input.result),
    input.stderr ? redactTraceText(input.stderr) : null,
    input.inputTokens ?? null,
    input.outputTokens ?? null,
    input.totalTokens ?? null,
  );
}

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  return JSON.stringify(redactTraceJson(value));
}

function compactJson(value: unknown, limit: number): unknown {
  try {
    const text = JSON.stringify(value ?? null);
    if (text.length <= limit) return value;
    return {
      preview: text.slice(0, limit),
      chars: text.length,
      truncated: true,
      omitted: text.length - limit,
    };
  } catch {
    const text = String(value ?? '');
    if (text.length <= limit) return text;
    return {
      preview: text.slice(0, limit),
      chars: text.length,
      truncated: true,
      omitted: text.length - limit,
    };
  }
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value ?? '').length;
  } catch {
    return String(value ?? '').length;
  }
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return String(value ?? '');
  }
}

function stableHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function createTraceId(): string {
  return `trc_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function writePersistenceWarning(error: unknown): void {
  if (persistenceWarningEmitted) return;
  persistenceWarningEmitted = true;
  const message = error instanceof Error ? error.message : String(error);
  const warning = redactJson({
    level: 'warn',
    event: 'trace.persistence_failed',
    code: 'TRACE_PERSISTENCE_FAILED',
    message,
    ts: new Date().toISOString(),
  });
  try {
    process.stderr.write(`${JSON.stringify(warning)}\n`);
  } catch {
    // Trace persistence must never fail the caller, including its warning path.
  }
}
