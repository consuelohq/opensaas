import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { Effect } from 'effect';

import { readManyForCli, type FsReadError, type FsReadPage } from './read';

export const MAX_SEARCH_RESULTS = 200;
export const SEARCH_EXCLUDES = ['node_modules', '.git', 'dist', 'build', '.next', 'out', '.cache'];

export type FsSearchLine = { line: number; text: string };
export type FsSearchMatch = {
  type: 'match';
  path: string;
  line: number;
  text: string;
  before?: FsSearchLine[];
  after?: FsSearchLine[];
};
export type FsSearchReadSuccess = { path: string; ok: true; ranges: Array<{ from: number; to: number }>; page: FsReadPage };
export type FsSearchReadFailure = { path: string; ok: false; ranges: Array<{ from: number; to: number }>; error: FsReadError };
export type FsSearchReadResult = FsSearchReadSuccess | FsSearchReadFailure;
export type FsSearchOutput = {
  type: 'search-results';
  pattern: string;
  root: string;
  matches: FsSearchMatch[];
  truncated: boolean;
  limit: number;
  reads?: FsSearchReadResult[];
};
export type FsSearchInput = {
  pattern: string;
  paths?: string[];
  include?: string;
  context?: number;
  maxResults?: number;
  filesOnly?: boolean;
  thenRead?: boolean;
  root?: string;
};

type RipgrepResult = { status: number; stdout: string; stderr: string };

