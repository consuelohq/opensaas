import * as Sentry from "@sentry/node";
import { randomUUID } from "node:crypto";

import { errorHandler } from "../middleware/error-handler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getSharedPool } from "../shared/db.js";
import {
  sharedDialer,
  getDialerForWorkspace,
  sharedCallerIdLockService,
} from "../shared/dialer.js";
import { storeRecentCallbackRoute } from "../services/callback-routing.js";
import { redisService } from "../services/redis.js";
import { evaluateRetryPolicy } from "../services/retry-policy.js";
import type { RouteDefinition } from "./index.js";
import { validateTwilioSignature } from "./voice.js";

let _callsLogger: {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
} | null = null;

const getCallsLogger = async () => {
  try {
    if (!_callsLogger) {
      const { createLogger } = await import("@consuelo/logger");
      _callsLogger = createLogger("api:audit");
    }
    return _callsLogger;
  } catch (err: unknown) {
    _callsLogger = null;
    throw err;
  }
};

const getLegacyDialer = sharedDialer;
const getCallerIdLockService = sharedCallerIdLockService;

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

type Disposition =
  | "connected"
  | "voicemail"
  | "no-answer"
  | "busy"
  | "follow-up"
  | "not-interested";

const VALID_DISPOSITIONS: ReadonlySet<string> = new Set<Disposition>([
  "connected",
  "voicemail",
  "no-answer",
  "busy",
  "follow-up",
  "not-interested",
]);

interface DispositionBody {
  outcome: Disposition;
  notes?: string;
  contactId?: string;
  queueId?: string;
  isHighPriority?: boolean;
  localTimezone?: string;
  attemptCap?: number;
}

interface InitiatePhoneCallBody {
  repPhone: string;
  leadPhone: string;
  from?: string;
  localPresence?: boolean;
  queueId?: string;
  contactId?: string;
}

const _SQL_HISTORY =
  "SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE c.workspace_id = $1";

const _SQL_HISTORY_COUNT =
  "SELECT COUNT(*) AS total FROM calls c WHERE c.workspace_id = $1";

const SQL_CALL_LOOKUP_WHERE =
  "WHERE (c.id::text = $1 OR c.call_sid = $1) AND c.workspace_id = $2";

const SQL_CALL_LOOKUP_WHERE_WITHOUT_ALIAS =
  "WHERE (id::text = $1 OR call_sid = $1) AND workspace_id = $2";

const SQL_GET_CALL = `SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id ${SQL_CALL_LOOKUP_WHERE}`;

const SQL_GET_TRANSCRIPT = `SELECT transcript FROM calls ${SQL_CALL_LOOKUP_WHERE_WITHOUT_ALIAS}`;

const SQL_GET_RECORDING_INFO = `SELECT conference_name, recording_sid FROM calls ${SQL_CALL_LOOKUP_WHERE_WITHOUT_ALIAS}`;

const SQL_PERSIST_ANALYSIS =
  "UPDATE calls SET analysis = $1, updated_at = NOW() WHERE (id::text = $2 OR call_sid = $2) AND workspace_id = $3 RETURNING id";

const SQL_GET_CALL_BY_RECORDING_SID =
  "SELECT id FROM calls WHERE recording_sid = $1 AND workspace_id = $2";

const SQL_SET_DISPOSITION =
  "UPDATE calls SET outcome = COALESCE($1, outcome), notes = COALESCE($2, notes), updated_at = NOW() WHERE (id::text = $3 OR call_sid = $3) AND workspace_id = $4 RETURNING id, outcome, notes";

const getPool = getSharedPool;

const isCallNotFoundError = (err: unknown): boolean => {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("not found") ||
      msg.includes("does not exist") ||
      /\b404\b/.test(msg)
    ) {
      return true;
    }
  }
  if (err && typeof err === "object") {
    const e = err as { status?: number; code?: number };
    if (e.status === 404 || e.code === 20404) {
      return true;
    }
  }
  return false;
};

