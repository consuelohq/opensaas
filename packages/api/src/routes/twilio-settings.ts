import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import * as Sentry from '@sentry/node';
import { createLogger } from '@consuelo/logger';
import {
  getWorkspaceTwilioConfig,
  getDecryptedCredentials,
  saveByokConfig,
  deleteWorkspaceTwilioConfig,
  isHostedInstance,
  maskCredential,
} from '../services/twilio-config.js';
import { invalidateDialerCache } from '../shared/dialer.js';

const logger = createLogger('api:twilio-settings');

interface ByokBody {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
}

export const twilioSettingsRoutes = (): RouteDefinition[] => [
  {
    method: 'GET',
    path: '/v1/settings/twilio',
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      try {
        const config = await getWorkspaceTwilioConfig(workspaceId);
        const hosted = isHostedInstance();

        if (!config) {
          res.status(200).json({
            configured: false,
            mode: hosted ? 'hosted' : null,
            hostedAvailable: hosted,
          });
          return;
        }

        const creds = getDecryptedCredentials(config);
        res.status(200).json({
          configured: true,
          mode: config.mode,
          hostedAvailable: hosted,
          accountSid: maskCredential(creds.accountSid),
          twimlAppSid: config.twimlAppSid ?? null,
          ...(config.mode === 'byok' && creds.apiKey
            ? { apiKey: maskCredential(creds.apiKey) }
            : {}),
        });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Failed to get twilio config';
        res
          .status(500)
          .json({ error: { code: 'CONFIG_ERROR', message } });
      }
    }),
  },

  {
    method: 'PUT',
    path: '/v1/settings/twilio',
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as ByokBody | undefined;
      if (!body?.accountSid || !body?.authToken) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing accountSid or authToken',
          },
        });
        return;
      }

      try {
        // validate credentials against twilio API
        const twilio = await import('twilio');
        const createClient =
          twilio.default ??
          (twilio as unknown as { default: typeof twilio.default }).default;
        const testClient = createClient(body.accountSid, body.authToken);
        await testClient.api.accounts(body.accountSid).fetch();

        await saveByokConfig(workspaceId, {
          accountSid: body.accountSid,
          authToken: body.authToken,
          apiKey: body.apiKey,
          apiSecret: body.apiSecret,
        });

        invalidateDialerCache(workspaceId);

        logger.info('twilio BYOK config saved', { workspaceId });
        res.status(200).json({
          mode: 'byok',
          accountSid: maskCredential(body.accountSid),
        });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Failed to save twilio config';
        // distinguish validation errors from save errors
        const isValidationError =
          err instanceof Error &&
          (err.message.includes('authenticate') ||
            err.message.includes('401') ||
            err.message.includes('20003'));
        res.status(isValidationError ? 400 : 500).json({
          error: {
            code: isValidationError ? 'INVALID_CREDENTIALS' : 'CONFIG_ERROR',
            message: isValidationError
              ? 'Invalid Twilio credentials'
              : message,
          },
        });
      }
    }),
  },

  {
    method: 'DELETE',
    path: '/v1/settings/twilio',
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      try {
        await deleteWorkspaceTwilioConfig(workspaceId);
        invalidateDialerCache(workspaceId);

        logger.info('twilio config deleted', { workspaceId });
        res.status(200).json({ deleted: true });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Failed to delete twilio config';
        res
          .status(500)
          .json({ error: { code: 'CONFIG_ERROR', message } });
      }
    }),
  },
];
