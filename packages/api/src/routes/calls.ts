import { randomUUID } from 'node:crypto';
import { Dialer } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

interface CallBody {
  to: string;
  from?: string;
  userId?: string;
  statusCallbackUrl?: string;
}

interface CallbackBody {
  agentPhone: string;
  customerPhone: string;
  callerId?: string;
  contactId?: string;
}

/** /v1/calls routes wired to @consuelo/dialer */
export const callRoutes = (): RouteDefinition[] => {
  const dialer = new Dialer({
    credentials: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    },
  });

  return [
    {
      method: 'POST',
      path: '/v1/calls',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CallBody | undefined;
        if (!body?.to) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "to" field' } });
          return;
        }

        try {
          const result = await dialer.dial({
            to: body.to,
            from: body.from ?? '',
            userId: body.userId ?? req.auth?.userId ?? '',
            statusCallbackUrl: body.statusCallbackUrl,
          });

          if (!result.success) {
            res.status(500).json({ error: { code: 'DIAL_FAILED', message: result.error ?? 'Unknown error' } });
            return;
          }

          res.status(201).json({ callSid: result.callSid, status: 'initiated' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'DIAL_FAILED', message } });
        }
      }),
    },

    // --- callback mode (literal routes before :id param routes) ---

    {
      method: 'POST',
      path: '/v1/calls/callback',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CallbackBody | undefined;
        if (!body?.agentPhone || !body?.customerPhone) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing agentPhone or customerPhone' } });
          return;
        }
        if (!E164_REGEX.test(body.agentPhone) || !E164_REGEX.test(body.customerPhone)) {
          res.status(400).json({ error: { code: 'INVALID_PHONE', message: 'Phone numbers must be E.164 format' } });
          return;
        }
        if (body.callerId && !E164_REGEX.test(body.callerId)) {
          res.status(400).json({ error: { code: 'INVALID_PHONE', message: 'callerId must be E.164 format' } });
          return;
        }

        // TODO DEV-750: validate agentPhone belongs to authenticated user (phase 7 phone management)

        const conferenceName = `conf-${randomUUID()}`;
        const callerId = body.callerId ?? process.env.TWILIO_CALLER_ID ?? body.agentPhone;
        const baseUrl = process.env.API_BASE_URL ?? '';
        const twimlUrl = `${baseUrl}/v1/calls/callback/twiml?customer=${encodeURIComponent(body.customerPhone)}&conf=${encodeURIComponent(conferenceName)}&from=${encodeURIComponent(callerId)}`;

        try {
          const { callSid } = await dialer.createCall(body.agentPhone, callerId, { url: twimlUrl });
          res.status(201).json({ callSid, conferenceName, status: 'calling-agent' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Twilio API failure';
          res.status(502).json({ error: { code: 'TWILIO_ERROR', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/calls/callback/twiml',
      handler: errorHandler(async (req, res) => {
        // TwiML webhook — twilio calls this when agent answers in callback mode
        const customer = req.query?.customer ?? '';
        const conf = req.query?.conf ?? '';
        const from = req.query?.from ?? '';

        if (!conf || !customer) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing query params' } });
          return;
        }

        const agentTwiml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          `<Say>Connecting you to ${customer}</Say>`,
          '<Dial>',
          `<Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false" participantLabel="agent">`,
          conf,
          '</Conference>',
          '</Dial>',
          '</Response>',
        ].join('');

        // return TwiML to twilio for the agent leg
        res.type('text/xml').status(200).send(agentTwiml);

        // fire-and-forget: dial customer into the same conference
        const customerTwiml = dialer.conference.generateConferenceTwiml(conf, {
          startOnEnter: false,
          endOnExit: true,
          participantLabel: 'customer',
        });
        dialer.createCall(customer, from, { twiml: customerTwiml }).catch(() => {
          // customer dial failed — agent hears silence until they hang up
        });
      }),
    },

    {
      method: 'GET',
      path: '/v1/calls/:id',
      handler: errorHandler(async (req, res) => {
        res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Call status lookup not yet implemented' } });
      }),
    },
    {
      method: 'POST',
      path: '/v1/calls/:id/hangup',
      handler: errorHandler(async (req, res) => {
        const callSid = req.params?.id;
        if (!callSid) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing call ID' } });
          return;
        }

        try {
          const result = await dialer.hangup(callSid);
          if (!result.success) {
            res.status(500).json({ error: { code: 'HANGUP_FAILED', message: result.error ?? 'Unknown error' } });
            return;
          }

          res.status(200).json({ callSid, status: 'completed' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'HANGUP_FAILED', message } });
        }
      }),
    },
  ];
}
