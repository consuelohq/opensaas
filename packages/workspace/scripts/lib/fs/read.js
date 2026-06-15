const fs = require('fs');
const path = require('path');

const MAX_READ_LINES = 2000;
const MAX_READ_BYTES = 64 * 1024;
const MAX_LINE_CHARS = 2000;
const MAX_MEDIA_INGEST_BYTES = 20 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_CHARS} chars)`;

const BINARY_EXTENSIONS = new Set([
  '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.class', '.jar', '.war', '.7z',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  '.bin', '.dat', '.obj', '.o', '.a', '.lib', '.wasm', '.pyc', '.pyo', '.pdf',
]);

const MIME_BY_EXTENSION = new Map([
  ['.txt', 'text/plain'],
  ['.log', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.js', 'text/javascript'],
  ['.jsx', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.cjs', 'text/javascript'],
  ['.ts', 'text/typescript'],
  ['.tsx', 'text/typescript'],
  ['.json', 'application/json'],
  ['.jsonl', 'application/jsonl'],
  ['.css', 'text/css'],
  ['.html', 'text/html'],
  ['.htm', 'text/html'],
  ['.xml', 'application/xml'],
  ['.yml', 'application/yaml'],
  ['.yaml', 'application/yaml'],
  ['.toml', 'application/toml'],
  ['.csv', 'text/csv'],
  ['.svg', 'image/svg+xml'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.bin', 'application/octet-stream'],
]);

class ReadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ReadError';
    this.code = code;
    this.details = details;
  }
}

function startsWith(bytes, prefix) {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

function imageMime(bytes) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
  return undefined;
}

function mimeType(filePath, fallback = 'application/octet-stream') {
  return MIME_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) || fallback;
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeResolve(root, inputPath) {
  const absoluteRoot = fs.realpathSync(root);
  const resolved = path.resolve(absoluteRoot, inputPath);
  if (!isPathInside(absoluteRoot, resolved)) {
    throw new ReadError('PATH_OUTSIDE_ROOT', `Path escapes allowed root: ${inputPath}`);
  }
  if (!fs.existsSync(resolved)) {
    throw new ReadError('NOT_FOUND', `Path not found: ${inputPath}`);
  }
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch (error) {
    throw normalizeFsError(error, inputPath);
  }
  if (!isPathInside(absoluteRoot, real)) {
    throw new ReadError('PATH_OUTSIDE_ROOT', `Path resolves outside allowed root: ${inputPath}`);
  }
  return { absoluteRoot, resolved, real };
}

function normalizeFsError(error, resource) {
  if (error instanceof ReadError) return error;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'READ_FAILED';
  if (code === 'ENOENT') return new ReadError('NOT_FOUND', `Path not found: ${resource}`);
  if (code === 'EACCES' || code === 'EPERM') return new ReadError('PERMISSION_DENIED', `Permission denied reading: ${resource}`);
  if (code === 'EISDIR') return new ReadError('DIRECTORY_NOT_READABLE', `Cannot read directory as a file: ${resource}. Use fs.list instead.`);
  return new ReadError('READ_FAILED', error instanceof Error ? error.message : `Failed to read: ${resource}`);
}

function binary(resource, bytes) {
  const extension = path.extname(resource).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) return true;
  if (bytes.length === 0) return false;
  let nonPrintable = 0;
  for (const byte of bytes) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) nonPrintable += 1;
  }
  return nonPrintable / bytes.length > 0.3;
}

function readNext(fd, length) {
  const buffer = Buffer.allocUnsafe(length);
  const bytesRead = fs.readSync(fd, buffer, 0, length, null);
  if (bytesRead === 0) return null;
  return buffer.subarray(0, bytesRead);
}

function readMedia(fd, first, info, request, real, mime) {
  if (info.size > MAX_MEDIA_INGEST_BYTES) {
    throw new ReadError('MEDIA_LIMIT_EXCEEDED', `Media exceeds ${MAX_MEDIA_INGEST_BYTES} byte ingestion limit: ${request.path}`, {
      maximumBytes: MAX_MEDIA_INGEST_BYTES,
      sizeBytes: info.size,
    });
  }

  const chunks = [Buffer.from(first)];
  let total = first.length;
  while (total <= MAX_MEDIA_INGEST_BYTES) {
    const chunk = readNext(fd, Math.min(READ_CHUNK_BYTES, MAX_MEDIA_INGEST_BYTES + 1 - total));
    if (!chunk) break;
    chunks.push(Buffer.from(chunk));
    total += chunk.length;
  }

  if (total > MAX_MEDIA_INGEST_BYTES) {
    throw new ReadError('MEDIA_LIMIT_EXCEEDED', `Media exceeds ${MAX_MEDIA_INGEST_BYTES} byte ingestion limit: ${request.path}`, {
      maximumBytes: MAX_MEDIA_INGEST_BYTES,
      sizeBytes: total,
    });
  }

  return {
    type: 'media',
    path: request.path,
    mime,
    sizeBytes: info.size,
    encoding: 'base64',
    content: Buffer.concat(chunks, total).toString('base64'),
  };
}

function pageFromRequest(request) {
  const offset = request.offset || request.from || 1;
  let limit = request.limit || MAX_READ_LINES;
  if (request.to !== undefined) {
    const from = request.from || request.offset || 1;
    limit = Math.max(1, request.to - from + 1);
  }
  return {
    offset: Math.max(1, offset),
    requestedLimit: Math.max(1, limit),
    limit: Math.min(Math.max(1, limit), MAX_READ_LINES),
  };
}

function maybeTruncateLine(input, forced) {
  if (!forced && input.length <= MAX_LINE_CHARS) return input;
  return input.slice(0, MAX_LINE_CHARS) + MAX_LINE_SUFFIX;
}

function readTextPage(fd, first, request, real) {
  const { offset, limit } = pageFromRequest(request);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const lines = [];
  let pending = '';
  let discardLongLineTail = false;
  let line = 1;
  let bytes = 0;
  let found = false;
  let truncated = false;
  let next;
  let done = false;
  let lastSelectedLineHadNewline = false;

  const appendLine = (input, terminatedByNewline, lineWasTruncated) => {
    if (line < offset) {
      line += 1;
      return;
    }
    if (lines.length >= limit || bytes >= MAX_READ_BYTES) {
      truncated = true;
      if (next === undefined) next = line;
      done = true;
      return;
    }

    found = true;
    const text = maybeTruncateLine(input, lineWasTruncated);
    const size = Buffer.byteLength(text, 'utf8') + (lines.length > 0 ? 1 : 0);
    if (bytes + size > MAX_READ_BYTES) {
      truncated = true;
      if (next === undefined) next = line;
      done = true;
      return;
    }

    lines.push(text);
    bytes += size;
    lastSelectedLineHadNewline = terminatedByNewline;
    line += 1;
  };

  const consumeText = (text) => {
    while (text.length > 0 && !done) {
      const index = text.indexOf('\n');
      if (index === -1) {
        if (!discardLongLineTail) {
          pending += text;
          if (pending.length > MAX_LINE_CHARS) {
            pending = pending.slice(0, MAX_LINE_CHARS);
            discardLongLineTail = true;
          }
        }
        return;
      }

      const prefix = discardLongLineTail ? '' : text.slice(0, index);
      const current = pending + prefix;
      const normalized = current.endsWith('\r') ? current.slice(0, -1) : current;
      appendLine(normalized, true, discardLongLineTail || current.length > MAX_LINE_CHARS);
      pending = '';
      discardLongLineTail = false;
      text = text.slice(index + 1);
    }
  };

  const consumeChunk = (chunk) => {
    if (chunk.includes(0)) throw new ReadError('BINARY_FILE', `Cannot read binary file as text: ${request.path}`);
    try {
      consumeText(decoder.decode(chunk, { stream: true }));
    } catch (error) {
      throw new ReadError('INVALID_UTF8', `Invalid UTF-8 while reading: ${request.path}`);
    }
  };

  consumeChunk(first);
  while (!done) {
    const chunk = readNext(fd, READ_CHUNK_BYTES);
    if (!chunk) break;
    consumeChunk(chunk);
  }

  if (!done) {
    let tail = '';
    try {
      tail = decoder.decode();
    } catch (error) {
      throw new ReadError('INVALID_UTF8', `Invalid UTF-8 while reading: ${request.path}`);
    }
    if (!discardLongLineTail) pending += tail;
    if (pending.length > 0) {
      const normalized = pending.endsWith('\r') ? pending.slice(0, -1) : pending;
      appendLine(normalized, false, discardLongLineTail || pending.length > MAX_LINE_CHARS);
    }
  }

  if (!found && offset !== 1) {
    throw new ReadError('OFFSET_OUT_OF_RANGE', `Offset ${offset} is out of range for ${request.path}`, { offset });
  }

  let content = lines.join('\n');
  if (!truncated && lastSelectedLineHadNewline && lines.length > 0) content += '\n';

  return {
    type: 'text-page',
    path: request.path,
    mime: mimeType(real, 'text/plain'),
    encoding: 'utf8',
    offset,
    limit,
    content,
    truncated,
    ...(next === undefined ? {} : { next }),
  };
}

function readOne(root, request) {
  const { real } = safeResolve(root, request.path);
  let info;
  try {
    info = fs.statSync(real);
  } catch (error) {
    throw normalizeFsError(error, request.path);
  }

  if (info.isDirectory()) {
    throw new ReadError('DIRECTORY_NOT_READABLE', `Cannot read directory as a file: ${request.path}. Use fs.list instead.`);
  }
  if (!info.isFile()) {
    throw new ReadError('NOT_A_FILE', `Path is not a regular file: ${request.path}`);
  }

  let fd;
  try {
    fd = fs.openSync(real, 'r');
    const first = readNext(fd, Math.min(READ_CHUNK_BYTES, Math.max(1, info.size || 4096))) || Buffer.alloc(0);
    const mediaMime = imageMime(first);
    if (mediaMime) return readMedia(fd, first, info, request, real, mediaMime);

    if (startsWith(first, [0x25, 0x50, 0x44, 0x46]) || binary(request.path, first)) {
      return {
        type: 'binary',
        path: request.path,
        mime: startsWith(first, [0x25, 0x50, 0x44, 0x46]) ? 'application/pdf' : mimeType(real),
        sizeBytes: info.size,
        message: `Cannot read binary file as text: ${request.path}`,
      };
    }

    return readTextPage(fd, first, request, real);
  } catch (error) {
    throw normalizeFsError(error, request.path);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function errorPayload(inputPath, error) {
  const normalized = normalizeFsError(error, inputPath);
  return {
    type: 'error',
    path: inputPath,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details && Object.keys(normalized.details).length > 0 ? { details: normalized.details } : {}),
    },
  };
}

function readResources(options) {
  const root = options.root || process.cwd();
  const requests = options.requests;
  if (requests.length === 1) {
    try {
      return readOne(root, requests[0]);
    } catch (error) {
      return errorPayload(requests[0].path, error);
    }
  }

  return {
    results: requests.map((request) => {
      try {
        return { path: request.path, ok: true, result: readOne(root, request) };
      } catch (error) {
        const payload = errorPayload(request.path, error);
        return { path: request.path, ok: false, error: payload.error };
      }
    }),
  };
}

function parsePositiveInt(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new ReadError('INVALID_ARGUMENT', `${flag} must be a positive integer`);
  return parsed;
}

function parseReadSegments(argv) {
  const segments = [];
  let current = null;

  const ensureCurrent = (flag) => {
    if (!current) throw new ReadError('INVALID_ARGUMENT', `${flag} must come after a path`);
    return current;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') ensureCurrent(arg).from = parsePositiveInt(argv[++i], arg);
    else if (arg === '--to') ensureCurrent(arg).to = parsePositiveInt(argv[++i], arg);
    else if (arg === '--offset') ensureCurrent(arg).offset = parsePositiveInt(argv[++i], arg);
    else if (arg === '--limit') ensureCurrent(arg).limit = parsePositiveInt(argv[++i], arg);
    else if (arg === '--all' || arg === '--plain' || arg === '--json') {
      // handled globally by the CLI wrapper
    } else if (!arg.startsWith('--')) {
      current = { path: arg };
      segments.push(current);
    } else {
      throw new ReadError('INVALID_ARGUMENT', `unknown read option: ${arg}`);
    }
  }

  return segments;
}

function formatError(error) {
  return `${error.code}: ${error.message}`;
}

function renderReadHuman(payload, plain = false) {
  const entries = payload && Array.isArray(payload.results)
    ? payload.results.map((entry) => entry.ok ? entry.result : { type: 'error', path: entry.path, error: entry.error })
    : [payload];

  const output = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (entries.length > 1) output.push(`-- ${entry.path || 'resource'} --`);
    if (entry.type === 'text-page') {
      if (plain) output.push(entry.content.replace(/\n$/, ''));
      else {
        const lines = entry.content.endsWith('\n') ? entry.content.slice(0, -1).split('\n') : entry.content.split('\n');
        lines.forEach((lineText, index) => output.push(`${String(entry.offset + index).padStart(4)}: ${lineText}`));
        if (entry.truncated && entry.next) output.push(`... truncated; next offset ${entry.next}`);
      }
    } else if (entry.type === 'media') {
      output.push(`media ${entry.mime} ${entry.sizeBytes} bytes ${entry.path}`);
    } else if (entry.type === 'binary') {
      output.push(entry.message);
    } else if (entry.type === 'error') {
      output.push(formatError(entry.error));
    }
  }
  return output.join('\n');
}

module.exports = {
  MAX_READ_LINES,
  MAX_READ_BYTES,
  MAX_LINE_CHARS,
  MAX_MEDIA_INGEST_BYTES,
  ReadError,
  parseReadSegments,
  readResources,
  renderReadHuman,
  mimeType,
};
