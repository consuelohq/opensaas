import { describe, expect, it } from 'vitest';

import {
  orchestrateRelease,
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
