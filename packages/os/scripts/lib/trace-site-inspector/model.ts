export type TraceRecord = Record<string, unknown>;

export type TraceChildRecord = TraceRecord & {
  __traceSelectionKey: string;
  __traceParentKey: string;
  __traceDepth: number;
  __tracePath: string;
};

export type BranchSummary = {
  branch: string;
  calls: number;
  failures: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  peers: TraceRecord[];
};

export type TraceErrorInsight = {
  code: string;
  exitCode: number | null;
  failedTool: string | null;
  headline: string;
  detail: string;
};

const GENERIC_FAILURE =
  /^(?:error|failed|command failed|command failed with exit code \d+|process exited with code \d+)\.?$/i;
const FAILURE_STATUS = /^(?:error|failed|failure|timeout|timed_out)$/i;

export function stableTraceKey(row: TraceRecord | null | undefined): string {
  if (!row) return '';
  const metadata = asRecord(row.metadata);
  return clean(
    row.__traceSelectionKey ??
      row.recordId ??
      row.id ??
      metadata?.trace_id ??
      row.traceId ??
      row.trace ??
      metadata?.id ??
      metadata?.rowid,
  );
}

export function traceParentKey(row: TraceRecord | null | undefined): string {
  return clean(row?.__traceParentKey) || stableTraceKey(row);
}

export function isBatchChild(row: TraceRecord | null | undefined): boolean {
  return Boolean(clean(row?.__traceParentKey));
}

export function branchName(row: TraceRecord | null | undefined): string {
  for (const candidate of [row?.workPath, row?.branch, row?.taskSession, row?.workSession]) {
    const value = clean(candidate);
    if (value) return value;
  }
  return 'no-branch';
}

export function traceNodeId(row: TraceRecord | null | undefined): string {
  if (!row) return '';
  const metadata = asRecord(row.metadata);
  return clean(
    row.resolvedNodeId ??
      row.nodeId ??
      metadata?.resolvedNodeId ??
      metadata?.nodeId,
  );
}

export function traceNodeLabel(row: TraceRecord | null | undefined): string {
  if (!row) return '';
  const metadata = asRecord(row.metadata);
  return clean(
    row.resolvedNodeName ??
      row.nodeName ??
      metadata?.resolvedNodeName ??
      metadata?.nodeName,
  ) || traceNodeId(row);
}

export function traceRouteSource(row: TraceRecord | null | undefined): string {
  if (!row) return '';
  const metadata = asRecord(row.metadata);
  return clean(row.routeSource ?? metadata?.routeSource);
}

export function traceRouteLabel(row: TraceRecord | null | undefined): string {
  const source = traceRouteSource(row);
  if (!source) return '';
  if (source === 'default') return 'Default';
  if (source === 'explicit') return 'Explicit';
  if (source === 'task' || source === 'task_affinity' || source === 'task-affinity') {
    return 'Task';
  }
  return source
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isFailure(row: TraceRecord | null | undefined): boolean {
  if (!row) return false;
  if (row.ok === false) return true;
  if (FAILURE_STATUS.test(clean(row.status))) return true;
  const code = clean(row.code);
  return Boolean(code && code !== 'OK' && code !== 'SUCCESS');
}

export function dedupeTraceRows(rows: Iterable<TraceRecord>): TraceRecord[] {
  const result: TraceRecord[] = [];
  const seen = new Set<string>();
  let anonymous = 0;
  for (const row of rows) {
    const key = stableTraceKey(row) || `anonymous-${anonymous++}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

export function branchSummary(
  rows: Iterable<TraceRecord>,
  selected: TraceRecord,
): BranchSummary {
  const branch = branchName(selected);
  const peers = dedupeTraceRows(rows)
    .filter((row) => branchName(row) === branch)
    .sort((a, b) => timestamp(b) - timestamp(a));

  return {
    branch,
    calls: peers.length,
    failures: peers.filter(isFailure).length,
    durationMs: peers.reduce((sum, row) => sum + number(row.durationMs), 0),
    inputTokens: peers.reduce((sum, row) => sum + number(row.inputTokens), 0),
    outputTokens: peers.reduce((sum, row) => sum + number(row.outputTokens), 0),
    totalTokens: peers.reduce((sum, row) => sum + totalTokens(row), 0),
    peers,
  };
}

export function extractTraceError(row: TraceRecord): TraceErrorInsight {
  const baseCode = clean(row.code) || 'UNKNOWN_ERROR';
  const baseExit = optionalNumber(row.exitCode);
  const candidates: ErrorCandidate[] = [];

  addCandidate(candidates, row.rawStderr, {
    score: 150,
    path: 'stderr',
    code: baseCode,
    exitCode: baseExit,
    tool: clean(row.name ?? row.traceName) || null,
  });

  for (const [key, value, score] of [
    ['batchResultsJson', row.batchResultsJson, 120],
    ['outputObj', row.outputObj, 100],
    ['rawResultJson', row.rawResultJson, 95],
    ['stderrObj', row.stderrObj, 90],
    ['output', row.output, 55],
  ] as const) {
    walkErrorCandidates(parseMaybeJson(value), candidates, {
      score,
      path: key,
      code: baseCode,
      exitCode: baseExit,
      tool: clean(row.name ?? row.traceName) || null,
      depth: 0,
    });
  }

  const best = candidates
    .filter((candidate) => candidate.value.length > 0)
    .sort((a, b) => b.score - a.score || b.value.length - a.value.length)[0];
  const detail = best?.value || fallbackErrorDetail(row);
  const code = best?.code || baseCode;
  const exitCode = best?.exitCode ?? baseExit;
  const failedTool = best?.tool || clean(row.name ?? row.traceName) || null;
  const headline = [
    failedTool,
    code,
    exitCode === null ? '' : `exit ${exitCode}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    code,
    exitCode,
    failedTool,
    headline: headline || 'Trace failure',
    detail,
  };
}

export function parseMaybeJson(value: unknown): unknown {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    if (typeof current !== 'string') break;
    const text = current.trim();
    if (
      !text ||
      (!text.startsWith('{') && !text.startsWith('[') && !text.startsWith('"'))
    )
      break;
    try {
      current = JSON.parse(text);
    } catch {
      break;
    }
  }
  return current;
}

