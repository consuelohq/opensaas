import { describe, expect, it, mock } from 'bun:test';

import type { LeadConnectorEmbedApi } from './api-client';
import { EmbedSessionExpiredError } from './api-client';
import { createLeadConnectorEmbedController } from './controller';
import { createInitialEmbedState } from './state-machine';
import { normalizeClickToCallTarget } from './protocol';
import type {
  InboundOperatorApi,
  InboundOperatorSnapshot,
} from './inbound-operator';

const createVoice = () => ({
  prepare: mock(async () => undefined),
  connect: mock(async (_sessionId: string) => undefined),
  acceptIncoming: mock(async () => undefined),
  rejectIncoming: mock(() => undefined),
  disconnect: mock(() => undefined),
});

const createInboundSnapshot = (
  phase: InboundOperatorSnapshot['rep']['capacityPhase'] = 'offering',
): InboundOperatorSnapshot => ({
  serverTime: '2026-09-13T20:00:00.000Z',
  rep: {
    repId: 'user-1',
    ready: true,
    presence: 'online',
    endpoints: [
      {
        endpointId: 'browser',
        kind: 'browser',
        healthy: true,
        label: 'Browser',
      },
      { endpointId: 'phone', kind: 'phone', healthy: true, label: 'Phone' },
    ],
    capacityPhase: phase,
    assignment:
      phase === null
        ? null
        : {
            assignmentId: 'assignment-1',
            requestId: 'request-1',
            generation: 7,
            phase,
            offerExpiresAt: '2026-09-13T20:00:12.000Z',
            endpointId: phase === 'offering' ? null : 'browser',
            externalStarted: phase !== 'offering',
            connectedAt:
              phase === 'connected' ? '2026-09-13T20:00:05.000Z' : null,
            unknownSince: null,
            wrapUpUntil: null,
          },
  },
  offers:
    phase === 'offering'
      ? [
          {
            assignmentId: 'assignment-1',
            requestId: 'request-1',
            generation: 7,
            queueId: 'queue-1',
            queueName: 'Inbound',
            callerLabel: 'Caller',
            waitingSeconds: 3,
            offerExpiresAt: '2026-09-13T20:00:12.000Z',
            ownerRepId: 'user-1',
            eligibleEndpoints: ['browser', 'phone'],
          },
        ]
      : [],
  queue: {
    queueId: 'queue-1',
    queueName: 'Inbound',
    waitingCount: phase === 'offering' ? 1 : 0,
    oldestWaitSeconds: phase === 'offering' ? 3 : 0,
    serviceableCount: 1,
    businessHours: 'open',
    overflow: 'standby',
  },
  configuration: {
    numberLabel: 'Main line',
    maskedNumber: '••• ••• 0100',
    teamName: 'Sales',
    hoursLabel: 'Business hours',
    overflowLabel: 'Voicemail',
  },
});

const createInboundApi = (): InboundOperatorApi => {
  const offering = createInboundSnapshot('offering');
  return {
    setSessionToken: mock(() => undefined),
    getSnapshot: mock(async () => offering),
    setReadiness: mock(async () => offering),
    heartbeat: mock(async () => offering),
    acceptOffer: mock(async () => ({
      accepted: true,
      status: 'accepted' as const,
      snapshot: createInboundSnapshot('connecting'),
    })),
    declineOffer: mock(async () => ({
      accepted: true,
      status: 'declined' as const,
      snapshot: createInboundSnapshot(null),
    })),
    reconnect: mock(async () => createInboundSnapshot('connecting')),
    finishWrapUp: mock(async () => createInboundSnapshot(null)),
    getConfiguration: mock(async () => offering.configuration),
    updateConfiguration: mock(async (configuration) => configuration),
  };
};

