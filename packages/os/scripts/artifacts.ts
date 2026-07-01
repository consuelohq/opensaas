#!/usr/bin/env bun

import {
  getWorkspaceArtifactVersion,
  listWorkspaceArtifactVersions,
  rollbackWorkspaceArtifact,
} from './lib/artifacts';

function writeStdout(value: string): void {
  process.stdout.write(value);
}

function safeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return value && !value.startsWith('-') ? value : null;
}

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.includes(flag);
}

function versionSelector(args: readonly string[]): { versionId?: string; versionNumber?: number; before?: string } {
  const versionId = readFlagValue(args, '--version-id');
  const versionNumberRaw = readFlagValue(args, '--version');
  const before = readFlagValue(args, '--before');
  if (versionId) return { versionId };
  if (versionNumberRaw) {
    const versionNumber = Number(versionNumberRaw);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) throw new Error('--version must be a positive integer');
    return { versionNumber };
  }
  if (before) return { before };
  return {};
}

function renderHistory(artifactId: string, versions: ReturnType<typeof listWorkspaceArtifactVersions>): string {
  const lines = [`artifact ${artifactId}`, 'version current created_at reason sha path'];
  for (const version of versions) {
    lines.push([
      version.versionNumber,
      version.isCurrent ? '*' : '-',
      version.createdAt,
      version.reason ?? '-',
      version.contentSha256.slice(0, 12),
      version.storageKey,
    ].join(' '));
  }
  return `${lines.join('\n')}\n`;
}

function usage(): string {
  return [
    'usage:',
    '  bun ./scripts/artifacts.ts history --id <artifact-id> [--json]',
    '  bun ./scripts/artifacts.ts get --id <artifact-id> [--version <n>|--version-id <id>|--before <iso>] [--json]',
    '  bun ./scripts/artifacts.ts rollback --id <artifact-id> (--version <n>|--version-id <id>|--before <iso>) [--reason <text>] [--json]',
    '',
  ].join('\n');
}

export function runArtifactsCli(args: readonly string[]): { ok: boolean; output: unknown; text: string } {
  const [command = 'help'] = args;
  const artifactId = readFlagValue(args, '--id');
  if (command === 'help' || command === '--help' || command === '-h') return { ok: true, output: null, text: usage() };
  if (!artifactId) return { ok: false, output: { error: { code: 'MISSING_ARTIFACT_ID', message: '--id is required' } }, text: '--id is required\n' };

  if (command === 'history') {
    const versions = listWorkspaceArtifactVersions(artifactId);
    return { ok: true, output: { artifactId, versions }, text: renderHistory(artifactId, versions) };
  }

  if (command === 'get') {
    const version = getWorkspaceArtifactVersion(artifactId, versionSelector(args));
    return { ok: true, output: { artifactId, version }, text: `${artifactId} v${version.versionNumber} ${version.storageKey}\n` };
  }

  if (command === 'rollback') {
    const selector = versionSelector(args);
    if (!selector.versionId && !selector.versionNumber && !selector.before) {
      return { ok: false, output: { error: { code: 'MISSING_VERSION_SELECTOR', message: 'rollback requires --version, --version-id, or --before' } }, text: 'rollback requires --version, --version-id, or --before\n' };
    }
    const artifact = rollbackWorkspaceArtifact({
      artifactId,
      ...selector,
      reason: readFlagValue(args, '--reason') ?? 'cli rollback',
    });
    return { ok: true, output: { artifactId, artifact }, text: `${artifactId} restored ${artifact.currentVersionId}\n` };
  }

  return { ok: false, output: { error: { code: 'UNKNOWN_COMMAND', message: `Unknown artifacts command: ${command}` } }, text: usage() };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  try {
    const result = runArtifactsCli(args);
    writeStdout(hasFlag(args, '--json') ? safeJson(result.output) : result.text);
    if (!result.ok) process.exitCode = 1;
  } catch (error: unknown) {
    writeStdout(safeJson({ error: { code: 'ARTIFACTS_COMMAND_FAILED', message: error instanceof Error ? error.message : String(error) } }));
    process.exitCode = 1;
  }
}
