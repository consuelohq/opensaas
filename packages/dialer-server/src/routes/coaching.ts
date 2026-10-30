import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { DialerVariables } from '../middleware/auth';
import {
  ScriptConflictError,
  validateScriptDraft,
  type CoachingScripts,
} from '../coaching/scripts';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const createCoachingRoutes = (scripts: CoachingScripts) => {
  const app = new Hono<{ Variables: DialerVariables }>();
  app.use('/v1/coaching/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.use(
    '/v1/coaching/*',
    bodyLimit({
      maxSize: 650000,
      onError: (c) =>
        c.json(
          {
            error: {
              code: 'SCRIPT_TOO_LARGE',
              message: 'Use a text script up to 100 KB.',
              retryable: false,
            },
          },
          413,
        ),
    }),
  );
  app.get('/v1/coaching/scripts', async (c) => {
    try {
      return c.json({ scripts: await scripts.list(c.get('identity')) });
    } catch {
      return c.json(
        {
          error: {
            code: 'SCRIPT_LIBRARY_UNAVAILABLE',
            message:
              'Your script library is temporarily unavailable. Please try again.',
            retryable: true,
          },
        },
        503,
      );
    }
  });
  app.put('/v1/coaching/scripts/:id', async (c) => {
    let draft;
    try {
      if (!uuid.test(c.req.param('id'))) throw new Error('Invalid script');
      draft = {
        id: c.req.param('id'),
        ...validateScriptDraft(await c.req.json()),
      };
    } catch {
      return c.json(
        {
          error: {
            code: 'INVALID_SCRIPT',
            message: 'Use a script name and text or Markdown up to 100 KB.',
            retryable: false,
          },
        },
        400,
      );
    }
    try {
      return c.json(await scripts.save(c.get('identity'), draft));
    } catch (error: unknown) {
      return error instanceof ScriptConflictError
        ? c.json(
            {
              error: {
                code: 'SCRIPT_CONFLICT',
                message: error.message,
                retryable: false,
              },
            },
            409,
          )
        : c.json(
            {
              error: {
                code: 'SCRIPT_SAVE_UNAVAILABLE',
                message: 'Your script could not be saved. Please try again.',
                retryable: true,
              },
            },
            503,
          );
    }
  });
  return app;
};
