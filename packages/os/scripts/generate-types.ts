#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import manifestJson from '../manifests/tool.manifest.json';
import { outputTypeSignatures, schemaTypeSignatures } from './lib/facade/schemas';
import type { ToolManifestEntry } from './lib/facade/types';

type TypeTree = {
  methods: Map<string, ToolManifestEntry>;
  children: Map<string, TypeTree>;
};

type CanonicalManifestEntry = {
  kind: 'os-skill' | 'facade-tool';
  definition: ToolManifestEntry;
};

type CanonicalToolManifest = {
  tools: CanonicalManifestEntry[];
};

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fullToolManifest = manifestJson as CanonicalToolManifest;
const manifest = fullToolManifest.tools
  .filter((entry) => entry.kind === 'facade-tool')
  .map((entry) => entry.definition);

function createTree(): TypeTree {
  return { methods: new Map(), children: new Map() };
}

function addToTree(root: TypeTree, entry: ToolManifestEntry): void {
  let cursor = root;
  for (const segment of entry.methodPath.slice(0, -1)) {
    const child = cursor.children.get(segment) || createTree();
    cursor.children.set(segment, child);
    cursor = child;
  }
  cursor.methods.set(entry.methodPath[entry.methodPath.length - 1], entry);
}

function renderTree(tree: TypeTree, indent = '  '): string[] {
  const lines: string[] = [];

  for (const [name, child] of Array.from(tree.children.entries()).sort()) {
    lines.push(`${indent}${name}: {`);
    lines.push(...renderTree(child, `${indent}  `));
    lines.push(`${indent}};`);
  }

  for (const [name, entry] of Array.from(tree.methods.entries()).sort()) {
    const input = schemaTypeSignatures[entry.inputSchema] || 'Record<string, unknown>';
    const output = outputTypeSignatures[entry.outputSchema] || outputTypeSignatures.RawOutput;
    lines.push(`${indent}${name}: (input: ${input}) => Promise<ToolResult<${output}>>;`);
  }

  return lines;
}

function renderDts(): string {
  const root = createTree();
  for (const entry of manifest) addToTree(root, entry);

  return [
    'export type ErrorCode =',
    '  | "OK"',
    '  | "VALIDATION_ERROR"',
    '  | "AMBIGUOUS_TASK_SELECTION"',
    '  | "WORKTREE_NOT_FOUND"',
    '  | "COMMAND_FAILED"',
    '  | "TIMEOUT"',
    '  | "PARSE_ERROR"',
    '  | "NOT_FOUND"',
    '  | "DRY_RUN";',
    '',
    'export type SourceEnvelope = {',
    '  id: string;',
    '  title: string;',
    '  kind: "steering" | "file" | "search" | "trace" | "review" | "verify" | "pr" | "commit" | "tool" | "audit";',
    '  uri: string;',
    '  summary: string;',
    '  toolName?: string;',
    '  traceId?: string;',
    '  url?: string;',
    '  lineStart?: number;',
    '  lineEnd?: number;',
    '  lines?: Array<{ line: number; text: string }>;',
    '  metadata?: Record<string, unknown>;',
    '};',
    '',
    'export type ToolResult<TData = unknown> = {',
    '  ok: boolean;',
    '  code: ErrorCode;',
    '  message: string;',
    '  data: TData;',
    '  stderr: string;',
    '  exitCode: number;',
    '  durationMs: number;',
    '  traceId: string;',
    '  requestId?: string;',
    '  sources?: SourceEnvelope[];',
    '  apiVersion: "1.0.0";',
    '};',
    '',
    'export type BatchStep = {',
    '  tool: string;',
    '  input?: Record<string, unknown>;',
    '  args?: Record<string, unknown>;',
    '  parallel?: boolean;',
    '};',
    '',
    'declare const workspace: {',
    ...renderTree(root),
    '  batch: (steps: BatchStep[]) => Promise<ToolResult<{ results: ToolResult[]; completed: number }>>;',
    '};',
    '',
    'export { workspace };',
    '',
  ].join('\n');
}

function renderToolClient(): string {
  return [
    "export { createWorkspaceClient, workspace } from '../../scripts/lib/facade/client';",
    "export type { WorkspaceClient } from '../../scripts/lib/facade/client';",
    "export type { SourceEnvelope } from '../../scripts/lib/types';",
    "export type { ToolResult, ErrorCode, BatchStep } from '../../scripts/lib/facade/types';",
    '',
  ].join('\n');
}

function main(): void {
  const generatedDir = path.join(workspaceRoot, 'src', 'generated');
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(path.join(generatedDir, 'workspace.d.ts'), renderDts());
  fs.writeFileSync(path.join(generatedDir, 'tool-client.ts'), renderToolClient());
  process.stdout.write('generated workspace type stubs\n');
}

main();

