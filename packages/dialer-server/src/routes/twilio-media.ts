import { randomUUID } from 'node:crypto';

import { Effect } from 'effect';
import { Hono, type Context } from 'hono';
import { upgradeWebSocket } from 'hono/bun';

import type { TwilioMediaFrame } from '../call-operations/contracts';
import type { DialerServerDependencies } from '../contracts';
import { verifyAndParseTwilioRequest } from '../middleware/twilio';

type CallOperationsApplication = NonNullable<
  DialerServerDependencies['callOperations']
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isUnsignedInteger = (value: string): boolean => {
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number);
};

const isBase64 = (value: string): boolean =>
  value.length > 0 &&
  value.length <= 16_384 &&
  value.length % 4 === 0 &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(value);

export const parseTwilioMediaFrame = (
  candidate: unknown,
): TwilioMediaFrame | null => {
  if (!isRecord(candidate)) return null;
  const event = candidate.event;
  if (event === 'connected') {
    return candidate.protocol === 'Call' && candidate.version === '1.0.0'
      ? { event, protocol: 'Call', version: '1.0.0' }
      : null;
  }
  const sequenceNumber = candidate.sequenceNumber;
  const streamSid = candidate.streamSid;
  if (
    !isString(event) ||
    !isString(sequenceNumber) ||
    !isUnsignedInteger(sequenceNumber) ||
    !isString(streamSid)
  ) {
    return null;
  }
  if (event === 'start') {
    const start = candidate.start;
    if (
      !isRecord(start) ||
      !isString(start.streamSid) ||
      !isString(start.callSid) ||
      !isString(start.accountSid) ||
      start.streamSid !== streamSid ||
      !Array.isArray(start.tracks) ||
      start.tracks.length === 0 ||
      start.tracks.some(
        (track) => track !== 'inbound' && track !== 'outbound',
      ) ||
      !isRecord(start.mediaFormat) ||
      start.mediaFormat.encoding !== 'audio/x-mulaw' ||
      start.mediaFormat.sampleRate !== 8000 ||
      start.mediaFormat.channels !== 1 ||
      !isRecord(start.customParameters)
    ) {
      return null;
    }
    const customParameters = Object.fromEntries(
      Object.entries(start.customParameters).filter(
        (entry): entry is [string, string] => isString(entry[1]),
      ),
    );
    return {
      event,
      sequenceNumber,
      streamSid,
      start: {
        streamSid: start.streamSid,
        callSid: start.callSid,
        accountSid: start.accountSid,
        tracks: start.tracks as Array<'inbound' | 'outbound'>,
        mediaFormat: {
          encoding: 'audio/x-mulaw',
          sampleRate: 8000,
          channels: 1,
        },
        customParameters,
      },
    };
  }
  if (event === 'media') {
    const media = candidate.media;
    if (
      !isRecord(media) ||
      (media.track !== 'inbound' && media.track !== 'outbound') ||
      !isString(media.chunk) ||
      !isString(media.timestamp) ||
      !isUnsignedInteger(media.chunk) ||
      !isUnsignedInteger(media.timestamp) ||
      !isString(media.payload) ||
      !isBase64(media.payload)
    ) {
      return null;
    }
    return {
      event,
      sequenceNumber,
      streamSid,
      media: {
        track: media.track,
        chunk: media.chunk,
        timestamp: media.timestamp,
        payload: media.payload,
      },
    };
  }
  if (event === 'stop') {
    const stop = candidate.stop;
    if (!isRecord(stop) || !isString(stop.callSid)) return null;
    return {
      event,
      sequenceNumber,
      streamSid,
      stop: {
        callSid: stop.callSid,
        ...(isString(stop.accountSid) ? { accountSid: stop.accountSid } : {}),
      },
    };
  }
  return null;
};

const runBoundaryEffect = async (effect: Effect.Effect<unknown, unknown>) => {
  return Effect.runPromise(effect);
};

