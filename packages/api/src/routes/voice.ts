import { Dialer } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

/** /v1/voice routes — token generation for browser calling */
export const voiceRoutes = (): RouteDefinition[] => {
  const dialer = new Dialer({
    credentials: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    },
  });

  return [
    {
      method: 'GET',
      path: '/v1/voice/token',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res
            .status(401)
            .json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        try {
          const result = await dialer.getToken(userId);
          res.json(result);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Token generation failed';
          res
            .status(500)
            .json({ error: { code: 'TOKEN_ERROR', message } });
        }
      }),
    },
  ];
}