const createApi = () =>
  ({
    listCoachingScripts: mock(async () => ({ scripts: [] })),
    saveCoachingScript: mock(async (draft) => ({
      ...draft,
      revision: 1,
      updatedAt: new Date().toISOString(),
      canEdit: true,
    })),
    setSessionToken: mock(() => undefined),
    createEmbedSession: mock(async () => ({
      token: 'embed-token',
      expiresAt: '2026-07-24T02:00:00.000Z',
    })),
    listContacts: mock(async () => ({
      contacts: [
        {
          id: 'contact-1',
          firstName: 'Test',
          lastName: 'Contact',
          name: 'Test Contact',
          email: null,
          phone: '+15550100123',
          tags: [],
        },
      ],
      total: 73,
      nextCursor: null,
    })),
    searchOpportunities: mock(async () => ({
      opportunities: [
        {
          id: 'opportunity-1',
          name: 'Renewal',
          contactId: 'contact-1',
          pipelineId: 'pipeline-1',
          stageId: 'stage-1',
          status: 'open',
          monetaryValue: 100,
        },
      ],
      total: 144,
    })),
    resolveQueueCandidates: mock(async () => ({
      pipelineId: 'pipeline-1',
      pipelineName: 'Sales',
      stageId: 'stage-1',
      stageName: 'Qualified',
      opportunityTotal: 5,
      callableTotal: 5,
      truncated: false,
      candidates: Array.from({ length: 5 }, (_, index) => ({
        opportunityId: `opportunity-${index + 1}`,
        contactId: `contact-${index + 1}`,
        contactName: `Contact ${index + 1}`,
        phone: `+1555010012${index + 3}`,
        status: 'open',
        monetaryValue: null,
      })),
    })),
    listPipelines: mock(async () => [
      {
        id: 'pipeline-1',
        name: 'Sales',
        stages: [{ id: 'stage-1', name: 'Qualified', position: 0 }],
      },
    ]),
    getCommercialCallerContext: mock(async () => ({
      planCode: 'single' as const,
      trial: true,
      callerIds: ['+15550100999'],
      connectedMinutes: 0,
      remainingMinutes: 60,
      lineOptions: [1],
      predictive: false,
      recordings: false,
      transcripts: false,
      canStartCall: true,
      denialCode: null,
      billing: { state: 'trial', graceEndsAt: null },
    })),
    getCommercialDashboard: mock(async () => ({
      workspaceId: 'workspace-1',
      catalog: {
        plans: {
          single: {
            code: 'single',
            priceCents: 3000,
            maxNumbersPerSeat: 1,
            includedMinutes: 1388,
            predictive: false,
            recordings: false,
            transcripts: false,
          },
          standard: {
            code: 'standard',
            priceCents: 5000,
            maxNumbersPerSeat: 2,
            includedMinutes: null,
            predictive: true,
            recordings: true,
            transcripts: false,
          },
          power: {
            code: 'power',
            priceCents: 7500,
            maxNumbersPerSeat: 3,
            includedMinutes: null,
            predictive: true,
            recordings: true,
            transcripts: true,
          },
        },
        trial: {
          includedMinutes: 60,
          maxSeats: 1,
          maxNumbers: 1,
          planCode: 'single',
        },
        additionalNumberPriceCents: 500,
        includedNumbersPerSeat: 1,
        paymentGraceDays: 7,
      },
      subscription: null,
      subscriptionItems: [],
      billingSummary: null,
      billingSummaryError: null,
      seats: [],
      numbers: [],
      usage: {},
    })),
    updateCommercialTeam: mock(async () => ({ updated: true as const })),
    searchCommercialNumbers: mock(async () => ({ numbers: [] })),
    provisionCommercialNumber: mock(async () => ({
      provisioned: true as const,
    })),
    assignCommercialNumber: mock(async () => ({ assigned: true as const })),
    releaseCommercialNumber: mock(async () => ({ released: true as const })),
    createCommercialCheckout: mock(async () => ({
      id: 'cs_checkout_one',
      url: 'https://checkout.stripe.test/session-one',
    })),
    claimCommercialPurchase: mock(async () => ({
      claimed: true,
      workspaceId: 'workspace-1',
      purchaseId: 'purchase-1',
    })),
    createCommercialBillingPortal: mock(async () => ({
      id: 'bps_portal_one',
      url: 'https://billing.stripe.test/session-one',
    })),
    previewCommercialBillingChange: mock(async () => ({
      amountDue: 4200,
      currency: 'usd',
      prorationDate: 1_786_000_000,
    })),
    applyCommercialBillingChange: mock(async () => ({
      updated: true as const,
      pendingWebhook: true as const,
    })),
    initiateCallTransfer: mock(async () => ({
      success: true as const,
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer_one',
      conferenceSid: 'CF_one',
      status: 'initiating' as const,
    })),
    getCallTransferStatus: mock(async () => ({
      success: true as const,
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer_one',
      conferenceSid: 'CF_one',
      status: 'consulting' as const,
    })),
    completeCallTransfer: mock(async () => ({
      success: true as const,
      transferId: 'transfer-one',
      status: 'completed' as const,
    })),
    cancelCallTransfer: mock(async () => ({
      success: true as const,
      transferId: 'transfer-one',
      status: 'cancelled' as const,
    })),
    startCallSession: mock(async () => ({
      sessionId: 'session-1',
      providerGroupId: 'group-1',
      status: 'dialing',
      calls: [],
    })),
    getCallSession: mock(async () => ({
      groupId: 'group-1',
      status: 'connected',
      winnerSid: 'call-1',
      winner: null,
      calls: [
        {
          callSid: 'call-1',
          customerNumber: '+15550100123',
          contactId: 'contact-1',
          position: 0,
          status: 'in-progress',
          amdResult: 'human',
        },
      ],
    })),
    markAgentReady: mock(async () => ({
      groupId: 'group-1',
      status: 'connected',
      remainingCleanup: 0,
    })),
    getVoiceToken: mock(async () => ({
      token: 'voice-token',
      identity: 'user_user-1',
      ttl: 3600,
    })),
    terminateCallSession: mock(async () => ({
      groupId: 'group-1',
      status: 'completed' as const,
    })),
    listActiveCalls: mock(async () => []),
    listCallHistory: mock(async () => ({ calls: [], nextCursor: null })),
    getCallDetail: mock(async (callId: string) => ({
      id: callId,
      status: 'completed',
      calls: [],
    })),
    getCallTranscript: mock(async () => []),
    recordDisposition: mock(async () => ({ recorded: true as const })),
  }) satisfies LeadConnectorEmbedApi;

