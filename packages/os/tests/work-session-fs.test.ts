import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import { executeTool } from '../scripts/lib/facade/executor';
import {
  createDefaultNodeYamlConfig,
  resolveConsueloHomeLayout,
  writeYamlConfig,
} from '../scripts/lib/consuelo-home';
import { createWorkSession } from '../scripts/lib/work-session';
import { removeSafeTempDir } from './safe-temp-cleanup';

const tempRoots: string[] = [];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-work-session-fs-'));
  tempRoots.push(root);
  return root;
}

function makeWorkSession(root: string, workPath: string) {
  const home = join(root, 'home');
  mkdirSync(workPath, { recursive: true });
  const layout = resolveConsueloHomeLayout(home);
  writeYamlConfig(
    layout.nodeConfigPath,
    createDefaultNodeYamlConfig({
      nodeId: 'node_work_session_fs',
      nodeName: 'Work Session FS Test',
      workspaceId: 'workspace_work_session_fs',
    }),
    false,
  );
  const metadata = createWorkSession({
    home,
    path: workPath,
    now: () => new Date('2026-08-15T02:00:00.000Z'),
    randomUUID: () => '12345678-1234-4234-9234-123456789abc',
  });
  return { home, metadata };
}

function options(home: string, cwd = process.cwd(), extraEnv: NodeJS.ProcessEnv = {}) {
  return {
    cwd,
    env: {
      ...process.env,
      CONSUELO_HOME: home,
      ...extraEnv,
    },
    logMode: 'silent' as const,
  };
}

function installTrashStub(root: string): NodeJS.ProcessEnv {
  const binDir = join(root, 'bin');
  const stub = join(binDir, 'trash');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(stub, [
    '#!/usr/bin/env bun',
    "import fs from 'node:fs';",
    'const target = process.argv[2];',
    "if (!target) process.exit(2);",
    'fs.rmSync(target, { recursive: true, force: true });',
  ].join('\n'));
  chmodSync(stub, 0o755);
  return { PATH: `${binDir}:${process.env.PATH ?? ''}` };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) removeSafeTempDir(root, 'consuelo-work-session-fs-');
  }
});

