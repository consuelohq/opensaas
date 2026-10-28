import { InboundContractError } from './lifecycle.js';
import { isRepCapacityEligible } from './rep-capacity.js';
import {
  decodeInboundQueuePolicy,
  decodeRoutingRequestMetadata,
  type InboundQueuePolicy,
  type InboundRoutingFrame,
  type InboundRoutingRequest,
  type InboundRoutingEvaluation,
  type RoutingCandidateEvidence,
  type RoutingExclusion,
} from './routing-contracts.js';

const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;
const validTime = (value: string) =>
  value.length === 24 &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const reject = (message: string): never => {
  throw new InboundContractError(message);
};
export const isInboundQueueOpen = (
  policy: InboundQueuePolicy,
  at: string,
): boolean => {
  if (policy.emergencyClosed) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: policy.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  const date = get('year') + '-' + get('month') + '-' + get('day');
  if (policy.closedDates.includes(date)) return false;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    get('weekday'),
  );
  const minute = Number(get('hour')) * 60 + Number(get('minute'));
  return policy.weekly.some(
    (window) =>
      window.day === day &&
      minute >= window.startMinute &&
      minute < window.endMinute,
  );
};
const candidatesFor = (
  frame: InboundRoutingFrame,
  request: InboundRoutingRequest,
): RoutingCandidateEvidence[] =>
  [...frame.capacities]
    .sort((a, b) => compare(a.capacityId, b.capacityId))
    .map((capacity) => {
      const reasons: RoutingExclusion[] = [];
      const profile = frame.policy.profiles.find(
        (item) => item.repId === capacity.repId,
      );
      if (capacity.workspaceId !== frame.policy.workspaceId)
        reasons.push('tenant');
      if (!profile) reasons.push('queue');
      if (
        profile &&
        !request.requiredSkills.every((skill) => profile.skills.includes(skill))
      )
        reasons.push('skill');
      if (capacity.owner) reasons.push('busy');
      if (!capacity.ready) reasons.push('away');
      if (
        frame.at < capacity.presenceAt ||
        Date.parse(frame.at) - Date.parse(capacity.presenceAt) >=
          capacity.policy.presenceMilliseconds
      )
        reasons.push('stale_presence');
      if (!capacity.endpoints.some((endpoint) => endpoint.healthy))
        reasons.push('device');
      if (capacity.cooldownUntil && frame.at < capacity.cooldownUntil)
        reasons.push('cooldown');
      if (
        request.attempts.some(
          (attempt) =>
            attempt.repId === capacity.repId && frame.at < attempt.retryAfter,
        )
      )
        reasons.push('repeat');
      return {
        capacityId: capacity.capacityId,
        repId: capacity.repId,
        version: capacity.version,
        eligible:
          reasons.length === 0 && isRepCapacityEligible(capacity, frame.at),
        reasons,
        idleSince: capacity.idleSince,
        ownerPreferred:
          request.ownerStatus === 'known' &&
          request.ownerRepId === capacity.repId &&
          request.attempts.length === 0,
      };
    });
