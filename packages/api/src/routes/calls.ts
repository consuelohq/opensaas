import { Dialer } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

interface CallBody {
  to: string;
  from?: string;
  userId?: string;
  statusCallbackUrl?: string;
}

/** /v1/calls routes wired to @consuelo/dialer */
export function callRoutes(): RouteDefinition[] {
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
            userId: body.userId ?? req.apiKeyContext?.userId ?? '',
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
