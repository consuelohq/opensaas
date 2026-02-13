import { Coach } from '@consuelo/coaching';
import type { Message } from '@consuelo/coaching';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

interface CoachBody {
  messages: Message[];
  contextChunks?: string[];
}

interface AnalyzeBody {
  messages: Message[];
  callSid?: string;
  phoneNumber?: string;
}

/** /v1/coaching routes wired to @consuelo/coaching */
export function coachingRoutes(): RouteDefinition[] {
  const coach = new Coach({ apiKey: process.env.GROQ_API_KEY ?? '' });

  return [
    {
      method: 'POST',
      path: '/v1/coaching',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CoachBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "messages" array' } });
          return;
        }

        try {
          const result = await coach.coach(body.messages, { contextChunks: body.contextChunks });
          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'COACHING_FAILED', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/coaching/analyze',
      handler: errorHandler(async (req, res) => {
        const body = req.body as AnalyzeBody | undefined;
        if (!body?.messages?.length) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing "messages" array' } });
          return;
        }

        try {
          const result = await coach.analyzeCall(body.messages, {
            callSid: body.callSid,
            userId: req.apiKeyContext?.userId,
            phoneNumber: body.phoneNumber,
          });
          res.status(200).json(result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'ANALYSIS_FAILED', message } });
        }
      }),
    },
  ];
}