const validate = (frame: InboundRoutingFrame) => {
  decodeInboundQueuePolicy(frame.policy);
  if (!validTime(frame.at)) reject('Invalid routing time');
  if (frame.requests.length > 1000 || frame.capacities.length > 1000)
    reject('Routing snapshot exceeds bound; do not truncate candidates');
  if (
    new Set(frame.policy.profiles.map((profile) => profile.repId)).size !==
    frame.policy.profiles.length
  )
    reject('Duplicate queue member');
  if (
    frame.policy.weekly.some((window) => window.startMinute >= window.endMinute)
  )
    reject('Split overnight windows across calendar days');
  if (
    new Set(frame.requests.map((request) => request.requestId)).size !==
      frame.requests.length ||
    new Set(frame.capacities.map((capacity) => capacity.capacityId)).size !==
      frame.capacities.length
  )
    reject('Duplicate routing identity');
  for (const request of frame.requests) {
    const {
      requiredSkills,
      ownerRepId,
      ownerStatus,
      kind,
      notBefore,
      deadline,
    } = request;
    decodeRoutingRequestMetadata({
      requiredSkills,
      ownerRepId,
      ownerStatus,
      kind,
      notBefore,
      deadline,
    });
    if (!validTime(request.enteredAt) || request.enteredAt > frame.at)
      reject('Invalid request entry time');
    if ((ownerStatus === 'known') !== (ownerRepId !== null))
      reject('Ambiguous owner metadata');
    if (
      kind === 'callback'
        ? !notBefore || !deadline || notBefore > deadline
        : notBefore !== null || deadline !== null
    )
      reject('Invalid callback eligibility window');
    for (const attempt of request.attempts)
      if (
        !validTime(attempt.offeredAt) ||
        !validTime(attempt.retryAfter) ||
        attempt.offeredAt > frame.at ||
        attempt.retryAfter < attempt.offeredAt
      )
        reject('Invalid attempt history');
  }
  for (const capacity of frame.capacities)
    if (
      !validTime(capacity.updatedAt) ||
      capacity.updatedAt > frame.at ||
      !validTime(capacity.idleSince) ||
      capacity.idleSince > frame.at
    )
      reject('Invalid capacity snapshot time');
};
export const evaluateInboundRouting = (
  frame: InboundRoutingFrame,
): InboundRoutingEvaluation => {
  validate(frame);
  const queueOpen = isInboundQueueOpen(frame.policy, frame.at);
  const considered: {
    requestId: string;
    reason: string;
    waitingMilliseconds: number;
  }[] = [];
  const result = (
    requestId: string | null,
    action: InboundRoutingEvaluation['action'],
    reason: InboundRoutingEvaluation['reason'],
    candidates: readonly RoutingCandidateEvidence[] = [],
    proposedCapacityId: string | null = null,
  ): InboundRoutingEvaluation => ({
    schemaVersion: 2,
    policyVersion: frame.policy.policyVersion,
    decidedAt: frame.at,
    queueOpen,
    requestId,
    action,
    reason,
    candidates,
    proposedCapacityId,
    considered: [...considered],
  });
  let waiting:
    | { request: InboundRoutingRequest; candidates: RoutingCandidateEvidence[] }
    | undefined;
  for (const request of [...frame.requests].sort(
    (a, b) =>
      compare(a.enteredAt, b.enteredAt) || compare(a.requestId, b.requestId),
  )) {
    const age = Date.parse(frame.at) - Date.parse(request.enteredAt);
    const note = (reason: string) =>
      considered.push({
        requestId: request.requestId,
        reason,
        waitingMilliseconds: age,
      });
    if (
      request.workspaceId !== frame.policy.workspaceId ||
      request.queueId !== frame.policy.queueId
    ) {
      note('scope');
      continue;
    }
    if (!['created', 'queued', 'offering'].includes(request.state)) {
      note('terminal_or_bridging');
      continue;
    }
    if (
      frame.capacities.some(
        (capacity) =>
          capacity.workspaceId === request.workspaceId &&
          capacity.owner?.requestId === request.requestId,
      )
    ) {
      note('owned');
      continue;
    }
    if (request.kind === 'callback' && frame.at < request.notBefore!) {
      note('not_due');
      continue;
    }
    const fallback =
      request.deadline && frame.at >= request.deadline
        ? 'deadline'
        : !queueOpen
          ? 'closed'
          : request.attempts.length >= frame.policy.maxOffers
            ? 'max_offers'
            : request.kind === 'live' && age >= frame.policy.maxWaitMilliseconds
              ? 'max_wait'
              : null;
    if (fallback) {
      note(fallback);
      return result(request.requestId, 'fallback', fallback);
    }
    const candidates = candidatesFor(frame, request);
    const eligible = candidates
      .filter((candidate) => candidate.eligible)
      .sort(
        (a, b) =>
          Number(b.ownerPreferred) - Number(a.ownerPreferred) ||
          compare(a.idleSince, b.idleSince) ||
          compare(a.repId, b.repId),
      );
    if (eligible[0]) {
      note('selected');
      return result(
        request.requestId,
        'offer',
        eligible[0].ownerPreferred ? 'owner' : 'longest_idle',
        candidates,
        eligible[0].capacityId,
      );
    }
    note('no_capacity');
    waiting ??= { request, candidates };
  }
  if (waiting)
    return result(
      waiting.request.requestId,
      'wait',
      'no_capacity',
      waiting.candidates,
    );
  return result(
    null,
    'wait',
    considered.some((item) => item.reason === 'not_due') ? 'not_due' : 'empty',
  );
};
