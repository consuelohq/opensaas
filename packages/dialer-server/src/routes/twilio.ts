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
      const result = await runApplicationEffect(
        dependencies.application.processTwilioStatus(input),
      );
      return result.ok
        ? context.json(result.value)
        : dialerErrorResponse(context, result.error);
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
