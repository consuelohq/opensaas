import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { executeCodeCall } from '../scripts/lib/code-call/runtime';
import { createDefaultNodeYamlConfig, resolveConsueloHomeLayout, writeYamlConfig } from '../scripts/lib/consuelo-home';
import { executeTool } from '../scripts/lib/facade/executor';
import { createWorkSession } from '../scripts/lib/work-session';

const tempRoots: string[] = [];
const TEST_UUID = '12345678-1234-4234-9234-123456789abc';

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  expect(result.status, `${args.join(' ')}\n${result.stderr}`).toBe(0);
}

function initRepo(root: string): void {
  runGit(root, ['init', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'tests@consuelo.local']);
  runGit(root, ['config', 'user.name', 'Consuelo Tests']);
  writeFileSync(join(root, 'README.md'), 'initial\n');
  runGit(root, ['add', 'README.md']);
  runGit(root, ['commit', '-m', 'initial']);
}

function createLinkedTaskWorktree(mainRepo: string): string {
  const parent = tempRoot('consuelo-code-call-arbitrary-parent-');
  const worktree = join(parent, 'completely-arbitrary-name');
  runGit(mainRepo, ['worktree', 'add', '-b', 'task/workspace-agent/code-call-test', worktree]);
  return worktree;
}

function createTestWorkSession(home: string, workPath: string): string {
  const layout = resolveConsueloHomeLayout(home);
  writeYamlConfig(
    layout.nodeConfigPath,
    createDefaultNodeYamlConfig({
      nodeId: 'node_work_session_test',
      nodeName: 'Work Session Test',
      workspaceId: 'workspace_work_session_test',
    }),
    false,
  );
  return createWorkSession({
    home,
    path: workPath,
    now: () => new Date('2026-08-15T02:00:00.000Z'),
    randomUUID: () => TEST_UUID,
  }).workSession;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('work-session code.call authority', () => {
  it('rejects mixed task and work session authority before execution', async () => {
    const mainRepo = tempRoot('consuelo-code-call-main-');
    initRepo(mainRepo);

    const result = await executeTool('code.call', {
      taskSession: 'tsk_conflict',
      workSession: 'wrk_conflict',
      language: 'python',
      mode: 'read',
      code: 'print("should not run")',
    }, {
      cwd: mainRepo,
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.message).toContain('taskSession or workSession');
  });

  it.runIf(process.platform === 'darwin')('routes Python edit-mode code.call to the local work-session path', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'edit',
      code: 'from pathlib import Path\nPath("created.txt").write_text("work-session")',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ cwd: realpathSync(workPath) });
    expect(readFileSync(join(workPath, 'created.txt'), 'utf8')).toBe('work-session');
  });

  it.runIf(process.platform === 'darwin')('routes Bash edit-mode code.call inside the work-session boundary', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);

    const result = await executeTool('code.call', {
      workSession,
      language: 'bash',
      mode: 'edit',
      code: 'printf bash > created-bash.txt',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(true);
    expect(readFileSync(join(workPath, 'created-bash.txt'), 'utf8')).toBe('bash');
  });

  it.runIf(process.platform === 'darwin')('routes Bun edit-mode code.call inside the work-session boundary', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);

    const result = await executeTool('code.call', {
      workSession,
      language: 'bun',
      mode: 'edit',
      code: 'await Bun.write("created-bun.txt", "bun")',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(true);
    expect(readFileSync(join(workPath, 'created-bun.txt'), 'utf8')).toBe('bun');
  });

  it.runIf(process.platform !== 'darwin')('fails work-session edits closed when filesystem containment is unavailable', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'edit',
      code: 'print("should not run without containment")',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
    expect(result.message).toContain('containment is unavailable');
  });

  it('rejects work-session edit authority for the managed default repository', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, mainRepo);

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'edit',
      code: 'print("should not run")',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PERMISSION_DENIED');
    expect(result.message).toContain('managed repository');
    expect(result.message).toContain('taskSession');
  });

  it('should protect daemon-owned Consuelo home paths when only the daemon home environment is set', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = join(home, 'ordinary-work');
    mkdirSync(workPath, { recursive: true });
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);
    const env = { ...process.env, WORKSPACE_DAEMON_CONSUELO_HOME: home };
    delete env.CONSUELO_HOME;
    delete env.CONSUELO_OS_HOME;

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'edit',
      code: 'print("should not run")',
    }, {
      cwd: mainRepo,
      env,
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PERMISSION_DENIED');
    expect(result.message).toContain('Consuelo-managed state');
  });

  it.runIf(process.platform === 'darwin')('should deny work-session reads of Consuelo credential directories', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    const keysDir = join(home, 'node', 'keys');
    const secretPath = join(keysDir, 'test-secret.txt');
    mkdirSync(keysDir, { recursive: true });
    writeFileSync(secretPath, 'credential-material');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'read',
      code: `from pathlib import Path\nprint(Path(${JSON.stringify(secretPath)}).read_text())`,
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('COMMAND_FAILED');
    expect(JSON.stringify(result)).not.toContain('credential-material');
  });

  it.runIf(process.platform === 'darwin')('prevents a work-session process from writing outside its root', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    const outside = tempRoot('consuelo-code-call-outside-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);
    const outsideFile = join(outside, 'escaped.txt');

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'edit',
      code: `from pathlib import Path\nPath(${JSON.stringify(outsideFile)}).write_text("escaped")`,
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('COMMAND_FAILED');
    expect(result.data).toMatchObject({ cwd: realpathSync(workPath) });
    expect(() => readFileSync(outsideFile, 'utf8')).toThrow();
  });

  it.runIf(process.platform === 'darwin')('prevents symlink write escapes from a work-session root', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    const outside = tempRoot('consuelo-code-call-outside-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);
    symlinkSync(outside, join(workPath, 'outside-link'));

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'edit',
      code: 'from pathlib import Path\nPath("outside-link/escaped.txt").write_text("escaped")',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('COMMAND_FAILED');
    expect(result.data).toMatchObject({ cwd: realpathSync(workPath) });
    expect(() => readFileSync(join(outside, 'escaped.txt'), 'utf8')).toThrow();
  });

  it.runIf(process.platform === 'darwin')('keeps work-session read mode non-mutating at the filesystem boundary', async () => {
    const home = tempRoot('consuelo-code-call-home-');
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const workPath = tempRoot('consuelo-code-call-work-');
    initRepo(mainRepo);
    const workSession = createTestWorkSession(home, workPath);

    const result = await executeTool('code.call', {
      workSession,
      language: 'python',
      mode: 'read',
      code: 'from pathlib import Path\nPath("should-not-exist.txt").write_text("no")',
    }, {
      cwd: mainRepo,
      env: { ...process.env, CONSUELO_HOME: home },
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('COMMAND_FAILED');
    expect(() => readFileSync(join(workPath, 'should-not-exist.txt'), 'utf8')).toThrow();
  });

  it('recognizes task worktrees by git topology rather than directory naming', async () => {
    const mainRepo = tempRoot('consuelo-code-call-main-');
    initRepo(mainRepo);
    const taskWorktree = createLinkedTaskWorktree(mainRepo);

    const result = await executeCodeCall({
      language: 'bash',
      mode: 'edit',
      taskWorktree,
      branch: 'task/workspace-agent/code-call-test',
      code: 'printf changed > edited.txt',
    }, {
      cwd: mainRepo,
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(true);
    expect(readFileSync(join(taskWorktree, 'edited.txt'), 'utf8')).toBe('changed');
  });

  it('rejects a taskWorktree from an unrelated repository even when its branch is task-shaped', async () => {
    const mainRepo = tempRoot('consuelo-code-call-main-');
    const legacyHeuristicRoot = join(tmpdir(), 'opensaas-worktrees');
    mkdirSync(legacyHeuristicRoot, { recursive: true });
    const unrelatedRepo = mkdtempSync(join(legacyHeuristicRoot, 'task-unrelated-code-call-'));
    tempRoots.push(unrelatedRepo);
    initRepo(mainRepo);
    initRepo(unrelatedRepo);
    runGit(unrelatedRepo, ['checkout', '-b', 'task/workspace-agent/unrelated']);

    const result = await executeCodeCall({
      language: 'bash',
      mode: 'edit',
      taskWorktree: unrelatedRepo,
      branch: 'task/workspace-agent/unrelated',
      code: 'printf unsafe > edited.txt',
    }, {
      cwd: mainRepo,
      now: () => 1_000,
      randomUUID: () => TEST_UUID,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('CODE_CALL_VALIDATION_ERROR');
    expect(result.message).toContain('managed task worktree');
  });
});
