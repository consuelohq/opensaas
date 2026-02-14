import { Dialer, type TransferType } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import { randomUUID } from 'node:crypto';

// in-memory conference name map: callSid → conferenceName
// in production this would be redis-backed
const conferenceMap = new Map<string, string>();

interface TransferBody {
  to: string;
  from?: string;
  type: TransferType;
  conferenceName?: string;
}

interface HoldBody {
  hold: boolean;
  participantCallSid?: string;
}

interface CompleteBody {
  agentCallSid: string;
  conferenceSid: string;
}

interface CancelBody {
  transferCallSid: string;
  conferenceSid: string;
}

/** /v1/voice routes — token, TwiML webhook, transfers, hold */
export const voiceRoutes = (): RouteDefinition[] => {
  const dialer = new Dialer({
    credentials: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    },
    baseUrl: process.env.API_BASE_URL,
  });

  return [
    // --- literal routes first (ROUTE_ORDER) ---

    {
      method: 'GET',
      path: '/v1/voice/token',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        try {
          const result = await dialer.getToken(userId);
          res.json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Token generation failed';
          res.status(500).json({ error: { code: 'TOKEN_ERROR', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/voice/twiml',
      handler: errorHandler(async (req, res) => {
        const body = req.body as Record<string, string> | undefined;
        const to = body?.To ?? '';
        const from = body?.From ?? '';
        const callSid = body?.CallSid ?? '';
        const conferenceName = `conf-${randomUUID()}`;
        conferenceMap.set(callSid, conferenceName);

        const twiml = dialer.generateConferenceTwiml(conferenceName, 'agent');

        // dial the customer into the conference (fire-and-forget)
        if (to && !to.startsWith('client:')) {
          const statusCallback = process.env.API_BASE_URL
            ? `${process.env.API_BASE_URL}/v1/webhooks/status`
            : undefined;

          dialer.addCustomerToConference(conferenceName, to, from, statusCallback).catch(() => {
            // customer dial failed — agent hears hold music until they hang up
          });
        }

        res.status(200).json(twiml);
      }),
    },

    // --- param routes (calls/:callSid/*) ---

    {
      method: 'POST',
      path: '/v1/calls/:callSid/transfer',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const callSid = req.params?.callSid;
        if (!callSid) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing callSid' } });
          return;
        }

        const body = req.body as TransferBody | undefined;
        if (!body?.to || !body?.type) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "to" or "type"' } });
          return;
        }

        const conferenceName = body.conferenceName ?? conferenceMap.get(callSid);
        if (!conferenceName) {
          res.status(404).json({ error: { code: 'CONFERENCE_NOT_FOUND', message: 'No conference found for this call' } });
          return;
        }

        try {
          const result = await dialer.initiateTransfer({
            callSid,
            conferenceName,
            to: body.to,
            from: body.from ?? process.env.TWILIO_DEFAULT_NUMBER ?? '',
            type: body.type,
            userId,
          });

          if (!result.success) {
            res.status(500).json({ error: { code: 'TRANSFER_FAILED', message: result.error ?? 'Transfer failed' } });
            return;
          }

          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Transfer failed';
          res.status(500).json({ error: { code: 'TRANSFER_FAILED', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/:callSid/transfer/complete',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const body = req.body as CompleteBody | undefined;
        if (!body?.conferenceSid || !body?.agentCallSid) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing conferenceSid or agentCallSid' } });
          return;
        }

        try {
          const result = await dialer.completeTransfer(body.conferenceSid, body.agentCallSid);
          if (!result.success) {
            res.status(500).json({ error: { code: 'TRANSFER_FAILED', message: result.error ?? 'Complete failed' } });
            return;
          }

          // clean up conference map
          const callSid = req.params?.callSid;
          if (callSid) conferenceMap.delete(callSid);

          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Complete transfer failed';
          res.status(500).json({ error: { code: 'TRANSFER_FAILED', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/:callSid/transfer/cancel',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const body = req.body as CancelBody | undefined;
        if (!body?.conferenceSid || !body?.transferCallSid) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing conferenceSid or transferCallSid' } });
          return;
        }

        try {
          const result = await dialer.cancelTransfer(body.conferenceSid, body.transferCallSid);
          if (!result.success) {
            res.status(500).json({ error: { code: 'TRANSFER_FAILED', message: result.error ?? 'Cancel failed' } });
            return;
          }

          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Cancel transfer failed';
          res.status(500).json({ error: { code: 'TRANSFER_FAILED', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/:callSid/hold',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const body = req.body as HoldBody | undefined;
        if (body?.hold === undefined) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "hold" boolean' } });
          return;
        }

        const callSid = req.params?.callSid;
        if (!callSid) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing callSid' } });
          return;
        }

        const conferenceName = conferenceMap.get(callSid);
        if (!conferenceName) {
          res.status(404).json({ error: { code: 'CONFERENCE_NOT_FOUND', message: 'No conference found for this call' } });
          return;
        }

        try {
          const conferenceSid = await dialer.conference.findConferenceSid(conferenceName);
          if (!conferenceSid) {
            res.status(404).json({ error: { code: 'CONFERENCE_NOT_FOUND', message: 'Conference not in-progress' } });
            return;
          }

          if (body.participantCallSid) {
            await dialer.holdParticipant(conferenceSid, body.participantCallSid, body.hold);
          } else {
            // default: hold the customer
            const participants = await dialer.listParticipants(conferenceSid);
            const customer = participants.find((p: { label: string }) => p.label === 'customer');
            if (customer) {
              await dialer.holdParticipant(conferenceSid, customer.callSid, body.hold);
            }
          }

          res.status(200).json({ success: true, hold: body.hold });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Hold toggle failed';
          res.status(500).json({ error: { code: 'HOLD_FAILED', message } });
        }
      }),
    },
  ];
};
