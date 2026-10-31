import { bodyLimit } from 'hono/body-limit';
import { Hono } from 'hono';
import {
  isPublicCheckoutOrigin,
  type PublicCheckout,
} from '../billing/public-checkout';

export const createPublicCheckoutRoutes = (checkout: PublicCheckout) => {
  const app = new Hono();
  app.use('/v1/public/billing/*', async (context, next) => {
    const origin = context.req.header('origin') ?? '';
    context.header('Cache-Control', 'no-store');
    context.header('Vary', 'Origin');
    if (!isPublicCheckoutOrigin(origin))
      return context.json({ error: { code: 'CHECKOUT_ORIGIN_DENIED' } }, 403);
    context.header('Access-Control-Allow-Origin', origin);
    context.header('Access-Control-Allow-Credentials', 'true');
    context.header('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    context.header(
      'Access-Control-Allow-Headers',
      'Content-Type,X-Purchase-Claim',
    );
    context.header('Access-Control-Max-Age', '600');
    if (context.req.method === 'OPTIONS') return context.body(null, 204);
    await next();
  });
  app.use(
    '/v1/public/billing/checkout',
    bodyLimit({
      maxSize: 8192,
      onError: (context) =>
        context.json({ error: { code: 'CHECKOUT_REQUEST_TOO_LARGE' } }, 413),
    }),
  );
  app.post('/v1/public/billing/checkout', async (context) => {
    try {
      const text = await context.req.text();
      if (text.length > 8192)
        return context.json(
          { error: { code: 'INVALID_CHECKOUT_REQUEST' } },
          400,
        );
      const result = await checkout.create(JSON.parse(text), {
        origin: context.req.header('origin') ?? '',
        clientAddress:
          context.req.header('cf-connecting-ip') ??
          context.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
          'unknown',
      });
      return context.json(result);
    } catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : '';
      const code =
        /^(INVALID_|CHECKOUT_REQUEST_CONFLICT|PURCHASE_NOT_FOUND)/.test(message)
          ? 'INVALID_CHECKOUT_REQUEST'
          : ['CHECKOUT_RATE_LIMITED', 'CHECKOUT_SESSION_EXPIRED'].includes(
                message,
              )
            ? message
            : 'CHECKOUT_UNAVAILABLE';
      return context.json(
        { error: { code } },
        code === 'CHECKOUT_RATE_LIMITED'
          ? 429
          : code === 'INVALID_CHECKOUT_REQUEST'
            ? 400
            : code === 'CHECKOUT_SESSION_EXPIRED'
              ? 409
              : 503,
      );
    }
  });
  app.post('/v1/public/billing/purchase/:id/numbers', async (context) => {
    if (!checkout.continueNumbers)
      return context.json(
        { error: { code: 'NATIVE_BILLING_UNAVAILABLE' } },
        404,
      );
    try {
      return context.json(
        await checkout.continueNumbers(
          context.req.param('id'),
          context.req.header('x-purchase-claim'),
        ),
      );
    } catch {
      return context.json(
        { error: { code: 'NUMBER_BILLING_UNAVAILABLE' } },
        409,
      );
    }
  });
  app.get('/v1/public/billing/purchase/:id', async (context) => {
    try {
      return context.json(
        await checkout.status(
          context.req.param('id'),
          context.req.header('x-purchase-claim'),
        ),
      );
    } catch {
      return context.json({ error: { code: 'PURCHASE_UNAVAILABLE' } }, 404);
    }
  });
  return app;
};
