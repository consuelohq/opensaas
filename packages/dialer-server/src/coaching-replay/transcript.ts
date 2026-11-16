import type {
  ConversationScope,
  ParticipantBinding,
  SpeakerRole,
  TranscriptGapEvent,
  TranscriptLifecycleEvent,
  TranscriptSegmentEvent,
} from '@consuelo/conversation';

// All identifiers and content in this adapter are synthetic. No transport/audio is implied.
export const fixtureScope = (number: number): ConversationScope => ({
  workspaceId: 'synthetic-workspace',
  callSessionId: `synthetic-call-${number}`,
  callGeneration: 1,
});
export const fixtureParticipants: readonly ParticipantBinding[] = [
  {
    participantId: 'customer',
    legId: 'customer-leg',
    role: 'customer',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  },
  {
    participantId: 'rep',
    legId: 'rep-leg',
    role: 'rep',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  },
  {
    participantId: 'unknown',
    legId: 'unknown-leg',
    role: 'unknown',
    provenance: 'unknown',
    bindingRevision: 1,
  },
];

const envelope = (
  scope: ConversationScope,
  sequence: number,
  epoch: number,
) => ({
  schemaVersion: 1 as const,
  eventId: `event-${sequence}`,
  scope,
  cursor: { sequence, epoch },
  observedAtMs: 1000,
  source: { adapter: 'synthetic-text' },
});

export function segment(
  scope: ConversationScope,
  sequence: number,
  epoch: number,
  options: {
    text?: string;
    role?: SpeakerRole;
    revision?: number;
    finality?: 'interim' | 'final';
    segmentId?: string;
  } = {},
): TranscriptSegmentEvent {
  const binding = fixtureParticipants.find(
    (item) => item.role === (options.role ?? 'customer'),
  )!;
  return {
    ...envelope(scope, sequence, epoch),
    kind: 'segment',
    segmentId: options.segmentId ?? 'segment',
    segmentRevision: options.revision ?? 1,
    participantId: binding.participantId,
    legId: binding.legId,
    speaker: {
      role: binding.role,
      provenance: binding.provenance,
      bindingRevision: binding.bindingRevision,
    },
    audioStartMs: 0,
    audioEndMs: 900,
    text: options.text ?? 'synthetic text',
    finality: options.finality ?? 'final',
  };
}
export function gap(
  scope: ConversationScope,
  sequence: number,
  epoch: number,
): TranscriptGapEvent {
  return {
    ...envelope(scope, sequence, epoch),
    kind: 'gap',
    audioStartMs: 900,
    audioEndMs: 1200,
    reason: 'missing-audio',
  };
}
export function lifecycle(
  scope: ConversationScope,
  sequence: number,
  epoch: number,
  kind: TranscriptLifecycleEvent['kind'],
): TranscriptLifecycleEvent {
  return { ...envelope(scope, sequence, epoch), kind };
}
