
type TraceReportRow = {
  id: string;
  cursor?: string;
  toolName?: string;
  status?: string;
  code?: string;
  errorCause?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
};

type ReportRequest = {
  workspaceId: string;
  window?: string;
  cursor?: string;
};

type ReportLibraryOptions = {
  readRows: (request: ReportRequest) => Promise<TraceReportRow[]>;
  now?: () => string;
};

type GatewayReportRequest = ReportRequest & {
  method?: string;
  path: string;
  session?: { workspaceId?: string; allowedSites?: string[]; capabilities?: string[] };
};

type ReportView = 'top-tools' | 'errors' | 'costs';

function latestCursor(rows: TraceReportRow[], fallback?: string): string {
  return rows.map((row) => row.cursor).filter(Boolean).at(-1) ?? fallback ?? 'cur_000';
}

function baseMeta(view: ReportView, request: ReportRequest, rows: TraceReportRow[], now: string) {
  return {
    ok: true as const,
    publicBoundary: 'consuelo-gateway' as const,
    workspaceId: request.workspaceId,
    view,
    cursor: latestCursor(rows, request.cursor),
    window: request.window ?? '24h',
    generatedAt: now,
    dataState: 'fresh' as const,
  };
}

function roundCost(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'TRACE_REPORT_UNAVAILABLE';
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function createTraceSitesReportLibrary(options: ReportLibraryOptions) {
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async topTools(request: ReportRequest) {
      try {
        const rows = await options.readRows(request);
      const grouped = new Map<string, { toolName: string; calls: number; failures: number; durationMs: number }>();
      for (const row of rows) {
        const toolName = row.toolName ?? 'unknown-tool';
        const current = grouped.get(toolName) ?? { toolName, calls: 0, failures: 0, durationMs: 0 };
        current.calls += 1;
        if (row.status === 'failed') current.failures += 1;
        current.durationMs += row.durationMs ?? 0;
        grouped.set(toolName, current);
      }
      const tools = [...grouped.values()].sort((a, b) => b.calls - a.calls || a.toolName.localeCompare(b.toolName));
      return {
        ...baseMeta('top-tools', request, rows, now()),
        report: { tools },
      };
      } catch (error: unknown) {
        throw error;
      }
    },

    async errors(request: ReportRequest) {
      try {
        const rows = await options.readRows(request);
      const grouped = new Map<string, { code: string; count: number; latestTraceId: string; message?: string }>();
      for (const row of rows.filter((candidate) => candidate.status === 'failed')) {
        const code = row.code ?? 'UNKNOWN_ERROR';
        const current = grouped.get(code) ?? { code, count: 0, latestTraceId: row.id, message: row.errorCause };
        current.count += 1;
        current.latestTraceId = row.id;
        grouped.set(code, current);
      }
      return {
        ...baseMeta('errors', request, rows, now()),
        report: { errors: [...grouped.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)) },
      };
      } catch (error: unknown) {
        throw error;
      }
    },

    async costs(request: ReportRequest) {
      try {
        const rows = await options.readRows(request);
      const inputTokens = rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0);
      const outputTokens = rows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0);
      const totalCostUsd = roundCost(rows.reduce((sum, row) => sum + (row.estimatedCostUsd ?? 0), 0));
      const zeroCostRows = rows.filter((row) => (row.estimatedCostUsd ?? 0) === 0).length;
      return {
        ...baseMeta('costs', request, rows, now()),
        report: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          totalCostUsd,
          zeroCostRows,
        },
      };
      } catch (error: unknown) {
        throw error;
      }
    },
  };
}

export function createTraceSitesGatewayReportEndpoint(options: { reporting: ReturnType<typeof createTraceSitesReportLibrary> }) {
  return {
    async handle(request: GatewayReportRequest): Promise<Response> {
      const reportRequest = {
        workspaceId: request.workspaceId,
        window: request.window ?? '24h',
        cursor: request.cursor ?? 'cur_000',
      };
      try {
        if (request.path.endsWith('/top-tools')) {
          return jsonResponse(200, await options.reporting.topTools(reportRequest));
        }
        if (request.path.endsWith('/errors')) {
          return jsonResponse(200, await options.reporting.errors(reportRequest));
        }
        if (request.path.endsWith('/costs')) {
          return jsonResponse(200, await options.reporting.costs(reportRequest));
        }
        return jsonResponse(404, {
          ok: false,
          publicBoundary: 'consuelo-gateway',
          code: 'TRACE_REPORT_NOT_FOUND',
          dataState: 'degraded',
        });
      } catch (error: unknown) {
        return jsonResponse(503, {
          ok: false,
          publicBoundary: 'consuelo-gateway',
          workspaceId: request.workspaceId,
          code: errorCode(error),
          dataState: 'degraded',
          message: 'Trace report data is unavailable.',
        });
      }
    },
  };
}
