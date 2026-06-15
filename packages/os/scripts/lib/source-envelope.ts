import type { CallOutput, SourceEnvelope } from './types';
import type { ToolInput, ToolManifestEntry, ToolResult } from './facade/types';

type ToolSourceContext = {
  input?: ToolInput | Record<string, unknown>;
  entry?: ToolManifestEntry | null;
};

type JsonRecord = Record<string, unknown>;

const MAX_SOURCE_LINES = 80;
const MAX_VALUE_CHARS = 180;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactText(value: unknown, limit = MAX_VALUE_CHARS): string {
  const text = String(value ?? '').replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function sourceId(...parts: Array<string | number | undefined>): string {
  return ['os-source', ...parts.filter((part): part is string | number => part !== undefined && String(part).length > 0)]
    .map((part) => String(part).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('-');
}

function encodeUriPath(value: string): string {
  return encodeURIComponent(value);
}

function lineRecords(lines: string[], start = 1): Array<{ line: number; text: string }> {
  return lines.slice(0, MAX_SOURCE_LINES).map((text, index) => ({
    line: start + index,
    text,
  }));
}

function splitLines(content: string): string[] {
  const lines = content.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function sourceKindForTool(toolName: string): SourceEnvelope['kind'] {
  if (toolName === 'fs.read') return 'file';
  if (toolName === 'fs.search' || toolName === 'explore') return 'search';
  if (toolName.includes('trace')) return 'trace';
  if (toolName === 'review.run' || toolName === 'aiReview') return 'review';
  if (toolName === 'verify' || toolName === 'checkFiles') return 'verify';
  if (toolName === 'task.pr' || toolName === 'task.prs') return 'pr';
  if (toolName === 'task.push') return 'commit';
  return 'tool';
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
  if (isRecord(value)) return '{...}';
  return compactText(value);
}

function sourceLinesFromRecord(record: JsonRecord): Array<{ line: number; text: string }> {
  return Object.entries(record)
    .filter(([, value]) => value !== undefined && typeof value !== 'function')
    .slice(0, MAX_SOURCE_LINES)
    .map(([key, value], index) => ({
      line: index + 1,
      text: `${key}: ${displayValue(value)}`,
    }));
}

function urlFromRecord(record: JsonRecord): string | undefined {
  const candidates = [record.url, record.prUrl, record.githubPrUrl, record.graphitePrUrl, record.taskPrUrl, record.taskGraphitePrUrl];
  return candidates.find((value): value is string => typeof value === 'string' && value.startsWith('http'));
}

export function createSteeringSourceEnvelope(steering: string, traceId = 'latest'): SourceEnvelope {
  const lines = splitLines(steering);
  return {
    id: sourceId('get-steering', traceId),
    title: 'Consuelo OS steering',
    kind: 'steering',
    uri: `os://get_steering/${encodeUriPath(traceId)}`,
    summary: `OS steering response captured for trace ${traceId}.`,
    traceId,
    lineStart: lines.length > 0 ? 1 : undefined,
    lineEnd: lines.length > 0 ? lines.length : undefined,
    lines: lineRecords(lines, 1),
    metadata: {
      chars: steering.length,
      lineCount: lines.length,
    },
  };
}

function createFileSources(toolName: string, result: ToolResult<unknown>): SourceEnvelope[] {
  if (!Array.isArray(result.data)) return [];
  return result.data.flatMap((entry, index): SourceEnvelope[] => {
    if (!isRecord(entry)) return [];
    const filePath = typeof entry.path === 'string' ? entry.path : '';
    const lines = Array.isArray(entry.lines) ? entry.lines.filter((line): line is string => typeof line === 'string') : [];
    if (!filePath || lines.length === 0) return [];
    const from = typeof entry.from === 'number' ? entry.from : 1;
    const to = typeof entry.to === 'number' ? entry.to : from + lines.length - 1;
    return [{
      id: sourceId(toolName, result.traceId, index + 1),
      title: filePath,
      kind: 'file',
      uri: `os://file/${encodeUriPath(filePath)}?from=${from}&to=${to}`,
      summary: `${toolName} returned ${filePath}:${from}-${to}.`,
      toolName,
      traceId: result.traceId,
      lineStart: from,
      lineEnd: to,
      lines: lineRecords(lines, from),
      metadata: {
        total: entry.total,
      },
    }];
  });
}

function createSearchSource(toolName: string, result: ToolResult<unknown>, context: ToolSourceContext): SourceEnvelope[] {
  const input = context.input ?? {};
  const query = typeof input.pattern === 'string'
    ? input.pattern
    : typeof input.query === 'string'
      ? input.query
      : toolName;
  const records = Array.isArray(result.data) ? result.data.filter(isRecord) : [];
  if (records.length === 0) return [];
  const lines = records.slice(0, MAX_SOURCE_LINES).map((record, index) => {
    const file = typeof record.file === 'string' ? record.file : typeof record.path === 'string' ? record.path : 'result';
    const line = typeof record.line === 'number' ? `:${record.line}` : '';
    const text = typeof record.text === 'string'
      ? record.text
      : typeof record.preview === 'string'
        ? record.preview
        : compactText(record.reason ?? record.message ?? record.symbol ?? 'match');
    return { line: index + 1, text: `${file}${line} ${compactText(text)}` };
  });
  return [{
    id: sourceId(toolName, result.traceId, 'results'),
    title: `${toolName} results: ${query}`,
    kind: 'search',
    uri: `os://search/${encodeUriPath(query)}?tool=${encodeURIComponent(toolName)}`,
    summary: `${toolName} returned ${records.length} result${records.length === 1 ? '' : 's'}.`,
    toolName,
    traceId: result.traceId,
    lineStart: lines.length > 0 ? 1 : undefined,
    lineEnd: lines.length > 0 ? lines.length : undefined,
    lines,
    metadata: {
      resultCount: records.length,
    },
  }];
}

function createGenericToolSource(toolName: string, result: ToolResult<unknown>, context: ToolSourceContext): SourceEnvelope[] {
  const kind = sourceKindForTool(toolName);
  const record = isRecord(result.data) ? result.data : { value: result.data };
  const url = urlFromRecord(record);
  const title = kind === 'pr' && typeof record.prNumber === 'number'
    ? `PR #${record.prNumber} — ${toolName}`
    : kind === 'commit' && typeof record.sha === 'string'
      ? `Commit ${record.sha.slice(0, 12)} — ${toolName}`
      : `${toolName} result`;
  return [{
    id: sourceId(toolName, result.traceId, kind),
    title,
    kind,
    uri: `os://tool/${encodeURIComponent(toolName)}/${encodeUriPath(result.traceId)}`,
    summary: compactText(result.message || context.entry?.description || `${toolName} completed.`),
    toolName,
    traceId: result.traceId,
    url,
    lines: sourceLinesFromRecord(record),
    metadata: {
      ok: result.ok,
      code: result.code,
      durationMs: result.durationMs,
      category: context.entry?.category,
      permission: context.entry?.capabilities.readOnly ? 'read' : 'write',
    },
  }];
}

export function buildToolSources(toolName: string, result: ToolResult<unknown>, context: ToolSourceContext = {}): SourceEnvelope[] {
  if (toolName === 'fs.read') {
    const fileSources = createFileSources(toolName, result);
    return fileSources.length > 0 ? fileSources : createGenericToolSource(toolName, result, context);
  }
  if (toolName === 'fs.search' || toolName === 'explore') {
    const searchSources = createSearchSource(toolName, result, context);
    return searchSources.length > 0 ? searchSources : createGenericToolSource(toolName, result, context);
  }
  return createGenericToolSource(toolName, result, context);
}

export function wrapToolResultWithSources<TData>(
  toolName: string,
  result: ToolResult<TData>,
  context: ToolSourceContext = {},
): ToolResult<TData> {
  const generated = buildToolSources(toolName, result as ToolResult<unknown>, context);
  if (generated.length === 0) return result;
  return {
    ...result,
    sources: [...(result.sources ?? []), ...generated],
  };
}

export function wrapCallOutputWithSources(
  output: CallOutput,
  context: { input?: unknown } = {},
): CallOutput {
  if (output.sources && output.sources.length > 0) return output;
  const source: SourceEnvelope = {
    id: sourceId(output.name, output.traceId, 'call'),
    title: `${output.name} call`,
    kind: 'tool',
    uri: `os://call/${encodeURIComponent(output.name)}/${encodeUriPath(output.traceId ?? 'latest')}`,
    summary: output.ok ? `${output.name} completed.` : output.error?.message ?? `${output.name} failed.`,
    toolName: output.name,
    traceId: output.traceId,
    lines: sourceLinesFromRecord({
      ok: output.ok,
      permission: output.permission,
      durationMs: output.durationMs,
      input: context.input,
      error: output.error?.message,
    }),
  };
  return {
    ...output,
    sources: [source],
  };
}

