import {
  validateTranscriptEvent,
  type ConversationScope,
  type ParticipantBinding,
  type TranscriptCursor,
  type TranscriptGapEvent,
  type TranscriptSegmentEvent,
  type Validation,
} from '@consuelo/conversation';
import type { TranscriptSegment } from './contracts';

type Alignment = {
  segment: TranscriptSegment;
  scope: ConversationScope;
  cursor: TranscriptCursor;
  // Null is intentional: a reconnect does not establish an exact call-relative origin.
  audioOffsetMs: number | null;
};
const scopeMatches = (input: Alignment): boolean =>
  input.scope.workspaceId === input.segment.workspaceId &&
  input.scope.callSessionId === input.segment.sessionId &&
  input.audioOffsetMs !== null &&
  Number.isFinite(input.audioOffsetMs) &&
  input.audioOffsetMs >= 0;

export const normalizeTranscriptSegment = (
  input: Alignment & {
    binding: ParticipantBinding;
  },
): Validation<TranscriptSegmentEvent> => {
  const { segment, binding } = input;
  if (!scopeMatches(input))
    return {
      ok: false,
      reason: 'missing trusted call alignment or mismatched scope',
    };
  if (
    !segment.metadata ||
    segment.metadata.timingBasis === 'unavailable' ||
    segment.startMs === null ||
    segment.endMs === null ||
    segment.startMs < segment.metadata.sourceAudioStartMs ||
    segment.endMs > segment.metadata.sourceAudioEndMs
  )
    return {
      ok: false,
      reason: 'provider speech timing unavailable or outside source window',
    };
  const role =
    segment.speaker === 'customer'
      ? 'customer'
      : segment.speaker === 'representative'
        ? 'rep'
        : 'unknown';
  const provenance = segment.metadata.speakerProvenance;
  if (
    binding.legId !== segment.providerCallId ||
    binding.role !== role ||
    binding.provenance !== provenance
  )
    return {
      ok: false,
      reason: 'speaker binding does not match authenticated source evidence',
    };
  const candidate: TranscriptSegmentEvent = {
    schemaVersion: 1,
    eventId: segment.id,
    kind: 'segment',
    scope: input.scope,
    cursor: input.cursor,
    observedAtMs: Date.parse(segment.createdAt),
    source: { adapter: 'twilio-media/groq', modelVersion: segment.model },
    segmentId: segment.id,
    segmentRevision: 1,
    participantId: binding.participantId,
    legId: binding.legId,
    speaker: { role, provenance, bindingRevision: binding.bindingRevision },
    audioStartMs: input.audioOffsetMs! + segment.startMs,
    audioEndMs: input.audioOffsetMs! + segment.endMs,
    text: segment.text,
    finality: 'final',
    ...(segment.language ? { language: segment.language } : {}),
    ...(segment.confidence !== null ? { quality: segment.confidence } : {}),
  };
  const validated = validateTranscriptEvent(candidate);
  return validated.ok && validated.value.kind === 'segment'
    ? { ok: true, value: validated.value }
    : {
        ok: false,
        reason: validated.ok ? 'unexpected event kind' : validated.reason,
      };
};

export const normalizeTranscriptGap = (
  input: Alignment & {
    participantId?: string;
  },
): Validation<TranscriptGapEvent> => {
  if (!scopeMatches(input))
    return {
      ok: false,
      reason: 'missing trusted call alignment or mismatched scope',
    };
  const gap = input.segment.metadata?.gapBefore;
  if (!gap) return { ok: false, reason: 'no source audio gap' };
  const candidate: TranscriptGapEvent = {
    schemaVersion: 1,
    eventId: input.segment.id + ':gap',
    kind: 'gap',
    scope: input.scope,
    cursor: input.cursor,
    observedAtMs: Date.parse(input.segment.createdAt),
    source: { adapter: 'twilio-media/groq', modelVersion: input.segment.model },
    audioStartMs: input.audioOffsetMs! + gap.startMs,
    audioEndMs: input.audioOffsetMs! + gap.endMs,
    reason: 'missing-audio',
    ...(input.participantId ? { participantId: input.participantId } : {}),
  };
  const validated = validateTranscriptEvent(candidate);
  return validated.ok && validated.value.kind === 'gap'
    ? { ok: true, value: validated.value }
    : {
        ok: false,
        reason: validated.ok ? 'unexpected event kind' : validated.reason,
      };
};
