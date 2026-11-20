import { hasPrivateComputerUse } from '../redaction.ts';

const OMITTED = '{"type":"os.log.omitted"}';
const MAX_RECORD_CHARS = 4 * 1024 * 1024;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

// Pi repeats tool data in assistant messages, progressive tool events, and full turn transcripts.
// OpenCode and other MCP clients can also wrap the same call inside a part or content block.
function privateProviderEvent(value: unknown, privateItems: Set<string>, depth = 0): boolean {
  if (depth > 64) return true;
  if (Array.isArray(value)) return value.some(part => privateProviderEvent(part, privateItems, depth + 1));
  const event = record(value);
  if (!event) return false;
  const id = event.toolCallId ?? event.tool_use_id ?? event.callID ?? event.id;
  if (typeof id === 'string' && privateItems.has(id)) return true;
  const toolPart = typeof event.type === 'string' && /tool|function/i.test(event.type);
  const name = event.toolName ?? event.tool ?? (toolPart ? event.name : undefined);
  const input = record(event.args) ?? record(event.arguments) ?? record(event.input) ?? record(record(event.state)?.input);
  const facade = typeof input?.tool === 'string' ? input.tool : undefined;
  const wrapper = typeof name === 'string' && /^(?:(?:mcp[_.:/-]+)?(?:os|workspace)[_.:/-]+)?call$/i.test(name);
  const tool = facade ?? name;
  const args = facade ? input?.input ?? input?.args : input;
  const opaqueResult = !name && (event.role === 'toolResult' || event.type === 'tool_result' || event.type === 'tool_execution_end' || event.type === 'tool_execution_update');
  const partial = typeof event.type === 'string' && /^(?:toolcall_(?:start|delta)|input_json_delta|tool-input-delta)$/i.test(event.type);
  const privateContent = partial || opaqueResult || (wrapper && !facade) || (typeof tool === 'string'
    && (hasPrivateComputerUse(tool, args) || (tool === 'batch' && !Array.isArray(record(args)?.steps))));
  if (privateContent) {
    if (typeof id === 'string') privateItems.add(id);
    return true;
  }
  return Object.values(event).some(part => privateProviderEvent(part, privateItems, depth + 1));
}

function sanitizeLine(line: string, privateItems: Set<string>): string {
  if (!/^[{\[]/.test(line.trimStart())) return line;
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    // Some CLIs prefix ordinary progress with a bracketed status. Partial JSON stays private.
    if (/^\s*\[[A-Za-z][\w .:/-]{0,60}\](?:\s|$)/.test(line)) return line;
    return OMITTED;
  }
  const event = record(value);
  const item = record(event?.item);
  if (!item || !event) return privateProviderEvent(value, privateItems) ? OMITTED : line;
  const id = typeof item.id === 'string' ? item.id : '';
  const knownPrivate = privateItems.has(id);
  if (item.type !== 'mcp_tool_call' && !knownPrivate) return privateProviderEvent(value, privateItems) ? OMITTED : line;
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
export function createProviderLogWriter(emit: (text: string) => void, maxRecordChars = MAX_RECORD_CHARS, multiline = false) {
  const privateItems = new Set<string>();
  let pending = '';
  let oversized = false;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  function countDelimiters(segment: string) {
    for (const char of segment) {
      if (escaped) escaped = false;
      else if (quoted && char === '\\') escaped = true;
      else if (char === '"') quoted = !quoted;
      else if (!quoted && (char === '{' || char === '[')) depth++;
      else if (!quoted && (char === '}' || char === ']')) depth--;
    }
  }
  let kind: 'unknown' | 'json' | 'plain' = 'unknown';
  function flush(newline: string) {
    emit((oversized ? OMITTED : kind === 'plain' ? '' : sanitizeLine(pending, privateItems)) + newline);
    pending = '';
    oversized = false;
    depth = 0;
    quoted = false;
    escaped = false;
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
          if (first >= 0) kind = segment[first] === '{' || segment[first] === '[' ? 'json' : 'plain';
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
        if (multiline && kind === 'json') countDelimiters(segment);
        if (newline < 0) return;
        if (multiline && kind === 'json' && depth > 0) {
          if (!oversized) pending += '\n';
        } else {
          flush('\n');
        }
        start = newline + 1;
      }
    },
    end() {
      if (pending || oversized) flush('');
    },
  };
}

export function redactProviderLog(text: string): string {
  const parts: string[] = [];
  // Grok can emit whole pretty-printed JSON documents. A line-only scrubber
  // would discard the opening brace and persist the private inner fields.
  const writer = createProviderLogWriter(part => parts.push(part), MAX_RECORD_CHARS, true);
  writer.write(text);
  writer.end();
  return parts.join('');
}
