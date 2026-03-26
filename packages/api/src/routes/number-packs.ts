import * as Sentry from '@sentry/node';
import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RouteDefinition } from './index.js';
import {
  getNumberPackStatus,
  createNumberPackCheckout,
  type NumberPackSize,
  type BillingInterval,
} from '../services/number-packs.js';

interface CheckoutBody {
  packSize: NumberPackSize;
  billingInterval: BillingInterval;
  successUrl?: string;
  cancelUrl?: string;
}

const VALID_PACK_SIZES: NumberPackSize[] = [5, 10, 50];
const VALID_INTERVALS: BillingInterval[] = ['month', 'year'];

export const numberPacksRoutes = (): RouteDefinition[] => [
  {
    method: 'GET',
    path: '/v1/number-packs/status',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const status = await getNumberPackStatus(auth.workspaceId);
      res.status(200).json(status);
    }),
  },

  {
    method: 'POST',
    path: '/v1/number-packs/checkout',
    handler: errorHandler(async (req, res) => {
      const auth = requireAuth(req, res);
      if (!auth) return;

      const body = req.body as CheckoutBody | undefined;

      if (!body?.packSize || !body?.billingInterval) {
        Sentry.captureMessage(
          'Number pack checkout missing required fields',
          'warning',
        );
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'packSize and billingInterval are required',
          },
        });
        return;
      }

      if (!VALID_PACK_SIZES.includes(body.packSize)) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'packSize must be 5, 10, or 50',
          },
        });
        return;
      }

      if (!VALID_INTERVALS.includes(body.billingInterval)) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'billingInterval must be "month" or "year"',
          },
        });
        return;
      }

      const origin = req.headers.origin || req.headers.referer || '';
      const successUrl =
        body.successUrl ||
        `${origin}/settings/dialer/subscription?pack_success=true`;
      const cancelUrl =
        body.cancelUrl || `${origin}/settings/dialer/subscription`;

      try {
        const result = await createNumberPackCheckout(
          auth.workspaceId,
          body.packSize,
          body.billingInterval,
          successUrl,
          cancelUrl,
        );

        const { createLogger } = await import('@consuelo/logger');
        createLogger('api:number-packs').info('checkout.initiated', {
          userId: auth.userId,
          workspaceId: auth.workspaceId,
          packSize: body.packSize,
          billingInterval: body.billingInterval,
        });

        res.status(200).json(result);
      } catch (err: unknown) {
        const error = err as { message?: string; status?: number };
        if (error.status === 400) {
          res.status(400).json({
            error: {
              code: 'BAD_REQUEST',
              message: error.message || 'Cannot purchase number pack',
            },
          });
          return;
        }
        throw err;
      }
    }),
  },
];
