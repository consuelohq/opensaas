export type TraceHomeRow = {
  rownum?: number;
  record_id?: string;
  ts?: string;
  trace_id?: string;
  tool?: string;
  task_session?: string;
  branch?: string;
  worktree?: string;
  status?: string;
  code?: string;
  exit_code?: number | null;
  duration_ms?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  input_json?: string | null;
  resolved_input_json?: string | null;
  result_json?: string | null;
  nested_operations_json?: string | null;
  batch_results_json?: string | null;
  stderr?: string | null;
};

export type CommandQuality = { quality: 'good' | 'suspect' | 'bad'; reason: string; replacement?: string };
export type TraceChild = { tool: string; ok: boolean; status: string; durationMs: number; totalTokens: number; detail: string };
export type GroupMode = 'none' | 'branch' | 'tool';

export type NormalizedTraceRow = {
  id: string; rownum: number; time: string; timestampMs: number; traceId: string; tool: string; status: string; ok: boolean; code: string;
  durationMs: number; inputTokens: number; outputTokens: number; totalTokens: number; branch: string; shortBranch: string; command: string;
  message: string; stderr: string; raw: TraceHomeRow; children: TraceChild[]; commandQuality?: CommandQuality; sanitizedRaw: Record<string, unknown>;
};

export type TraceHomeModel = {
  header: { title: 'trace:home'; live: boolean; rows: number; errors: number; running: number; branches: number; since: string; filter: string; group: GroupMode };
  rows: NormalizedTraceRow[]; visibleRows: NormalizedTraceRow[]; summary: { rows: number; errors: number; running: number; branches: number; since: string };
  topTools: Array<{ tool: string; tokens: number; calls: number }>;
  rawShell: { total: number; good: number; suspect: number; bad: number };
  selectedIndex: number; selected?: NormalizedTraceRow;
  inspect?: { traceId: string; status: string; duration: string; tokens: string; branch: string; timing: string; command: string; stdout: string; stderr: string; commandQuality?: CommandQuality; tabs: string[] };
  tree: { lines: string[] }; rawJson: string;
};

export type TraceHomeBuildOptions = { now?: Date; selectedTraceId?: string; selectedIndex?: number; sinceLabel?: string; live?: boolean; search?: string; failedOnly?: boolean; branchFilter?: string; toolFilter?: string; group?: GroupMode; rawJson?: boolean };
export type TraceHomeRenderOptions = { width?: number; height?: number; color?: boolean };
