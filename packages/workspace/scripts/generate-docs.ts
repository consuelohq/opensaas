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

function renderCommand(entry: ToolManifestEntry): string[] {
  return [
    `### ${entry.name}`,
    '',
    entry.description,
    '',
    `- signature: \`${renderSignature(entry)}\``,
    `- wraps: \`${entry.underlying}\``,
    `- capabilities: readOnly=${entry.capabilities.readOnly}, mutating=${entry.capabilities.mutating}, safeToRetry=${entry.capabilities.safeToRetry}`,
    `- default timeout: ${entry.defaultTimeout}ms`,
    '',
    'example call:',
    '',
    '```ts',
    `await workspace.call(${JSON.stringify({ tool: entry.name, input: entry.exampleInput }, null, 2)});`,
    '```',
    '',
    'example success envelope:',
    '',
    '```json',
    exampleEnvelope(entry, true),
    '```',
    '',
    'example error envelope:',
    '',
    '```json',
    exampleEnvelope(entry, false),
    '```',
    '',
  ];
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
    '## mandatory workspace app transport',
    '',
    'You are working inside the workspace MCP app. The app exposes exactly two tools:',
    '',
    '- `workspace.get_steering()`',
    '- `workspace.call({ tool, input, taskSession, timeout })`',
    '',
    '`get_steering` is bootstrap-only. After that, every workspace operation goes through `workspace.call` with a manifest tool name and typed input object.',
    '',
    '```ts',
    'await workspace.call({',
    '  tool: "stream.context",',
    '  input: { area: "workspace-agents" },',
    '  timeout: 120',
    '})',
    '```',
    '',
    'Task-scoped work must pass the `taskSession` returned by `task.start`. `workspace.call` resolves that session to the correct task worktree/branch before invoking the typed facade. Passing both `taskSession` and `input.branch` is rejected to avoid silent branch overrides.',
    '',
    'This file is generated from `packages/workspace/tooling/tool-manifest.json`. The typed facade validates inputs, invokes the existing Bun workspace scripts, and wraps every result in the standard tool envelope.',
    '',
    '## quick start',
    '',
    'Inside the workspace app, invoke the same tool through `workspace.call`:',
    '',
    '```ts',
    'await workspace.call({',
    '  tool: "fs.read",',
    '  input: { path: "packages/workspace/package.json" },',
    '  timeout: 120',
    '})',
    '```',
    '',
    'The TypeScript shape below documents the facade schema and return envelope:',
    '',
    '```ts',
    'const result = await workspace.call({',
    '  tool: "fs.read",',
    '  input: { path: "packages/workspace/package.json" },',
    '  timeout: 120,',
    '})',
    'if (!result.ok) throw new Error(result.message);',
    '```',
    '',
    '## commands by category',
    '',
  ];

  for (const [category, entries] of Array.from(categories.entries()).sort()) {
    lines.push(`## ${category}`, '');
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(...renderCommand(entry));
    }
  }

  lines.push(
    '## composed methods',
    '',
    '`workspace.checkFiles` wraps `bun run check-files`. `workspace.editFlow` wraps `bun run edit-flow`. Both are real scripts; the facade does not duplicate their multi-step behavior.',
    '',
    '## batch execution',
    '',
    'Use `workspace.batch([...])` for dependent steps. Each step accepts `input`; `args` remains a compatibility alias and can be a function receiving the previous result. Read-only steps can set `parallel: true`; mutating steps are always sequential.',
    '',
    '## branch resolution',
    '',
    'Branch resolution order is: explicit `branch`, pinned branch from `workspace.task.pin`, `TASK_BRANCH`, validated `.task/current.json`, exactly one active task worktree, then deterministic failure.',
    '',
    '## dry-run',
    '',
    'Mutating tools accept `dryRun: true`. The facade validates input, resolves branch state, builds the command, returns code `DRY_RUN`, and does not execute the mutation.',
    '',
    '## error codes',
    '',
    '`OK`, `VALIDATION_ERROR`, `AMBIGUOUS_TASK_SELECTION`, `WORKTREE_NOT_FOUND`, `COMMAND_FAILED`, `TIMEOUT`, `PARSE_ERROR`, `NOT_FOUND`, `TASK_SESSION_REQUIRED`, `TASK_SESSION_NOT_FOUND`, `DRY_RUN`.',
    '',
    '## tracing',
    '',
    'Every result includes `traceId`, optional echoed `requestId`, `durationMs`, `exitCode`, and `apiVersion`. The executor emits one `tool.executed` JSON event to stderr.',
    '',
    '## mac operations',
    '',
    '`workspace.mac.*` methods wrap `bun run mac` and operate outside the repository. They never perform task branch resolution.',
    '',
    '## decision engine walkthrough',
    '',
    'The decision engine wrappers call the existing scripts as-is: `workspace.explore`, `workspace.decideNext`, `workspace.confidenceScore`, and `workspace.exploit`. Retrieval is treated as a prior; confidence comes from evidence written by those scripts.',
    '',
    '## migration from lower-level scripts',
    '',
    'Do not call lower-level workspace scripts from the workspace app during normal work.',
    '',
    'Use the MCP facade instead: `workspace.call({ tool: "fs.read", taskSession, input: { path: "packages/workspace/package.json" }, timeout: 120 })`.',
    '',
    '## final reminder',
    '',
    'Every workspace operation above is invoked through `workspace.call({ tool, input, taskSession, timeout })`. There are no per-operation MCP tools beyond `get_steering` and `call`. The workspace app is the environment, so work inside it and fix any typed facade call that does not run there.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function main(): void {
  fs.writeFileSync(path.join(workspaceRoot, 'TOOLS.md'), renderDocs());
  process.stdout.write('generated TOOLS.md\n');
}

main();
