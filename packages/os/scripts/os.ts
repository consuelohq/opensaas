#!/usr/bin/env bun

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  findManifestEntry,
  getPackageRoot,
  readCoreToolManifest,
} from './lib/manifest';
import { validateManifestGuardrails } from './lib/local-guardrails';
import {
  ensureRuntimePaths,
  getRuntimePaths,
  recordExecutionFinished,
  recordExecutionStarted,
} from './lib/runtime-state';
import type { CallInput, CallOutput, SkillContext } from './lib/types';

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

function createTraceId(): string {
  return `trc_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

function envPresence(): Record<string, unknown> {
  const graphqlUrl = process.env.CONSUELO_GRAPHQL_URL;
  const paths = getRuntimePaths();
  return {
    workspaceId: process.env.CONSUELO_WORKSPACE_ID ?? null,
    userId: process.env.CONSUELO_USER_ID ?? null,
    graphqlUrlHost: graphqlUrl ? new URL(graphqlUrl).host : null,
    hasGraphqlApiKey: Boolean(process.env.CONSUELO_INTERNAL_GRAPHQL_API_KEY),
    consueloHome: paths.home,
    sqlitePath: paths.dbPath,
    artifactStorage: 'local',
  };
}

export function getSteering(): string {
  ensureRuntimePaths();
  const packageRoot = getPackageRoot();
  const files = [
    'STEERING.md',
    'business-context.md',
    'data-model.md',
    'permissions.md',
    'integrations.md',
    'skills.md',
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

  sections.push(
    '',
    '# tool discovery routing',
    '',
    'Use core tools directly when present. Use tools.search when a tool, provider, deployment surface, product area, or workflow is mentioned but is not in core steering.',
    '',
    '# raw core tool manifest',
    '',
    '```json',
    safeJson(readCoreToolManifest()),
    '```',
  );
  return sections.join('\n');
}

export function getRawSteering(): string {
  ensureRuntimePaths();
  const packageRoot = getPackageRoot();
  const sections = [
    '# Consuelo OS raw/operator steering',
    '',
    'This surface is for build, design, deployment, debugging, and internal operator agents.',
    'It intentionally preserves the proven workspace steering pattern so OS capabilities can be repurposed instead of rebuilt.',
    'Use this context for landing pages, Consuelo Design, GitHub, auth, deployment, file workflows, and operator/debug tasks.',
    '',
  ];
  const devSteering = readIfExists(path.join(packageRoot, 'dev-steering.md'));
  if (devSteering)
    sections.push('# original workspace STEERING.md', '', devSteering);
  const decision = readIfExists(path.join(packageRoot, 'decision.md'));
  if (decision)
    sections.push('', '# original workspace decision.md', '', decision);
  const manifest = readIfExists(
    path.join(packageRoot, 'manifests', 'tool.manifest.json'),
  );
  if (manifest)
    sections.push(
      '',
      '# canonical full tool manifest',
      '',
      '```json',
      manifest,
      '```',
    );
  return sections.join('\n');
}

function notFound(name: string): CallOutput {
  return {
    ok: false,
    name,
    permission: 'read',
    error: {
      code: 'SKILL_NOT_FOUND',
      message: `Skill "${name}" is not defined in the manifest.`,
    },
  };
}

