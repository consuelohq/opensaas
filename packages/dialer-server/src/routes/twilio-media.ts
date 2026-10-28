import { randomUUID } from 'node:crypto';

import { Effect } from 'effect';
import { Hono } from 'hono';
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
      stop: { callSid: stop.callSid },
    };
  }
  return null;
};

const runBoundaryEffect = async (effect: Effect.Effect<unknown, unknown>) => {
  await Effect.runPromise(effect);
};

export const createTwilioMediaConnectionHandlers = (input: {
  connectionId: string;
  application: Pick<
    CallOperationsApplication,
    | 'beginTranscriptionSession'
    | 'processTranscriptionFrame'
    | 'completeTranscriptionSession'
    | 'failTranscriptionSession'
  >;
}) => {
  let terminal = false;

  const fail = async (failureCode: string) => {
    if (terminal) return;
    terminal = true;
    await runBoundaryEffect(
      input.application.failTranscriptionSession({
        connectionId: input.connectionId,
        failureCode,
      }),
    ).catch(() => undefined);
  };

  return {
    open: async () => {
      await runBoundaryEffect(
        input.application.beginTranscriptionSession({
          connectionId: input.connectionId,
        }),
      );
    },
    message: async (rawMessage: string) => {
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
      const isStop = frame.event === 'stop';
      if (isStop) terminal = true;
      try {
        await runBoundaryEffect(
          input.application.processTranscriptionFrame({
            connectionId: input.connectionId,
            frame,
          }),
        );
      } catch {
        terminal = false;
        await fail('MEDIA_FRAME_PROCESSING_FAILED');
      }
    },
    close: () => {
      if (terminal) return Promise.resolve();
      terminal = true;
      return runBoundaryEffect(
        input.application.completeTranscriptionSession({
          connectionId: input.connectionId,
        }),
      );
    },
    error: () => fail('MEDIA_STREAM_ERROR'),
  };
};

const messageText = (data: string | Blob | ArrayBufferLike): Promise<string> => {
  if (typeof data === 'string') return Promise.resolve(data);
  if (data instanceof Blob) return data.text();
  return Promise.resolve(new TextDecoder().decode(data));
};

export const createTwilioMediaRoutes = (
  dependencies: DialerServerDependencies,
) => {
  const routes = new Hono();

  routes.get('/webhooks/twilio/media', async (context) => {
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
      application: dependencies.callOperations,
    });
    return upgradeWebSocket(context, {
      onOpen: () => void handlers.open().catch(() => handlers.error()),
      onMessage: (event) =>
        void messageText(event.data)
          .then((message) => handlers.message(message))
          .catch(() => handlers.error()),
      onClose: () => void handlers.close(),
      onError: () => void handlers.error(),
    });
  });

  return routes;
};
