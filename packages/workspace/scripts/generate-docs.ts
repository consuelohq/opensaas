#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import manifestJson from '../tooling/tool-manifest.json';
import { outputTypeSignatures, schemaTypeSignatures } from './lib/facade/schemas';
import type { ToolManifestEntry } from './lib/facade/types';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = manifestJson as ToolManifestEntry[];

function renderSignature(entry: ToolManifestEntry): string {
  const input = schemaTypeSignatures[entry.inputSchema] || 'Record<string, unknown>';
  const output = outputTypeSignatures[entry.outputSchema] || outputTypeSignatures.RawOutput;
  return `workspace.${entry.name}(${input}) => Promise<ToolResult<${output}>>`;
}

function exampleData(entry: ToolManifestEntry): unknown {
  if (entry.outputSchema === 'ToolsSearchOutput') {
    return {
      query: 'linear issue',
      limit: 5,
      searchedCount: 128,
      returnedCount: 1,
      filters: {},
      totalMatches: 1,
      confidence: 'high',
      ambiguous: false,
      detectedIntent: 'read or search Linear issues',
      recommended: 'linear.issue',
      matches: [
        {
          name: 'linear.issue',
          methodPath: ['linear', 'issue'],
          category: 'linear',
          score: 142,
          scoreParts: { exact: 0, name: 22, lexical: 31, bm25: 34, intent: 55, capability: 0, embedding: 0 },
          description: 'Read one Linear issue by identifier.',
          capabilities: { readOnly: true, mutating: false, safeToRetry: true },
          sessionRequired: false,
          inputSchema: 'LinearIssueInput',
          outputSchema: 'RawOutput',
          inputSignature: '{ identifier: string; requestId?: string; taskSession?: string }',
          usage: {
            workspaceCall: 'await workspace.call({ tool: "linear.issue", input: { "identifier": "DEV-123" } })',
            script: 'linear',
            subcommand: 'issue',
            arguments: [],
          },
          why: ['intent: read or search Linear issues'],
        },
      ],
      guidance: {
        summary: 'Use the recommended tool when its intent matches the user request. Inspect alternatives when ambiguous.',
        recommendedUse: 'Read-only recommendation is safe for investigation.',
        ambiguous: false,
        safeDefaults: [],
        mutatingGuidance: [],
      },
      catalog: {
        source: ['tool-manifest.json', 'TOOLS.md'],
        catalogHash: 'abc123',
        toolCount: 128,
        searchedCount: 128,
        cardVersion: 'tools-search-card-v2',
        embeddingConfigId: 'disabled',
        cardsEmbedded: 0,
        cardsReused: 0,
      },
    };
  }

  return { raw: 'example' };
}

function exampleEnvelope(entry: ToolManifestEntry, ok: boolean): string {
  return JSON.stringify({
    ok,
    code: ok ? 'OK' : 'VALIDATION_ERROR',
    message: ok ? 'command completed' : 'input: Required',
    data: ok ? exampleData(entry) : { issues: [] },
    stderr: '',
    exitCode: ok ? 0 : 1,
    durationMs: 12,
    traceId: 'trc_abc123def456',
    requestId: entry.exampleInput.requestId || undefined,
    apiVersion: '1.0.0',
  }, null, 2);
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br />');
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
    `| Signature | \`${renderSignature(entry)}\` |`,
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
    '# workspace typed tools',
    '',
    'This file is the human-readable tool catalog for the workspace facade. It is generated from `packages/workspace/tooling/tool-manifest.json`, so tool additions, schema changes, and timeout changes update this reference through the generator.',
    '',
    'The workspace app exposes exactly two MCP entrypoints:',
    '',
    '- `workspace.get_steering()` for bootstrap context',
    '- `workspace.call({ tool, input, taskSession, timeout })` for every typed operation',
    '',
    '<Note>',
    'Use this file as a contract map. The manifest remains the executable source of truth; this page makes the available tools easier to scan.',
    '</Note>',
    '',
    '## Call contract',
    '',
    'Every operation travels through the same envelope:',
    '',
    '```ts',
    'await workspace.call({',
    '  tool: "fs.read",',
    '  input: { path: "packages/workspace/package.json" },',
    '  timeout: 120,',
    '})',
    '```',
    '',
    'Task-scoped work must pass the `taskSession` returned by `task.start`. The facade resolves the session to the correct branch and worktree before invoking the underlying script.',
    '',
    '## Tool index',
    '',
    ...categoryIndex(categories),
    '',
    '## Tools by category',
    '',
  ];

  for (const [category, entries] of Array.from(categories.entries()).sort()) {
    lines.push(`## ${category}`, '');
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(...renderCommand(entry));
    }
  }

  lines.push(
    '## Result envelope',
    '',
    'Every result includes `ok`, `code`, `message`, `data`, `stderr`, `exitCode`, `durationMs`, `traceId`, and `apiVersion`. When callers pass a `requestId`, the facade echoes it so work can be correlated across logs and task evidence.',
    '',
    '## Error codes',
    '',
    '`OK`, `VALIDATION_ERROR`, `CODE_CALL_VALIDATION_ERROR`, `AMBIGUOUS_TASK_SELECTION`, `WORKTREE_NOT_FOUND`, `COMMAND_FAILED`, `TIMEOUT`, `PARSE_ERROR`, `NOT_FOUND`, `TASK_SESSION_REQUIRED`, `TASK_SESSION_NOT_FOUND`, `DRY_RUN`.',
    '',
    '## Final rule',
    '',
    'The tool manifest is executable contract. If this file and the manifest disagree, regenerate this file from the manifest and trust the manifest-backed generator.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function main(): void {
  fs.writeFileSync(path.join(workspaceRoot, 'TOOLS.md'), renderDocs());
  process.stdout.write('generated TOOLS.md\n');
}

main();
