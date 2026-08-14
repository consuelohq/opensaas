import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import { dialerErrorResponse, invalidRequestResponse } from '../errors';
import { verifyAndParseTwilioRequest } from '../middleware/twilio';

const callbackInput = (params: Record<string, string>) => ({
  callSid: params.CallSid,
  callStatus: params.CallStatus,
  answeredBy: params.AnsweredBy || undefined,
  callDuration: params.CallDuration || undefined,
  dialCallDuration: params.DialCallDuration || undefined,
});

export const createTwilioRoutes = (dependencies: DialerServerDependencies) => {
  const routes = new Hono();

  routes.post('/webhooks/twilio/status', async (context) => {
    try {
      const verified = await verifyAndParseTwilioRequest(context, dependencies);
      if (verified instanceof Response) return verified;
      const input = callbackInput(verified.params);
      if (!input.callSid || !input.callStatus) {
        return invalidRequestResponse(
          context,
          'CallSid and CallStatus are required',
        );
      }
      const callContext = dependencies.application.resolveTwilioCallContext
        ? await runApplicationEffect(
            dependencies.application.resolveTwilioCallContext({
              callSid: input.callSid,
            }),
          )
        : null;
      if (callContext && !callContext.ok) {
        return dialerErrorResponse(context, callContext.error);
      }
      const result = await runApplicationEffect(
        dependencies.application.processTwilioStatus(input),
      );
      if (!result.ok) return dialerErrorResponse(context, result.error);
      if (
        dependencies.commercial &&
        callContext?.ok &&
        callContext.value?.dialerSessionId
      ) {
        const usage = await runApplicationEffect(
          dependencies.commercial.recordProviderCompletion({
            workspaceId: callContext.value.workspaceId,
            sessionId: callContext.value.dialerSessionId,
            providerCallId: input.callSid,
            status: input.callStatus,
          }),
        );
        if (!usage.ok) return dialerErrorResponse(context, usage.error);
      }
      return context.json(result.value);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.post('/webhooks/twilio/recording-status', async (context) => {
    try {
      const verified = await verifyAndParseTwilioRequest(context, dependencies);
      if (verified instanceof Response) return verified;
      const callSid = verified.params.CallSid;
      const recordingSid = verified.params.RecordingSid;
      const recordingStatus = verified.params.RecordingStatus;
      if (!callSid || !recordingSid || !recordingStatus) {
        return invalidRequestResponse(
          context,
          'CallSid, RecordingSid, and RecordingStatus are required',
        );
      }
      if (!dependencies.callOperations) {
        return context.json(
          {
            error: {
              code: 'CALL_HISTORY_UNAVAILABLE',
              message: 'Call history runtime is unavailable',
              retryable: true,
            },
          },
          503,
        );
      }
      const duration = Number(verified.params.RecordingDuration);
      const result = await runApplicationEffect(
        dependencies.callOperations.recordCallRecordingStatus({
          providerCallId: callSid,
          recordingSid,
          recordingStatus,
          ...(Number.isFinite(duration) && duration >= 0
            ? { recordingDurationSeconds: duration }
            : {}),
        }),
      );
      return result.ok
        ? context.json({ received: true })
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.post('/webhooks/twilio/transfer-status', async (context) => {
    try {
      const verified = await verifyAndParseTwilioRequest(context, dependencies);
      if (verified instanceof Response) return verified;
      const transferId = context.req.query('transfer_id');
      const callSid = verified.params.CallSid;
      const callStatus = verified.params.CallStatus;
      if (!transferId || !callSid || !callStatus) {
        return invalidRequestResponse(
          context,
          'transfer_id, CallSid, and CallStatus are required',
        );
      }
      if (!dependencies.transfers) {
        return context.json(
          {
            error: {
              code: 'TRANSFER_RUNTIME_UNAVAILABLE',
              message: 'Transfer runtime is unavailable',
              retryable: true,
            },
          },
          503,
        );
      }
      const result = await runApplicationEffect(
        dependencies.transfers.processStatusCallback({
          transferId,
          callSid,
          callStatus,
        }),
      );
      return result.ok
        ? context.json(result.value)
        : dialerErrorResponse(context, result.error);
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.post('/webhooks/twilio/agent-twiml', async (context) => {
    try {
      const verified = await verifyAndParseTwilioRequest(context, dependencies);
      if (verified instanceof Response) return verified;
      const sessionId = verified.params.SessionId;
      const from = verified.params.From ?? '';
      const clientIdentity = from.startsWith('client:')
        ? from.slice('client:'.length)
        : '';
      if (!sessionId || !clientIdentity) {
        return invalidRequestResponse(
          context,
          'SessionId and client identity are required',
        );
      }
      const result = await runApplicationEffect(
        dependencies.application.generateTwilioAgentTwiml({
          sessionId,
          clientIdentity,
        }),
      );
      if (!result.ok) return dialerErrorResponse(context, result.error);
      return context.body(result.value, 200, {
        'content-type': 'text/xml; charset=UTF-8',
      });
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  routes.post('/webhooks/twilio/customer-twiml', async (context) => {
    try {
      const verified = await verifyAndParseTwilioRequest(context, dependencies);
      if (verified instanceof Response) return verified;
      const input = callbackInput(verified.params);
      if (!input.callSid) {
        return invalidRequestResponse(context, 'CallSid is required');
      }
      const result = await runApplicationEffect(
        dependencies.application.generateTwilioCustomerTwiml(input),
      );
      if (!result.ok) return dialerErrorResponse(context, result.error);
      return context.body(result.value, 200, {
        'content-type': 'text/xml; charset=UTF-8',
      });
    } catch (error: unknown) {
      return dialerErrorResponse(context, error);
    }
  });

  return routes;
};
