import type { TransferType, TransferStatus } from '@consuelo/dialer';
import { errorHandler } from '../middleware/error-handler.js';
import { redisService } from '../services/redis.js';
import type { RouteDefinition } from './index.js';
import type { ApiRequest, ApiResponse } from '../types.js';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import {
  sharedDialer as dialer,
  sharedCallerIdLockService,
} from '../shared/dialer.js';

/**
 * Validate Twilio signature on webhook requests.
 * Twilio sends a signature in the X-Twilio-Signature header.
 */
async function validateTwilioSignature(
  req: ApiRequest,
  res: ApiResponse,
): Promise<boolean> {
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
    const isValid = twilio.validateRequest(
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
}

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
export const voiceRoutes = (): RouteDefinition[] => [
  // --- literal routes first (ROUTE_ORDER) ---

  {
      method: 'GET',
      path: '/v1/voice/token',
      handler: errorHandler(async (req, res) => {
        const userId = req.auth?.userId;
        if (!userId) {
          res.status(401).json({
            error: { code: 'UNAUTHORIZED', message: 'Auth required' },
          });
          return;
        }

        try {
          const result = await dialer.getToken(userId);
          res.json(result);
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
          );
          const message =
            err instanceof Error ? err.message : 'Token generation failed';
          res.status(500).json({ error: { code: 'TOKEN_ERROR', message } });
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
          | { callerId: string; callSid?: string }
          | undefined;
        const callerId = body?.callerId;
        const callSid = body?.callSid;

        if (!callerId) {
          res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'Missing "callerId"' },
          });
          return;
        }

    try {
      const acquired = await sharedCallerIdLockService.acquireLock(
            callerId,
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

          res.status(200).json({ success: true, callerId });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Lock acquisition failed';
          Sentry.captureException(
            err instanceof Error ? err : new Error(message),
            {
              extra: { callerId, userId, context: 'preflight' },
            },
          );
          res.status(500).json({ error: { code: 'LOCK_ERROR', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/voice/twiml',
      handler: errorHandler(async (req, res) => {
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

        // Store callerId mapping for lock release on call end
        if (from) {
          callerIdMap.set(callSid, from);
        }

        const twiml = dialer.generateConferenceTwiml(conferenceName, 'agent');

        // dial the customer into the conference (fire-and-forget)
        if (to && !to.startsWith('client:')) {
          const statusCallback = process.env.API_BASE_URL
            ? `${process.env.API_BASE_URL}/v1/webhooks/status`
            : undefined;

          try {
            const customerResult = await dialer.addCustomerToConference(
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
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:twiml').error('Customer dial failed', {
              conferenceName,
              to,
              error: message,
            });
          }
        }

        res.type('text/xml').status(200).send(twiml);
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
              record as Record<string, unknown>,
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
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:mute').error(
              'Failed to update transfer record',
              {
                transferId,
                error: message,
              },
            );
          }

          res.status(200).json({ transferId, customerMuted: body.muted });
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

        try {
          const result = await dialer.initiateTransfer({
            callSid,
            conferenceName,
            to: body.to,
            from: body.from ?? process.env.TWILIO_DEFAULT_NUMBER ?? '',
            type: body.type,
            userId,
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

          const transferId = randomUUID();
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
          const message =
            err instanceof Error ? err.message : 'Transfer failed';
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
      path: '/v1/webhooks/status',
      handler: errorHandler(async (req, res) => {
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
          conferenceName =
            await redisService.getCustomerConferenceName(callSid);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : 'Redis operation failed';
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
            const { createLogger } = await import('@consuelo/logger');
            createLogger('voice:status').error('Failed to store call status', {
              callSid,
              conferenceName,
              error: message,
            });
          }

          if (FAILURE_STATUSES.has(callStatus)) {
            try {
              const { createLogger } = await import('@consuelo/logger');
              createLogger('voice:status').warn('Customer call failed', {
                callSid,
                conferenceName,
                status: callStatus,
              });
            } catch {
              // logger unavailable, continue
            }
          }
        }

  // Check if this is an agent call ending (check callerIdMap)
  const callerId = callerIdMap.get(callSid);
  if (callerId && FAILURE_STATUSES.has(callStatus)) {
    try {
      await sharedCallerIdLockService.releaseLockByNumber(callerId);
            callerIdMap.delete(callSid);
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : 'Lock release failed';
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
  ];
};
