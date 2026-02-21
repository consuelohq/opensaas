import * as Sentry from '@sentry/node';
import { errorHandler } from '../../middleware/error-handler.js';
import type { RouteDefinition } from '../index.js';
import { getSharedPool } from '../../shared/db.js';
import {
  GHLWebhookHandler,
  verifyWebhookSignature,
  type GHLWebhookPayload,
  type GHLSyncServiceInterface,
} from '../../services/ghl-webhook.js';

type Pool = {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
};

const getPool = getSharedPool;

const stubSyncService: GHLSyncServiceInterface = {
  findMapping: async () => null,
  createTwentyPerson: async () => ({ id: '' }),
  updateTwentyPerson: async () => {
    /* noop */
  },
  createSyncMapping: async () => {
    /* noop */
  },
  updateSyncMapping: async () => {
    /* noop */
  },
  mapGhlContactToTwenty: () => ({}),
  handleOpportunitySync: async () => {
    /* noop */
  },
};

export const ghlWebhookRoutes = (): RouteDefinition[] => {
  let webhookHandler: GHLWebhookHandler | null = null;

  const getWebhookHandler = async (): Promise<GHLWebhookHandler> => {
    try {
      if (webhookHandler === null) {
        const db = await getPool();
        webhookHandler = new GHLWebhookHandler(stubSyncService, db);
      }
      return webhookHandler;
    } catch (err: unknown) {
      webhookHandler = null;
      throw err;
    }
  };

  return [
    // POST /v1/webhooks/ghl — receive GHL webhook events
    {
      method: 'POST',
      path: '/v1/webhooks/ghl',
      auth: false,
      handler: errorHandler(async (req, res) => {
        const webhookSecret = process.env.GHL_WEBHOOK_SECRET;
        if (webhookSecret) {
          const signature = req.headers['x-ghl-signature'];
          const rawBody =
            typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
          if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
            Sentry.captureMessage(
              'GHL webhook signature verification failed',
              'warning',
            );
            res.status(401).json({
              error: {
                code: 'INVALID_SIGNATURE',
                message: 'webhook signature verification failed',
              },
            });
            return;
          }
        }

        const payload = req.body as GHLWebhookPayload;
        if (!payload.type || !payload.locationId) {
          res.status(400).json({
            error: {
              code: 'INVALID_PAYLOAD',
              message: 'missing type or locationId',
            },
          });
          return;
        }

        const handler = await getWebhookHandler();
        await handler.handleWebhook(payload);
        res.status(200).json({ received: true });
      }),
    },
  ];
};
