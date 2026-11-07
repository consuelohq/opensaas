import { Hono } from 'hono';

import type { DialerServerDependencies } from '../contracts';
import { runApplicationEffect } from '../effect-runner';
import { dialerErrorResponse, invalidRequestResponse } from '../errors';
import { verifyAndParseTwilioRequest } from '../middleware/twilio';

type CallOwner = { workspaceId: string; providerAccountId?: string | null };

const callbackAccountMatches = (
  dependencies: DialerServerDependencies,
  accountSid: string | undefined,
  live: CallOwner | null,
  bound: CallOwner | null,
): boolean => {
  const master = dependencies.twilioMasterAccountSid;
  if (!master) return true;
  if (!live && !bound) return false;
  // Null persisted account is a legacy parent-owned call, not a reason to
  // reinterpret it using the workspace's current child account.
  const expected = bound
    ? bound.providerAccountId ?? master
    : live?.providerAccountId ?? master;
  return /^AC[0-9a-fA-F]{32}$/.test(expected) &&
    accountSid === expected &&
    (!live || !bound || (
      live.workspaceId === bound.workspaceId &&
      (live.providerAccountId ?? master) === expected
    ));
};

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
      const stored = dependencies.callOperations?.resolveStatusCallOwnership
        ? await runApplicationEffect(
            dependencies.callOperations.resolveStatusCallOwnership({
              providerCallId: input.callSid,
            }),
          )
        : null;
      if (stored && !stored.ok) {
        return dialerErrorResponse(context, stored.error);
      }
      const bound = stored?.ok ? stored.value : null;
      const live = callContext?.ok ? callContext.value : null;
      // Redis can expire before a late status callback arrives. A valid
      // child-account signature does not prove ownership of this CallSid.
      if (!callbackAccountMatches(dependencies, verified.params.AccountSid, live, bound)) {
        return context.json({ error: { code: 'UNAUTHORIZED',
          message: 'Twilio account does not own this call', retryable: false } }, 401);
      }
      const result = await runApplicationEffect(
        dependencies.application.processTwilioStatus({
          ...input,
          ...(dependencies.twilioMasterAccountSid && (bound?.workspaceId ?? live?.workspaceId)
            ? { ownerWorkspaceId: bound?.workspaceId ?? live?.workspaceId }
            : {}),
        }),
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
      const callContext = dependencies.application.resolveTwilioCallContext
        ? await runApplicationEffect(
            dependencies.application.resolveTwilioCallContext({ callSid }),
          ) : null;
      if (callContext && !callContext.ok) {
        return dialerErrorResponse(context, callContext.error);
      }
      // The Redis group can expire before Twilio's recording callback.
      // Derive the call's workspace and immutable provider account from
      // durable history; a valid signature for another child is insufficient.
      const stored = dependencies.callOperations.resolveRecordingCallOwnership
        ? await runApplicationEffect(
            dependencies.callOperations.resolveRecordingCallOwnership({
              providerCallId: callSid,
            }),
          )
        : null;
      if (stored && !stored.ok) {
        return dialerErrorResponse(context, stored.error);
      }
      const bound = stored?.ok ? stored.value : null;
      const live = callContext?.ok ? callContext.value : null;
      if (!bound || !callbackAccountMatches(
        dependencies, verified.params.AccountSid, live, bound,
      )) {
        return context.json({ error: { code: 'UNAUTHORIZED',
          message: 'Twilio account does not own this recording', retryable: false } }, 401);
      }
      const duration = Number(verified.params.RecordingDuration);
      const result = await runApplicationEffect(
        dependencies.callOperations.recordCallRecordingStatus({
          workspaceId: bound.workspaceId,
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
          accountSid: verified.params.AccountSid ?? '',
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
      if (dependencies.inbound)
        await dependencies.inbound.admitOutboundRep({
          sessionId,
          clientIdentity,
          callSid: verified.params.CallSid ?? '',
          accountSid: verified.params.AccountSid ?? '',
        });
      const result = await runApplicationEffect(
        dependencies.application.generateTwilioAgentTwiml({
          sessionId,
          clientIdentity,
          ...(dependencies.twilioMasterAccountSid ? {
            accountSid: verified.params.AccountSid,
            parentAccountSid: dependencies.twilioMasterAccountSid,
          } : {}),
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
      const callContext = dependencies.application.resolveTwilioCallContext
        ? await runApplicationEffect(
            dependencies.application.resolveTwilioCallContext({
              callSid: input.callSid,
            }),
          ) : null;
      if (callContext && !callContext.ok) {
        return dialerErrorResponse(context, callContext.error);
      }
      const stored = dependencies.callOperations?.resolveStatusCallOwnership
        ? await runApplicationEffect(
            dependencies.callOperations.resolveStatusCallOwnership({
              providerCallId: input.callSid,
            }),
          )
        : null;
      if (stored && !stored.ok) {
        return dialerErrorResponse(context, stored.error);
      }
      const bound = stored?.ok ? stored.value : null;
      const live = callContext?.ok ? callContext.value : null;
      if (!callbackAccountMatches(dependencies, verified.params.AccountSid, live, bound)) {
        return context.json({ error: { code: 'UNAUTHORIZED',
          message: 'Twilio account does not own this leg', retryable: false } }, 401);
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
