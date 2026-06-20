
import { createHash } from 'node:crypto';

export type TraceSitesDataState = 'fresh' | 'stale' | 'degraded';
export type TraceSitesStatus = 'ok' | 'failed' | 'running' | 'unknown';

export type TraceSitesEvent = {
  id: string;
  traceId: string;
  cursor: string;
  idempotencyKey?: string;
  workspaceId: string;
  toolName: string;
  status: TraceSitesStatus;
  startedAt?: string;
  durationMs?: number;
  code?: string;
  taskSession?: string;
  branch?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  errorCause?: string;
};

type TraceStoreRetention = {
  maxBytes?: number;
  minRows?: number;
};

type TraceStoreOptions = {
  dbPath: string;
  workspaceId: string;
  retention?: TraceStoreRetention;
  simulatedFileSizeBytes?: number;
};

type RecentRequest = {
  workspaceId: string;
  cursor?: string;
  limit?: number;
};

type RetentionRequest = {
  reason: string;
  justWrittenTraceId?: string;
};

type ObservationStore = ReturnType<typeof createTraceStoreForTest>;

function hashValue(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function cursorFor(index: number): string {
  return `cur_${String(index).padStart(3, '0')}`;
}

function cursorNumber(cursor: string | undefined): number {
  if (!cursor) return 0;
  const match = cursor.match(/cur_(\d+)/);
  return match ? Number(match[1]) : 0;
}

function normalizeStatus(status: string | undefined): TraceSitesStatus {
  if (status === 'ok' || status === 'succeeded' || status === 'success') return 'ok';
  if (status === 'failed' || status === 'error' || status === 'COMMAND_FAILED') return 'failed';
  if (status === 'running' || status === 'pending') return 'running';
  return 'unknown';
}

function sanitizeEvent(event: TraceSitesEvent): TraceSitesEvent {
  return { ...event };
}

export function createTraceStoreForTest(options: TraceStoreOptions) {
  const events: TraceSitesEvent[] = [];
  const retention = options.retention ?? {};
  let sequence = 0;

  function append(input: {
    traceId: string;
    workspaceId?: string;
    toolName: string;
    status?: string;
    startedAt?: string;
    durationMs?: number;
    code?: string;
    taskSession?: string;
    branch?: string;
    idempotencyKey?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    errorCause?: string;
  }): TraceSitesEvent {
    sequence += 1;
    const traceId = input.traceId;
    const event: TraceSitesEvent = {
      id: traceId,
      traceId,
      cursor: cursorFor(sequence),
      workspaceId: input.workspaceId ?? options.workspaceId,
      toolName: input.toolName,
      status: normalizeStatus(input.status),
      startedAt: input.startedAt,
      durationMs: input.durationMs,
      code: input.code,
      taskSession: input.taskSession,
      branch: input.branch,
      idempotencyKey: input.idempotencyKey,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd,
      errorCause: input.errorCause,
    };
    events.push(event);
    return sanitizeEvent(event);
  }

  return {
    describe() {
      return {
        ok: true,
        publicBoundary: 'consuelo-gateway' as const,
        workspaceId: options.workspaceId,
        canonicalDbPathHash: hashValue(options.dbPath),
        browserSafe: true,
      };
    },

    appendObservation: append,

    async ingestLegacyToolTrace(row: {
      trace_id?: string;
      id?: string;
      tool?: string;
      status?: string;
      code?: string;
    }) {
      return append({
        traceId: row.trace_id ?? row.id ?? `legacy_tool_${sequence + 1}`,
        toolName: row.tool ?? 'unknown-tool',
        status: row.status,
        code: row.code,
      });
    },

    async ingestLegacySkillExecution(row: {
      trace_id?: string;
      id?: string;
      name?: string;
      status?: string;
      started_at?: string;
      duration_ms?: number;
    }) {
      return append({
        traceId: row.trace_id ?? row.id ?? `legacy_skill_${sequence + 1}`,
        toolName: row.name ?? 'unknown-skill',
        status: row.status,
        startedAt: row.started_at,
        durationMs: row.duration_ms,
      });
    },

    async readRecentForTraceSites(request: RecentRequest) {
      const after = cursorNumber(request.cursor);
      const limit = request.limit ?? 50;
      const rows = events
        .filter((event) => event.workspaceId === request.workspaceId)
        .filter((event) => cursorNumber(event.cursor) > after)
        .slice(0, limit)
        .map(sanitizeEvent);
      const latestCursor = rows.at(-1)?.cursor ?? events.at(-1)?.cursor ?? request.cursor ?? 'cur_000';

      return {
        ok: true,
        publicBoundary: 'consuelo-gateway' as const,
        workspaceId: request.workspaceId,
        cursor: latestCursor,
        dataState: 'fresh' as TraceSitesDataState,
        events: rows,
      };
    },

    async enforceRetention(request: RetentionRequest) {
      const maxBytes = retention.maxBytes;
      const minRows = retention.minRows ?? 1;
      const currentBytes = options.simulatedFileSizeBytes ?? events.length * 256;

      if (maxBytes === undefined || currentBytes <= maxBytes) {
        return {
          ok: true,
          publicBoundary: 'consuelo-gateway' as const,
          dataState: 'fresh' as TraceSitesDataState,
          reason: request.reason,
          retainedRows: events.length,
        };
      }

      while (events.length > minRows) {
        const candidate = events[0];
        if (candidate?.traceId === request.justWrittenTraceId) break;
        events.shift();
        if (events.some((event) => event.traceId === request.justWrittenTraceId) && events.length <= minRows) break;
      }

      if (request.justWrittenTraceId && !events.some((event) => event.traceId === request.justWrittenTraceId)) {
        events.push({
          id: request.justWrittenTraceId,
          traceId: request.justWrittenTraceId,
          cursor: cursorFor(++sequence),
          workspaceId: options.workspaceId,
          toolName: 'unknown-tool',
          status: 'unknown',
        });
      }

      return {
        ok: true,
        publicBoundary: 'consuelo-gateway' as const,
        dataState: 'degraded' as TraceSitesDataState,
        reason: 'TRACE_STORE_SIZE_LIMIT_REACHED' as const,
        retainedRows: events.length,
      };
    },
  };
}

export function createTraceObservationService(options: { store: ObservationStore }) {
  return {
    async recordSkillExecution(input: {
      traceId: string;
      workspaceId?: string;
      name: string;
      status?: string;
      startedAt?: string;
      durationMs?: number;
    }) {
      return options.store.appendObservation({
        traceId: input.traceId,
        workspaceId: input.workspaceId,
        toolName: input.name,
        status: input.status,
        startedAt: input.startedAt,
        durationMs: input.durationMs,
      });
    },

    async recordFacadeToolExecution(input: {
      traceId: string;
      workspaceId?: string;
      toolName: string;
      taskSession?: string;
      branch?: string;
      status?: string;
      startedAt?: string;
      durationMs?: number;
      code?: string;
    }) {
      return options.store.appendObservation(input);
    },

    async recordWorkerEvent(input: {
      traceId: string;
      workspaceId?: string;
      provider?: string;
      eventType?: string;
      taskSession?: string;
      toolName?: string;
      status?: string;
      startedAt?: string;
      durationMs?: number;
    }) {
      return options.store.appendObservation({
        traceId: input.traceId,
        workspaceId: input.workspaceId,
        toolName: input.toolName ?? input.eventType ?? input.provider ?? 'worker-event',
        taskSession: input.taskSession,
        status: input.status,
        startedAt: input.startedAt,
        durationMs: input.durationMs,
      });
    },
  };
}
