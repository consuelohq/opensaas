export type ReleaseChannel = 'dev' | 'canary' | 'beta' | 'stable';

export type ReleaseCheck = {
  name: string;
  bucket: 'pass' | 'fail' | 'pending' | 'skipping' | 'cancel';
};

export type ReleasePr = {
  number: number;
  state: 'OPEN' | 'MERGED' | 'CLOSED';
  baseRefName: string;
  isDraft: boolean;
  mergeStateStatus: string;
  reviewDecision: string;
  checks: ReleaseCheck[];
  mergeSha?: string;
};

export type ReleaseRun = {
  runId: number;
  status: string;
  conclusion: string;
  url: string;
};

export type ReleaseIdentity = {
  channel: ReleaseChannel;
  sourceCommit: string;
  version: string;
  releaseSetBundleId: string;
  platformBundleId: string;
};

export type ReleaseAdapter = {
  inspectPr(pr: number): Promise<ReleasePr>;
  waitForPrChecks(pr: number): Promise<ReleasePr>;
  mergePr(input: { pr: number; mergeMethod: 'merge' | 'squash' | 'rebase' }): Promise<{ mergeSha: string }>;
  findRuntimePublish(mergeSha: string): Promise<ReleaseRun>;
  waitForRun(runId: number): Promise<ReleaseRun>;
  resolveDevRelease(mergeSha: string): Promise<ReleaseIdentity | null>;
  channelRelease(channel: ReleaseChannel): Promise<ReleaseIdentity | null>;
  promote(input: {
    from: ReleaseChannel;
    to: ReleaseChannel;
    releaseSetBundleId: string;
    sourceCommit: string;
  }): Promise<ReleaseRun>;
  updateLocal(input: { channel: ReleaseChannel; version: string }): Promise<{ accepted: boolean }>;
  localStatus(): Promise<{ version?: string; platformBundleId?: string }>;
};

export type ReleaseRequest = {
  pr: number;
  channel?: ReleaseChannel;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  releaseOnly?: boolean;
  dryRun?: boolean;
};

export type ReleaseResult = {
  pr: number;
  channel: ReleaseChannel;
  mergeSha?: string;
  version?: string;
  releaseSetBundleId?: string;
  platformBundleId?: string;
  runtimeRunUrl?: string;
  noRuntimeChange?: boolean;
  localUpdated: boolean;
  dryRun: boolean;
  plan?: string[];
};

const CHANNEL_ORDER: ReleaseChannel[] = ['dev', 'canary', 'beta', 'stable'];

function releasePlan(pr: number, channel: ReleaseChannel, releaseOnly: boolean): string[] {
  const steps = [
    `verify PR #${pr} for main`,
    `merge PR #${pr} to main`,
    'wait for exact main SHA runtime publication',
  ];
  if (channel !== 'dev') {
    const targetIndex = CHANNEL_ORDER.indexOf(channel);
    for (let index = 1; index <= targetIndex; index += 1) {
      steps.push(`promote exact immutable bundle ${CHANNEL_ORDER[index - 1]} -> ${CHANNEL_ORDER[index]}`);
    }
  }
  if (!releaseOnly) {
    steps.push(`update this node to the exact ${channel} version`);
    steps.push('verify local lifecycle version and bundle');
  }
  return steps;
}

function mainTargetingReviewPrError(pr: ReleasePr): Error {
  return new Error(
    `release requires PR #${pr.number} to be the main-targeting stream review PR (found base ${pr.baseRefName}); ` +
      'promote the task PR into its stream first, then pass the stream review PR that targets main',
  );
}

function ensurePrReady(pr: ReleasePr): void {
  if (pr.baseRefName !== 'main') {
    throw mainTargetingReviewPrError(pr);
  }
  if (pr.isDraft) throw new Error(`release refuses draft PR #${pr.number}`);
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    throw new Error(`release refuses PR #${pr.number} with requested changes`);
  }
  const failed = pr.checks.find((check) => check.bucket === 'fail');
  if (failed) throw new Error(`release refuses failed check ${failed.name}`);
  if (pr.mergeStateStatus && pr.mergeStateStatus !== 'CLEAN') {
    throw new Error(`release requires a clean merge state (found ${pr.mergeStateStatus})`);
  }
}

function hasPendingChecks(pr: ReleasePr): boolean {
  return pr.checks.some((check) => check.bucket === 'pending');
}

