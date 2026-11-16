import { describe, expect, it } from 'bun:test';
import { createTimeline, reduceTimeline } from '@consuelo/conversation';
import {
  normalizeTranscriptSegment,
  normalizeTranscriptGap,
} from './normalization';
import type { TranscriptSegment } from './contracts';

const scope = { workspaceId: 'one', callSessionId: 'call', callGeneration: 1 };
const binding = {
  participantId: 'customer',
  legId: 'CA-one',
  role: 'customer' as const,
  provenance: 'authenticated-leg' as const,
  bindingRevision: 1,
};
const segment: TranscriptSegment = {
  id: 'segment',
  workspaceId: 'one',
  sessionId: 'call',
  providerCallId: 'CA-one',
  sequence: 2,
  idempotencyKey: 'source',
  track: 'inbound',
  speaker: 'customer',
  text: 'existing coverage',
  startMs: 100,
  endMs: 300,
  language: 'en',
  confidence: null,
  provider: 'groq',
  model: 'whisper-large-v3-turbo',
  createdAt: '2026-11-13T20:00:00Z',
  metadata: {
    schemaVersion: 1,
    sourceAudioStartMs: 0,
    sourceAudioEndMs: 400,
    streamSid: 'MZ-one',
    timingBasis: 'provider-words',
    speakerProvenance: 'authenticated-leg',
    words: [],
    speechSegments: [],
    gapBefore: { startMs: 400, endMs: 600 },
  },
};
describe('existing transcript to shared conversation adapter', () => {
  it('preserves source timing and trusted role through the actual core reducer', () => {
    const normalized = normalizeTranscriptSegment({
      segment,
      scope,
      binding,
      cursor: { sequence: 1, epoch: 0 },
      audioOffsetMs: 1000,
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) throw new Error(normalized.reason);
    expect(normalized.value).toMatchObject({
      audioStartMs: 1100,
      audioEndMs: 1300,
      speaker: {
        role: binding.role,
        provenance: binding.provenance,
        bindingRevision: binding.bindingRevision,
      },
      finality: 'final',
    });
    const result = reduceTimeline(
      createTimeline(scope, [binding]),
      normalized.value,
    );
    expect(result.status).toBe('applied');
    expect(reduceTimeline(result.state, normalized.value).status).toBe(
      'duplicate',
    );
  });
  it('abstains for unknown reconnect origin, coarse timing, foreign scope and unproven role', () => {
    const base = {
      segment,
      scope,
      binding,
      cursor: { sequence: 1, epoch: 0 },
      audioOffsetMs: 0,
    };
    expect(
      normalizeTranscriptSegment({ ...base, audioOffsetMs: null }).ok,
    ).toBe(false);
    expect(
      normalizeTranscriptSegment({
        ...base,
        segment: { ...segment, metadata: undefined },
      }).ok,
    ).toBe(false);
    expect(
      normalizeTranscriptSegment({
        ...base,
        scope: { ...scope, workspaceId: 'foreign' },
      }).ok,
    ).toBe(false);
    expect(
      normalizeTranscriptSegment({
        ...base,
        binding: { ...binding, role: 'rep' },
      }).ok,
    ).toBe(false);
    expect(
      normalizeTranscriptSegment({
        ...base,
        segment: { ...segment, speaker: 'outbound' },
      }).ok,
    ).toBe(false);
  });
  it('adapts an actual missing-audio interval with a separately allocated core cursor', () => {
    const normalized = normalizeTranscriptGap({
      segment,
      scope,
      cursor: { sequence: 2, epoch: 0 },
      audioOffsetMs: 1000,
      participantId: binding.participantId,
    });
    expect(normalized.ok).toBe(true);
    if (normalized.ok)
      expect(normalized.value).toMatchObject({
        kind: 'gap',
        audioStartMs: 1400,
        audioEndMs: 1600,
        reason: 'missing-audio',
      });
  });
});