type ParsedRipgrep = {
  matches: FsSearchMatch[];
  contextByPathLine: Map<string, { before: FsSearchLine[]; after: FsSearchLine[] }>;
};

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function normalizeNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function normalizeRelativePath(root: string, candidate: string): string {
  const normalized = candidate.replace(/\\/g, path.sep);
  const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (!relative || relative === '') return path.basename(absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return normalized;
  return relative.split(path.sep).join(path.posix.sep);
}

function rootLabel(paths: string[] | undefined): string {
  if (!paths || paths.length === 0) return '.';
  if (paths.length === 1) return paths[0].replace(/^\.\//, '') || '.';
  return '.';
}

function buildRipgrepArgs(input: Required<Pick<FsSearchInput, 'pattern'>> & FsSearchInput): string[] {
  const args = ['--json', '--line-number', '--with-filename', '--color=never'];
  for (const exclude of SEARCH_EXCLUDES) args.push('--glob', '!' + exclude);
  const context = normalizeNonNegativeInt(input.context, 0);
  if (!input.filesOnly && context > 0) args.push('--context', String(context));
  if (input.include) args.push('--glob', input.include);
  if (input.filesOnly) args.push('--files-with-matches');
  args.push(input.pattern);
  const targets = input.paths && input.paths.length > 0 ? input.paths : ['.'];
  args.push(...targets);
  return args;
}

function parseJsonLine(line: string): unknown | undefined {
  if (!line.trim()) return undefined;
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function lineText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r?\n$/, '');
}

function parseRipgrepJson(stdout: string, root: string): ParsedRipgrep {
  const matches: FsSearchMatch[] = [];
  const contextByPathLine = new Map<string, { before: FsSearchLine[]; after: FsSearchLine[] }>();
  let latestMatchKey: string | undefined;
  const pendingBefore = new Map<string, FsSearchLine[]>();

  for (const raw of stdout.split('\n')) {
    const event = parseJsonLine(raw) as { type?: string; data?: Record<string, unknown> } | undefined;
    if (!event || typeof event.type !== 'string' || !event.data) continue;
    const data = event.data;
    const pathText = (data.path as { text?: unknown } | undefined)?.text;
    const filePath = typeof pathText === 'string' ? normalizeRelativePath(root, pathText) : '';
    const lineNumber = typeof data.line_number === 'number' ? data.line_number : 0;
    const lines = lineText((data.lines as { text?: unknown } | undefined)?.text);
    if (!filePath || !lineNumber) continue;

    if (event.type === 'match') {
      const before = pendingBefore.get(filePath) || [];
      pendingBefore.delete(filePath);
      const match: FsSearchMatch = { type: 'match', path: filePath, line: lineNumber, text: lines.trimEnd() };
      if (before.length > 0) match.before = before;
      matches.push(match);
      latestMatchKey = filePath + ':' + lineNumber;
      contextByPathLine.set(latestMatchKey, { before, after: [] });
      continue;
    }

    if (event.type === 'context') {
      const item = { line: lineNumber, text: lines.trimEnd() };
      const latest = latestMatchKey ? contextByPathLine.get(latestMatchKey) : undefined;
      if (latest && latestMatchKey?.startsWith(filePath + ':')) {
        latest.after.push(item);
      } else {
        const pending = pendingBefore.get(filePath) || [];
        pending.push(item);
        pendingBefore.set(filePath, pending.slice(-20));
      }
    }
  }

  for (const match of matches) {
    const context = contextByPathLine.get(match.path + ':' + match.line);
    if (!context) continue;
    if (context.before.length > 0) match.before = context.before;
    if (context.after.length > 0) match.after = context.after;
  }

  return { matches, contextByPathLine };
}

function buildReadRanges(matches: FsSearchMatch[], context: number): Map<string, Array<{ from: number; to: number }>> {
  const byPath = new Map<string, Array<{ from: number; to: number }>>();
  for (const match of matches) {
    const from = Math.max(1, match.line - context);
    const to = match.line + context;
    const ranges = byPath.get(match.path) || [];
    const last = ranges[ranges.length - 1];
    if (last && from <= last.to + 2) last.to = Math.max(last.to, to);
    else ranges.push({ from, to });
    byPath.set(match.path, ranges);
  }
  return byPath;
}

const runRipgrepEffect = (input: FsSearchInput, root: string) => Effect.try({
  try: (): RipgrepResult => {
    const proc = spawnSync('rg', buildRipgrepArgs({ ...input, pattern: input.pattern }), {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
    return { status: proc.status ?? 0, stdout: proc.stdout || '', stderr: proc.stderr || '' };
  },
  catch: (cause) => new Error('Unable to run ripgrep: ' + String((cause as Error).message || cause)),
});

const readMatchesEffect = (matches: FsSearchMatch[], input: FsSearchInput, root: string) => Effect.gen(function* () {
  const context = normalizeNonNegativeInt(input.context, 0);
  const rangesByPath = buildReadRanges(matches, context);
  const files = Array.from(rangesByPath, ([filePath, ranges]) => {
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    return { path: filePath, offset: first.from, limit: last.to - first.from + 1, ranges };
  });
  if (files.length === 0) return [];

  const readResult = yield* Effect.promise(() => readManyForCli(
    files.map(({ path: filePath, offset, limit }) => ({ path: filePath, offset, limit })),
    { root },
  ));
  const rawResults = 'results' in readResult
    ? readResult.results
    : [{ path: files[0].path, ok: readResult.type !== 'error', ...(readResult.type === 'error' ? { error: readResult } : { page: readResult }) }];

  return rawResults.map((item, index) => {
    const ranges = files[index]?.ranges || [];
    if (item.ok) return { path: item.path, ok: true, ranges, page: item.page } as FsSearchReadSuccess;
    return { path: item.path, ok: false, ranges, error: item.error } as FsSearchReadFailure;
  });
}).pipe(Effect.mapError((cause) => new Error('Unable to read search matches: ' + String((cause as Error).message || cause))));

export const searchEffect = (input: FsSearchInput) => Effect.gen(function* () {
  const root = input.root || process.cwd();
  const limit = Math.min(normalizePositiveInt(input.maxResults, MAX_SEARCH_RESULTS), MAX_SEARCH_RESULTS);
  const rg = yield* runRipgrepEffect(input, root);
  if (rg.status > 1) return yield* Effect.fail(new Error((rg.stderr || 'ripgrep failed').trim()));
  const parsed = parseRipgrepJson(rg.stdout, root);
  const truncated = parsed.matches.length > limit;
  const matches = parsed.matches.slice(0, limit);
  const output: FsSearchOutput = {
    type: 'search-results',
    pattern: input.pattern,
    root: rootLabel(input.paths),
    matches,
    truncated,
    limit,
  };
  if (input.thenRead) {
    output.reads = yield* readMatchesEffect(matches, input, root);
  }
  return output;
});

export function runSearchForCli(input: FsSearchInput): Promise<FsSearchOutput> {
  return Effect.runPromise(searchEffect(input));
}

export function formatSearchOutput(result: FsSearchOutput): string {
  if (result.matches.length === 0) return 'No files found';
  const lines = ['Found ' + result.matches.length + (result.truncated ? '+ matches' : ' matches')];
  let current = '';
  for (const match of result.matches) {
    if (current !== match.path) {
      if (current) lines.push('');
      current = match.path;
      lines.push(match.path + ':');
    }
    lines.push('  Line ' + match.line + ': ' + match.text);
  }
  if (result.reads && result.reads.length > 0) {
    lines.push('', '── then-read ──');
    for (const item of result.reads) {
      lines.push('── ' + item.path + ' ──');
      if (!item.ok) {
        lines.push(item.error.code + ': ' + item.error.message);
      } else if (item.page.type === 'text-page') {
        lines.push(item.page.content);
      } else {
        lines.push(item.page.type + ': ' + ('message' in item.page ? item.page.message : item.page.mime));
      }
    }
  }
  return lines.join('\n');
}
