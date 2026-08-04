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
    expect(html).toContain('Operator workspace');
    expect(html).toContain('data-field="search"');
    expect(html).toContain('Test Contact');
    expect(html).toContain('data-action="select-contact"');
    expect(html).toContain('Test Opportunity');
    expect(html).toContain('data-action="select-opportunity"');
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
      '<span>Contacts available</span><strong>73</strong>',
    );
    expect(html).toContain(
      '<span>Opportunities available</span><strong>144</strong>',
    );
  });

  it('renders callable contacts and opportunities in a ready overlay', () => {
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
            pipelineId: null,
            stageId: null,
            status: 'open',
            monetaryValue: null,
          },
        ],
        opportunityTotal: 1,
        pipelines: [],
      },
    );

    const html = renderLeadConnectorEmbed(state, { surface: 'overlay' });
    expect(html).toContain('Choose someone to call');
    expect(html).toContain('data-field="search"');
    expect(html).toContain('Test Contact');
    expect(html).toContain('data-action="select-contact"');
    expect(html).toContain('Test Opportunity');
    expect(html).toContain('data-action="select-opportunity"');
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
