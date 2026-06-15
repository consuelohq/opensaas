import fs from 'node:fs';
import path from 'node:path';

import { Effect, Schema } from "effect";

export const MAX_READ_LINES = 2_000;
export const MAX_READ_BYTES = 50 * 1024;
export const MAX_MEDIA_INGEST_BYTES = 20 * 1024 * 1024;
export const MAX_LINE_LENGTH = 2_000;
export const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;
const CHUNK_SIZE = 64 * 1024;

export const FsReadPageInput = Schema.Struct({
  path: Schema.String,
  offset: Schema.optional(Schema.Number),
  limit: Schema.optional(Schema.Number),
  from: Schema.optional(Schema.Number),
  to: Schema.optional(Schema.Number),
});

export type FsReadFileInput = { path: string; offset?: number; limit?: number; from?: number; to?: number };
export type FsReadTextPage = { type: 'text-page'; path: string; mime: string; encoding: 'utf8'; offset: number; limit: number; content: string; truncated: boolean; next?: number; totalLines?: number };
export type FsReadBinary = { type: 'binary'; path: string; mime?: string; sizeBytes: number; message: string };
export type FsReadMedia = { type: 'media'; path: string; mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; sizeBytes: number; encoding: 'base64'; content: string };
export type FsReadError = { type: 'error'; code: string; path?: string; message: string };
export type FsReadPage = FsReadTextPage | FsReadBinary | FsReadMedia;
export type FsReadResult = FsReadPage | FsReadError;
export type FsReadManyResult = FsReadResult | { results: Array<{ path: string; ok: true; page: FsReadPage } | { path: string; ok: false; error: FsReadError }> };

type ResolvedPath = { inputPath: string; displayPath: string; absolutePath: string; realPath: string; rootRealPath: string };

