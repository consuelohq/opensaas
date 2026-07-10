import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  classifyLocalStream,
  resolveRemoteStreamAction,
} = require('../scripts/lib/stream-lifecycle.js') as {
  classifyLocalStream: (input: {
    branch: string;
    currentBranch?: string | null;
    remoteExists: boolean;
    ahead: number | null;
    behind: number | null;
    worktreePaths?: string[];
    kept?: boolean;
  }) => { removable: boolean; reasons: string[] };
  resolveRemoteStreamAction: (input: {
    streamBranch: string;
    remoteExists: boolean;
    createStream: boolean;
  }) => 'reuse' | 'create';
};

const workspaceCleanupScript = resolve(import.meta.dirname, '../scripts/stream-cleanup.js');
const osCleanupScript = resolve(import.meta.dirname, '../../os/scripts/stream-cleanup.js');
const workspaceLifecycleModule = resolve(import.meta.dirname, '../scripts/lib/stream-lifecycle.js');
const osLifecycleModule = resolve(import.meta.dirname, '../../os/scripts/lib/stream-lifecycle.js');

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function branchExists(cwd: string, branch: string): boolean {
  return spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd }).status === 0;
}

function createCleanupFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'stream-cleanup-'));
  const remote = join(root, 'origin.git');
  const repo = join(root, 'repo');

  execFileSync('git', ['init', '--bare', remote]);
  execFileSync('git', ['init', repo]);
  git(repo, ['config', 'user.email', 'stream-cleanup@example.com']);
  git(repo, ['config', 'user.name', 'Stream Cleanup Test']);
  writeFileSync(join(repo, 'README.md'), '# fixture\n');
  git(repo, ['add', 'README.md']);
  git(repo, ['commit', '-m', 'initial']);
  git(repo, ['branch', '-M', 'main']);
  git(repo, ['remote', 'add', 'origin', remote]);
  git(repo, ['push', '-u', 'origin', 'main']);

  git(repo, ['switch', '-c', 'stream/safe']);
  git(repo, ['push', '-u', 'origin', 'stream/safe']);
  git(repo, ['switch', 'main']);

  git(repo, ['switch', '-c', 'stream/local-only']);
  git(repo, ['switch', 'main']);

  git(repo, ['switch', '-c', 'stream/ahead']);
  git(repo, ['push', '-u', 'origin', 'stream/ahead']);
  writeFileSync(join(repo, 'ahead.txt'), 'unique local commit\n');
  git(repo, ['add', 'ahead.txt']);
  git(repo, ['commit', '-m', 'unique local stream commit']);
  git(repo, ['switch', 'main']);

  return repo;
}

