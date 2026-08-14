#!/usr/bin/env bun

import { createLocalAgentMcpBridge } from './lib/local-agent-mcp-bridge';

type JsonObject = Record<string, unknown>;

const MAX_MCP_STDIO_HEADER_BYTES = 8 * 1024;
const MAX_MCP_STDIO_BODY_BYTES = 4 * 1024 * 1024;

let buffer = Buffer.alloc(0);

function contentLengthHeaderEnd(
  value: Buffer,
): { end: number; separatorLength: number } | null {
  const crlf = value.indexOf(Buffer.from('\r\n\r\n'));
  if (crlf >= 0) return { end: crlf, separatorLength: 4 };
  const lf = value.indexOf(Buffer.from('\n\n'));
  return lf >= 0 ? { end: lf, separatorLength: 2 } : null;
}

function parseContentLength(header: string): number | null {
  const match = header.match(/content-length:\s*(\d+)/i);
  return match ? Number.parseInt(match[1] ?? '', 10) : null;
}

function takeMessage(): string | null {
  while (buffer.length > 0) {
    if (/^content-length:/i.test(buffer.subarray(0, 64).toString('ascii'))) {
      const headerBoundary = contentLengthHeaderEnd(buffer);
      if (!headerBoundary) {
        if (buffer.length > MAX_MCP_STDIO_HEADER_BYTES) {
          throw new Error('MCP stdio request headers exceed the allowed size.');
        }
        return null;
      }
      if (headerBoundary.end > MAX_MCP_STDIO_HEADER_BYTES) {
        throw new Error('MCP stdio request headers exceed the allowed size.');
      }
      const header = buffer.subarray(0, headerBoundary.end).toString('ascii');
      const length = parseContentLength(header);
      if (!Number.isFinite(length) || length === null) {
        throw new Error('MCP stdio request is missing Content-Length.');
      }
      if (length < 0 || length > MAX_MCP_STDIO_BODY_BYTES) {
        throw new Error('MCP stdio request body exceeds the allowed size.');
      }
      const bodyStart = headerBoundary.end + headerBoundary.separatorLength;
      const bodyEnd = bodyStart + length;
      if (buffer.length < bodyEnd) return null;
      const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
      buffer = buffer.subarray(bodyEnd);
      while (
        buffer.length > 0 &&
        /\s/.test(String.fromCharCode(buffer[0] ?? 0))
      ) {
        buffer = buffer.subarray(1);
      }
      return body;
    }

    const newline = buffer.indexOf(0x0a);
    if (newline < 0) {
      if (buffer.length > MAX_MCP_STDIO_BODY_BYTES) {
        throw new Error('MCP stdio request body exceeds the allowed size.');
      }
      return null;
    }
    if (newline > MAX_MCP_STDIO_BODY_BYTES) {
      throw new Error('MCP stdio request body exceeds the allowed size.');
    }
    const line = buffer.subarray(0, newline).toString('utf8').trim();
    buffer = buffer.subarray(newline + 1);
    if (line.length > 0) return line;
  }
  return null;
}

function writeMessage(message: JsonObject): void {
  const body = JSON.stringify(message);
  process.stdout.write(`${body}\n`);
}

async function main(): Promise<void> {
  const home = process.env.CONSUELO_HOME ?? process.env.CONSUELO_OS_HOME;
  const agentId = process.env.CONSUELO_AGENT_ID;
  if (!home || !agentId) {
    throw new Error('CONSUELO_HOME and CONSUELO_AGENT_ID are required.');
  }
  const bridge = createLocalAgentMcpBridge({ home, agentId });
  for await (const chunk of Bun.stdin.stream()) {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (buffer.length > MAX_MCP_STDIO_BODY_BYTES + MAX_MCP_STDIO_HEADER_BYTES) {
      throw new Error('MCP stdio input exceeds the allowed size.');
    }
    let body: string | null;
    while ((body = takeMessage()) !== null) {
      const responses = await bridge.forward(body);
      for (const response of responses) writeMessage(response);
    }
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    writeMessage({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message },
    });
    process.exit(1);
  });
}