const childTraceCache = new WeakMap<
  TraceRecord,
  { source: unknown; stepsSource: unknown; children: TraceChildRecord[] }
>();

function isTraceShapedChild(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  const metadata = asRecord(record.metadata);
  return Boolean(
    clean(record.tool ?? record.toolName ?? record.facadeTool) ||
      clean(
        record.traceId ??
          record.trace_id ??
          metadata?.traceId ??
          metadata?.trace_id,
      ) ||
      clean(record.parentTraceId ?? record.parent_trace_id) ||
      clean(record.__traceSelectionKey),
  );
}

export function childTraceRecords(parent: TraceRecord): TraceChildRecord[] {
  const sourceValue = parent.batchResultsJson;
  const stepsSourceValue =
    parent.rawResolvedInputJson ??
    parent.rawInputJson ??
    parent.inputObj ??
    parent.input;
  const cached = childTraceCache.get(parent);
  if (
    cached &&
    cached.source === sourceValue &&
    cached.stepsSource === stepsSourceValue
  ) {
    return cached.children;
  }

  const parsed = parseMaybeJson(sourceValue);
  const parsedRecord = asRecord(parsed);
  const source = Array.isArray(parsed)
    ? parsed
    : (parsedRecord?.children ?? parsedRecord?.results);
  const parsedSteps = parseMaybeJson(stepsSourceValue);
  const parsedStepsRecord = asRecord(parsedSteps);
  const steps = Array.isArray(parsedSteps)
    ? parsedSteps
    : Array.isArray(parsedStepsRecord?.steps)
      ? parsedStepsRecord.steps
      : [];
  if (!Array.isArray(source)) {
    childTraceCache.set(parent, {
      source: sourceValue,
      stepsSource: stepsSourceValue,
      children: [],
    });
    return [];
  }

  const parentKey = stableTraceKey(parent);
  const result: TraceChildRecord[] = [];
  const walk = (
    value: unknown,
    depth: number,
    parentPath: string,
    siblingIndex: number,
  ): void => {
    const record = asRecord(value);
    if (!record) return;
    const stepRecord = depth === 1 ? asRecord(steps[siblingIndex]) : null;
    const mergedRecord = stepRecord ? { ...stepRecord, ...record } : record;
    const data = asRecord(mergedRecord.data);
    const parentMetadata = asRecord(parent.metadata);
    const label =
      clean(
        mergedRecord.tool ??
          mergedRecord.name ??
          mergedRecord.facadeTool ??
          mergedRecord.label,
      ) || 'child';
    const segment = `${siblingIndex}:${label}`;
    const path = parentPath ? `${parentPath}/${segment}` : segment;
    const nativeKey = stableTraceKey(record);
    const selectionKey = nativeKey || `${parentKey}::child:${path}`;
    const status =
      clean(mergedRecord.status) ||
      (mergedRecord.ok === false
        ? 'error'
        : mergedRecord.ok === true
          ? 'success'
          : '');
    const child = {
      ...mergedRecord,
      name:
        mergedRecord.name ??
        mergedRecord.tool ??
        mergedRecord.facadeTool ??
        mergedRecord.label,
      traceName:
        mergedRecord.traceName ??
        mergedRecord.name ??
        mergedRecord.tool ??
        mergedRecord.facadeTool,
      traceId: mergedRecord.traceId ?? mergedRecord.trace_id,
      branch: mergedRecord.branch ?? parent.branch,
      taskSession: mergedRecord.taskSession ?? parent.taskSession,
      worktree: mergedRecord.worktree ?? parent.worktree,
      workSession:
        mergedRecord.workSession ?? parent.workSession ?? parentMetadata?.workSession,
      workPath: mergedRecord.workPath ?? parent.workPath ?? parentMetadata?.workPath,
      requestedNodeId:
        mergedRecord.requestedNodeId ??
        parent.requestedNodeId ??
        parentMetadata?.requestedNodeId,
      resolvedNodeId:
        mergedRecord.resolvedNodeId ??
        parent.resolvedNodeId ??
        parentMetadata?.resolvedNodeId,
      nodeId: mergedRecord.nodeId ?? parent.nodeId ?? parentMetadata?.nodeId,
      resolvedNodeName:
        mergedRecord.resolvedNodeName ??
        parent.resolvedNodeName ??
        parentMetadata?.resolvedNodeName,
      nodeName:
        mergedRecord.nodeName ?? parent.nodeName ?? parentMetadata?.nodeName,
      defaultNodeId:
        mergedRecord.defaultNodeId ??
        parent.defaultNodeId ??
        parentMetadata?.defaultNodeId,
      routeSource:
        mergedRecord.routeSource ?? parent.routeSource ?? parentMetadata?.routeSource,
      startTime: mergedRecord.startTime ?? parent.startTime,
      displayTime: mergedRecord.displayTime ?? parent.displayTime,
      status,
      durationMs:
        mergedRecord.durationMs ??
        mergedRecord.duration_ms ??
        data?.durationMs ??
        data?.duration_ms,
      inputTokens:
        mergedRecord.inputTokens ??
        mergedRecord.input_tokens ??
        data?.inputTokens ??
        data?.input_tokens,
      outputTokens:
        mergedRecord.outputTokens ??
        mergedRecord.output_tokens ??
        data?.outputTokens ??
        data?.output_tokens,
      tokens:
        mergedRecord.tokens ??
        mergedRecord.totalTokens ??
        mergedRecord.total_tokens ??
        data?.totalTokens,
      input:
        record.input ??
        record.rawInputJson ??
        record.inputObj ??
        stepRecord?.input ??
        data?.input,
      rawInputJson:
        record.rawInputJson ??
        record.inputObj ??
        stepRecord?.input ??
        mergedRecord.rawInputJson,
      output:
        mergedRecord.output ??
        mergedRecord.message ??
        data?.output ??
        data?.stdout ??
        data?.message,
      rawResultJson: mergedRecord.rawResultJson ?? record,
      __traceSelectionKey: selectionKey,
      __traceParentKey: parentKey,
      __traceDepth: depth,
      __tracePath: path,
    } as TraceChildRecord;
    result.push(child);

    const nestedParsed = parseMaybeJson(
      record.children ?? record.results ?? data?.children ?? data?.results,
    );
    if (Array.isArray(nestedParsed)) {
      nestedParsed.forEach((nested, index) => {
        if (isTraceShapedChild(nested)) {
          walk(nested, depth + 1, path, index);
        }
      });
    }
  };
  source.forEach((child, index) => walk(child, 1, '', index));
  childTraceCache.set(parent, {
    source: sourceValue,
    stepsSource: stepsSourceValue,
    children: result,
  });
  return result;
}

