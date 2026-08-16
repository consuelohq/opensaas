import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const streamSyncPath = resolve(import.meta.dirname, '../scripts/stream-sync.js');
const roots = [];

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function write(path, content) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

function setupFixture({ extraConflict = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'consuelo-stream-sync-registry-'));
  roots.push(root);
  const repo = join(root, 'repo');
  const origin = join(root, 'origin.git');
  const worktrees = join(root, 'worktrees');
  mkdirSync(repo, { recursive: true });
  mkdirSync(worktrees, { recursive: true });

  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'tests@consuelo.local');
  git(repo, 'config', 'user.name', 'Consuelo Tests');

  write(join(repo, 'package.json'), JSON.stringify({
    scripts: { verify: 'node verify.js' },
  }, null, 2));
  write(join(repo, 'verify.js'), "process.stdout.write(JSON.stringify({ publishValid: true }) + '\\n');\n");
  write(join(repo, 'packages/workspace/scripts/test-selection.js'), `
const fs = require('fs');
const args = process.argv.slice(2);
if (args[0] !== 'generate') process.exit(2);
const outIndex = args.indexOf('--out');
if (outIndex < 0 || !args[outIndex + 1]) process.exit(3);
fs.writeFileSync(args[outIndex + 1], JSON.stringify({ regenerated: true }, null, 2) + '\\n');
process.stdout.write(JSON.stringify({ generated: args[outIndex + 1] }) + '\\n');
`);
  write(join(repo, 'packages/workspace/test-selection.registry.json'), '{"side":"base"}\n');
  if (extraConflict) write(join(repo, 'conflict.txt'), 'base\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'base');

  git(root, 'init', '--bare', origin);
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-u', 'origin', 'main');

  git(repo, 'checkout', '-b', 'stream/fixture');
  write(join(repo, 'packages/workspace/test-selection.registry.json'), '{"side":"stream"}\n');
  if (extraConflict) write(join(repo, 'conflict.txt'), 'stream\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'stream change');
  git(repo, 'push', '-u', 'origin', 'stream/fixture');

  git(repo, 'checkout', 'main');
  write(join(repo, 'packages/workspace/test-selection.registry.json'), '{"side":"main"}\n');
  if (extraConflict) write(join(repo, 'conflict.txt'), 'main\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'main change');
  git(repo, 'push', 'origin', 'main');

  return { root, repo, origin, worktrees };
}

function runSync(fixture) {
  return spawnSync('bun', [streamSyncPath, '--area', 'fixture', '--stream', 'stream/fixture', '--json'], {
    cwd: fixture.repo,
    env: {
      ...process.env,
      WORKSPACE_WORKTREE_ROOT: fixture.worktrees,
    },
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop(), { recursive: true, force: true });
  }
});

describe('stream sync generated registry conflict recovery', () => {
  test('regenerates the generated test-selection registry when it is the only conflict', () => {
    const fixture = setupFixture();
    const result = runSync(fixture);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('success');
    expect(payload.conflictFiles).toEqual([]);
    expect(payload.autoResolvedGeneratedFiles).toEqual([
      'packages/workspace/test-selection.registry.json',
    ]);
    const remoteRegistry = execFileSync('git', [
      '--git-dir',
      fixture.origin,
      'show',
      'refs/heads/stream/fixture:packages/workspace/test-selection.registry.json',
    ], { encoding: 'utf8' });
    expect(JSON.parse(remoteRegistry)).toEqual({ regenerated: true });
  });

  test('fails closed when a non-generated source conflict is also present', () => {
    const fixture = setupFixture({ extraConflict: true });
    const result = runSync(fixture);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('conflict');
    expect(payload.conflictFiles).toEqual(expect.arrayContaining([
      'conflict.txt',
      'packages/workspace/test-selection.registry.json',
    ]));
    expect(payload.temporaryWorktree).toBe(true);
    expect(existsSync(payload.worktreePath)).toBe(false);
    expect(readFileSync(join(fixture.repo, 'conflict.txt'), 'utf8')).toBe('main\n');
  });

  test('recovers a stale conflicted temporary stream worktree before syncing', () => {
    const fixture = setupFixture({ extraConflict: true });
    const staleWorktreePath = join(fixture.worktrees, 'stream-fixture-sync-stale');
    git(fixture.repo, 'worktree', 'add', staleWorktreePath, 'stream/fixture');

    const staleMerge = spawnSync('git', ['merge', '--no-ff', '--no-edit', 'origin/main'], {
      cwd: staleWorktreePath,
      encoding: 'utf8',
    });
    expect(staleMerge.status).not.toBe(0);
    expect(existsSync(staleWorktreePath)).toBe(true);
    const canonicalStaleWorktreePath = realpathSync.native(staleWorktreePath);

    const result = runSync(fixture);

    expect(result.status).toBe(1);
    const payload = JSON.parse(result.stdout);
    expect(payload.status).toBe('conflict');
    expect(payload.recoveredStaleWorktree).toBe(canonicalStaleWorktreePath);
    expect(existsSync(staleWorktreePath)).toBe(false);
    expect(payload.conflictFiles).toEqual(expect.arrayContaining([
      'conflict.txt',
      'packages/workspace/test-selection.registry.json',
    ]));
  });
});
