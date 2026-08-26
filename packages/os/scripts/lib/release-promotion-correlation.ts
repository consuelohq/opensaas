import type { ReleaseIdentity, ReleaseRun } from './release-orchestrator';

export type PromotionRunRow = {
  databaseId: number;
  displayTitle?: string;
  status?: string;
  conclusion?: string;
  url?: string;
};

export type PromotionCorrelation =
  | { kind: 'pending' }
  | { kind: 'failure'; reason: string }
  | { kind: 'success'; run: ReleaseRun };

const clean = (value: unknown): string => String(value ?? '').trim();

function isExactRelease(
  release: ReleaseIdentity | null,
  bundleId: string,
  sourceCommit: string,
): boolean {
  return Boolean(
    release &&
      release.releaseSetBundleId === bundleId &&
      release.sourceCommit === sourceCommit,
  );
}

export function evaluatePromotionCorrelation(input: {
  baselineRunId: number;
  runs: PromotionRunRow[];
  targetRelease: ReleaseIdentity | null;
  expectedBundleId: string;
  expectedSourceCommit: string;
}): PromotionCorrelation {
  const postDispatchRuns = input.runs
    .filter((run) => Number(run.databaseId) > input.baselineRunId)
    .sort((left, right) => Number(right.databaseId) - Number(left.databaseId));

  if (
    isExactRelease(
      input.targetRelease,
      input.expectedBundleId,
      input.expectedSourceCommit,
    )
  ) {
    const completedSuccess = postDispatchRuns.find(
      (run) => clean(run.status) === 'completed' && clean(run.conclusion) === 'success',
    );
    const evidence = completedSuccess ?? postDispatchRuns[0];
    return {
      kind: 'success',
      run: {
        runId: Number(evidence?.databaseId) || 0,
        status: 'completed',
        conclusion: 'success',
        url: clean(evidence?.url),
      },
    };
  }

  if (postDispatchRuns.length === 0) return { kind: 'pending' };
  if (postDispatchRuns.some((run) => clean(run.status) !== 'completed')) {
    return { kind: 'pending' };
  }

  return {
    kind: 'failure',
    reason: 'promotion runs completed without publishing the exact requested target bundle',
  };
}
