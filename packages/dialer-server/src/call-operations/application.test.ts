import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import {
  createCallOperationsApplication,
  type CallOperationsRepositoryService,
  type SpeechToTextProviderService,
  type TranscriptSegment,
} from './application';

const audioPayload = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64');

const createHarness = (
  input: {
    provider?: SpeechToTextProviderService;
    enabled?: boolean;
    providerAccountId?: string;
    trackRoles?: {
      inbound?: 'customer' | 'representative';
      outbound?: 'customer' | 'representative';
    };
    config?: {
      maxConcurrentTranscriptions?: number;
      chunkBytes?: number;
      overlapBytes?: number;
      maxBufferBytesPerTrack?: number;
    };
  } = {},
) => {
  const statuses: string[] = [];
  const segments = new Map<string, TranscriptSegment>();
  const providerCalls: Array<{ track: string; audio: Uint8Array }> = [];
  const repository: CallOperationsRepositoryService = {
    resolveTranscriptionSettings: () =>
      Effect.succeed({
        enabled: input.enabled ?? true,
        language: null,
        retentionDays: 30,
      }),
    resolveTranscriptionContextForSession: () =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        sessionId: 'session-1',
        enabled: input.enabled ?? true,
        language: null,
        retentionDays: 30,
      }),
    resolveTranscriptionContext: () =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        sessionId: 'session-1',
        enabled: input.enabled ?? true,
        language: null,
        retentionDays: 30,
        providerAccountId: input.providerAccountId,
        trackRoles: input.trackRoles,
      }),
    setTranscriptStatus: ({ status }) =>
      Effect.sync(() => {
        statuses.push(status);
      }),
    appendTranscriptSegment: (segment) =>
      Effect.sync(() => {
        const inserted = !segments.has(segment.idempotencyKey);
        if (inserted) segments.set(segment.idempotencyKey, segment);
        return { inserted };
      }),
    recoverInterruptedTranscriptions: () => Effect.succeed(0),
    createOrUpdateCallSession: () => Effect.void,
    recordCallLegTransition: () => Effect.void,
    listActiveCalls: () => Effect.succeed([]),
    listCallHistory: () => Effect.succeed({ calls: [], nextCursor: null }),
    getCallDetail: () => Effect.succeed(null),
    getCallTranscript: () => Effect.succeed([]),
    recordDisposition: () => Effect.void,
    setCrmSyncStatus: () => Effect.void,
    claimCallRecording: () => Effect.succeed(null),
    setCallRecordingStarted: () => Effect.void,
    setCallRecordingFailed: () => Effect.void,
    resolveRecordingCallOwnership: () => Effect.succeed(null),
    resolveStatusCallOwnership: () => Effect.succeed(null),
    recordCallRecordingStatus: () => Effect.void,
  };
  const provider: SpeechToTextProviderService = input.provider ?? {
    transcribe: (request) =>
      Effect.sync(() => {
        providerCalls.push({ track: request.track, audio: request.audio });
        return {
          text: `${request.track} transcript`,
          language: 'en',
          confidence: 0.84,
          startMs: 0,
          endMs: 500,
        };
      }),
  };
  const application = createCallOperationsApplication({
    repository,
    speechToTextProvider: provider,
    config: {
      model: 'whisper-large-v3-turbo',
      chunkBytes: 4,
      maxBufferBytesPerTrack: 8,
      providerTimeoutMs: 20,
      maxConcurrentTranscriptions: 2,
      ...input.config,
    },
  });
  return { application, providerCalls, segments, statuses };
};

const begin = (connectionId = 'connection-1') => ({ connectionId });

const startFrame = (streamSid = 'MZ-1') => ({
  event: 'start' as const,
  sequenceNumber: '1',
  streamSid,
  start: {
    streamSid,
    callSid: 'CA-1',
    customParameters: { callId: 'CA-1', sessionId: 'session-1' },
  },
});

const mediaFrame = (
  track: 'inbound' | 'outbound',
  sequenceNumber: string,
  payload: string,
) => ({
  event: 'media' as const,
  sequenceNumber,
  streamSid: 'MZ-1',
  media: {
    track,
    chunk: sequenceNumber,
    timestamp: sequenceNumber,
    payload: audioPayload(payload),
  },
});

