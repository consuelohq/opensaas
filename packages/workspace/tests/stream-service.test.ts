import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_STREAM_INSTRUCTIONS,
  createStreamEffect,
  discoverStreamAreas,
  readStreamInstructionsEffect,
  seedStreamInstructionsEffect,
  type StreamCreationContext,
} from '../scripts/lib/streams/service';
import {
  filterRecentWorkpads as filterOsRecentWorkpads,
} from '../../os/scripts/lib/streams/workpads';
import {
  filterRecentWorkpads as filterWorkspaceRecentWorkpads,
} from '../scripts/lib/streams/workpads';

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
      createBranch: ({ branch, sha }) => Effect.sync(() => {
        calls.push({ operation: 'createBranch', input: { branch, sha } });
        refs.set(branch, { sha, treeSha: 'created-tree' });
        return { sha, treeSha: 'created-tree' };
      }),
      commitFiles: ({ parentSha, files, message }) => Effect.sync(() => {
        calls.push({ operation: 'commitFiles', input: { parentSha, files, message } });
        const state = { sha: 'instruction-commit', treeSha: 'instruction-tree' };
        return state;
      }),
    },
    local: {
      fetchOrigin: () => Effect.sync(() => calls.push({ operation: 'fetchOrigin' })),
      branchExists: () => Effect.succeed(false),
      createTrackingBranch: ({ branch, upstream }) => Effect.sync(() => {
        calls.push({ operation: 'createTrackingBranch', input: { branch, upstream } });
      }),
    },
  };

  return { calls, context, refs };
}

describe('Effect stream service', () => {
  it('returns missing optional instructions without failure or fallback', async () => {
    const root = tempRoot('stream-instructions-missing-');
    const areasRoot = join(root, 'areas');
    const streamsRoot = join(root, 'streams');
    writeFileSync(join(root, 'placeholder'), 'x');

    const result = await Effect.runPromise(readStreamInstructionsEffect({
      area: 'security',
      streamsRoot,
    }));

    expect(result).toEqual({
      exists: false,
      path: join(streamsRoot, 'security', 'AGENTS.md'),
      content: '',
    });
    expect(existsSync(join(areasRoot, 'security', 'AGENTS.md'))).toBe(false);
  });

  it('returns every instruction byte without truncation and only for the selected stream', async () => {
    const root = tempRoot('stream-instructions-exact-');
    const streamsRoot = join(root, 'streams');
    const selected = join(streamsRoot, 'tools');
    const other = join(streamsRoot, 'media');
    const content = `# Tools\n\n${'exact instruction line\n'.repeat(20_000)}`;

    await Effect.runPromise(seedStreamInstructionsEffect({
      area: 'tools',
      streamsRoot,
      content,
    }));
    await Effect.runPromise(seedStreamInstructionsEffect({
      area: 'media',
      streamsRoot,
      content: '# Media only\n',
    }));

    const result = await Effect.runPromise(readStreamInstructionsEffect({
      area: 'tools',
      streamsRoot,
    }));

    expect(result.exists).toBe(true);
    expect(result.path).toBe(join(selected, 'AGENTS.md'));
    expect(result.content).toBe(content);
    expect(result.content).not.toContain('# Media only');
    expect(readFileSync(join(other, 'AGENTS.md'), 'utf8')).toBe('# Media only\n');
  });

  it('preserves existing instructions when a seed is requested again', async () => {
    const root = tempRoot('stream-instructions-preserve-');
    const streamsRoot = join(root, 'streams');
    const filePath = join(streamsRoot, 'tools', 'AGENTS.md');

    const first = await Effect.runPromise(seedStreamInstructionsEffect({
      area: 'tools',
      streamsRoot,
      content: '# User tools guidance\n',
    }));
    const second = await Effect.runPromise(seedStreamInstructionsEffect({
      area: 'tools',
      streamsRoot,
      content: DEFAULT_STREAM_INSTRUCTIONS,
    }));

    expect(first.status).toBe('created');
    expect(second.status).toBe('preserved');
    expect(readFileSync(filePath, 'utf8')).toBe('# User tools guidance\n');
  });

  it('discovers streams from branch refs and ignores arbitrary area directories', () => {
    expect(discoverStreamAreas({
      localBranches: ['stream/security'],
      remoteBranches: ['stream/media', 'stream/tools'],
      directoryNames: ['trash', 'docs', 'tools'],
    })).toEqual(['media', 'security', 'tools']);
  });

  it('creates a stream atomically with both instruction files and a local tracking ref', async () => {
    const fixture = creationContext();

    const result = await Effect.runPromise(createStreamEffect({
      area: 'research',
      sourceBranch: 'main',
    }, fixture.context));

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
            { path: 'packages/os/streams/research/AGENTS.md', content: DEFAULT_STREAM_INSTRUCTIONS },
            { path: 'packages/workspace/streams/research/AGENTS.md', content: DEFAULT_STREAM_INSTRUCTIONS },
          ],
          message: 'chore(stream): initialize research instructions',
        },
      },
      { operation: 'createBranch', input: { branch: 'stream/research', sha: 'instruction-commit' } },
      { operation: 'fetchOrigin' },
      {
        operation: 'createTrackingBranch',
        input: { branch: 'stream/research', upstream: 'origin/stream/research' },
      },
    ]);
  });

  it('refuses to recreate an existing stream', async () => {
    const fixture = creationContext();
    fixture.refs.set('stream/tools', { sha: 'existing', treeSha: 'existing-tree' });

    const failure = await Effect.runPromise(Effect.flip(createStreamEffect({
      area: 'tools',
      sourceBranch: 'main',
    }, fixture.context)));

    expect(failure.message).toContain('stream/tools already exists');
    expect(fixture.calls).toEqual([]);
  });

  it('keeps OS and Workspace workpad scoping exact and equivalent', () => {
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

    expect(filterOsRecentWorkpads(rows, 'os', 'stream/os', 3)).toEqual(
      filterWorkspaceRecentWorkpads(rows, 'os', 'stream/os', 3),
    );
    expect(filterOsRecentWorkpads(rows, 'os', 'stream/os', 3).map((row) => row.title)).toEqual([
      'workpad: task/os/sync-os-dev-tooling-substrate',
    ]);
  });
});

describe('stream public surface', () => {
  it('exposes stream.create and removes stream.cleanup from source manifests', () => {
    for (const manifestPath of [
      resolve(import.meta.dirname, '../tooling/tool-manifest.json'),
      resolve(import.meta.dirname, '../../os/tooling/dev-tool-manifest.json'),
    ]) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Array<{
        name: string;
        inputSchema?: string;
      }>;
      expect(manifest.some((tool) => tool.name === 'stream.cleanup')).toBe(false);
      expect(manifest.find((tool) => tool.name === 'stream.create')?.inputSchema).toBe('StreamCreateInput');
    }
  });

  it('removes cleanup scripts and routes missing streams through stream.create', () => {
    for (const packageRoot of [
      resolve(import.meta.dirname, '..'),
      resolve(import.meta.dirname, '../../os'),
    ]) {
      expect(existsSync(join(packageRoot, 'scripts', 'stream-cleanup.js'))).toBe(false);
      expect(existsSync(join(packageRoot, 'scripts', 'stream-create.js'))).toBe(true);

      const taskStart = spawnSync('bun', [join(packageRoot, 'scripts', 'task-start.js'), '--help'], {
        encoding: 'utf8',
      });
      const stdout = taskStart.stdout;
      expect(taskStart.status).toBe(0);
      expect(stdout).not.toContain('--create-stream');
      expect(stdout).toContain('stream.create');
    }
  });
});
