import type { ParallelGroup, NumberPool } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';
import * as Sentry from '@sentry/node';
import { sharedDialer, sharedCallerIdLockService, getDialerForWorkspace } from '../shared/dialer.js';
import { createLogger } from '@consuelo/logger';
const logger = createLogger('api:audit');
import { validateTwilioSignature } from './voice.js';

const getLegacyDialer = sharedDialer;
const getLockService = sharedCallerIdLockService;

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

interface ParallelDialBody {
  customerNumbers: string[];
  queueId: string;
  contactIds?: string[];
}

/** /v1/calls/parallel routes — parallel dialing (power dialer) */
export const parallelRoutes = (): RouteDefinition[] => [
  // --- literal routes first (ROUTE_ORDER) ---

  {
    method: 'POST',
    path: '/v1/calls/parallel',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const body = req.body as ParallelDialBody | undefined;
      if (
        !body?.customerNumbers ||
        body.customerNumbers.length !== 3 ||
        !body.queueId
      ) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Requires exactly 3 customerNumbers and a queueId',
          },
        });
        return;
      }

      const invalidNumbers = body.customerNumbers.filter(
        (n) => !E164_REGEX.test(n),
      );
      if (invalidNumbers.length > 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_PHONE',
            message: `Invalid E.164 numbers: ${invalidNumbers.join(', ')}`,
          },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const accountNumbers = await dialer.listNumbers();
        const pool: NumberPool = {
          numbers: accountNumbers,
          primaryNumber: accountNumbers[0],
        };

        const fromNumbers: string[] = [];
        for (const customerNumber of body.customerNumbers) {
          const selection = await dialer.localPresence.selectNumber(
            pool,
            customerNumber,
          );
          fromNumbers.push(
            selection?.phoneNumber ?? process.env.TWILIO_DEFAULT_NUMBER ?? '',
          );
        }

        for (let i = 0; i < fromNumbers.length; i++) {
          if (fromNumbers[i]) {
            const locked = await getLockService().acquireLock(
              fromNumbers[i],
              userId,
              `parallel-${i}`,
            );
            if (!locked) {
              for (let j = 0; j < i; j++) {
                await getLockService().releaseLockByNumber(fromNumbers[j]);
              }
              res.status(409).json({
                error: {
                  code: 'CALLER_ID_LOCKED',
                  message: `Caller ID ${fromNumbers[i]} is in use`,
                },
              });
              return;
            }
          }
        }

        const baseUrl = process.env.API_BASE_URL ?? '';
        const result = await dialer.parallel.initiateGroup({
          customerNumbers: body.customerNumbers,
          queueId: body.queueId,
          contactIds: body.contactIds,
          userId,
          fromNumbers,
          statusCallbackUrl: `${baseUrl}/v1/calls/parallel/status-callback`,
          customerTwimlUrl: `${baseUrl}/v1/calls/parallel/customer-twiml`,
        });

        res.status(201).json(result);
        logger.info('parallel.dial', {
          action: 'parallel.dial',
          userId,
          outcome: 'success',
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
        res
          .status(500)
          .json({ error: { code: 'PARALLEL_DIAL_FAILED', message } });
      }
    }),
  },

  {
    method: 'GET',
    path: '/v1/calls/parallel/validate',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const numbers = await dialer.listNumbers();
        const result = dialer.parallel.validateRequirements(
          numbers.length,
        );
        res.status(200).json(result);
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_validate' },
          },
        );
        const message =
          err instanceof Error ? err.message : 'Validation failed';
        res.status(500).json({ error: { code: 'VALIDATION_FAILED', message } });
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
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing CallSid or CallStatus',
          },
        });
        return;
      }

      try {
        await getLegacyDialer().parallel.handleStatusCallback(
          callSid,
          callStatus,
          answeredBy,
        );

        const groupId = await getLegacyDialer().parallel.getGroupIdForCall(callSid);
        if (groupId) {
          const group = await getLegacyDialer().parallel.getGroup(groupId);
          if (
            group &&
            (group.status === 'connected' || group.status === 'completed')
          ) {
            const releasable = getLegacyDialer().parallel.getReleasableNumbers(group);
            for (const num of releasable) {
              await getLockService().releaseLockByNumber(num);
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
        res.status(500).json({ error: { code: 'CALLBACK_FAILED', message } });
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
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing CallSid' },
        });
        return;
      }

      try {
        const twiml = await getLegacyDialer().parallel.generateCustomerTwiml(callSid);
        if (!twiml) {
          res.status(404).json({
            error: {
              code: 'GROUP_NOT_FOUND',
              message: 'No parallel group for this call',
            },
          });
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
        res.status(500).json({ error: { code: 'TWIML_FAILED', message } });
      }
    }),
  },

  // --- param routes (parallel/:groupId/*) ---

  {
    method: 'GET',
    path: '/v1/calls/parallel/:groupId',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const groupId = req.params?.groupId;
      if (!groupId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing groupId' },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const group: ParallelGroup | null =
          await dialer.parallel.getGroup(groupId);
        if (!group) {
          res.status(404).json({
            error: {
              code: 'GROUP_NOT_FOUND',
              message: 'Parallel group not found',
            },
          });
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
        res
          .status(500)
          .json({ error: { code: 'GROUP_LOOKUP_FAILED', message } });
      }
    }),
  },

  {
    method: 'POST',
    path: '/v1/calls/parallel/:groupId/terminate',
    handler: errorHandler(async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) {
        res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Auth required' },
        });
        return;
      }

      const groupId = req.params?.groupId;
      if (!groupId) {
        res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: 'Missing groupId' },
        });
        return;
      }

      try {
        const dialer = await getDialerForWorkspace(req.auth!.workspaceId);
        const group = await dialer.parallel.getGroup(groupId);
        if (!group) {
          res.status(404).json({
            error: {
              code: 'GROUP_NOT_FOUND',
              message: 'Parallel group not found',
            },
          });
          return;
        }

        for (const call of group.calls) {
          if (call.fromNumber) {
            await getLockService().releaseLockByNumber(call.fromNumber);
          }
        }

        await dialer.parallel.terminateGroup(groupId);
        res.status(200).json({ groupId, status: 'completed' });
        logger.info('parallel.terminated', {
          action: 'parallel.terminated',
          userId,
          outcome: 'success',
        });
      } catch (err: unknown) {
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
          {
            extra: { context: 'parallel_terminate', groupId },
          },
        );
        const message = err instanceof Error ? err.message : 'Terminate failed';
        res.status(500).json({ error: { code: 'TERMINATE_FAILED', message } });
      }
    }),
  },
];