describe('Effect call-operations transcription application', () => {
  it('aborts provider work and independently releases a failed media session', async () => {
    let providerSignal: AbortSignal | undefined;
    const harness = createHarness({
      provider: {
        transcribe: (request) => {
          providerSignal = request.signal;
          return Effect.never;
        },
      },
    });
    await Effect.runPromise(
      harness.application.beginTranscriptionSession(begin()),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: startFrame(),
      }),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: mediaFrame('inbound', '2', 'aaaa'),
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Effect.runPromise(
      harness.application.failTranscriptionSession({
        connectionId: 'connection-1',
        failureCode: 'MEDIA_STREAM_ERROR',
      }),
    );
    expect(providerSignal?.aborted).toBe(true);
    expect(harness.segments.size).toBe(0);
    expect(harness.statuses).toEqual(['processing', 'failed']);
    expect(
      await Effect.runPromise(
        harness.application.completeTranscriptionSession(begin()),
      ),
    ).toEqual({ status: 'failed' });
  });

  it('rechecks opt-out before queued requests and drops late results after revocation', async () => {
    let allowed = true,
      requests = 0;
    let resolveProvider: (value: { text: string }) => void = () => {};
    const harness = createHarness({
      get enabled() {
        return allowed;
      },
      config: { maxConcurrentTranscriptions: 1 },
      provider: {
        transcribe: () =>
          Effect.promise(() => {
            requests++;
            return new Promise<{ text: string }>((resolve) => {
              resolveProvider = resolve;
            });
          }),
      },
    });
    for (const connectionId of ['one', 'two']) {
      await Effect.runPromise(
        harness.application.beginTranscriptionSession({ connectionId }),
      );
      await Effect.runPromise(
        harness.application.processTranscriptionFrame({
          connectionId,
          frame: startFrame(),
        }),
      );
      await Effect.runPromise(
        harness.application.processTranscriptionFrame({
          connectionId,
          frame: mediaFrame('inbound', '2', 'aaaa'),
        }),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    allowed = false;
    resolveProvider({ text: 'must not persist' });
    await Promise.all(
      ['one', 'two'].map((connectionId) =>
        Effect.runPromise(
          harness.application.completeTranscriptionSession({ connectionId }),
        ),
      ),
    );
    expect(requests).toBe(1);
    expect(harness.segments.size).toBe(0);
  });
  it('binds AccountSid and stream to persisted call authority', async () => {
    const harness = createHarness({
      providerAccountId: 'AC-owner',
      trackRoles: { inbound: 'customer' },
    });
    await Effect.runPromise(
      harness.application.beginTranscriptionSession(begin()),
    );
    const rejected = await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: {
          ...startFrame(),
          start: { ...startFrame().start, accountSid: 'AC-foreign' },
        },
      }),
    );
    expect(rejected.accepted).toBe(false);
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: {
          ...startFrame(),
          start: { ...startFrame().start, accountSid: 'AC-owner' },
        },
      }),
    );
    const foreign = await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: {
          ...mediaFrame('inbound', '2', 'aaaa'),
          streamSid: 'MZ-foreign',
        },
      }),
    );
    expect(foreign.accepted).toBe(false);
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: mediaFrame('inbound', '2', 'aaaa'),
      }),
    );
    await Effect.runPromise(
      harness.application.completeTranscriptionSession(begin()),
    );
    expect(harness.providerCalls).toHaveLength(1);
    expect([...harness.segments.values()][0]?.speaker).toBe('customer');
  });
  it('refuses an untrusted stream frame that claims another session or CallSid', async () => {
    for (const parameters of [
      { callId: 'CA-1', sessionId: 'foreign-session' },
      { callId: 'CA-foreign', sessionId: 'session-1' },
    ]) {
      const harness = createHarness();
      await Effect.runPromise(
        harness.application.beginTranscriptionSession(begin()),
      );
      const result = await Effect.runPromise(
        harness.application.processTranscriptionFrame({
          connectionId: 'connection-1',
          frame: {
            ...startFrame(),
            start: { ...startFrame().start, customParameters: parameters },
          },
        }),
      );
      expect(result.accepted).toBe(false);
      expect(harness.statuses).not.toContain('processing');
    }
  });
  it('keeps inbound and outbound buffers separate and persists provider metadata only', async () => {
    const harness = createHarness();
    await Effect.runPromise(
      harness.application.beginTranscriptionSession(begin()),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: startFrame(),
      }),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: mediaFrame('inbound', '2', 'aaaa'),
      }),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: mediaFrame('outbound', '3', 'bbbb'),
      }),
    );
    await Effect.runPromise(
      harness.application.completeTranscriptionSession(begin()),
    );

    expect(harness.providerCalls.map((call) => call.track).sort()).toEqual([
      'inbound',
      'outbound',
    ]);
    expect(
      [...harness.segments.values()].map((segment) => segment.track).sort(),
    ).toEqual(['inbound', 'outbound']);
    for (const call of harness.providerCalls) {
      const wav = Buffer.from(call.audio);
      expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(wav.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(wav.readUInt16LE(20)).toBe(7);
      expect(wav.readUInt32LE(24)).toBe(8_000);
      expect(wav.readUInt16LE(22)).toBe(1);
    }
    for (const segment of harness.segments.values()) {
      expect(segment.provider).toBe('groq');
      expect(segment.model).toBe('whisper-large-v3-turbo');
      expect(JSON.stringify(segment)).not.toContain('YWFhYQ==');
      expect(JSON.stringify(segment)).not.toContain('YmJiYg==');
      expect(segment).not.toHaveProperty('audio');
      expect(segment).not.toHaveProperty('payload');
    }
    expect(
      [...harness.segments.values()].find(
        (segment) => segment.track === 'inbound',
      ),
    ).toMatchObject({
      startMs: null,
      endMs: null,
      speaker: 'unknown',
      metadata: {
        sourceAudioStartMs: 2,
        sourceAudioEndMs: 3,
        timingBasis: 'unavailable',
      },
    });
  });

  it('processes duplicate frames once and flushes a terminal remainder once', async () => {
    const harness = createHarness();
    await Effect.runPromise(
      harness.application.beginTranscriptionSession(begin()),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: startFrame(),
      }),
    );
    const frame = mediaFrame('inbound', '2', 'aa');
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame,
      }),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame,
      }),
    );
    await Effect.runPromise(
      harness.application.completeTranscriptionSession(begin()),
    );
    await Effect.runPromise(
      harness.application.completeTranscriptionSession(begin()),
    );

    expect(harness.providerCalls).toHaveLength(1);
    expect(harness.segments).toHaveProperty('size', 1);
    expect(harness.statuses).toEqual(['processing', 'ready']);
  });

  it('keeps transcript rows idempotent when a provider stream reconnects', async () => {
    const harness = createHarness();
    for (const connectionId of ['connection-1', 'connection-2']) {
      await Effect.runPromise(
        harness.application.beginTranscriptionSession(begin(connectionId)),
      );
      await Effect.runPromise(
        harness.application.processTranscriptionFrame({
          connectionId,
          frame: startFrame(`MZ-${connectionId}`),
        }),
      );
      await Effect.runPromise(
        harness.application.processTranscriptionFrame({
          connectionId,
          frame: {
            ...mediaFrame('inbound', '2', 'aa'),
            streamSid: `MZ-${connectionId}`,
          },
        }),
      );
      await Effect.runPromise(
        harness.application.completeTranscriptionSession(begin(connectionId)),
      );
    }

    expect(harness.providerCalls).toHaveLength(2);
    expect(harness.segments.size).toBe(1);
  });

  it('marks transcription failed on provider timeout without failing the call boundary', async () => {
    const harness = createHarness({
      provider: { transcribe: () => Effect.never },
    });
    await Effect.runPromise(
      harness.application.beginTranscriptionSession(begin()),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: startFrame(),
      }),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: mediaFrame('inbound', '2', 'aa'),
      }),
    );

    await expect(
      Effect.runPromise(
        harness.application.completeTranscriptionSession(begin()),
      ),
    ).resolves.toEqual({ status: 'failed' });
    expect(harness.statuses).toEqual(['processing', 'failed']);
    expect(harness.segments.size).toBe(0);
  });

  it('does not begin provider work when workspace transcription is disabled', async () => {
    const harness = createHarness({ enabled: false });
    await Effect.runPromise(
      harness.application.beginTranscriptionSession(begin()),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: startFrame(),
      }),
    );
    await Effect.runPromise(
      harness.application.processTranscriptionFrame({
        connectionId: 'connection-1',
        frame: mediaFrame('inbound', '2', 'aaaa'),
      }),
    );
    await Effect.runPromise(
      harness.application.completeTranscriptionSession(begin()),
    );
    expect(harness.providerCalls).toHaveLength(0);
    expect(harness.segments.size).toBe(0);
    expect(harness.statuses).toEqual([]);
  });
});
