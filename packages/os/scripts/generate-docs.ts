#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import manifestJson from '../manifests/tool.manifest.json';
import { outputTypeSignatures, schemaTypeSignatures } from './lib/facade/schemas';
import type { ToolManifestEntry } from './lib/facade/types';

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

function renderSignature(entry: ToolManifestEntry): string {
  const input = schemaTypeSignatures[entry.inputSchema] || 'Record<string, unknown>';
  const output = outputTypeSignatures[entry.outputSchema] || outputTypeSignatures.RawOutput;
  return `workspace.${entry.name}(${input}) => Promise<ToolResult<${output}>>`;
}

function exampleEnvelope(entry: ToolManifestEntry, ok: boolean): string {
  return JSON.stringify({
    ok,
    code: ok ? 'OK' : 'VALIDATION_ERROR',
    message: ok ? 'command completed' : 'input: Required',
    data: ok ? { raw: 'example' } : { issues: [] },
    stderr: '',
    exitCode: ok ? 0 : 1,
    durationMs: 12,
    traceId: 'trc_abc123def456',
    requestId: entry.exampleInput.requestId || undefined,
    apiVersion: '1.0.0',
  }, null, 2);
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '&#124;').replace(/\n/g, '<br />');
}

function capabilitySummary(entry: ToolManifestEntry): string {
  const parts = [
    entry.capabilities.readOnly ? 'read-only' : 'writes state',
    entry.capabilities.mutating ? 'mutating' : 'non-mutating',
    entry.capabilities.safeToRetry ? 'safe to retry' : 'single-shot',
  ];
  return parts.join(' · ');
}

function renderCommand(entry: ToolManifestEntry): string[] {
  return [
    `### workspace.${entry.name}`,
    '',
    entry.description,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Category | ${markdownCell(entry.category)} |`,
    `| Signature | \`${markdownCell(renderSignature(entry))}\` |`,
    `| Runtime | \`${markdownCell(entry.underlying)}\` |`,
    `| Capability | ${capabilitySummary(entry)} |`,
    `| Default timeout | ${entry.defaultTimeout}ms |`,
    '',
    '#### Example call',
    '',
    '```ts',
    `await workspace.call(${JSON.stringify({ tool: entry.name, input: entry.exampleInput }, null, 2)});`,
    '```',
    '',
    '#### Success envelope',
    '',
    '```json',
    exampleEnvelope(entry, true),
    '```',
    '',
    '#### Error envelope',
    '',
    '```json',
    exampleEnvelope(entry, false),
    '```',
    '',
  ];
}

function categoryIndex(categories: Map<string, ToolManifestEntry[]>): string[] {
  const lines = [
    '| Category | Tools |',
    '| --- | ---: |',
  ];

  for (const [category, entries] of Array.from(categories.entries()).sort()) {
    lines.push(`| ${markdownCell(category)} | ${entries.length} |`);
  }

  return lines;
}

function renderDocs(): string {
  const categories = new Map<string, ToolManifestEntry[]>();
  for (const entry of manifest) {
    const entries = categories.get(entry.category) || [];
    entries.push(entry);
    categories.set(entry.category, entries);
  }

  const lines = [
    '# Consuelo OS typed tools',
    '',
    'This file is the human-readable tool catalog for the Consuelo OS facade. It is generated from `packages/os/manifests/tool.manifest.json`, so tool additions and schema changes update this reference through the generator.',
    '',
    'The workspace app exposes two MCP entrypoints:',
    '',
    '- `workspace.get_steering()` for bootstrap context',
    '- `workspace.call({ tool, input, taskSession, timeout })` for every typed operation',
    '',
    'Use the tables below to understand what each tool does, which runtime it wraps, and what envelope shape to expect.',
    '',
    '## call contract',
    '',
    'Every operation is called through the same envelope:',
    '',
    '```ts',
    'await workspace.call({',
    '  tool: "fs.read",',
    '  input: { path: "packages/workspace/package.json" },',
    '  timeout: 120,',
    '})',
    '```',
    '',
    'Task-scoped work must pass the `taskSession` returned by `task.start`. The facade resolves the session to the correct task worktree and branch before invoking the underlying script.',
    '',
    '## tool index',
    '',
    ...categoryIndex(categories),
    '',
    '## tools by category',
    '',
  ];

  for (const [category, entries] of Array.from(categories.entries()).sort()) {
    lines.push(`## ${category}`, '');
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(...renderCommand(entry));
    }
  }

  lines.push(
    '## result envelope',
    '',
    'Every result includes `ok`, `code`, `message`, `data`, `stderr`, `exitCode`, `durationMs`, `traceId`, and `apiVersion`. When callers pass a `requestId`, the facade echoes it back so work can be correlated across logs and task evidence.',
    '',
    '## error codes',
    '',
    '`OK`, `VALIDATION_ERROR`, `AMBIGUOUS_TASK_SELECTION`, `WORKTREE_NOT_FOUND`, `COMMAND_FAILED`, `TIMEOUT`, `PARSE_ERROR`, `NOT_FOUND`, `TASK_SESSION_REQUIRED`, `TASK_SESSION_NOT_FOUND`, `DRY_RUN`.',
    '',
    '## final rule',
    '',
    'The tool manifest is executable contract, not prose. If the docs and manifest disagree, regenerate this file from the manifest and trust the manifest-backed generator.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function main(): void {
  fs.writeFileSync(path.join(workspaceRoot, 'TOOLS.md'), renderDocs());
  process.stdout.write('generated TOOLS.md\n');
}

main();
