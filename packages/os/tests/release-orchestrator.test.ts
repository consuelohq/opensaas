import { describe, expect, it } from 'vitest';

import {
  orchestrateRelease,
  selectRuntimePublishCandidate,
  type ReleaseAdapter,
  type ReleasePr,
} from '../scripts/lib/release-orchestrator';

const readyPr = (overrides: Partial<ReleasePr> = {}): ReleasePr => ({
  number: 2185,
  state: 'OPEN',
  baseRefName: 'main',
  isDraft: false,
  mergeStateStatus: 'CLEAN',
  reviewDecision: '',
  checks: [
    { name: 'changed-files', bucket: 'pass' },
    { name: 'CodeRabbit', bucket: 'pass' },
  ],
  ...overrides,
});

const fakeAdapter = (events: string[], overrides: Partial<ReleaseAdapter> = {}): ReleaseAdapter => {
  const promoted = new Set<string>();
  const releaseSetBundleId = `sha256:${'a'.repeat(64)}`;
  const platformBundleId = `sha256:${'b'.repeat(64)}`;
  return {
  inspectPr: async () => {
    events.push('inspect-pr');
    return readyPr();
  },
  waitForPrChecks: async () => {
    events.push('wait-pr-checks');
    return readyPr();
  },
  mergePr: async () => {
    events.push('merge-pr');
    return { mergeSha: 'sha_main' };
  },
  findRuntimePublish: async () => {
    events.push('find-runtime-publish');
    return { runId: 100, status: 'in_progress', conclusion: '', url: 'https://example.test/run/100' };
  },
  waitForRun: async (runId) => {
    events.push(`wait-run:${runId}`);
    return { runId, status: 'completed', conclusion: 'success', url: `https://example.test/run/${runId}` };
  },
  resolveDevRelease: async () => {
    events.push('resolve-dev-release');
    return {
      channel: 'dev',
      sourceCommit: 'sha_main',
      version: '1.2.3',
      releaseSetBundleId,
      platformBundleId,
    };
  },
  channelRelease: async (channel) => {
    events.push(`channel-release:${channel}`);
    return promoted.has(channel)
      ? { channel, sourceCommit: 'sha_main', version: '1.2.3', releaseSetBundleId, platformBundleId }
      : null;
  },
  promote: async ({ from, to }) => {
    events.push(`promote:${from}->${to}`);
    promoted.add(to);
    return { runId: to === 'canary' ? 201 : to === 'beta' ? 202 : 203, status: 'queued', conclusion: '', url: `https://example.test/${to}` };
  },
  updateLocal: async ({ channel, version }) => {
    events.push(`update-local:${channel}@${version}`);
    return { accepted: true };
  },
  localStatus: async () => {
    events.push('local-status');
    return { version: '1.2.3', platformBundleId };
  },
  ...overrides,
  };
};

