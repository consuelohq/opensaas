import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function writeFakeGrok(
  executablePath: string,
  output = '{"text":"fake grok ok","stopReason":"EndTurn"}',
): string {
  mkdirSync(dirname(executablePath), { recursive: true });
  writeFileSync(
    executablePath,
    [
      '#!/bin/sh',
      'if [ "$1" = "--help" ]; then',
      "  printf '%s\\n' '--permission-mode <MODE> --max-turns <N> --deny <RULE> --no-memory --no-subagents'",
      '  exit 0',
      'fi',
      `printf '%s\\n' '${output}'`,
      '',
    ].join('\n'),
  );
  chmodSync(executablePath, 0o755);
  return executablePath;
}

async function runGrok(root: string, env: NodeJS.ProcessEnv, overrides: Record<string, unknown> = {}) {
  const isolatedEnv = { ...env, CONSUELO_HOME: root };
  return executeTool('subagent', {
    provider: 'grok',
    policy: 'read',
    instructionPath: writeInstruction(root),
    outputFormat: 'json',
    ...overrides,
  }, stableOptions(root, isolatedEnv));
}

function writeRetryingFakeGrok(root: string): { executable: string; attemptsPath: string } {
  const executable = join(root, '.grok', 'bin', 'grok');
  const attemptsPath = join(root, 'grok-attempts.txt');
  mkdirSync(dirname(executable), { recursive: true });
  writeFileSync(executable, [
    '#!/bin/sh',
    'if [ "$1" = "--help" ]; then',
    "  printf '%s\\n' '--permission-mode <MODE> --max-turns <N> --deny <RULE> --no-memory --no-subagents'",
    '  exit 0',
    'fi',
    'count=0',
    'if [ -f "$GROK_ATTEMPTS_PATH" ]; then IFS= read -r count < "$GROK_ATTEMPTS_PATH" || true; fi',
    'count=$((count + 1))',
    'printf "%s\\n" "$count" > "$GROK_ATTEMPTS_PATH"',
    'if [ "$count" -le "${GROK_FAIL_ATTEMPTS:-0}" ]; then',
    '  printf "%s\\n" "fake grok failure $count" >&2',
    '  exit 7',
    'fi',
    "printf '%s\\n' '{\"text\":\"retry success\",\"stopReason\":\"EndTurn\"}'",
    '',
  ].join('\n'));
  chmodSync(executable, 0o755);
  return { executable, attemptsPath };
}

describe('Grok subagent executable discovery', () => {
  it('should enforce read-only auto permissions and bounded execution when policy is read', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-read-policy-'));
    try {
      const executable = writeFakeGrok(join(root, '.grok', 'bin', 'grok'));
      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.command).toEqual(expect.arrayContaining([
        executable,
        '--permission-mode',
        'auto',
        '--max-turns',
        '32',
        '--deny',
        'Edit',
        '--deny',
        'Write',
        '--deny',
        'Bash',
        '--no-memory',
        '--no-subagents',
      ]));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should reject read policy when Grok cannot enforce mutation denies', async () => {
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
      expect(result.data.stderr).toContain('requires auto permission mode, mutation denies, and bounded turns');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips Grok after three cancelled completions', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-cancelled-run-'));
    try {
      writeFakeGrok(
        join(root, '.grok', 'bin', 'grok'),
        '{"text":"partial review","stopReason":"Cancelled"}',
      );

      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(result.data.status).toBe('not_supported');
      expect(result.data.stderr).toContain('stop reason Cancelled');
      expect(result.data.stderr).toContain('skipped after 3 failed attempts');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips Grok after three empty completions', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-empty-run-'));
    try {
      writeFakeGrok(
        join(root, '.grok', 'bin', 'grok'),
        '{"text":"","stopReason":"EndTurn"}',
      );

      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(result.data.status).toBe('not_supported');
      expect(result.data.stderr).toContain('without a final message');
      expect(result.data.stderr).toContain('skipped after 3 failed attempts');
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

  it('retries direct Grok execution and succeeds on the third attempt', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-retry-success-'));
    try {
      const fake = writeRetryingFakeGrok(root);
      const result = await runGrok(root, {
        ...process.env,
        HOME: root,
        PATH: '',
        GROK_ATTEMPTS_PATH: fake.attemptsPath,
        GROK_FAIL_ATTEMPTS: '2',
      });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(result.data.status).toBe('completed');
      expect(result.data.finalMessage).toBe('retry success');
      expect(result.data.runId).toBeUndefined();
      expect(result.data.capabilities.detachedExecution).toBe(false);
      expect(readFileSync(fake.attemptsPath, 'utf8').trim(), result.data.stderr).toBe('3');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('skips Grok non-fatally after exactly three failed direct attempts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-retry-skip-'));
    try {
      const fake = writeRetryingFakeGrok(root);
      const result = await runGrok(root, {
        ...process.env,
        HOME: root,
        PATH: '',
        GROK_ATTEMPTS_PATH: fake.attemptsPath,
        GROK_FAIL_ATTEMPTS: '9',
      });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(result.data.status).toBe('not_supported');
      expect(result.data.stderr).toContain('skipped after 3 failed attempts');
      expect(result.data.runId).toBeUndefined();
      expect(result.data.capabilities.detachedExecution).toBe(false);
      expect(readFileSync(fake.attemptsPath, 'utf8').trim()).toBe('3');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not support detached start for Grok', async () => {
    const root = mkdtempSync(join(tmpdir(), 'os-grok-no-detached-start-'));
    try {
      const executable = writeFakeGrok(join(root, '.grok', 'bin', 'grok'));
      const result = await runGrok(root, { ...process.env, HOME: root, PATH: '' }, { action: 'start' });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(result.data.status).toBe('not_supported');
      expect(result.data.capabilities.detachedExecution).toBe(false);
      expect(result.data.command).toEqual([]);
      expect(result.data.runId).toBeUndefined();
      expect(executable).toBeTruthy();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
