#!/usr/bin/env bun

import { handleMcpGatewayJsonRpc } from './lib/mcp-gateway';
import { executeCall } from './os';

type JsonObject = Record<string, unknown>;

let buffer = '';

function contentLengthHeaderEnd(value: string): number {
  const crlf = value.indexOf('\r\n\r\n');
  if (crlf >= 0) return crlf + 4;
  const lf = value.indexOf('\n\n');
  return lf >= 0 ? lf + 2 : -1;
}

function parseContentLength(header: string): number | null {
  const match = header.match(/content-length:\s*(\d+)/i);
  return match ? Number.parseInt(match[1] ?? '', 10) : null;
}

function takeMessage(): string | null {
  if (buffer.length === 0) return null;

  if (/^content-length:/i.test(buffer)) {
    const headerEnd = contentLengthHeaderEnd(buffer);
    if (headerEnd < 0) return null;
    const header = buffer.slice(0, headerEnd);
    const length = parseContentLength(header);
    if (!Number.isFinite(length) || length === null) {
      throw new Error('MCP stdio request is missing Content-Length.');
    }
    const bodyEnd = headerEnd + length;
    if (buffer.length < bodyEnd) return null;
    const body = buffer.slice(headerEnd, bodyEnd);
    buffer = buffer.slice(bodyEnd).replace(/^\s+/, '');
    return body;
  }

  const newline = buffer.indexOf('\n');
  if (newline < 0) return null;
  const line = buffer.slice(0, newline).trim();
  buffer = buffer.slice(newline + 1);
  return line.length > 0 ? line : takeMessage();
}

function writeMessage(message: JsonObject): void {
  const body = JSON.stringify(message);
  const length = Buffer.byteLength(body, 'utf8');
  process.stdout.write(`Content-Length: ${length}\r\n\r\n${body}`);
}

async function handleBody(body: string): Promise<void> {
  const response = await handleMcpGatewayJsonRpc(body, { executeCall });
  writeMessage(response);
}

async function main(): Promise<void> {
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) {
    buffer += decoder.decode(chunk);
    let body: string | null;
    while ((body = takeMessage()) !== null) {
      await handleBody(body);
    }
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    writeMessage({ jsonrpc: '2.0', id: null, error: { code: -32603, message } });
    process.exit(1);
  });
}
