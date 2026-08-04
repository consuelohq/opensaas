import type {
  ParallelCleanupAction,
  ParallelCleanupFailure,
  ParallelDialOptions,
  ParallelGroup,
} from '../types.js';
import { isTerminalCallStatus } from './parallel-call.js';

export const createParallelGroup = (
  groupId: string,
  options: ParallelDialOptions,
  createdAt: string,
): ParallelGroup => ({
  groupId,
  dialerSessionId: options.dialerSessionId,
  providerMode: options.providerMode,
  conferenceName: `${groupId}_${options.queueId}`,
  status: 'dialing',
  winnerSid: null,
  calls: [],
  workspaceId: options.workspaceId,
  queueId: options.queueId,
  userId: options.userId,
  createdAt,
  campaignSegment: options.campaignSegment,
  profile: options.profile,
  resolverReason: 'route-resolved',
  cleanupFailures: [],
});

export const cloneParallelGroup = (group: ParallelGroup): ParallelGroup => {
  const cleanupFailures = Array.isArray(group.cleanupFailures)
    ? group.cleanupFailures
    : [];

  return {
    ...group,
    calls: group.calls.map((call) => ({ ...call })),
    cleanupFailures: cleanupFailures.map((failure) => ({ ...failure })),
  };
};

export const hydrateParallelGroup = (group: ParallelGroup): ParallelGroup =>
  cloneParallelGroup(group);

export const completeGroupIfResolved = (
  group: ParallelGroup,
  occurredAt: string,
): ParallelGroup => {
  if (
    group.winnerSid ||
    !group.calls.every((call) => isTerminalCallStatus(call.status))
  ) {
    return group;
  }

  return {
    ...group,
    status: 'completed',
    completedAt: occurredAt,
  };
};

export const clearCleanupFailure = (
  group: ParallelGroup,
  action: ParallelCleanupAction,
  callSid: string,
): ParallelGroup => ({
  ...group,
  cleanupFailures: group.cleanupFailures.filter(
    (failure) => failure.action !== action || failure.callSid !== callSid,
  ),
});

export const recordCleanupFailure = (
  group: ParallelGroup,
  action: ParallelCleanupAction,
  callSid: string,
  message: string,
  occurredAt: string,
  retryable: boolean,
  previous?: ParallelCleanupFailure,
): ParallelGroup => {
  const existing =
    previous ??
    group.cleanupFailures.find(
      (failure) => failure.action === action && failure.callSid === callSid,
    );
  const cleared = clearCleanupFailure(group, action, callSid);

  return {
    ...cleared,
    cleanupFailures: [
      ...cleared.cleanupFailures,
      {
        action,
        callSid,
        message,
        attempts: (existing?.attempts ?? 0) + 1,
        firstFailedAt: existing?.firstFailedAt ?? occurredAt,
        lastFailedAt: occurredAt,
        retryable,
      },
    ],
  };
};

export const isStaleDialingGroup = (
  group: ParallelGroup,
  now: Date,
  timeoutMs: number,
): boolean => {
  if (group.status !== 'dialing') return false;
  const createdAtMs = new Date(group.createdAt).getTime();
  return (
    Number.isFinite(createdAtMs) && now.getTime() - createdAtMs >= timeoutMs
  );
};
