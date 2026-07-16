import {
  branchName,
  childTraceRecords,
  clean,
  extractTraceError,
  isFailure,
  parseMaybeJson,
  type TraceRecord,
} from './model';

export type TraceTableRowFormat = {
  toolLabel: string;
  inputLabel: string;
  outputLabel: string;
  inputFull: string;
  outputFull: string;
  isError: boolean;
  statusLabel: 'success' | 'error';
};

export type TraceTableFilterState = {
  query: string;
  tools: ReadonlySet<string>;
  branches: ReadonlySet<string>;
  statuses: ReadonlySet<string>;
};

export type TraceFilterFacet = {
  value: string;
  count: number;
};

export type TraceFilterFacets = {
  tools: TraceFilterFacet[];
  branches: TraceFilterFacet[];
  statuses: TraceFilterFacet[];
};

const TOOL_LABELS: Record<string, string> = {
  'fs.apply_patch': 'fs.patch',
  'fs.search': 'files.search',
  get_steering: 'steering',
  'review.run': 'review',
  'tools.search': 'search',
};

export function formatTraceTableRow(row: TraceRecord): TraceTableRowFormat {
  const input = resolvedInput(row);
  const toolLabel = semanticToolLabel(row, input);
  const isError = isFailure(row);
  const inputLabel = summarizeInput(row, input, toolLabel);
  const outputLabel = summarizeOutput(row, input, toolLabel, isError);
  return {
    toolLabel,
    inputLabel,
    outputLabel,
    inputFull:
      valueText(
        row.rawResolvedInputJson ??
          row.rawInputJson ??
          row.inputObj ??
          row.input,
      ) || inputLabel,
    outputFull:
      valueText(
        row.rawResultJson ??
          row.outputObj ??
          row.resultObj ??
          row.output ??
          row.summary,
      ) || outputLabel,
    isError,
    statusLabel: isError ? 'error' : 'success',
  };
}

export function semanticToolLabel(
  row: TraceRecord,
  input = resolvedInput(row),
): string {
  const tool = clean(row.name ?? row.traceName ?? row.tool) || 'trace';
  if (isWorkpadActivity(row, input)) {
    if (tool === 'fs.apply_patch' || tool === 'fs.patch')
      return 'workpad.patch';
    if (tool === 'fs.read') return 'workpad.read';
    if (tool === 'fs.write') return 'workpad.edit';
    const mode = clean(input?.mode) || summaryPrefix(row.input)?.mode || 'view';
    return `workpad.${mode === 'write' ? 'edit' : mode.toLowerCase()}`;
  }
  if (tool === 'code.call') {
    const language =
      clean(input?.language) || summaryPrefix(row.input)?.language || 'code';
    const mode = clean(input?.mode) || summaryPrefix(row.input)?.mode || 'call';
    return `${normalizeLanguage(language)}.${mode.toLowerCase()}`;
  }
  if (tool === 'github') {
    const operation = clean(input?.operation);
    return operation ? `github.${operation}` : 'github';
  }
  if (tool === 'browser') {
    const action = clean(input?.action ?? input?.operation);
    return action ? `browser.${action}` : 'browser';
  }
  return TOOL_LABELS[tool] ?? tool;
}

export function traceFilterFacets(rows: TraceRecord[]): TraceFilterFacets {
  const toolCounts = new Map<string, number>();
  const branchCounts = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  for (const row of rows) {
    increment(branchCounts, branchName(row));
    increment(statusCounts, isFailure(row) ? 'error' : 'success');
    const labels = new Set([
      formatTraceTableRow(row).toolLabel,
      ...childTraceRecords(row).map(
        (child) => formatTraceTableRow(child).toolLabel,
      ),
    ]);
    for (const label of labels) increment(toolCounts, label);
  }
  return {
    tools: sortedFacets(toolCounts),
    branches: sortedFacets(branchCounts),
    statuses: sortedFacets(statusCounts),
  };
}

