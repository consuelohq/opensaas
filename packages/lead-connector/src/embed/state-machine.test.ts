import { describe, expect, it } from 'bun:test';

import {
  createInitialEmbedState,
  filterEmbedOpportunities,
  reduceEmbedState,
  selectEmbedTarget,
} from './state-machine';

const target = {
  phone: '+15550100123',
  contactId: 'contact-1',
  name: 'Test Contact',
  opportunityId: 'opportunity-1',
  dedupeKey: 'contact-1:+15550100123',
};

describe('LeadConnector embed state machine', () => {
  it('authenticates, loads resources, selects one deduplicated target, and starts a single call', () => {
    let state = createInitialEmbedState();
    state = reduceEmbedState(state, { type: 'AUTHENTICATION_STARTED' });
    state = reduceEmbedState(state, {
      type: 'AUTHENTICATED',
      token: 'embed-token',
      expiresAt: '2026-07-24T02:00:00.000Z',
    });
    state = reduceEmbedState(state, {
      type: 'RESOURCES_LOADED',
      contacts: [],
      contactTotal: 0,
      opportunities: [],
      opportunityTotal: 0,
      pipelines: [],
    });
    state = selectEmbedTarget(state, target);
    state = selectEmbedTarget(state, target);
    state = reduceEmbedState(state, {
      type: 'START_REQUESTED',
      strategy: 'single',
    });
    expect(state.phase).toBe('starting');
    expect(state.selectedTargets).toHaveLength(1);
    expect(state.selectionStrategy).toBe('single');
  });

  it('projects parallel backend state with exactly one human winner and losing legs', () => {
    let state = selectEmbedTarget(createInitialEmbedState(), target);
    state = selectEmbedTarget(state, {
      ...target,
      phone: '+15550100124',
      contactId: 'contact-2',
      name: 'Second Contact',
      dedupeKey: 'contact-2:+15550100124',
    });
    state = reduceEmbedState(state, {
      type: 'SESSION_UPDATED',
      session: {
        groupId: 'group-1',
        status: 'connected',
        winnerSid: 'call-1',
        winner: null,
        calls: [
          {
            callSid: 'call-1',
            customerNumber: '+15550100123',
            position: 0,
            status: 'in-progress',
            amdResult: 'human',
            contactId: 'contact-1',
          },
          {
            callSid: 'call-2',
            customerNumber: '+15550100124',
            position: 1,
            status: 'completed',
            amdResult: 'human',
            contactId: 'contact-2',
          },
        ],
      },
    });
    expect(state.phase).toBe('connected');
    expect(state.callLegs).toEqual([
      expect.objectContaining({ callSid: 'call-1', role: 'winner' }),
      expect.objectContaining({ callSid: 'call-2', role: 'loser' }),
    ]);
  });

  it('projects a terminal session as wrap-up even when the winner SID remains populated', () => {
    const state = reduceEmbedState(createInitialEmbedState(), {
      type: 'SESSION_UPDATED',
      session: {
        groupId: 'group-1',
        status: 'completed',
        winnerSid: 'call-1',
        winner: null,
        calls: [
          {
            callSid: 'call-1',
            customerNumber: '+15550100123',
            position: 0,
            status: 'completed',
            amdResult: 'human',
            contactId: 'contact-1',
          },
        ],
      },
    });

    expect(state.phase).toBe('wrapping-up');
    expect(state.callLegs).toEqual([
      expect.objectContaining({ callSid: 'call-1', role: 'winner' }),
    ]);
  });

  it('supports pause, resume, stop, wrap-up, completion, recoverable failure, and retry', () => {
    let state = reduceEmbedState(createInitialEmbedState(), { type: 'PAUSED' });
    expect(state.phase).toBe('paused');
    state = reduceEmbedState(state, { type: 'RESUMED' });
    expect(state.phase).toBe('ready');
    state = reduceEmbedState(state, { type: 'STOP_REQUESTED' });
    expect(state.phase).toBe('wrapping-up');
    state = reduceEmbedState(state, { type: 'DISPOSITION_SUBMITTED' });
    expect(state.phase).toBe('ready');
    state = reduceEmbedState(state, {
      type: 'FAILED',
      code: 'NETWORK_ERROR',
      message: 'Try again',
      recoverable: true,
    });
    expect(state.phase).toBe('failed');
    state = reduceEmbedState(state, { type: 'RETRY_REQUESTED' });
    expect(state.phase).toBe('ready');
  });

  it('treats session expiration as recoverable reauthentication without retaining the token', () => {
    let state = reduceEmbedState(createInitialEmbedState(), {
      type: 'AUTHENTICATED',
      token: 'expired-token',
      expiresAt: '2026-07-24T01:00:00.000Z',
    });
    state = reduceEmbedState(state, { type: 'SESSION_EXPIRED' });
    expect(state.phase).toBe('authenticating');
    expect(state.sessionToken).toBeNull();
    expect(state.error).toEqual(
      expect.objectContaining({ code: 'SESSION_EXPIRED', recoverable: true }),
    );
  });

  it('filters opportunities by query, pipeline, and stage', () => {
    const opportunities = [
      {
        id: 'opportunity-1',
        name: 'Renewal plan',
        contactId: 'contact-1',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        status: 'open',
        monetaryValue: 100,
      },
      {
        id: 'opportunity-2',
        name: 'Other plan',
        contactId: 'contact-2',
        pipelineId: 'pipeline-2',
        stageId: 'stage-2',
        status: 'open',
        monetaryValue: 200,
      },
    ];
    expect(
      filterEmbedOpportunities(opportunities, {
        query: 'renewal',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
      }),
    ).toEqual([opportunities[0]]);
  });

  it('soft returns home while preserving authentication, resources, and operator preferences', () => {
    let state = reduceEmbedState(createInitialEmbedState(), {
      type: 'AUTHENTICATED',
      token: 'embed-token',
      expiresAt: '2026-08-04T23:00:00.000Z',
    });
    state = reduceEmbedState(state, {
      type: 'RESOURCES_LOADED',
      contacts: [],
      contactTotal: 7,
      opportunities: [],
      opportunityTotal: 12,
      pipelines: [
        {
          id: 'pipeline-1',
          name: 'Marketing Pipeline',
          stages: [{ id: 'stage-1', name: 'Hot Lead', position: 0 }],
        },
      ],
    });
    state = reduceEmbedState(state, {
      type: 'SETUP_CHANGED',
      setup: {
        mode: 'queue',
        callingMode: 'predictive',
        requestedFanout: 3,
        preferLocalPresence: true,
      },
    });
    state = reduceEmbedState(state, {
      type: 'QUEUE_SELECTED',
      queue: {
        pipelineId: 'pipeline-1',
        pipelineName: 'Marketing Pipeline',
        stageId: 'stage-1',
        stageName: 'Hot Lead',
        opportunityTotal: 12,
        callableTotal: 7,
      },
      targets: [target],
    });
    state = reduceEmbedState(state, {
      type: 'SESSION_UPDATED',
      session: {
        groupId: 'group-1',
        status: 'completed',
        winnerSid: null,
        winner: null,
        calls: [],
      },
    });
    state = reduceEmbedState(state, { type: 'RETURN_HOME' });

    expect(state).toMatchObject({
      phase: 'ready',
      sessionToken: 'embed-token',
      contactTotal: 7,
      opportunityTotal: 12,
      pipelines: [{ id: 'pipeline-1' }],
      setup: {
        mode: 'queue',
        callingMode: 'predictive',
        requestedFanout: 3,
        preferLocalPresence: true,
      },
      selectedQueue: {
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
      },
      activeSessionId: null,
      callSession: null,
      selectedTargets: [target],
    });
  });

  it('direct click-to-call switches the setup to Single dial with one line', () => {
    const state = selectEmbedTarget(createInitialEmbedState(), target);
    expect(state).toMatchObject({
      phase: 'target-selected',
      setup: {
        mode: 'single',
        callingMode: 'single',
        requestedFanout: 1,
      },
    });
  });

  it('appends cursor-paginated history without duplicating sessions', () => {
    const call = { id: 'session-1', status: 'completed', calls: [] };
    let state = reduceEmbedState(createInitialEmbedState(), {
      type: 'CALLS_LOADED',
      activeCalls: [],
      callHistory: [call],
      nextCursor: 'cursor-2',
    });
    state = reduceEmbedState(state, {
      type: 'CALL_HISTORY_APPENDED',
      calls: [call, { id: 'session-2', status: 'completed', calls: [] }],
      nextCursor: null,
    });

    expect(state.callHistory.map((candidate) => candidate.id)).toEqual([
      'session-1',
      'session-2',
    ]);
    expect(state.callHistoryCursor).toBeNull();
  });
});
