import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { createDialerServer } from './app';
import type { DialerServerDependencies } from './contracts';

const createDependencies = () =>
  ({
    application: {
      startCallSession: mock(() => Effect.die('unused')),
      getCallSession: mock(() => Effect.die('unused')),
      terminateCallSession: mock(() => Effect.die('unused')),
      processTwilioStatus: mock(() =>
        Effect.succeed({ received: true as const, groupId: 'group-1' }),
      ),
      generateTwilioCustomerTwiml: mock(() =>
        Effect.succeed('<Response><Dial /></Response>'),
      ),
      generateTwilioAgentTwiml: mock(() =>
        Effect.succeed('<Response><Dial><Conference>conference-1</Conference></Dial></Response>'),
      ),
      markAgentReady: mock(() =>
        Effect.succeed({ groupId: 'group-1', status: 'connected', remainingCleanup: 0 }),
      ),
    },
    authenticate: mock(async () => null),
    verifyTwilioSignature: mock(async () => true),
  }) satisfies DialerServerDependencies;

describe('Twilio webhook boundary', () => {
  it('verifies form callbacks against the exact forwarded public URL and parsed form fields', async () => {
    const dependencies = createDependencies();
    const rawBody =
      'CallSid=CA_TEST&CallStatus=completed&AnsweredBy=human&CallDuration=42';
    const response = await createDialerServer(dependencies).fetch(
      new Request('http://internal.test/webhooks/twilio/status?source=test', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-forwarded-host': 'dialer.example.test, proxy.internal',
          'x-forwarded-proto': 'https, http',
          'x-twilio-signature': 'signature',
        },
        body: rawBody,
      }),
    );
    expect(response.status).toBe(200);
    expect(dependencies.verifyTwilioSignature).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyTwilioSignature).toHaveBeenCalledWith({
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      params: {
        CallSid: 'CA_TEST',
        CallStatus: 'completed',
        AnsweredBy: 'human',
        CallDuration: '42',
      },
      rawBody,
      signature: 'signature',
      url: 'https://dialer.example.test/webhooks/twilio/status?source=test',
    });
    expect(dependencies.application.processTwilioStatus).toHaveBeenCalledTimes(
      1,
    );
    expect(dependencies.application.processTwilioStatus).toHaveBeenCalledWith({
      callSid: 'CA_TEST',
      callStatus: 'completed',
      answeredBy: 'human',
      callDuration: '42',
      dialCallDuration: undefined,
    });
  });

  it('verifies JSON callbacks against the exact raw body representation', async () => {
    const dependencies = createDependencies();
    const rawBody = '{"CallSid":"CA_JSON","CallStatus":"ringing"}';
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/status', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-twilio-signature': 'signature',
        },
        body: rawBody,
      }),
    );
    expect(response.status).toBe(200);
    expect(dependencies.verifyTwilioSignature).toHaveBeenCalledWith({
      contentType: 'application/json',
      params: { CallSid: 'CA_JSON', CallStatus: 'ringing' },
      rawBody,
      signature: 'signature',
      url: 'https://dialer.test/webhooks/twilio/status',
    });
  });

  it('preserves provider-owned TwiML fields and returns XML', async () => {
    const dependencies = createDependencies();
    const body =
      'CallSid=CA_TEST&CallStatus=in-progress&AnsweredBy=machine_start&DialCallDuration=3';
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/customer-twiml', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'signature',
        },
        body,
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/xml');
    expect(await response.text()).toBe('<Response><Dial /></Response>');
    expect(
      dependencies.application.generateTwilioCustomerTwiml,
    ).toHaveBeenCalledTimes(1);
    expect(
      dependencies.application.generateTwilioCustomerTwiml,
    ).toHaveBeenCalledWith({
      callSid: 'CA_TEST',
      callStatus: 'in-progress',
      answeredBy: 'machine_start',
      callDuration: undefined,
      dialCallDuration: '3',
    });
  });

  it('verifies the browser agent webhook and returns agent conference TwiML', async () => {
    const dependencies = createDependencies();
    const body = 'CallSid=CA_AGENT&From=client%3Auser_user-1&SessionId=group-1';
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/agent-twiml', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'signature',
        },
        body,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/xml');
    expect(dependencies.application.generateTwilioAgentTwiml).toHaveBeenCalledWith({
      sessionId: 'group-1',
      clientIdentity: 'user_user-1',
    });
  });

  it('rejects invalid signatures without invoking application behavior', async () => {
    const dependencies = createDependencies();
    dependencies.verifyTwilioSignature.mockImplementation(async () => false);
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'bad',
        },
        body: 'CallSid=CA_TEST&CallStatus=completed',
      }),
    );
    expect(response.status).toBe(401);
    expect(dependencies.application.processTwilioStatus).not.toHaveBeenCalled();
  });
});
