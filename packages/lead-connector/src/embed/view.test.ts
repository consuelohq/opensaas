import { describe, expect, it } from 'bun:test';

import {
  createInitialEmbedState,
  reduceEmbedState,
  selectEmbedTarget,
  type LeadConnectorEmbedState,
} from './state-machine';
import { resolveLeadConnectorSurface } from './surface';
import { renderLeadConnectorEmbed } from './view';

const selectedState = (): LeadConnectorEmbedState =>
  selectEmbedTarget(createInitialEmbedState(), {
    phone: '+15550100123',
    contactId: 'contact-1',
    name: 'Test Contact',
    opportunityId: 'opportunity-1',
    dedupeKey: 'contact-1:+15550100123',
  });

const connectedState = (): LeadConnectorEmbedState =>
  reduceEmbedState(selectedState(), {
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
        {
          callSid: 'call-3',
          customerNumber: '+15550100125',
          position: 2,
          status: 'completed',
          amdResult: 'machine_start',
          contactId: 'contact-3',
        },
      ],
    },
  });

describe('LeadConnector embed view', () => {
  it('prioritizes active calls and date-grouped history as one card per dialer session', () => {
    const state = {
      ...createInitialEmbedState(),
      activeCalls: [
        {
          id: 'active-session-1',
          representative: 'Ada Rep',
          contactName: 'Test Contact',
          status: 'connected',
          elapsedSeconds: 42,
          activeLineCount: 1,
          transcriptStatus: 'processing',
          calls: [{ providerCallId: 'CA-active', role: 'winner' }],
        },
      ],
      callHistory: [
        {
          id: 'history-session-1',
          representative: 'Ada Rep',
          contactName: 'Test Contact',
          status: 'completed',
          startedAt: '2026-08-04T12:00:00.000Z',
          durationSeconds: 120,
          requestedFanout: 3,
          actualFanout: 3,
          disposition: 'connected',
          transcriptStatus: 'ready',
          opportunity: { status: 'open', monetaryValue: 1250 },
          calls: [
            { providerCallId: 'CA-1', role: 'winner' },
            { providerCallId: 'CA-2', role: 'loser' },
            { providerCallId: 'CA-3', role: 'loser' },
          ],
        },
      ],
      selectedCallDetail: null,
      selectedCallTranscript: [],
    } as LeadConnectorEmbedState;
    const html = renderLeadConnectorEmbed(state, { surface: 'admin' });

    expect(html.indexOf('Active calls')).toBeGreaterThan(-1);
    expect(html.indexOf('Call history')).toBeGreaterThan(
      html.indexOf('Active calls'),
    );
    expect(html).toContain('data-call-session="active-session-1"');
    expect(html).toContain('data-call-session="history-session-1"');
    expect(html.match(/data-call-session="history-session-1"/g)).toHaveLength(
      1,
    );
    expect(html).toContain('3 attempts');
    expect(html).toContain('Transcript processing');
    expect(html).toContain('Transcript ready');
    expect(html).not.toContain('data-action="transfer"');
  });

  it('keeps transcript and coaching panels out of the compact operator overlay', () => {
    const html = renderLeadConnectorEmbed(connectedState(), {
      surface: 'overlay',
    });
    expect(html).not.toContain('Call transcript');
    expect(html).not.toContain('Coaching');
    expect(html).not.toContain('data-action="transfer"');
  });

  it('renders transcript, disposition, opportunity snapshots, and child attempts in call detail', () => {
    const detail: LeadConnectorEmbedState['selectedCallDetail'] = {
      id: 'history-session-1',
      status: 'completed',
      disposition: 'connected',
      note: 'Follow up',
      tags: ['called'],
      crmSyncStatus: 'synced',
      transcriptStatus: 'ready',
      opportunity: { status: 'open', monetaryValue: 1250 },
      currentOpportunity: { status: 'won', monetaryValue: 1500 },
      calls: [
        {
          providerCallId: 'CA-1',
          role: 'winner',
          status: 'completed',
          durationSeconds: 120,
        },
      ],
      transferEvents: [
        {
          id: 'transfer-1',
          type: 'warm_transfer_requested',
          createdAt: '2026-08-04T16:16:42.000Z',
          metadata: { providerPayload: 'must remain hidden' },
        },
      ],
    };
    const state = {
      ...createInitialEmbedState(),
      selectedCallDetail: detail,
      selectedCallTranscript: [
        {
          id: 'segment-1',
          sequence: 1,
          track: 'inbound',
          speaker: 'inbound',
          text: 'Hello there',
          startMs: 0,
          endMs: 500,
        },
      ],
    } as LeadConnectorEmbedState;
    const html = renderLeadConnectorEmbed(state, { surface: 'admin' });
    expect(html).toContain('Call transcript');
    expect(html).toContain('Hello there');
    expect(html).toContain('connected');
    expect(html).toContain('Original opportunity');
    expect(html).toContain('Current opportunity');
    expect(html).toContain('Provider attempts');
    expect(html).toContain('Transfer events');
    expect(html).toContain('Warm transfer requested');
    expect(html).toContain('2026-08-04 16:16 UTC');
    expect(html).not.toContain('providerPayload');
    expect(html).not.toContain('must remain hidden');
    expect(html).not.toContain('data-action="transfer"');
  });

  it('resolves root and admin to administration while reserving overlay paths for calling', () => {
    expect(resolveLeadConnectorSurface('/')).toBe('admin');
    expect(resolveLeadConnectorSurface('/admin')).toBe('admin');
    expect(resolveLeadConnectorSurface('/admin/diagnostics')).toBe('admin');
    expect(resolveLeadConnectorSurface('/overlay')).toBe('overlay');
    expect(resolveLeadConnectorSurface('/overlay/session')).toBe('overlay');
  });
  it('renders the sidebar route as an operator workspace with callable CRM records', () => {
    const state = reduceEmbedState(
      reduceEmbedState(createInitialEmbedState(), {
        type: 'AUTHENTICATED',
        token: 'embed-token',
        expiresAt: '2026-08-03T23:30:00.000Z',
      }),
      {
        type: 'RESOURCES_LOADED',
        contacts: [
          {
            id: 'contact-1',
            firstName: 'Test',
            lastName: 'Contact',
            name: 'Test Contact',
            email: 'test@example.test',
            phone: '+15550100123',
            tags: ['follow-up'],
          },
        ],
        contactTotal: 73,
        opportunities: [
          {
            id: 'opportunity-1',
            name: 'Test Opportunity',
            contactId: 'contact-1',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            status: 'open',
            monetaryValue: 1250,
          },
        ],
        opportunityTotal: 144,
        pipelines: [
          {
            id: 'pipeline-1',
            name: 'Marketing Pipeline',
            stages: [{ id: 'stage-1', name: 'New Lead', position: 0 }],
          },
        ],
      },
    );
    const html = renderLeadConnectorEmbed(state, { surface: 'admin' });

    expect(html).toContain('data-surface="admin"');
    expect(html).toContain('Who do you want to call?');
    expect(html).toContain('Choose list');
    expect(html).toContain('Single dial');
    expect(html).toContain('Marketing Pipeline');
    expect(html).toContain('New Lead');
    expect(html).toContain('Active calls');
    expect(html).toContain('Call history');
    expect(html).toContain('Connection and browser checks');
    expect(html).not.toContain('will appear here');
    expect(html).not.toContain('will be added');
  });

  it('renders API-reported resource totals instead of capped loaded-array lengths', () => {
    const state = reduceEmbedState(createInitialEmbedState(), {
      type: 'RESOURCES_LOADED',
      contacts: [],
      contactTotal: 73,
      opportunities: [],
      opportunityTotal: 144,
      pipelines: [],
    });
    const html = renderLeadConnectorEmbed(state, { surface: 'admin' });

    expect(html).toContain(
      '<div><dt>Contacts</dt><dd>73</dd></div>',
    );
    expect(html).toContain(
      '<div><dt>Opportunities</dt><dd>144</dd></div>',
    );
  });

  it('renders the mature queue-first call setup in a ready overlay', () => {
    const state = reduceEmbedState(
      reduceEmbedState(createInitialEmbedState(), {
        type: 'AUTHENTICATED',
        token: 'embed-token',
        expiresAt: '2026-08-03T23:30:00.000Z',
      }),
      {
        type: 'RESOURCES_LOADED',
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
        contactTotal: 1,
        opportunities: [
          {
            id: 'opportunity-1',
            name: 'Test Opportunity',
            contactId: 'contact-1',
            pipelineId: 'pipeline-1',
            stageId: 'stage-1',
            status: 'open',
            monetaryValue: null,
          },
        ],
        opportunityTotal: 1,
        pipelines: [
          {
            id: 'pipeline-1',
            name: 'Marketing Pipeline',
            stages: [
              { id: 'stage-1', name: 'New Lead', position: 0 },
              { id: 'stage-2', name: 'Hot Lead', position: 1 },
            ],
          },
        ],
      },
    );

    const html = renderLeadConnectorEmbed(state, { surface: 'overlay' });
    expect(html).toContain('Who do you want to call?');
    expect(html).toContain('Choose a list or dial a single number.');
    expect(html).toContain('data-action="setup-queue"');
    expect(html).toContain('data-action="setup-single"');
    expect(html).toContain('Choose list');
    expect(html).toContain('Single dial');
    expect(html).toContain('Marketing Pipeline');
    expect(html).toContain('New Lead');
    expect(html).toContain('Hot Lead');
    expect(html).toContain('Prefer local presence calling');
    expect(html).toContain('Predictive Dialer (recommended)');
    expect(html).toContain('Single (one call at a time)');
    expect(html).toContain('Number of lines');
    expect(html).not.toContain('Choose someone to call');
    expect(html).not.toContain('<h3>Deals</h3>');
    expect(html).not.toContain('AI coaching');
  });

  it('renders only target confirmation and next actions before a call starts', () => {
    const html = renderLeadConnectorEmbed(selectedState(), {
      surface: 'overlay',
    });
    expect(html).toContain('data-surface="overlay"');
    expect(html).toContain('Test Contact');
    expect(html).toContain('data-action="start-single"');
    expect(html).not.toContain('data-action="start-parallel"');
    expect(html).not.toContain('Contacts and opportunities');
    expect(html).not.toContain('data-form="disposition"');
    expect(html).not.toContain('Pause queue');
  });

  it('offers multiline dialing only after multiple targets are selected', () => {
    const state = selectEmbedTarget(selectedState(), {
      phone: '+15550100124',
      contactId: 'contact-2',
      name: 'Second Contact',
      opportunityId: 'opportunity-2',
      dedupeKey: 'contact-2:+15550100124',
    });
    const html = renderLeadConnectorEmbed(state, { surface: 'overlay' });
    expect(html).toContain('2 people selected');
    expect(html).toContain('data-action="start-parallel"');
    expect(html).not.toContain('data-action="start-single"');
  });

  it('renders a progressive starting state without future connected or wrap-up controls', () => {
    const state = reduceEmbedState(selectedState(), {
      type: 'START_REQUESTED',
      strategy: 'predictive',
    });
    const html = renderLeadConnectorEmbed(state, { surface: 'overlay' });
    expect(html).toContain('Preparing');
    expect(html).toContain('data-action="stop"');
    expect(html).not.toContain('data-action="start-single"');
    expect(html).not.toContain('data-action="hang-up"');
    expect(html).not.toContain('data-form="disposition"');
  });

  it('focuses the human winner and summarizes losing legs while connected', () => {
    const html = renderLeadConnectorEmbed(connectedState(), {
      surface: 'overlay',
    });
    expect(html).toContain('Connected');
    expect(html).toContain('Winner');
    expect(html).toContain('2 other lines ended');
    expect(html).toContain('data-action="hang-up"');
    expect(html).not.toContain('data-action="start-single"');
    expect(html).not.toContain('data-form="disposition"');
  });


  it('returns a no-winner batch to the dialer without requiring a disposition', () => {
    let state = reduceEmbedState(createInitialEmbedState(), {
      type: 'AUTHENTICATED',
      token: 'embed-token',
      expiresAt: '2026-08-05T00:00:00.000Z',
    });
    state = reduceEmbedState(state, {
      type: 'QUEUE_SELECTED',
      queue: {
        pipelineId: 'pipeline-1',
        pipelineName: 'Marketing Pipeline',
        stageId: 'stage-1',
        stageName: 'Hot Lead',
        opportunityTotal: 3,
        callableTotal: 3,
      },
      targets: selectedState().selectedTargets,
    });
    state = reduceEmbedState(state, {
      type: 'SESSION_UPDATED',
      session: {
        groupId: 'group-1',
        status: 'completed',
        winnerSid: null,
        winner: null,
        calls: [
          {
            callSid: 'call-1',
            contactId: 'contact-1',
            customerNumber: '+15550100123',
            status: 'completed',
            position: 1,
          },
        ],
      },
    });

    const html = renderLeadConnectorEmbed(state, { surface: 'overlay' });
    expect(html).toContain('No human answer');
    expect(html).toContain('data-action="return-home"');
    expect(html).not.toContain('data-form="disposition"');
  });

  it('reveals wrap-up only after the call reaches a terminal state', () => {
    const state = reduceEmbedState(connectedState(), {
      type: 'STOP_REQUESTED',
    });
    const html = renderLeadConnectorEmbed(state, { surface: 'overlay' });
    expect(html).toContain('Call complete');
    expect(html).toContain('data-form="disposition"');
    expect(html).toContain('Save and close');
    expect(html).not.toContain('data-action="hang-up"');
  });
});
