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
    dependencies.twilioMasterAccountSid = 'AC' + '1'.repeat(32);
    const recordCallRecordingStatus = mock(() => Effect.void);
    dependencies.callOperations = {
      resolveRecordingCallOwnership: () => Effect.succeed({
        workspaceId: 'workspace-1',
        providerAccountId: 'AC' + '1'.repeat(32),
      }),
      recordCallRecordingStatus,
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const rawBody =
      'CallSid=CA_RECORDING&AccountSid=AC11111111111111111111111111111111&RecordingSid=RE_ONE&RecordingStatus=completed&RecordingDuration=42&RecordingUrl=https%3A%2F%2Fapi.twilio.test%2Frecording&workspaceId=attacker';
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
        AccountSid: 'AC11111111111111111111111111111111',
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
      workspaceId: 'workspace-1',
      providerCallId: 'CA_RECORDING',
      recordingSid: 'RE_ONE',
      recordingStatus: 'completed',
      recordingDurationSeconds: 42,
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
    const rawBody = 'CallSid=CA_TRANSFER&CallStatus=answered&AccountSid=AC11111111111111111111111111111111&workspaceId=attacker';
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
        AccountSid: 'AC11111111111111111111111111111111',
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
      accountSid: 'AC11111111111111111111111111111111',
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

  it('rejects cross-account signed status and customer TwiML callbacks without mutating a different workspace', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const owner = 'AC' + '2'.repeat(32);
    const foreign = 'AC' + '3'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    dependencies.application.resolveTwilioCallContext = mock(() =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        dialerSessionId: 'session-1',
        providerAccountId: owner,
      }),
    );
    const app = createDialerServer(dependencies);
    const send = (path: string, sid: string) =>
      app.fetch(new Request('https://dialer.test/webhooks/twilio/' + path, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          AccountSid: sid,
          CallSid: 'CA_CALL',
          CallStatus: 'ringing',
        }),
      }));
    expect((await send('status', foreign)).status).toBe(401);
    expect(dependencies.application.processTwilioStatus).not.toHaveBeenCalled();
    expect((await send('customer-twiml', foreign)).status).toBe(401);
    expect(dependencies.application.generateTwilioCustomerTwiml).not.toHaveBeenCalled();
    expect((await send('status', owner)).status).toBe(200);
    expect(dependencies.application.processTwilioStatus).toHaveBeenCalledTimes(1);
    expect((await send('customer-twiml', owner)).status).toBe(200);
    expect(dependencies.application.generateTwilioCustomerTwiml).toHaveBeenCalledTimes(1);
  });

  it('fences a signed foreign-account status callback after Redis expiry before history mutation', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const child = 'AC' + '2'.repeat(32);
    const foreign = 'AC' + '3'.repeat(32);
    const callSid = 'CA' + '4'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    dependencies.application.resolveTwilioCallContext = mock(() => Effect.succeed(null));
    const durableOwner = mock(() => Effect.succeed({
      workspaceId: 'owner-workspace', providerAccountId: child,
    }));
    dependencies.callOperations = {
      resolveStatusCallOwnership: durableOwner,
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const app = createDialerServer(dependencies);
    const send = (accountSid: string) => app.fetch(
      new Request('https://dialer.test/webhooks/twilio/status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          AccountSid: accountSid, CallSid: callSid, CallStatus: 'completed',
          workspaceId: 'attacker-controlled',
        }),
      }),
    );
    expect((await send(foreign)).status).toBe(401);
    expect((await send(parent)).status).toBe(401);
    expect(dependencies.application.processTwilioStatus).not.toHaveBeenCalled();
    expect((await send(child)).status).toBe(200);
    expect(dependencies.application.processTwilioStatus).toHaveBeenCalledWith(
      expect.objectContaining({ callSid, ownerWorkspaceId: 'owner-workspace' }),
    );
    expect(durableOwner).toHaveBeenCalledWith({ providerCallId: callSid });
  });

  it('rejects status callbacks with no owner or conflicting durable and live owners', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const child = 'AC' + '2'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    let durable: { workspaceId: string; providerAccountId: string | null } | null = null;
    let live: {workspaceId: string; dialerSessionId: string; providerAccountId: string} | null = null;
    dependencies.application.resolveTwilioCallContext = mock(() => Effect.succeed(live));
    dependencies.callOperations = {
      resolveStatusCallOwnership: mock(() => Effect.succeed(durable)),
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const send = () => createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          AccountSid: child, CallSid: 'CA' + '4'.repeat(32),
          CallStatus: 'completed',
        }),
      }),
    );
    expect((await send()).status).toBe(401);
    durable = { workspaceId: 'workspace-one', providerAccountId: child };
    live = { workspaceId: 'workspace-other', dialerSessionId: 'session-1', providerAccountId: child };
    expect((await send()).status).toBe(401);
    expect(dependencies.application.processTwilioStatus).not.toHaveBeenCalled();
  });

  it('fences customer TwiML callbacks against durable ownership after Redis expiry', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const child = 'AC' + '2'.repeat(32);
    const foreign = 'AC' + '3'.repeat(32);
    const callSid = 'CA' + '4'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    dependencies.application.resolveTwilioCallContext = mock(() => Effect.succeed(null));
    dependencies.callOperations = {
      resolveStatusCallOwnership: mock(() => Effect.succeed({
        workspaceId: 'owner-workspace', providerAccountId: child,
      })),
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const app = createDialerServer(dependencies);
    const send = (accountSid: string) => app.fetch(
      new Request('https://dialer.test/webhooks/twilio/customer-twiml', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture' },
        body: new URLSearchParams({
          AccountSid: accountSid, CallSid: callSid, CallStatus: 'in-progress',
        }),
      }),
    );
    expect((await send(foreign)).status).toBe(401);
    expect(dependencies.application.generateTwilioCustomerTwiml).not.toHaveBeenCalled();
    expect((await send(child)).status).toBe(200);
    expect(dependencies.application.generateTwilioCustomerTwiml).toHaveBeenCalledTimes(1);
  });

  it('treats a persisted null account as the legacy parent after Redis expires', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const child = 'AC' + '2'.repeat(32);
    const callSid = 'CA' + '7'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    dependencies.application.resolveTwilioCallContext = mock(() => Effect.succeed(null));
    const owner = { workspaceId: 'legacy-workspace', providerAccountId: null };
    const writeRecording = mock(() => Effect.void);
    dependencies.callOperations = {
      resolveStatusCallOwnership: mock(() => Effect.succeed(owner)),
      resolveRecordingCallOwnership: mock(() => Effect.succeed(owner)),
      recordCallRecordingStatus: writeRecording,
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const app = createDialerServer(dependencies);
    const send = (path: 'status' | 'recording-status', accountSid: string) =>
      app.fetch(new Request('https://dialer.test/webhooks/twilio/' + path, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          AccountSid: accountSid,
          CallSid: callSid,
          CallStatus: 'completed',
          RecordingSid: 'RE' + '5'.repeat(32),
          RecordingStatus: 'completed',
        }),
      }));
    expect((await send('status', child)).status).toBe(401);
    expect((await send('recording-status', child)).status).toBe(401);
    expect(dependencies.application.processTwilioStatus).not.toHaveBeenCalled();
    expect(writeRecording).not.toHaveBeenCalled();
    expect((await send('status', parent)).status).toBe(200);
    expect((await send('recording-status', parent)).status).toBe(200);
    expect(writeRecording).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'legacy-workspace', providerCallId: callSid,
    }));
  });

  it('rejects cross-account signed recording callbacks before touching call history', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const owner = 'AC' + '2'.repeat(32);
    const foreign = 'AC' + '3'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    dependencies.application.resolveTwilioCallContext = mock(() =>
      Effect.succeed({
        workspaceId: 'workspace-1',
        dialerSessionId: 'session-1',
        providerAccountId: owner,
      }),
    );
    const recordCallRecordingStatus = mock(() => Effect.void);
    dependencies.callOperations = {
      resolveRecordingCallOwnership: () => Effect.succeed({
        workspaceId: 'workspace-1',
        providerAccountId: owner,
      }),
      recordCallRecordingStatus,
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const send = (sid: string) => createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/recording-status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          AccountSid: sid,
          CallSid: 'CA_RECORDING',
          RecordingSid: 'RE_RECORDING',
          RecordingStatus: 'completed',
        }),
      }),
    );
    expect((await send(foreign)).status).toBe(401);
    expect(recordCallRecordingStatus).not.toHaveBeenCalled();
    expect((await send(owner)).status).toBe(200);
    expect(recordCallRecordingStatus).toHaveBeenCalledTimes(1);
  });

  it('fences recording callbacks after Redis expiry using the persisted call owner', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const child = 'AC' + '2'.repeat(32);
    const foreign = 'AC' + '3'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    // Simulate Redis group expiry while the immutable call-leg snapshot remains.
    dependencies.application.resolveTwilioCallContext = mock(() => Effect.succeed(null));
    const record = mock(() => Effect.void);
    const durableOwner = mock(() => Effect.succeed({
      workspaceId: 'workspace-one',
      providerAccountId: child,
    }));
    dependencies.callOperations = {
      recordCallRecordingStatus: record,
      resolveRecordingCallOwnership: durableOwner,
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const app = createDialerServer(dependencies);
    const send = (sid: string, fields?: Record<string, string>) => app.fetch(
      new Request('https://dialer.test/webhooks/twilio/recording-status', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          CallSid: 'CA' + '4'.repeat(32),
          RecordingSid: 'RE' + '5'.repeat(32),
          RecordingStatus: 'completed',
          AccountSid: sid,
          workspaceId: 'forged-workspace',
          ...fields,
        }),
      }),
    );
    expect((await send(foreign)).status).toBe(401);
    expect((await send(parent)).status).toBe(401);
    expect(record).not.toHaveBeenCalled();
    expect((await send(child)).status).toBe(200);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-one',
      providerCallId: 'CA' + '4'.repeat(32),
    }));
    expect(durableOwner).toHaveBeenCalledWith({ providerCallId: 'CA' + '4'.repeat(32) });
  });

  it('fails closed when a signed recording callback has no trustworthy durable or Redis owner', async () => {
    const dependencies = createDependencies();
    dependencies.twilioMasterAccountSid = 'AC' + '1'.repeat(32);
    dependencies.application.resolveTwilioCallContext = mock(() => Effect.succeed(null));
    const record = mock(() => Effect.void);
    dependencies.callOperations = {
      recordCallRecordingStatus: record,
      resolveRecordingCallOwnership: mock(() => Effect.succeed(null)),
    } as unknown as NonNullable<DialerServerDependencies['callOperations']>;
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/recording-status', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture' },
        body: new URLSearchParams({
          AccountSid: 'AC' + '1'.repeat(32),
          CallSid: 'CA' + '4'.repeat(32),
          RecordingSid: 'RE' + '5'.repeat(32),
          RecordingStatus: 'completed',
        }),
      }),
    );
    expect(response.status).toBe(401);
    expect(record).not.toHaveBeenCalled();
  });

  it('passes the authenticated Twilio AccountSid to agent conference TwiML', async () => {
    const dependencies = createDependencies();
    const parent = 'AC' + '1'.repeat(32);
    const child = 'AC' + '2'.repeat(32);
    dependencies.twilioMasterAccountSid = parent;
    const response = await createDialerServer(dependencies).fetch(
      new Request('https://dialer.test/webhooks/twilio/agent-twiml', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-twilio-signature': 'valid-fixture',
        },
        body: new URLSearchParams({
          AccountSid: child,
          From: 'client:user_user-1',
          SessionId: 'group-1',
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(dependencies.application.generateTwilioAgentTwiml).toHaveBeenCalledWith({
      sessionId: 'group-1',
      clientIdentity: 'user_user-1',
      accountSid: child,
      parentAccountSid: parent,
    });
  });

});