describe('LeadConnector embed controller', () => {
  it('lets the native settings page observe readiness without registering a competing browser device or renewing its lease', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const restored = createInboundSnapshot(null);
    restored.rep.endpoints = [
      {
        endpointId: 'browser',
        kind: 'browser',
        healthy: true,
        active: true,
        label: 'Browser',
      },
    ];
    inboundOperatorApi.getSnapshot = mock(async () => restored);
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
      surface: 'admin',
      inboundObserver: true,
    });
    await controller.authenticate('opaque-parent-context');
    await controller.heartbeatInbound();
    expect(controller.getState().inboundOperator.rep.ready).toBe(true);
    expect(voice.prepare).not.toHaveBeenCalled();
    expect(voice.rejectIncoming).not.toHaveBeenCalled();
    expect(inboundOperatorApi.setReadiness).not.toHaveBeenCalled();
    expect(inboundOperatorApi.heartbeat).not.toHaveBeenCalled();
  });

  it('ends only an explicitly connected inbound browser leg and keeps capacity owned until carrier facts change', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const connected = createInboundSnapshot('connected');
    connected.rep.endpoints[0]!.active = true;
    inboundOperatorApi.getSnapshot = mock(async () => connected);
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('preview-context');
    await controller.endInboundCall();
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(controller.getState().inboundOperator.rep.assignment?.phase).toBe(
      'connected',
    );
    expect(inboundOperatorApi.setReadiness).not.toHaveBeenCalled();
    expect(inboundOperatorApi.finishWrapUp).not.toHaveBeenCalled();
  });

  it('does not replace a live call with a settings permission failure', async () => {
    const api = createApi();
    api.getCommercialDashboard = mock(async () => {
      throw new Error('Administrator access required');
    });
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
      initialState: {
        ...createInitialEmbedState(),
        phase: 'connected',
        sessionToken: 'preview-session',
      },
    });
    expect(await controller.loadAdministration()).toBe(
      'Administrator access required',
    );
    expect(controller.getState().phase).toBe('connected');
  });
  it('re-registers a restored ready browser endpoint before claiming readiness', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const restored = createInboundSnapshot(null);
    restored.rep.endpoints = [
      {
        endpointId: 'browser',
        kind: 'browser',
        healthy: true,
        active: true,
        label: 'Browser',
      },
    ];
    inboundOperatorApi.getSnapshot = mock(async () => restored);
    let registered = false;
    voice.prepare = mock(async () => {
      registered = true;
    });
    inboundOperatorApi.heartbeat = mock(async () => {
      expect(registered).toBe(true);
      return restored;
    });
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    const projected: boolean[] = [];
    controller.subscribe((state) => {
      if (state.inboundOperator.rep.ready) projected.push(registered);
    });
    await controller.authenticate('opaque-parent-ciphertext');
    expect(voice.prepare).toHaveBeenCalledTimes(1);
    expect(projected.length).toBeGreaterThan(0);
    expect(projected.every(Boolean)).toBe(true);
    await controller.loadInboundOperator();
    expect(voice.prepare).toHaveBeenCalledTimes(1);
    await controller.heartbeatInbound();
    expect(inboundOperatorApi.heartbeat).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a previously ready browser cannot be restored after reload', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const restored = createInboundSnapshot(null);
    restored.rep.endpoints = [
      {
        endpointId: 'browser',
        kind: 'browser',
        healthy: true,
        active: true,
        label: 'Browser',
      },
    ];
    inboundOperatorApi.getSnapshot = mock(async () => restored);
    inboundOperatorApi.setReadiness = mock(async (value) => {
      expect(value).toEqual({ ready: false, endpoints: [] });
      return {
        ...restored,
        rep: {
          ...restored.rep,
          ready: false,
          presence: 'away' as const,
          endpoints: [{ ...restored.rep.endpoints[0]!, active: false }],
        },
      };
    });
    voice.prepare = mock(async () => {
      throw new Error('Device registration failed');
    });
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');
    expect(inboundOperatorApi.setReadiness).toHaveBeenCalledTimes(1);
    expect(controller.getState().inboundOperator.rep.ready).toBe(false);
    await controller.heartbeatInbound();
    expect(inboundOperatorApi.heartbeat).not.toHaveBeenCalled();
  });

  it('prepares browser media before advertising browser readiness and fails closed when preparation is denied', async () => {
    const api = createApi();
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    let prepared = false;
    voice.prepare = mock(async () => {
      prepared = true;
    });
    inboundOperatorApi.setReadiness = mock(async () => {
      expect(prepared).toBe(true);
      return createInboundSnapshot('offering');
    });
    const controller = createLeadConnectorEmbedController({
      api,
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');

    await controller.setInboundReadiness({
      ready: true,
      endpoints: [{ endpointId: 'browser', kind: 'browser' }],
    });
    expect(voice.prepare).toHaveBeenCalledTimes(1);
    expect(inboundOperatorApi.setReadiness).toHaveBeenCalledTimes(1);

    voice.prepare = mock(async () => {
      throw new Error('Microphone permission denied');
    });
    inboundOperatorApi.setReadiness = mock(async () =>
      createInboundSnapshot('offering'),
    );
    await controller.setInboundReadiness({
      ready: true,
      endpoints: [{ endpointId: 'browser', kind: 'browser' }],
    });
    expect(inboundOperatorApi.setReadiness).not.toHaveBeenCalled();
    expect(controller.getState().inboundOperator.error).toMatchObject({
      code: 'INBOUND_READINESS_FAILED',
      recoverable: true,
    });
  });

  it('accepts the ringing browser leg only after RD5 wins the fenced offer and keeps connected truth server-owned', async () => {
    const inboundOperatorApi = createInboundApi();
    let authorityAccepted = false;
    inboundOperatorApi.acceptOffer = mock(async () => {
      authorityAccepted = true;
      return {
        accepted: true,
        status: 'accepted' as const,
        snapshot: createInboundSnapshot('connecting'),
      };
    });
    const voice = createVoice();
    voice.acceptIncoming = mock(async () => {
      expect(authorityAccepted).toBe(true);
    });
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');

    await controller.acceptInboundOffer({
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'browser',
    });

    expect(voice.acceptIncoming).toHaveBeenCalledTimes(1);
    expect(controller.getState().inboundOperator.rep.assignment?.phase).toBe(
      'connecting',
    );
    expect(
      controller.getState().inboundOperator.rep.assignment?.phase,
    ).not.toBe('connected');
  });

  it('reuses one acceptance attempt id when the first response is lost', async () => {
    const inboundOperatorApi = createInboundApi();
    const attempts: string[] = [];
    let calls = 0;
    inboundOperatorApi.acceptOffer = mock(async (input) => {
      attempts.push(input.attemptId);
      calls++;
      if (calls === 1) throw new Error('response lost after accept commit');
      return {
        accepted: true,
        status: 'accepted' as const,
        snapshot: createInboundSnapshot('connecting'),
      };
    });
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice: createVoice(),
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');
    const input = {
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'browser',
    };
    await controller.acceptInboundOffer(input);
    await controller.acceptInboundOffer(input);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toBe(attempts[0]);
  });

  it('rejects the local ringing browser leg when RD5 rejects a stale offer', async () => {
    const inboundOperatorApi = createInboundApi();
    inboundOperatorApi.acceptOffer = mock(async () => ({
      accepted: false,
      status: 'stale' as const,
      message: 'Offer expired',
    }));
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');

    await controller.acceptInboundOffer({
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'browser',
    });

    expect(voice.acceptIncoming).not.toHaveBeenCalled();
    expect(voice.rejectIncoming).toHaveBeenCalledTimes(1);
    expect(controller.getState().inboundOperator.error?.code).toBe(
      'STALE_ASSIGNMENT',
    );
  });

  it('does not touch browser media when the winning inbound endpoint is a phone', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');

    await controller.acceptInboundOffer({
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'phone',
    });

    expect(voice.acceptIncoming).not.toHaveBeenCalled();
    expect(voice.rejectIncoming).not.toHaveBeenCalled();
  });

  it('keeps RD5 connecting truth and enters recovery when browser media acceptance fails', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    voice.acceptIncoming = mock(async () => {
      throw new Error('Browser device failed');
    });
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');

    await controller.acceptInboundOffer({
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'browser',
    });

    expect(controller.getState().inboundOperator).toMatchObject({
      phase: 'reconnecting',
      rep: { assignment: { phase: 'connecting' } },
      error: { code: 'INBOUND_BROWSER_MEDIA_FAILED', recoverable: true },
    });
  });

  it('keeps a pending browser invite alive while an RD5 poll reports the same browser assignment connecting', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');
    voice.rejectIncoming.mockClear();
    inboundOperatorApi.getSnapshot = mock(async () =>
      createInboundSnapshot('connecting'),
    );

    await controller.loadInboundOperator();

    expect(voice.rejectIncoming).not.toHaveBeenCalled();
    expect(controller.getState().inboundOperator.rep.assignment?.phase).toBe(
      'connecting',
    );
  });

  it('rejects a ringing browser invite when a refreshed RD5 snapshot shows the offer expired', async () => {
    const inboundOperatorApi = createInboundApi();
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');
    voice.rejectIncoming.mockClear();
    inboundOperatorApi.getSnapshot = mock(async () =>
      createInboundSnapshot(null),
    );

    await controller.loadInboundOperator();

    expect(voice.rejectIncoming).toHaveBeenCalledTimes(1);
    expect(controller.getState().inboundOperator.offers).toHaveLength(0);
  });

  it('takes connected state only from the RD5 reconnect snapshot', async () => {
    const inboundOperatorApi = createInboundApi();
    inboundOperatorApi.reconnect = mock(async () =>
      createInboundSnapshot('connected'),
    );
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice,
      inboundOperatorApi,
    });
    await controller.authenticate('opaque-parent-ciphertext');

    await controller.reconnectInbound();

    expect(controller.getState().inboundOperator.rep.assignment?.phase).toBe(
      'connected',
    );
  });

  it('projects a recoverable parent authentication failure instead of remaining in booting', () => {
    const controller = createLeadConnectorEmbedController({
      api: createApi(),
      voice: createVoice(),
    });
    controller.fail({
      code: 'EMBED_PARENT_UNAVAILABLE',
      message: 'Open the dialer from the LeadConnector custom menu.',
      recoverable: true,
    });
    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      error: {
        code: 'EMBED_PARENT_UNAVAILABLE',
        recoverable: true,
      },
    });
  });

  it('authenticates, loads resources, starts a backend-authoritative call, terminates, and writes disposition', async () => {
    const api = createApi();
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({ api, voice });
    await controller.authenticate('opaque-parent-ciphertext');
    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      sessionToken: 'embed-token',
      contacts: [{ id: 'contact-1' }],
      contactTotal: 73,
      opportunities: [{ id: 'opportunity-1' }],
      opportunityTotal: 144,
      pipelines: [{ id: 'pipeline-1' }],
    });
    const target = normalizeClickToCallTarget({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
      opportunityId: 'opportunity-1',
    });
    expect(target).not.toBeNull();
    controller.selectTarget(target!);
    await controller.startCall('single');
    expect(voice.prepare).toHaveBeenCalledTimes(1);
    expect(voice.connect).toHaveBeenCalledWith('group-1');
    expect(api.markAgentReady).toHaveBeenCalledWith('group-1');
    expect(voice.prepare.mock.invocationCallOrder[0]).toBeLessThan(
      api.startCallSession.mock.invocationCallOrder[0],
    );
    expect(api.startCallSession.mock.invocationCallOrder[0]).toBeLessThan(
      voice.connect.mock.invocationCallOrder[0],
    );
    expect(voice.connect.mock.invocationCallOrder[0]).toBeLessThan(
      api.markAgentReady.mock.invocationCallOrder[0],
    );
    expect(api.startCallSession).toHaveBeenCalledWith({
      source: 'direct',
      selectionStrategy: 'single',
      requestedFanout: 1,
      preferLocalPresence: true,
      targetPhone: '+15550100123',
      contactId: 'contact-1',
      contactName: 'Test Contact',
      opportunityId: 'opportunity-1',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
      opportunitySnapshot: {
        id: 'opportunity-1',
        status: 'open',
        monetaryValue: 100,
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
      },
    });
    expect(api.getCallSession).toHaveBeenCalledWith('group-1');
    expect(controller.getState()).toMatchObject({
      phase: 'connected',
      activeSessionId: 'group-1',
      callLegs: [{ role: 'winner' }],
    });
    await controller.hangUp();
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(api.terminateCallSession).toHaveBeenCalledWith('group-1');
    expect(controller.getState().phase).toBe('wrapping-up');
    await controller.submitDisposition({
      disposition: 'connected',
      note: 'Follow up',
      tags: ['called'],
    });
    expect(api.recordDisposition).toHaveBeenCalledWith({
      sessionId: 'session-1',
      contactId: 'contact-1',
      disposition: 'connected',
      note: 'Follow up',
      tags: ['called'],
    });
    expect(controller.getState().phase).toBe('ready');
  });

  it('disconnects the browser agent exactly once when a refreshed session becomes terminal', async () => {
    let statusReads = 0;
    const api: LeadConnectorEmbedApi = {
      ...createApi(),
      getCallSession: mock(async () => {
        statusReads += 1;
        if (statusReads === 1) {
          return {
            groupId: 'group-1',
            status: 'connected',
            winnerSid: 'call-1',
            winner: null,
            calls: [
              {
                callSid: 'call-1',
                customerNumber: '+15550100123',
                contactId: 'contact-1',
                position: 0,
                status: 'in-progress',
                amdResult: 'human',
              },
            ],
          };
        }
        return {
          groupId: 'group-1',
          status: 'completed',
          winnerSid: null,
          winner: null,
          calls: [
            {
              callSid: 'call-1',
              customerNumber: '+15550100123',
              contactId: 'contact-1',
              position: 0,
              status: 'completed',
              amdResult: 'machine',
            },
          ],
        };
      }),
    };
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({ api, voice });
    await controller.authenticate('opaque-parent-ciphertext');
    const target = normalizeClickToCallTarget({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
    });
    controller.selectTarget(target!);
    await controller.startCall('single');
    expect(voice.disconnect).not.toHaveBeenCalled();

    await controller.refreshSession();
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      phase: 'wrapping-up',
      activeSessionId: 'group-1',
      callSession: { status: 'completed', winnerSid: null },
    });

    await controller.refreshSession();
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
  });

  it('terminates customer fanout when the browser agent cannot join', async () => {
    const api = createApi();
    const voice = createVoice();
    voice.connect = mock(async () => {
      throw new Error('Agent media connection failed');
    });
    const controller = createLeadConnectorEmbedController({ api, voice });
    await controller.authenticate('opaque-parent-ciphertext');
    const target = normalizeClickToCallTarget({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
    });
    controller.selectTarget(target!);

    await controller.startCall('single');

    expect(api.terminateCallSession).toHaveBeenCalledWith('group-1');
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      error: { message: 'Agent media connection failed' },
    });
  });

  it('terminates customer fanout when conference reconciliation remains unresolved', async () => {
    const api = createApi();
    api.markAgentReady = mock(async () => ({
      groupId: 'group-1',
      status: 'connected',
      remainingCleanup: 1,
    }));
    const voice = createVoice();
    const controller = createLeadConnectorEmbedController({ api, voice });
    await controller.authenticate('opaque-parent-ciphertext');
    const target = normalizeClickToCallTarget({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
    });
    controller.selectTarget(target!);

    await controller.startCall('single');

    expect(api.terminateCallSession).toHaveBeenCalledWith('group-1');
    expect(voice.disconnect).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({
      phase: 'failed',
      error: { message: 'Agent conference did not become ready' },
    });
  });

  it('searches resources with pipeline and stage filters and supports queue pause and resume', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });
    await controller.authenticate('opaque-parent-ciphertext');
    await controller.searchContacts('Test');
    await controller.searchOpportunities({
      query: 'Renewal',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
    });
    expect(api.listContacts).toHaveBeenLastCalledWith({
      query: 'Test',
      limit: 50,
    });
    expect(api.searchOpportunities).toHaveBeenLastCalledWith({
      query: 'Renewal',
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
      limit: 100,
    });
    controller.pause();
    expect(controller.getState().phase).toBe('paused');
    controller.resume();
    expect(controller.getState().phase).toBe('ready');
  });

  it('starts multiline calls through the queue predictive contract', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });
    await controller.authenticate('opaque-parent-ciphertext');
    for (const [index, phone] of ['+15550100123', '+15550100124'].entries()) {
      const target = normalizeClickToCallTarget({
        phone,
        contactId: `contact-${index + 1}`,
        name: `Contact ${index + 1}`,
      });
      expect(target).not.toBeNull();
      controller.selectTarget(target!);
    }
    await controller.startCall('predictive');
    expect(api.startCallSession).toHaveBeenCalledWith({
      source: 'queue',
      selectionStrategy: 'predictive',
      requestedFanout: 2,
      preferLocalPresence: true,
      targetPhones: ['+15550100123', '+15550100124'],
      contactIds: ['contact-1', 'contact-2'],
    });
  });

  it('starts a selected GHL stage as one predictive queue with fanout independent from candidate count', async () => {
    const api = createApi();
    const starter = await api.getCommercialCallerContext();
    api.getCommercialCallerContext = mock(async () => ({
      ...starter,
      predictive: true,
      trial: false,
      lineOptions: [1, 2, 3],
    }));
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });
    await controller.authenticate('opaque-parent-ciphertext');
    await controller.selectQueue({
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
    });
    controller.updateSetup({
      callingMode: 'predictive',
      requestedFanout: 3,
      preferLocalPresence: true,
    });

    await controller.startConfiguredCall();

    expect(api.resolveQueueCandidates).toHaveBeenCalledWith({
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
    });
    expect(controller.getState()).toMatchObject({
      selectedQueue: {
        pipelineName: 'Sales',
        stageName: 'Qualified',
        opportunityTotal: 5,
        callableTotal: 5,
      },
      setup: { requestedFanout: 3, preferLocalPresence: true },
    });
    expect(api.startCallSession).toHaveBeenCalledWith({
      source: 'queue',
      queueId: 'pipeline-1:stage-1',
      selectionStrategy: 'predictive',
      requestedFanout: 3,
      preferLocalPresence: true,
      targetPhones: [
        '+15550100123',
        '+15550100124',
        '+15550100125',
        '+15550100126',
        '+15550100127',
      ],
      contactIds: [
        'contact-1',
        'contact-2',
        'contact-3',
        'contact-4',
        'contact-5',
      ],
      pipelineId: 'pipeline-1',
      stageId: 'stage-1',
    });
  });

  it('loads Marketing Pipeline stages and previews the selected New Lead queue', async () => {
    const api = createApi();
    api.listPipelines = mock(async () => [
      {
        id: 'marketing-pipeline',
        name: 'Marketing Pipeline',
        stages: [{ id: 'new-lead', name: 'New Lead', position: 0 }],
      },
    ]);
    api.resolveQueueCandidates = mock(async () => ({
      pipelineId: 'marketing-pipeline',
      pipelineName: 'Marketing Pipeline',
      stageId: 'new-lead',
      stageName: 'New Lead',
      opportunityTotal: 1,
      callableTotal: 1,
      truncated: false,
      candidates: [
        {
          opportunityId: 'opportunity-new-lead',
          contactId: 'contact-new-lead',
          contactName: 'New Lead Contact',
          phone: '+15550100126',
          status: 'open',
          monetaryValue: null,
        },
      ],
    }));
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });

    await controller.authenticate('opaque-parent-ciphertext');
    expect(controller.getState().pipelines).toEqual([
      {
        id: 'marketing-pipeline',
        name: 'Marketing Pipeline',
        stages: [{ id: 'new-lead', name: 'New Lead', position: 0 }],
      },
    ]);

    await controller.selectQueue({
      pipelineId: 'marketing-pipeline',
      stageId: 'new-lead',
    });

    expect(api.resolveQueueCandidates).toHaveBeenCalledWith({
      pipelineId: 'marketing-pipeline',
      stageId: 'new-lead',
    });
    expect(controller.getState()).toMatchObject({
      selectedQueue: {
        pipelineId: 'marketing-pipeline',
        pipelineName: 'Marketing Pipeline',
        stageId: 'new-lead',
        stageName: 'New Lead',
        opportunityTotal: 1,
        callableTotal: 1,
      },
      selectedTargets: [
        {
          contactId: 'contact-new-lead',
          opportunityId: 'opportunity-new-lead',
          phone: '+15550100126',
        },
      ],
    });
  });

  it('coalesces idle background resource refreshes and skips refresh while a call is active', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });
    await controller.authenticate('opaque-parent-ciphertext');
    api.listContacts.mockClear();
    api.searchOpportunities.mockClear();
    api.listPipelines.mockClear();

    let release: (() => void) | undefined;
    api.listContacts = mock(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ contacts: [], total: 0, nextCursor: null });
        }),
    );
    const first = controller.refreshResources();
    const second = controller.refreshResources();
    expect(api.listContacts).toHaveBeenCalledTimes(1);
    release?.();
    await Promise.all([first, second]);

    const connectedController = createLeadConnectorEmbedController({
      api: createApi(),
      voice: createVoice(),
      initialState: {
        ...controller.getState(),
        phase: 'connected',
        activeSessionId: 'group-1',
      },
    });
    const connectedApi = createApi();
    const activeController = createLeadConnectorEmbedController({
      api: connectedApi,
      voice: createVoice(),
      initialState: connectedController.getState(),
    });
    await activeController.refreshResources();
    expect(connectedApi.listContacts).not.toHaveBeenCalled();
    expect(connectedApi.searchOpportunities).not.toHaveBeenCalled();
    expect(connectedApi.listPipelines).not.toHaveBeenCalled();
  });

  it('returns to the configured home after disposition without reauthentication', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });
    await controller.authenticate('opaque-parent-ciphertext');
    const target = normalizeClickToCallTarget({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
    });
    controller.selectTarget(target!);
    await controller.startCall('single');
    await controller.hangUp();
    await controller.submitDisposition({ disposition: 'connected' });

    expect(controller.getState()).toMatchObject({
      phase: 'ready',
      sessionToken: 'embed-token',
      contactTotal: 73,
      opportunityTotal: 144,
      setup: { mode: 'single', requestedFanout: 1 },
      activeSessionId: null,
      callSession: null,
      selectedTargets: [],
    });
    expect(api.createEmbedSession).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed purchase codes and preserves a live call when a claim is denied', async () => {
    const api = createApi();
    api.claimCommercialPurchase = mock(async () => {
      throw new Error('Purchase is not paid yet');
    });
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
      initialState: {
        ...createInitialEmbedState(),
        phase: 'connected',
        sessionToken: 'preview-session',
      },
    });
    expect(await controller.claimPurchase('incomplete')).toContain(
      'complete setup code',
    );
    expect(api.claimCommercialPurchase).not.toHaveBeenCalled();
    expect(
      await controller.claimPurchase(
        'eecbb747-12d8-4f07-9326-ce833ce9499c.' + 'a'.repeat(43),
      ),
    ).toBe('Purchase is not paid yet');
    expect(controller.getState().phase).toBe('connected');
    expect(JSON.stringify(controller.getState())).not.toContain('a'.repeat(43));
  });

  it('claims a website purchase through the authenticated API and refreshes entitlements without retaining the setup secret', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
      surface: 'admin',
    });
    await controller.authenticate('opaque-parent-ciphertext');
    const token = 'a'.repeat(43),
      id = 'eecbb747-12d8-4f07-9326-ce833ce9499c';
    await controller.claimPurchase(id + '.' + token);
    expect(api.claimCommercialPurchase).toHaveBeenCalledWith({
      purchaseId: id,
      claimToken: token,
    });
    expect(api.getCommercialDashboard).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(controller.getState())).not.toContain(token);
  });

  it('opens server-owned billing sessions and drives a real warm transfer lifecycle', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
      surface: 'admin',
    });
    await controller.authenticate('opaque-parent-ciphertext');

    expect(api.createEmbedSession).toHaveBeenCalledWith(
      'opaque-parent-ciphertext',
    );
    expect(api.getCommercialDashboard).toHaveBeenCalledTimes(1);
    expect(controller.getState().commercialDashboard?.workspaceId).toBe(
      'workspace-1',
    );

    expect(
      await controller.createCheckout({
        single: 2,
        standard: 1,
        power: 0,
        additionalNumber: 1,
      }),
    ).toBe('https://checkout.stripe.test/session-one');
    expect(api.createCommercialCheckout).toHaveBeenCalledWith({
      quantities: {
        single: 2,
        standard: 1,
        power: 0,
        additionalNumber: 1,
      },
    });
    expect(await controller.openBillingPortal()).toBe(
      'https://billing.stripe.test/session-one',
    );

    const quantities = {
      single: 2,
      standard: 1,
      power: 0,
      additionalNumber: 1,
    };
    await controller.previewBillingChange(quantities);
    expect(controller.getState().commercialBillingPreview).toEqual({
      quantities,
      amountDue: 4200,
      currency: 'usd',
      prorationDate: 1_786_000_000,
    });
    await controller.applyBillingChange({
      quantities,
      prorationDate: 1_786_000_000,
    });
    expect(api.applyCommercialBillingChange).toHaveBeenCalledWith({
      quantities,
      prorationDate: 1_786_000_000,
    });
    expect(controller.getState().commercialBillingPreview).toBeNull();

    const target = normalizeClickToCallTarget({
      phone: '+15550100123',
      contactId: 'contact-1',
      name: 'Test Contact',
    });
    controller.selectTarget(target!);
    await controller.startCall('single');
    await controller.initiateTransfer({ type: 'warm', to: '+15550100111' });

    expect(api.initiateCallTransfer).toHaveBeenCalledWith('group-1', {
      type: 'warm',
      to: '+15550100111',
    });
    expect(controller.getState().transfer).toEqual({
      status: 'initiating',
      type: 'warm',
      target: '+15550100111',
      transferId: 'transfer-one',
      transferCallSid: 'CA_transfer_one',
      conferenceSid: 'CF_one',
    });
    expect(api.getCallTransferStatus).not.toHaveBeenCalled();

    await controller.refreshSession();
    expect(api.getCallTransferStatus).toHaveBeenCalledWith(
      'group-1',
      'transfer-one',
    );
    expect(controller.getState().transfer.status).toBe('consulting');

    await controller.completeTransfer();
    expect(api.completeCallTransfer).toHaveBeenCalledWith(
      'group-1',
      'transfer-one',
    );
    expect(controller.getState().transfer.status).toBe('completed');

    await controller.initiateTransfer({ type: 'warm', to: '+15550100112' });
    await controller.refreshSession();
    await controller.cancelTransfer();
    expect(api.cancelCallTransfer).toHaveBeenCalledWith(
      'group-1',
      'transfer-one',
    );
    expect(controller.getState().transfer.status).toBe('cancelled');
  });

  it('expires and reauthenticates without retaining the expired browser token', async () => {
    const api = createApi();
    api.listPipelines = mock(async () => {
      throw new EmbedSessionExpiredError();
    });
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
    });
    await controller.authenticate('opaque-parent-ciphertext');
    expect(controller.getState()).toMatchObject({
      phase: 'authenticating',
      sessionToken: null,
      error: { code: 'SESSION_EXPIRED', recoverable: true },
    });
    expect(api.setSessionToken).toHaveBeenLastCalledWith(null);
  });
});

