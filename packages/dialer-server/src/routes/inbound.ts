import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export type InboundTransport = {
  publicUrl: string;
  authToken: string;
  handle: (
    numberId: string,
    action: string,
    facts: Record<string, string>,
    reference?: string,
  ) => Promise<string>;
};
export const createInboundRoutes = (application: InboundTransport) => {
  const routes = new Hono();
  const origin = new URL(application.publicUrl).origin;
  routes.use('/webhooks/twilio/inbound/*', bodyLimit({ maxSize: 16384 }));
  routes.post(
    '/webhooks/twilio/inbound/:numberId/:action?/:reference?',
    async (context) => {
      try {
        const signature = context.req.header('x-twilio-signature');
        if (!signature)
          return context.json(
            {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Missing provider signature',
              },
            },
            401,
          );
        if (
          !context.req
            .header('content-type')
            ?.startsWith('application/x-www-form-urlencoded')
        )
          return context.json(
            {
              error: { code: 'INVALID_REQUEST', message: 'Expected form body' },
            },
            400,
          );
        const form = new URLSearchParams(await context.req.text());
        const facts: Record<string, string> = Object.create(null);
        for (const [key, value] of form) {
          if (Object.hasOwn(facts, key))
            return context.json(
              {
                error: {
                  code: 'INVALID_REQUEST',
                  message: 'Duplicate provider field',
                },
              },
              400,
            );
          facts[key] = value;
        }
        const url = new URL(context.req.url);
        const expected = createHmac('sha1', application.authToken)
          .update(
            origin +
              url.pathname +
              url.search +
              Object.keys(facts)
                .sort()
                .map((key) => key + facts[key])
                .join(''),
          )
          .digest();
        const supplied = Buffer.from(signature, 'base64');
        if (
          supplied.length !== expected.length ||
          !timingSafeEqual(supplied, expected)
        )
          return context.json(
            {
              error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid provider signature',
              },
            },
            401,
          );
        try {
          const xml = await application.handle(
            context.req.param('numberId'),
            context.req.param('action') ?? 'incoming',
            facts,
            context.req.param('reference'),
          );
          return context.body(xml, 200, {
            'content-type': 'text/xml; charset=utf-8',
            'cache-control': 'no-store',
          });
        } catch {
          return context.json(
            {
              error: {
                code: 'INBOUND_UNAVAILABLE',
                message: 'Inbound operation unavailable',
              },
            },
            503,
          );
        }
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('Async operation rejected with a non-Error cause', {
          cause,
        });
      }
    },
  );
  return routes;
};