function sameRelease(
  candidate: ReleaseIdentity | null,
  release: ReleaseIdentity,
  channel: ReleaseChannel,
): boolean {
  return Boolean(
    candidate &&
      candidate.channel === channel &&
      candidate.sourceCommit === release.sourceCommit &&
      candidate.version === release.version &&
      candidate.releaseSetBundleId === release.releaseSetBundleId &&
      candidate.platformBundleId === release.platformBundleId,
  );
}

export async function orchestrateRelease(
  request: ReleaseRequest,
  adapter: ReleaseAdapter,
): Promise<ReleaseResult> {
  try {
    const channel = request.channel ?? 'canary';
    const releaseOnly = request.releaseOnly ?? false;
    const mergeMethod = request.mergeMethod ?? 'merge';
    if (!Number.isInteger(request.pr) || request.pr <= 0) {
      throw new Error('release requires a positive PR number');
    }

    let pr = await adapter.inspectPr(request.pr);
    if (pr.state === 'CLOSED') throw new Error(`PR #${request.pr} is closed without a merge`);
    if (pr.state === 'OPEN') {
      if (pr.baseRefName !== 'main') throw mainTargetingReviewPrError(pr);
      if (hasPendingChecks(pr)) pr = await adapter.waitForPrChecks(request.pr);
      ensurePrReady(pr);
    } else if (pr.baseRefName !== 'main') {
      throw mainTargetingReviewPrError(pr);
    }

    if (request.dryRun) {
      return {
        pr: request.pr,
        channel,
        localUpdated: false,
        dryRun: true,
        plan: releasePlan(request.pr, channel, releaseOnly),
      };
    }

    let mergeSha = pr.mergeSha;
    if (pr.state === 'OPEN') {
      mergeSha = (await adapter.mergePr({ pr: request.pr, mergeMethod })).mergeSha;
    }
    if (!mergeSha) throw new Error(`release could not resolve the main merge SHA for PR #${request.pr}`);

    const runtimeRun = await adapter.findRuntimePublish(mergeSha);
    const completedRuntimeRun = runtimeRun.status === 'completed'
      ? runtimeRun
      : await adapter.waitForRun(runtimeRun.runId);
    if (completedRuntimeRun.conclusion !== 'success') {
      throw new Error(`runtime publication failed for ${mergeSha}: ${completedRuntimeRun.conclusion || completedRuntimeRun.status}`);
    }

    const devRelease = await adapter.resolveDevRelease(mergeSha);
    if (!devRelease) {
      return {
        pr: request.pr,
        channel,
        mergeSha,
        runtimeRunUrl: completedRuntimeRun.url,
        noRuntimeChange: true,
        localUpdated: false,
        dryRun: false,
      };
    }
    if (devRelease.channel !== 'dev' || devRelease.sourceCommit !== mergeSha) {
      throw new Error('resolved dev release does not match the exact merged main SHA');
    }

    const targetIndex = CHANNEL_ORDER.indexOf(channel);
    for (let index = 1; index <= targetIndex; index += 1) {
      const from = CHANNEL_ORDER[index - 1];
      const to = CHANNEL_ORDER[index];
      const existing = await adapter.channelRelease(to);
      if (sameRelease(existing, devRelease, to)) continue;
      const promotion = await adapter.promote({
        from,
        to,
        releaseSetBundleId: devRelease.releaseSetBundleId,
        sourceCommit: mergeSha,
      });
      const completedPromotion = promotion.status === 'completed'
        ? promotion
        : await adapter.waitForRun(promotion.runId);
      if (completedPromotion.conclusion !== 'success') {
        throw new Error(`release promotion ${from} -> ${to} failed: ${completedPromotion.conclusion || completedPromotion.status}`);
      }
      const promoted = await adapter.channelRelease(to);
      if (!sameRelease(promoted, devRelease, to)) {
        throw new Error(`release promotion ${from} -> ${to} completed but the channel does not reference the exact bundle`);
      }
    }

    if (!releaseOnly) {
      await adapter.updateLocal({ channel, version: devRelease.version });
      const status = await adapter.localStatus();
      if (
        status.version !== devRelease.version ||
        status.platformBundleId !== devRelease.platformBundleId
      ) {
        throw new Error(
          `local lifecycle verification failed: expected version ${devRelease.version} with platform bundle ${devRelease.platformBundleId}`,
        );
      }
    }

    return {
      pr: request.pr,
      channel,
      mergeSha,
      version: devRelease.version,
      releaseSetBundleId: devRelease.releaseSetBundleId,
      platformBundleId: devRelease.platformBundleId,
      runtimeRunUrl: completedRuntimeRun.url,
      localUpdated: !releaseOnly,
      dryRun: false,
    };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error(`release orchestration failed: ${String(error)}`);
  }
}
