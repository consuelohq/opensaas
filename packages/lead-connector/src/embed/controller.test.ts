import { describe, expect, it, mock } from 'bun:test';

import type { LeadConnectorEmbedApi } from './api-client';
import { EmbedSessionExpiredError } from './api-client';
import { createLeadConnectorEmbedController } from './controller';
import { normalizeClickToCallTarget } from './protocol';

const createVoice = () => ({
  prepare: mock(async () => undefined),
  connect: mock(async (_sessionId: string) => undefined),
  disconnect: mock(() => undefined),
});

const createApi = () =>
  ({
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
    provisionCommercialNumber: mock(async () => ({ provisioned: true as const })),
    assignCommercialNumber: mock(async () => ({ assigned: true as const })),
    releaseCommercialNumber: mock(async () => ({ released: true as const })),
    createCommercialCheckout: mock(async () => ({
      id: 'cs_checkout_one',
      url: 'https://checkout.stripe.test/session-one',
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
          release = () =>
            resolve({ contacts: [], total: 0, nextCursor: null });
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

  it('opens server-owned billing sessions and drives a real warm transfer lifecycle', async () => {
    const api = createApi();
    const controller = createLeadConnectorEmbedController({
      api,
      voice: createVoice(),
      surface: 'admin',
    });
    await controller.authenticate('opaque-parent-ciphertext');

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
