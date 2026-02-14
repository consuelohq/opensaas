import { Dialer, InMemoryLockStore, CallerIdLockService, type ParallelGroup } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import type { RouteDefinition } from './index.js';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

interface ParallelDialBody {
  customerNumbers: string[];
  queueId: string;
  contactIds?: string[];
}

/** /v1/calls/parallel routes — parallel dialing (power dialer) */
export const parallelRoutes = (): RouteDefinition[] => {
  const dialer = new Dialer({
    credentials: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    },
    baseUrl: process.env.API_BASE_URL,
  });

  const lockService = new CallerIdLockService(new InMemoryLockStore());
  dialer.withCallerIdLock(lockService);

  return [
    // --- literal routes first (ROUTE_ORDER) ---

    {
      method: 'POST',
      path: '/v1/calls/parallel',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const body = req.body as ParallelDialBody | undefined;
        if (!body?.customerNumbers || body.customerNumbers.length !== 3 || !body.queueId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Requires exactly 3 customerNumbers and a queueId' } });
          return;
        }

        const invalidNumbers = body.customerNumbers.filter((n) => !E164_REGEX.test(n));
        if (invalidNumbers.length > 0) {
          res.status(400).json({ error: { code: 'INVALID_PHONE', message: `Invalid E.164 numbers: ${invalidNumbers.join(', ')}` } });
          return;
        }

        try {
          // select caller IDs via local presence per contact
          const fromNumbers: string[] = [];
          for (const customerNumber of body.customerNumbers) {
            const selection = await dialer.localPresence.selectNumber(
              { numbers: [], primaryNumber: undefined },
              customerNumber,
            );
            fromNumbers.push(selection?.phoneNumber ?? process.env.TWILIO_DEFAULT_NUMBER ?? '');
          }

          // acquire caller ID locks
          for (let i = 0; i < fromNumbers.length; i++) {
            if (fromNumbers[i]) {
              const locked = await lockService.acquireLock(fromNumbers[i], userId, `parallel-${i}`);
              if (!locked) {
                // release any already-acquired locks
                for (let j = 0; j < i; j++) {
                  await lockService.releaseLockByNumber(fromNumbers[j]);
                }
                res.status(409).json({ error: { code: 'CALLER_ID_LOCKED', message: `Caller ID ${fromNumbers[i]} is in use` } });
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
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Parallel dial failed';
          res.status(500).json({ error: { code: 'PARALLEL_DIAL_FAILED', message } });
        }
      }),
    },

    {
      method: 'GET',
      path: '/v1/calls/parallel/validate',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        // TODO: DEV-824 — fetch actual user phone number count from DB
        const numberCount = 0;
        const result = dialer.parallel.validateRequirements(numberCount);
        res.status(200).json(result);
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/parallel/status-callback',
      handler: errorHandler(async (req, res) => {
        // twilio webhook — no auth required
        const body = req.body as Record<string, string> | undefined;
        const callSid = body?.CallSid;
        const callStatus = body?.CallStatus;
        const answeredBy = body?.AnsweredBy;

        if (!callSid || !callStatus) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing CallSid or CallStatus' } });
          return;
        }

        try {
          await dialer.parallel.handleStatusCallback(callSid, callStatus, answeredBy);

          // release caller ID locks for completed non-winner calls
          const groupId = await dialer.parallel.getGroupIdForCall(callSid);
          if (groupId) {
            const group = await dialer.parallel.getGroup(groupId);
            if (group && (group.status === 'connected' || group.status === 'completed')) {
              const releasable = dialer.parallel.getReleasableNumbers(group);
              for (const num of releasable) {
                await lockService.releaseLockByNumber(num);
              }
            }
          }

          res.status(200).json({ received: true });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Status callback failed';
          res.status(500).json({ error: { code: 'CALLBACK_FAILED', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/parallel/customer-twiml',
      handler: errorHandler(async (req, res) => {
        // twilio webhook — no auth required
        const body = req.body as Record<string, string> | undefined;
        const callSid = body?.CallSid;

        if (!callSid) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing CallSid' } });
          return;
        }

        try {
          const twiml = await dialer.parallel.generateCustomerTwiml(callSid);
          if (!twiml) {
            res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'No parallel group for this call' } });
            return;
          }

          // TwiML response — uses Express methods not on ApiResponse interface (same as voice.ts)
          (res as Record<string, Function>).type('text/xml').status(200).send(twiml);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'TwiML generation failed';
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
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const groupId = req.params?.groupId;
        if (!groupId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing groupId' } });
          return;
        }

        try {
          const group: ParallelGroup | null = await dialer.parallel.getGroup(groupId);
          if (!group) {
            res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Parallel group not found' } });
            return;
          }

          res.status(200).json({
            groupId: group.groupId,
            status: group.status,
            winnerSid: group.winnerSid,
            calls: group.calls.map((c) => ({
              callSid: c.callSid,
              customerNumber: c.customerNumber,
              position: c.position,
              status: c.status,
              amdResult: c.amdResult,
              contactId: c.contactId,
            })),
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Group lookup failed';
          res.status(500).json({ error: { code: 'GROUP_LOOKUP_FAILED', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/parallel/:groupId/terminate',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
          return;
        }

        const groupId = req.params?.groupId;
        if (!groupId) {
          res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing groupId' } });
          return;
        }

        try {
          const group = await dialer.parallel.getGroup(groupId);
          if (!group) {
            res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Parallel group not found' } });
            return;
          }

          // release all caller ID locks before terminating
          for (const call of group.calls) {
            if (call.fromNumber) {
              await lockService.releaseLockByNumber(call.fromNumber);
            }
          }

          await dialer.parallel.terminateGroup(groupId);
          res.status(200).json({ groupId, status: 'completed' });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Terminate failed';
          res.status(500).json({ error: { code: 'TERMINATE_FAILED', message } });
        }
      }),
    },
  ];
};
