import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { executeTool } from '../scripts/lib/facade/executor';
import type { ToolRunner } from '../scripts/lib/facade/types';

function successfulRunner(): ToolRunner {
  return async () => ({ stdout: '', stderr: '', exitCode: 0 });
}

function stableOptions(cwd: string, env: NodeJS.ProcessEnv) {
  return {
    cwd,
    env,
    runner: successfulRunner(),
    branchResolver: ({ explicitBranch }: { explicitBranch?: string }) => ({
      ok: true as const,
      branch: explicitBranch || 'task/os/subagent-executable-discovery',
      source: explicitBranch ? 'explicit' : 'test',
    }),
    now: () => 1000,
    randomUUID: () => 'abc123def4567890abc123def4567890',
    currentTask: null,
    candidates: [] as Array<{ branch: string; area: string; worktree: string }>,
  };
}

function writeInstruction(root: string): string {
  const instructionPath = join(root, 'subagent-instructions.md');
  writeFileSync(instructionPath, 'Return a short success message.');
  return instructionPath;
}

function writeFakeGrok(executablePath: string): string {
  mkdirSync(dirname(executablePath), { recursive: true });
  writeFileSync(
    executablePath,
    [
      '#!/bin/sh',
      'if [ "$1" = "--help" ]; then',
      "  printf '%s\\n' '--permission-mode <MODE> --max-turns <N> --no-memory --no-subagents'",
      '  exit 0',
      'fi',
      "printf '%s\\n' '{\"text\":\"fake grok ok\"}'",
      '',
    ].join('\n'),
  );
  chmodSync(executablePath, 0o755);
  return executablePath;
}

async function runGrok(root: string, env: NodeJS.ProcessEnv) {
  return executeTool('subagent', {
    provider: 'grok',
    policy: 'read',
    instructionPath: writeInstruction(root),
    outputFormat: 'json',
  }, stableOptions(root, env));
}

describe('Grok subagent executable discovery', () => {
  it('should enforce plan permissions and bounded execution when policy is read', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-read-policy-'));
    try {
      const executable = writeFakeGrok(join(root, '.grok', 'bin', 'grok'));
      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.command).toEqual(expect.arrayContaining([
        executable,
        '--permission-mode',
        'plan',
        '--max-turns',
        '32',
        '--no-memory',
        '--no-subagents',
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should reject read policy when Grok cannot enforce plan permissions', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-unsupported-read-policy-'));
    try {
      const executable = join(root, '.grok', 'bin', 'grok');
      mkdirSync(dirname(executable), { recursive: true });
      writeFileSync(executable, '#!/bin/sh\nprintf \'%s\\n\' \'Grok help without read controls\'\n');
      chmodSync(executable, 0o755);

      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('not_supported');
      expect(result.data.command).toEqual([executable, '--help']);
      expect(result.data.stderr).toContain('requires plan permission mode');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('discovers Grok in the canonical ~/.grok/bin directory with an empty PATH', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-home-bin-'));
    try {
      const executable = writeFakeGrok(join(root, '.grok', 'bin', 'grok'));
      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.command[0]).toBe(executable);
      expect(result.data.finalMessage).toBe('fake grok ok');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('discovers the agent alias in ~/.local/bin when grok is unavailable', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-agent-alias-'));
    try {
      const executable = writeFakeGrok(join(root, '.local', 'bin', 'agent'));
      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.command[0]).toBe(executable);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses an absolute WORKSPACE_SUBAGENT_GROK_BIN path with an empty PATH', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-absolute-bin-'));
    try {
      const executable = writeFakeGrok(join(root, 'custom-bin', 'grok-build'));
      const result = await runGrok(root, {
        ...process.env,
        HOME: root,
        PATH: '',
        WORKSPACE_SUBAGENT_GROK_BIN: executable,
      });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.command[0]).toBe(executable);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps an explicit Grok binary override authoritative', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-override-authority-'));
    try {
      writeFakeGrok(join(root, '.grok', 'bin', 'grok'));
      const configuredPath = join(root, 'missing', 'configured-grok');
      const result = await runGrok(root, {
        ...process.env,
        HOME: root,
        PATH: '',
        WORKSPACE_SUBAGENT_GROK_BIN: configuredPath,
      });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('not_configured');
      expect(result.data.command[0]).toBe(configuredPath);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
