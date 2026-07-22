import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_STREAM_INSTRUCTIONS,
  fetchOriginWithFallback,
  createStreamEffect,
  discoverStreamAreas,
  filterRecentWorkpads,
  readStreamInstructionsEffect,
  seedStreamInstructionsEffect,
  type StreamCreationContext,
} from '../scripts/lib/streams/service';

const tempRoots: string[] = [];

function tempRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function creationContext() {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const refs = new Map<string, { sha: string; treeSha: string }>([
    ['main', { sha: 'main-sha', treeSha: 'main-tree' }],
  ]);

  const context: StreamCreationContext = {
    remote: {
      getBranch: (branch) => Effect.sync(() => refs.get(branch) ?? null),
      createBranch: ({ branch, sha }) =>
        Effect.sync(() => {
          calls.push({ operation: 'createBranch', input: { branch, sha } });
          refs.set(branch, { sha, treeSha: 'created-tree' });
          return { sha, treeSha: 'created-tree' };
        }),
      commitFiles: ({ parentSha, files, message }) =>
        Effect.sync(() => {
          calls.push({
            operation: 'commitFiles',
            input: { parentSha, files, message },
          });
          return { sha: 'instruction-commit', treeSha: 'instruction-tree' };
        }),
    },
    local: {
      fetchOrigin: () =>
        Effect.sync(() => calls.push({ operation: 'fetchOrigin' })),
      branchExists: () => Effect.succeed(false),
      createTrackingBranch: ({ branch, upstream }) =>
        Effect.sync(() => {
          calls.push({
            operation: 'createTrackingBranch',
            input: { branch, upstream },
          });
        }),
    },
  };

  return { calls, context, refs };
}

describe('Effect stream service', () => {
  it('continues with cached refs when origin fetch fails', () => {
    const result = fetchOriginWithFallback(() => {
      throw new Error('offline');
    });

    expect(result).toEqual({ skipped: false, success: false, reason: 'offline' });
  });

  it('returns missing optional instructions without failure or fallback', async () => {
    const streamsRoot = join(tempRoot('stream-instructions-missing-'), 'streams');
    const result = await Effect.runPromise(
      readStreamInstructionsEffect({ area: 'security', streamsRoot }),
    );

    expect(result).toEqual({
      exists: false,
      path: join(streamsRoot, 'security', 'AGENTS.md'),
      content: '',
    });
  });

  it('returns every instruction byte without truncation', async () => {
    const streamsRoot = join(tempRoot('stream-instructions-exact-'), 'streams');
    const content = `# Tools\n\n${'exact instruction line\n'.repeat(20_000)}`;

    await Effect.runPromise(
      seedStreamInstructionsEffect({ area: 'tools', streamsRoot, content }),
    );
    const result = await Effect.runPromise(
      readStreamInstructionsEffect({ area: 'tools', streamsRoot }),
    );

    expect(result.exists).toBe(true);
    expect(result.content).toBe(content);
  });

  it('discovers streams from branch refs and ignores arbitrary directories', () => {
    expect(
      discoverStreamAreas({
        localBranches: ['stream/security'],
        remoteBranches: ['stream/media', 'stream/tools'],
        directoryNames: ['trash', 'docs', 'tools'],
      }),
    ).toEqual(['media', 'security', 'tools']);
  });

  it('creates a stream atomically with instructions and a tracking ref', async () => {
    const fixture = creationContext();
    const result = await Effect.runPromise(
      createStreamEffect(
        { area: 'research', sourceBranch: 'main' },
        fixture.context,
      ),
    );

    expect(result).toMatchObject({
      stream: 'stream/research',
      sourceBranch: 'main',
      commitSha: 'instruction-commit',
      localTrackingCreated: true,
    });
    expect(fixture.calls).toEqual([
      {
        operation: 'commitFiles',
        input: {
          parentSha: 'main-sha',
          files: [
            {
              path: 'packages/os/streams/research/AGENTS.md',
              content: DEFAULT_STREAM_INSTRUCTIONS,
            },
            {
              path: 'packages/workspace/streams/research/AGENTS.md',
              content: DEFAULT_STREAM_INSTRUCTIONS,
            },
          ],
          message: 'chore(stream): initialize research instructions',
        },
      },
      {
        operation: 'createBranch',
        input: { branch: 'stream/research', sha: 'instruction-commit' },
      },
      { operation: 'fetchOrigin' },
      {
        operation: 'createTrackingBranch',
        input: {
          branch: 'stream/research',
          upstream: 'origin/stream/research',
        },
      },
    ]);
  });

  it('refuses to recreate an existing stream', async () => {
    const fixture = creationContext();
    fixture.refs.set('stream/tools', {
      sha: 'existing',
      treeSha: 'existing-tree',
    });

    const failure = await Effect.runPromise(
      Effect.flip(
        createStreamEffect(
          { area: 'tools', sourceBranch: 'main' },
          fixture.context,
        ),
      ),
    );

    expect(failure.message).toContain('stream/tools already exists');
    expect(fixture.calls).toEqual([]);
  });

  it('scopes workpad evidence to the selected stream', () => {
    const rows = [
      {
        title: 'workpad: task/design/update-consuelo-os-positioning',
        category: 'workpad',
        created_at: '2026-06-01T15:36:00.000Z',
        content: 'stream: `stream/design`',
      },
      {
        title: 'workpad: task/os/sync-os-dev-tooling-substrate',
        category: 'workpad',
        created_at: '2026-05-31T11:37:00.000Z',
        content: 'stream: `stream/os`',
      },
    ];

    expect(
      filterRecentWorkpads(rows, 'os', 'stream/os', 3).map(
        (row) => row.title,
      ),
    ).toEqual(['workpad: task/os/sync-os-dev-tooling-substrate']);
  });
});

describe('stream public surface', () => {
  it('exposes stream.create and removes stream.cleanup', () => {
    const manifestPath = resolve(
      import.meta.dirname,
      '../tooling/dev-tool-manifest.json',
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Array<{
      name: string;
      inputSchema?: string;
    }>;

    expect(manifest.some((tool) => tool.name === 'stream.cleanup')).toBe(false);
    expect(manifest.find((tool) => tool.name === 'stream.create')?.inputSchema).toBe(
      'StreamCreateInput',
    );
    expect(existsSync(resolve(import.meta.dirname, '../scripts/stream-cleanup.js'))).toBe(
      false,
    );
    expect(existsSync(resolve(import.meta.dirname, '../scripts/stream-create.js'))).toBe(
      true,
    );

    const taskStart = spawnSync(
      'bun',
      [resolve(import.meta.dirname, '../scripts/task-start.js'), '--help'],
      { encoding: 'utf8' },
    );
    expect(taskStart.status).toBe(0);
    expect(taskStart.stdout).not.toContain('--create-stream');
    expect(taskStart.stdout).toContain('stream.create');

    const streamCreate = spawnSync(
      'bun',
      [resolve(import.meta.dirname, '../scripts/stream-create.js'), '--help'],
      { encoding: 'utf8' },
    );
    expect(streamCreate.status).toBe(0);
    expect(streamCreate.stdout).toContain('--source-branch <branch>');
  });
});
