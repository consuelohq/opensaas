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
    customParameters: { callId: 'CA-1' },
  },
};

describe('Twilio Media Stream boundary', () => {
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
});
