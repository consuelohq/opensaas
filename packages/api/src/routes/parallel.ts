import {
  ParallelStrategyResolver,
  type ParallelDialResult,
  type ParallelGroup,
  type NumberPool,
  type PosteriorStore,
  type ProfileKey,
} from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { ApiResponse } from '../types.js';
import type { RouteDefinition } from './index.js';
import * as Sentry from '@sentry/node';
import {
  sharedDialer,
  sharedCallerIdLockService,
  getDialerForWorkspace,
} from '../shared/dialer.js';
// lazy-loaded logger (matches other route files)
let _logger: {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
} | null = null;
const getLogger = async () => {
  try {
    if (!_logger) {
      const { createLogger } = await import('@consuelo/logger');
      _logger = createLogger('api:audit');
    }
    return _logger;
  } catch {
    return null;
  }
};
import { validateTwilioSignature } from './voice.js';

const getLegacyDialer = sharedDialer;
const getLockService = sharedCallerIdLockService;

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const inMemoryPosteriorStore: PosteriorStore = {
  async loadPosteriors() {
    return [];
  },
  async updatePosterior() {
    return;
  },
};
const strategyResolver = new ParallelStrategyResolver(inMemoryPosteriorStore, {
  sample: (alpha, beta) => alpha / (alpha + beta),
});

interface ParallelDialBody {
  customerNumbers: string[];
  queueId: string;
  contactIds?: string[];
  profileId?: ProfileKey;
  campaignSegment?: string;
  recentAnswerRate?: number;
}

const isProfileKey = (value: unknown): value is ProfileKey =>
  value === 'balanced' || value === 'aggressive' || value === 'conservative';

const respondWithError = (
  res: ApiResponse,
  status: number,
  code: string,
  message: string,
  context: Record<string, unknown>,
): void => {
  Sentry.captureException(new Error(message), {
    level: status >= 500 ? 'error' : 'warning',
    extra: { ...context, status, code },
  });
  res.status(status).json({ error: { code, message } });
};

