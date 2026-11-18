import { hasPrivateComputerUse } from '../redaction.ts';

const OMITTED = '{"type":"os.log.omitted"}';
const MAX_RECORD_CHARS = 4 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function sanitizeLine(line: string, privateItems: Set<string>): string {
  if (!line.trimStart().startsWith('{')) return line;
  let event: Record<string, unknown> | undefined;
  try {
    event = record(JSON.parse(line));
  } catch {
    // Truncated JSON can still contain form input before the closing brace.
    return OMITTED;
  }
  const item = record(event?.item);
  if (!item || !event) return line;
  const id = typeof item.id === 'string' ? item.id : '';
  const knownPrivate = privateItems.has(id);
  if (item.type !== 'mcp_tool_call' && !knownPrivate) return line;
  const args = record(item.arguments);
  const tool = item.tool === 'call' ? args?.tool : item.tool;
  const privateContent = knownPrivate || typeof tool !== 'string' || hasPrivateComputerUse(tool, args?.input ?? args, item.result);
  if (!privateContent) return line;
  if (event.type === 'item.completed') privateItems.delete(id);
  else if (id) privateItems.add(id);
  return JSON.stringify({
    type: event.type,
    item: {
      id: item.id, type: item.type, server: item.server, tool: item.tool,
      arguments: item.tool === 'call' && typeof tool === 'string' ? { tool } : {},
      ...(item.error ? { error: { message: '[REDACTED]' } } : {}),
    },
  });
}

/** Never emit a partial record. Oversized records are discarded up to their newline. */
export function createCodexLogWriter(emit: (text: string) => void, maxRecordChars = MAX_RECORD_CHARS) {
  const privateItems = new Set<string>();
  let pending = '';
  let oversized = false;
  let kind: 'unknown' | 'json' | 'plain' = 'unknown';
  function flush(newline: string) {
    emit((oversized ? OMITTED : kind === 'plain' ? '' : sanitizeLine(pending, privateItems)) + newline);
    pending = '';
    oversized = false;
    kind = 'unknown';
  }
  return {
    write(chunk: string) {
      let start = 0;
      while (start < chunk.length) {
        const newline = chunk.indexOf('\n', start);
        const end = newline < 0 ? chunk.length : newline;
        const segment = chunk.slice(start, end);
        if (kind === 'unknown' && !oversized) {
          const first = segment.search(/\S/);
          if (first >= 0) kind = segment[first] === '{' ? 'json' : 'plain';
          if (kind === 'plain' && pending) {
            emit(pending);
            pending = '';
          }
        }
        if (kind === 'plain') {
          if (segment) emit(segment);
        } else if (!oversized && pending.length + segment.length <= maxRecordChars) {
          pending += segment;
        } else {
          pending = '';
          oversized = true;
        }
        if (newline < 0) return;
        flush('\n');
        start = newline + 1;
      }
    },
    end() {
      if (pending || oversized) flush('');
    },
  };
}

export function redactCodexLog(text: string): string {
  const parts: string[] = [];
  const writer = createCodexLogWriter(part => parts.push(part));
  writer.write(text);
  writer.end();
  return parts.join('');
}
