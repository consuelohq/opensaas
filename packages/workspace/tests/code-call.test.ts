import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { executeCodeCall } from '../scripts/lib/code-call/runtime';

const TEST_UUID = 'abc123def4567890abc123def4567890';

function tempRoot(prefix = 'workspace-code-call-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function tempTaskWorktree(): string {
  const worktreeRoot = join(tmpdir(), 'opensaas-worktrees');
  mkdirSync(worktreeRoot, { recursive: true });
  return mkdtempSync(join(worktreeRoot, 'task-workspace-code-call-'));
}

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
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

  it('rejects binary codeFile and stdinFile payloads', async () => {
    const root = tempRoot();
    try {
      const codeFile = join(root, 'program.bin');
      const stdinFile = join(root, 'input.bin');
      writeFileSync(codeFile, 'print(1)');
      writeFileSync(stdinFile, 'hello');

      const codeResult = await runCodeCall({
        language: 'python',
        mode: 'read',
        codeFile,
      }, root);
      const stdinResult = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'import sys\nprint(sys.stdin.read())',
        stdinFile,
      }, root);

      expect(codeResult.ok).toBe(false);
      expect(codeResult.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(codeResult.data.detectedMistakeClass).toBe('invalid_source');
      expect(codeResult.data.message).toContain('binary');
      expect(stdinResult.ok).toBe(false);
      expect(stdinResult.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(stdinResult.data.detectedMistakeClass).toBe('invalid_source');
      expect(stdinResult.data.message).toContain('binary');
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

  it('reports unsupported languages with the existing validation envelope', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'ruby',
        mode: 'read',
        code: 'puts 1',
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(result.data.detectedMistakeClass).toBe('unsupported_language');
      expect(result.data.requestedLanguage).toBe('ruby');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects invalid source and stdin shapes before execution', async () => {
    const root = tempRoot();
    try {
      const duplicateSource = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'print("inline")',
        codeFile: 'program.py',
      }, root);
      const duplicateStdin = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'import sys\nprint(sys.stdin.read())',
        stdin: 'inline',
        stdinFile: 'input.txt',
      }, root);

      expect(duplicateSource.ok).toBe(false);
      expect(duplicateSource.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(duplicateSource.data.detectedMistakeClass).toBe('invalid_source');
      expect(duplicateSource.data.message).toContain('exactly one of code or codeFile');
      expect(duplicateStdin.ok).toBe(false);
      expect(duplicateStdin.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(duplicateStdin.data.detectedMistakeClass).toBe('invalid_source');
      expect(duplicateStdin.data.message).toContain('at most one of stdin or stdinFile');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects codeFile and stdinFile paths outside approved roots', async () => {
    const root = tempRoot();
    try {
      const codeFileResult = await runCodeCall({
        language: 'python',
        mode: 'read',
        codeFile: '/etc/hosts',
      }, root);
      const stdinFileResult = await runCodeCall({
        language: 'python',
        mode: 'read',
        code: 'import sys\nprint(sys.stdin.read())',
        stdinFile: '/etc/hosts',
      }, root);

      expect(codeFileResult.ok).toBe(false);
      expect(codeFileResult.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(codeFileResult.data.detectedMistakeClass).toBe('cwd_out_of_scope');
      expect(stdinFileResult.ok).toBe(false);
      expect(stdinFileResult.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(stdinFileResult.data.detectedMistakeClass).toBe('cwd_out_of_scope');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports non-zero process exits through the command-failed envelope', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'python',
        mode: 'verify',
        code: 'import sys\nsys.stderr.write("bad exit")\nsys.exit(3)',
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMAND_FAILED');
      expect(result.exitCode).toBe(3);
      expect(result.data.exitCode).toBe(3);
      expect(result.data.stderr).toContain('bad exit');
      expect(result.data.message).toBe('runtime exited non-zero');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports missing runtimes as runtime_missing', async () => {
    const root = tempRoot();
    try {
      const result = await executeCodeCall({
        language: 'python',
        mode: 'verify',
        code: 'print("missing")',
      }, {
        cwd: root,
        env: { PATH: join(root, 'missing-bin') },
        now: () => 1000,
        randomUUID: () => TEST_UUID,
      });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('COMMAND_FAILED');
      expect(result.data.detectedMistakeClass).toBe('runtime_missing');
      expect(result.data.message).toContain('runtime is missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks destructive bash patterns before process execution', async () => {
    const root = tempRoot();
    try {
      const result = await runCodeCall({
        language: 'bash',
        mode: 'verify',
        code: ['r' + 'm', '-rf', '/'].join(' '),
      }, root);

      expect(result.ok).toBe(false);
      expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
      expect(result.data.detectedMistakeClass).toBe('unsafe_shell');
      expect(result.data.message).toContain('destructive shell patterns');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('can invoke workspace fs read through Bun from code.call', async () => {
    const root = repoRoot();
    const result = await runCodeCall({
      language: 'bun',
      mode: 'read',
      cwd: root,
      code: "const proc = Bun.spawnSync({\n  cmd: ['bun', 'packages/workspace/scripts/fs.js', 'read', 'packages/workspace/package.json', '--json'],\n  stdout: 'pipe',\n  stderr: 'pipe',\n});\nconst stdout = new TextDecoder().decode(proc.stdout);\nconst stderr = new TextDecoder().decode(proc.stderr);\nprocess.stdout.write(stdout);\nprocess.stderr.write(stderr);\nprocess.exit(proc.exitCode ?? 1);",
      maxResultChars: 20_000,
    }, root);

    expect(result.ok).toBe(true);
    const output = JSON.parse(result.data.stdout) as { type?: string; path?: string; content?: string };
    expect(output.type).toBe('text-page');
    expect(output.path).toBe('packages/workspace/package.json');
    expect(output.content).toContain('"name": "openworkspace"');
  });
});

describe('workspace code-call CLI', () => {
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


describe('code.call workspace integration', () => {
  it('runs through the workspace facade tool-runner', () => {
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

  it('is generated as a core workspace tool and documented for steering', () => {
    const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const fullManifest = JSON.parse(readFileSync(join(workspaceRoot, 'manifests', 'tool-manifest.json'), 'utf8'));
    const coreManifest = JSON.parse(readFileSync(join(workspaceRoot, 'manifests', 'core-manifest.json'), 'utf8'));
    const docs = readFileSync(join(workspaceRoot, 'TOOLS.md'), 'utf8');
    const fullEntry = fullManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');
    const coreEntry = coreManifest.tools.find((tool: { name: string }) => tool.name === 'code.call');

    expect(fullEntry?.core).toBe(true);
    expect(coreEntry?.core).toBe(true);
    expect(fullEntry?.definition?.command?.internal).toBe('code.call');
    expect(docs).toContain('workspace.code.call');
    expect(docs).toContain('Run focused repo-scoped Python, Bun, or Bash programs');
  });
});