export function matchesTraceTableFilters(
  row: TraceRecord,
  filters: TraceTableFilterState,
): boolean {
  const branch = branchName(row);
  if (filters.branches.size && !filters.branches.has(branch)) return false;
  const status = isFailure(row) ? 'error' : 'success';
  if (filters.statuses.size && !filters.statuses.has(status)) return false;
  const records = [row, ...childTraceRecords(row)];
  if (
    filters.tools.size &&
    !records.some((record) =>
      filters.tools.has(formatTraceTableRow(record).toolLabel),
    )
  ) {
    return false;
  }
  const query = filters.query.trim().toLowerCase();
  if (!query) return true;
  return records.some((record) => {
    const formatted = formatTraceTableRow(record);
    return [
      formatted.toolLabel,
      formatted.inputLabel,
      formatted.outputLabel,
      branchName(record),
      clean(record.traceId ?? record.trace),
      clean(record.code),
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function summarizeInput(
  row: TraceRecord,
  input: Record<string, unknown> | null,
  toolLabel: string,
): string {
  const tool = clean(row.name ?? row.traceName ?? row.tool);
  if (isWorkpadActivity(row, input)) {
    const action = toolLabel.split('.').at(-1) || 'view';
    return `${action === 'patch' ? 'patch' : action} workpad.md`;
  }
  if (tool === 'code.call') {
    const rawExisting = valueText(row.input);
    const existing = isSerializedStructure(rawExisting) ? '' : rawExisting;
    const stripped = stripCodePrefix(existing, input, toolLabel);
    const visibleInput = stripped || existing;
    if (stripped && stripped !== existing && !looksLikeSourceCode(stripped)) {
      return normalizeSeparators(stripped);
    }
    const code = clean(input?.code);
    const codeSummary = summarizeCode(code, clean(input?.mode));
    return normalizeSeparators(
      !visibleInput ||
        visibleInput === code ||
        looksLikeSourceCode(visibleInput)
        ? codeSummary
        : visibleInput,
    );
  }
  if (tool === 'get_steering') return 'workspace guidance';
  if (tool === 'tools.search' || tool === 'fs.search') {
    return (
      clean(input?.query ?? input?.keyword ?? input?.pattern) ||
      valueText(row.input)
    );
  }
  if (tool === 'fs.read') {
    return (
      summarizePaths('read', input) || normalizeSeparators(valueText(row.input))
    );
  }
  if (tool === 'fs.write') {
    return (
      summarizePaths('write', input) ||
      normalizeSeparators(valueText(row.input))
    );
  }
  if (tool === 'fs.apply_patch') {
    const paths = patchPaths(input, row);
    return paths.length
      ? `patch ${paths.length} ${paths.length === 1 ? 'file' : 'files'} · ${paths.join(', ')}`
      : 'patch files';
  }
  if (tool === 'github') {
    const repo = clean(input?.repo);
    const pr = clean(input?.pr);
    const branch = clean(input?.branch ?? input?.head);
    const subject = pr ? `PR #${pr}` : branch || clean(input?.operation);
    return [subject, repo].filter(Boolean).join(' · ');
  }
  if (tool === 'batch') {
    const steps = batchSteps(input, row);
    const labels = [
      ...new Set(
        steps.map((step) => clean(record(step)?.tool)).filter(Boolean),
      ),
    ];
    return steps.length
      ? `${steps.length} operations${labels.length ? ` · ${labels.join(', ')}` : ''}`
      : normalizeSeparators(valueText(row.input));
  }
  if (tool === 'review.run') {
    return clean(input?.base ?? input?.branch) || 'current changes';
  }
  if (tool === 'verify') {
    return clean(input?.base ?? input?.branch) || 'current task';
  }
  if (tool.startsWith('task.')) {
    return (
      clean(input?.title ?? input?.branch ?? input?.stream ?? input?.message) ||
      normalizeSeparators(valueText(row.input))
    );
  }
  if (tool === 'git.diff') {
    const base = clean(input?.base);
    const head = clean(input?.head ?? input?.branch);
    return (
      [base, head].filter(Boolean).join('…') ||
      normalizeSeparators(valueText(row.input))
    );
  }
  if (tool.startsWith('browser')) {
    return (
      clean(
        input?.url ?? input?.selector ?? input?.expression ?? input?.action,
      ) || normalizeSeparators(valueText(row.input))
    );
  }
  if (tool === 'stream.context') {
    return (
      clean(input?.area ?? input?.stream) ||
      normalizeSeparators(valueText(row.input))
    );
  }
  return normalizeSeparators(summarizeObject(input) || valueText(row.input));
}

function summarizeOutput(
  row: TraceRecord,
  input: Record<string, unknown> | null,
  toolLabel: string,
  isError: boolean,
): string {
  if (isError) {
    return normalizeSeparators(
      extractTraceError(row).detail ||
        clean(row.rawStderr ?? row.stderr) ||
        valueText(row.output ?? row.summary) ||
        clean(row.code) ||
        'error',
    );
  }
  const tool = clean(row.name ?? row.traceName ?? row.tool);
  if (tool === 'get_steering') return 'steering loaded';
  const result = resultRecord(row);
  const data = record(result?.data) ?? result;
  if (tool === 'code.call') {
    const mode = toolLabel.split('.').at(-1);
    const changed = stringArray(data?.filesChanged ?? result?.filesChanged);
    if (changed.length) {
      const files = changed.map(fileName);
      return `changed ${files.length} ${files.length === 1 ? 'file' : 'files'} · ${files.join(', ')}`;
    }
    const testSummary = summarizeTests(
      clean(data?.stdout ?? result?.stdout ?? row.output),
    );
    if (testSummary) return testSummary;
    if (mode === 'read') return 'read complete';
    if (mode === 'edit') return 'edit complete';
    if (mode === 'verify') return 'verification passed';
    return 'completed';
  }
  if (tool === 'fs.apply_patch') {
    const paths = patchPaths(input, row);
    return paths.length
      ? `patched ${paths.length} ${paths.length === 1 ? 'file' : 'files'} · ${paths.join(', ')}`
      : 'patch applied';
  }
  if (tool === 'verify') return 'verification passed';
  if (tool === 'review.run') {
    const summary = record(data?.summary ?? result?.summary);
    const issues = numeric(summary?.blockingIssues ?? summary?.yourIssues);
    return issues === 0
      ? 'review passed · 0 issues'
      : `review complete · ${issues} issues`;
  }
  if (tool === 'task.start') {
    const branch = clean(data?.branch ?? result?.branch);
    return branch ? `created ${branch}` : 'task started';
  }
  if (tool === 'task.push') {
    const message = clean(data?.message ?? result?.message);
    return message ? `pushed · ${message}` : 'pushed';
  }
  if (tool === 'task.pr') {
    const stream = clean(data?.stream ?? result?.stream);
    const merged = data?.taskPrMerged === true || result?.taskPrMerged === true;
    return merged && stream ? `merged into ${stream}` : 'pull request ready';
  }
  if (tool === 'task.finish') return 'task finished · worktree removed';
  if (tool === 'github') {
    const summary = record(data?.summary ?? result?.summary);
    const state = clean(summary?.state);
    const number = clean(summary?.number);
    return (
      [state.toLowerCase(), number ? `#${number}` : '']
        .filter(Boolean)
        .join(' · ') || 'GitHub request complete'
    );
  }
  if (tool === 'batch') {
    const children = childTraceRecords(row);
    return children.length
      ? `${children.length} operations complete`
      : normalizeSeparators(
          valueText(row.output ?? row.summary) || 'batch complete',
        );
  }
  return normalizeSeparators(
    valueText(row.output ?? row.summary) ||
      clean(data?.message ?? result?.message) ||
      'completed',
  );
}

function resolvedInput(row: TraceRecord): Record<string, unknown> | null {
  const parsed = parseMaybeJson(
    row.rawResolvedInputJson ?? row.rawInputJson ?? row.inputObj,
  );
  return record(parsed) ?? record(row.input);
}

function resultRecord(row: TraceRecord): Record<string, unknown> | null {
  return record(
    parseMaybeJson(row.rawResultJson ?? row.outputObj ?? row.resultObj),
  );
}

function batchSteps(
  input: Record<string, unknown> | null,
  row: TraceRecord,
): unknown[] {
  const parsed = parseMaybeJson(
    row.rawResolvedInputJson ?? row.rawInputJson ?? input,
  );
  if (Array.isArray(parsed)) return parsed;
  const source = record(parsed);
  return Array.isArray(source?.steps) ? source.steps : [];
}

function stripCodePrefix(
  summary: string,
  input: Record<string, unknown> | null,
  toolLabel: string,
): string {
  const [labelLanguage, labelMode] = toolLabel.split('.');
  const language = clean(input?.language) || labelLanguage;
  const mode = clean(input?.mode) || labelMode;
  if (!summary) return '';
  return summary
    .replace(
      new RegExp(
        `^(?:${escapeRegExp(language)})[\\/.](?:${escapeRegExp(mode)})\\s*(?:[-–—·•]\\s*)?`,
        'i',
      ),
      '',
    )
    .trim();
}

function summaryPrefix(
  value: unknown,
): { language: string; mode: string } | null {
  const match = valueText(value).match(/^([a-z0-9_+-]+)[/.]([a-z0-9_+-]+)/i);
  return match ? { language: match[1], mode: match[2] } : null;
}

function summarizeCode(code: string, mode: string): string {
  if (!code) return mode || '';
  const patchFiles = [
    ...new Set(
      [...code.matchAll(/\*\*\* (?:Update|Add|Delete) File: ([^\n\\]+)/g)].map(
        (match) => fileName(match[1].trim()),
      ),
    ),
  ];
  if (patchFiles.length) {
    return `edit ${patchFiles.length} ${patchFiles.length === 1 ? 'file' : 'files'} · ${patchFiles.join(', ')}`;
  }
  const assignedWrite = code.match(
    /const\s+([a-zA-Z_$][\w$]*)\s*=\s*['"]([^'"]+)['"][\s\S]{0,800}?Bun\.write\(\s*\1\b/,
  );
  const directWrite = code.match(/Bun\.write\(\s*['"]([^'"]+)['"]/);
  const writePath = assignedWrite?.[2] ?? directWrite?.[1];
  if (writePath) return `edit ${fileName(writePath)}`;
  const file = code.match(
    /(?:Bun\.file|readFileSync|readFile)\(\s*['"]([^'"]+)['"]/,
  );
  if (file) {
    return `${mode === 'edit' ? 'edit' : 'read'} ${fileName(file[1])}`;
  }
  const command = spawnedCommand(code);
  if (command.length) return summarizeSpawnedCommand(command);
  const test = code.match(/(?:vitest|jest|test)\s+(?:run\s+)?([^'"\n;]+)/i);
  if (test) return `test ${test[1].trim()}`;
  if (/matchAll?[\s\S]{0,180}(?:fail|error|test)/i.test(code)) {
    return 'inspect test failures';
  }
  if (/\b(?:readFile|Bun\.file|\.text\(\))\b/.test(code)) {
    return 'inspect file contents';
  }
  if (/\b(?:writeFile|Bun\.write|applyPatch)\b/.test(code)) {
    return 'edit files';
  }
  if (mode === 'verify') return 'run verification';
  if (mode === 'edit') return 'edit source';
  if (mode === 'read') return 'inspect source';
  return 'run code';
}

function isWorkpadActivity(
  row: TraceRecord,
  input: Record<string, unknown> | null,
): boolean {
  const values = [
    row.input,
    row.summary,
    row.rawInputJson,
    row.rawResolvedInputJson,
    input?.path,
    input?.file,
    input?.paths,
    input?.files,
    input?.patch,
    input?.content,
    input?.code,
  ];
  return values.some((value) => /\bworkpad\.md\b/i.test(valueText(value)));
}

function spawnedCommand(code: string): string[] {
  const array = code.match(
    /Bun\.spawn(?:Sync)?\(\s*\[([\s\S]{0,2400}?)\]\s*(?:,|\))/,
  )?.[1];
  if (!array) return [];
  return [...array.matchAll(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)]
    .map((match) => match[1] ?? match[2] ?? '')
    .map((value) =>
      value
        .replace(/\\(["'\\])/g, '$1')
        .replace(/\\[nrt]/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function summarizeSpawnedCommand(command: string[]): string {
  const runnerIndex = command.findIndex((part) =>
    /^(?:vitest|jest|mocha)$/.test(fileName(part)),
  );
  if (runnerIndex >= 0) {
    const target = command
      .slice(runnerIndex + 1)
      .find((part) => part !== 'run' && !part.startsWith('-'));
    return target
      ? `test ${fileName(target)}`
      : `test ${fileName(command[runnerIndex])}`;
  }
  if (command[0] === 'bun' && command[1] && /\.[cm]?[jt]s$/.test(command[1])) {
    return `run ${fileName(command[1])}`;
  }
  if (command[0] === 'bunx' && command[1] === 'prettier') return 'format files';
  if (command[0] === 'git') {
    return `git ${command.slice(1, 4).join(' ')}`.trim();
  }
  if (command[0] === 'rg') {
    const query = command.slice(1).find((part) => !part.startsWith('-'));
    return query ? `search ${query}` : 'search files';
  }
  return `run ${command.slice(0, 4).map(fileName).join(' ')}`;
}

function summarizeTests(output: string): string {
  const failed = output.match(/(?:Tests?|test)\s+(\d+)\s+failed/i);
  if (failed) return `${failed[1]} tests failed`;
  const passed = output.match(/(?:Tests?|test)\s+(\d+)\s+passed/i);
  if (passed) return `${passed[1]} tests passed`;
  return '';
}

function summarizePaths(
  verb: string,
  input: Record<string, unknown> | null,
): string {
  if (!input) return '';
  const paths = stringArray(input.paths ?? input.files);
  const single = clean(input.path ?? input.file);
  if (single) paths.unshift(single);
  const unique = [...new Set(paths)].map(fileName);
  if (!unique.length) return '';
  if (unique.length === 1) return `${verb} ${unique[0]}`;
  return `${verb} ${unique.length} files · ${unique.join(', ')}`;
}

function patchPaths(
  input: Record<string, unknown> | null,
  row: TraceRecord,
): string[] {
  const patch = clean(input?.patch ?? input?.content ?? row.input);
  return [
    ...new Set(
      [...patch.matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)].map(
        (match) => fileName(match[1].trim()),
      ),
    ),
  ];
}

function summarizeObject(input: Record<string, unknown> | null): string {
  if (!input) return '';
  for (const key of [
    'query',
    'path',
    'branch',
    'title',
    'operation',
    'action',
  ]) {
    const value = clean(input[key]);
    if (value) return value;
  }
  return '';
}

function normalizeSeparators(value: string): string {
  return value
    .replace(/\s+(?:-|–|—)\s+/g, ' · ')
    .replace(/\s*·\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSerializedStructure(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed) && '[{'.includes(trimmed[0] ?? '');
}

function looksLikeSourceCode(value: string): boolean {
  return (
    /^(?:const|let|var|await|return|import|export|function|async)\b/.test(
      value,
    ) ||
    /\b(?:Bun|Promise|JSON)\./.test(value) ||
    value.includes('*** Begin Patch')
  );
}

function valueText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function fileName(value: string): string {
  return value.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? value;
}

function normalizeLanguage(value: string): string {
  return value.toLowerCase() === 'javascript' ? 'js' : value.toLowerCase();
}

function increment(map: Map<string, number>, value: string): void {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}

function sortedFacets(map: Map<string, number>): TraceFilterFacet[] {
  return [...map]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