describe('stream lifecycle safety', () => {
  it('marks only origin-backed zero-ahead local streams as removable', () => {
    expect(classifyLocalStream({
      branch: 'stream/safe',
      currentBranch: 'main',
      remoteExists: true,
      ahead: 0,
      behind: 12,
      worktreePaths: [],
    })).toEqual({ removable: true, reasons: [] });
  });

  it.each([
    ['current branch', { currentBranch: 'stream/example', remoteExists: true, ahead: 0, behind: 0, worktreePaths: [] }, 'current branch'],
    ['worktree branch', { currentBranch: 'main', remoteExists: true, ahead: 0, behind: 0, worktreePaths: ['/tmp/example'] }, 'checked out in a worktree'],
    ['local-only branch', { currentBranch: 'main', remoteExists: false, ahead: null, behind: null, worktreePaths: [] }, 'no origin backup'],
    ['ahead branch', { currentBranch: 'main', remoteExists: true, ahead: 1, behind: 0, worktreePaths: [] }, '1 unique local commit'],
    ['kept branch', { currentBranch: 'main', remoteExists: true, ahead: 0, behind: 0, worktreePaths: [], kept: true }, 'explicitly kept'],
  ])('protects a %s', (_label, input, expectedReason) => {
    const result = classifyLocalStream({ branch: 'stream/example', ...input });
    expect(result.removable).toBe(false);
    expect(result.reasons).toContain(expectedReason);
  });

  it('requires explicit approval before creating a missing remote stream', () => {
    expect(resolveRemoteStreamAction({
      streamBranch: 'stream/tooling',
      remoteExists: true,
      createStream: false,
    })).toBe('reuse');

    expect(resolveRemoteStreamAction({
      streamBranch: 'stream/new-area',
      remoteExists: false,
      createStream: true,
    })).toBe('create');

    expect(() => resolveRemoteStreamAction({
      streamBranch: 'stream/new-area',
      remoteExists: false,
      createStream: false,
    })).toThrow('pass --create-stream');
  });

  it('previews by default and applies only safe local branch removals', () => {
    const repo = createCleanupFixture();

    const preview = spawnSync('bun', [workspaceCleanupScript, '--json'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(preview.status, preview.stderr).toBe(0);
    const previewResult = JSON.parse(preview.stdout) as {
      applied: boolean;
      removable: Array<{ branch: string }>;
      protected: Array<{ branch: string; reasons: string[] }>;
      removed: string[];
    };
    expect(previewResult.applied).toBe(false);
    expect(previewResult.removable.map((item) => item.branch)).toContain('stream/safe');
    expect(previewResult.removed).toEqual([]);
    expect(branchExists(repo, 'stream/safe')).toBe(true);

    const explicitFalse = spawnSync('bun', [workspaceCleanupScript, '--apply=false', '--json'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(explicitFalse.status, explicitFalse.stderr).toBe(0);
    expect(JSON.parse(explicitFalse.stdout).applied).toBe(false);
    expect(branchExists(repo, 'stream/safe')).toBe(true);

    const apply = spawnSync('bun', [workspaceCleanupScript, '--apply', '--json'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(apply.status, apply.stderr).toBe(0);
    const applyResult = JSON.parse(apply.stdout) as {
      applied: boolean;
      removed: string[];
      protected: Array<{ branch: string; reasons: string[] }>;
    };
    expect(applyResult.applied).toBe(true);
    expect(applyResult.removed).toEqual(['stream/safe']);
    expect(branchExists(repo, 'stream/safe')).toBe(false);
    expect(branchExists(repo, 'stream/local-only')).toBe(true);
    expect(branchExists(repo, 'stream/ahead')).toBe(true);
    expect(applyResult.protected.find((item) => item.branch === 'stream/local-only')?.reasons).toContain('no origin backup');
    expect(applyResult.protected.find((item) => item.branch === 'stream/ahead')?.reasons).toContain('1 unique local commit');
  });


  it('exposes stream cleanup and explicit stream creation in public manifests', () => {
    for (const manifestPath of [
      resolve(import.meta.dirname, '../tooling/tool-manifest.json'),
      resolve(import.meta.dirname, '../../os/tooling/dev-tool-manifest.json'),
    ]) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Array<{
        name: string;
        inputSchema?: string;
        command?: { arguments?: Array<{ source?: string; flag?: string }> };
      }>;
      const cleanup = manifest.find((entry) => entry.name === 'stream.cleanup');
      expect(cleanup?.inputSchema).toBe('StreamCleanupInput');
      expect(cleanup?.command?.arguments).toEqual(expect.arrayContaining([
        expect.objectContaining({ source: 'apply', flag: '--apply' }),
        expect.objectContaining({ source: 'keep', flag: '--keep' }),
      ]));

      const taskStart = manifest.find((entry) => entry.name === 'task.start');
      expect(taskStart?.command?.arguments).toEqual(expect.arrayContaining([
        expect.objectContaining({ source: 'createStream', flag: '--create-stream' }),
      ]));
    }
  });

  it('documents explicit stream creation in both task start CLIs', () => {
    for (const script of [
      resolve(import.meta.dirname, '../scripts/task-start.js'),
      resolve(import.meta.dirname, '../../os/scripts/task-start.js'),
    ]) {
      const result = spawnSync('bun', [script, '--help'], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('--create-stream');
    }
  });

  it('keeps workspace and OS cleanup runtimes byte-identical', () => {
    expect(existsSync(osCleanupScript)).toBe(true);
    expect(existsSync(osLifecycleModule)).toBe(true);
    expect(readFileSync(workspaceCleanupScript, 'utf8')).toBe(readFileSync(osCleanupScript, 'utf8'));
    expect(readFileSync(workspaceLifecycleModule, 'utf8')).toBe(readFileSync(osLifecycleModule, 'utf8'));
  });
});