const binaryExtensions = new Set(['.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.class', '.jar', '.war', '.7z', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.bin', '.dat', '.obj', '.o', '.a', '.lib', '.wasm', '.pyc', '.pyo']);

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function imageMime(bytes: Uint8Array): FsReadMedia['mime'] | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  return undefined;
}

function mimeType(filePath: string, fallback = 'application/octet-stream'): string {
  const table: Record<string, string> = {
    '.css': 'text/css', '.csv': 'text/csv', '.gif': 'image/gif', '.htm': 'text/html', '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.jsonl': 'application/x-ndjson', '.md': 'text/markdown', '.mjs': 'text/javascript', '.pdf': 'application/pdf', '.png': 'image/png', '.py': 'text/x-python', '.ts': 'text/typescript', '.tsx': 'text/tsx', '.txt': 'text/plain', '.webp': 'image/webp', '.xml': 'application/xml', '.yaml': 'application/yaml', '.yml': 'application/yaml',
  };
  return table[path.extname(filePath).toLowerCase()] || fallback;
}

function containsPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function displayPath(inputPath: string, rootRealPath: string, realPath?: string): string {
  if (!path.isAbsolute(inputPath)) return inputPath.replace(/^\.\//, '');
  if (realPath && containsPath(rootRealPath, realPath)) return path.relative(rootRealPath, realPath) || path.basename(realPath);
  return inputPath;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function pageFromInput(input: FsReadFileInput): { offset: number; limit: number } {
  const offset = normalizePositiveInt(input.offset ?? input.from, 1);
  if (input.limit !== undefined) return { offset, limit: Math.min(normalizePositiveInt(input.limit, MAX_READ_LINES), MAX_READ_LINES) };
  if (input.to !== undefined) {
    const to = normalizePositiveInt(input.to, offset);
    return { offset, limit: Math.min(Math.max(1, to - offset + 1), MAX_READ_LINES) };
  }
  return { offset, limit: MAX_READ_LINES };
}

function readError(code: string, message: string, inputPath?: string): FsReadError {
  return { type: 'error', code, ...(inputPath ? { path: inputPath } : {}), message };
}

function binaryResult(resolved: ResolvedPath, sizeBytes: number, message: string, mime?: string): FsReadBinary {
  return { type: 'binary', path: resolved.displayPath, mime: mime || mimeType(resolved.realPath), sizeBytes, message };
}

function isProbablyBinary(resource: string, bytes: Uint8Array): boolean {
  if (binaryExtensions.has(path.extname(resource).toLowerCase())) return true;
  if (bytes.length === 0) return false;
  let nonPrintable = 0;
  for (const byte of bytes) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) nonPrintable += 1;
  }
  return nonPrintable / bytes.length > 0.3;
}

const resolveResourceEffect = (inputPath: string, root: string) => Effect.gen(function* () {
  const rootRealPath = yield* Effect.try({ try: () => fs.realpathSync(root), catch: (cause) => readError('ROOT_NOT_FOUND', `Root is not readable: ${String((cause as Error).message || cause)}`) });
  const absolutePath = path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(rootRealPath, inputPath);
  if (!containsPath(rootRealPath, absolutePath)) return yield* Effect.fail(readError('PATH_OUTSIDE_ROOT', `Path escapes the allowed root: ${inputPath}`, inputPath));
  if (!fs.existsSync(absolutePath)) return yield* Effect.fail(readError('NOT_FOUND', `Path not found: ${inputPath}`, inputPath));
  const realPath = yield* Effect.try({ try: () => fs.realpathSync(absolutePath), catch: (cause) => readError('NOT_FOUND', `Path not found or not readable: ${inputPath}: ${String((cause as Error).message || cause)}`, inputPath) });
  if (!containsPath(rootRealPath, realPath)) return yield* Effect.fail(readError('PATH_OUTSIDE_ROOT', `Path resolves outside the allowed root: ${inputPath}`, inputPath));
  return { inputPath, displayPath: displayPath(inputPath, rootRealPath, realPath), absolutePath, realPath, rootRealPath } satisfies ResolvedPath;
});

const readFirstBytesEffect = (filePath: string, size: number) => Effect.try({
  try: () => {
    const fd = fs.openSync(filePath, 'r');
    try {
      const length = Math.min(CHUNK_SIZE, Math.max(0, size));
      const buffer = Buffer.alloc(length);
      const bytesRead = length === 0 ? 0 : fs.readSync(fd, buffer, 0, length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      fs.closeSync(fd);
    }
  },
  catch: (cause) => readError('READ_FAILED', `Failed to read file: ${String((cause as Error).message || cause)}`),
});

const readMediaEffect = (resolved: ResolvedPath, mime: FsReadMedia['mime'], sizeBytes: number) => Effect.try({
  try: (): FsReadMedia | FsReadError => {
    if (sizeBytes > MAX_MEDIA_INGEST_BYTES) return readError('MEDIA_TOO_LARGE', `Media exceeds ${MAX_MEDIA_INGEST_BYTES} byte ingestion limit: ${resolved.displayPath}`, resolved.displayPath);
    return { type: 'media', path: resolved.displayPath, mime, sizeBytes, encoding: 'base64', content: fs.readFileSync(resolved.realPath).toString('base64') };
  },
  catch: (cause) => readError('READ_FAILED', `Failed to read media: ${String((cause as Error).message || cause)}`, resolved.displayPath),
});

function appendLine(state: { lines: string[]; bytes: number; line: number; found: boolean; truncated: boolean; next?: number }, lineText: string, offset: number, limit: number): void {
  if (state.line < offset) {
    state.line += 1;
    return;
  }
  if (state.lines.length >= limit || state.bytes >= MAX_READ_BYTES) {
    state.truncated = true;
    state.next ??= state.line;
    state.line += 1;
    return;
  }
  state.found = true;
  const visible = lineText.length > MAX_LINE_LENGTH ? `${lineText.slice(0, MAX_LINE_LENGTH)}${MAX_LINE_SUFFIX}` : lineText;
  const size = Buffer.byteLength(visible, 'utf8') + (state.lines.length > 0 ? 1 : 0);
  if (state.bytes + size > MAX_READ_BYTES) {
    state.truncated = true;
    state.next ??= state.line;
    state.line += 1;
    return;
  }
  state.lines.push(visible);
  state.bytes += size;
  state.line += 1;
}

function consumeTextChunk(decoder: TextDecoder, bytes: Uint8Array, mutable: { pending: string; discard: boolean }, state: { lines: string[]; bytes: number; line: number; found: boolean; truncated: boolean; next?: number }, offset: number, limit: number): void {
  if (bytes.includes(0)) throw new Error('BINARY_NULL_BYTE');
  let text = decoder.decode(bytes, { stream: true });
  while (true) {
    const index = text.indexOf('\n');
    if (index === -1) {
      if (!mutable.discard) {
        mutable.pending += text;
        if (mutable.pending.length > MAX_LINE_LENGTH) {
          mutable.pending = mutable.pending.slice(0, MAX_LINE_LENGTH + 1);
          mutable.discard = true;
        }
      }
      break;
    }
    const current = mutable.pending + (mutable.discard ? '' : text.slice(0, index));
    mutable.pending = '';
    mutable.discard = false;
    text = text.slice(index + 1);
    appendLine(state, current.endsWith('\r') ? current.slice(0, -1) : current, offset, limit);
  }
}

const readTextPageEffect = (resolved: ResolvedPath, input: FsReadFileInput, sizeBytes: number) => Effect.try({
  try: (): FsReadTextPage | FsReadError => {
    const { offset, limit } = pageFromInput(input);
    const fd = fs.openSync(resolved.realPath, 'r');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const state = { lines: [] as string[], bytes: 0, line: 1, found: false, truncated: false, next: undefined as number | undefined };
    const mutable = { pending: '', discard: false };
    let position = 0;
    try {
      while (position < sizeBytes) {
        const length = Math.min(CHUNK_SIZE, sizeBytes - position);
        const buffer = Buffer.alloc(length);
        const bytesRead = fs.readSync(fd, buffer, 0, length, position);
        if (bytesRead <= 0) break;
        consumeTextChunk(decoder, buffer.subarray(0, bytesRead), mutable, state, offset, limit);
        position += bytesRead;
      }
      const tail = decoder.decode();
      if (!mutable.discard) mutable.pending += tail;
      if (mutable.pending) appendLine(state, mutable.pending.endsWith('\r') ? mutable.pending.slice(0, -1) : mutable.pending, offset, limit);
    } finally {
      fs.closeSync(fd);
    }
    const totalLines = Math.max(state.line - 1, 0);
    if (!state.found && offset !== 1) return readError('OFFSET_OUT_OF_RANGE', `Offset ${offset} is out of range for ${resolved.displayPath}`, resolved.displayPath);
    return { type: 'text-page', path: resolved.displayPath, mime: mimeType(resolved.realPath, 'text/plain'), encoding: 'utf8', offset, limit, content: state.lines.join('\n'), truncated: state.truncated, ...(state.next === undefined ? {} : { next: state.next }), totalLines };
  },
  catch: (cause) => {
    const message = String((cause as Error).message || cause);
    if (message === 'BINARY_NULL_BYTE') return binaryResult(resolved, sizeBytes, `Cannot read binary file: ${resolved.displayPath}`);
    return binaryResult(resolved, sizeBytes, `Cannot decode as UTF-8: ${resolved.displayPath}`);
  },
});

export const readFileEffect = (input: FsReadFileInput, options: { root?: string } = {}) => Effect.gen(function* () {
  const root = options.root || process.cwd();
  const resolved = yield* resolveResourceEffect(input.path, root);
  const stat = yield* Effect.try({ try: () => fs.statSync(resolved.realPath), catch: (cause) => readError('STAT_FAILED', `Failed to stat path: ${String((cause as Error).message || cause)}`, resolved.displayPath) });
  if (stat.isDirectory()) return readError('DIRECTORY_NOT_READABLE', `Cannot read directory as a file: ${resolved.displayPath}. Use fs.list instead.`, resolved.displayPath);
  if (!stat.isFile()) return readError('NOT_A_FILE', `Path is not a regular file: ${resolved.displayPath}`, resolved.displayPath);
  const first = yield* readFirstBytesEffect(resolved.realPath, Number(stat.size));
  const mediaMime = imageMime(first);
  if (mediaMime) return yield* readMediaEffect(resolved, mediaMime, Number(stat.size));
  if (startsWith(first, [0x25, 0x50, 0x44, 0x46])) return binaryResult(resolved, Number(stat.size), `Cannot read binary PDF file as text: ${resolved.displayPath}`, 'application/pdf');
  if (isProbablyBinary(resolved.displayPath, first)) return binaryResult(resolved, Number(stat.size), `Cannot read binary file as text: ${resolved.displayPath}`);
  return yield* readTextPageEffect(resolved, input, Number(stat.size));
}).pipe(Effect.catchAll((failure) => Effect.succeed(failure as FsReadError)));

export const readManyEffect = (inputs: FsReadFileInput[], options: { root?: string } = {}) => {
  if (inputs.length === 1) return readFileEffect(inputs[0], options);

  return Effect.forEach(inputs, (input) => Effect.map(readFileEffect(input, options), (result) => {
    if (result.type === 'error') return { path: input.path, ok: false as const, error: result };

    return { path: input.path, ok: true as const, page: result };
  })).pipe(Effect.map((results) => ({ results })));
};

export function readFileForCli(input: FsReadFileInput, options: { root?: string } = {}): Promise<FsReadResult> {
  return Effect.runPromise(readFileEffect(input, options));
}

export function readManyForCli(inputs: FsReadFileInput[], options: { root?: string } = {}): Promise<FsReadManyResult> {
  return Effect.runPromise(readManyEffect(inputs, options));
}
