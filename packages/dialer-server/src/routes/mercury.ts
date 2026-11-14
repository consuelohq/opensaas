import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { DialerVariables } from '../middleware/auth';
import {
  PlaybookAccessError,
  PlaybookValidationError,
  type PlaybookStore,
  type PublishInput,
} from '../coaching/playbook-store';
import { ScriptConflictError } from '../coaching/scripts';
import { SYNTHETIC_LIFE_INSURANCE } from '../coaching/playbooks';
import type { CueService } from '../coaching/cue-service';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createMercuryRoutes(options: {
  playbooks: PlaybookStore;
  cues: CueService;
}) {
  const app = new Hono<{ Variables: DialerVariables }>();
  app.use(
    '/v1/coaching/scripts/*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) =>
        c.json(
          {
            error: {
              code: 'INVALID_PLAYBOOK',
              message: 'Use a playbook request up to 1 MB.',
              retryable: false,
            },
          },
          413,
        ),
    }),
  );
  const failure = (
    c: Context<{ Variables: DialerVariables }>,
    error: unknown,
  ) =>
    error instanceof PlaybookAccessError
      ? c.json(
          {
            error: {
              code: 'COACHING_ACCESS_DENIED',
              message: error.message,
              retryable: false,
            },
          },
          403,
        )
      : error instanceof ScriptConflictError
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
                code: 'COACHING_UNAVAILABLE',
                message:
                  'Approved coaching is unavailable. Your manual script remains available.',
                retryable: true,
              },
            },
            503,
          );
  app.get('/v1/coaching/examples/life-insurance', (c) =>
    c.json(SYNTHETIC_LIFE_INSURANCE),
  );
  app.get('/v1/coaching/scripts/:id/versions', async (c) => {
    try {
      if (!uuid.test(c.req.param('id')!))
        return c.json({ error: { code: 'INVALID_SCRIPT' } }, 400);
      const versions = await options.playbooks.versions(
        c.get('identity'),
        c.req.param('id')!,
      );
      return c.json({
        versions: versions.map((p) => ({
          version: p.version,
          sourceRevision: p.sourceRevision,
          createdAt: p.createdAt,
          publishedVersion: p.compiled.playbook.publishedVersion,
        })),
      });
    } catch (e: unknown) {
      return failure(c, e);
    }
  });
  for (const action of ['preview', 'publish'] as const)
    app.post('/v1/coaching/scripts/:id/' + action, async (c) => {
      try {
        let input: PublishInput;
        try {
          if (!uuid.test(c.req.param('id')!)) throw new Error();
          input = await c.req.json();
          const allowed =
            action === 'preview'
              ? ['expectedRevision', 'rules']
              : [
                  'expectedRevision',
                  'expectedPublishedVersion',
                  'approved',
                  'rules',
                  'reviewToken',
                ];
          if (
            !input ||
            typeof input !== 'object' ||
            Array.isArray(input) ||
            Object.keys(input).some((key) => !allowed.includes(key)) ||
            !Number.isSafeInteger(input.expectedRevision) ||
            input.expectedRevision < 1 ||
            (action === 'publish' &&
              (!Number.isSafeInteger(input.expectedPublishedVersion) ||
                input.expectedPublishedVersion < 0)) ||
            (action === 'publish' &&
              (input.approved !== true ||
                !Array.isArray(input.rules) ||
                typeof input.reviewToken !== 'string' ||
                !/^[a-f0-9]{64}$/.test(input.reviewToken)))
          )
            throw new Error();
        } catch {
          return c.json(
            {
              error: {
                code: 'INVALID_PLAYBOOK',
                message:
                  'Use a saved revision for preview. Publish the complete reviewed rules with their review token, current published revision and explicit approval.',
                retryable: false,
              },
            },
            400,
          );
        }
        try {
          if (action === 'preview') {
            const reviewed = await options.playbooks.preview(
              c.get('identity'),
              c.req.param('id')!,
              input,
            );
            return c.json({
              preview: reviewed.compiled,
              reviewToken: reviewed.reviewToken,
              expectedPublishedVersion: reviewed.compiled.version - 1,
            });
          }
          return c.json(
            await options.playbooks.publish(
              c.get('identity'),
              c.req.param('id')!,
              input,
            ),
          );
        } catch (e: unknown) {
          if (e instanceof PlaybookValidationError)
            return c.json(
              {
                error: {
                  code: 'INVALID_PLAYBOOK',
                  message: e.message,
                  retryable: false,
                },
              },
              400,
            );
          return failure(c, e);
        }
      } catch (cause: unknown) {
        throw cause instanceof Error
          ? cause
          : new Error('Coaching operation failed', { cause });
      }
    });
  app.delete('/v1/coaching/scripts/:id', async (c) => {
    try {
      const body = await c.req.json();
      if (
        !uuid.test(c.req.param('id')!) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        body.expectedRevision < 1
      )
        return c.json({ error: { code: 'INVALID_SCRIPT' } }, 400);
      await options.playbooks.archive(
        c.get('identity'),
        c.req.param('id')!,
        body.expectedRevision,
      );
      return c.json({ archived: true });
    } catch (e: unknown) {
      return failure(c, e);
    }
  });
  app.post('/v1/coaching/sessions', async (c) => {
    try {
      let body: Record<string, unknown>;
      try {
        body = await c.req.json();
        if (
          !body ||
          typeof body.scopeKey !== 'string' ||
          body.scopeKey.length > 256 ||
          typeof body.scriptId !== 'string' ||
          !uuid.test(body.scriptId) ||
          (body.version !== undefined &&
            (!Number.isSafeInteger(body.version) || Number(body.version) < 1))
        )
          throw new Error();
      } catch {
        return c.json(
          { error: { code: 'INVALID_COACHING_SESSION', retryable: false } },
          400,
        );
      }
      try {
        return c.json(
          await options.cues.open(
            c.get('identity'),
            {
              scopeKey: body.scopeKey as string,
              scriptId: body.scriptId as string,
              version: body.version as number | undefined,
            },
            c.req.raw.signal,
          ),
        );
      } catch (e: unknown) {
        return failure(c, e);
      }
    } catch (cause: unknown) {
      throw cause instanceof Error
        ? cause
        : new Error('Coaching operation failed', { cause });
    }
  });
  app.get('/v1/coaching/sessions/:scopeKey/cue', async (c) => {
    try {
      const raw = c.req.query('afterRevision'),
        after = raw === undefined ? undefined : Number(raw);
      if (after !== undefined && (!Number.isSafeInteger(after) || after < 0))
        return c.json({ error: { code: 'INVALID_CURSOR' } }, 400);
      return c.json(
        await options.cues.read(
          c.get('identity'),
          c.req.param('scopeKey'),
          after,
        ),
      );
    } catch (e: unknown) {
      return failure(c, e);
    }
  });
  app.post('/v1/coaching/sessions/:scopeKey/control', async (c) => {
    try {
      const body = await c.req.json();
      if (
        !['pin', 'auto', 'next', 'previous', 'off'].includes(body?.action) ||
        typeof body.projectionToken !== 'string'
      )
        return c.json({ error: { code: 'INVALID_COACHING_CONTROL' } }, 400);
      return c.json(
        await options.cues.control(
          c.get('identity'),
          c.req.param('scopeKey'),
          body.action,
          body.projectionToken,
        ),
      );
    } catch (e: unknown) {
      return failure(c, e);
    }
  });
  return app;
}
