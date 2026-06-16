import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { executeCodeCall } from '../scripts/lib/code-call/runtime';

const TEST_UUID = 'abc123def4567890abc123def4567890';

function tempRoot(prefix = 'os-code-call-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function tempTaskWorktree(): string {
  const worktreeRoot = join(tmpdir(), 'opensaas-worktrees');
  mkdirSync(worktreeRoot, { recursive: true });
  return mkdtempSync(join(worktreeRoot, 'task-os-code-call-'));
}

function scriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'code-call.ts');
}

function toolRunnerPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'tool-runner.ts');
}

function runCodeCall(input: Parameters<typeof executeCodeCall>[0], cwd: string) {
  return executeCodeCall(input, {
    cwd,
    now: () => 1000,
    randomUUID: () => TEST_UUID,
  });
}

function initGitRepo(cwd: string): void {
  const result = spawnSync('git', ['init'], { cwd, encoding: 'utf8' });
  expect(result.status).toBe(0);
}

describe('code.call runtime', () => {
  it('rejects shell-escaped Python transport', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'python3 -c "print(1)"',
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(result.data.detectedMistakeClass).toBe('shell_escaped_code');
      expect(result.data.message).toContain('raw multiline Python');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs multiline Python through a staged file', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python3',
        mode: 'verify',
        code: 'import json\nprint(json.dumps({"value": 42}))',
      }, root);

      expect(result.ok).toBe(true);
      expect(result.data.language).toBe('python');
      expect(result.data.runtime).toBe('python3');
      expect(result.data.stdout.trim()).toBe('{"value": 42}');
      expect(result.data.filesChanged).toEqual([]);
      expect(result.data.truncated).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs Bun JavaScript through a staged file', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'javascript',
        mode: 'read',
        code: 'process.stdout.write(JSON.stringify({ value: 7 }))',
      }, root);

      expect(result.ok).toBe(true);
      expect(result.data.language).toBe('bun');
      expect(result.data.runtime).toBe('bun');
      expect(result.data.stdout.trim()).toBe('{"value":7}');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs Bash through a staged script', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'shell',
        mode: 'verify',
        code: 'echo "$((1 + 1))"',
      }, root);

      expect(result.ok).toBe(true);
      expect(result.data.language).toBe('bash');
      expect(result.data.runtime).toContain('bash');
      expect(result.data.stdout.trim()).toBe('2');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses codeFile and stdinFile for staged payloads', async () => {
    const root = tempRoot();
    try {
      const codeFile = join(root, 'program.py');
      const stdinFile = join(root, 'input.txt');
      writeFileSync(codeFile, 'import sys\nprint(sys.stdin.read().upper())');
      writeFileSync(stdinFile, 'hello from stdin');

      const result = await runCodeCall({
        language: 'python',
        mode: 'read',
        codeFile,
        stdinFile,
      }, root);

      expect(result.ok).toBe(true);
      expect(result.data.stdout.trim()).toBe('HELLO FROM STDIN');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails read mode when repo files change', async () => {
    const root = tempRoot();
    try {
      initGitRepo(root);

      const result = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'from pathlib import Path\nPath("created.txt").write_text("changed")',
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMAND_FAILED');
      expect(result.data.detectedMistakeClass).toBe('mutation_in_read_mode');
      expect(result.data.filesChanged).toEqual(['created.txt']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks edit mode in the first implementation slice', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python',
        mode: 'edit',
        code: 'print("edit")',
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(result.data.detectedMistakeClass).toBe('edit_without_task');
      expect(result.data.message).toContain('mode=edit');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows edit mode when the facade has already routed cwd to a managed task worktree', async () => {
    const root = tempTaskWorktree();
    try {
      const result = await executeCodeCall({
        language: 'bash',
        mode: 'edit',
        code: 'printf changed > edited.txt',
      }, {
        cwd: root,
        now: () => 1000,
        randomUUID: () => TEST_UUID,
      });

      expect(result.ok).toBe(true);
      expect(result.code).toBe('OK');
      expect(result.data.cwd).toBe(realpathSync(root));
      expect(result.data.filesChanged).toContain('edited.txt');
      expect(readFileSync(join(root, 'edited.txt'), 'utf8')).toBe('changed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('truncates oversized output deterministically', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'print("x" * 100)',
        maxResultChars: 20,
      }, root);

      expect(result.ok).toBe(true);
      expect(result.data.truncated).toBe(true);
      expect(result.data.stdout.length).toBeLessThanOrEqual(20);
      expect(result.data.stdoutLogPath).toBeTruthy();
      expect(readFileSync(String(result.data.stdoutLogPath), 'utf8')).toContain('xxx');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports timeouts clearly', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python',
        mode: 'verify',
        code: 'import time\ntime.sleep(2)',
        timeout: 50,
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('TIMEOUT');
      expect(result.data.detectedMistakeClass).toBe('timeout');
      expect(result.data.message).toContain('timed out');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects cwd escape outside workspace and temp roots', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python',
        mode: 'read',
        cwd: '/etc',
        code: 'print("nope")',
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(result.data.detectedMistakeClass).toBe('cwd_out_of_scope');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('os code-call CLI', () => {
  it('accepts JSON input from an input file', () => {
    const root = tempRoot();
    try {
      const inputPath = join(root, 'input.json');
      writeFileSync(inputPath, JSON.stringify({
        language: 'python',
        mode: 'read',
        code: 'print("cli")',
        cwd: root,
      }));

      const result = spawnSync('bun', [scriptPath(), '--input-file', inputPath], {
        cwd: root,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const envelope = JSON.parse(result.stdout);
      expect(envelope.ok).toBe(true);
      expect(envelope.data.stdout.trim()).toBe('cli');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});


describe('code.call OS integration', () => {
  it('runs through the OS facade tool-runner', () => {
    const root = tempRoot();
    try {
      const result = spawnSync('bun', [toolRunnerPath(), 'code.call', JSON.stringify({
        language: 'python',
        mode: 'read',
        code: 'print("facade")',
        cwd: root,
      })], {
        cwd: root,
        encoding: 'utf8',
      });

      expect(result.status).toBe(0);
      const envelope = JSON.parse(result.stdout);
      expect(envelope.ok).toBe(true);
      expect(envelope.data.stdout.trim()).toBe('facade');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is generated as a core OS tool and documented for steering', () => {
    const osRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const fullManifest = JSON.parse(readFileSync(join(osRoot, 'manifests', 'tool.manifest.json'), 'utf8'));
    const coreManifest = JSON.parse(readFileSync(join(osRoot, 'manifests', 'core.manifest.json'), 'utf8'));
    const docs = readFileSync(join(osRoot, 'TOOLS.md'), 'utf8');
    const fullEntry = fullManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');
    const coreEntry = coreManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');

    expect(fullEntry?.core).toBe(true);
    expect(coreEntry?.core).toBe(true);
    expect(fullEntry?.definition?.command?.internal).toBe('code.call');
    expect(docs).toContain('workspace.code.call');
    expect(docs).toContain('preferred repo-scoped execution tool');
  });
});