export const callRoutes = (): RouteDefinition[] => {
  return [
    {
      method: "POST",
      path: "/v1/calls",
      handler: errorHandler(async (req, res) => {
        const body = req.body as CallBody | undefined;
        if (!body?.to) {
          res.status(400).json({
            error: { code: "INVALID_REQUEST", message: 'Missing "to" field' },
          });
          return;
        }

        try {
          const dialer = await getDialerForWorkspace(
            req.auth?.workspaceId ?? "",
          );
          const result = await dialer.dial({
            to: body.to,
            from: body.from ?? "",
            userId: req.auth?.userId ?? "",
            statusCallbackUrl: body.statusCallbackUrl,
          });

          if (!result.success) {
            res.status(500).json({
              error: {
                code: "DIAL_FAILED",
                message: result.error ?? "Unknown error",
              },
            });
            return;
          }

          if (
            result.fromNumber &&
            req.auth?.workspaceId &&
            req.auth?.userId
          ) {
            await storeRecentCallbackRoute({
              workspaceId: req.auth.workspaceId,
              userId: req.auth.userId,
              twilioNumber: result.fromNumber,
              prospectNumber: body.to,
            });
          }

          res
            .status(201)
            .json({ callSid: result.callSid, status: "initiated" });
          (await getCallsLogger()).info("call.initiated", {
            action: "call.initiated",
            userId: req.auth?.userId ?? "anonymous",
            outcome: "success",
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: { context: "dial", to: body.to },
            },
          );
          const message = err instanceof Error ? err.message : "Unknown error";
          res.status(500).json({ error: { code: "DIAL_FAILED", message } });
        }
      }),
    },

    {
      method: "POST",
      path: "/v1/calls/callback",
      handler: errorHandler(async (req, res) => {
        const body = req.body as CallbackBody | undefined;
        if (!body?.agentPhone || !body?.customerPhone) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing agentPhone or customerPhone",
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
              code: "INVALID_PHONE",
              message: "Phone numbers must be E.164 format",
            },
          });
          return;
        }
        if (body.callerId && !E164_REGEX.test(body.callerId)) {
          res.status(400).json({
            error: {
              code: "INVALID_PHONE",
              message: "callerId must be E.164 format",
            },
          });
          return;
        }

        const conferenceName = `conf-${randomUUID()}`;
        const callerId =
          body.callerId ?? process.env.TWILIO_CALLER_ID ?? body.agentPhone;
        const baseUrl = process.env.API_BASE_URL ?? "";
        const twimlUrl = `${baseUrl}/v1/calls/callback/twiml?customer=${encodeURIComponent(body.customerPhone)}&conf=${encodeURIComponent(conferenceName)}&from=${encodeURIComponent(callerId)}`;

        try {
          const dialer = await getDialerForWorkspace(
            req.auth?.workspaceId ?? "",
          );
          const { callSid } = await dialer.createCall(
            body.agentPhone,
            callerId,
            { url: twimlUrl },
          );

          if (
            req.auth?.workspaceId &&
            req.auth?.userId
          ) {
            await storeRecentCallbackRoute({
              workspaceId: req.auth.workspaceId,
              userId: req.auth.userId,
              twilioNumber: callerId,
              prospectNumber: body.customerPhone,
            });
          }

          res
            .status(201)
            .json({ callSid, conferenceName, status: "calling-agent" });
          (await getCallsLogger()).info("call.callback", {
            action: "call.callback",
            userId: req.auth?.userId ?? "anonymous",
            outcome: "success",
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: {
                context: "callback_createCall",
                agentPhone: body.agentPhone,
                customerPhone: body.customerPhone,
              },
            },
          );
          const message =
            err instanceof Error ? err.message : "Twilio API failure";
          res.status(502).json({ error: { code: "TWILIO_ERROR", message } });
        }
      }),
    },
    {
      method: "POST",
      path: "/v1/calls/callback/twiml",
      handler: errorHandler(async (req, res) => {
        if (!(await validateTwilioSignature(req, res))) return;
        const customer = req.query?.customer ?? "";
        const conf = req.query?.conf ?? "";
        const from = req.query?.from ?? "";

        if (!conf || !customer) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing query params",
            },
          });
          return;
        }

        const agentTwiml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          "<Response>",
          `<Say>Connecting you to ${customer}</Say>`,
          "<Dial>",
          `<Conference startConferenceOnEnter="true" endConferenceOnExit="false" beep="false" participantLabel="agent">`,
          conf,
          "</Conference>",
          "</Dial>",
          "</Response>",
        ].join("");

        res.type("text/xml").status(200).send(agentTwiml);

        const customerTwiml =
          getLegacyDialer().conference.generateConferenceTwiml(conf, {
            startOnEnter: false,
            endOnExit: true,
            participantLabel: "customer",
          });
        getLegacyDialer()
          .createCall(customer, from, { twiml: customerTwiml })
          .catch((err: unknown) => {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              {
                extra: { context: "callback_customer_dial", customer, conf },
              },
            );
          });
      }),
    },

    {
      method: "POST",
      path: "/v1/calls/initiate-phone",
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const body = req.body as InitiatePhoneCallBody | undefined;
        if (!body?.repPhone || !body?.leadPhone) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing repPhone or leadPhone",
            },
          });
          return;
        }
        if (
          !E164_REGEX.test(body.repPhone) ||
          !E164_REGEX.test(body.leadPhone)
        ) {
          res.status(400).json({
            error: {
              code: "INVALID_PHONE",
              message: "Phone numbers must be E.164 format",
            },
          });
          return;
        }
        if (body.from && !E164_REGEX.test(body.from)) {
          res.status(400).json({
            error: {
              code: "INVALID_PHONE",
              message: "from must be E.164 format",
            },
          });
          return;
        }

        try {
          const dialer = await getDialerForWorkspace(auth.workspaceId);
          let callerId = body.from ?? "";

          if (!callerId && body.localPresence !== false) {
            try {
              const numbers = await dialer.listNumbers();
              if (numbers.length > 0) {
                const pool = {
                  numbers,
                  primaryNumber:
                    numbers.find((number) => number.isPrimary) ?? numbers[0],
                };
                const resolution = await dialer.resolveCallerId(
                  {
                    to: body.leadPhone,
                    from: body.repPhone,
                    localPresence: true,
                  },
                  pool,
                );
                if (resolution.callerIdNumber) {
                  callerId = resolution.callerIdNumber;
                }
              }
            } catch (err: unknown) {
              Sentry.captureException(
                err instanceof Error ? err : new Error(String(err)),
                { extra: { context: "initiate_phone_local_presence" } },
              );
            }
          }

          if (!callerId) {
            callerId = process.env.TWILIO_CALLER_ID ?? body.repPhone;
          }

          try {
            const lockService = getCallerIdLockService();
            const locked = await lockService.acquireLock(
              callerId,
              auth.userId,
              "",
            );
            if (!locked) {
              res.status(409).json({
                error: {
                  code: "CALLER_ID_LOCKED",
                  message:
                    "Caller ID number is currently in use by another call",
                },
              });
              return;
            }
          } catch (err: unknown) {
            Sentry.captureException(
              err instanceof Error ? err : new Error(String(err)),
              { extra: { context: "initiate_phone_caller_id_lock" } },
            );
          }

          const callId = randomUUID();
          const conferenceName = `conf-phone-${randomUUID()}`;
          const baseUrl = process.env.API_BASE_URL ?? "";
          const statusCallbackUrl = `${baseUrl}/v1/voice/phone-status`;

          const twiml = dialer.conference.generateConferenceTwiml(
            conferenceName,
            {
              startOnEnter: true,
              endOnExit: false,
              participantLabel: "agent",
            },
          );

          const { callSid: repCallSid } = await dialer.createCall(
            body.repPhone,
            callerId,
            {
              twiml,
              statusCallback: statusCallbackUrl,
              statusCallbackEvent: [
                "initiated",
                "ringing",
                "in-progress",
                "completed",
              ],
            },
          );

          await redisService.setPhoneCallState(callId, {
            conferenceName,
            leadPhone: body.leadPhone,
            callerId,
            repCallSid,
            repPhone: body.repPhone,
            contactId: body.contactId ?? null,
            queueId: body.queueId ?? null,
            workspaceId: auth.workspaceId,
            userId: auth.userId,
            status: "initiating",
            createdAt: new Date().toISOString(),
          });
          await redisService.mapCallSidToCallId(repCallSid, callId);
          await storeRecentCallbackRoute({
            workspaceId: auth.workspaceId,
            userId: auth.userId,
            twilioNumber: callerId,
            prospectNumber: body.leadPhone,
          });

          await redisService.publishCallEvent({
            type: "call.started",
            callId,
            conferenceName,
            repPhone: body.repPhone,
            leadPhone: body.leadPhone,
            contactId: body.contactId ?? null,
            userId: auth.userId,
            timestamp: new Date().toISOString(),
          });

          res.status(201).json({
            callId,
            conferenceName,
            repCallSid,
            status: "initiating",
          });
          (await getCallsLogger()).info("call.initiate_phone", {
            action: "call.initiate_phone",
            userId: auth.userId,
            callId,
            outcome: "success",
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: {
                context: "initiate_phone",
                repPhone: body.repPhone,
                leadPhone: body.leadPhone,
              },
            },
          );
          const message =
            err instanceof Error
              ? err.message
              : "Failed to initiate phone call";
          res.status(502).json({ error: { code: "TWILIO_ERROR", message } });
        }
      }),
    },

    {
      method: "GET",
      path: "/v1/calls/history",
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const limit = Math.min(Number(req.query?.limit) || 50, 250);
        const offset = Number(req.query?.offset) || 0;

        const conditions = ["c.workspace_id = $1"];
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

        const where = conditions.join(" AND ");
        const db = await getPool();

        const countResult = await db.query(
          "SELECT COUNT(*) AS total FROM calls c WHERE " + where,
          params,
        );
        const total = Number(countResult.rows[0]?.total ?? 0);

        const dataParams = [...params, limit, offset];
        const { rows } = await db.query(
          "SELECT c.*, ct.name AS contact_name, ct.company AS contact_company FROM calls c LEFT JOIN contacts ct ON c.contact_id = ct.id WHERE " +
            where +
            " ORDER BY c.start_time DESC LIMIT $" +
            String(idx) +
            " OFFSET $" +
            String(idx + 1),
          dataParams,
        );

        res.status(200).json({ calls: rows, total, limit, offset });
      }),
    },

    {
      method: "GET",
      path: "/v1/recordings/:sid/stream",
      handler: errorHandler(async (req, res) => {
        const recordingSid = req.params?.sid;
        if (!recordingSid) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing recording SID",
            },
          });
          return;
        }
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const db = await getPool();

        const { rows } = await db.query(SQL_GET_CALL_BY_RECORDING_SID, [
          recordingSid,
          auth.workspaceId,
        ]);
        if (rows.length === 0) {
          res
            .status(403)
            .json({ error: { code: "FORBIDDEN", message: "Access denied" } });
          return;
        }

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID ?? ""}/Recordings/${recordingSid}.mp3`;
        res.status(200).json({ url: twilioUrl });
      }),
    },

    {
      method: "GET",
      path: "/v1/calls/:id",
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
            .json({ error: { code: "NOT_FOUND", message: "Call not found" } });
          return;
        }

        res.status(200).json(rows[0]);
      }),
    },
    {
      method: "POST",
      path: "/v1/calls/:id/hangup",
      handler: errorHandler(async (req, res) => {
        const callSid = req.params?.id;
        if (!callSid) {
          res.status(400).json({
            error: { code: "INVALID_REQUEST", message: "Missing call ID" },
          });
          return;
        }

        const workspaceId = req.auth?.workspaceId;
        let dialer = workspaceId
          ? await getDialerForWorkspace(workspaceId)
          : getLegacyDialer();

        try {
          let result = await dialer.hangup(callSid);

          if (workspaceId && !result.success && isCallNotFoundError(result)) {
            const legacyDialer = getLegacyDialer();
            result = await legacyDialer.hangup(callSid);
          }

          if (!result.success) {
            res.status(500).json({
              error: {
                code: "HANGUP_FAILED",
                message: result.error ?? "Unknown error",
              },
            });
            return;
          }

          res.status(200).json({ callSid, status: "completed" });
          (await getCallsLogger()).info("call.hangup", {
            action: "call.hangup",
            userId: req.auth?.userId ?? "anonymous",
            outcome: "success",
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              extra: { context: "hangup", callSid },
            },
          );
          const message = err instanceof Error ? err.message : "Unknown error";
          res.status(500).json({ error: { code: "HANGUP_FAILED", message } });
        }
      }),
    },
    {
      method: "POST",
      path: "/v1/calls/:id/analysis",
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const callId = req.params?.id;
        if (!callId) {
          res.status(400).json({
            error: { code: "INVALID_REQUEST", message: "Missing call ID" },
          });
          return;
        }

        const body = req.body as AnalysisBody | undefined;
        if (!body) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing analysis body",
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
            .json({ error: { code: "NOT_FOUND", message: "Call not found" } });
          return;
        }

        res.status(201).json({ callId, persisted: true });
        (await getCallsLogger()).info("call.analysis", {
          action: "call.analysis",
          userId: auth?.userId ?? "anonymous",
          outcome: "success",
        });
      }),
    },
    {
      method: "GET",
      path: "/v1/calls/:id/recording",
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
            .json({ error: { code: "NOT_FOUND", message: "Call not found" } });
          return;
        }

        const recordingSid = rows[0].recording_sid as string | null;
        const conferenceName = rows[0].conference_name as string | null;

        let dialer = auth.workspaceId
          ? await getDialerForWorkspace(auth.workspaceId)
          : getLegacyDialer();

        if (recordingSid) {
          try {
            const recording = await dialer.getRecording(recordingSid);
            res
              .status(200)
              .json({ url: recording.url, duration: recording.duration });
            return;
          } catch (err: unknown) {
            if (auth.workspaceId && isCallNotFoundError(err)) {
              try {
                const legacyDialer = getLegacyDialer();
                const recording = await legacyDialer.getRecording(recordingSid);
                res
                  .status(200)
                  .json({ url: recording.url, duration: recording.duration });
                return;
              } catch (legacyErr: unknown) {
                Sentry.captureException(
                  legacyErr instanceof Error
                    ? legacyErr
                    : new Error(String(legacyErr)),
                  {
                    extra: {
                      context: "getRecording_legacy_fallback",
                      recordingSid,
                    },
                  },
                );
              }
            } else {
              Sentry.captureException(
                err instanceof Error ? err : new Error(String(err)),
                { extra: { context: "getRecording", recordingSid } },
              );
            }
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
            if (auth.workspaceId && isCallNotFoundError(err)) {
              try {
                const legacyDialer = getLegacyDialer();
                const recordings =
                  await legacyDialer.conference.listRecordings(conferenceName);
                if (recordings.length > 0) {
                  res.status(200).json({
                    url: recordings[0].url,
                    duration: recordings[0].duration,
                  });
                  return;
                }
              } catch (legacyErr: unknown) {
                Sentry.captureException(
                  legacyErr instanceof Error
                    ? legacyErr
                    : new Error(String(legacyErr)),
                  {
                    extra: {
                      context: "listRecordings_legacy_fallback",
                      conferenceName,
                    },
                  },
                );
              }
            } else {
              Sentry.captureException(
                err instanceof Error ? err : new Error(String(err)),
                { extra: { context: "listRecordings", conferenceName } },
              );
            }
          }
        }

        res.status(404).json({
          error: { code: "NOT_FOUND", message: "No recording available" },
        });
      }),
    },
    {
      method: "POST",
      path: "/v1/calls/:id/disposition",
      handler: errorHandler(async (req, res) => {
        const auth = requireAuth(req, res);
        if (auth === null) return;

        const callId = req.params?.id;
        if (!callId) {
          res.status(400).json({
            error: { code: "INVALID_REQUEST", message: "Missing call ID" },
          });
          return;
        }

        const body = req.body as Partial<DispositionBody> | undefined;
        if (!body || (!body.outcome && !body.notes)) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message: "Provide outcome and/or notes",
            },
          });
          return;
        }
        if (body.outcome && !VALID_DISPOSITIONS.has(body.outcome)) {
          res.status(400).json({
            error: {
              code: "INVALID_REQUEST",
              message:
                "Invalid outcome. Valid: connected, voicemail, no-answer, busy, follow-up, not-interested",
            },
          });
          return;
        }

        try {
          const db = await getPool();
          const setClauses: string[] = ["updated_at = NOW()"];
          const params: unknown[] = [];
          let idx = 1;
          const attemptCap =
            typeof body.attemptCap === "number" && body.attemptCap > 0
              ? body.attemptCap
              : 2;

          const retryDecision = evaluateRetryPolicy({
            outcome: body.outcome ?? null,
            isHighPriority: body.isHighPriority === true,
            attemptsUsed: 1,
            attemptCap,
            localTimezone: body.localTimezone ?? "America/New_York",
          });

          if (body.outcome) {
            setClauses.push(`outcome = $${idx}`);
            params.push(body.outcome);
            idx++;
          }
          if (body.notes !== undefined) {
            setClauses.push(`notes = $${idx}`);
            params.push(body.notes);
            idx++;
          }
          setClauses.push(`retry_strategy = $${idx}`);
          params.push(retryDecision.retryStrategy);
          idx++;
          setClauses.push(`retry_scheduled_at = $${idx}`);
          params.push(retryDecision.retryScheduledAt);
          idx++;
          setClauses.push(`retry_reason = $${idx}`);
          params.push(retryDecision.retryReason);
          idx++;
          params.push(callId, auth.workspaceId);
          const sql = `UPDATE calls SET ${setClauses.join(", ")} WHERE id = $${idx} AND workspace_id = $${idx + 1} RETURNING id, outcome, notes, retry_strategy, retry_scheduled_at, retry_reason`;
          const { rows } = await db.query(sql, params);
          if (rows.length === 0) {
            res.status(404).json({
              error: { code: "NOT_FOUND", message: "Call not found" },
            });
            return;
          }

          res.status(200).json({
            callId,
            outcome: rows[0].outcome,
            notes: rows[0].notes,
            retryStrategy: rows[0].retry_strategy,
            retryScheduledAt: rows[0].retry_scheduled_at,
            retryReason: rows[0].retry_reason,
          });
          (await getCallsLogger()).info("call.disposition", {
            action: "call.disposition",
            userId: auth.userId,
            callId,
            outcome: body.outcome,
          });
        } catch (err: unknown) {
          Sentry.captureException(
            err instanceof Error ? err : new Error(String(err)),
            { extra: { context: "disposition", callId } },
          );
          const message = err instanceof Error ? err.message : "Unknown error";
          res
            .status(500)
            .json({ error: { code: "DISPOSITION_FAILED", message } });
        }
      }),
    },
    {
      method: "GET",
      path: "/v1/calls/:id/transcript",
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
            .json({ error: { code: "NOT_FOUND", message: "Call not found" } });
          return;
        }

        const transcript = rows[0].transcript as unknown[] | null;
        if (!transcript) {
          res.status(404).json({
            error: { code: "NOT_FOUND", message: "No transcript available" },
          });
          return;
        }

        res.status(200).json({ entries: transcript });
      }),
    },
  ];
};
