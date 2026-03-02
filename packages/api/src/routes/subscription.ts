import * as Sentry from '@sentry/node';
import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RouteDefinition } from './index.js';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createPortalSession,
  PRICE_IDS,
} from '../services/subscription.js';
import { createLogger } from '@consuelo/logger';

const logger = createLogger('api:subscription');

interface CheckoutBody {
  priceIds?: string[];
  interval?: 'month' | 'year';
  addOns?: string[];
  successUrl: string;
  cancelUrl: string;
}

interface PortalBody {
  returnUrl: string;
}

export const subscriptionRoutes = (): RouteDefinition[] => [
  // GET /v1/subscription/status
  {
    method: 'GET',
    path: '/v1/subscription/status',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const status = await getSubscriptionStatus(auth.workspaceId);
      res.status(200).json(status);
    }),
  },

  // POST /v1/subscription/checkout
  {
    method: 'POST',
    path: '/v1/subscription/checkout',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const body = req.body as CheckoutBody | undefined;
      if (!body?.successUrl || !body?.cancelUrl) {
        Sentry.captureMessage('Checkout missing URLs', 'warning');
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'successUrl and cancelUrl required',
          },
        });
        return;
      }

      // build price list: base + selected add-ons
      const interval = body.interval ?? 'month';
      const priceIds: string[] = body.priceIds ?? [];

      if (priceIds.length === 0) {
        // default: base plan
        const basePrice =
          interval === 'year'
            ? PRICE_IDS.baseAnnual
            : PRICE_IDS.baseMonthly;
        if (basePrice) priceIds.push(basePrice);

        // add requested add-ons
        if (body.addOns?.includes('dialer-coach')) {
          const p =
            interval === 'year'
              ? PRICE_IDS.dialerCoachAnnual
              : PRICE_IDS.dialerCoachMonthly;
          if (p) priceIds.push(p);
        }
        if (body.addOns?.includes('ai-assistant')) {
          const p =
            interval === 'year'
              ? PRICE_IDS.aiAssistantAnnual
              : PRICE_IDS.aiAssistantMonthly;
          if (p) priceIds.push(p);
        }
      }

      if (priceIds.length === 0) {
        res.status(400).json({
          error: {
            code: 'NO_PRICES',
            message: 'No price IDs configured — set STRIPE_PRICE_* env vars',
          },
        });
        return;
      }

      const result = await createCheckoutSession(
        auth.workspaceId,
        priceIds,
        body.successUrl,
        body.cancelUrl,
      );

      logger.info('checkout.initiated', {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
      });

      res.status(200).json(result);
    }),
  },

  // POST /v1/subscription/portal
  {
    method: 'POST',
    path: '/v1/subscription/portal',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const body = req.body as PortalBody | undefined;
      if (!body?.returnUrl) {
        Sentry.captureMessage('Portal missing returnUrl', 'warning');
        res.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'returnUrl required' },
        });
        return;
      }

      const result = await createPortalSession(
        auth.workspaceId,
        body.returnUrl,
      );

      logger.info('portal.opened', {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
      });

      res.status(200).json(result);
    }),
  },
];
