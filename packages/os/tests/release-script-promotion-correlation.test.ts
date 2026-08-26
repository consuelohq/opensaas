import { describe, expect, it } from 'vitest';

import { evaluatePromotionCorrelation } from '../scripts/lib/release-promotion-correlation';

const exactRelease = {
  channel: 'canary' as const,
  sourceCommit: '507866b966cb90ecb3d8240c265037d2269864dc',
  version: '0.1.72',
  bundleId: `sha256:${'4'.repeat(64)}`,
};

describe('release promotion correlation', () => {
  it('uses the signed target pointer as authoritative even when the protected workflow keeps its generic display title', () => {
    expect(evaluatePromotionCorrelation({
      baselineRunId: 100,
      runs: [
        {
          databaseId: 101,
          displayTitle: 'Consuelo OS runtime promote',
          status: 'completed',
          conclusion: 'success',
          url: 'https://example.test/run/101',
        },
      ],
      targetRelease: exactRelease,
      expectedBundleId: exactRelease.bundleId,
      expectedSourceCommit: exactRelease.sourceCommit,
    })).toEqual({
      kind: 'success',
      run: {
        runId: 101,
        status: 'completed',
        conclusion: 'success',
        url: 'https://example.test/run/101',
      },
    });
  });

  it('keeps waiting while any post-dispatch promotion run is still active and the exact pointer is not visible yet', () => {
    expect(evaluatePromotionCorrelation({
      baselineRunId: 100,
      runs: [
        { databaseId: 102, status: 'queued', conclusion: '', url: 'https://example.test/run/102' },
        { databaseId: 101, status: 'completed', conclusion: 'success', url: 'https://example.test/run/101' },
      ],
      targetRelease: null,
      expectedBundleId: exactRelease.bundleId,
      expectedSourceCommit: exactRelease.sourceCommit,
    })).toEqual({ kind: 'pending' });
  });

  it('fails closed after all post-dispatch runs are terminal without the exact signed target pointer', () => {
    expect(evaluatePromotionCorrelation({
      baselineRunId: 100,
      runs: [
        { databaseId: 101, status: 'completed', conclusion: 'success', url: 'https://example.test/run/101' },
      ],
      targetRelease: {
        ...exactRelease,
        bundleId: `sha256:${'9'.repeat(64)}`,
      },
      expectedBundleId: exactRelease.bundleId,
      expectedSourceCommit: exactRelease.sourceCommit,
    })).toEqual({
      kind: 'failure',
      reason: 'promotion runs completed without publishing the exact requested target bundle',
    });
  });

  it('ignores runs that existed before dispatch', () => {
    expect(evaluatePromotionCorrelation({
      baselineRunId: 100,
      runs: [
        { databaseId: 100, status: 'completed', conclusion: 'failure', url: 'https://example.test/run/100' },
      ],
      targetRelease: null,
      expectedBundleId: exactRelease.bundleId,
      expectedSourceCommit: exactRelease.sourceCommit,
    })).toEqual({ kind: 'pending' });
  });
});
