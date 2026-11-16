import { createHash, randomUUID } from 'node:crypto';
import { DialerInfrastructureError } from '@consuelo/dialer';
import { Effect } from 'effect';
import { createAudioChunker, buildMulawWav, type AudioChunk } from './audio';
import { FairTranscriptionLimiter } from './limiter';
import type {
  TranscriptSegment,
  TranscriptTrack,
  TwilioMediaFrame,
} from './contracts';
import type {
  CallOperationsRepositoryService,
  SpeechToTextProviderService,
  TranscriptionContext,
} from './ports';

export type TranscriptionConfig = {
  model: string;
  chunkBytes: number;
  maxBufferBytesPerTrack: number;
  providerTimeoutMs: number;
  maxConcurrentTranscriptions: number;
  streamUrl?: string;
  parentAccountSid?: string;
  maxSessions?: number;
  overlapBytes?: number;
  vadEnabled?: boolean;
};
type TrackState = {
  chunker: ReturnType<typeof createAudioChunker>;
  pending: AudioChunk[];
  inFlight: Promise<void> | null;
  inFlightBytes: number;
  committedEndMs: number;
};
type TerminalStatus = 'ready' | 'failed' | 'disabled';
type SessionState = {
  connectionId: string;
  streamSid: string | null;
  providerCallId: string | null;
  providerAccountId: string | null;
  context: TranscriptionContext | null;
  declaredTracks: TranscriptTrack[];
  disabled: boolean;
  terminal: boolean;
  failed: boolean;
  failureCode: string | null;
  hadGap: boolean;
  abort: AbortController;
  completion: Promise<{ status: TerminalStatus }> | null;
  tracks: Record<TranscriptTrack, TrackState>;
};
const failure = (operation: string, cause: unknown) =>
  new DialerInfrastructureError({
    operation,
    message: cause instanceof Error ? cause.message : String(cause),
    retryable: true,
    cause,
  });