it('renews secure context without resetting a connected call or replaying call creation', async () => {
  const api = createApi(),
    voice = createVoice();
  const state = createInitialEmbedState();
  state.phase = 'connected';
  state.sessionToken = 'old';
  state.activeSessionId = 'active-call';
  const controller = createLeadConnectorEmbedController({
    api,
    voice,
    initialState: state,
  });
  const phases: string[] = [];
  controller.subscribe((s) => phases.push(s.phase));
  await controller.authenticate('fresh-context');
  expect(controller.getState().phase).toBe('connected');
  expect(controller.getState().activeSessionId).toBe('active-call');
  expect(phases).not.toContain('authenticating');
  expect(voice.disconnect).not.toHaveBeenCalled();
});
it('keeps active media state during a renewal failure and requests bounded context recovery', async () => {
  const api = createApi(),
    voice = createVoice(),
    recover = mock(() => undefined);
  api.createEmbedSession = mock(async () => {
    throw new EmbedSessionExpiredError();
  });
  const state = createInitialEmbedState();
  state.phase = 'connected';
  state.sessionToken = 'old';
  state.activeSessionId = 'active-call';
  const controller = createLeadConnectorEmbedController({
    api,
    voice,
    initialState: state,
    onSessionExpired: recover,
  });
  await controller.authenticate('fresh-context');
  expect(controller.getState().phase).toBe('connected');
  expect(controller.getState().activeSessionId).toBe('active-call');
  expect(voice.disconnect).not.toHaveBeenCalled();
  expect(recover).toHaveBeenCalledTimes(1);
});

