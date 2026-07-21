import { Database } from 'bun:sqlite';

import { createLocalTraceSitesReadBackend } from '../../../os/scripts/lib/trace-sites-local-read-backend';
import type {
  TraceSitesGatewayReadBackendAdapter,
  TraceSitesGatewayReadBackendInput,
} from '../../../os/scripts/lib/trace-sites-gateway-read-layer';

const HISTORY_ROUTE = '/gateway/traces/recent';
const HISTORY_SITE = 'trace-burn-intelligence';
const HISTORY_SOURCE_MODE = 'local-networked';
const MAX_HISTORY_PAGE_SIZE = 250;

type TraceRecord = Record<string, unknown>;

export function enrichTracePayloadWithBatchResults<T>(
  payload: T,
  dbPath: string,
): T {
  const payloadRecord = asRecord(payload);
  const sourceRows = Array.isArray(payload)
    ? payload
    : Array.isArray(payloadRecord?.rows)
      ? payloadRecord.rows
      : Array.isArray(payloadRecord?.traces)
        ? payloadRecord.traces
        : [];
  const rows = sourceRows.filter(isRecord);
  const traceIds = rows
    .filter(
      (row) =>
        clean(row.name ?? row.traceName ?? row.tool) === 'batch' &&
        clean(row.traceId ?? row.trace_id),
    )
    .map((row) => clean(row.traceId ?? row.trace_id));
  if (!traceIds.length || !clean(dbPath)) return payload;

  let db: Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const query = db.query(
      "SELECT trace_id, input_json, coalesce(json_extract(result_json, '$.data.results'), json_extract(result_json, '$.data.data.results')) AS batch_results_json FROM tool_traces WHERE tool = 'batch' AND trace_id = ? LIMIT 1",
    );
    const batchRows = traceIds
      .map((traceId) => query.get(traceId) as Record<string, unknown> | null)
      .filter(isRecord);
    const byTrace = new Map<string, TraceRecord[]>();
    for (const batchRow of batchRows) {
      try {
        const input = JSON.parse(clean(batchRow.input_json) || '{}') as {
          steps?: unknown[];
        };
        const steps = Array.isArray(input.steps) ? input.steps : [];
        const results = JSON.parse(
          clean(batchRow.batch_results_json) || '[]',
        ) as unknown[];
        byTrace.set(
          clean(batchRow.trace_id),
          results.map((child, index) =>
            compactBatchResult(child, steps[index]),
          ),
        );
      } catch {
        byTrace.set(clean(batchRow.trace_id), []);
      }
    }

    const enrichedRows = sourceRows.map((value) => {
      if (!isRecord(value)) return value;
      const results = byTrace.get(clean(value.traceId ?? value.trace_id));
      return results?.length
        ? {
            ...value,
            batchResultsJson: results,
            batchResultsCount: results.length,
          }
        : value;
    });
    if (Array.isArray(payload)) return enrichedRows as T;
    if (!payloadRecord) return payload;
    if (Array.isArray(payloadRecord.rows)) {
      return { ...payloadRecord, rows: enrichedRows } as T;
    }
    if (Array.isArray(payloadRecord.traces)) {
      return { ...payloadRecord, traces: enrichedRows } as T;
    }
    return payload;
  } catch {
    return payload;
  } finally {
    db?.close();
  }
}