export const createTwilioMediaConnectionHandlers = (input: {
  connectionId: string;
  expectedCallSid?: string;
  application: Pick<
    CallOperationsApplication,
    | 'beginTranscriptionSession'
    | 'processTranscriptionFrame'
    | 'completeTranscriptionSession'
    | 'failTranscriptionSession'
  >;
}) => {
  let terminal = false;
  let finished = false;
  let failed = false;
  let started = false;
  let connected = false;
  let queue = Promise.resolve();
  let queuedBytes = 0;
  let queuedFrames = 0;
  let overloaded = false;
  const serialize = (operation: () => Promise<void>) => {
    const pending = queue.then(operation);
    queue = pending.catch(() => undefined);
    return pending;
  };

  const fail = async (failureCode: string) => {
    if (failed || finished) return;
    failed = true;
    terminal = true;
    await runBoundaryEffect(
      input.application.failTranscriptionSession({
        connectionId: input.connectionId,
        failureCode,
      }),
    ).catch(() => undefined);
  };

  return {
    open: () =>
      serialize(async () => {
        await runBoundaryEffect(
          input.application.beginTranscriptionSession({
            connectionId: input.connectionId,
          }),
        );
      }),
    message: (rawMessage: string) => {
      if (terminal || overloaded) return Promise.resolve();
      if (rawMessage.length > 65_536) return fail('MEDIA_FRAME_TOO_LARGE');
      queuedBytes += rawMessage.length;
      queuedFrames += 1;
      if (queuedBytes > 1_048_576 || queuedFrames > 256) {
        queuedBytes -= rawMessage.length;
        queuedFrames -= 1;
        overloaded = true;
        return fail('MEDIA_BACKPRESSURE_LIMIT');
      }
      return serialize(async () => {
        queuedBytes -= rawMessage.length;
        queuedFrames -= 1;
        if (terminal) return;
        if (rawMessage.length > 65_536) {
          await fail('MEDIA_FRAME_TOO_LARGE');
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawMessage);
        } catch {
          await fail('INVALID_MEDIA_FRAME');
          return;
        }
        const frame = parseTwilioMediaFrame(parsed);
        if (!frame) {
          await fail('INVALID_MEDIA_FRAME');
          return;
        }
        if (frame.event === 'connected') {
          if (connected || started) await fail('INVALID_MEDIA_PROTOCOL_ORDER');
          connected = true;
          return;
        }
        if (frame.event === 'start') {
          if (started) {
            await fail('DUPLICATE_MEDIA_START');
            return;
          }
          started = true;
        } else if (!started) {
          await fail('MEDIA_BEFORE_START');
          return;
        }
        if (
          input.expectedCallSid &&
          ((frame.event === 'start' &&
            (frame.start.callSid !== input.expectedCallSid ||
              (frame.start.customParameters.callId != null &&
                frame.start.customParameters.callId !==
                  input.expectedCallSid))) ||
            (frame.event === 'stop' &&
              frame.stop.callSid !== input.expectedCallSid))
        ) {
          await fail('MEDIA_START_CALL_MISMATCH');
          return;
        }
        const isStop = frame.event === 'stop';
        if (isStop) terminal = true;
        try {
          const result = await runBoundaryEffect(
            input.application.processTranscriptionFrame({
              connectionId: input.connectionId,
              frame,
            }),
          );
          if (isRecord(result) && result.accepted === false) {
            await fail('MEDIA_FRAME_REJECTED');
          }
          if (isStop && !failed) finished = true;
        } catch {
          await fail('MEDIA_FRAME_PROCESSING_FAILED');
        }
      });
    },
    close: () =>
      serialize(() => {
        if (terminal) return Promise.resolve();
        terminal = true;
        return runBoundaryEffect(
          input.application.completeTranscriptionSession({
            connectionId: input.connectionId,
          }),
        ).then(() => {
          finished = true;
        });
      }),
    error: () => fail('MEDIA_STREAM_ERROR'),
  };
};

export const createTwilioMediaRoutes = (
  dependencies: Pick<
    DialerServerDependencies,
    'callOperations' | 'verifyTwilioSignature'
  >,
) => {
  const routes = new Hono();

  const handleMediaUpgrade = async (context: Context) => {
    const verified = await verifyAndParseTwilioRequest(context, dependencies);
    if (verified instanceof Response) return verified;
    if (!dependencies.callOperations) {
      return context.json(
        {
          error: {
            code: 'TRANSCRIPTION_UNAVAILABLE',
            message: 'Transcription is unavailable',
            retryable: true,
          },
        },
        503,
      );
    }

    const handlers = createTwilioMediaConnectionHandlers({
      connectionId: randomUUID(),
      expectedCallSid: context.req.param('callSid'),
      application: dependencies.callOperations,
    });
    return upgradeWebSocket(context, {
      onOpen: () => void handlers.open().catch(() => handlers.error()),
      onMessage: (event) =>
        void (
          typeof event.data === 'string'
            ? handlers.message(event.data)
            : handlers.error()
        ).catch(() => handlers.error()),
      onClose: () => void handlers.close().catch(() => handlers.error()),
      onError: () => void handlers.error(),
    });
  };
  routes.get('/webhooks/twilio/media', handleMediaUpgrade);
  routes.get('/webhooks/twilio/media/:callSid', handleMediaUpgrade);

  return routes;
};