export const createTranscriptionOperations = (input: {
  repository: CallOperationsRepositoryService;
  speechToTextProvider: SpeechToTextProviderService;
  config: TranscriptionConfig;
}) => {
  const parentAccountSid = input.config.parentAccountSid?.trim() || null;
  const sessions = new Map<string, SessionState>();
  const completed = new Map<string, TerminalStatus>();
  const limiter = new FairTranscriptionLimiter(
    Math.max(1, input.config.maxConcurrentTranscriptions),
    (input.config.maxSessions ?? 100) * 2,
  );
  const createTrack = (): TrackState => ({
    chunker: createAudioChunker({
      maxBytes: input.config.chunkBytes,
      overlapBytes: input.config.overlapBytes,
      vad: input.config.vadEnabled,
    }),
    pending: [],
    inFlight: null,
    inFlightBytes: 0,
    committedEndMs: -1,
  });
  const createSession = (connectionId: string): SessionState => ({
    connectionId,
    streamSid: null,
    providerCallId: null,
    providerAccountId: null,
    context: null,
    declaredTracks: ['inbound', 'outbound'],
    disabled: false,
    terminal: false,
    failed: false,
    failureCode: null,
    hadGap: false,
    abort: new AbortController(),
    completion: null,
    tracks: { inbound: createTrack(), outbound: createTrack() },
  });
  const rememberCompleted = (
    connectionId: string,
    status: TerminalStatus,
  ): void => {
    completed.set(connectionId, status);
    if (completed.size > 1000) {
      const oldest = completed.keys().next().value;
      if (oldest) completed.delete(oldest);
    }
  };
  const markFailed = async (
    session: SessionState,
    failureCode: string,
  ): Promise<void> => {
    if (session.failed) return;
    session.failed = true;
    session.failureCode = failureCode;
    session.abort.abort();
    for (const track of Object.values(session.tracks)) {
      track.chunker.clear();
      track.pending = [];
    }
    if (!session.context || session.disabled) return;
    await Effect.runPromise(
      input.repository.setTranscriptStatus({
        workspaceId: session.context.workspaceId,
        sessionId: session.context.sessionId,
        status: 'failed',
        provider: 'groq',
        model: input.config.model,
        failureCode,
      }),
    ).catch(() => {
      session.failureCode = 'TRANSCRIPT_STATUS_PERSISTENCE_FAILED';
      process.stderr.write(
        JSON.stringify({
          event: 'dialer.transcription.failure',
          code: session.failureCode,
        }) + '\n',
      );
    });
  };
  const sameScope = (
    session: SessionState,
    context: TranscriptionContext | null,
  ): boolean =>
    context?.enabled === true &&
    context.workspaceId === session.context?.workspaceId &&
    context.sessionId === session.context?.sessionId;

  const transcribeTrack = (
    session: SessionState,
    trackName: TranscriptTrack,
  ): Promise<void> => {
    const track = session.tracks[trackName];
    if (track.inFlight) return track.inFlight;
    if (
      session.failed ||
      session.disabled ||
      !session.context ||
      !session.providerCallId
    )
      return Promise.resolve();
    const operation = (async () => {
      try {
        while (track.pending.length && !session.failed && !session.disabled) {
          const claimed = track.pending.shift();
          if (!claimed) break;
          if (claimed.gapBefore) session.hadGap = true;
          track.inFlightBytes = claimed.audio.byteLength;
          const signal = AbortSignal.any([
            session.abort.signal,
            AbortSignal.timeout(input.config.providerTimeoutMs),
          ]);
          const queuedAtMs = performance.now();
          let providerStartedMs = queuedAtMs;
          let queueMs = 0;
          const result = await limiter.run(
            session.context!.workspaceId + ':' + session.context!.sessionId,
            signal,
            async () => {
              try {
                queueMs = performance.now() - queuedAtMs;
                if (session.failed || signal.aborted)
                  throw new Error('transcription cancelled');
                const fresh = await Effect.runPromise(
                  input.repository.resolveTranscriptionContext(
                    session.providerCallId!,
                  ),
                );
                if (!sameScope(session, fresh)) {
                  session.disabled = true;
                  throw new Error('transcription consent revoked');
                }
                providerStartedMs = performance.now();
                return Effect.runPromise(
                  input.speechToTextProvider
                    .transcribe({
                      audio: buildMulawWav(claimed.audio),
                      encoding: 'audio/wav',
                      track: trackName,
                      model: input.config.model,
                      signal,
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
                  { signal },
                );
              } catch (cause: unknown) {
                throw failure('transcription-operation', cause);
              }
            },
          );
          const providerMs = performance.now() - providerStartedMs;
          if (session.failed || session.disabled) break;
          const current = await Effect.runPromise(
            input.repository.resolveTranscriptionContext(
              session.providerCallId!,
            ),
          );
          if (!sameScope(session, current)) {
            session.disabled = true;
            session.abort.abort();
            break;
          }
          const context = session.context!;
          const duration = claimed.endMs - claimed.startMs;
          const validTiming = (start: number, end: number) =>
            Number.isFinite(start) &&
            Number.isFinite(end) &&
            start >= 0 &&
            end >= start &&
            end <= duration + 1;
          const words = (result.words ?? [])
            .filter(
              (word) =>
                validTiming(word.startMs, word.endMs) &&
                claimed.startMs + word.endMs > track.committedEndMs,
            )
            .map((word) => ({
              ...word,
              startMs: Math.round(claimed.startMs + word.startMs),
              endMs: Math.round(claimed.startMs + word.endMs),
            }));
          const speechSegments = (result.segments ?? [])
            .filter(
              (segment) =>
                validTiming(segment.startMs, segment.endMs) &&
                claimed.startMs + segment.endMs > track.committedEndMs,
            )
            .map((segment) => ({
              ...segment,
              startMs: Math.round(claimed.startMs + segment.startMs),
              endMs: Math.round(claimed.startMs + segment.endMs),
            }));
          if (claimed.overlapMs > 0 && !Array.isArray(result.words))
            throw new Error('provider word timing unavailable for overlap');
          const text = (
            Array.isArray(result.words)
              ? words.map((word) => word.text).join(' ')
              : result.text
          ).trim();
          if (!text) {
            track.committedEndMs = Math.max(
              track.committedEndMs,
              claimed.endMs,
            );
            continue;
          }
          const explicit =
            result.startMs != null &&
            result.endMs != null &&
            validTiming(result.startMs, result.endMs);
          const startMs =
            words[0]?.startMs ??
            speechSegments[0]?.startMs ??
            (explicit ? Math.round(claimed.startMs + result.startMs!) : null);
          const endMs =
            words.at(-1)?.endMs ??
            speechSegments.at(-1)?.endMs ??
            (explicit ? Math.round(claimed.startMs + result.endMs!) : null);
          const digest = createHash('sha256')
            .update(claimed.audio.subarray(Math.round(claimed.overlapMs * 8)))
            .digest('hex');
          const idempotencyKey = [
            context.sessionId,
            session.providerCallId,
            trackName,
            claimed.startMs + claimed.overlapMs,
            claimed.endMs,
            digest,
          ].join(':');
          const segment: TranscriptSegment = {
            id: randomUUID(),
            workspaceId: context.workspaceId,
            sessionId: context.sessionId,
            providerCallId: session.providerCallId!,
            sequence: Number(claimed.sequenceStart),
            idempotencyKey,
            track: trackName,
            speaker: context.trackRoles?.[trackName] ?? 'unknown',
            text,
            startMs,
            endMs,
            language: result.language ?? context.language,
            confidence: result.confidence ?? null,
            provider: 'groq',
            model: input.config.model,
            createdAt: new Date().toISOString(),
            metadata: {
              schemaVersion: 1,
              sourceAudioStartMs: Math.round(claimed.startMs),
              sourceAudioEndMs: Math.round(claimed.endMs),
              streamSid: session.streamSid!,
              timingBasis: words.length
                ? 'provider-words'
                : speechSegments.length
                  ? 'provider-segments'
                  : explicit
                    ? 'provider'
                    : 'unavailable',
              speakerProvenance: context.trackRoles?.[trackName]
                ? 'authenticated-leg'
                : 'unknown',
              words,
              speechSegments,
              latency: {
                bufferedAudioMs:
                  claimed.endMs - claimed.startMs - claimed.overlapMs,
                queueMs,
                providerMs,
              },
              ...(claimed.gapBefore ? { gapBefore: claimed.gapBefore } : {}),
            },
          };
          await Effect.runPromise(
            input.repository.appendTranscriptSegment(segment),
          );
          track.committedEndMs = Math.max(track.committedEndMs, claimed.endMs);
        }
      } catch (cause: unknown) {
        throw failure('transcription-operation', cause);
      }
    })()
      .catch((cause: unknown) =>
        markFailed(
          session,
          cause instanceof Error &&
            /timed out|Timeout|aborted/.test(cause.message)
            ? 'PROVIDER_TIMEOUT'
            : 'PROVIDER_FAILURE',
        ),
      )
      .finally(() => {
        track.inFlight = null;
        track.inFlightBytes = 0;
      });
    track.inFlight = operation;
    return operation;
  };
  const start = (session: SessionState, frame: TwilioMediaFrame) =>
    Effect.gen(function* () {
      if (frame.event !== 'start' || session.terminal || session.streamSid)
        return { accepted: false };
      const providerCallId = frame.start.callSid;
      if (
        frame.start.streamSid !== frame.streamSid ||
        (frame.start.customParameters.callId &&
          frame.start.customParameters.callId !== providerCallId)
      )
        return { accepted: false };
      const context =
        yield* input.repository.resolveTranscriptionContext(providerCallId);
      if (session.terminal || session.failed) return { accepted: false };
      // Legacy null ownership resolves only to this runtime's configured parent.
      const providerAccountId = context?.providerAccountId ?? parentAccountSid;
      if (
        !context ||
        (frame.start.customParameters.sessionId &&
          frame.start.customParameters.sessionId !== context.sessionId) ||
        !providerAccountId ||
        frame.start.accountSid !== providerAccountId
      )
        return { accepted: false };
      session.streamSid = frame.streamSid;
      session.providerCallId = providerCallId;
      session.providerAccountId = providerAccountId;
      session.context = context;
      session.declaredTracks = frame.start.tracks ?? ['inbound', 'outbound'];
      session.disabled = !context.enabled;
      if (context.enabled)
        yield* input.repository.setTranscriptStatus({
          workspaceId: context.workspaceId,
          sessionId: context.sessionId,
          status: 'processing',
          provider: 'groq',
          model: input.config.model,
          language: context.language,
        });
      return { accepted: true };
    });
  const media = (session: SessionState, frame: TwilioMediaFrame) =>
    Effect.tryPromise({
      try: async () => {
        try {
          if (session.disabled) return { accepted: true };
          if (
            frame.event !== 'media' ||
            session.terminal ||
            session.failed ||
            !session.context ||
            !session.providerCallId
          )
            return { accepted: false };
          if (
            frame.streamSid !== session.streamSid ||
            !session.declaredTracks.includes(frame.media.track)
          )
            return { accepted: false };
          const audio = Buffer.from(frame.media.payload, 'base64');
          const track = session.tracks[frame.media.track];
          const buffered =
            track.chunker.bufferedBytes +
            track.inFlightBytes +
            track.pending.reduce((n, chunk) => n + chunk.audio.length, 0);
          if (
            !audio.length ||
            buffered + audio.length > input.config.maxBufferBytesPerTrack
          ) {
            await markFailed(session, 'BACKPRESSURE_LIMIT');
            return { accepted: false };
          }
          track.pending.push(
            ...track.chunker.push({
              audio,
              timestampMs: Number(frame.media.timestamp),
              sequence: frame.media.chunk,
            }),
          );
          if (
            track.chunker.bufferedBytes +
              track.inFlightBytes +
              track.pending.reduce((n, chunk) => n + chunk.audio.length, 0) >
            input.config.maxBufferBytesPerTrack
          ) {
            await markFailed(session, 'BACKPRESSURE_LIMIT');
            return { accepted: false };
          }
          if (track.pending.length && !track.inFlight)
            void transcribeTrack(session, frame.media.track);
          return { accepted: true };
        } catch (cause: unknown) {
          throw failure('transcription-operation', cause);
        }
      },
      catch: (cause) => failure('process-transcription-frame', cause),
    });
  const complete = (connectionId: string) =>
    Effect.tryPromise({
      try: async () => {
        try {
          const previous = completed.get(connectionId);
          if (previous) return { status: previous };
          const session = sessions.get(connectionId);
          if (!session) return { status: 'failed' as const };
          if (session.completion) return session.completion;
          session.terminal = true;
          session.completion = (async (): Promise<{
            status: TerminalStatus;
          }> => {
            try {
              if (!session.disabled && session.context && !session.failed) {
                for (const track of Object.values(session.tracks))
                  track.pending.push(...track.chunker.flush());
                await Promise.all([
                  transcribeTrack(session, 'inbound'),
                  transcribeTrack(session, 'outbound'),
                ]);
              }
              const status: TerminalStatus =
                session.disabled || !session.context
                  ? 'disabled'
                  : session.failed
                    ? 'failed'
                    : 'ready';
              if (status === 'ready' && session.context)
                await Effect.runPromise(
                  input.repository.setTranscriptStatus({
                    workspaceId: session.context.workspaceId,
                    sessionId: session.context.sessionId,
                    status: 'ready',
                    provider: 'groq',
                    model: input.config.model,
                    language: session.context.language,
                    ...(session.hadGap ? { failureCode: 'MEDIA_GAP' } : {}),
                  }),
                );
              rememberCompleted(connectionId, status);
              return { status };
            } catch {
              await markFailed(session, 'TRANSCRIPT_COMPLETION_FAILED');
              rememberCompleted(connectionId, 'failed');
              return { status: 'failed' };
            } finally {
              sessions.delete(connectionId);
              session.abort.abort();
            }
          })();
          return session.completion;
        } catch (cause: unknown) {
          throw failure('transcription-operation', cause);
        }
      },
      catch: (cause) => failure('complete-transcription-session', cause),
    });
  return {
    beginTranscriptionSession: ({ connectionId }: { connectionId: string }) =>
      Effect.try({
        try: () => {
          if (!sessions.has(connectionId) && !completed.has(connectionId)) {
            if (sessions.size >= (input.config.maxSessions ?? 100))
              throw new Error('transcription session capacity reached');
            sessions.set(connectionId, createSession(connectionId));
          }
          return { status: 'pending' as const };
        },
        catch: (cause) => failure('begin-transcription-session', cause),
      }),
    processTranscriptionFrame: ({
      connectionId,
      frame,
    }: {
      connectionId: string;
      frame: TwilioMediaFrame;
    }) => {
      const session = sessions.get(connectionId);
      if (!session) return Effect.succeed({ accepted: false });
      if (frame.event === 'connected')
        return Effect.succeed({ accepted: true });
      if (frame.event === 'start') return start(session, frame);
      if (frame.event === 'stop') {
        if (
          frame.streamSid !== session.streamSid ||
          frame.stop.callSid !== session.providerCallId ||
          !session.providerAccountId ||
          frame.stop.accountSid !== session.providerAccountId
        )
          return Effect.succeed({ accepted: false });
        return complete(connectionId).pipe(
          Effect.map(() => ({ accepted: true })),
        );
      }
      return media(session, frame);
    },
    completeTranscriptionSession: ({
      connectionId,
    }: {
      connectionId: string;
    }) => complete(connectionId),
    failTranscriptionSession: ({
      connectionId,
      failureCode,
    }: {
      connectionId: string;
      failureCode: string;
    }) =>
      Effect.tryPromise({
        try: async () => {
          try {
            const session = sessions.get(connectionId);
            if (session) {
              session.terminal = true;
              await markFailed(session, failureCode);
              await Promise.all(
                Object.values(session.tracks).map((track) => track.inFlight),
              );
              sessions.delete(connectionId);
            }
            rememberCompleted(connectionId, 'failed');
            return { status: 'failed' as const };
          } catch (cause: unknown) {
            throw failure('transcription-operation', cause);
          }
        },
        catch: (cause) => failure('fail-transcription-session', cause),
      }),
  };
};
