#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';

import { findManifestEntry, getPackageRoot, readManifest } from './lib/manifest';
import type { CallInput, CallOutput, RunbookContext } from './lib/types';

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function writeStderr(value: string): void {
  process.stderr.write(`${value}\n`);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function readIfExists(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function envPresence(): Record<string, unknown> {
  const graphqlUrl = process.env.CONSUELO_GRAPHQL_URL;
  return {
    workspaceId: process.env.CONSUELO_WORKSPACE_ID ?? null,
    userId: process.env.CONSUELO_USER_ID ?? null,
    graphqlUrlHost: graphqlUrl ? new URL(graphqlUrl).host : null,
    hasGraphqlApiKey: Boolean(process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY),
  };
}

function getSteering(): string {
  const packageRoot = getPackageRoot();
  const files = [
    'STEERING.md',
    'business-context.md',
    'data-model.md',
    'permissions.md',
    'integrations.md',
    'runbooks.md',
  ];
  const sections = [
    '# Consuelo OS runtime context',
    '',
    '## Runtime identity',
    '',
    '```json',
    safeJson(envPresence()),
    '```',
  ];

  for (const file of files) {
    const content = readIfExists(path.join(packageRoot, file));
    if (content) sections.push('', `# ${file}`, '', content);
  }

  sections.push('', '# raw default tool manifest', '', '```json', safeJson(readManifest()), '```');
  return sections.join('\n');
}

function getDevSteering(): string {
  const packageRoot = getPackageRoot();
  const sections = [
    '# Consuelo OS dev/operator steering',
    '',
    'This surface is for build, design, deployment, debugging, and internal operator agents.',
    'It intentionally preserves the proven workspace steering pattern so OS capabilities can be repurposed instead of rebuilt.',
    'Use this context for landing pages, Consuelo Design, GitHub, Supabase/auth, deployment, file workflows, and operator/debug tasks.',
    '',
  ];
  const devSteering = readIfExists(path.join(packageRoot, 'dev-steering.md'));
  if (devSteering) sections.push('# original workspace STEERING.md', '', devSteering);
  const decision = readIfExists(path.join(packageRoot, 'decision.md'));
  if (decision) sections.push('', '# original workspace decision.md', '', decision);
  const manifest = readIfExists(path.join(packageRoot, 'tooling', 'dev-tool-manifest.json'));
  if (manifest) sections.push('', '# original workspace tool manifest', '', '```json', manifest, '```');
  return sections.join('\n');
}

function notFound(name: string): CallOutput {
  return {
    ok: false,
    name,
    permission: 'read',
    error: {
      code: 'RUNBOOK_NOT_FOUND',
      message: `Runbook "${name}" is not defined in the manifest.`,
    },
  };
}

async function executeCall(callInput: CallInput): Promise<CallOutput> {
  const entry = findManifestEntry(callInput.name);
  if (!entry) return notFound(callInput.name);

  const context: RunbookContext = {
    workspaceId: callInput.workspaceId ?? process.env.CONSUELO_WORKSPACE_ID,
    userId: callInput.userId ?? process.env.CONSUELO_USER_ID,
    manifestEntry: entry,
  };
  if (entry.name === 'daily-revenue-brief') {
    try {
      const { runDailyRevenueBrief } = await import('./revenue/daily-revenue-brief');
      return await runDailyRevenueBrief(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'RUNBOOK_EXECUTION_FAILED',
          message: error instanceof Error ? error.message.slice(0, 240) : 'Runbook execution failed.',
        },
      };
    }
  }

  return {
    ok: false,
    name: entry.name,
    permission: entry.permission,
    requiresApproval: entry.requiresApproval,
    error: {
      code: 'RUNBOOK_NOT_IMPLEMENTED',
      message: `Runbook "${entry.name}" is declared but has no runner yet.`,
    },
  };
}

function parseCallInput(rawInput: string | undefined): CallInput {
  if (!rawInput) {
    throw new Error('call requires JSON input');
  }
  const parsed = JSON.parse(rawInput) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('call input must be an object');
  }
  const input = parsed as Partial<CallInput>;
  if (!input.name || typeof input.name !== 'string') {
    throw new Error('call input requires name');
  }
  return input as CallInput;
}

async function main(): Promise<void> {
  const [command, rawInput] = process.argv.slice(2);

  if (command === 'get-steering') {
    writeStdout(getSteering());
    return;
  }

  if (command === 'get-dev-steering') {
    writeStdout(getDevSteering());
    return;
  }

  if (command === 'call') {
    const result = await executeCall(parseCallInput(rawInput));
    writeStdout(`${safeJson(result)}\n`);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  writeStdout([
    'usage:',
    '  bun ./scripts/os.ts get-steering',
    '  bun ./scripts/os.ts get-dev-steering',
    '  bun ./scripts/os.ts call \'{"name":"daily-revenue-brief"}\'',
    '',
  ].join('\n'));
}

main().catch((error: unknown) => {
  writeStderr(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