export function totalTokens(row: TraceRecord): number {
  const explicit = optionalNumber(
    row.tokens ?? row.totalTokens ?? row.total_tokens,
  );
  if (explicit !== null && explicit > 0) return explicit;
  const input = optionalNumber(row.inputTokens ?? row.input_tokens);
  const output = optionalNumber(row.outputTokens ?? row.output_tokens);
  const recorded = (input ?? 0) + (output ?? 0);
  if (recorded > 0) return recorded;

  // Older facade traces did not persist token estimates consistently. Rebuild the
  // same chars/4 payload estimate used by batch/codemode so historical rows are
  // useful without mutating the trace database.
  return (
    estimatePayloadTokens(
      row.rawResolvedInputJson ?? row.rawInputJson ?? row.resolvedInputObj ?? row.inputObj ?? row.input,
    ) +
    estimatePayloadTokens(
      row.rawResultJson ?? row.outputObj ?? row.output ?? row.summary ?? row.rawStderr,
    )
  );
}

function estimatePayloadTokens(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  let text: string;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = String(value ?? '');
  }
  return text ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}

export function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clean(value: unknown): string {
  return String(value ?? '').trim();
}

type ErrorCandidate = {
  value: string;
  score: number;
  path: string;
  code: string;
  exitCode: number | null;
  tool: string | null;
};