it('preserves the current token through a transient secure renewal failure', async () => {
  const api = createApi(), voice = createVoice(), recover = mock(() => undefined);
  api.createEmbedSession = mock(async () => { throw new Error('upstream 503'); });
  const state = createInitialEmbedState();
  state.phase = 'connected';
  state.sessionToken = 'still-valid';
  state.activeSessionId = 'connected-call';
  const controller = createLeadConnectorEmbedController({
    api, voice, initialState: state, onSessionExpired: recover,
  });
  await controller.authenticate('fresh-context');
  expect(controller.getState().sessionToken).toBe('still-valid');
  expect(controller.getState().activeSessionId).toBe('connected-call');
  expect(api.setSessionToken).not.toHaveBeenCalledWith(null);
  expect(recover).not.toHaveBeenCalled();
  expect(voice.disconnect).not.toHaveBeenCalled();
});

it('rejects only the pending browser invite when secure session recovery exhausts', () => {
  const api = createApi(), voice = createVoice();
  const state = createInitialEmbedState();
  state.phase = 'connected';
  state.sessionToken = 'current';
  state.activeSessionId = 'connected-call';
  const controller = createLeadConnectorEmbedController({ api, voice, initialState: state });
  controller.onSessionRenewalExhausted();
  expect(voice.rejectIncoming).toHaveBeenCalledTimes(1);
  expect(voice.disconnect).not.toHaveBeenCalled();
  expect(controller.getState().activeSessionId).toBe('connected-call');
});
