import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import * as Sentry from '@sentry/node';
import {
  getWorkspaceTwilioConfig,
  getDecryptedCredentials,
  saveByokConfig,
  deleteWorkspaceTwilioConfig,
  isHostedInstance,
  maskCredential,
  ensureOrCreateTwimlApp,
  syncTwimlAppUrl,
} from '../services/twilio-config.js';
import { invalidateDialerCache } from '../shared/dialer.js';

// lazy logger to satisfy @nx/enforce-module-boundaries (peer dep)
let _settingsLogger: { info: (message: string, attributes?: Record<string, unknown>) => void; warn: (message: string, attributes?: Record<string, unknown>) => void; error: (message: string, attributes?: Record<string, unknown>) => void } | null = null;
const getLogger = async () => {
  if (!_settingsLogger) {
    const { createLogger } = await import('@consuelo/logger');
    _settingsLogger = createLogger('api:twilio-settings');
  }
  return _settingsLogger;
};

interface ByokBody {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
}

export const twilioSettingsRoutes = (): RouteDefinition[] => [
  // health check — literal route before any param routes (ROUTE_ORDER)
  {
    method: 'GET',
    path: '/v1/settings/twilio/health',
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
        if (!config || !config.twimlAppSid) {
          res.status(200).json({
            healthy: false,
            issues: ['No TwiML App configured for this workspace'],
          });
          return;
        }

        const creds = getDecryptedCredentials(config);
        const issues: string[] = [];

        // try to sync URL (also verifies app exists)
        try {
          const syncResult = await syncTwimlAppUrl(
            creds.accountSid,
            creds.authToken,
            config.twimlAppSid,
          );
          if (syncResult.updated) {
            issues.push('TwiML App voice URL was outdated and has been updated');
          }
        } catch (fetchErr: unknown) {
          const fetchMessage = fetchErr instanceof Error ? fetchErr.message : 'unknown error';
          // app might be deleted — try to re-create
          if (fetchMessage.includes('20404') || fetchMessage.includes('not found')) {
            try {
              const newSid = await ensureOrCreateTwimlApp(
                creds.accountSid,
                creds.authToken,
                workspaceId,
              );
              invalidateDialerCache(workspaceId);
              issues.push(`TwiML App was missing and has been re-created (${newSid})`);
            } catch (createErr: unknown) {
              const createMessage = createErr instanceof Error ? createErr.message : 'unknown error';
              res.status(200).json({
                healthy: false,
                twimlAppSid: config.twimlAppSid,
                issues: [`TwiML App deleted and re-creation failed: ${createMessage}`],
              });
              return;
            }
          } else {
            issues.push(`Failed to verify TwiML App: ${fetchMessage}`);
          }
        }

        const updatedConfig = await getWorkspaceTwilioConfig(workspaceId);
        res.status(200).json({
          healthy: issues.length === 0 || issues.every((i) => i.includes('has been')),
          twimlAppSid: updatedConfig?.twimlAppSid ?? config.twimlAppSid,
          issues,
        });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Health check failed';
        res
          .status(500)
          .json({ error: { code: 'HEALTH_CHECK_ERROR', message } });
      }
    }),
  },

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
    method: 'POST',
    path: '/v1/settings/twilio/test',
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
        const twilio = await import('twilio');
        const createClient =
          twilio.default ??
          (twilio as unknown as { default: typeof twilio.default }).default;
        const testClient = createClient(body.accountSid, body.authToken);
        await testClient.api.accounts(body.accountSid).fetch();
        res.status(200).json({ valid: true });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Connection test failed';
        const isAuthError =
          err instanceof Error &&
          (err.message.includes('authenticate') ||
            err.message.includes('401') ||
            err.message.includes('20003'));
        res.status(isAuthError ? 400 : 500).json({
          valid: false,
          error: {
            code: isAuthError ? 'INVALID_CREDENTIALS' : 'CONNECTION_ERROR',
            message: isAuthError ? 'Invalid Twilio credentials' : message,
          },
        });
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

        // auto-create TwiML App (best-effort — creds are saved regardless)
        let twimlAppSid: string | undefined;
        let twimlWarning: string | undefined;
        try {
          twimlAppSid = await ensureOrCreateTwimlApp(
            body.accountSid,
            body.authToken,
            workspaceId,
          );
        } catch (twimlErr: unknown) {
          const twimlMessage = twimlErr instanceof Error ? twimlErr.message : 'unknown error';
          twimlWarning = `TwiML App auto-creation failed: ${twimlMessage}`;
          (await getLogger()).warn('TwiML App auto-creation failed for BYOK', {
            workspaceId,
            error: twimlMessage,
          });
        }

        invalidateDialerCache(workspaceId);

        (await getLogger()).info('twilio BYOK config saved', { workspaceId, twimlAppSid });
        res.status(200).json({
          mode: 'byok',
          accountSid: maskCredential(body.accountSid),
          twimlAppSid: twimlAppSid ?? null,
          ...(twimlWarning ? { warning: twimlWarning } : {}),
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

        (await getLogger()).info('twilio config deleted', { workspaceId });
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