type CandidateContext = Omit<ErrorCandidate, 'value'> & { depth?: number };

function addCandidate(
  candidates: ErrorCandidate[],
  value: unknown,
  context: CandidateContext,
): void {
  if (value === null || value === undefined) return;
  const text = typeof value === 'string' ? value.trim() : stringify(value);
  if (!text) return;
  const bounded = text.slice(0, 20_000);
  const genericPenalty = GENERIC_FAILURE.test(bounded) ? 100 : 0;
  const specificity =
    /no such|not found|timed out|timeout|denied|invalid|missing|required|unsafe|blocked|cannot|failed to|exception|syntax|permission/i.test(
      bounded,
    )
      ? 24
      : 0;
  candidates.push({
    value: bounded,
    score: context.score + specificity - genericPenalty,
    path: context.path,
    code: context.code,
    exitCode: context.exitCode,
    tool: context.tool,
  });
}

function walkErrorCandidates(
  value: unknown,
  candidates: ErrorCandidate[],
  context: CandidateContext,
): void {
  const parsed = parseMaybeJson(value);
  const depth = context.depth ?? 0;
  if (depth > 7 || parsed === null || parsed === undefined) return;
  if (typeof parsed === 'string') {
    addCandidate(candidates, parsed, context);
    return;
  }
  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) =>
      walkErrorCandidates(item, candidates, {
        ...context,
        path: `${context.path}[${index}]`,
        depth: depth + 1,
      }),
    );
    return;
  }
  const record = asRecord(parsed);
  if (!record) return;

  const localCode = clean(record.code) || context.code;
  const localExit =
    optionalNumber(record.exitCode ?? record.exit_code) ?? context.exitCode;
  const localTool =
    clean(record.tool ?? record.name ?? record.facadeTool) || context.tool;
  const failed =
    record.ok === false ||
    FAILURE_STATUS.test(clean(record.status)) ||
    (localCode && localCode !== 'OK' && localCode !== 'SUCCESS');

  const weightedKeys: Record<string, number> = {
    stderr: 145,
    error: 135,
    errorCause: 130,
    cause: 128,
    reason: 126,
    message: 122,
    detail: 115,
    diagnostics: 108,
    stdout: 52,
    output: 45,
  };

  for (const [key, item] of Object.entries(record)) {
    const extra = weightedKeys[key] ?? 0;
    const nextContext = {
      score: context.score + extra + (failed ? 18 : 0),
      path: `${context.path}.${key}`,
      code: localCode,
      exitCode: localExit,
      tool: localTool,
      depth: depth + 1,
    };
    if (extra > 0 && (typeof item === 'string' || typeof item === 'number')) {
      addCandidate(candidates, item, nextContext);
    }
    if (
      typeof item === 'object' ||
      (typeof item === 'string' && /^[\s]*[\[{]/.test(item))
    ) {
      walkErrorCandidates(item, candidates, nextContext);
    }
  }
}

function fallbackErrorDetail(row: TraceRecord): string {
  const output = clean(row.output ?? row.summary);
  if (output && !GENERIC_FAILURE.test(output)) return output;
  const code = clean(row.code) || 'UNKNOWN_ERROR';
  const exit = optionalNumber(row.exitCode);
  return exit === null ? code : `${code} (exit ${exit})`;
}

function timestamp(row: TraceRecord): number {
  const value = clean(row.startTime ?? row.time ?? row.ts);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): TraceRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as TraceRecord)
    : null;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}
