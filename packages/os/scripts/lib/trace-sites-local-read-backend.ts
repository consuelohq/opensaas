import { existsSync } from 'node:fs';

import type {
  TraceSitesGatewayCachedAggregate,
  TraceSitesGatewayHistoryPage,
  TraceSitesGatewayHistoryRow,
  TraceSitesGatewayReadBackendAdapter,
  TraceSitesGatewayReadBackendInput,
  TraceSitesGatewayRecentEvents,
} from './trace-sites-gateway-read-layer';
import type {
  TraceSitesDashboardEvent,
  TraceSitesDashboardSummary,
} from './trace-sites-gateway-contract';
import { redactTraceJson, redactTraceText } from './redaction';
import { ensureTraceDatabaseSchema } from './trace-database-schema';
import { compileTraceHistorySearch } from './trace-search-query';

export type LocalTraceSitesReadBackendOptions = {
  dbPath: string;
  cachedSummary?: TraceSitesDashboardSummary | null;
  cachedCursor?: string;
  localRelayOnline?: boolean;
  cloudRunnerSaturated?: boolean;
};

type TraceRow = {
  rowid: number;
  id?: string | null;
  ts?: string | null;
  trace_id?: string | null;
  mcp_trace_id?: string | null;
  source?: string | null;
  tool?: string | null;
  task_session?: string | null;
  branch?: string | null;
  worktree?: string | null;
  work_session?: string | null;
  work_path?: string | null;
  requested_node_id?: string | null;
  resolved_node_id?: string | null;
  resolved_node_name?: string | null;
  default_node_id?: string | null;
  route_source?: string | null;
  status?: string | null;
  ok?: number | null;
  code?: string | null;
  exit_code?: number | null;
  duration_ms?: number | null;
  input_json?: string | null;
  resolved_input_json?: string | null;
  result_json?: string | null;
  stderr?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

const TRACE_HISTORY_PAGE_SQL = [
  'SELECT',
  '  rowid,',
  '  id,',
  '  ts,',
  '  trace_id,',
  '  mcp_trace_id,',
  '  source,',
  '  tool,',
  '  task_session,',
  '  branch,',
  '  worktree,',
  '  work_session,',
  '  work_path,',
  '  requested_node_id,',
  '  resolved_node_id,',
  '  resolved_node_name,',
  '  default_node_id,',
  '  route_source,',
  '  status,',
  '  ok,',
  '  code,',
  '  exit_code,',
  '  duration_ms,',
  "  substr(coalesce(input_json, ''), 1, 200000) AS input_json,",
  "  substr(coalesce(resolved_input_json, ''), 1, 200000) AS resolved_input_json,",
  "  substr(coalesce(result_json, ''), 1, 200000) AS result_json,",
  "  substr(coalesce(stderr, ''), 1, 20000) AS stderr,",
  '  input_tokens,',
  '  output_tokens,',
  '  total_tokens',
  'FROM tool_traces',
  'WHERE rowid < ?',
  'ORDER BY rowid DESC',
  'LIMIT ?;',
].join('\n');

const TRACE_NEWER_PAGE_SQL = TRACE_HISTORY_PAGE_SQL.replace(
  'WHERE rowid < ?',
  'WHERE rowid > ?',
).replace('ORDER BY rowid DESC', 'ORDER BY rowid ASC');

const TRACE_HISTORY_CURSOR_SQL = [
  'SELECT rowid',
  'FROM tool_traces',
  'WHERE id = ? OR trace_id = ? OR mcp_trace_id = ?',
  'ORDER BY rowid DESC',
  'LIMIT 1;',
].join('\n');

const RECENT_TRACE_EVENTS_SQL = [
  'SELECT',
  '  rowid,',
  '  id,',
  '  trace_id,',
  '  tool,',
  '  task_session,',
  '  branch,',
  '  work_session,',
  '  work_path,',
  '  status,',
  '  code,',
  '  exit_code,',
  '  input_tokens,',
  '  output_tokens,',
  '  total_tokens',
  'FROM tool_traces',
  'WHERE rowid > ?',
  'ORDER BY rowid ASC',
  'LIMIT ?;',
].join('\n');

export function createLocalTraceSitesReadBackend(
  options: LocalTraceSitesReadBackendOptions,
): TraceSitesGatewayReadBackendAdapter {
  let schemaReady = false;
  const prepareExistingDatabaseForRead = (): void => {
    if (schemaReady || !existsSync(options.dbPath)) return;
    ensureTraceDatabaseSchema(options.dbPath);
    schemaReady = true;
  };
  return {
    resolveHealth() {
      return {
        traceStoreAvailable: existsSync(options.dbPath),
        aggregateCacheAvailable: Boolean(options.cachedSummary),
        localRelayOnline: options.localRelayOnline ?? true,
        cloudRunnerSaturated: options.cloudRunnerSaturated ?? false,
      };
    },
    readRecentEvents(input) {
      prepareExistingDatabaseForRead();
      return readRecentTraceEvents(options.dbPath, input);
    },
    readHistoryPage(input) {
      prepareExistingDatabaseForRead();
      return readTraceHistoryPage(options.dbPath, input);
    },
    readNewerPage(input) {
      prepareExistingDatabaseForRead();
      return readNewerTracePage(options.dbPath, input);
    },
    readCachedAggregate(): TraceSitesGatewayCachedAggregate {
      return {
        cursor: options.cachedCursor ?? '000000000000',
        summary: options.cachedSummary ?? null,
      };
    },
  };
}

async function readNewerTracePage(
  dbPath: string,
  input: TraceSitesGatewayReadBackendInput,
): Promise<TraceSitesGatewayHistoryPage> {
  if (!existsSync(dbPath)) return { rows: [], nextCursor: input.cursor };

  const { Database } = await import('bun:sqlite');
  const db = new Database(dbPath, { readonly: true });
  try {
    const afterRowid = resolveHistoryAfterRowid(db, input.cursor);
    const pageSize = Math.max(1, Math.floor(input.limit));
    const search = compileTraceHistorySearch(input.query ?? '');
    const sql = TRACE_NEWER_PAGE_SQL.replace(
      'WHERE rowid > ?',
      `WHERE rowid > ? AND ${search.sql}`,
    );
    const rows = db
      .query(sql)
      .all(afterRowid, ...search.values, pageSize) as TraceRow[];
    const nextCursor = rows.length
      ? rowidToCursor(rows[rows.length - 1].rowid)
      : rowidToCursor(afterRowid);
    return {
      rows: rows.map(historyRowFromTraceRow).reverse(),
      nextCursor,
    };
  } finally {
    db.close();
  }
}

async function readTraceHistoryPage(
  dbPath: string,
  input: TraceSitesGatewayReadBackendInput,
): Promise<TraceSitesGatewayHistoryPage> {
  if (!existsSync(dbPath)) return { rows: [], nextCursor: null };

  const { Database } = await import('bun:sqlite');
  const db = new Database(dbPath, { readonly: true });
  try {
    const beforeRowid = resolveHistoryBeforeRowid(db, input.cursor);
    if (beforeRowid <= 1) return { rows: [], nextCursor: null };
    const pageSize = Math.max(1, Math.floor(input.limit));
    const search = compileTraceHistorySearch(input.query ?? '');
    const sql = TRACE_HISTORY_PAGE_SQL.replace(
      'WHERE rowid < ?',
      `WHERE rowid < ? AND ${search.sql}`,
    );
    const rows = db
      .query(sql)
      .all(beforeRowid, ...search.values, pageSize + 1) as TraceRow[];
    const pageRows = rows.slice(0, pageSize);
    return {
      rows: pageRows.map(historyRowFromTraceRow),
      nextCursor:
        rows.length > pageSize && pageRows.length > 0
          ? rowidToCursor(pageRows[pageRows.length - 1].rowid)
          : null,
    };
  } finally {
    db.close();
  }
}

async function readRecentTraceEvents(
  dbPath: string,
  input: TraceSitesGatewayReadBackendInput,
): Promise<TraceSitesGatewayRecentEvents> {
  if (!existsSync(dbPath)) {
    return { cursor: input.cursor, events: [] };
  }

  const { Database } = await import('bun:sqlite');
  const db = new Database(dbPath, { readonly: true });
  try {
    const afterRowid = cursorToRowid(input.cursor);
    const rows = db
      .query(RECENT_TRACE_EVENTS_SQL)
      .all(afterRowid, input.limit) as TraceRow[];

    const cursor = rows.length
      ? rowidToCursor(rows[rows.length - 1].rowid)
      : rowidToCursor(afterRowid);
    return {
      cursor,
      events: rows.map((row) => rowToDashboardEvent(row, input)),
    };
  } finally {
    db.close();
  }
}

function rowToDashboardEvent(
  row: TraceRow,
  input: TraceSitesGatewayReadBackendInput,
): TraceSitesDashboardEvent {
  const cursor = rowidToCursor(row.rowid);
  const traceId =
    cleanString(row.trace_id) || cleanString(row.id) || `trace-row-${cursor}`;
  const outputTokens = numberValue(row.output_tokens ?? row.total_tokens);
  const inputTokens = numberValue(row.input_tokens);
  const success =
    (row.status ?? 'ok') === 'ok' &&
    (row.code ?? 'OK') === 'OK' &&
    (row.exit_code === null ||
      row.exit_code === undefined ||
      row.exit_code === 0);

  return {
    traceId,
    idempotencyKey: input.nodeId
      ? `${input.workspaceId}:${input.nodeId}:${traceId}:${cursor}`
      : `${input.workspaceId}:${traceId}:${cursor}`,
    sourceMode: input.sourceMode,
    branch:
      sanitizeLocalTraceText(cleanString(row.work_path)) ||
      cleanString(row.branch) ||
      cleanString(row.task_session) ||
      cleanString(row.work_session) ||
      '(no branch)',
    tool: cleanString(row.tool) || 'unknown',
    inputTokens,
    outputTokens,
    costUsd: 0,
    success,
    ...(success
      ? {}
      : {
          errorCause:
            cleanString(row.code) || `EXIT_${row.exit_code ?? 'UNKNOWN'}`,
        }),
  };
}

function historyRowFromTraceRow(row: TraceRow): TraceSitesGatewayHistoryRow {
  const recordId =
    cleanString(row.id) || `trace-row-${rowidToCursor(row.rowid)}`;
  const traceId = cleanString(row.trace_id) || recordId;
  const tool = cleanString(row.tool) || 'unknown';
  const success =
    row.ok === 1 ||
    ((row.status ?? 'ok') === 'ok' &&
      (row.code ?? 'OK') === 'OK' &&
      (row.exit_code === null ||
        row.exit_code === undefined ||
        row.exit_code === 0));
  const durationMs = numberValue(row.duration_ms);
  const inputTokens = numberValue(row.input_tokens);
  const outputTokens = numberValue(row.output_tokens);
  const tokens = numberValue(row.total_tokens) || inputTokens + outputTokens;
  const rawInputJson = sanitizeTracePayloadJson(cleanString(row.input_json));
  const rawResolvedInputJson = sanitizeTracePayloadJson(
    cleanString(row.resolved_input_json),
  );
  const rawResultJson = sanitizeTracePayloadJson(cleanString(row.result_json));
  const rawStderr = sanitizeLocalTraceText(cleanString(row.stderr));
  const requestedNodeId = cleanString(row.requested_node_id);
  const resolvedNodeId = cleanString(row.resolved_node_id);
  const resolvedNodeName = cleanString(row.resolved_node_name);
  const defaultNodeId = cleanString(row.default_node_id);
  const routeSource = cleanString(row.route_source);
  const resultMessage = resultMessageFromJson(rawResultJson);
  const batchResults =
    tool === 'batch' ? batchResultsFromJson(rawResultJson) : [];
  const historyRow: TraceSitesGatewayHistoryRow = {
    id: recordId,
    recordId,
    startTime: cleanString(row.ts),
    time: cleanString(row.ts),
    name: tool,
    traceName: tool,
    branch:
      cleanString(row.branch) || cleanString(row.task_session) || 'no-branch',
    taskSession: cleanString(row.task_session),
    worktree: sanitizeLocalTraceText(cleanString(row.worktree)),
    workSession: cleanString(row.work_session),
    workPath: sanitizeLocalTraceText(cleanString(row.work_path)),
    ...(requestedNodeId ? { requestedNodeId } : {}),
    ...(resolvedNodeId ? { resolvedNodeId, nodeId: resolvedNodeId } : {}),
    ...(resolvedNodeName
      ? { resolvedNodeName, nodeName: resolvedNodeName }
      : {}),
    ...(defaultNodeId ? { defaultNodeId } : {}),
    ...(routeSource ? { routeSource } : {}),
    status: success ? 'success' : cleanString(row.status) || 'error',
    ok: success,
    code: cleanString(row.code) || (success ? 'OK' : 'ERROR'),
    exitCode: row.exit_code ?? (success ? 0 : null),
    durationMs,
    latency: `${durationMs}ms`,
    tokens,
    inputTokens,
    outputTokens,
    cost: 0,
    costLabel: '$0.0000',
    trace: traceId,
    traceId,
    metadata: {
      rowid: row.rowid,
      source: cleanString(row.source),
      mcpTraceId: cleanString(row.mcp_trace_id),
      ...(cleanString(row.work_session) ? { workSession: cleanString(row.work_session) } : {}),
      ...(cleanString(row.work_path)
        ? { workPath: sanitizeLocalTraceText(cleanString(row.work_path)) }
        : {}),
      ...(requestedNodeId ? { requestedNodeId } : {}),
      ...(resolvedNodeId ? { resolvedNodeId } : {}),
      ...(resolvedNodeName ? { resolvedNodeName } : {}),
      ...(defaultNodeId ? { defaultNodeId } : {}),
      ...(routeSource ? { routeSource } : {}),
    },
    input: compactPayload(rawResolvedInputJson || rawInputJson),
    output: resultMessage || compactPayload(rawResultJson) || rawStderr,
    summary: resultMessage || `${tool} ${success ? 'completed' : 'failed'}`,
    inputObj: rawInputJson,
    resolvedInputObj: rawResolvedInputJson,
    outputObj: rawResultJson,
    rawInputJson,
    rawResolvedInputJson,
    rawResultJson,
    rawStderr,
  };
  if (batchResults.length > 0) {
    historyRow.batchResultsJson = batchResults;
    historyRow.batchResultsCount = batchResults.length;
  }
  return historyRow;
}

export function sanitizeTraceHistoryRowForTest(
  row: TraceRow,
): TraceSitesGatewayHistoryRow {
  return historyRowFromTraceRow(row);
}

const TRACE_PRIVATE_PAYLOAD_FIELD_PATTERN = /^(?:(?:system|user|developer)?prompt|instructions?|messages|environment|env)$/i;

function sanitizeTracePayloadJson(value: string): string {
  if (!value) return '';
  const parsed = parseJson(value);
  if (parsed === null) return sanitizeLocalTraceText(value);
  const scrubbed = scrubPrivateTraceFields(parsed, undefined, new WeakSet());
  try {
    return JSON.stringify(redactTraceJson(scrubbed));
  } catch {
    return sanitizeLocalTraceText(value);
  }
}

function scrubPrivateTraceFields(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
): unknown {
  if (key && TRACE_PRIVATE_PAYLOAD_FIELD_PATTERN.test(key)) return '[REDACTED_SECRET]';
  if (typeof value === 'string') return sanitizeLocalTraceText(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) return '[REDACTED_CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => scrubPrivateTraceFields(item, undefined, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      scrubPrivateTraceFields(entryValue, entryKey, seen),
    ]),
  );
}

