import { InboundContractError } from './lifecycle.js';
import {
  decodeRepCapacityEvent,
  type RepCapacityEvent,
  type RepCapacityState,
  type RepCapacityOwner,
} from './rep-capacity-contracts.js';

const reject = (reason: string): never => {
  throw new InboundContractError(reason);
};
const plus = (at: string, milliseconds: number) =>
  new Date(Date.parse(at) + milliseconds).toISOString();
const present = (state: RepCapacityState, at: string) =>
  state.ready &&
  at >= state.presenceAt &&
  at < plus(state.presenceAt, state.policy.presenceMilliseconds);
export const isRepCapacityEligible = (state: RepCapacityState, at: string) =>
  Number.isFinite(Date.parse(at)) &&
  !state.owner &&
  present(state, at) &&
  (!state.cooldownUntil || at >= state.cooldownUntil) &&
  state.endpoints.some((endpoint) => endpoint.healthy);

export const applyRepCapacityAction = (
  previous: RepCapacityState | null,
  raw: RepCapacityEvent,
): RepCapacityState => {
  const event = decodeRepCapacityEvent(raw);
  const action = event.action;
  if (event.expectedVersion !== (previous?.version ?? 0))
    reject('Capacity version conflict');
  if (!previous) {
    if (action.type !== 'register') return reject('Capacity is not registered');
    return {
      schemaVersion: 1,
      workspaceId: event.workspaceId,
      capacityId: event.capacityId,
      repId: action.repId,
      version: 1,
      generation: event.generationFloor ?? 0,
      policy: action.policy,
      ready: false,
      endpoints: [],
      presenceAt: event.at,
      updatedAt: event.at,
      cooldownUntil: null,
      idleSince: event.at,
      owner: null,
    };
  }
  if (event.generationFloor !== undefined)
    reject('Generation floor belongs to registration');
  if (
    previous.workspaceId !== event.workspaceId ||
    previous.capacityId !== event.capacityId
  )
    reject('Capacity scope mismatch');
  if (event.at < previous.updatedAt) reject('Capacity clock moved backwards');
  if (previous.version >= Number.MAX_SAFE_INTEGER)
    reject('Capacity version exhausted');
  const state: RepCapacityState = {
    ...previous,
    version: previous.version + 1,
    updatedAt: event.at,
  };
  if (action.type === 'register')
    return reject('Capacity is already registered');
  if (action.type === 'readiness') {
    if (
      new Set(action.endpoints.map((e) => e.endpointId)).size !==
      action.endpoints.length
    )
      reject('Duplicate endpoint');
    return {
      ...state,
      ready: action.ready,
      endpoints: action.endpoints,
      presenceAt: event.at,
    };
  }
  if (action.type === 'offer') {
    if (!isRepCapacityEligible(state, event.at))
      reject('Rep has no eligible capacity');
    if (new Set(action.endpointIds).size !== action.endpointIds.length)
      reject('Duplicate offered endpoint');
    const endpoints = action.endpointIds.map((endpointId) => {
      const device = state.endpoints.find(
        (e) => e.endpointId === endpointId && e.healthy,
      );
      if (!device) return reject('Offered endpoint is not healthy');
      return { endpointId, kind: device.kind, status: 'offered' as const };
    });
    if (state.generation >= Number.MAX_SAFE_INTEGER)
      reject('Capacity generation exhausted');
    const generation = state.generation + 1;
    return {
      ...state,
      generation,
      owner: {
        assignmentId: action.assignmentId,
        requestId: action.requestId,
        direction: action.direction,
        generation,
        phase: 'offering',
        offerExpiresAt: plus(event.at, state.policy.offerMilliseconds),
        endpoints,
        winnerEndpointId: null,
        externalStarted: false,
        connectedAt: null,
        unknownSince: null,
        escalatedAt: null,
        wrapUpUntil: null,
      },
    };
  }
  const owner = state.owner;
  if (
    !owner ||
    owner.assignmentId !== action.assignmentId ||
    owner.generation !== action.generation
  )
    return reject('Stale capacity ownership fence');
  const retain = (change: Partial<RepCapacityOwner>) => ({
    ...state,
    owner: { ...owner, ...change },
  });
  const release = () => ({
    ...state,
    owner: null,
    idleSince: event.at,
    cooldownUntil: plus(event.at, state.policy.cooldownMilliseconds),
  });
  const uncertain = () =>
    retain({
      phase: 'unknown',
      unknownSince: owner.unknownSince ?? event.at,
      endpoints: owner.endpoints.map((e) =>
        e.status === 'offered' ? { ...e, status: 'cancelled' as const } : e,
      ),
    });
  if (action.type === 'accept' || action.type === 'decline') {
    if (owner.phase !== 'offering' || event.at >= owner.offerExpiresAt)
      reject('Offer is no longer valid');
    const endpoint = owner.endpoints.find(
      (e) => e.endpointId === action.endpointId,
    );
    if (!endpoint || endpoint.status !== 'offered')
      reject('Endpoint has no valid offer');
    if (action.type === 'accept') {
      if (
        !present(state, event.at) ||
        !state.endpoints.some(
          (e) =>
            e.endpointId === action.endpointId &&
            e.kind === endpoint?.kind &&
            e.healthy,
        )
      )
        reject('Endpoint is no longer available');
      return retain({
        phase: 'connecting',
        winnerEndpointId: action.endpointId,
        endpoints: owner.endpoints.map((e) => ({
          ...e,
          status:
            e.endpointId === action.endpointId
              ? 'accepted'
              : e.status === 'offered'
                ? 'cancelled'
                : e.status,
        })),
      });
    }
    const endpoints = owner.endpoints.map((e) =>
      e.endpointId === action.endpointId
        ? { ...e, status: 'declined' as const }
        : e,
    );
    if (endpoints.some((e) => e.status === 'offered'))
      return retain({ endpoints });
    return owner.externalStarted
      ? retain({
          phase: 'unknown',
          unknownSince: owner.unknownSince ?? event.at,
          endpoints,
        })
      : release();
  }
  if (action.type === 'dispatch') {
    if (!['offering', 'connecting'].includes(owner.phase))
      reject('Capacity does not authorize external work');
    if (owner.phase === 'offering' && event.at >= owner.offerExpiresAt)
      reject('Offer expired before dispatch');
    return retain({ externalStarted: true });
  }
  if (action.type === 'expire' || action.type === 'cancel') {
    if (!['offering', 'connecting'].includes(owner.phase))
      reject('Assignment cannot be cancelled by offer policy');
    if (
      action.type === 'expire' &&
      (owner.phase !== 'offering' || event.at < owner.offerExpiresAt)
    )
      reject('Offer has not expired');
    return owner.externalStarted ? uncertain() : release();
  }
  if (action.type === 'unknown') {
    if (!owner.externalStarted || owner.phase === 'wrap_up')
      reject('No unresolved external effect');
    return uncertain();
  }
  if (action.type === 'escalate') {
    if (
      !owner.unknownSince ||
      event.at < plus(owner.unknownSince, state.policy.escalationMilliseconds)
    )
      reject('Reconciliation escalation is not due');
    return retain({ escalatedAt: owner.escalatedAt ?? event.at });
  }
  if (action.type === 'finish_wrap_up') {
    if (
      owner.phase !== 'wrap_up' ||
      !owner.wrapUpUntil ||
      (!action.manual && event.at < owner.wrapUpUntil)
    )
      reject('Wrap-up is not complete');
    return { ...state, owner: null, idleSince: event.at };
  }
  if (action.type === 'reconcile') {
    if (action.outcome === 'connected') {
      if (
        !owner.externalStarted ||
        !owner.winnerEndpointId ||
        !['connecting', 'unknown'].includes(owner.phase)
      )
        reject('Connection requires an authorized accepted endpoint');
      return retain({
        phase: 'connected',
        connectedAt: owner.connectedAt ?? event.at,
        unknownSince: null,
        escalatedAt: null,
      });
    }
    if (owner.phase === 'wrap_up')
      reject('External work is already reconciled');
    if (action.outcome === 'no_effect' && owner.connectedAt !== null)
      reject('Connected call cannot have no effect');
    if (action.outcome === 'ended' && owner.connectedAt !== null) {
      return retain({
        phase: 'wrap_up',
        externalStarted: false,
        unknownSince: null,
        escalatedAt: null,
        wrapUpUntil: plus(event.at, state.policy.wrapUpMilliseconds),
      });
    }
    return release();
  }
  return reject('Unknown capacity action');
};

export const replayRepCapacityEvents = (events: readonly RepCapacityEvent[]) =>
  events.reduce<RepCapacityState | null>(
    (state, event) => applyRepCapacityAction(state, event),
    null,
  );
