export type TraceStatus = "success" | "error" | string;

export type TraceRow = {
  id?: number | string;
  recordId?: string;
  startTime?: string;
  time?: string;
  displayTime?: string;
  type?: string;
  name?: string;
  traceName?: string;
  branch?: string;
  taskSession?: string;
  status?: TraceStatus;
  code?: string;
  input?: unknown;
  output?: unknown;
  summary?: string;
  inputObj?: unknown;
  resolvedInputObj?: unknown;
  outputObj?: unknown;
  stderrObj?: unknown;
  metadata?: Record<string, unknown>;
  latency?: string;
  durationMs?: number;
  cost?: number;
  costLabel?: string;
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  rawInputJson?: string;
  rawResolvedInputJson?: string;
  rawResultJson?: string;
  rawStderr?: string;
  [key: string]: unknown;
};

export type FailureRow = Record<string, unknown>;

export type TraceFeed = {
  meta?: {
    generatedAt?: string;
    rowCount?: number;
    failureCount?: number;
    maxRowid?: number;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    [key: string]: unknown;
  };
  rows: TraceRow[];
  failures?: FailureRow[];
};

export type TraceFilters = {
  query: string;
  branch: string | null;
  tool: string | null;
  status: string | null;
};

export type TraceExplorerMode = "list" | "detail" | "filters";

export type TraceExplorerState = {
  rows: TraceRow[];
  failures: FailureRow[];
  meta: TraceFeed["meta"];
  filters: TraceFilters;
  selectedKey: string | null;
  selectedTrace: TraceRow | null;
  mode: TraceExplorerMode;
  page: number;
  pageSize: number;
  feedSignature: string;
};

export function stableTraceKey(row: TraceRow | null | undefined): string {
  if (!row) return "";
  const metadata = row.metadata ?? {};
  return String(
    row.recordId ||
      metadata.trace_id ||
      metadata.id ||
      metadata.rowid ||
      row.id ||
      "",
  );
}

export function timeOnly(value: unknown): string {
  const raw = String(value ?? "");
  const timeMatch = raw.match(/(?:T|\s)(\d{2}:\d{2}:\d{2})(?:\.\d+)?/);
  if (timeMatch) return timeMatch[1];
  const leading = raw.match(/^(\d{2}:\d{2}:\d{2})/);
  if (leading) return leading[1];
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(11, 19);
  return raw.slice(0, 8);
}

export function normalizeTraceRow(row: TraceRow): TraceRow {
  const displayTime = timeOnly(row.time || row.startTime);
  return {
    ...row,
    branch: String(row.branch || row.taskSession || "no-branch"),
    name: String(row.name || row.traceName || "unknown"),
    status: String(row.status || "success"),
    displayTime,
  };
}

export function normalizeTraceRows(rows: TraceRow[]): TraceRow[] {
  return rows.map(normalizeTraceRow);
}

export function traceFeedSignature(feed: TraceFeed | null | undefined): string {
  const meta = feed?.meta ?? {};
  return [meta.maxRowid ?? 0, meta.rowCount ?? feed?.rows?.length ?? 0, meta.failureCount ?? feed?.failures?.length ?? 0].join(":");
}

export function createTraceExplorerState(feed: TraceFeed): TraceExplorerState {
  const rows = normalizeTraceRows(feed.rows ?? []);
  return {
    rows,
    failures: feed.failures ?? [],
    meta: feed.meta ?? {},
    filters: { query: "", branch: null, tool: null, status: null },
    selectedKey: null,
    selectedTrace: null,
    mode: "list",
    page: 1,
    pageSize: 100,
    feedSignature: traceFeedSignature({ ...feed, rows }),
  };
}

export function traceByKey(rows: TraceRow[], key: string | null | undefined): TraceRow | null {
  if (!key) return null;
  return rows.find((row) => stableTraceKey(row) === key) ?? rows.find((row) => String(row.id) === key) ?? null;
}

export function selectTraceByKey(state: TraceExplorerState, key: string): TraceExplorerState {
  const selectedTrace = traceByKey(state.rows, key);
  return {
    ...state,
    selectedKey: selectedTrace ? stableTraceKey(selectedTrace) : state.selectedKey,
    selectedTrace: selectedTrace ?? state.selectedTrace,
    mode: selectedTrace ? "detail" : state.mode,
  };
}

export function applyTraceFeed(state: TraceExplorerState, feed: TraceFeed): TraceExplorerState {
  const rows = normalizeTraceRows(feed.rows ?? []);
  const signature = traceFeedSignature({ ...feed, rows });
  const selectedTrace = traceByKey(rows, state.selectedKey) ?? state.selectedTrace;
  return {
    ...state,
    rows,
    failures: feed.failures ?? [],
    meta: feed.meta ?? {},
    selectedTrace,
    selectedKey: selectedTrace ? stableTraceKey(selectedTrace) : state.selectedKey,
    mode: state.mode === "detail" ? "detail" : state.mode,
    page: Math.min(state.page, Math.max(1, Math.ceil(rows.length / state.pageSize))),
    feedSignature: signature,
  };
}

export function filterTraceRows(rows: TraceRow[], filters: TraceFilters): TraceRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.branch && String(row.branch || row.taskSession || "no-branch") !== filters.branch) return false;
    if (filters.tool && String(row.name || row.traceName || "unknown") !== filters.tool) return false;
    if (filters.status && String(row.status || "success") !== filters.status) return false;
    if (!query) return true;
    const haystack = [row.displayTime, row.name, row.branch, row.status, row.input, row.output, row.summary, stableTraceKey(row)]
      .map((value) => String(value ?? "").toLowerCase())
      .join(" ");
    return haystack.includes(query);
  });
}

export function countBy(rows: TraceRow[], key: "branch" | "tool" | "status") {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key === "branch" ? String(row.branch || row.taskSession || "no-branch") : key === "tool" ? String(row.name || row.traceName || "unknown") : String(row.status || "success");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function pageRows(rows: TraceRow[], page: number, pageSize: number): TraceRow[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}
