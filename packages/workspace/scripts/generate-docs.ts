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
    `await workspace.${entry.name}(${JSON.stringify(entry.exampleInput, null, 2)});`,
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
    '- `workspace.call({ tool, taskSession?, input?, timeout? })`',
    '',
    'Every command in this document is run through `call`. When you see a command string such as:',
    '',
    '```bash',
    'workspace stream.context \'{"area":"workspace-agents"}\'',
    '```',
    '',
    'call it as:',
    '',
    '```ts',
    'workspace.call({',
    '  command: "workspace stream.context \'{\\"area\\":\\"workspace-agents\\"}\'",',
    '  timeout: 120',
    '})',
    '```',
    '',
    '**This wrapper is mandatory.** `workspace stream.context ...` is not a direct MCP tool call and it is not a shell command agents should run outside the workspace app. Inside the workspace app, `call` is the transport layer and the `workspace <tool> \'<json>\'` command is the typed facade entrypoint. If a command does not work through `call`, test it there and fix the command or implementation.',
    '',
    'This file is generated from `packages/workspace/tooling/tool-manifest.json`. The typed facade validates inputs, invokes the existing Bun workspace scripts, and wraps every result in the standard tool envelope.',
    '',
    '## quick start',
    '',
    'Inside the workspace app, invoke the same tool through `call`:',
    '',
    '```ts',
    'workspace.call({',
    '  command: "workspace fs.read \'{\\"path\\":\\"packages/workspace/package.json\\"}\'",',
    '  timeout: 120',
    '})',
    '```',
    '',
    'The TypeScript shape below documents the facade schema and return envelope:',
    '',
    '```ts',
    "import { workspace } from './src/generated/tool-client';",
    '',
    "const result = await workspace.fs.read({ path: 'packages/workspace/package.json' });",
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
    '`OK`, `VALIDATION_ERROR`, `AMBIGUOUS_TASK_SELECTION`, `WORKTREE_NOT_FOUND`, `COMMAND_FAILED`, `TIMEOUT`, `PARSE_ERROR`, `NOT_FOUND`, `DRY_RUN`.',
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
    'Use the facade command instead: `workspace.call({ command: "workspace fs.read \'{\\"branch\\":\\"task/x\\",\\"path\\":\\"packages/workspace/package.json\\"}\'", timeout: 120 })`.',
    '',
    '## final reminder',
    '',
    'Every workspace operation above is invoked through `workspace.call({ tool, taskSession?, input?, timeout? })`. There are no per-operation MCP tools beyond `get_steering` and `call`. The command string should use `workspace <tool.name> \'<json-input>\'`; omit the JSON input only when the tool accepts an empty object. The workspace app is the environment, so work inside it and fix any command that does not run there.',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function main(): void {
  fs.writeFileSync(path.join(workspaceRoot, 'TOOLS.md'), renderDocs());
  process.stdout.write('generated TOOLS.md\n');
}

main();
