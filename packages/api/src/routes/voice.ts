import { Dialer, type TransferType, type TransferStatus } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import { randomUUID } from 'node:crypto';

// TODO: DEV-798 — replace with redis for multi-instance support
const conferenceMap = new Map<string, string>();

interface TransferRecord {
  transferId: string;
  status: TransferStatus;
  transferType: TransferType;
  recipientPhone: string;
  conferenceName: string;
  conferenceSid: string | null;
  transferCallSid: string | null;
  customerMuted: boolean;
  initiatedAt: string;
  connectedAt: string | null;
  completedAt: string | null;
}

// TODO: DEV-798 — replace with redis for multi-instance support
const transferMap = new Map<string, TransferRecord>();

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

        res.type('text/xml').status(200).send(twiml);
      }),
    },

    // --- literal "transfer" routes first (ROUTE_ORDER) ---

    {
      method: 'POST',
      path: '/v1/calls/transfer/:transferId/mute-customer',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const transferId = req.params?.transferId;
        if (!transferId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing transferId' } });
          return;
        }

        const record = transferMap.get(transferId);
        if (!record) {
          res.status(404).json({ error: { code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found' } });
          return;
        }

        if (record.transferType !== 'warm') {
          res.status(400).json({ error: { code: 'INVALID_TRANSFER_TYPE', message: 'Mute only available for warm transfers' } });
          return;
        }

        if (record.status === 'completed' || record.status === 'cancelled' || record.status === 'failed') {
          res.status(400).json({ error: { code: 'TRANSFER_NOT_ACTIVE', message: 'Transfer is no longer active' } });
          return;
        }

        const body = req.body as { muted?: boolean } | undefined;
        if (body?.muted === undefined) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "muted" boolean' } });
          return;
        }

        try {
          const conferenceSid = record.conferenceSid ?? await dialer.conference.findConferenceSid(record.conferenceName);
          if (!conferenceSid) {
            res.status(404).json({ error: { code: 'CONFERENCE_NOT_FOUND', message: 'Conference not in-progress' } });
            return;
          }

          const participants = await dialer.listParticipants(conferenceSid);
          const customer = participants.find((p: { label: string }) => p.label === 'customer');
          if (!customer) {
            res.status(404).json({ error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Customer not in conference' } });
            return;
          }

          await dialer.muteParticipant(conferenceSid, customer.callSid, body.muted);
          record.customerMuted = body.muted;

          res.status(200).json({ transferId, customerMuted: body.muted });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Mute toggle failed';
          res.status(502).json({ error: { code: 'TWILIO_ERROR', message } });
        }
      }),
    },

    {
      method: 'GET',
      path: '/v1/calls/transfer/:transferId/status',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const transferId = req.params?.transferId;
        if (!transferId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing transferId' } });
          return;
        }

        const record = transferMap.get(transferId);
        if (!record) {
          res.status(404).json({ error: { code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found' } });
          return;
        }

        res.status(200).json({
          transferId: record.transferId,
          status: record.status,
          transferType: record.transferType,
          recipientPhone: record.recipientPhone,
          conferenceId: record.conferenceSid,
          customerMuted: record.customerMuted,
          initiatedAt: record.initiatedAt,
          connectedAt: record.connectedAt,
          completedAt: record.completedAt,
        });
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

          const transferId = randomUUID();
          transferMap.set(transferId, {
            transferId,
            status: body.type === 'warm' ? 'consulting' : 'completed',
            transferType: body.type,
            recipientPhone: body.to,
            conferenceName,
            conferenceSid: result.conferenceSid ?? null,
            transferCallSid: result.transferCallSid ?? null,
            customerMuted: false,
            initiatedAt: new Date().toISOString(),
            connectedAt: body.type === 'cold' ? new Date().toISOString() : null,
            completedAt: body.type === 'cold' ? new Date().toISOString() : null,
          });

          res.status(200).json({ ...result, transferId });
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
