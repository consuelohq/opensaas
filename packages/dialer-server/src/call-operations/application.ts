import { randomUUID } from 'node:crypto';

import {
  DialerInfrastructureError,
  DialerNotFoundError,
} from '@consuelo/dialer';
import { Effect } from 'effect';

import type {
  CallLegTransition,
  CallSessionUpsert,
  TranscriptSegment,
  TranscriptStatus,
  TranscriptTrack,
  TwilioMediaFrame,
} from './contracts';
import type {
  CallOperationsRepositoryService,
  SpeechToTextProviderService,
  TranscriptionContext,
} from './ports';

export type {
  CallDetail,
  CallLegSummary,
  CallSessionSummary,
  TranscriptSegment,
  TranscriptStatus,
  TranscriptTrack,
  TwilioMediaFrame,
} from './contracts';
export type {
  CallOperationsRepositoryService,
  SpeechToTextProviderService,
} from './ports';

type TranscriptionConfig = {
  model: string;
  chunkBytes: number;
  maxBufferBytesPerTrack: number;
  providerTimeoutMs: number;
  maxConcurrentTranscriptions: number;
  streamUrl?: string;
  maxSessions?: number;
};

type TrackState = {
  chunks: Uint8Array[];
  bytes: number;
  sequenceStart: string | null;
  sequenceEnd: string | null;
  timestampStartMs: number | null;
  timestampEndMs: number | null;
  inFlight: Promise<void> | null;
  inFlightBytes: number;
};

type SessionState = {
  connectionId: string;
  streamSid: string | null;
  providerCallId: string | null;
  context: TranscriptionContext | null;
  disabled: boolean;
  terminal: boolean;
  failed: boolean;
  failureCode: string | null;
  seenSequences: Set<string>;
  tracks: Record<TranscriptTrack, TrackState>;
};

type TerminalStatus = 'ready' | 'failed' | 'disabled';

const createTrackState = (): TrackState => ({
  chunks: [],
  bytes: 0,
  sequenceStart: null,
  sequenceEnd: null,
  timestampStartMs: null,
  timestampEndMs: null,
  inFlight: null,
  inFlightBytes: 0,
});

const createSessionState = (connectionId: string): SessionState => ({
  connectionId,
  streamSid: null,
  providerCallId: null,
  context: null,
  disabled: false,
  terminal: false,
  failed: false,
  failureCode: null,
  seenSequences: new Set(),
  tracks: {
    inbound: createTrackState(),
    outbound: createTrackState(),
  },
});

const concatChunks = (chunks: Uint8Array[]): Uint8Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
};

export const buildMulawWav = (audio: Uint8Array): Uint8Array => {
  const header = Buffer.alloc(46);
  const sampleRate = 8_000;
  const channels = 1;
  const bitsPerSample = 8;
  header.write('RIFF', 0);
  header.writeUInt32LE(38 + audio.byteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16);
  header.writeUInt16LE(7, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels, 28);
  header.writeUInt16LE(channels, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.writeUInt16LE(0, 36);
  header.write('data', 38);
  header.writeUInt32LE(audio.byteLength, 42);
  const wav = new Uint8Array(header.byteLength + audio.byteLength);
  wav.set(header, 0);
  wav.set(audio, header.byteLength);
  return wav;
};

const effectFailure = (operation: string, cause: unknown) =>
  new DialerInfrastructureError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    retryable: true,
    cause,
  });

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

class AsyncLimiter {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.waiting.shift()?.();
    }
  }
}