describe('release orchestrator', () => {
  it('prefers a viable exact-SHA publication over a stale cancelled run', () => {
    const selected = selectRuntimePublishCandidate([
      {
        databaseId: 102,
        headSha: 'sha_main',
        status: 'in_progress',
        conclusion: '',
        url: 'https://example.test/run/102',
      },
      {
        databaseId: 101,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'cancelled',
        url: 'https://example.test/run/101',
      },
      {
        databaseId: 103,
        headSha: 'different_sha',
        status: 'completed',
        conclusion: 'success',
        url: 'https://example.test/run/103',
      },
    ], 'sha_main');

    expect(selected).toMatchObject({
      runId: 102,
      status: 'in_progress',
      conclusion: '',
    });
  });

  it('waits instead of treating an exact-SHA cancelled publication as authoritative', () => {
    expect(selectRuntimePublishCandidate([
      {
        databaseId: 101,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'cancelled',
        url: 'https://example.test/run/101',
      },
    ], 'sha_main')).toBeNull();
  });

  it('excludes an already observed cancelled run even when GitHub still reports its stale row as active', () => {
    expect(selectRuntimePublishCandidate([
      {
        databaseId: 100,
        headSha: 'sha_main',
        status: 'in_progress',
        conclusion: '',
        url: 'https://example.test/run/100',
      },
      {
        databaseId: 101,
        headSha: 'sha_main',
        status: 'queued',
        conclusion: '',
        url: 'https://example.test/run/101',
      },
    ], 'sha_main', [100])).toMatchObject({
      runId: 101,
      status: 'queued',
    });
  });

  it('ignores an older exact-SHA failure after a newer cancelled attempt starts replacement recovery', () => {
    expect(selectRuntimePublishCandidate([
      {
        databaseId: 102,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'cancelled',
        url: 'https://example.test/run/102',
      },
      {
        databaseId: 101,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'failure',
        url: 'https://example.test/run/101',
      },
    ], 'sha_main', [102])).toBeNull();
  });

  it('returns a newer replacement failure after a cancelled exact-SHA attempt', () => {
    expect(selectRuntimePublishCandidate([
      {
        databaseId: 103,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'failure',
        url: 'https://example.test/run/103',
      },
      {
        databaseId: 102,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'cancelled',
        url: 'https://example.test/run/102',
      },
      {
        databaseId: 101,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'failure',
        url: 'https://example.test/run/101',
      },
    ], 'sha_main', [102])).toMatchObject({
      runId: 103,
      status: 'completed',
      conclusion: 'failure',
    });
  });

  it('still returns a genuine exact-SHA publication failure when no retry is active', () => {
    expect(selectRuntimePublishCandidate([
      {
        databaseId: 101,
        headSha: 'sha_main',
        status: 'completed',
        conclusion: 'failure',
        url: 'https://example.test/run/101',
      },
    ], 'sha_main')).toMatchObject({
      runId: 101,
      status: 'completed',
      conclusion: 'failure',
    });
  });

  it('re-resolves the exact-SHA publication when an active run is cancelled while waiting', async () => {
    const events: string[] = [];
    let publicationLookup = 0;
    const adapter = fakeAdapter(events, {
      findRuntimePublish: async (_mergeSha, excludedRunIds = []) => {
        publicationLookup += 1;
        events.push(`find-runtime-publish:${publicationLookup}:exclude=${excludedRunIds.join(',')}`);
        return excludedRunIds.includes(100)
          ? { runId: 101, status: 'in_progress', conclusion: '', url: 'https://example.test/run/101' }
          : { runId: 100, status: 'in_progress', conclusion: '', url: 'https://example.test/run/100' };
      },
      waitForRun: async (runId) => {
        events.push(`wait-run:${runId}`);
        return runId === 100
          ? { runId, status: 'completed', conclusion: 'cancelled', url: `https://example.test/run/${runId}` }
          : { runId, status: 'completed', conclusion: 'success', url: `https://example.test/run/${runId}` };
      },
    });

    const result = await orchestrateRelease({ pr: 2185, channel: 'dev', releaseOnly: true }, adapter);

    expect(result.runtimeRunUrl).toBe('https://example.test/run/101');
    expect(events).toEqual([
      'inspect-pr',
      'merge-pr',
      'find-runtime-publish:1:exclude=',
      'wait-run:100',
      'find-runtime-publish:2:exclude=100',
      'wait-run:101',
      'resolve-dev-release',
    ]);
  });

  it('merges, publishes, promotes the exact bundle to canary, then updates and verifies the local node', async () => {
    const events: string[] = [];
    const result = await orchestrateRelease(
      { pr: 2185, channel: 'canary' },
      fakeAdapter(events),
    );

    expect(result).toMatchObject({
      pr: 2185,
      mergeSha: 'sha_main',
      channel: 'canary',
      version: '1.2.3',
      releaseSetBundleId: `sha256:${'a'.repeat(64)}`,
      platformBundleId: `sha256:${'b'.repeat(64)}`,
      localUpdated: true,
    });
    expect(events).toEqual([
      'inspect-pr',
      'merge-pr',
      'find-runtime-publish',
      'wait-run:100',
      'resolve-dev-release',
      'channel-release:canary',
      'promote:dev->canary',
      'wait-run:201',
      'channel-release:canary',
      'update-local:canary@1.2.3',
      'local-status',
    ]);
  });

  it('chains legal promotion hops for stable instead of skipping release gates', async () => {
    const events: string[] = [];
    const promoted = new Set<string>();
    const releaseSetBundleId = `sha256:${'a'.repeat(64)}`;
    const platformBundleId = `sha256:${'b'.repeat(64)}`;
    const adapter = fakeAdapter(events, {
      channelRelease: async (channel) => {
        events.push(`channel-release:${channel}`);
        return promoted.has(channel)
          ? { channel, sourceCommit: 'sha_main', version: '1.2.3', releaseSetBundleId, platformBundleId }
          : null;
      },
      promote: async ({ from, to }) => {
        events.push(`promote:${from}->${to}`);
        promoted.add(to);
        return { runId: to === 'canary' ? 201 : to === 'beta' ? 202 : 203, status: 'queued', conclusion: '', url: `https://example.test/${to}` };
      },
    });

    await orchestrateRelease({ pr: 2185, channel: 'stable', releaseOnly: true }, adapter);

    expect(events).toContain('promote:dev->canary');
    expect(events).toContain('promote:canary->beta');
    expect(events).toContain('promote:beta->stable');
    expect(events.some((event) => event.startsWith('update-local:'))).toBe(false);
  });

  it('fails closed on a failed PR check before any merge or release mutation', async () => {
    const events: string[] = [];
    const adapter = fakeAdapter(events, {
      inspectPr: async () => {
        events.push('inspect-pr');
        return readyPr({ checks: [{ name: 'tests', bucket: 'fail' }] });
      },
    });

    await expect(orchestrateRelease({ pr: 2185, channel: 'canary' }, adapter))
      .rejects.toThrow(/failed check/i);
    expect(events).toEqual(['inspect-pr']);
  });

  it('keeps task PRs fail-closed and tells callers to use the main-targeting stream review PR', async () => {
    const events: string[] = [];
    const adapter = fakeAdapter(events, {
      inspectPr: async () => {
        events.push('inspect-pr');
        return readyPr({
          state: 'MERGED',
          baseRefName: 'stream/workspace-agents',
          mergeSha: 'sha_task',
        });
      },
    });

    await expect(orchestrateRelease({ pr: 2185, channel: 'canary' }, adapter))
      .rejects.toThrow(/main-targeting stream review PR/i);
    expect(events).toEqual(['inspect-pr']);
  });

  it('fails closed when the exact version is active through a different platform bundle', async () => {
    const events: string[] = [];
    const adapter = fakeAdapter(events, {
      localStatus: async () => {
        events.push('local-status');
        return {
          version: '1.2.3',
          platformBundleId: `sha256:${'c'.repeat(64)}`,
        };
      },
    });

    await expect(
      orchestrateRelease({ pr: 2185, channel: 'canary' }, adapter),
    ).rejects.toThrow(/platform bundle/i);
  });

  it('dry-run plans the release without merging, promoting, or updating', async () => {
    const events: string[] = [];
    const result = await orchestrateRelease(
      { pr: 2185, channel: 'canary', dryRun: true },
      fakeAdapter(events),
    );

    expect(result.dryRun).toBe(true);
    expect(result.plan).toEqual([
      'verify PR #2185 for main',
      'merge PR #2185 to main',
      'wait for exact main SHA runtime publication',
      'promote exact immutable bundle dev -> canary',
      'update this node to the exact canary version',
      'verify local lifecycle version and bundle',
    ]);
    expect(events).toEqual(['inspect-pr']);
  });
});