/** /v1/calls/parallel routes — parallel dialing (power dialer) */
export const parallelRoutes = (): RouteDefinition[] => [
  // --- literal routes first (ROUTE_ORDER) ---

  {
    method: 'POST',
    path: '/v1/calls/parallel',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        respondWithError(res, 401, 'UNAUTHORIZED', 'Auth required', {
          context: 'parallel_dial_auth',
        });
        return;
      }

      const body = req.body as ParallelDialBody | undefined;
      if (!body?.customerNumbers || !body.queueId) {
        respondWithError(
          res,
          400,
          'INVALID_REQUEST',
          'Requires customerNumbers and a queueId',
          { context: 'parallel_dial_input' },
        );
        return;
      }

      const invalidNumbers = body.customerNumbers.filter(
        (n) => !E164_REGEX.test(n),
      );
      if (invalidNumbers.length > 0) {
        respondWithError(
          res,
          400,
          'INVALID_PHONE',
          `Invalid E.164 numbers: ${invalidNumbers.join(', ')}`,
          { context: 'parallel_dial_phone_validation' },
        );
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(workspaceId);
        const strategy = await strategyResolver.resolve({
          queueId: body.queueId,
          workspaceId,
          campaignSegment: body.campaignSegment,
          recentAnswerRate: body.recentAnswerRate,
          profileId: body.profileId,
        });

        if (body.customerNumbers.length !== strategy.profile.fanout) {
          respondWithError(
            res,
            400,
            'INVALID_REQUEST',
            `Profile ${strategy.profile.id} requires exactly ${strategy.profile.fanout} customerNumbers`,
            { context: 'parallel_dial_fanout', profileId: strategy.profile.id },
          );
          return;
        }

        const accountNumbers = await dialer.listNumbers();
        const pool: NumberPool = {
          numbers: accountNumbers,
          primaryNumber: accountNumbers[0],
        };

        const fromNumbers: string[] = [];
        for (const customerNumber of body.customerNumbers) {
          const resolution = await dialer.resolveCallerId(
            {
              to: customerNumber,
              from: '',
              localPresence: true,
            },
            pool,
          );
          fromNumbers.push(
            resolution.callerIdNumber ??
              process.env.TWILIO_DEFAULT_NUMBER ??
              '',
          );
        }

        const lockableFromNumbers = Array.from(
          new Set(fromNumbers.filter((fromNumber) => fromNumber.length > 0)),
        );
        const acquiredFromNumbers: string[] = [];

        for (const [index, fromNumber] of lockableFromNumbers.entries()) {
          const locked = await getLockService().acquireLock(
            fromNumber,
            userId,
            `parallel-${body.queueId}-${index}`,
          );

          if (!locked) {
            for (const acquiredFromNumber of acquiredFromNumbers) {
              await getLockService().releaseLockByNumber(acquiredFromNumber);
            }
            respondWithError(
              res,
              409,
              'CALLER_ID_LOCKED',
              `Caller ID ${fromNumber} is in use`,
              { context: 'parallel_dial_caller_id_lock' },
            );
            return;
          }

          acquiredFromNumbers.push(fromNumber);
        }

        const baseUrl = process.env.API_BASE_URL ?? '';
        let result: ParallelDialResult;
        try {
          result = await dialer.parallel.initiateGroup({
            workspaceId,
            customerNumbers: body.customerNumbers,
            queueId: body.queueId,
            contactIds: body.contactIds,
            userId,
            fromNumbers,
            statusCallbackUrl: `${baseUrl}/v1/calls/parallel/status-callback`,
            customerTwimlUrl: `${baseUrl}/v1/calls/parallel/customer-twiml`,
            profile: strategy.profile,
            campaignSegment: body.campaignSegment,
          });
        } catch (err: unknown) {
          for (const acquiredFromNumber of acquiredFromNumbers) {
            await getLockService().releaseLockByNumber(acquiredFromNumber);
          }
          throw err;
        }

        res.status(201).json(result);
        (await getLogger())?.info('parallel.dial', {
          action: 'parallel.dial',
          userId,
          outcome: 'success',
          profileId: strategy.profile.id,
          strategyReason: strategy.reason,
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_dial', queueId: body.queueId },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Parallel dial failed';
        respondWithError(res, 500, 'PARALLEL_DIAL_FAILED', message, {
          context: 'parallel_dial_response',
          queueId: body.queueId,
        });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/calls/parallel/validate',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        respondWithError(res, 401, 'UNAUTHORIZED', 'Auth required', {
          context: 'parallel_validate_auth',
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(workspaceId);
        const query = req.query ?? {};
        const profileId = isProfileKey(query.profileId)
          ? query.profileId
          : undefined;
        const queueId =
          typeof query.queueId === 'string' ? query.queueId : 'default';
        const campaignSegment =
          typeof query.campaignSegment === 'string'
            ? query.campaignSegment
            : undefined;
        const recentAnswerRate =
          typeof query.recentAnswerRate === 'string'
            ? Number(query.recentAnswerRate)
            : undefined;

        const strategy = await strategyResolver.resolve({
          queueId,
          workspaceId,
          campaignSegment,
          recentAnswerRate:
            recentAnswerRate !== undefined && Number.isFinite(recentAnswerRate)
              ? recentAnswerRate
              : undefined,
          profileId,
        });

        const numbers = await dialer.listNumbers();
        const result = dialer.parallel.validateRequirements(
          numbers.length,
          strategy.profile.fanout,
        );
        res.status(200).json({
          ...result,
          profile: strategy.profile,
          strategyReason: strategy.reason,
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_validate' },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Validation failed';
        respondWithError(res, 500, 'VALIDATION_FAILED', message, {
          context: 'parallel_validate_response',
        });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/parallel/status-callback',
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;
      const body = req.body as Record<string, string> | undefined;
      const callSid = body?.CallSid;
      const callStatus = body?.CallStatus;
      const answeredBy = body?.AnsweredBy;

      if (!callSid || !callStatus) {
        respondWithError(
          res,
          400,
          'INVALID_REQUEST',
          'Missing CallSid or CallStatus',
          { context: 'parallel_status_callback_input' },
        );
        return;
      }

      try {
        await getLegacyDialer().parallel.handleStatusCallback(
          callSid,
          callStatus,
          answeredBy,
        );

        const groupId =
          await getLegacyDialer().parallel.getGroupIdForCall(callSid);
        if (groupId) {
          const group = await getLegacyDialer().parallel.getGroup(groupId);
          if (
            group &&
            (group.status === 'connected' || group.status === 'completed')
          ) {
            const releasable =
              getLegacyDialer().parallel.getReleasableNumbers(group);
            for (const num of releasable) {
              await getLockService().releaseLockByNumber(num);
            }

            if (!group.telemetryEmittedAt) {
              const telemetry =
                getLegacyDialer().parallel.computeTelemetry(group);
              (await getLogger())?.info('parallel.telemetry', {
                action: 'parallel.telemetry',
                groupId,
                queueId: group.queueId,
                profileId: group.profile.id,
                winnerRate: telemetry.winnerRate,
                wastedLegs: telemetry.wastedLegs,
                connectLatencyMs: telemetry.connectLatencyMs,
              });
              await getLegacyDialer().parallel.markTelemetryEmitted(groupId);
            }
          }
        }

        res.status(200).json({ received: true });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_status_callback', callSid },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Status callback failed';
        respondWithError(res, 500, 'CALLBACK_FAILED', message, {
          context: 'parallel_status_callback_response',
          callSid,
        });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/parallel/customer-twiml',
    handler: errorHandler(async (req, res) => {
      if (!(await validateTwilioSignature(req, res))) return;
      const body = req.body as Record<string, string> | undefined;
      const callSid = body?.CallSid;

      if (!callSid) {
        respondWithError(res, 400, 'INVALID_REQUEST', 'Missing CallSid', {
          context: 'parallel_customer_twiml_input',
        });
        return;
      }

      try {
        const twiml =
          await getLegacyDialer().parallel.generateCustomerTwiml(callSid);
        if (!twiml) {
          respondWithError(
            res,
            404,
            'GROUP_NOT_FOUND',
            'No parallel group for this call',
            { context: 'parallel_customer_twiml_group', callSid },
          );
          return;
        }

        (res as unknown as Record<string, Function>)
          .type('text/xml')
          .status(200)
          .send(twiml);
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_customer_twiml', callSid },
          },
        );
        const message =
          err instanceof Error ? err.message : 'TwiML generation failed';
        respondWithError(res, 500, 'TWIML_FAILED', message, {
          context: 'parallel_customer_twiml_response',
          callSid,
        });
      }
    }),
  },

  // --- param routes (parallel/:groupId/*) ---

  {
    method: 'GET',
    path: '/v1/calls/parallel/:groupId',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        respondWithError(res, 401, 'UNAUTHORIZED', 'Auth required', {
          context: 'parallel_group_auth',
        });
        return;
      }

      const groupId = req.params?.groupId;
      if (!groupId) {
        respondWithError(res, 400, 'INVALID_REQUEST', 'Missing groupId', {
          context: 'parallel_group_input',
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(workspaceId);
        const group: ParallelGroup | null =
          await dialer.parallel.getGroupForWorkspace(groupId, workspaceId);
        if (!group) {
          respondWithError(
            res,
            404,
            'GROUP_NOT_FOUND',
            'Parallel group not found',
            { context: 'parallel_group_lookup', groupId, workspaceId },
          );
          return;
        }

        res.status(200).json({
          groupId: group.groupId,
          status: group.status,
          winnerSid: group.winnerSid,
          calls: group.calls.map(
            (c: {
              callSid: string;
              customerNumber: string;
              position: number;
              status: string;
              amdResult?: string;
              contactId?: string;
            }) => ({
              callSid: c.callSid,
              customerNumber: c.customerNumber,
              position: c.position,
              status: c.status,
              amdResult: c.amdResult,
              contactId: c.contactId,
            }),
          ),
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_getGroup', groupId },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Group lookup failed';
        respondWithError(res, 500, 'GROUP_LOOKUP_FAILED', message, {
          context: 'parallel_group_lookup_response',
          groupId,
        });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/parallel/:groupId/terminate',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      const workspaceId = req.auth?.workspaceId;
      if (!userId || !workspaceId) {
        respondWithError(res, 401, 'UNAUTHORIZED', 'Auth required', {
          context: 'parallel_terminate_auth',
        });
        return;
      }

      const groupId = req.params?.groupId;
      if (!groupId) {
        respondWithError(res, 400, 'INVALID_REQUEST', 'Missing groupId', {
          context: 'parallel_terminate_input',
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(workspaceId);
        const group = await dialer.parallel.getGroupForWorkspace(
          groupId,
          workspaceId,
        );
        if (!group) {
          respondWithError(
            res,
            404,
            'GROUP_NOT_FOUND',
            'Parallel group not found',
            { context: 'parallel_terminate_lookup', groupId, workspaceId },
          );
          return;
        }

        for (const call of group.calls) {
          if (call.fromNumber) {
            await getLockService().releaseLockByNumber(call.fromNumber);
          }
        }

        const terminated = await dialer.parallel.terminateGroupForWorkspace(
          groupId,
          workspaceId,
        );
        if (!terminated) {
          Sentry.captureException(
            new Error('Parallel termination group disappeared'),
            { extra: { groupId, workspaceId } },
          );
        }
        res.status(200).json({ groupId, status: 'completed' });
        (await getLogger())?.info('parallel.terminated', {
          action: 'parallel.terminated',
          userId,
          outcome: 'success',
          profileId: group.profile.id,
          strategyReason: group.resolverReason,
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_terminate', groupId },
          },
        );
        const message = err instanceof Error ? err.message : 'Terminate failed';
        respondWithError(res, 500, 'TERMINATE_FAILED', message, {
          context: 'parallel_terminate_response',
          groupId,
        });
      }
    }),
  },
];
