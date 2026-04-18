// eslint-disable-next-line @nx/enforce-module-boundaries
import type {
  TransferType,
  TransferStatus,
  RingTimeMetrics,
} from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import { redisService } from '../services/redis.js';
import type { RouteDefinition } from './index.js';
import type { ApiRequest, ApiResponse } from '../types.js';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import {
  sharedDialer,
  sharedCallerIdLockService,
  getDialerForWorkspace,
} from '../shared/dialer.js';
import {
  getWorkspaceTwilioConfig,
  getDecryptedCredentials,
  isHostedInstance,
  ensureOrCreateTwimlApp,
} from '../services/twilio-config.js';
import { createPhoneNumberAddonCheckout } from '../services/phone-number-addons.js';
import { recommendPhoneNumbers } from '../services/phone-number-recommendations.js';
import {
  findWorkspacePhoneNumberBySid,
  getPhoneNumberEntitlement,
  listWorkspacePhoneNumbers,
  recordProvisionedPhoneNumber,
  releaseWorkspacePhoneNumber,
  type PhoneNumberEntitlement,
  type WorkspacePhoneNumber,
  type WorkspacePhoneNumberOwnershipType,
} from '../services/workspace-phone-numbers.js';
type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

let _logger: Logger | null = null;

const getLogger = async (): Promise<Logger> => {
  try {
    if (!_logger) {
      // eslint-disable-next-line @nx/enforce-module-boundaries
      const { createLogger } = await import('@consuelo/logger');
      _logger = createLogger('api:audit');
    }
    return _logger!;
  } catch (err: unknown) {
    _logger = null;
    const message = err instanceof Error ? err.message : 'unknown error';
    throw new Error(`[getLogger] failed: ${message}`);
  }
};

// in-memory tracking for ring time (will move to redis later)
const ringingStartTimes = new Map<string, number>();

// legacy singleton for webhook routes (no auth context)
const getLegacyDialer = sharedDialer;
const getCallerIdLockService = sharedCallerIdLockService;

const mapWorkspacePhoneNumberToResponse = (number: WorkspacePhoneNumber) => ({
  areaCode: number.areaCode,
  friendlyName: number.friendlyName ?? '',
  isPrimary: number.isPrimary,
  ownershipType: number.ownershipType,
  phoneNumber: number.phoneNumber,
  sid: number.twilioSid ?? '',
});

const getProvisionOwnershipType = (
  entitlement: PhoneNumberEntitlement,
): WorkspacePhoneNumberOwnershipType => {
  if (entitlement.usedSlots < entitlement.includedSlots) {
    return 'included';
  }

  if (
    entitlement.usedSlots <
    entitlement.includedSlots + entitlement.numberPackSlots
  ) {
    return 'pack';
  }

  return 'add_on';
};

const buildWorkspaceNumberPool = async (workspaceId: string) => {
  const dialer = await getDialerForWorkspace(workspaceId);
  const numbers = await dialer.listNumbers();

  let primarySid: string | null = null;
  try {
    primarySid = await redisService.getPrimaryNumber(workspaceId);
  } catch (err: unknown) {
    void err;
    primarySid = null;
  }

  const workspaceNumbers = await listWorkspacePhoneNumbers(
    workspaceId,
    numbers,
    primarySid,
  );

  return {
    dialer,
    numberPool: {
      numbers: workspaceNumbers,
      primaryNumber:
        workspaceNumbers.find((number) => number.isPrimary) ??
        workspaceNumbers[0],
    },
  };
};

/**
 * Validate Twilio signature on webhook requests.
 * Twilio sends a signature in the X-Twilio-Signature header.
 */
export const validateTwilioSignature = async (
  req: ApiRequest,
  res: ApiResponse,
): Promise<boolean> => {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    res.status(500).json({
      error: {
        code: 'CONFIG_ERROR',
        message: 'TWILIO_AUTH_TOKEN is not configured',
      },
    });
    return false;
  }

  const signature = req.headers['x-twilio-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing Twilio signature',
      },
    });
    return false;
  }

  const protocol = req.headers['x-forwarded-proto'] ?? 'https';
  const host = req.headers.host ?? '';
  const url = `${protocol}://${host}${req.path}`;

  try {
    const twilio = await import('twilio');
    const isValid = twilio.default.validateRequest(
      authToken,
      signature,
      url,
      req.body as Record<string, string> | undefined,
    );

    if (!isValid) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Twilio signature',
        },
      });
      return false;
    }

    return true;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Signature validation failed';
    res.status(500).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
    return false;
  }
};

interface TransferRecord {
  transferId: string;
  status: TransferStatus;
  transferType: TransferType;
  recipientPhone: string;
  conferenceName: string;
  conferenceSid: string | null;
  transferCallSid: string | null;
  customerMuted: boolean;
  initiatedAt: string;
  connectedAt: string | null;
  completedAt: string | null;
}

interface TransferBody {
  to: string;
  from?: string;
  type: TransferType;
  conferenceName?: string;
}

interface HoldBody {
  hold: boolean;
  participantCallSid?: string;
}

interface CompleteBody {
  agentCallSid: string;
  conferenceSid: string;
}

interface CancelBody {
  transferCallSid: string;
  conferenceSid: string;
}

/** Twilio status callback events that indicate call failure */
const FAILURE_STATUSES = new Set(['failed', 'busy', 'no-answer', 'canceled']);

// Maps agent callSid to callerIdNumber (for lock release on call end)
const callerIdMap = new Map<string, string>(); // callSid → callerIdNumber

/** /v1/voice routes — token, TwiML webhook, transfers, hold */

const recachePhoneNumbers = async (workspaceId: string) => {
  try {
    const dialer = await getDialerForWorkspace(workspaceId);
    const numbers = await dialer.listNumbers();
    let primarySid: string | null = null;
    try {
      primarySid = await redisService.getPrimaryNumber(workspaceId);
    } catch {
      /* */
    }

    const workspaceNumbers = await listWorkspacePhoneNumbers(
      workspaceId,
      numbers,
      primarySid,
    );
    const phoneNumbers = workspaceNumbers.map(mapWorkspacePhoneNumberToResponse);
    await redisService.setPhoneNumbersCache(workspaceId, { phoneNumbers });
  } catch {
    /* best effort */
  }
};

