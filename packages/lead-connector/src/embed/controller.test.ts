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

const createApi = () => ({
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
  listPipelines: mock(async () => [
    {
      id: 'pipeline-1',
      name: 'Sales',
      stages: [{ id: 'stage-1', name: 'Qualified', position: 0 }],
    },
  ]),
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
  recordDisposition: mock(async () => ({ recorded: true as const })),
} satisfies LeadConnectorEmbedApi);

describe('LeadConnector embed controller', () => {
  it('projects a recoverable parent authentication failure instead of remaining in booting', () => {
    const controller = createLeadConnectorEmbedController({ api: createApi(), voice: createVoice() });
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
      targetPhone: '+15550100123',
      contactId: 'contact-1',
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
      contactId: 'contact-1',
      disposition: 'connected',
      note: 'Follow up',
      tags: ['called'],
    });
    expect(controller.getState().phase).toBe('completed');
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
    const controller = createLeadConnectorEmbedController({ api, voice: createVoice() });
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
    const controller = createLeadConnectorEmbedController({ api, voice: createVoice() });
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
      targetPhones: ['+15550100123', '+15550100124'],
      contactIds: ['contact-1', 'contact-2'],
    });
  });

  it('expires and reauthenticates without retaining the expired browser token', async () => {
    const api = createApi();
    api.listPipelines = mock(async () => {
      throw new EmbedSessionExpiredError();
    });
    const controller = createLeadConnectorEmbedController({ api, voice: createVoice() });
    await controller.authenticate('opaque-parent-ciphertext');
    expect(controller.getState()).toMatchObject({
      phase: 'authenticating',
      sessionToken: null,
      error: { code: 'SESSION_EXPIRED', recoverable: true },
    });
    expect(api.setSessionToken).toHaveBeenLastCalledWith(null);
  });
});
