import {
  Dialer,
  InMemoryLockStore,
  CallerIdLockService,
  LocalPresenceService,
  extractAreaCode,
  type NumberPool,
  type PhoneNumber,
} from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// in-memory local presence toggle per user (replaced by user_profiles in phase 7)
const localPresenceEnabled = new Map<string, boolean>();

/** /v1/local-presence + /v1/caller-id routes */
export const localPresenceRoutes = (): RouteDefinition[] => {
  const dialer = new Dialer({
    credentials: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    },
    baseUrl: process.env.API_BASE_URL,
  });

  const lockService = new CallerIdLockService(new InMemoryLockStore());
  const presenceService = new LocalPresenceService({ maxDistanceMiles: 100 });

  return [
    // POST /v1/local-presence/toggle
    {
      method: 'POST',
      path: '/v1/local-presence/toggle',
      handler: errorHandler(async (req, res) => {
        try {
          const userId = req.auth?.userId;
          if (!userId) {
            res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'auth required' } });
            return;
          }

          const body = req.body as { enabled?: boolean } | undefined;
          if (typeof body?.enabled !== 'boolean') {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'enabled (boolean) is required' } });
            return;
          }

          localPresenceEnabled.set(userId, body.enabled);
          res.status(200).json({ enabled: body.enabled, userId });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';
          res.status(500).json({ error: { code: 'TOGGLE_FAILED', message } });
        }
      }),
    },

    // GET /v1/local-presence/preview
    {
      method: 'GET',
      path: '/v1/local-presence/preview',
      handler: errorHandler(async (req, res) => {
        try {
          const userId = req.auth?.userId;
          if (!userId) {
            res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'auth required' } });
            return;
          }

          const phoneNumber = req.query?.phoneNumber;
          if (!phoneNumber || !E164_REGEX.test(phoneNumber)) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'valid E.164 phoneNumber query param required' } });
            return;
          }

          // fromNumbers: comma-separated E.164 numbers (until phone management lands in phase 7)
          const fromNumbersRaw = req.query?.fromNumbers;
          if (!fromNumbersRaw) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'fromNumbers query param required (comma-separated E.164)' } });
            return;
          }

          const fromNumbers = fromNumbersRaw.split(',').filter((n) => E164_REGEX.test(n.trim()));
          if (!fromNumbers.length) {
            res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'at least one valid E.164 number required in fromNumbers' } });
            return;
          }

          const numbers: PhoneNumber[] = fromNumbers.map((n, i) => ({
            phoneNumber: n.trim(),
            areaCode: extractAreaCode(n.trim()) ?? '',
            isPrimary: i === 0,
            isActive: true,
          }));

          const pool: NumberPool = {
            numbers,
            primaryNumber: numbers[0],
          };

          const selection = await presenceService.selectNumber(pool, phoneNumber);
          const enabled = localPresenceEnabled.get(userId) ?? false;
          const customerAreaCode = extractAreaCode(phoneNumber) ?? '';

          if (!selection) {
            res.status(200).json({
              selectedNumber: numbers[0]?.phoneNumber ?? null,
              areaCode: numbers[0]?.areaCode ?? '',
              localMatch: false,
              proximityMatch: false,
              distanceMiles: null,
              isPrimary: true,
              customerAreaCode,
              localPresenceEnabled: enabled,
            });
            return;
          }

          res.status(200).json({
            selectedNumber: selection.phoneNumber,
            areaCode: selection.areaCode,
            localMatch: selection.localMatch,
            proximityMatch: selection.proximityMatch,
            distanceMiles: selection.distanceMiles ?? null,
            isPrimary: selection.isPrimary,
            customerAreaCode: selection.customerAreaCode ?? customerAreaCode,
            localPresenceEnabled: enabled,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';
          res.status(500).json({ error: { code: 'PREVIEW_FAILED', message } });
        }
      }),
    },

    // GET /v1/caller-id/locks
    {
      method: 'GET',
      path: '/v1/caller-id/locks',
      handler: errorHandler(async (req, res) => {
        try {
          const userId = req.auth?.userId;
          if (!userId) {
            res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'auth required' } });
            return;
          }

          const locks = await lockService.getUserLocks(userId);
          res.status(200).json({
            locks: locks.map((l) => ({
              phoneNumber: l.phoneNumber,
              callSid: l.callSid,
              acquiredAt: l.acquiredAt.toISOString(),
              expiresAt: l.expiresAt.toISOString(),
            })),
            count: locks.length,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';
          res.status(500).json({ error: { code: 'LOCKS_FETCH_FAILED', message } });
        }
      }),
    },

    // POST /v1/caller-id/locks/cleanup
    {
      method: 'POST',
      path: '/v1/caller-id/locks/cleanup',
      handler: errorHandler(async (req, res) => {
        try {
          const userId = req.auth?.userId;
          if (!userId) {
            res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'auth required' } });
            return;
          }

          const locks = await lockService.getUserLocks(userId);
          let cleaned = 0;

          for (const lock of locks) {
            try {
              const completed = await dialer.isCallCompleted(lock.callSid);
              if (completed) {
                await lockService.releaseLock(lock.callSid);
                cleaned++;
              }
            } catch (_err: unknown) {
              // call lookup failed — release stale lock defensively
              await lockService.releaseLock(lock.callSid);
              cleaned++;
            }
          }

          const remaining = locks.length - cleaned;
          res.status(200).json({ cleaned, remaining });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'unknown error';
          res.status(500).json({ error: { code: 'CLEANUP_FAILED', message } });
        }
      }),
    },
  ];
};
