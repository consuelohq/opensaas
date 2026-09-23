import type { InboundCarrier } from './telephony-contracts';

export const createTwilioInboundCarrier = async (
  accountSid: string,
  authToken: string,
): Promise<InboundCarrier> => {
  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken, {
      timeout: 5000,
      autoRetry: false,
    });
    const conference = async (name: string) => {
      try {
        const matches = await client.conferences.list({
          friendlyName: name,
          status: 'in-progress',
          limit: 2,
        });
        if (matches.length > 1) throw new Error('Ambiguous active conference');
        return matches[0];
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    };
    return {
      offer: async (input) => {
        try {
          const call = await client.calls.create({
            to: input.to,
            from: input.from,
            url: input.url,
            method: 'POST',
            statusCallback: input.statusCallback,
            statusCallbackMethod: 'POST',
            statusCallbackEvent: [
              'initiated',
              'ringing',
              'answered',
              'completed',
            ],
            timeout: input.timeoutSeconds,
          });
          return {
            sid: call.sid,
            accountSid: call.accountSid,
            status: call.status,
          };
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Async operation rejected with a non-Error cause', {
            cause,
          });
        }
      },
      redirect: async (sid, twiml) => {
        try {
          await client.calls(sid).update({ twiml });
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Async operation rejected with a non-Error cause', {
            cause,
          });
        }
      },
      end: async (sid) => {
        try {
          await client.calls(sid).update({ status: 'completed' });
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Async operation rejected with a non-Error cause', {
            cause,
          });
        }
      },
      call: async (sid) => {
        try {
          const call = await client.calls(sid).fetch();
          return {
            sid: call.sid,
            accountSid: call.accountSid,
            status: call.status,
          };
        } catch (cause: unknown) {
          if (cause instanceof Error) throw cause;
          throw new Error('Async operation rejected with a non-Error cause', {
            cause,
          });
        }
      },
      participants: async (name) => {
        const active = await conference(name);
        if (!active) return [];
        const participants = await client
          .conferences(active.sid)
          .participants.list({ limit: 251 });
        if (participants.length > 250)
          throw new Error('Conference participant bound exceeded');
        return participants.map((participant) => ({
          callSid: participant.callSid,
          muted: participant.muted,
          hold: participant.hold,
        }));
      },
      recording: async (sid) => {
        const recording = await client.recordings(sid).fetch();
        return {
          accountSid: recording.accountSid,
          callSid: recording.callSid,
          status: recording.status,
        };
      },
      deleteRecording: async (sid) => {
        try {
          await client.recordings(sid).remove();
        } catch (cause: unknown) {
          if (
            typeof cause === 'object' &&
            cause !== null &&
            'status' in cause &&
            cause.status === 404
          )
            return;
          throw new Error('Voicemail deletion failed', { cause });
        }
      },
    };
  } catch (cause: unknown) {
    if (cause instanceof Error) throw cause;
    throw new Error('Async operation rejected with a non-Error cause', {
      cause,
    });
  }
};