function sanitizeLocalTraceText(value: string): string {
  return redactTraceText(value)
    .replace(/\/Users\/[^/\s"']+/g, '/Users/[user]')
    .replace(/\/home\/[^/\s"']+/g, '/home/[user]');
}

function resolveHistoryBeforeRowid(
  db: import('bun:sqlite').Database,
  cursor: string,
): number {
  const numeric = Number(cursor);
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);

  const recordId = cursor.startsWith('id:') ? cursor.slice(3) : cursor;
  if (recordId) {
    const matched = db
      .query(TRACE_HISTORY_CURSOR_SQL)
      .get(recordId, recordId, recordId) as { rowid?: number } | null;
    if (matched?.rowid && matched.rowid > 0) return matched.rowid;
  }

  const latest = db
    .query('SELECT max(rowid) AS rowid FROM tool_traces')
    .get() as {
    rowid?: number | null;
  } | null;
  return numberValue(latest?.rowid) + 1;
}

function resolveHistoryAfterRowid(
  db: import('bun:sqlite').Database,
  cursor: string,
): number {
  const numeric = Number(cursor);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.floor(numeric);

  const recordId = cursor.startsWith('id:') ? cursor.slice(3) : cursor;
  if (!recordId) return 0;
  const matched = db
    .query(TRACE_HISTORY_CURSOR_SQL)
    .get(recordId, recordId, recordId) as { rowid?: number } | null;
  if (matched?.rowid && matched.rowid > 0) return matched.rowid;

  const latest = db
    .query('SELECT max(rowid) AS rowid FROM tool_traces')
    .get() as { rowid?: number | null } | null;
  return numberValue(latest?.rowid);
}

function resultMessageFromJson(value: string): string {
  const record = asRecord(parseJson(value));
  const data = asRecord(record?.data);
  const nestedData = asRecord(data?.data);
  return cleanString(record?.message ?? data?.message ?? nestedData?.message);
}

function batchResultsFromJson(value: string): unknown[] {
  const record = asRecord(parseJson(value));
  const data = asRecord(record?.data);
  const nestedData = asRecord(data?.data);
  const results = data?.results ?? nestedData?.results;
  return Array.isArray(results) ? results : [];
}

function parseJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function compactPayload(value: string): string {
  const compact = value.trim().replace(/\s+/g, ' ');
  return compact.length > 240 ? `${compact.slice(0, 239)}…` : compact;
}

function cursorToRowid(cursor: string): number {
  const value = Number(cursor);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function rowidToCursor(rowid: number): string {
  return String(Math.max(0, Math.floor(rowid))).padStart(12, '0');
}

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function cleanString(value: unknown): string {
  return String(value ?? '').trim();
}