export const createCallOperationsApplication = (input: {
  repository: CallOperationsRepositoryService;
  speechToTextProvider: SpeechToTextProviderService;
  config: TranscriptionConfig;
}) => {
  const sessions = new Map<string, SessionState>();
  const completed = new Map<string, TerminalStatus>();
  const limiter = new AsyncLimiter(
    Math.max(1, input.config.maxConcurrentTranscriptions),
  );

  const rememberCompleted = (
    connectionId: string,
    status: TerminalStatus,
  ): void => {
    completed.set(connectionId, status);
    if (completed.size > 1_000) {
      const oldest = completed.keys().next().value;
      if (oldest) completed.delete(oldest);
    }
  };

  const markFailed = (
    session: SessionState,
    failureCode: string,
  ): Promise<void> => {
    if (session.failed) return Promise.resolve();
    session.failed = true;
    session.failureCode = failureCode;
    for (const track of Object.values(session.tracks)) {
      track.chunks = [];
      track.bytes = 0;
    }
    if (!session.context) return Promise.resolve();
    return Effect.runPromise(
      input.repository.setTranscriptStatus({
        workspaceId: session.context.workspaceId,
        sessionId: session.context.sessionId,
        status: 'failed',
        provider: 'groq',
        model: input.config.model,
        failureCode,
      }),
    );
  };

  const takeAudio = (
    track: TrackState,
    force: boolean,
  ): {
    audio: Uint8Array;
    sequenceStart: string;
    sequenceEnd: string;
    timestampStartMs: number;
    timestampEndMs: number;
  } | null => {
    if (track.bytes === 0 || (!force && track.bytes < input.config.chunkBytes))
      return null;
    const audio = concatChunks(track.chunks);
    const sequenceStart = track.sequenceStart ?? '0';
    const sequenceEnd = track.sequenceEnd ?? sequenceStart;
    const timestampStartMs = track.timestampStartMs ?? 0;
    const timestampEndMs = track.timestampEndMs ?? timestampStartMs;
    track.chunks = [];
    track.bytes = 0;
    track.sequenceStart = null;
    track.sequenceEnd = null;
    track.timestampStartMs = null;
    track.timestampEndMs = null;
    return {
      audio,
      sequenceStart,
      sequenceEnd,
      timestampStartMs,
      timestampEndMs,
    };
  };

  const transcribeTrack = (
    session: SessionState,
    trackName: TranscriptTrack,
    force: boolean,
  ): Promise<void> => {
    const track = session.tracks[trackName];
    if (track.inFlight) {
      return track.inFlight.then(() =>
        session.failed ? undefined : transcribeTrack(session, trackName, force),
      );
    }
    if (!session.context || !session.providerCallId || session.disabled)
      return Promise.resolve();
    const claimed = takeAudio(track, force);
    if (!claimed) return Promise.resolve();
    const operation = limiter
      .run(() =>
        Effect.runPromise(
          input.speechToTextProvider
            .transcribe({
              audio: buildMulawWav(claimed.audio),
              encoding: 'audio/wav',
              track: trackName,
              model: input.config.model,
              ...(session.context?.language
                ? { language: session.context.language }
                : {}),
            })
            .pipe(
              Effect.timeoutFail({
                duration: input.config.providerTimeoutMs,
                onTimeout: () => new Error('speech provider timed out'),
              }),
            ),
        ),
      )
      .then((result) => {
        if (session.failed) return;
        const text = result.text.trim();
        if (!text || !session.context || !session.providerCallId) return;
        const idempotencyKey = [
          session.context.sessionId,
          session.providerCallId,
          trackName,
          claimed.sequenceStart,
          claimed.sequenceEnd,
        ].join(':');
        const segment: TranscriptSegment = {
          id: randomUUID(),
          workspaceId: session.context.workspaceId,
          sessionId: session.context.sessionId,
          providerCallId: session.providerCallId,
          sequence: Number.parseInt(claimed.sequenceStart, 10) || 0,
          idempotencyKey,
          track: trackName,
          speaker: trackName,
          text,
          startMs: claimed.timestampStartMs + Math.max(0, result.startMs ?? 0),
          endMs:
            result.endMs === null || result.endMs === undefined
              ? claimed.timestampEndMs
              : claimed.timestampStartMs + Math.max(0, result.endMs),
          language: result.language ?? session.context.language,
          confidence: result.confidence ?? null,
          provider: 'groq',
          model: input.config.model,
          createdAt: new Date().toISOString(),
        };
        return Effect.runPromise(
          input.repository.appendTranscriptSegment(segment),
        ).then(() => undefined);
      })
      .catch((cause: unknown) =>
        markFailed(
          session,
          cause instanceof Error && cause.message.includes('timed out')
            ? 'PROVIDER_TIMEOUT'
            : 'PROVIDER_FAILURE',
        ),
      )
      .finally(() => {
        track.inFlight = null;
        track.inFlightBytes = 0;
      });
    track.inFlightBytes = claimed.audio.byteLength;
    track.inFlight = operation;
    return operation.then(() =>
      !session.failed && track.bytes >= input.config.chunkBytes
        ? transcribeTrack(session, trackName, force)
        : undefined,
    );
  };

  const startSession = (session: SessionState, frame: TwilioMediaFrame) =>
    Effect.gen(function* () {
      if (frame.event !== 'start' || session.terminal)
        return { accepted: false };
      const providerCallId =
        frame.start.customParameters.callId || frame.start.callSid;
      const sessionId = frame.start.customParameters.sessionId;
      const context = sessionId
        ? yield* input.repository.resolveTranscriptionContextForSession(
            sessionId,
          )
        : yield* input.repository.resolveTranscriptionContext(providerCallId);
      session.streamSid = frame.start.streamSid;
      session.providerCallId = providerCallId;
      session.context = context;
      session.disabled = !context?.enabled;
      if (context?.enabled) {
        yield* input.repository.setTranscriptStatus({
          workspaceId: context.workspaceId,
          sessionId: context.sessionId,
          status: 'processing',
          provider: 'groq',
          model: input.config.model,
          language: context.language,
        });
      }
      return { accepted: true };
    });

  const processMedia = (session: SessionState, frame: TwilioMediaFrame) =>
    Effect.tryPromise({
      try: () => {
        if (
          frame.event !== 'media' ||
          session.terminal ||
          session.disabled ||
          session.failed
        ) {
          return Promise.resolve({ accepted: false });
        }
        if (!session.context || !session.providerCallId)
          return Promise.resolve({ accepted: false });
        const dedupeKey = `${frame.streamSid}:${frame.sequenceNumber}`;
        if (session.seenSequences.has(dedupeKey))
          return Promise.resolve({ accepted: true });
        session.seenSequences.add(dedupeKey);
        if (session.seenSequences.size > 20_000) {
          const oldest = session.seenSequences.values().next().value;
          if (oldest) session.seenSequences.delete(oldest);
        }
        const audio = Buffer.from(frame.media.payload, 'base64');
        const track = session.tracks[frame.media.track];
        if (
          audio.byteLength === 0 ||
          track.bytes + track.inFlightBytes + audio.byteLength >
            input.config.maxBufferBytesPerTrack
        ) {
          return markFailed(session, 'BACKPRESSURE_LIMIT').then(() => ({
            accepted: false,
          }));
        }
        track.chunks.push(audio);
        track.bytes += audio.byteLength;
        track.sequenceStart ??= frame.sequenceNumber;
        track.sequenceEnd = frame.sequenceNumber;
        const timestampMs = Number.parseInt(frame.media.timestamp, 10);
        track.timestampStartMs ??= timestampMs;
        track.timestampEndMs = timestampMs;
        if (track.bytes >= input.config.chunkBytes && !track.inFlight) {
          void transcribeTrack(session, frame.media.track, false).catch(
            () => undefined,
          );
        }
        return Promise.resolve({ accepted: true });
      },
      catch: (cause) => effectFailure('process-transcription-frame', cause),
    });

  const complete = (connectionId: string) =>
    Effect.tryPromise({
      try: () => {
        const previous = completed.get(connectionId);
        if (previous) return Promise.resolve({ status: previous });
        const session = sessions.get(connectionId);
        if (!session) return Promise.resolve({ status: 'failed' as const });
        session.terminal = true;
        if (session.disabled || !session.context) {
          sessions.delete(connectionId);
          rememberCompleted(connectionId, 'disabled');
          return Promise.resolve({ status: 'disabled' as const });
        }
        const context = session.context;
        return Promise.all([
          transcribeTrack(session, 'inbound', true),
          transcribeTrack(session, 'outbound', true),
        ]).then((): Promise<{ status: TerminalStatus }> => {
          if (session.failed) {
            sessions.delete(connectionId);
            rememberCompleted(connectionId, 'failed');
            return Promise.resolve({ status: 'failed' });
          }
          return Effect.runPromise(
            input.repository.setTranscriptStatus({
              workspaceId: context.workspaceId,
              sessionId: context.sessionId,
              status: 'ready',
              provider: 'groq',
              model: input.config.model,
              language: context.language,
            }),
          ).then(() => {
            sessions.delete(connectionId);
            rememberCompleted(connectionId, 'ready');
            return { status: 'ready' as const };
          });
        });
      },
      catch: (cause) => effectFailure('complete-transcription-session', cause),
    });

  return {
    beginTranscriptionSession: ({ connectionId }: { connectionId: string }) =>
      Effect.try({
        try: () => {
          if (!sessions.has(connectionId) && !completed.has(connectionId)) {
            if (sessions.size >= (input.config.maxSessions ?? 100)) {
              throw effectFailure(
                'begin-transcription-session',
                new Error('transcription session capacity reached'),
              );
            }
            sessions.set(connectionId, createSessionState(connectionId));
          }
          return { status: 'pending' as const };
        },
        catch: (cause) =>
          cause instanceof DialerInfrastructureError
            ? cause
            : effectFailure('begin-transcription-session', cause),
      }),
    processTranscriptionFrame: (request: {
      connectionId: string;
      frame: TwilioMediaFrame;
    }) => {
      const session = sessions.get(request.connectionId);
      if (!session) return Effect.succeed({ accepted: false });
      if (request.frame.event === 'start')
        return startSession(session, request.frame);
      if (request.frame.event === 'stop')
        return complete(request.connectionId).pipe(
          Effect.map(() => ({ accepted: true })),
        );
      return processMedia(session, request.frame);
    },
    completeTranscriptionSession: ({
      connectionId,
    }: {
      connectionId: string;
    }) => complete(connectionId),
    failTranscriptionSession: (request: {
      connectionId: string;
      failureCode: string;
    }) =>
      Effect.tryPromise({
        try: () => {
          const session = sessions.get(request.connectionId);
          if (!session) {
            rememberCompleted(request.connectionId, 'failed');
            return Promise.resolve({ status: 'failed' as const });
          }
          session.terminal = true;
          return markFailed(session, request.failureCode).then(() => {
            sessions.delete(request.connectionId);
            rememberCompleted(request.connectionId, 'failed');
            return { status: 'failed' as const };
          });
        },
        catch: (cause) => effectFailure('fail-transcription-session', cause),
      }),
    createOrUpdateCallSession: (request: CallSessionUpsert) =>
      input.repository.createOrUpdateCallSession(request),
    recordCallLegTransition: (request: CallLegTransition) =>
      input.repository.recordCallLegTransition(request),
    listActiveCalls: (request: { workspaceId: string }) =>
      input.repository.listActiveCalls(request),
    listCallHistory: (request: {
      workspaceId: string;
      status?: string;
      cursor?: string;
      limit: number;
    }) => input.repository.listCallHistory(request),
    getCallDetail: (request: { workspaceId: string; callId: string }) =>
      input.repository.getCallDetail(request).pipe(
        Effect.flatMap((detail) =>
          detail
            ? Effect.succeed(detail)
            : Effect.fail(
                new DialerNotFoundError({
                  code: 'NOT_FOUND',
                  message: 'Call not found',
                  retryable: false,
                }),
              ),
        ),
      ),
    getCallTranscript: (request: { workspaceId: string; callId: string }) =>
      input.repository.getCallTranscript(request),
    recordDisposition: (request: {
      workspaceId: string;
      sessionId: string;
      disposition: string;
      note?: string;
      tags?: string[];
    }) => input.repository.recordDisposition(request),
    setCrmSyncStatus: (request: {
      workspaceId: string;
      sessionId: string;
      status: 'synced' | 'failed';
      errorCode?: string;
    }) => input.repository.setCrmSyncStatus(request),
    claimCallRecording: (request: { providerCallId: string }) =>
      input.repository.claimCallRecording(request),
    setCallRecordingStarted: (request: {
      workspaceId: string;
      sessionId: string;
      recordingSid: string;
      status: string;
    }) => input.repository.setCallRecordingStarted(request),
    setCallRecordingFailed: (request: {
      workspaceId: string;
      sessionId: string;
      failureCode: string;
    }) => input.repository.setCallRecordingFailed(request),
    recordCallRecordingStatus: (request: {
      providerCallId: string;
      recordingSid: string;
      recordingStatus: string;
      recordingUrl?: string;
      recordingDurationSeconds?: number;
    }) => input.repository.recordCallRecordingStatus(request),
    attachTranscriptionStream: (request: {
      providerCallId: string;
      twiml: string;
      workspaceId?: string;
      sessionId?: string;
    }) =>
      Effect.gen(function* () {
        if (!input.config.streamUrl) return request.twiml;
        let context: TranscriptionContext | null;
        if (request.workspaceId && request.sessionId) {
          const settings = yield* input.repository.resolveTranscriptionSettings(
            request.workspaceId,
          );
          context = {
            workspaceId: request.workspaceId,
            sessionId: request.sessionId,
            ...settings,
          };
        } else {
          context = yield* input.repository.resolveTranscriptionContext(
            request.providerCallId,
          );
        }
        if (!context?.enabled || !request.twiml.includes('<Response>')) {
          return request.twiml;
        }
        const stream = [
          '<Start>',
          `<Stream url="${escapeXml(input.config.streamUrl)}" track="both_tracks">`,
          `<Parameter name="callId" value="${escapeXml(request.providerCallId)}" />`,
          `<Parameter name="sessionId" value="${escapeXml(context.sessionId)}" />`,
          '</Stream>',
          '</Start>',
        ].join('');
        return request.twiml.replace('<Response>', `<Response>${stream}`);
      }),
  };
};
