import { existsSync } from 'node:fs';

import type {
  TraceSitesGatewayCachedAggregate,
  TraceSitesGatewayHistoryPage,
  TraceSitesGatewayHistoryRow,
  TraceSitesGatewayHourlyAggregate,
  TraceSitesGatewayHourlyAggregateBucket,
  TraceSitesGatewayHourlyAggregateInput,
  TraceSitesGatewayReadBackendAdapter,
  TraceSitesGatewayReadBackendInput,
  TraceSitesGatewayRecentEvents,
} from './trace-sites-gateway-read-layer';
import type {
  TraceSitesDashboardEvent,
  TraceSitesDashboardSummary,
} from './trace-sites-gateway-contract';
import { redactTraceJson, redactTraceText } from './redaction';
import {
  ensureTraceDatabaseSchema,
  openTraceDatabase,
  type TraceDatabase,
} from './trace-database-schema';
import { compileTraceHistorySearch } from './trace-search-query';
import { estimateTraceCost } from './trace-cost-estimator';
import { resolveTraceSessionIdentity } from './trace-session-identity';

export type LocalTraceSitesReadBackendOptions = {
  dbPath: string;
  cachedSummary?: TraceSitesDashboardSummary | null;
  cachedCursor?: string;
  localRelayOnline?: boolean;
  cloudRunnerSaturated?: boolean;
  now?: () => number;
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

type HourlyAggregateTraceRow = {
  rowid: number;
  id?: string | null;
  started_at?: string | null;
  tool?: string | null;
  input_json?: string | null;
  resolved_input_json?: string | null;
  result_json?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

type HourlyAggregateDeltaRow = {
  rowid: number;
  id?: string | null;
  ts?: string | null;
};

type HourlyAggregateBucketRead = {
  buckets: Map<string, TraceSitesGatewayHourlyAggregateBucket>;
  traceBuckets: Map<string, number>;
};

type HourlyAggregateCache = {
  hours: number;
  currentBucketStartMs: number;
  refreshedAtMs: number;
  buckets: Map<string, TraceSitesGatewayHourlyAggregateBucket>;
  traceBuckets: Map<string, number>;
  lastRowid: number;
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

const TRACE_HOURLY_AGGREGATE_ROWS_SQL = [
  'SELECT',
  '  rowid,',
  '  id,',
  "  substr(ts, 1, 14) || CASE",
  "    WHEN substr(ts, 15, 2) < '15' THEN '00'",
  "    WHEN substr(ts, 15, 2) < '30' THEN '15'",
  "    WHEN substr(ts, 15, 2) < '45' THEN '30'",
  "    ELSE '45'",
  "  END || ':00.000Z' AS started_at,",
  '  tool,',
  "  coalesce(input_json, '') AS input_json,",
  "  coalesce(resolved_input_json, '') AS resolved_input_json,",
  "  coalesce(result_json, '') AS result_json,",
  '  input_tokens,',
  '  output_tokens,',
  '  total_tokens',
  'FROM tool_traces',
  'WHERE rowid > ? AND rowid <= ? AND ts >= ? AND ts < ?',
  'ORDER BY rowid ASC',
  'LIMIT ?;',
].join('\n');

const TRACE_AGGREGATE_HIGH_WATER_SQL = [
  'SELECT coalesce(max(rowid), 0) AS rowid',
  'FROM tool_traces;',
].join('\n');

const TRACE_AGGREGATE_DELTA_SQL = [
  'SELECT rowid, id, ts',
  'FROM tool_traces',
  'WHERE rowid > ? AND rowid <= ?',
  'ORDER BY rowid ASC',
  'LIMIT ?;',
].join('\n');

const HEATMAP_BUCKET_MINUTES = 15;
const HEATMAP_BUCKET_MS = HEATMAP_BUCKET_MINUTES * 60 * 1000;
const HEATMAP_BUCKETS_PER_HOUR = 60 / HEATMAP_BUCKET_MINUTES;
const HOURLY_AGGREGATE_REFRESH_MS = 30_000;
const HOURLY_AGGREGATE_TRACE_PAGE_SIZE = 250;
const HOURLY_AGGREGATE_DELTA_PAGE_SIZE = 10_000;

export function createLocalTraceSitesReadBackend(
  options: LocalTraceSitesReadBackendOptions,
): TraceSitesGatewayReadBackendAdapter {
  let schemaReady = false;
  let hourlyAggregateCache: HourlyAggregateCache | null = null;
  const prepareExistingDatabaseForRead = (): void => {
    if (schemaReady || !existsSync(options.dbPath)) return;
    ensureTraceDatabaseSchema(options.dbPath);
    schemaReady = true;
  };
  return {
    resolveHealth() {
      return {
        traceStoreAvailable: existsSync(options.dbPath),
        aggregateCacheAvailable: Boolean(options.cachedSummary || hourlyAggregateCache),
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
    readHourlyAggregate(input) {
      prepareExistingDatabaseForRead();
      const result = readHourlyTraceAggregate(
        options.dbPath,
        input,
        hourlyAggregateCache,
        options.now?.() ?? Date.now(),
      );
      hourlyAggregateCache = result.cache;
      return result.aggregate;
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

  const db = openTraceDatabase(dbPath);
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

  const db = openTraceDatabase(dbPath);
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

  const db = openTraceDatabase(dbPath);
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

function readHourlyTraceAggregate(
  dbPath: string,
  input: TraceSitesGatewayHourlyAggregateInput,
  cache: HourlyAggregateCache | null,
  nowMs: number,
): { aggregate: TraceSitesGatewayHourlyAggregate; cache: HourlyAggregateCache } {
  const hours = Math.max(1, Math.min(24 * 31, Math.floor(input.hours)));
  const bucketCount = hours * HEATMAP_BUCKETS_PER_HOUR;
  const currentBucketStartMs = Math.floor(nowMs / HEATMAP_BUCKET_MS) * HEATMAP_BUCKET_MS;
  const windowStartMs = currentBucketStartMs - (bucketCount - 1) * HEATMAP_BUCKET_MS;
  const databaseAvailable = existsSync(dbPath);
  let nextCache = cache;
  const resetCache =
    !nextCache ||
    nextCache.hours !== hours ||
    nextCache.currentBucketStartMs > currentBucketStartMs;

  if (resetCache) {
    const lastRowid = databaseAvailable ? readTraceAggregateHighWater(dbPath) : 0;
    const snapshot = databaseAvailable
      ? readHourlyAggregateBuckets(dbPath, windowStartMs, nowMs, lastRowid)
      : { buckets: new Map(), traceBuckets: new Map() };
    nextCache = {
      hours,
      currentBucketStartMs,
      refreshedAtMs: nowMs,
      buckets: snapshot.buckets,
      traceBuckets: snapshot.traceBuckets,
      lastRowid,
    };
  } else {
    const bucketAdvanced = nextCache.currentBucketStartMs !== currentBucketStartMs;
    const refreshDue = nowMs - nextCache.refreshedAtMs >= HOURLY_AGGREGATE_REFRESH_MS;
    if (databaseAvailable && (bucketAdvanced || refreshDue)) {
      const delta = readTraceAggregateDelta(dbPath, nextCache.lastRowid);
      const affectedBuckets = new Set<number>([currentBucketStartMs]);
      if (
        bucketAdvanced &&
        nextCache.currentBucketStartMs >= windowStartMs &&
        nextCache.currentBucketStartMs <= currentBucketStartMs
      ) {
        affectedBuckets.add(nextCache.currentBucketStartMs);
      }

      for (const row of delta.rows) {
        const id = cleanString(row.id);
        const previousBucket = id ? nextCache.traceBuckets.get(id) : undefined;
        if (
          previousBucket !== undefined &&
          previousBucket >= windowStartMs &&
          previousBucket <= currentBucketStartMs
        ) {
          affectedBuckets.add(previousBucket);
        }
        const timestampMs = Date.parse(cleanString(row.ts));
        if (Number.isFinite(timestampMs)) {
          const nextBucket = Math.floor(timestampMs / HEATMAP_BUCKET_MS) * HEATMAP_BUCKET_MS;
          if (nextBucket >= windowStartMs && nextBucket <= currentBucketStartMs) {
            affectedBuckets.add(nextBucket);
          }
        }
      }

      for (const [id, bucketStart] of nextCache.traceBuckets) {
        if (affectedBuckets.has(bucketStart)) nextCache.traceBuckets.delete(id);
      }
      for (const bucketStart of [...affectedBuckets].sort((left, right) => left - right)) {
        const key = new Date(bucketStart).toISOString();
        nextCache.buckets.delete(key);
        const endMs = Math.min(bucketStart + HEATMAP_BUCKET_MS, nowMs);
        if (endMs <= bucketStart) continue;
        const refreshed = readHourlyAggregateBuckets(dbPath, bucketStart, endMs, delta.highWaterRowid);
        for (const [bucketKey, bucket] of refreshed.buckets) {
          nextCache.buckets.set(bucketKey, bucket);
        }
        for (const [id, traceBucket] of refreshed.traceBuckets) {
          nextCache.traceBuckets.set(id, traceBucket);
        }
      }
      nextCache.currentBucketStartMs = currentBucketStartMs;
      nextCache.refreshedAtMs = nowMs;
      nextCache.lastRowid = delta.highWaterRowid;
    }
  }

  for (const key of nextCache.buckets.keys()) {
    if (Date.parse(key) < windowStartMs) nextCache.buckets.delete(key);
  }
  for (const [id, bucketStart] of nextCache.traceBuckets) {
    if (bucketStart < windowStartMs) nextCache.traceBuckets.delete(id);
  }

  const buckets = [...nextCache.buckets.values()].sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  );
  const totals = buckets.reduce(
    (value, bucket) => ({
      calls: value.calls + bucket.calls,
      inputTokens: value.inputTokens + bucket.inputTokens,
      outputTokens: value.outputTokens + bucket.outputTokens,
      tokens: value.tokens + bucket.tokens,
      cost: value.cost + bucket.cost,
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, tokens: 0, cost: 0 },
  );

  return {
    aggregate: {
      generatedAt: new Date(nextCache.refreshedAtMs).toISOString(),
      windowStart: new Date(windowStartMs).toISOString(),
      windowEnd: new Date(nowMs).toISOString(),
      buckets,
      totals,
    },
    cache: nextCache,
  };
}

function readHourlyAggregateBuckets(
  dbPath: string,
  startMs: number,
  endMs: number,
  maxRowid: number,
): HourlyAggregateBucketRead {
  const db = openTraceDatabase(dbPath);
  try {
    const buckets = new Map<string, TraceSitesGatewayHourlyAggregateBucket>();
    const traceBuckets = new Map<string, number>();
    const statement = db.query(TRACE_HOURLY_AGGREGATE_ROWS_SQL);
    const windowStart = new Date(startMs).toISOString();
    const windowEnd = new Date(endMs).toISOString();
    let afterRowid = 0;
    while (true) {
      const rows = statement.all(
        afterRowid,
        maxRowid,
        windowStart,
        windowEnd,
        HOURLY_AGGREGATE_TRACE_PAGE_SIZE,
      ) as HourlyAggregateTraceRow[];
      for (const row of rows) {
        const startedAt = cleanString(row.started_at);
        if (!startedAt) continue;
        const startedAtMs = Date.parse(startedAt);
        const id = cleanString(row.id);
        if (id && Number.isFinite(startedAtMs)) traceBuckets.set(id, startedAtMs);
        const inputTokens = numberValue(row.input_tokens);
        const outputTokens = numberValue(row.output_tokens);
        const tokens = numberValue(row.total_tokens) || inputTokens + outputTokens;
        const cost = estimateTraceRowCost(
          row,
          cleanString(row.tool) || 'unknown',
          inputTokens,
          outputTokens,
          tokens,
        )?.cost ?? 0;
        const bucket = buckets.get(startedAt) ?? {
          startedAt,
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          tokens: 0,
          cost: 0,
        };
        bucket.calls += 1;
        bucket.inputTokens += inputTokens;
        bucket.outputTokens += outputTokens;
        bucket.tokens += tokens;
        bucket.cost += cost;
        buckets.set(startedAt, bucket);
      }
      if (rows.length === 0) break;
      afterRowid = rows[rows.length - 1].rowid;
      if (rows.length < HOURLY_AGGREGATE_TRACE_PAGE_SIZE) break;
    }
    return { buckets, traceBuckets };
  } finally {
    db.close();
  }
}

function readTraceAggregateHighWater(dbPath: string): number {
  const db = openTraceDatabase(dbPath);
  try {
    const row = db.query(TRACE_AGGREGATE_HIGH_WATER_SQL).get() as { rowid?: number | null } | null;
    return numberValue(row?.rowid);
  } finally {
    db.close();
  }
}

function readTraceAggregateDelta(
  dbPath: string,
  afterRowid: number,
): { rows: HourlyAggregateDeltaRow[]; highWaterRowid: number } {
  const db = openTraceDatabase(dbPath);
  try {
    const highWater = db.query(TRACE_AGGREGATE_HIGH_WATER_SQL).get() as { rowid?: number | null } | null;
    const highWaterRowid = numberValue(highWater?.rowid);
    if (highWaterRowid <= afterRowid) return { rows: [], highWaterRowid };

    const rows: HourlyAggregateDeltaRow[] = [];
    const statement = db.query(TRACE_AGGREGATE_DELTA_SQL);
    let cursor = afterRowid;
    while (cursor < highWaterRowid) {
      const page = statement.all(cursor, highWaterRowid, HOURLY_AGGREGATE_DELTA_PAGE_SIZE) as HourlyAggregateDeltaRow[];
      if (page.length === 0) break;
      rows.push(...page);
      cursor = page[page.length - 1].rowid;
      if (page.length < HOURLY_AGGREGATE_DELTA_PAGE_SIZE) break;
    }
    return { rows, highWaterRowid };
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
    branch: traceSessionValue(row, '(no branch)'),
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
  const costEstimate = estimateTraceRowCost(
    row,
    tool,
    inputTokens,
    outputTokens,
    tokens,
  );
  const rawInputJson = sanitizeTracePayloadJson(cleanString(row.input_json));
  const rawResolvedInputJson = sanitizeTracePayloadJson(cleanString(row.resolved_input_json));
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
    branch: traceSessionValue(row, 'no-branch'),
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
    cost: costEstimate?.cost ?? 0,
    costLabel: costEstimate?.costLabel ?? '—',
    trace: traceId,
    traceId,
    metadata: {
      rowid: row.rowid,
      source: cleanString(row.source),
      mcpTraceId: cleanString(row.mcp_trace_id),
      ...(costEstimate
        ? {
            pricingModel: costEstimate.model,
            pricingRateModel: costEstimate.rateModel,
            pricingSource: costEstimate.pricingSource,
            pricingProvider: costEstimate.provider,
            pricingEstimated: true,
            cachedInputTokens: costEstimate.cachedInputTokens,
          }
        : {}),
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

function estimateTraceRowCost(
  row: Pick<TraceRow, 'input_json' | 'resolved_input_json' | 'result_json'>,
  tool: string,
  inputTokens: number,
  outputTokens: number,
  tokens: number,
) {
  // Pricing stays local. Use the original bounded payloads so the aggregate and
  // history views share token allocation/model/cache semantics without exposing
  // those payloads through the aggregate response.
  return estimateTraceCost({
    tool,
    inputTokens,
    outputTokens,
    totalTokens: tokens,
    rawInputJson: cleanString(row.input_json),
    rawResolvedInputJson: cleanString(row.resolved_input_json),
    rawResultJson: cleanString(row.result_json),
  });
}

export function sanitizeTraceHistoryRowForTest(
  row: TraceRow,
): TraceSitesGatewayHistoryRow {
  return historyRowFromTraceRow(row);
}

export function sanitizeTraceDashboardEventForTest(
  row: TraceRow,
): TraceSitesDashboardEvent {
  return rowToDashboardEvent(row, {
    workspaceId: 'workspace_test',
    workspaceHost: 'test.consuelohq.com',
    site: 'trace',
    sourceMode: 'local-networked',
    cursor: '0',
    limit: 1,
  });
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
  db: TraceDatabase,
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
  db: TraceDatabase,
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

function traceSessionValue(
  row: TraceRow,
  fallback: string,
): string {
  return resolveTraceSessionIdentity({
    workPath: sanitizeLocalTraceText(cleanString(row.work_path)),
    branch: cleanString(row.branch),
    taskSession: cleanString(row.task_session),
    workSession: cleanString(row.work_session),
  }, fallback);
}
