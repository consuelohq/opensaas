import { describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';

import { createDialerServer } from './app';
import type { DialerServerDependencies } from './contracts';

const createDependencies = (): DialerServerDependencies =>
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
        Effect.succeed(
          '<Response><Dial><Conference>conference-1</Conference></Dial></Response>',
        ),
      ),
      markAgentReady: mock(() =>
        Effect.succeed({
          groupId: 'group-1',
          status: 'connected',
          remainingCleanup: 0,
        }),
      ),
    },
    authenticate: mock(async () => null),
    verifyTwilioSignature: mock(async () => true),
  });

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

  it('records authoritative usage only after a tenant-bound terminal provider callback', async () => {
    const dependencies = createDependencies();
    dependencies.application.resolveTwilioCallContext = mock(() =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        dialerSessionId: 'session-1',
      }),
    );
    const recordProviderCompletion = mock(() =>
      Effect.succeed({ duplicate: false }),
    );
    dependencies.commercial = {
      catalog: () => Effect.die('unused'),
      createCheckout: () => Effect.die('unused'),
      createBillingPortal: () => Effect.die('unused'),
      previewBillingChange: () => Effect.die('unused'),
      applyBillingChange: () => Effect.die('unused'),
      dashboard: () => Effect.die('unused'),
      updateTeam: () => Effect.die('unused'),
      assignNumber: () => Effect.die('unused'),
      searchNumbers: () => Effect.die('unused'),
      provisionNumber: () => Effect.die('unused'),
      releaseNumber: () => Effect.die('unused'),
      processStripeWebhook: () => Effect.die('unused'),
      processInstallationUninstall: () => Effect.die('unused'),
      recordProviderCompletion,
    };

    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'signature',
        },
        body: 'CallSid=CA_FINAL&CallStatus=completed',
      }),
    );

    expect(response.status).toBe(200);
    expect(recordProviderCompletion).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      sessionId: 'session-1',
      providerCallId: 'CA_FINAL',
      status: 'completed',
    });
  });

  it('verifies recording callbacks and persists provider metadata without trusting callback tenant fields', async () => {
    const dependencies = createDependencies();
    const recordCallRecordingStatus = mock(() => Effect.void);
    dependencies.callOperations = {
      recordCallRecordingStatus,
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const rawBody =
      'CallSid=CA_RECORDING&RecordingSid=RE_ONE&RecordingStatus=completed&RecordingDuration=42&RecordingUrl=https%3A%2F%2Fapi.twilio.test%2Frecording&workspaceId=attacker';
    const response = await createDialerServer(dependencies).fetch(
      new Request(
        'http://internal.test/webhooks/twilio/recording-status',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'x-forwarded-host': 'dialer.example.test',
            'x-forwarded-proto': 'https',
            'x-twilio-signature': 'signature',
          },
          body: rawBody,
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(dependencies.verifyTwilioSignature).toHaveBeenCalledWith({
      contentType: 'application/x-www-form-urlencoded',
      params: {
        CallSid: 'CA_RECORDING',
        RecordingSid: 'RE_ONE',
        RecordingStatus: 'completed',
        RecordingDuration: '42',
        RecordingUrl: 'https://api.twilio.test/recording',
        workspaceId: 'attacker',
      },
      rawBody,
      signature: 'signature',
      url: 'https://dialer.example.test/webhooks/twilio/recording-status',
    });
    expect(recordCallRecordingStatus).toHaveBeenCalledWith({
      providerCallId: 'CA_RECORDING',
      recordingSid: 'RE_ONE',
      recordingStatus: 'completed',
      recordingDurationSeconds: 42,
      recordingUrl: 'https://api.twilio.test/recording',
    });
  });

  it('verifies transfer callbacks and resolves the transfer only from the signed transfer id', async () => {
    const dependencies = createDependencies();
    const processStatusCallback = mock(() =>
      Effect.succeed({ received: true as const, status: 'consulting' as const }),
    );
    dependencies.transfers = {
      initiate: () => Effect.die('unused'),
      getStatus: () => Effect.die('unused'),
      complete: () => Effect.die('unused'),
      cancel: () => Effect.die('unused'),
      processStatusCallback,
    };
    const rawBody = 'CallSid=CA_TRANSFER&CallStatus=answered&workspaceId=attacker';
    const response = await createDialerServer(dependencies).fetch(
      new Request(
        'http://internal.test/webhooks/twilio/transfer-status?transfer_id=transfer-one',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'x-forwarded-host': 'dialer.example.test',
            'x-forwarded-proto': 'https',
            'x-twilio-signature': 'signature',
          },
          body: rawBody,
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(dependencies.verifyTwilioSignature).toHaveBeenCalledWith({
      contentType: 'application/x-www-form-urlencoded',
      params: {
        CallSid: 'CA_TRANSFER',
        CallStatus: 'answered',
        workspaceId: 'attacker',
      },
      rawBody,
      signature: 'signature',
      url:
        'https://dialer.example.test/webhooks/twilio/transfer-status?transfer_id=transfer-one',
    });
    expect(processStatusCallback).toHaveBeenCalledWith({
      transferId: 'transfer-one',
      callSid: 'CA_TRANSFER',
      callStatus: 'answered',
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
    expect(
      dependencies.application.generateTwilioAgentTwiml,
    ).toHaveBeenCalledWith({
      sessionId: 'group-1',
      clientIdentity: 'user_user-1',
    });
  });

  it('rejects invalid signatures without invoking application behavior', async () => {
    const dependencies = createDependencies();
    dependencies.verifyTwilioSignature = mock(async () => false);
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

  it('requires a valid provider signature before a Media Stream upgrade', async () => {
    const dependencies = createDependencies();
    dependencies.verifyTwilioSignature = mock(async () => false);
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/media', {
        headers: {
          connection: 'upgrade',
          upgrade: 'websocket',
          'x-twilio-signature': 'bad',
        },
      }),
    );
    expect(response.status).toBe(401);
    expect(dependencies.verifyTwilioSignature).toHaveBeenCalledWith({
      contentType: '',
      params: {},
      rawBody: '',
      signature: 'bad',
      url: 'https://dialer.test/webhooks/twilio/media',
    });
  });
});
