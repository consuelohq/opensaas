import {
  LIMITS,
  type ConversationScope,
  type ParticipantBinding,
  type TimelineState,
  type Reduction,
  type TranscriptEvent,
} from './types.js';
import {
  bindingValid,
  scopeValid,
  snapshot,
  freeze,
  sameScope,
  canonical,
  validateTranscriptEvent,
} from './validation.js';

export function createTimeline(
  scope: ConversationScope,
  participants: readonly ParticipantBinding[],
): TimelineState {
  if (
    !scopeValid(scope) ||
    !Array.isArray(participants) ||
    !participants.length ||
    participants.length > LIMITS.participants ||
    participants.some((p) => !bindingValid(p)) ||
    new Set(participants.map((p) => p.participantId)).size !==
      participants.length ||
    new Set(participants.map((p) => p.legId)).size !== participants.length
  )
    throw new Error('invalid authenticated conversation bindings');
  return snapshot({
    scope,
    participants,
    cursor: { sequence: 0, epoch: 0 },
    status: 'active',
    segments: {},
    gaps: [],
    events: [],
  });
}
export function reduceTimeline(
  state: TimelineState,
  input: unknown,
): Reduction<TimelineState> {
  const reject = (reason: string): Reduction<TimelineState> => ({
    status: 'rejected',
    state,
    reason,
  });
  const validated = validateTranscriptEvent(input);
  if (!validated.ok) return reject(validated.reason);
  const event = validated.value;
  if (!sameScope(state.scope, event.scope))
    return reject('foreign workspace/call/generation');
  if (state.status === 'deleted') return reject('deleted tombstone');
  const previousEvent = state.events.find((e) => e.eventId === event.eventId);
  if (previousEvent)
    return canonical(previousEvent) === canonical(event)
      ? { status: 'duplicate', state }
      : reject('conflicting event identity');
  // Deletion may purge an already ended or revoked timeline. Nothing can resume it.
  if (state.status !== 'active' && event.kind !== 'deleted')
    return reject('terminal conversation');
  if (
    event.cursor.sequence !== state.cursor.sequence + 1 ||
    event.cursor.epoch !==
      state.cursor.epoch + (event.kind === 'reconnected' ? 1 : 0)
  )
    return reject('cursor gap/stale sequence or reconnect epoch');
  if (
    !['ended', 'revoked', 'deleted'].includes(event.kind) &&
    (state.events.length >= LIMITS.events ||
      (event.kind === 'segment' &&
        !state.segments[event.segmentId] &&
        Object.keys(state.segments).length >= LIMITS.segments))
  )
    return reject(
      'timeline capacity exceeded; persist/checkpoint before further admission',
    );
  if (event.kind === 'segment') {
    const participant = state.participants.find(
      (p) => p.participantId === event.participantId,
    );
    if (
      !participant ||
      participant.legId !== event.legId ||
      participant.role !== event.speaker.role ||
      participant.provenance !== event.speaker.provenance ||
      participant.bindingRevision !== event.speaker.bindingRevision
    )
      return reject('unverified participant/role provenance');
    const previous = state.segments[event.segmentId];
    if (
      previous
        ? previous.finality === 'final' ||
          event.segmentRevision !== previous.segmentRevision + 1 ||
          event.participantId !== previous.participantId ||
          event.legId !== previous.legId ||
          event.audioStartMs !== previous.audioStartMs ||
          event.audioEndMs < previous.audioEndMs
        : event.segmentRevision !== 1
    )
      return reject('stale/final/inconsistent segment revision');
    return {
      status: 'applied',
      state: freeze({
        ...state,
        cursor: event.cursor,
        segments: { ...state.segments, [event.segmentId]: event },
        events: [...state.events, event],
      }),
    };
  }
  if (
    event.kind === 'gap' &&
    event.participantId &&
    !state.participants.some((p) => p.participantId === event.participantId)
  )
    return reject('foreign gap participant');
  if (event.kind === 'deleted')
    return {
      status: 'applied',
      state: freeze({
        ...state,
        cursor: event.cursor,
        status: 'deleted',
        segments: {},
        gaps: [],
        events: [],
        participants: [],
      }),
    };
  return {
    status: 'applied',
    state: freeze({
      ...state,
      cursor: event.cursor,
      status:
        event.kind === 'ended' || event.kind === 'revoked'
          ? event.kind
          : state.status,
      gaps: event.kind === 'gap' ? [...state.gaps, event] : state.gaps,
      events: [...state.events, event],
    }),
  };
}
export interface ReplayObserver {
  onEvent(event: TranscriptEvent, result: Reduction<TimelineState>): void;
}
export function replayTimeline(
  initial: TimelineState,
  events: readonly TranscriptEvent[],
  observer?: ReplayObserver,
): { state: TimelineState; results: readonly Reduction<TimelineState>[] } {
  let state = initial;
  const results: Reduction<TimelineState>[] = [];
  for (const event of events) {
    const result = reduceTimeline(state, event);
    results.push(result);
    state = result.state;
    observer?.onEvent(event, result);
  }
  return { state, results };
}
