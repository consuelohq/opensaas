import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import type { TwilioMediaFrame } from './call-operations/contracts';
import {
  createTwilioMediaConnectionHandlers,
  parseTwilioMediaFrame,
} from './routes/twilio-media';

const startFrame: TwilioMediaFrame = {
  event: 'start',
  sequenceNumber: '1',
  streamSid: 'MZ-1',
  start: {
    streamSid: 'MZ-1',
    callSid: 'CA-1',
    accountSid: 'AC-1',
    tracks: ['inbound', 'outbound'],
    mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
    customParameters: { callId: 'CA-1' },
  },
};

describe('Twilio Media Stream boundary', () => {
  it('counts queued frames rather than the total lifetime of a stream', async () => {
    const application = {
      beginTranscriptionSession: () =>
        Effect.succeed({ status: 'pending' as const }),
      processTranscriptionFrame: () => Effect.succeed({ accepted: true }),
      completeTranscriptionSession: () =>
        Effect.succeed({ status: 'ready' as const }),
      failTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'failed' as const }),
      ),
    };
    const handlers = createTwilioMediaConnectionHandlers({
      connectionId: 'long-call',
      application,
    });
    await handlers.open();
    await handlers.message(JSON.stringify(startFrame));
    for (let i = 0; i < 300; i++)
      await handlers.message(
        JSON.stringify({
          event: 'media',
          streamSid: 'MZ-1',
          sequenceNumber: String(i + 2),
          media: {
            track: 'inbound',
            chunk: String(i + 1),
            timestamp: String(i * 20),
            payload: 'YQ==',
          },
        }),
      );
    await handlers.close();
    expect(application.failTranscriptionSession).not.toHaveBeenCalled();
  });

  it('cancels a provider flush immediately when an error arrives during stop', async () => {
    let releaseStop: () => void = () => {};
    const application = {
      beginTranscriptionSession: () =>
        Effect.succeed({ status: 'pending' as const }),
      processTranscriptionFrame: ({ frame }: { frame: TwilioMediaFrame }) =>
        frame.event === 'stop'
          ? Effect.promise(
              () =>
                new Promise<{ accepted: boolean }>((resolve) => {
                  releaseStop = () => resolve({ accepted: true });
                }),
            )
          : Effect.succeed({ accepted: true }),
      completeTranscriptionSession: () =>
        Effect.succeed({ status: 'ready' as const }),
      failTranscriptionSession: mock(() =>
        Effect.sync(() => {
          releaseStop();
          return { status: 'failed' as const };
        }),
      ),
    };
    const handlers = createTwilioMediaConnectionHandlers({
      connectionId: 'cancel-stop',
      application,
    });
    await handlers.open();
    await handlers.message(JSON.stringify(startFrame));
    const stopped = handlers.message(
      JSON.stringify({
        event: 'stop',
        sequenceNumber: '2',
        streamSid: 'MZ-1',
        stop: { callSid: 'CA-1' },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await handlers.error();
    releaseStop();
    await stopped;
    expect(application.failTranscriptionSession).toHaveBeenCalledTimes(1);
  });
  it('accepts the real connected → start → media → stop protocol in arrival order', async () => {
    const events: string[] = [];
    const application = {
      beginTranscriptionSession: () =>
        Effect.succeed({ status: 'pending' as const }),
      processTranscriptionFrame: ({ frame }: { frame: TwilioMediaFrame }) =>
        Effect.promise(async () => {
          if (frame.event === 'start')
            await new Promise((resolve) => setTimeout(resolve, 10));
          events.push(frame.event);
          return { accepted: true };
        }),
      completeTranscriptionSession: () =>
        Effect.succeed({ status: 'ready' as const }),
      failTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'failed' as const }),
      ),
    };
    const handlers = createTwilioMediaConnectionHandlers({
      connectionId: 'real-protocol',
      expectedCallSid: 'CA-1',
      application,
    });
    await handlers.open();
    await Promise.all(
      [
        { event: 'connected', protocol: 'Call', version: '1.0.0' },
        startFrame,
        {
          event: 'media',
          sequenceNumber: '2',
          streamSid: 'MZ-1',
          media: {
            track: 'inbound',
            chunk: '1',
            timestamp: '0',
            payload: 'YQ==',
          },
        },
        {
          event: 'stop',
          sequenceNumber: '3',
          streamSid: 'MZ-1',
          stop: { accountSid: 'AC-1', callSid: 'CA-1' },
        },
      ].map((frame) => handlers.message(JSON.stringify(frame))),
    );
    await handlers.close();
    expect(application.failTranscriptionSession).not.toHaveBeenCalled();
    expect(events).toEqual(['start', 'media', 'stop']);
  });

  it('rejects unsupported media declarations', () => {
    for (const mediaFormat of [
      undefined,
      { encoding: 'audio/pcm', sampleRate: 16000, channels: 1 },
      { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 2 },
    ]) {
      expect(
        parseTwilioMediaFrame({
          ...startFrame,
          start: { ...startFrame.start, mediaFormat },
        }),
      ).toBeNull();
    }
  });
  it('validates start, media, and stop frames without accepting unknown tracks', () => {
    expect(parseTwilioMediaFrame(startFrame)).toEqual(startFrame);
    expect(
      parseTwilioMediaFrame({
        event: 'media',
        sequenceNumber: '2',
        streamSid: 'MZ-1',
        media: {
          track: 'inbound',
          chunk: '1',
          timestamp: '0',
          payload: Buffer.from('audio').toString('base64'),
        },
      }),
    ).not.toBeNull();
    expect(
      parseTwilioMediaFrame({
        event: 'stop',
        sequenceNumber: '3',
        streamSid: 'MZ-1',
        stop: { callSid: 'CA-1' },
      }),
    ).not.toBeNull();
    expect(
      parseTwilioMediaFrame({
        event: 'media',
        sequenceNumber: '4',
        streamSid: 'MZ-1',
        media: { track: 'mixed', chunk: '2', timestamp: '1', payload: 'YQ==' },
      }),
    ).toBeNull();
    expect(
      parseTwilioMediaFrame({
        event: 'media',
        sequenceNumber: '5',
        streamSid: 'MZ-1',
        media: {
          track: 'inbound',
          chunk: '3',
          timestamp: '2',
          payload: 'A'.repeat(16_388),
        },
      }),
    ).toBeNull();
  });

  it('delegates validated frames and terminal close to the Effect application exactly once', async () => {
    const application = {
      beginTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'pending' as const }),
      ),
      processTranscriptionFrame: mock(() => Effect.succeed({ accepted: true })),
      completeTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'ready' as const }),
      ),
      failTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'failed' as const }),
      ),
    };
    const handlers = createTwilioMediaConnectionHandlers({
      connectionId: 'connection-1',
      application,
    });

    await handlers.open();
    await handlers.message(JSON.stringify(startFrame));
    await handlers.close();
    await handlers.close();

    expect(application.beginTranscriptionSession).toHaveBeenCalledTimes(1);
    expect(application.processTranscriptionFrame).toHaveBeenCalledWith({
      connectionId: 'connection-1',
      frame: startFrame,
    });
    expect(application.completeTranscriptionSession).toHaveBeenCalledTimes(1);
  });
  it('rejects a different CallSid or forged callId inside an otherwise authenticated stream', async () => {
    const application = {
      beginTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'pending' as const }),
      ),
      processTranscriptionFrame: mock(() => Effect.succeed({ accepted: true })),
      completeTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'ready' as const }),
      ),
      failTranscriptionSession: mock(() =>
        Effect.succeed({ status: 'failed' as const }),
      ),
    };
    for (const start of [
      { ...startFrame, start: { ...startFrame.start, callSid: 'CA-foreign' } },
      {
        ...startFrame,
        start: {
          ...startFrame.start,
          customParameters: { callId: 'CA-foreign' },
        },
      },
    ]) {
      const handlers = createTwilioMediaConnectionHandlers({
        connectionId: 'connection-1',
        application,
        expectedCallSid: 'CA-1',
      });
      await handlers.open();
      await handlers.message(JSON.stringify(start));
    }
    expect(application.processTranscriptionFrame).not.toHaveBeenCalled();
    expect(application.failTranscriptionSession).toHaveBeenCalledTimes(2);
  });
});
