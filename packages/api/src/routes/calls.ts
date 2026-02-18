import { randomUUID } from 'node:crypto';
import { errorHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { RouteDefinition } from './index.js';
import * as Sentry from '@sentry/node';
import { sharedDialer as dialer } from '../shared/dialer.js';
import { getSharedPool } from '../shared/db.js';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

interface CallBody {
  to: string;
  from?: string;
  userId?: string;
  statusCallbackUrl?: string;
}

interface CallbackBody {
  agentPhone: string;
  customerPhone: string;
  callerId?: string;
  contactId?: string;
}

interface AnalysisBody {
  performanceScore?: number;
  sentiment?: string;
  keyMoments?: unknown[];
  summary?: string;
}

const SQL_HISTORY =
  'SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.workspace_id = $1';

const SQL_HISTORY_COUNT =
  'SELECT COUNT(*) AS total FROM calls c WHERE c.workspace_id = $1';

const SQL_GET_CALL =
  'SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.id = $1 AND c.workspace_id = $2';

const SQL_GET_TRANSCRIPT =
  'SELECT transcript FROM calls WHERE id = $1 AND workspace_id = $2';

const SQL_GET_RECORDING_INFO =
  'SELECT conference_name, recording_sid FROM calls WHERE id = $1 AND workspace_id = $2';

const SQL_PERSIST_ANALYSIS =
  'UPDATE calls SET analysis = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING id';

const getPool = getSharedPool;

export const callRoutes = (): RouteDefinition[] => {
  return [
    {
      method: 'POST',
      path: '/v1/calls',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CallBody | undefined;
        if (!body?.to) {
          res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'Missing "to" field' },
          });
          return;
        }

        try {
          const result = await dialer.dial({
            to: body.to,
            from: body.from ?? '',
            userId: body.userId ?? req.auth?.userId ?? '',
            statusCallbackUrl: body.statusCallbackUrl,
          });

          if (!result.success) {
            res.status(500).json({
              error: {
                code: 'DIAL_FAILED',
                message: result.error ?? 'Unknown error',
              },
            });
            return;
          }

          res
            .status(201)
            .json({ callSid: result.callSid, status: 'initiated' });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: { context: 'dial', to: body.to },
            },
          );
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'DIAL_FAILED', message } });
        }
      }),
    },

    {
      method: 'POST',
      path: '/v1/calls/callback',
      handler: errorHandler(async (req, res) => {
        const body = req.body as CallbackBody | undefined;
        if (!body?.agentPhone || !body?.customerPhone) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing agentPhone or customerPhone',
            },
          });
          return;
        }
        if (
          !E164_REGEX.test(body.agentPhone) ||
          !E164_REGEX.test(body.customerPhone)
        ) {
          res.status(400).json({
            error: {
              code: 'INVALID_PHONE',
              message: 'Phone numbers must be E.164 format',
            },
          });
          return;
        }
        if (body.callerId && !E164_REGEX.test(body.callerId)) {
          res.status(400).json({
            error: {
              code: 'INVALID_PHONE',
              message: 'callerId must be E.164 format',
            },
          });
          return;
        }

        const conferenceName = `conf-${randomUUID()}`;
        const callerId =
          body.callerId ?? process.env.TWILIO_CALLER_ID ?? body.agentPhone;
        const baseUrl = process.env.API_BASE_URL ?? '';
        const twimlUrl = `${baseUrl}/v1/calls/callback/twiml?customer=${encodeURIComponent(body.customerPhone)}&conf=${encodeURIComponent(conferenceName)}&from=${encodeURIComponent(callerId)}`;

        try {
          const { callSid } = await dialer.createCall(
            body.agentPhone,
            callerId,
            { url: twimlUrl },
          );
          res
            .status(201)
            .json({ callSid, conferenceName, status: 'calling-agent' });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: {
                context: 'callback_createCall',
                agentPhone: body.agentPhone,
                customerPhone: body.customerPhone,
              },
            },
          );
          const message =
            err instanceof Error ? err.message : 'Twilio API failure';
          res.status(502).json({ error: { code: 'TWILIO_ERROR', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/calls/callback/twiml',
      handler: errorHandler(async (req, res) => {
        const customer = req.query?.customer ?? '';
        const conf = req.query?.conf ?? '';
        const from = req.query?.from ?? '';

        if (!conf || !customer) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing query params',
            },
          });
          return;
        }

        const agentTwiml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<Response>',
          `<Say>Connecting you to ${customer}</Say>`,
          '<Dial>',
          `<Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false" participantLabel="agent">`,
          conf,
          '</Conference>',
          '</Dial>',
          '</Response>',
        ].join('');

        res.type('text/xml').status(200).send(agentTwiml);

        const customerTwiml = dialer.conference.generateConferenceTwiml(conf, {
          startOnEnter: false,
          endOnExit: true,
          participantLabel: 'customer',
        });
        dialer
          .createCall(customer, from, { twiml: customerTwiml })
          .catch((err: unknown) => {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              {
                extra: { context: 'callback_customer_dial', customer, conf },
              },
            );
          });
      }),
    },

    {
      method: 'GET',
      path: '/v1/calls/history',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const limit = Math.min(Number(req.query?.limit) || 50, 250);
        const offset = Number(req.query?.offset) || 0;

        const conditions = ['c.workspace_id = $1'];
        const params: unknown[] = [auth.workspaceId];
        let idx = 2;

        if (req.query?.outcome) {
          conditions.push(`c.outcome = $${idx}`);
          params.push(req.query.outcome);
          idx++;
        }
        if (req.query?.from) {
          conditions.push(`c.start_time >= $${idx}`);
          params.push(req.query.from);
          idx++;
        }
        if (req.query?.to) {
          conditions.push(`c.start_time <= $${idx}`);
          params.push(req.query.to);
          idx++;
        }
        if (req.query?.contactId) {
          conditions.push(`c.contact_id = $${idx}`);
          params.push(req.query.contactId);
          idx++;
        }

        const where = conditions.join(' AND ');
        const db = await getPool();

        const countResult = await db.query(
          'SELECT COUNT(*) AS total FROM calls c WHERE ' + where,
          params,
        );
        const total = Number(countResult.rows[0]?.total ?? 0);

        const dataParams = [...params, limit, offset];
        const { rows } = await db.query(
          'SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE ' +
            where +
            ' ORDER BY c.start_time DESC LIMIT $' +
            String(idx) +
            ' OFFSET $' +
            String(idx + 1),
          dataParams,
        );

        res.status(200).json({ calls: rows, total, limit, offset });
      }),
    },

    // --- recording proxy route (literal before :id) ---
    {
      method: 'GET',
      path: '/v1/recordings/:sid/stream',
      handler: errorHandler(async (req, res) => {
        const recordingSid = req.params?.sid;
        if (!recordingSid) {
          res
            .status(400)
            .json({
              error: {
                code: 'INVALID_REQUEST',
                message: 'Missing recording SID',
              },
            });
          return;
        }
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();

        // Verify user has access to this recording via workspace
        const { rows } = await db.query(SQL_GET_CALL_BY_RECORDING_SID, [
          recordingSid,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(403)
            .json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
          return;
        }

        // STUB: redirect to Twilio URL (replace with proxy streaming if needed)
        const apiBaseUrl = process.env.API_BASE_URL ?? '';
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID ?? ''}/Recordings/${recordingSid}.mp3`;
        res.redirect(twilioUrl);
      }),
    },

    {
      method: 'GET',
      path: '/v1/calls/:id',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET_CALL, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Call not found' } });
          return;
        }

        res.status(200).json(rows[0]);
      }),
    },
    {
      method: 'POST',
      path: '/v1/calls/:id/hangup',
      handler: errorHandler(async (req, res) => {
        const callSid = req.params?.id;
        if (!callSid) {
          res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'Missing call ID' },
          });
          return;
        }

        try {
          const result = await dialer.hangup(callSid);
          if (!result.success) {
            res.status(500).json({
              error: {
                code: 'HANGUP_FAILED',
                message: result.error ?? 'Unknown error',
              },
            });
            return;
          }

          res.status(200).json({ callSid, status: 'completed' });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: { context: 'hangup', callSid },
            },
          );
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.status(500).json({ error: { code: 'HANGUP_FAILED', message } });
        }
      }),
    },
    {
      method: 'POST',
      path: '/v1/calls/:id/analysis',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const callId = req.params?.id;
        if (!callId) {
          res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: 'Missing call ID' },
          });
          return;
        }

        const body = req.body as AnalysisBody | undefined;
        if (!body) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing analysis body',
            },
          });
          return;
        }

        const db = await getPool();
        const { rows } = await db.query(SQL_PERSIST_ANALYSIS, [
          JSON.stringify(body),
          callId,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Call not found' } });
          return;
        }

        res.status(201).json({ callId, persisted: true });
      }),
    },
    {
      method: 'GET',
      path: '/v1/calls/:id/recording',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET_RECORDING_INFO, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Call not found' } });
          return;
        }

        const recordingSid = rows[0].recording_sid as string | null;
        const conferenceName = rows[0].conference_name as string | null;

        // STUB: return proxy URL instead of direct Twilio URL
        const apiBaseUrl = process.env.API_BASE_URL ?? '';
        if (recordingSid) {
          try {
            const recording = await dialer.getRecording(recordingSid);
            res
              .status(200)
              .json({ url: recording.url, duration: recording.duration });
            return;
          } catch (err: unknown) {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              {
                extra: { context: 'getRecording', recordingSid },
              },
            );
          }
        }

        if (conferenceName) {
          try {
            const recordings =
              await dialer.conference.listRecordings(conferenceName);
            if (recordings.length > 0) {
              res.status(200).json({
                url: recordings[0].url,
                duration: recordings[0].duration,
              });
              return;
            }
          } catch (err: unknown) {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              {
                extra: { context: 'listRecordings', conferenceName },
              },
            );
          }
        }

        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'No recording available' },
        });
      }),
    },
    {
      method: 'GET',
      path: '/v1/calls/:id/transcript',
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();
        const { rows } = await db.query(SQL_GET_TRANSCRIPT, [
          req.params?.id,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(404)
            .json({ error: { code: 'NOT_FOUND', message: 'Call not found' } });
          return;
        }

        const transcript = rows[0].transcript as unknown[] | null;
        if (!transcript) {
          res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'No transcript available' },
          });
          return;
        }

        res.status(200).json({ entries: transcript });
      }),
    },
  ];
};
