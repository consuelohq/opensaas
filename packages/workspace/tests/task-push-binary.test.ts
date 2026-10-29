import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publisherScripts = [
  resolve(import.meta.dirname, '../scripts/task-push.js'),
  resolve(import.meta.dirname, '../../os/scripts/task-push.js'),
];

type Change = { path: string; deleted: boolean };
type BlobRecord = { sha: string; content: string; encoding: string };
type TreeItem = { path: string; sha: string | null; mode: string; type: string };

function gitBlobSha(bytes: Buffer): string {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest('hex');
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * Run the actual task.push main function, substituting only task selection,
 * GitHub I/O and local sync. In particular, the real on-disk file readers and
 * blob serialization are left unchanged, so byte-corrupting reads fail.
 */
async function publishInSandbox(
  scriptPath: string,
  repoRoot: string,
  argv: string[],
  changes: Change[],
): Promise<{ blobs: BlobRecord[]; tree: TreeItem[]; updatedSha: string | null }> {
  const realRequire = createRequire(scriptPath);
  const blobs: BlobRecord[] = [];
  let tree: TreeItem[] = [];
  let updatedSha: string | null = null;
  const branch = 'task/os/binary-fixture';
  const headSha = 'a'.repeat(40);
  const newSha = 'b'.repeat(40);
  const taskMeta = {
    dir: repoRoot,
    path: join(repoRoot, '.task', 'current.json'),
    data: { area: 'os', taskBranch: branch, worktreePath: repoRoot },
  };

  const github = {
    getToken: () => 'fake-token',
    getBranchRef: async () => ({ object: { sha: headSha } }),
    getCommit: async () => ({ tree: { sha: 'c'.repeat(40) } }),
    createBlob: async ({ content, encoding }: { content: string; encoding: string }) => {
      expect(encoding).toBe('base64');
      const sha = gitBlobSha(Buffer.from(content, 'base64'));
      blobs.push({ sha, content, encoding });
      return { sha };
    },
    createTree: async ({ tree: items }: { tree: TreeItem[] }) => {
      tree = items;
      return { sha: 'd'.repeat(40) };
    },
    createCommit: async () => ({ sha: newSha }),
    updateBranchRef: async ({ sha, force }: { sha: string; force?: boolean }) => {
      expect(force).not.toBe(true);
      updatedSha = sha;
    },
  };
  const git = {
    getTrackedChanges: () => changes,
    getCurrentBranch: () => branch,
    resolveApiPushSyncTarget: () => ({ remote: 'fake', trackingRef: branch }),
    assertApiPushBaseIsSynced: () => undefined,
    synchronizeApiPushedTaskBranch: () => ({ branch, head: newSha }),
  };
  const mockRequire = (request: string): unknown => {
    switch (request) {
      case './lib/github':
        return github;
      case './lib/git':
        return git;
      case './lib/paths':
        return { resolveGitRoot: () => repoRoot };
      case './lib/task-meta':
        return {
          findTaskMeta: () => taskMeta,
          validateBranchMatch: () => undefined,
          collectTaskMetaFiles: () => [],
          getTaskCurrentMetaPath: () => join(repoRoot, '.task', 'current.json'),
          getTaskWorkpadPath: () => join(repoRoot, '.task', 'workpad.md'),
        };
      case './lib/verification':
        return { getVerifyStampMismatch: () => null };
      case './lib/validation':
        return {
          assertCommitMessageFormat: () => undefined,
          assertTaskBranchName: () => undefined,
          isStreamBranchName: () => false,
        };
      case '../hooks/dispatcher.js':
        return { dispatchHookEvent: () => ({}), renderHookResult: () => '' };
      case './lib/task-workpad':
        return { assertWorkpadReady: () => undefined, syncFilesChanged: () => undefined };
      default:
        return realRequire(request);
    }
  };

  const source = readFileSync(scriptPath, 'utf8');
  const bootstrap = /\nmain\(\)\.catch\(\(error\) => \{[\s\S]*$/;
  expect(source).toMatch(bootstrap);
  const isolatedSource = source
    .replace(/^#![^\n]*\n/, '')
    .replace(bootstrap, '\nmodule.exports = { main };');
  const module = { exports: {} as { main?: () => Promise<void> } };
  const fakeProcess = {
    argv: ['bun', scriptPath, '--message', 'fix(os): binary publication', ...argv, '--json'],
    cwd: () => repoRoot,
    env: {},
    stdout: { write: () => true },
    stderr: { write: () => true },
    exit: (code: number) => { throw new Error(`unexpected process.exit(${code})`); },
  };
  const load = new Function(
    'require', 'module', 'exports', '__dirname', '__filename', 'process', 'Buffer', isolatedSource,
  );
  load(mockRequire, module, module.exports, dirname(scriptPath), scriptPath, fakeProcess, Buffer);
  expect(module.exports.main).toBeTypeOf('function');
  await module.exports.main!();
  return { blobs, tree, updatedSha };
}

function assertExactPublishedBytes(
  result: Awaited<ReturnType<typeof publishInSandbox>>,
  expected: Record<string, Buffer>,
): void {
  const contentTree = result.tree.filter((entry) => entry.sha !== null);
  expect(result.blobs).toHaveLength(Object.keys(expected).length);
  expect(contentTree).toHaveLength(Object.keys(expected).length);
  for (const [path, expectedBytes] of Object.entries(expected)) {
    const expectedSha = gitBlobSha(expectedBytes);
    const treeItem = result.tree.find((entry) => entry.path === path);
    const blob = result.blobs.find((entry) => entry.sha === expectedSha);
    expect(treeItem).toEqual({ path, sha: expectedSha, mode: '100644', type: 'blob' });
    expect(blob).toBeDefined();
    expect(Buffer.from(blob!.content, 'base64')).toEqual(expectedBytes);
  }
  expect(result.updatedSha).toBe('b'.repeat(40));
}

describe.each(publisherScripts)('binary-safe task.push publication: %s', (scriptPath) => {
  it('preserves arbitrary invalid UTF-8, NUL, PNG and WebP alongside text and deletions with --changed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-binary-'));
    try {
      const expected = {
        'bytes/invalid.bin': Buffer.from([0, 0xff, 0xfe, 0x80, 0xc3, 0x28, 0x00, 0x81]),
        'images/pixel.png': Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X3nRGAAAAABJRU5ErkJggg==', 'base64'),
        'images/pixel.webp': Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'),
        'readme.txt': Buffer.from('hello \u{1F30D}\n', 'utf8'),
      };
      for (const [file, bytes] of Object.entries(expected)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), bytes);
      }
      expect(expected['images/pixel.png'].subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(expected['images/pixel.webp'].subarray(0, 4).toString()).toBe('RIFF');

      const changes: Change[] = [
        ...Object.keys(expected).map((path) => ({ path, deleted: false })),
        { path: 'images/deleted.webp', deleted: true },
      ];
      const result = await publishInSandbox(scriptPath, root, ['--changed'], changes);
      assertExactPublishedBytes(result, expected);
      expect(result.tree).toContainEqual({
        path: 'images/deleted.webp',
        sha: null,
        mode: '100644',
        type: 'blob',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves original filesystem bytes with explicit --files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-explicit-'));
    try {
      const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
      writeFileSync(join(root, 'opaque.png'), bytes);
      const result = await publishInSandbox(scriptPath, root, ['--files', 'opaque.png'], []);
      assertExactPublishedBytes(result, { 'opaque.png': bytes });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps explicit JSON text and deletion semantics unchanged', async () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-json-'));
    try {
      const text = 'manual text \u{1F30D}\n';
      const json = JSON.stringify([
        { path: 'manual.txt', content: text },
        { path: 'obsolete.txt', deleted: true },
      ]);
      const result = await publishInSandbox(scriptPath, root, ['--files-json', json], []);
      assertExactPublishedBytes(result, { 'manual.txt': Buffer.from(text, 'utf8') });
      expect(result.tree).toContainEqual({
        path: 'obsolete.txt',
        sha: null,
        mode: '100644',
        type: 'blob',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('round-trips binary Git blobs through a real bare remote and ends with a clean local sync', () => {
    const root = mkdtempSync(join(tmpdir(), 'task-push-remote-binary-'));
    const remote = join(root, 'remote.git');
    const producer = join(root, 'producer');
    const local = join(root, 'local');
    const branch = 'task/os/binary-fixture';
    const bytes = Buffer.from([0, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47, 0x00, 0x81, 0xc3]);
    try {
      mkdirSync(producer);
      git(root, ['init', '--bare', remote]);
      git(producer, ['init']);
      git(producer, ['config', 'user.email', 'test@example.com']);
      git(producer, ['config', 'user.name', 'Test']);
      writeFileSync(join(producer, 'readme.txt'), 'original\n');
      git(producer, ['add', 'readme.txt']);
      git(producer, ['commit', '-m', 'base']);
      git(producer, ['checkout', '-b', branch]);
      git(producer, ['remote', 'add', 'origin', remote]);
      git(producer, ['push', '-u', 'origin', branch]);
      git(root, ['clone', '--branch', branch, remote, local]);
      const previousSha = git(local, ['rev-parse', 'HEAD']);

      writeFileSync(join(producer, 'payload.bin'), bytes);
      writeFileSync(join(local, 'payload.bin'), bytes);
      const lib = createRequire(scriptPath)('./lib/git') as {
        getTrackedChanges: (root: string) => Change[];
        synchronizeApiPushedTaskBranch: (
          root: string,
          branch: string,
          previousSha: string,
          nextSha: string,
        ) => unknown;
      };
      expect(lib.getTrackedChanges(local)).toEqual(
        expect.arrayContaining([{ path: 'payload.bin', deleted: false, status: '??' }]),
      );

      git(producer, ['add', 'payload.bin']);
      git(producer, ['commit', '-m', 'binary API equivalent']);
      const remoteCommit = git(producer, ['rev-parse', 'HEAD']);
      git(producer, ['push', 'origin', branch]);
      const expectedBlob = gitBlobSha(bytes);
      expect(git(root, ['--git-dir', remote, 'rev-parse', `${remoteCommit}:payload.bin`])).toBe(expectedBlob);

      lib.synchronizeApiPushedTaskBranch(local, branch, previousSha, remoteCommit);
      expect(git(local, ['rev-parse', 'HEAD'])).toBe(remoteCommit);
      expect(git(local, ['rev-parse', 'origin/' + branch])).toBe(remoteCommit);
      expect(git(local, ['rev-parse', 'HEAD:payload.bin'])).toBe(expectedBlob);
      expect(readFileSync(join(local, 'payload.bin'))).toEqual(bytes);
      expect(git(local, ['status', '--porcelain'])).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
