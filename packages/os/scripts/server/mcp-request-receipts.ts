import fs from 'node:fs';
import path from 'node:path';

import { resolveConsueloHomeLayout } from '../lib/consuelo-home';

type JsonObject = Record<string, unknown>;

export type McpRequestReceiptMetadata = {
  jsonRpcId?: string | number | null;
  method?: string;
  publicTool?: string;
  facadeTool?: string;
  taskSession?: string;
  workSession?: string;
};

export type McpRequestReceipt = McpRequestReceiptMetadata & {
  phase: 'received' | 'response_ready' | 'failed';
  requestId: string;
  connectorKey?: string;
  status?: number;
  durationMs?: number;
  ts: string;
};

const MAX_RECEIPT_LOG_BYTES = 2 * 1024 * 1024;
const RETAIN_RECEIPT_LOG_BYTES = 512 * 1024;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function inspectMcpRequestReceiptBody(body: string): McpRequestReceiptMetadata {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!isObject(parsed)) return {};
    const metadata: McpRequestReceiptMetadata = {};
    if (typeof parsed.id === 'string' || typeof parsed.id === 'number' || parsed.id === null) {
      metadata.jsonRpcId = parsed.id;
    }
    if (typeof parsed.method === 'string') metadata.method = parsed.method;
    if (!isObject(parsed.params)) return metadata;
    if (typeof parsed.params.name === 'string') metadata.publicTool = parsed.params.name;
    if (!isObject(parsed.params.arguments)) return metadata;
    const args = parsed.params.arguments;
    if (typeof args.tool === 'string') metadata.facadeTool = args.tool;
    if (typeof args.taskSession === 'string') metadata.taskSession = args.taskSession;
    if (typeof args.workSession === 'string') metadata.workSession = args.workSession;
    return metadata;
  } catch {
    return {};
  }
}

export function mcpRequestReceiptLogPath(home?: string): string {
  return path.join(resolveConsueloHomeLayout(home).nodeLogsDir, 'mcp-requests.jsonl');
}

function trimReceiptLogIfNeeded(filePath: string): void {
  try {
    const size = fs.statSync(filePath).size;
    if (size <= MAX_RECEIPT_LOG_BYTES) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const tail = content.slice(Math.max(0, content.length - RETAIN_RECEIPT_LOG_BYTES));
    const firstNewline = tail.indexOf('\n');
    fs.writeFileSync(filePath, firstNewline >= 0 ? tail.slice(firstNewline + 1) : tail, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // Receipt logging is diagnostic-only and must never replace the MCP response.
  }
}

export function appendMcpRequestReceipt(
  receipt: McpRequestReceipt,
  options: { home?: string } = {},
): void {
  try {
    const filePath = mcpRequestReceiptLogPath(options.home);
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.appendFileSync(filePath, `${JSON.stringify(receipt)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    trimReceiptLogIfNeeded(filePath);
  } catch {
    // Receipt logging is diagnostic-only and must never replace the MCP response.
  }
}
