from pathlib import Path
p=Path('packages/workspace/scripts/lib/worker/runtime.ts')
s=p.read_text()
old="import { execFileSync, spawn } from 'node:child_process';\nimport fs from 'node:fs';\nimport path from 'node:path';"
new="import { execFileSync, spawn } from 'node:child_process';\nimport crypto from 'node:crypto';\nimport fs from 'node:fs';\nimport os from 'node:os';\nimport path from 'node:path';\nimport { Database } from 'bun:sqlite';"
if old in s:
    s=s.replace(old,new)
old="""  usage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    reasoningOutputTokens?: number;
  };"""
new="""  usage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    reasoningOutputTokens?: number;
  };
  workerTrace?: WorkerTraceSummary;"""
s=s.replace(old,new)
old="""  audit: {
    taskSession?: string;
    branch?: string;
    workspaceOnly: WorkerWorkspaceOnly;
    rawShellUsed: boolean;
  };
};"""
new="""  audit: {
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
};"""
s=s.replace(old,new)
old="""    ...(input.usage ? { usage: input.usage } : {}),
    durationMs: input.durationMs ?? elapsedMs(context.startedAt, context.options.now),"""
new="""    ...(input.usage ? { usage: input.usage } : {}),
    ...(input.workerTrace ? { workerTrace: input.workerTrace } : {}),
    durationMs: input.durationMs ?? elapsedMs(context.startedAt, context.options.now),"""
s=s.replace(old,new)
old="""function compactWorkerOutput(input: {
  provider: NormalizedWorkerProvider;
  cwd: string;
  traceId: string;
  stdout: string;
  stderr: string;
}): Pick<WorkerCallData, 'stdout' | 'stderr' | 'finalMessage' | 'summary' | 'rawLogPath' | 'stdoutLogPath' | 'stderrLogPath' | 'stdoutChars' | 'stderrChars' | 'usage'> {
  const parsed = parseWorkerOutput(input.provider, input.stdout);
  const logs = persistWorkerLogs(input);"""
new="""function compactWorkerOutput(input: {
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
  });"""
if old not in s:
    raise SystemExit('compactWorkerOutput marker not found')
s=s.replace(old,new)
old="""    ...(parsed.usage ? { usage: parsed.usage } : {}),
  };"""
new="""    ...(parsed.usage ? { usage: parsed.usage } : {}),
    ...(workerTrace && workerTrace.eventCount > 0 ? { workerTrace } : {}),
  };"""
s=s.replace(old,new,1)
s=s.replace("""      stderr: run.stderr,
    }),""", """      stderr: run.stderr,
      audit: input.audit,
    }),""")
marker="function compactText(value: string): string {"
helpers=r'''
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
          event.inputTokens || null,
          event.outputTokens || null,
          event.totalTokens || null,
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

function summarizeWorkerTraceEvents(events: WorkerTraceEvent[]): WorkerTraceSummary {
  return {
    eventCount: events.length,
    workspaceMcpCallCount: events.filter((event) => event.eventType === 'mcp_tool_call' && event.tool.startsWith('cdx.')).length,
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

function ensureTraceSchema(db: Database): void {
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
  const columns = db.query('PRAGMA table_info(tool_traces)').all().map((row: any) => row.name);
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

'''
if marker not in s:
    raise SystemExit('helper insertion marker not found')
s=s.replace(marker,helpers+marker)
p.write_text(s)
