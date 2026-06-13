import { existsSync } from 'node:fs';

import type {
  TraceSitesGatewayCachedAggregate,
  TraceSitesGatewayReadBackendAdapter,
  TraceSitesGatewayReadBackendInput,
  TraceSitesGatewayRecentEvents,
} from './trace-sites-gateway-read-layer';
import type {
  TraceSitesDashboardEvent,
  TraceSitesDashboardSummary,
} from './trace-sites-gateway-contract';

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
  trace_id?: string | null;
  tool?: string | null;
  task_session?: string | null;
  branch?: string | null;
  status?: string | null;
  code?: string | null;
  exit_code?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

export function createLocalTraceSitesReadBackend(options: LocalTraceSitesReadBackendOptions): TraceSitesGatewayReadBackendAdapter {
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
      return readRecentTraceEvents(options.dbPath, input);
    },
    readCachedAggregate(): TraceSitesGatewayCachedAggregate {
      return {
        cursor: options.cachedCursor ?? '000000000000',
        summary: options.cachedSummary ?? null,
      };
    },
  };
}

async function readRecentTraceEvents(dbPath: string, input: TraceSitesGatewayReadBackendInput): Promise<TraceSitesGatewayRecentEvents> {
  if (!existsSync(dbPath)) {
    return { cursor: input.cursor, events: [] };
  }

  const { Database } = await import('bun:sqlite');
  const db = new Database(dbPath, { readonly: true });
  try {
    const afterRowid = cursorToRowid(input.cursor);
    const rows = db.query(`
      SELECT
        rowid,
        id,
        trace_id,
        tool,
        task_session,
        branch,
        status,
        code,
        exit_code,
        input_tokens,
        output_tokens,
        total_tokens
      FROM tool_traces
      WHERE rowid > ?
      ORDER BY rowid ASC
      LIMIT ?;
    `).all(afterRowid, input.limit) as TraceRow[];

    const cursor = rows.length ? rowidToCursor(rows[rows.length - 1].rowid) : rowidToCursor(afterRowid);
    return {
      cursor,
      events: rows.map((row) => rowToDashboardEvent(row, input)),
    };
  } finally {
    db.close();
  }
}

function rowToDashboardEvent(row: TraceRow, input: TraceSitesGatewayReadBackendInput): TraceSitesDashboardEvent {
  const cursor = rowidToCursor(row.rowid);
  const traceId = cleanString(row.trace_id) || cleanString(row.id) || `trace-row-${cursor}`;
  const outputTokens = numberValue(row.output_tokens ?? row.total_tokens);
  const inputTokens = numberValue(row.input_tokens);
  const success = (row.status ?? 'ok') === 'ok' && (row.code ?? 'OK') === 'OK' && (row.exit_code === null || row.exit_code === undefined || row.exit_code === 0);

  return {
    traceId,
    idempotencyKey: `${input.workspaceId}:${traceId}:${cursor}`,
    sourceMode: input.sourceMode,
    branch: cleanString(row.branch) || cleanString(row.task_session) || '(no branch)',
    tool: cleanString(row.tool) || 'unknown',
    inputTokens,
    outputTokens,
    costUsd: 0,
    success,
    ...(success ? {} : { errorCause: cleanString(row.code) || `EXIT_${row.exit_code ?? 'UNKNOWN'}` }),
  };
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