async function runSkill(callInput: CallInput): Promise<CallOutput> {
  const entry = findManifestEntry(callInput.name);
  if (!entry) return notFound(callInput.name);

  const guardrailIssues = validateManifestGuardrails([entry]);
  if (guardrailIssues.length > 0) {
    return {
      ok: false,
      name: entry.name,
      permission: entry.permission,
      requiresApproval: entry.requiresApproval,
      error: {
        code: 'SKILL_GUARDRAIL_BLOCKED',
        message:
          guardrailIssues[0]?.message ??
          'Skill failed OS guardrail validation.',
        details: guardrailIssues,
      },
    };
  }

  if (entry.requiresApproval) {
    return {
      ok: false,
      name: entry.name,
      permission: entry.permission,
      requiresApproval: true,
      error: {
        code: 'APPROVAL_REQUIRED',
        message: `Skill "${entry.name}" requires explicit approval before execution.`,
      },
    };
  }

  if (entry.name === 'get_raw_steering') {
    return {
      ok: true,
      name: entry.name,
      permission: entry.permission,
      requiresApproval: entry.requiresApproval,
      result: { steering: getRawSteering() },
    };
  }

  const context: SkillContext = {
    traceId: callInput.traceId ?? createTraceId(),
    workspaceId: callInput.workspaceId ?? process.env.CONSUELO_WORKSPACE_ID,
    userId: callInput.userId ?? process.env.CONSUELO_USER_ID,
    manifestEntry: entry,
  };
  if (entry.name === 'daily-revenue-brief') {
    try {
      const { runDailyRevenueBrief } =
        await import('./revenue/daily-revenue-brief');
      return await runDailyRevenueBrief(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }
  if (entry.name === 'consuelo-workspace-snapshot') {
    try {
      const { runConsueloWorkspaceSnapshot } =
        await import('./workspace/consuelo-workspace-snapshot');
      return await runConsueloWorkspaceSnapshot(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }
  if (entry.name === 'consuelo-design') {
    try {
      const { runConsueloDesign } = await import('./design/consuelo-design');
      return await runConsueloDesign(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
        },
      };
    }
  }
  if (entry.name === 'consuelo-design-landing-page') {
    try {
      const { runConsueloDesignLandingPage } =
        await import('./design/consuelo-design-landing-page');
      return await runConsueloDesignLandingPage(callInput.input ?? {}, context);
    } catch (error: unknown) {
      return {
        ok: false,
        name: entry.name,
        permission: entry.permission,
        requiresApproval: entry.requiresApproval,
        error: {
          code: 'SKILL_EXECUTION_FAILED',
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : 'Skill execution failed.',
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
      code: 'SKILL_NOT_IMPLEMENTED',
      message: `Skill "${entry.name}" is declared but has no runner yet.`,
    },
  };
}

export async function executeCall(callInput: CallInput): Promise<CallOutput> {
  ensureRuntimePaths();
  const started = Date.now();
  const traceId = callInput.traceId ?? createTraceId();
  const workspaceId =
    callInput.workspaceId ?? process.env.CONSUELO_WORKSPACE_ID;
  const userId = callInput.userId ?? process.env.CONSUELO_USER_ID;

  recordExecutionStarted({
    traceId,
    name: callInput.name,
    workspaceId,
    userId,
    input: callInput.input,
  });

  try {
    const output = await runSkill({
      ...callInput,
      traceId,
      workspaceId,
      userId,
    });
    output.traceId = traceId;
    output.durationMs = Date.now() - started;
    recordExecutionFinished({
      traceId,
      status: output.ok ? 'succeeded' : 'failed',
      output,
      durationMs: output.durationMs,
    });
    return output;
  } catch (error: unknown) {
    const output: CallOutput = {
      ok: false,
      name: callInput.name,
      permission: 'read',
      traceId,
      durationMs: Date.now() - started,
      error: {
        code: 'CALL_FAILED',
        message:
          error instanceof Error
            ? error.message.slice(0, 240)
            : 'OS call failed.',
      },
    };
    recordExecutionFinished({
      traceId,
      status: 'failed',
      output,
      durationMs: output.durationMs ?? Date.now() - started,
    });
    return output;
  }
}

export function parseCallInput(rawInput: string | undefined): CallInput {
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

  if (command === 'get-raw-steering') {
    writeStdout(getRawSteering());
    return;
  }

  if (command === 'call') {
    try {
      const result = await executeCall(parseCallInput(rawInput));
      writeStdout(`${safeJson(result)}\n`);
      if (!result.ok) process.exitCode = 1;
    } catch (error: unknown) {
      writeStderr(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
    return;
  }

  writeStdout(
    [
      'usage:',
      '  bun ./scripts/os.ts get-steering',
      '  bun ./scripts/os.ts get-raw-steering',
      '  bun ./scripts/os.ts call \'{"name":"daily-revenue-brief"}\'',
      '',
    ].join('\n'),
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    writeStderr(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