export async function createArchiveTraceHistoryResponse(input: {
  request: Request;
  dbPath: string;
  backend?: TraceSitesGatewayReadBackendAdapter;
}): Promise<Response> {
  const url = new URL(input.request.url);
  if (input.request.method !== 'GET' || url.pathname !== HISTORY_ROUTE) {
    return jsonFailure(
      'TRACE_HISTORY_ROUTE_NOT_FOUND',
      'Trace history route not found.',
      404,
    );
  }

  const direction = url.searchParams.get('direction');
  const cursor = clean(url.searchParams.get('cursor'));
  const site = url.searchParams.get('site');
  const sourceMode = url.searchParams.get('sourceMode');
  const includeRawPayload =
    url.searchParams.get('includeRawPayload') === 'true';
  if (!includeRawPayload) {
    return jsonFailure(
      'RAW_PAYLOAD_ACCESS_DENIED',
      'Raw trace history requires the private archive transport.',
      403,
    );
  }
  if (
    (direction !== 'older' && direction !== 'newer') ||
    !cursor ||
    site !== HISTORY_SITE ||
    sourceMode !== HISTORY_SOURCE_MODE
  ) {
    return jsonFailure(
      'TRACE_HISTORY_QUERY_INVALID',
      'Trace history query is invalid.',
      400,
    );
  }

  const limit = boundedLimit(url.searchParams.get('limit'));
  const backend =
    input.backend ?? createLocalTraceSitesReadBackend({ dbPath: input.dbPath });
  const readPage =
    direction === 'newer' ? backend.readNewerPage : backend.readHistoryPage;
  if (!readPage) {
    return jsonFailure(
      'TRACE_HISTORY_UNAVAILABLE',
      'Trace history is unavailable.',
      503,
    );
  }

  const backendInput: TraceSitesGatewayReadBackendInput = {
    workspaceId: 'private-tailnet-archive',
    workspaceHost: url.hostname,
    site: HISTORY_SITE,
    sourceMode: HISTORY_SOURCE_MODE,
    cursor,
    limit,
  };

  try {
    const health = await backend.resolveHealth?.(backendInput);
    if (health?.traceStoreAvailable === false) {
      return jsonFailure(
        'TRACE_STORE_UNAVAILABLE',
        'The private trace store is unavailable.',
        503,
      );
    }
    const page = await readPage(backendInput);
    const enriched = enrichTracePayloadWithBatchResults(
      { rows: page.rows },
      input.dbPath,
    );
    return jsonResponse({
      ok: true,
      publicBoundary: 'consuelo-sites-private-archive',
      route: HISTORY_ROUTE,
      data: {
        direction,
        rows: enriched.rows,
        nextCursor: page.nextCursor,
      },
    });
  } catch (_error: unknown) {
    return jsonFailure(
      'TRACE_HISTORY_READ_FAILED',
      'Trace history read failed.',
      503,
    );
  }
}

function boundedLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.min(MAX_HISTORY_PAGE_SIZE, Math.floor(parsed));
}

function jsonFailure(code: string, message: string, status: number): Response {
  return jsonResponse(
    {
      ok: false,
      publicBoundary: 'consuelo-sites-private-archive',
      route: HISTORY_ROUTE,
      error: { code, message },
    },
    status,
  );
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function compactBatchResult(result: unknown, step: unknown): TraceRecord {
  const record = asRecord(result) ?? { value: result };
  const stepRecord = asRecord(step);
  const data = asRecord(record.data);
  const output: TraceRecord = {};
  for (const key of [
    'apiVersion',
    'ok',
    'code',
    'message',
    'detail',
    'now',
    'traceId',
    'trace_id',
    'durationMs',
    'duration_ms',
    'totalTokens',
    'total_tokens',
    'inputTokens',
    'input_tokens',
    'outputTokens',
    'output_tokens',
    'exitCode',
    'exit_code',
    'tool',
    'changed',
    'costLabel',
  ]) {
    if (record[key] !== undefined) output[key] = record[key];
  }
  if (stepRecord?.tool !== undefined) {
    output.tool = stepRecord.tool;
    output.name = stepRecord.tool;
    output.traceName = stepRecord.tool;
  }
  if (stepRecord?.input !== undefined) {
    output.input = stepRecord.input;
    output.rawInputJson = compactTraceValue(stepRecord.input, 8_000);
  }
  if (stepRecord?.parallel !== undefined) output.parallel = stepRecord.parallel;
  output.status =
    record.status ??
    (record.ok === false ? 'error' : record.ok === true ? 'success' : '');
  if (record.data !== undefined) {
    output.data = compactTraceValue(record.data, 12_000);
    const childOutput =
      data?.output ??
      data?.stdout ??
      data?.content ??
      data?.text ??
      data?.message;
    if (childOutput !== undefined) {
      output.output = compactTraceValue(childOutput, 8_000);
    }
  }
  if (typeof record.stderr === 'string' && record.stderr) {
    output.stderr = record.stderr.slice(0, 4_000);
  }
  output.rawResultJson = compactTraceValue(record, 16_000);
  return output;
}

function compactTraceValue(value: unknown, limit: number): unknown {
  if (value === undefined) return undefined;
  try {
    const text = JSON.stringify(value);
    return text.length <= limit
      ? value
      : { truncated: true, preview: text.slice(0, limit) };
  } catch {
    return String(value).slice(0, limit);
  }
}

function asRecord(value: unknown): TraceRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is TraceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
