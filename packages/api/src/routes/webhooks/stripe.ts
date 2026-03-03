import * as Sentry from '@sentry/node';
import type { RouteDefinition } from '../index.js';
import { handleWebhookEvent } from '../../services/subscription.js';
import { createLogger } from '@consuelo/logger';

const logger = createLogger('api:stripe-webhook');

export const stripeWebhookRoutes = (): RouteDefinition[] => [
  // POST /v1/webhooks/stripe — stripe sends raw body + signature header
  {
    method: 'POST',
    path: '/v1/webhooks/stripe',
    handler: async (req, res) => {
      try {
        const signature = req.headers['stripe-signature'];
        if (!signature) {
          Sentry.captureMessage('Stripe webhook missing signature', 'warning');
          res.status(400).json({
            error: {
              code: 'BAD_REQUEST',
              message: 'Missing stripe-signature header',
            },
          });
          return;
        }

        // raw body needed for signature verification
        const rawBody =
          typeof req.body === 'string'
            ? req.body
            : JSON.stringify(req.body);

        await handleWebhookEvent(rawBody, signature);

        logger.info('webhook.processed', { type: 'stripe' });
        res.status(200).json({ received: true });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Webhook processing failed';
        logger.error('webhook.failed', { error: message });
        res.status(400).json({
          error: { code: 'WEBHOOK_ERROR', message },
        });
      }
    },
  },
];