export const voiceRoutes = (): RouteDefinition[] => [
  // --- literal routes first (ROUTE_ORDER) ---

  {
    method: 'GET',
    path: '/v1/phone-numbers',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      try {
        const workspaceId = req.auth!.workspaceId;
        const cached = await redisService.getPhoneNumbersCache(workspaceId);
        if (cached) {
          res.json(JSON.parse(cached));
          return;
        }

        const dialer = await getDialerForWorkspace(workspaceId);
        const numbers = await dialer.listNumbers();

        let primarySid: string | null = null;
        try {
          primarySid = await redisService.getPrimaryNumber(workspaceId);
        } catch {
          /* */
        }

        const workspaceNumbers = await listWorkspacePhoneNumbers(
          workspaceId,
          numbers,
          primarySid,
        );
        const response = {
          phoneNumbers: workspaceNumbers.map(mapWorkspacePhoneNumberToResponse),
        };

        await redisService.setPhoneNumbersCache(workspaceId, response);
        res.json(response);
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Failed to fetch phone numbers';
        res
          .status(500)
          .json({ error: { code: 'PHONE_NUMBERS_ERROR', message } });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/phone-numbers/available',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const areaCode = req.query?.areaCode as string | undefined;
      if (!areaCode || !/^\d{3}$/.test(areaCode)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'areaCode must be a 3-digit string',
          },
        });
        return;
      }

      const country = (req.query?.country as string) ?? 'US';
      const limit = Math.min(Number(req.query?.limit) || 10, 20);

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const available = await dialer.searchAvailableNumbers({
          areaCode,
          country,
          limit,
        });
        res.json({ available });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message = err instanceof Error ? err.message : 'Search failed';
        res.status(500).json({ error: { code: 'SEARCH_ERROR', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/phone-numbers/recommendations',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as { limit?: number; query?: string } | undefined;
      if (!body?.query || body.query.trim().length < 2) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'query must be at least 2 characters',
          },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(workspaceId);
        const available = await recommendPhoneNumbers(dialer, body.query, {
          limit: body.limit,
        });
        res.json({ available });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Recommendation search failed';
        res.status(500).json({
          error: { code: 'RECOMMENDATION_ERROR', message },
        });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/phone-numbers/checkout',
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as
        | { cancelUrl?: string; quantity?: number; successUrl?: string }
        | undefined;
      const quantity = body?.quantity ?? 1;

      if (!Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'quantity must be a positive integer',
          },
        });
        return;
      }

      try {
        const origin = req.headers.origin ?? 'http://localhost:3000';
        const result = await createPhoneNumberAddonCheckout(
          workspaceId,
          quantity,
          body?.successUrl ??
            `${origin}/settings/dialer/subscription?phone_number_success=true`,
          body?.cancelUrl ?? `${origin}/settings/dialer/subscription`,
        );
        res.json(result);
      } catch (err: unknown) {
        Sentry.captureException(err);
        const status =
          typeof (err as { status?: unknown })?.status === 'number'
            ? (err as { status: number }).status
            : 500;
        const message =
          err instanceof Error ? err.message : 'Checkout session failed';
        res.status(status).json({ error: { code: 'CHECKOUT_ERROR', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/phone-numbers/provision',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as
        | { areaCode?: string; phoneNumber?: string; friendlyName?: string }
        | undefined;
      if (!body?.areaCode && !body?.phoneNumber) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'areaCode or phoneNumber required',
          },
        });
        return;
      }

      try {
        const entitlement = await getPhoneNumberEntitlement(workspaceId);
        if (!entitlement.canProvision) {
          res.status(400).json({
            error: {
              code: 'PHONE_NUMBER_SLOT_REQUIRED',
              message: 'No phone number slots available for this workspace',
            },
          });
          return;
        }

        const dialer = await getDialerForWorkspace(workspaceId);
        const voiceUrl = process.env.API_BASE_URL
          ? `${process.env.API_BASE_URL}/v1/voice/twiml`
          : undefined;

        const result = await dialer.provisionNumber({
          areaCode: body.areaCode ?? '',
          phoneNumber: body.phoneNumber,
          friendlyName: body.friendlyName,
          voiceUrl,
        });

        if (!result.success) {
          res.status(400).json({
            error: {
              code: 'PROVISION_FAILED',
              message: result.error ?? 'Provision failed',
            },
          });
          return;
        }

        if (!result.sid || !result.phoneNumber) {
          res.status(500).json({
            error: {
              code: 'PROVISION_ERROR',
              message: 'Provision response missing sid or phone number',
            },
          });
          return;
        }

        const ownershipType = getProvisionOwnershipType(entitlement);

        try {
          await recordProvisionedPhoneNumber(workspaceId, {
            areaCode: result.areaCode ?? body.areaCode ?? '',
            friendlyName: body.friendlyName,
            ownershipType,
            phoneNumber: result.phoneNumber,
            sid: result.sid,
          });
        } catch (recordError: unknown) {
          Sentry.captureException(recordError, {
            extra: { context: 'record_provisioned_phone_number', workspaceId },
          });

          const releaseResult = await dialer.releaseNumber(result.sid);
          if (!releaseResult.success) {
            Sentry.captureMessage(
              '[Voice] failed to roll back provisioned number after db error',
              {
                level: 'error',
                extra: {
                  releaseError: releaseResult.error,
                  sid: result.sid,
                  workspaceId,
                },
              },
            );
          }

          const message =
            recordError instanceof Error
              ? recordError.message
              : 'Failed to persist provisioned number';
          res.status(500).json({
            error: { code: 'PROVISION_ERROR', message },
          });
          return;
        }

        if (entitlement.usedSlots === 0) {
          try {
            await redisService.setPrimaryNumber(workspaceId, result.sid);
          } catch (err: unknown) {
            Sentry.captureException(err, {
              extra: { context: 'auto_set_primary', workspaceId },
            });
          }
        }

        await recachePhoneNumbers(workspaceId);
        res.json({ ...result, ownershipType });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message = err instanceof Error ? err.message : 'Provision failed';
        res.status(500).json({ error: { code: 'PROVISION_ERROR', message } });
      }
    }),
  },

  {
    method: 'PUT',
    path: '/v1/phone-numbers/:sid/primary',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const sid = req.params?.sid;
      if (!sid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing sid' },
        });
        return;
      }

      try {
        const number = await findWorkspacePhoneNumberBySid(workspaceId, sid);
        if (!number) {
          res.status(404).json({
            error: {
              code: 'NUMBER_NOT_FOUND',
              message: 'Number not found in workspace',
            },
          });
          return;
        }

        await redisService.setPrimaryNumber(workspaceId, sid);
        await recachePhoneNumbers(workspaceId);
        res.json({ success: true, primarySid: sid });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Set primary failed';
        res.status(500).json({ error: { code: 'SET_PRIMARY_ERROR', message } });
      }
    }),
  },

  {
    method: 'DELETE',
    path: '/v1/phone-numbers/:sid',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const sid = req.params?.sid;
      if (!sid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing sid' },
        });
        return;
      }

      try {
        const number = await findWorkspacePhoneNumberBySid(workspaceId, sid);
        if (!number) {
          res.status(404).json({
            error: {
              code: 'NUMBER_NOT_FOUND',
              message: 'Number not found in workspace',
            },
          });
          return;
        }

        const dialer = await getDialerForWorkspace(workspaceId);
        const result = await dialer.releaseNumber(sid);

        if (!result.success) {
          res.status(400).json({
            error: {
              code: 'RELEASE_FAILED',
              message: result.error ?? 'Release failed',
            },
          });
          return;
        }

        await releaseWorkspacePhoneNumber(workspaceId, sid);

        try {
          const primarySid = await redisService.getPrimaryNumber(workspaceId);
          if (primarySid === sid) {
            await redisService.deletePrimaryNumber(workspaceId);
          }
        } catch (err: unknown) {
          Sentry.captureException(err, {
            extra: { context: 'clear_primary_on_release', workspaceId },
          });
        }

        await recachePhoneNumbers(workspaceId);
        res.json({ success: true });
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message = err instanceof Error ? err.message : 'Release failed';
        res.status(500).json({ error: { code: 'RELEASE_ERROR', message } });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/voice/token',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const voiceLogger = await getLogger();

      try {
        voiceLogger.debug('Token request received', { userId, workspaceId });
        const dialer = await getDialerForWorkspace(workspaceId);
        const result = await dialer.getToken(userId);
        voiceLogger.info('Token generated successfully', {
          userId,
          workspaceId,
          identity: result.identity,
        });
        res.json(result);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Token generation failed';
        const errorStack = err instanceof Error ? err.stack : undefined;
        voiceLogger.error('[voice/token] Token generation failed', {
          userId,
          workspaceId,
          errorType: err?.constructor?.name ?? 'unknown',
          errorMessage,
          errorStack,
        });
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            tags: { endpoint: '/v1/voice/token' },
            extra: { userId, workspaceId, errorMessage },
          },
        );
        res
          .status(500)
          .json({ error: { code: 'TOKEN_ERROR', message: errorMessage } });
      }
    }),
  },

  // Preflight endpoint to check/lock caller ID before initiating call
  {
    method: 'POST',
    path: '/v1/voice/preflight',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as
        | {
            callerId?: string;
            to?: string;
            localPresence?: boolean;
            callSid?: string;
          }
        | undefined;
      const callerId = body?.callerId;
      const to = body?.to;
      const callSid = body?.callSid;
      const localPresence = body?.localPresence ?? false;

      if (!callerId && !to) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing "callerId" or "to"',
          },
        });
        return;
      }

      try {
        const workspaceId = req.auth?.workspaceId ?? '';
        const resolvedCallerId =
          callerId && !localPresence
            ? {
                callerIdNumber: callerId,
                selectionMethod: 'manual' as const,
                localMatch: false,
                proximityMatch: false,
                distanceMiles: undefined,
                isPrimary: false,
                customerAreaCode: undefined,
              }
            : await (async () => {
                const dialer = await getDialerForWorkspace(workspaceId);
                let numberPool;

                try {
                  ({ numberPool } = await buildWorkspaceNumberPool(workspaceId));
                } catch (err: unknown) {
                  Sentry.captureException(err, {
                    extra: {
                      context: 'voice.preflight.buildWorkspaceNumberPool',
                      callerId,
                      localPresence,
                      to,
                      userId,
                      workspaceId,
                    },
                  });

                  const numbers = await dialer.listNumbers();
                  numberPool = {
                    numbers,
                    primaryNumber:
                      numbers.find((number) => number.isPrimary) ?? numbers[0],
                  };
                }

                try {
                  return dialer.resolveCallerId(
                    {
                      to: to ?? '',
                      from: '',
                      callerIdNumber: localPresence ? undefined : callerId,
                      localPresence,
                    },
                    numberPool,
                  );
                } catch (err: unknown) {
                  Sentry.captureException(err, {
                    extra: {
                      context: 'voice.preflight.resolveCallerId',
                      callerId,
                      localPresence,
                      to,
                      userId,
                      workspaceId,
                    },
                  });
                  throw err;
                }
              })();

        if (!resolvedCallerId.callerIdNumber) {
          res.status(400).json({
            error: {
              code: 'NO_CALLER_ID_AVAILABLE',
              message: 'No caller ID available for this call',
            },
          });
          return;
        }

        const acquired = await getCallerIdLockService().acquireLock(
          resolvedCallerId.callerIdNumber,
          userId,
          callSid ?? `preflight-${randomUUID()}`,
        );

        if (!acquired) {
          res.status(409).json({
            error: {
              code: 'CALLER_ID_LOCKED',
              message: 'Number in use by another agent',
            },
          });
          return;
        }

        if (callerId && !to && body?.localPresence === undefined) {
          res.status(200).json({
            success: true,
            callerId: resolvedCallerId.callerIdNumber,
          });
        } else {
          res.status(200).json({
            success: true,
            callerId: resolvedCallerId.callerIdNumber,
            selectionMethod: resolvedCallerId.selectionMethod,
            localMatch: resolvedCallerId.localMatch,
            proximityMatch: resolvedCallerId.proximityMatch,
            distanceMiles: resolvedCallerId.distanceMiles ?? null,
            customerAreaCode: resolvedCallerId.customerAreaCode ?? null,
          });
        }
        (await getLogger()).info('voice.preflight', {
          action: 'voice.preflight',
          userId: req.auth?.userId ?? 'anonymous',
          outcome: 'success',
          selectionMethod: resolvedCallerId.selectionMethod,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Lock acquisition failed';
        Sentry.captureException(
          err instanceof Error ? err : new Error(message),
          {
            extra: {
              callerId,
              to,
              userId,
              localPresence,
              context: 'preflight',
            },
          },
        );
        res.status(500).json({ error: { code: 'LOCK_ERROR', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/voice/twiml',
    auth: false,
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;
      const body = req.body as Record<string, string> | undefined;
      const to = body?.To ?? '';
      const from = body?.From ?? '';
      const callSid = body?.CallSid ?? '';
      const conferenceName = `conf-${randomUUID()}`;

      try {
        await redisService.setConferenceName(callSid, conferenceName);
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: {
              context: 'twiml_redis_setConferenceName',
              callSid,
              conferenceName,
            },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        createLogger('voice:twiml').error(
          'Failed to store conference mapping',
          {
            callSid,
            conferenceName,
            error: message,
          },
        );
      }

      const streamUrl = process.env.API_BASE_URL
        ? process.env.API_BASE_URL.replace(/^http/, 'ws') + '/v1/coaching/media'
        : undefined;
      const twiml = getLegacyDialer().generateConferenceTwiml(conferenceName, {
        participantLabel: 'agent',
        endOnExit: true,
        streamUrl,
        streamParameters: callSid ? { callId: callSid } : undefined,
      });

      // store mapping for lock release on call end
      if (from) {
        callerIdMap.set(callSid, from);
      }

      // send TwiML first so agent can connect and create the conference
      res.type('text/xml').status(200).send(twiml);

      // dial the customer into the conference (truly fire-and-forget)
      if (to && !to.startsWith('client:')) {
        const statusCallback = process.env.API_BASE_URL
          ? `${process.env.API_BASE_URL}/v1/webhooks/status`
          : undefined;

        void (async () => {
          try {
            const customerResult =
              await getLegacyDialer().addCustomerToConference(
                conferenceName,
                to,
                from,
                statusCallback,
              );
            try {
              await redisService.setCustomerConferenceName(
                customerResult.callSid,
                conferenceName,
              );
            } catch (err: unknown) {
              Sentry.captureException(
                err instanceof Error ? err : new Error(String(err)),
                {
                  extra: {
                    context: 'twiml_redis_setCustomerConferenceName',
                    callSid: customerResult.callSid,
                    conferenceName,
                  },
                },
              );
              const message =
                err instanceof Error ? err.message : 'Redis operation failed';
              // eslint-disable-next-line @nx/enforce-module-boundaries
              const { createLogger } = await import('@consuelo/logger');
              createLogger('voice:twiml').error(
                'Failed to store customer mapping',
                {
                  callSid: customerResult.callSid,
                  conferenceName,
                  error: message,
                },
              );
            }
          } catch (err: unknown) {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              {
                extra: { context: 'twiml_customer_dial', conferenceName, to },
              },
            );
            const message =
              err instanceof Error ? err.message : 'Customer dial failed';
            // eslint-disable-next-line @nx/enforce-module-boundaries
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:twiml').error('Customer dial failed', {
              conferenceName,
              to,
              error: message,
            });
          }
        })();
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/voice/active-call',
    handler: errorHandler(async (req, res) => {
      const conferenceName = req.query?.conferenceName as string | undefined;

      if (!conferenceName) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing conferenceName',
          },
        });
        return;
      }

      try {
        const conferenceSid =
          await getLegacyDialer().conference.findConferenceSid(conferenceName);

        if (conferenceSid) {
          (await getLogger()).info('Active conference found', {
            action: 'Active conference found',
            conferenceName,
            conferenceSid,
            outcome: 'success',
          });
          res.json({ active: true, conferenceSid });
        } else {
          (await getLogger()).info('No active conference', {
            action: 'voice.no_active_conference',
            conferenceName,
            outcome: 'success',
          });
          res.json({ active: false });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Conference check failed';
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        createLogger('voice:active-call').error(
          'Failed to check active conference',
          {
            conferenceName,
            error: message,
          },
        );
        res.status(500).json({ error: { code: 'CHECK_FAILED', message } });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/voice/status',
    handler: errorHandler(async (req, res) => {
      const workspaceId = req.auth?.workspaceId;
      if (!workspaceId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      try {
        const cachedStatus =
          await redisService.getVoiceStatusCache(workspaceId);
        if (cachedStatus) {
          res.json(JSON.parse(cachedStatus));
          return;
        }

        const config = await getWorkspaceTwilioConfig(workspaceId);
        const hosted = isHostedInstance();

        // no config row — check hosted, then legacy env vars
        if (!config) {
          if (hosted) {
            res.json({
              mode: 'hosted',
              configured: false,
              twilioConnected: false,
              hasPhoneNumbers: false,
              twimlAppConfigured: false,
              error: null,
            });
            return;
          }

          // legacy env var fallback (self-hosted single-tenant)
          const legacySid = process.env.TWILIO_ACCOUNT_SID ?? '';
          const legacyToken = process.env.TWILIO_AUTH_TOKEN ?? '';
          if (legacySid && legacyToken) {
            try {
              const dialer = await getDialerForWorkspace(workspaceId);
              const numbers = await dialer.listNumbers();
              let hasTwiml = !!process.env.TWILIO_TWIML_APP_SID;
              if (!hasTwiml && process.env.API_BASE_URL) {
                try {
                  await ensureOrCreateTwimlApp(legacySid, legacyToken);
                  hasTwiml = true;
                } catch {
                  // twiml app creation/lookup failed
                }
              }
              const response = {
                mode: 'byok',
                configured: numbers.length > 0 && hasTwiml,
                twilioConnected: true,
                hasPhoneNumbers: numbers.length > 0,
                twimlAppConfigured: hasTwiml,
                error: null,
              };
              await redisService.setVoiceStatusCache(workspaceId, response);
              res.json(response);
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : 'Connection failed';
              Sentry.captureException(
                err instanceof Error ? err : new Error(message),
              );
              res.json({
                mode: 'byok',
                configured: false,
                twilioConnected: false,
                hasPhoneNumbers: false,
                twimlAppConfigured: false,
                error: message,
              });
            }
            return;
          }

          // no credentials at all
          res.json({
            mode: 'byok',
            configured: false,
            twilioConnected: false,
            hasPhoneNumbers: false,
            twimlAppConfigured: false,
            error: null,
          });
          return;
        }

        // config exists — validate credentials
        let creds;
        try {
          creds = getDecryptedCredentials(config);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Credential decryption failed';
          res.json({
            mode: config.mode,
            configured: false,
            twilioConnected: false,
            hasPhoneNumbers: false,
            twimlAppConfigured: !!config.twimlAppSid,
            error: message,
          });
          return;
        }

        // try to connect and list numbers
        let twilioConnected = false;
        let hasPhoneNumbers = false;
        try {
          const dialer = await getDialerForWorkspace(workspaceId);
          const numbers = await dialer.listNumbers();
          twilioConnected = true;
          hasPhoneNumbers = numbers.length > 0;
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Connection failed';
          res.json({
            mode: config.mode,
            configured: false,
            twilioConnected: false,
            hasPhoneNumbers: false,
            twimlAppConfigured: !!config.twimlAppSid,
            error: message,
          });
          return;
        }

        const twimlAppConfigured = !!creds.twimlAppSid;

        const response = {
          mode: config.mode,
          configured: twilioConnected && twimlAppConfigured,
          twilioConnected,
          hasPhoneNumbers,
          twimlAppConfigured,
          error: null,
        };
        await redisService.setVoiceStatusCache(workspaceId, response);
        res.json(response);
      } catch (err: unknown) {
        Sentry.captureException(err);
        const message =
          err instanceof Error ? err.message : 'Status check failed';
        res.json({
          mode: isHostedInstance() ? 'hosted' : 'byok',
          configured: false,
          twilioConnected: false,
          hasPhoneNumbers: false,
          twimlAppConfigured: false,
          error: message,
        });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/voice/conference-by-call/:callSid',
    handler: errorHandler(async (req, res) => {
      const callSid = req.params?.callSid;

      if (!callSid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing callSid' },
        });
        return;
      }

      try {
        const conferenceName = await redisService.getConferenceName(callSid);

        if (conferenceName) {
          res.json({ conferenceName });
        } else {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Conference not found for callSid',
            },
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to get conference name';
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        createLogger('voice:conference-by-call').error(
          'Failed to get conference name',
          {
            callSid,
            error: message,
          },
        );
        res.status(500).json({ error: { code: 'GET_FAILED', message } });
      }
    }),
  },

  // --- literal "transfer" routes first (ROUTE_ORDER) ---

  {
    method: 'POST',
    path: '/v1/calls/transfer/:transferId/mute-customer',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const transferId = req.params?.transferId;
      if (!transferId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing transferId' },
        });
        return;
      }

      let record: TransferRecord | null = null;
      try {
        const raw = await redisService.getTransfer(transferId);
        if (raw) {
          record = raw as unknown as TransferRecord;
        }
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'mute_getTransfer', transferId },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        res.status(500).json({ error: { code: 'REDIS_ERROR', message } });
        return;
      }

      if (!record) {
        res.status(404).json({
          error: {
            code: 'TRANSFER_NOT_FOUND',
            message: 'Transfer not found',
          },
        });
        return;
      }

      if (record.transferType !== 'warm') {
        res.status(400).json({
          error: {
            code: 'INVALID_TRANSFER_TYPE',
            message: 'Mute only available for warm transfers',
          },
        });
        return;
      }

      if (
        record.status === 'completed' ||
        record.status === 'cancelled' ||
        record.status === 'failed'
      ) {
        res.status(400).json({
          error: {
            code: 'TRANSFER_NOT_ACTIVE',
            message: 'Transfer is no longer active',
          },
        });
        return;
      }

      const body = req.body as { muted?: boolean } | undefined;
      if (body?.muted === undefined) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing "muted" boolean',
          },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const conferenceSid =
          record.conferenceSid ??
          (await dialer.conference.findConferenceSid(record.conferenceName));
        if (!conferenceSid) {
          res.status(404).json({
            error: {
              code: 'CONFERENCE_NOT_FOUND',
              message: 'Conference not in-progress',
            },
          });
          return;
        }

        const participants = await dialer.listParticipants(conferenceSid);
        const customer = participants.find(
          (p: { label: string }) => p.label === 'customer',
        );
        if (!customer) {
          res.status(404).json({
            error: {
              code: 'PARTICIPANT_NOT_FOUND',
              message: 'Customer not in conference',
            },
          });
          return;
        }

        await dialer.muteParticipant(
          conferenceSid,
          customer.callSid,
          body.muted,
        );
        record.customerMuted = body.muted;

        try {
          await redisService.setTransfer(
            transferId,
            record as unknown as Record<string, unknown>,
          );
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: { context: 'mute_setTransfer', transferId },
            },
          );
          const message =
            err instanceof Error ? err.message : 'Redis operation failed';
          // eslint-disable-next-line @nx/enforce-module-boundaries
          const { createLogger } = await import('@consuelo/logger');
          createLogger('voice:mute').error('Failed to update transfer record', {
            transferId,
            error: message,
          });
        }

        res.status(200).json({ transferId, customerMuted: body.muted });
        (await getLogger()).info('transfer.mute', {
          action: 'transfer.mute',
          userId: req.auth?.userId ?? 'anonymous',
          outcome: 'success',
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'muteParticipant', transferId },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Mute toggle failed';
        res.status(502).json({ error: { code: 'TWILIO_ERROR', message } });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/calls/transfer/:transferId/status',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const transferId = req.params?.transferId;
      if (!transferId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing transferId' },
        });
        return;
      }

      let record: TransferRecord | null = null;
      try {
        const raw = await redisService.getTransfer(transferId);
        if (raw) {
          record = raw as unknown as TransferRecord;
        }
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'status_getTransfer', transferId },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        res.status(500).json({ error: { code: 'REDIS_ERROR', message } });
        return;
      }

      if (!record) {
        res.status(404).json({
          error: {
            code: 'TRANSFER_NOT_FOUND',
            message: 'Transfer not found',
          },
        });
        return;
      }

      res.status(200).json({
        transferId: record.transferId,
        status: record.status,
        transferType: record.transferType,
        recipientPhone: record.recipientPhone,
        conferenceId: record.conferenceSid,
        customerMuted: record.customerMuted,
        initiatedAt: record.initiatedAt,
        connectedAt: record.connectedAt,
        completedAt: record.completedAt,
      });
    }),
  },

  // --- param routes (calls/:callSid/*) ---

  {
    method: 'POST',
    path: '/v1/calls/:callSid/transfer',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const callSid = req.params?.callSid;
      if (!callSid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing callSid' },
        });
        return;
      }

      const body = req.body as TransferBody | undefined;
      if (!body?.to || !body?.type) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing "to" or "type"',
          },
        });
        return;
      }

      let conferenceName: string | null = null;
      try {
        conferenceName =
          body.conferenceName ??
          (await redisService.getConferenceName(callSid));
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'transfer_getConferenceName', callSid },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        res.status(500).json({ error: { code: 'REDIS_ERROR', message } });
        return;
      }

      if (!conferenceName) {
        res.status(404).json({
          error: {
            code: 'CONFERENCE_NOT_FOUND',
            message: 'No conference found for this call',
          },
        });
        return;
      }

      const transferId = randomUUID();
      const statusCallbackUrl = process.env.API_BASE_URL
        ? `${process.env.API_BASE_URL}/v1/webhooks/dial-status`
        : undefined;

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const result = await dialer.initiateTransfer({
          callSid,
          conferenceName,
          to: body.to,
          from: body.from ?? process.env.TWILIO_DEFAULT_NUMBER ?? '',
          type: body.type,
          userId,
          statusCallbackUrl,
          transferId,
        });

        if (!result.success) {
          res.status(500).json({
            error: {
              code: 'TRANSFER_FAILED',
              message: result.error ?? 'Transfer failed',
            },
          });
          return;
        }
        const transferRecord: TransferRecord = {
          transferId,
          status: body.type === 'warm' ? 'consulting' : 'completed',
          transferType: body.type,
          recipientPhone: body.to,
          conferenceName,
          conferenceSid: result.conferenceSid ?? null,
          transferCallSid: result.transferCallSid ?? null,
          customerMuted: false,
          initiatedAt: new Date().toISOString(),
          connectedAt: body.type === 'cold' ? new Date().toISOString() : null,
          completedAt: body.type === 'cold' ? new Date().toISOString() : null,
        };

        try {
          await redisService.setTransfer(
            transferId,
            transferRecord as unknown as Record<string, unknown>,
          );
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: { context: 'transfer_setTransfer', transferId },
            },
          );
          const message =
            err instanceof Error ? err.message : 'Redis operation failed';
          // eslint-disable-next-line @nx/enforce-module-boundaries
          const { createLogger } = await import('@consuelo/logger');
          createLogger('voice:transfer').error(
            'Failed to store transfer record',
            {
              transferId,
              error: message,
            },
          );
        }

        res.status(200).json({ ...result, transferId });
        try {
          (await getLogger()).info('transfer.initiated', {
            action: 'transfer.initiated',
            userId: req.auth?.userId ?? 'anonymous',
            outcome: 'success',
          });
        } catch {
          // ignore logger errors after response sent
        }
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: {
              context: 'initiateTransfer',
              callSid,
              to: body.to,
              type: body.type,
            },
          },
        );
        const message = err instanceof Error ? err.message : 'Transfer failed';
        res.status(500).json({ error: { code: 'TRANSFER_FAILED', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/:callSid/transfer/complete',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as CompleteBody | undefined;
      if (!body?.conferenceSid || !body?.agentCallSid) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing conferenceSid or agentCallSid',
          },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const result = await dialer.completeTransfer(
          body.conferenceSid,
          body.agentCallSid,
        );
        if (!result.success) {
          res.status(500).json({
            error: {
              code: 'TRANSFER_FAILED',
              message: result.error ?? 'Complete failed',
            },
          });
          return;
        }

        // clean up conference map
        const callSid = req.params?.callSid;
        if (callSid) {
          try {
            await redisService.deleteConferenceName(callSid);
          } catch (err: unknown) {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              {
                extra: { context: 'complete_deleteConferenceName', callSid },
              },
            );
            const message =
              err instanceof Error ? err.message : 'Redis operation failed';
            // eslint-disable-next-line @nx/enforce-module-boundaries
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:complete').error(
              'Failed to delete conference mapping',
              {
                callSid,
                error: message,
              },
            );
          }
        }

        res.status(200).json(result);
        (await getLogger()).info('transfer.completed', {
          action: 'transfer.completed',
          userId: req.auth?.userId ?? 'anonymous',
          outcome: 'success',
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'completeTransfer' },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Complete transfer failed';
        res.status(500).json({ error: { code: 'TRANSFER_FAILED', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/:callSid/transfer/cancel',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as CancelBody | undefined;
      if (!body?.conferenceSid || !body?.transferCallSid) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing conferenceSid or transferCallSid',
          },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const result = await dialer.cancelTransfer(
          body.conferenceSid,
          body.transferCallSid,
        );
        if (!result.success) {
          res.status(500).json({
            error: {
              code: 'TRANSFER_FAILED',
              message: result.error ?? 'Cancel failed',
            },
          });
          return;
        }

        res.status(200).json(result);
        (await getLogger()).info('transfer.cancelled', {
          action: 'transfer.cancelled',
          userId: req.auth?.userId ?? 'anonymous',
          outcome: 'success',
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'cancelTransfer' },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Cancel transfer failed';
        res.status(500).json({ error: { code: 'TRANSFER_FAILED', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/:callSid/hold',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as HoldBody | undefined;
      if (body?.hold === undefined) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing "hold" boolean',
          },
        });
        return;
      }

      const callSid = req.params?.callSid;
      if (!callSid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing callSid' },
        });
        return;
      }

      let conferenceName: string | null = null;
      try {
        conferenceName = await redisService.getConferenceName(callSid);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        res.status(500).json({ error: { code: 'REDIS_ERROR', message } });
        return;
      }

      if (!conferenceName) {
        res.status(404).json({
          error: {
            code: 'CONFERENCE_NOT_FOUND',
            message: 'No conference found for this call',
          },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const conferenceSid =
          await dialer.conference.findConferenceSid(conferenceName);
        if (!conferenceSid) {
          res.status(404).json({
            error: {
              code: 'CONFERENCE_NOT_FOUND',
              message: 'Conference not in-progress',
            },
          });
          return;
        }

        if (body.participantCallSid) {
          await dialer.holdParticipant(
            conferenceSid,
            body.participantCallSid,
            body.hold,
          );
        } else {
          // default: hold the customer
          const participants = await dialer.listParticipants(conferenceSid);
          const customer = participants.find(
            (p: { label: string }) => p.label === 'customer',
          );
          if (customer) {
            await dialer.holdParticipant(
              conferenceSid,
              customer.callSid,
              body.hold,
            );
          }
        }

        res.status(200).json({ success: true, hold: body.hold });
        (await getLogger()).info('call.hold', {
          action: 'call.hold',
          userId: req.auth?.userId ?? 'anonymous',
          outcome: 'success',
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Hold toggle failed';
        res.status(500).json({ error: { code: 'HOLD_FAILED', message } });
      }
    }),
  },

  // --- Twilio webhook routes (no auth) ---
  {
    method: 'POST',
    path: '/v1/webhooks/amd',
    auth: false,
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;
      const body = req.body as Record<string, string> | undefined;
      const callSid = body?.CallSid;
      const answeredBy = body?.AnsweredBy;

      if (!callSid || !answeredBy) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing CallSid or AnsweredBy',
          },
        });
        return;
      }

      const isMachine =
        answeredBy === 'machine_start' ||
        answeredBy === 'machine_end_beep' ||
        answeredBy === 'machine_end_silence' ||
        answeredBy === 'machine_end_other' ||
        answeredBy === 'fax';

      if (isMachine) {
        try {
          const twilio = await import('twilio');
          const VoiceResponse = twilio.default.twiml.VoiceResponse;
          const response = new VoiceResponse();
          response.hangup();

          (res as unknown as Record<string, Function>)
            .type('text/xml')
            .status(200)
            .send(response.toString());

          (await getLogger()).info('amd.machine_detected', {
            action: 'amd.machine_detected',
            userId: 'system',
            outcome: 'hung_up',
            callSid,
            answeredBy,
          });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'AMD hangup failed';
          res.status(500).json({ error: { code: 'AMD_FAILED', message } });
        }
        return;
      }

      // Human detected - connect to conference
      try {
        const conferenceName =
          await redisService.getCustomerConferenceName(callSid);

        if (conferenceName) {
          const twilio = await import('twilio');
          const VoiceResponse = twilio.default.twiml.VoiceResponse;
          const response = new VoiceResponse();

          const dial = response.dial();
          dial.conference(
            {
              startConferenceOnEnter: true,
              endConferenceOnExit: true,
              participantLabel: 'customer',
            },
            conferenceName,
          );

          (res as unknown as Record<string, Function>)
            .type('text/xml')
            .status(200)
            .send(response.toString());

          (await getLogger()).info('amd.human_detected', {
            action: 'amd.human_detected',
            userId: 'system',
            outcome: 'connected',
            callSid,
            answeredBy,
            conferenceName,
          });
        } else {
          // No conference found - just hang up
          const twilio = await import('twilio');
          const VoiceResponse = twilio.default.twiml.VoiceResponse;
          const response = new VoiceResponse();
          response.hangup();

          (res as unknown as Record<string, Function>)
            .type('text/xml')
            .status(200)
            .send(response.toString());

          (await getLogger()).warn('amd.no_conference', {
            action: 'amd.no_conference',
            userId: 'system',
            callSid,
            answeredBy,
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'AMD conference connect failed';
        res.status(500).json({ error: { code: 'AMD_FAILED', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/webhooks/dial-status',
    auth: false,
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;
      const body = req.body as Record<string, string> | undefined;
      const callSid = body?.CallSid;
      const callStatus = body?.CallStatus;
      const dialCallStatus = body?.DialCallStatus;
      const transferId = req.query?.transfer_id ?? body?.transfer_id;

      if (!callSid) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing CallSid',
          },
        });
        return;
      }

      try {
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        const dialLogger = createLogger('voice:dial-status');

        // track ring time for billing
        if (callStatus === 'ringing') {
          ringingStartTimes.set(callSid, Date.now());
          dialLogger.info('Call ringing started', { callSid, callStatus });
        } else if (callStatus === 'in-progress') {
          const ringingAt = ringingStartTimes.get(callSid);
          if (ringingAt) {
            const ringDurationMs = Date.now() - ringingAt;
            const metrics: RingTimeMetrics = {
              callSid,
              ringingAt: new Date(ringingAt).toISOString(),
              answeredAt: new Date().toISOString(),
              ringDurationMs,
            };
            dialLogger.info('Call answered - ring time metrics', {
              ...metrics,
            });
            ringingStartTimes.delete(callSid);
          }
        }

        dialLogger.info('Dial status callback received', {
          callSid,
          callStatus,
          dialCallStatus,
          dialCallDuration: body?.DialCallDuration,
          transferId,
        });
      } catch {
        // logger unavailable, continue
      }

      // Update transfer lifecycle if this is a transfer callback
      if (transferId) {
        try {
          const transfer = await redisService.getTransfer(transferId);
          if (transfer) {
            const updatedTransfer = { ...transfer };

            // Update based on dial call status
            if (
              dialCallStatus === 'completed' ||
              dialCallStatus === 'answered'
            ) {
              updatedTransfer.connectedAt = new Date().toISOString();
              if (transfer.transferType === 'cold') {
                updatedTransfer.status = 'completed';
                updatedTransfer.completedAt = new Date().toISOString();
              }
            } else if (
              dialCallStatus === 'busy' ||
              dialCallStatus === 'no-answer' ||
              dialCallStatus === 'failed'
            ) {
              updatedTransfer.status = 'failed';
              updatedTransfer.completedAt = new Date().toISOString();
            }

            await redisService.setTransfer(transferId, updatedTransfer);
          }
        } catch (err: unknown) {
          // Log but don't fail the webhook
          try {
            // eslint-disable-next-line @nx/enforce-module-boundaries
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:dial-status').error(
              'Failed to update transfer record',
              {
                transferId,
                error: err instanceof Error ? err.message : 'unknown error',
              },
            );
          } catch {
            // Logger unavailable, continue
          }
        }
      }

      // Return empty TwiML for dial status callbacks
      res
        .status(200)
        .type('text/xml')
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }),
  },

  {
    method: 'POST',
    path: '/v1/webhooks/status',
    auth: false,
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;
      const body = req.body as Record<string, string> | undefined;
      const callSid = body?.CallSid;
      const callStatus = body?.CallStatus;

      if (!callSid || !callStatus) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing CallSid or CallStatus',
          },
        });
        return;
      }

      let conferenceName: string | null = null;
      try {
        conferenceName = await redisService.getCustomerConferenceName(callSid);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        createLogger('voice:status').error(
          'Failed to get customer conference',
          {
            callSid,
            error: message,
          },
        );
      }

      if (conferenceName) {
        try {
          await redisService.setCallStatus(conferenceName, callStatus);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Redis operation failed';
          // eslint-disable-next-line @nx/enforce-module-boundaries
          const { createLogger } = await import('@consuelo/logger');
          createLogger('voice:status').error('Failed to store call status', {
            callSid,
            conferenceName,
            error: message,
          });
        }

        if (FAILURE_STATUSES.has(callStatus)) {
          try {
            // eslint-disable-next-line @nx/enforce-module-boundaries
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:status').warn('Customer call failed', {
              callSid,
              conferenceName,
              status: callStatus,
            });
          } catch {
            // logger unavailable, continue — intentional: logger optional in webhook handler
          }
        }
      }

      // Check if this is an agent call ending (check callerIdMap)
      // Release lock on both failure and normal completion
      const callerId = callerIdMap.get(callSid);
      if (
        callerId &&
        (FAILURE_STATUSES.has(callStatus) || callStatus === 'completed')
      ) {
        try {
          await getCallerIdLockService().releaseLockByNumber(callerId);
          callerIdMap.delete(callSid);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Lock release failed';
          // eslint-disable-next-line @nx/enforce-module-boundaries
          const { createLogger } = await import('@consuelo/logger');
          createLogger('voice:status').error(
            'Failed to release caller ID lock',
            {
              callSid,
              callerId,
              error: message,
            },
          );
        }
      }

      res.status(200).json({ received: true });
    }),
  },

  // --- authenticated status check for polling ---

  {
    method: 'GET',
    path: '/v1/calls/status/:callSid',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const callSid = req.params?.callSid;
      if (!callSid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing callSid' },
        });
        return;
      }

      let conferenceName: string | null = null;
      try {
        conferenceName = await redisService.getConferenceName(callSid);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        res.status(500).json({ error: { code: 'REDIS_ERROR', message } });
        return;
      }

      if (!conferenceName) {
        res.status(404).json({
          error: {
            code: 'CALL_NOT_FOUND',
            message: 'No conference for this call',
          },
        });
        return;
      }

      let status = 'unknown';
      try {
        status =
          (await redisService.getCallStatus(conferenceName)) ?? 'unknown';
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Redis operation failed';
        // eslint-disable-next-line @nx/enforce-module-boundaries
        const { createLogger } = await import('@consuelo/logger');
        createLogger('voice:status').error('Failed to get call status', {
          callSid,
          conferenceName,
          error: message,
        });
      }

      res.status(200).json({ callSid, conferenceName, status });
    }),
  },

  // --- phone-based dialer: status callback for phone-initiated calls (DEV-1123) ---
  {
    method: 'POST',
    path: '/v1/voice/phone-status',
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;

      const body = req.body as Record<string, string> | undefined;
      const callSid = body?.CallSid ?? '';
      const callStatus = body?.CallStatus ?? '';

      if (!callSid) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing CallSid' },
        });
        return;
      }

      // look up the phone call state via callSid → callId mapping
      let callId: string | null = null;
      try {
        callId = await redisService.getCallIdByCallSid(callSid);
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          { extra: { context: 'phone_status_lookup', callSid } },
        );
      }

      if (!callId) {
        // not a phone-initiated call — ignore
        res.status(200).json({ received: true });
        return;
      }

      let callState: Record<string, unknown> | null = null;
      try {
        callState = await redisService.getPhoneCallState(callId);
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          { extra: { context: 'phone_status_state', callId } },
        );
      }

      if (!callState) {
        res.status(200).json({ received: true });
        return;
      }

      const phoneLogger = await getLogger();

      // rep answered — dial the lead into the conference
      if (callStatus === 'in-progress' && callState.status === 'initiating') {
        try {
          const workspaceId = callState.workspaceId as string;
          const dialer = await getDialerForWorkspace(workspaceId);

          await dialer.conference.addParticipant(
            callState.conferenceName as string,
            callState.leadPhone as string,
            callState.callerId as string,
            {
              label: 'customer',
              endConferenceOnExit: true,
              statusCallback: `${process.env.API_BASE_URL ?? ''}/v1/voice/phone-status`,
            },
          );

          await redisService.setPhoneCallState(callId, {
            ...callState,
            status: 'connected',
          });

          await redisService.publishCallEvent({
            type: 'call.connected',
            callId,
            conferenceName: callState.conferenceName,
            contactId: callState.contactId ?? null,
            userId: callState.userId,
            timestamp: new Date().toISOString(),
          });

          phoneLogger.info('phone_call.connected', {
            callId,
            conferenceName: callState.conferenceName as string,
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: {
                context: 'phone_status_dial_lead',
                callId,
                conferenceName: callState.conferenceName,
              },
            },
          );

          await redisService.publishCallEvent({
            type: 'call.failed',
            callId,
            reason: err instanceof Error ? err.message : 'Failed to dial lead',
            contactId: callState.contactId ?? null,
            userId: callState.userId,
            timestamp: new Date().toISOString(),
          });

          // release caller ID lock on failure
          try {
            const lockService = getCallerIdLockService();
            await lockService.releaseLock(callSid);
          } catch (_lockErr: unknown) {
            // non-fatal: lock will expire via TTL
          }
        }
      }

      // call completed or failed
      const terminalStatuses = [
        'completed',
        'busy',
        'no-answer',
        'canceled',
        'failed',
      ];
      if (terminalStatuses.includes(callStatus)) {
        const isFailed = callStatus !== 'completed';
        const eventType = isFailed ? 'call.failed' : 'call.ended';

        const duration = body?.CallDuration ? Number(body.CallDuration) : 0;

        try {
          await redisService.publishCallEvent({
            type: eventType,
            callId,
            conferenceName: callState.conferenceName,
            contactId: callState.contactId ?? null,
            userId: callState.userId,
            duration,
            reason: isFailed ? callStatus : undefined,
            timestamp: new Date().toISOString(),
          });

          phoneLogger.info(`phone_call.${eventType}`, {
            callId,
            callStatus,
            duration,
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            { extra: { context: 'phone_status_event', callId, callStatus } },
          );
        }

        // release caller ID lock
        try {
          const lockService = getCallerIdLockService();
          await lockService.releaseLock(callSid);
        } catch (_lockErr: unknown) {
          // non-fatal: lock will expire via TTL
        }

        // cleanup redis state
        try {
          await redisService.deletePhoneCallState(callId);
        } catch (_cleanupErr: unknown) {
          // non-fatal: TTL will handle cleanup
        }
      }

      res.status(200).json({ received: true });
    }),
  },
];