describe('work-session filesystem mutation authority', () => {
  it('writes relative to the trusted work-session root without a taskSession', async () => {
    const root = makeRoot();
    const workPath = join(root, 'raycast-extension');
    const { home, metadata } = makeWorkSession(root, workPath);

    const result = await executeTool('fs.write', {
      workSession: metadata.workSession,
      path: 'src/index.ts',
      content: 'export const answer = 42;\n',
      mkdirs: true,
    }, options(home));

    expect(result.ok).toBe(true);
    expect(readFileSync(join(workPath, 'src/index.ts'), 'utf8')).toBe('export const answer = 42;\n');
  });

  it('applies patches and trashes files inside the trusted work-session root', async () => {
    const root = makeRoot();
    const workPath = join(root, 'notes');
    const { home, metadata } = makeWorkSession(root, workPath);
    writeFileSync(join(workPath, 'before.txt'), 'before\n');
    const trashEnv = installTrashStub(root);

    const patch = await executeTool('fs.apply_patch', {
      workSession: metadata.workSession,
      patchText: [
        '*** Begin Patch',
        '*** Update File: before.txt',
        '@@',
        '-before',
        '+after',
        '*** Add File: added.txt',
        '+added',
        '*** End Patch',
      ].join('\n'),
    }, options(home));

    expect(patch.ok).toBe(true);
    expect(readFileSync(join(workPath, 'before.txt'), 'utf8')).toBe('after\n');
    expect(readFileSync(join(workPath, 'added.txt'), 'utf8')).toBe('added\n');

    const trash = await executeTool('fs.trash', {
      workSession: metadata.workSession,
      path: 'added.txt',
    }, options(home, process.cwd(), trashEnv));

    expect(trash.ok).toBe(true);
    expect(existsSync(join(workPath, 'added.txt'))).toBe(false);
  });

  it('fails closed for unknown work sessions', async () => {
    const root = makeRoot();
    const home = join(root, 'home');
    const layout = resolveConsueloHomeLayout(home);
    writeYamlConfig(
      layout.nodeConfigPath,
      createDefaultNodeYamlConfig({
        nodeId: 'node_work_session_fs',
        nodeName: 'Work Session FS Test',
        workspaceId: 'workspace_work_session_fs',
      }),
      false,
    );

    const result = await executeTool('fs.write', {
      workSession: 'wrk_1234567812344234',
      path: 'nope.txt',
      content: 'nope',
    }, options(home));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('WORK_SESSION_NOT_FOUND');
  });

  it('rejects lexical and absolute write escapes', async () => {
    const root = makeRoot();
    const workPath = join(root, 'work');
    const { home, metadata } = makeWorkSession(root, workPath);
    const outsidePath = join(root, 'outside.txt');

    const parentEscape = await executeTool('fs.write', {
      workSession: metadata.workSession,
      path: '../outside.txt',
      content: 'escape',
    }, options(home));
    const absoluteEscape = await executeTool('fs.write', {
      workSession: metadata.workSession,
      path: outsidePath,
      content: 'escape',
    }, options(home));

    expect(parentEscape.ok).toBe(false);
    expect(absoluteEscape.ok).toBe(false);
    expect(existsSync(outsidePath)).toBe(false);
  });

  it('rejects symlink escapes for write, apply-patch, and trash', async () => {
    const root = makeRoot();
    const workPath = join(root, 'work');
    const outsidePath = join(root, 'outside');
    mkdirSync(outsidePath, { recursive: true });
    writeFileSync(join(outsidePath, 'outside.txt'), 'outside\n');
    const { home, metadata } = makeWorkSession(root, workPath);
    symlinkSync(outsidePath, join(workPath, 'escape'), 'dir');

    const write = await executeTool('fs.write', {
      workSession: metadata.workSession,
      path: 'escape/evil.txt',
      content: 'evil',
    }, options(home));
    const patch = await executeTool('fs.apply_patch', {
      workSession: metadata.workSession,
      patchText: [
        '*** Begin Patch',
        '*** Update File: escape/outside.txt',
        '@@',
        '-outside',
        '+mutated',
        '*** End Patch',
      ].join('\n'),
    }, options(home));
    const trash = await executeTool('fs.trash', {
      workSession: metadata.workSession,
      path: 'escape/outside.txt',
    }, options(home));

    expect(write.ok).toBe(false);
    expect(patch.ok).toBe(false);
    expect(trash.ok).toBe(false);
    expect(existsSync(join(outsidePath, 'evil.txt'))).toBe(false);
    expect(readFileSync(join(outsidePath, 'outside.txt'), 'utf8')).toBe('outside\n');
  });

  it('rejects a work session rooted in the managed repo and its linked worktrees', async () => {
    const root = makeRoot();
    const repo = join(root, 'repo');
    const linked = join(root, 'linked-task');
    mkdirSync(repo, { recursive: true });
    execFileSync('git', ['init', '-b', 'main'], { cwd: repo, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
    writeFileSync(join(repo, 'README.md'), 'repo\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: repo, stdio: 'ignore' });
    execFileSync('git', ['worktree', 'add', '-b', 'task/test/work-session', linked], { cwd: repo, stdio: 'ignore' });

    const mainSession = makeWorkSession(root, repo);
    const linkedRoot = join(root, 'linked-home-root');
    mkdirSync(linkedRoot, { recursive: true });
    const linkedSession = makeWorkSession(linkedRoot, linked);

    const mainResult = await executeTool('fs.write', {
      workSession: mainSession.metadata.workSession,
      path: 'blocked.txt',
      content: 'blocked',
    }, options(mainSession.home, repo));
    const linkedResult = await executeTool('fs.write', {
      workSession: linkedSession.metadata.workSession,
      path: 'blocked.txt',
      content: 'blocked',
    }, options(linkedSession.home, repo));

    expect(mainResult.ok).toBe(false);
    expect(mainResult.code).toBe('PERMISSION_DENIED');
    expect(linkedResult.ok).toBe(false);
    expect(linkedResult.code).toBe('PERMISSION_DENIED');
    expect(existsSync(join(repo, 'blocked.txt'))).toBe(false);
    expect(existsSync(join(linked, 'blocked.txt'))).toBe(false);
  });

  it('defensively rejects simultaneous task and work authority', async () => {
    const root = makeRoot();
    const workPath = join(root, 'work');
    const { home, metadata } = makeWorkSession(root, workPath);

    const result = await executeTool('fs.write', {
      taskSession: 'tsk_conflict',
      workSession: metadata.workSession,
      path: 'blocked.txt',
      content: 'blocked',
    }, options(home));

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(existsSync(join(workPath, 'blocked.txt'))).toBe(false);
  });
});
