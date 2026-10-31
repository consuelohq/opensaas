import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';
import {
  createInitialEmbedState,
  type LeadConnectorEmbedState,
} from './state-machine';
import { renderLeadConnectorEmbed } from './view';

const rep = (): LeadConnectorEmbedState => {
  const state = createInitialEmbedState();
  return {
    ...state,
    phase: 'ready',
    sessionToken: 'test-session',
    commercialCaller: {
      planCode: 'standard',
      trial: true,
      callerIds: ['+15550103891'],
      connectedMinutes: 0,
      remainingMinutes: 100,
      lineOptions: [1],
      predictive: true,
      recordings: false,
      transcripts: false,
      canStartCall: true,
      denialCode: null,
      billing: { state: 'trial', graceEndsAt: null },
    },
    inboundOperator: {
      ...state.inboundOperator,
      phase: 'ready',
      rep: {
        ...state.inboundOperator.rep,
        repId: 'rep-1',
        presence: 'away',
        endpoints: [
          {
            endpointId: 'phone-1',
            kind: 'phone',
            label: 'Your phone',
            healthy: true,
            active: true,
          },
        ],
      },
    },
  };
};
const dom = (html: string) => new JSDOM(html).window.document;

describe('rep-first calling workspace', () => {
  it('opens the sidebar to one simple inbound setup rather than an administration dashboard', () => {
    const html = renderLeadConnectorEmbed(rep(), { surface: 'admin' });
    const doc = dom(html);
    expect(
      doc.querySelector('[data-workspace-screen="calling"]'),
    ).not.toBeNull();
    expect(
      doc.querySelector('[role="tablist"][aria-label="Calling direction"]'),
    ).not.toBeNull();
    expect(
      doc.querySelector('[data-action="inbound-readiness"]')?.textContent,
    ).toContain('Start receiving calls');
    expect(html).not.toContain('Workspace administration');
    expect(html).not.toContain('Authority-backed');
    expect(doc.querySelector('[data-admin-section="team"]')).toBeNull();
    expect(
      doc.querySelector('[data-form="commercial-billing-checkout"]'),
    ).toBeNull();
  });

  it('shows an active inbound session with a deliberate pause and minimize action', () => {
    const state = rep();
    state.inboundOperator.rep.ready = true;
    state.inboundOperator.rep.presence = 'online';
    const doc = dom(renderLeadConnectorEmbed(state, { surface: 'admin' }));
    expect(doc.querySelector('[data-session-status]')?.textContent).toContain(
      'Receiving calls',
    );
    expect(
      doc.querySelector('[data-action="inbound-readiness"]')?.textContent,
    ).toContain('Stop receiving calls');
    expect(
      doc.querySelector('[data-action="workspace-minimize"]'),
    ).not.toBeNull();
    expect(
      doc
        .querySelector('[data-action="inbound-readiness"]')
        ?.getAttribute('data-ready'),
    ).toBe('false');
  });

  it('never labels acceptance or an uncertain connection as a connected call', () => {
    for (const phase of ['connecting', 'unknown'] as const) {
      const state = rep();
      state.inboundOperator.rep.ready = true;
      state.inboundOperator.rep.assignment = {
        assignmentId: 'assignment-1',
        requestId: 'request-1',
        generation: 7,
        phase,
        offerExpiresAt: null,
        endpointId: 'phone-1',
        externalStarted: true,
        connectedAt: null,
        unknownSince: phase === 'unknown' ? '2026-10-30T12:00:00Z' : null,
        wrapUpUntil: null,
      };
      const doc = dom(renderLeadConnectorEmbed(state, { surface: 'admin' }));
      const status =
        doc.querySelector('[data-session-status]')?.textContent ?? '';
      expect(status).toContain(
        phase === 'unknown' ? 'Reconnecting' : 'Connecting',
      );
      expect(status).not.toContain('On a call');
      expect(
        doc
          .querySelector('[data-action="inbound-readiness"]')
          ?.hasAttribute('disabled'),
      ).toBe(true);
    }
  });

  it('keeps the minimized live session usable without exposing setup and management forms', () => {
    const state = rep();
    state.inboundOperator.rep.ready = true;
    state.inboundOperator.rep.presence = 'online';
    const doc = dom(
      renderLeadConnectorEmbed(state, {
        surface: 'overlay',
        workspace: { screen: 'calling', mode: 'inbound', compact: true },
      }),
    );
    expect(doc.querySelector('[data-workspace-compact="true"]')).not.toBeNull();
    expect(
      doc.querySelector('[data-action="workspace-expand"]'),
    ).not.toBeNull();
    expect(doc.querySelector('[data-session-status]')?.textContent).toContain(
      'Receiving calls',
    );
    expect(doc.querySelector('form')).toBeNull();
  });

  it('opens advanced outbound options as a separate page and requires an explicit start', () => {
    const doc = dom(renderLeadConnectorEmbed(rep(), { surface: 'overlay' }));
    const options = doc.querySelector(
      'details[data-disclosure="call-options"]',
    );
    expect(options).toBeNull();
    expect(
      doc.querySelector('[data-action="workspace-call-options"]'),
    ).not.toBeNull();
    expect(
      doc.querySelector('[data-action="start-configured"]')?.textContent,
    ).toContain('Start calling');
    expect(
      doc
        .querySelector('[data-action="start-configured"]')
        ?.hasAttribute('disabled'),
    ).toBe(true);
    expect(
      doc.querySelector('[data-form="commercial-billing-checkout"]'),
    ).toBeNull();
  });
  it('opens management as dedicated pages and makes Starter minutes the billing entry', () => {
    const state = rep();
    const doc = dom(
      renderLeadConnectorEmbed(state, {
        surface: 'admin',
        workspace: { screen: 'settings', mode: 'inbound', compact: false },
      }),
    );
    expect(doc.querySelector('[data-action="workspace-team"]')).not.toBeNull();
    expect(
      doc.querySelector('[data-action="workspace-numbers"]'),
    ).not.toBeNull();
    expect(
      doc.querySelector('[data-action="workspace-mercury"]'),
    ).not.toBeNull();
    expect(doc.querySelector('details[data-disclosure="team"]')).toBeNull();
    expect(
      doc.querySelector('.workspace-footer [data-action="workspace-billing"]')
        ?.textContent,
    ).toContain('Starter');
    expect(doc.querySelector('.workspace-footer a')?.getAttribute('href')).toBe(
      'https://docs.consuelohq.com/',
    );
  });
  it('keeps idle inbound quiet while making browser setup discoverable', () => {
    const doc = dom(renderLeadConnectorEmbed(rep(), { surface: 'admin' }));
    expect(doc.querySelector('[data-session-status]')).toBeNull();
    expect(doc.body.textContent).toContain('This browser');
    expect(
      doc.querySelector('[data-action="inbound-readiness"]')?.textContent,
    ).toContain('Start receiving calls');
  });
  it('renders a real brand asset and hides opaque references in history', () => {
    const state = rep();
    state.callHistory = [
      {
        id: 'session-internal',
        contactId: 'J4Aei7h8V9qALyAADYI4',
        contactName: 'J4Aei7h8V9qALyAADYI4',
        representative: '0h7yfqyVzjJv0oYz01q3',
        status: 'completed',
        durationSeconds: 9,
        calls: [],
        transcriptStatus: null,
      },
    ];
    const doc = dom(
      renderLeadConnectorEmbed(state, {
        surface: 'overlay',
        workspace: { screen: 'history', mode: 'outbound', compact: false },
      }),
    );
    expect(doc.querySelector('img[data-brand-logo]')).not.toBeNull();
    expect(doc.body.textContent).not.toContain('J4Aei7h8V9qALyAADYI4');
    expect(doc.body.textContent).not.toContain('0h7yfqyVzjJv0oYz01q3');
    expect(
      doc.querySelector('[data-action="select-call"]')?.textContent,
    ).toContain('Call');
  });
});

describe('floating workspace pages', () => {
  it('keeps Mercury in Settings and moves queue details out of the setup form', () => {
    const doc = dom(
      renderLeadConnectorEmbed(rep(), {
        surface: 'overlay',
        workspace: { screen: 'calling', mode: 'inbound', compact: false },
      }),
    );
    expect(
      doc.querySelector('.workspace-header [data-action="workspace-mercury"]'),
    ).toBeNull();
    expect(
      doc.querySelector('details[data-disclosure="inbound-queue"]'),
    ).toBeNull();
    expect(
      doc.querySelector('[data-action="workspace-queue-details"]'),
    ).not.toBeNull();
    const detail = dom(
      renderLeadConnectorEmbed(rep(), {
        surface: 'overlay',
        workspace: { screen: 'queue-details', mode: 'inbound', compact: false },
      }),
    );
    expect(detail.querySelector('#workspace-page-title')?.textContent).toBe(
      'Queue details',
    );
    expect(detail.body.textContent).toContain('Longest wait');
    expect(
      detail.querySelector('[data-action="inbound-readiness"]'),
    ).toBeNull();
  });
  it('gives calling options their own page without nested dropdowns', () => {
    const state = rep();
    state.callerIds = ['+15550103891'];
    const doc = dom(
      renderLeadConnectorEmbed(state, {
        surface: 'overlay',
        workspace: { screen: 'call-options', mode: 'outbound', compact: false },
      }),
    );
    expect(doc.querySelector('#workspace-page-title')?.textContent).toBe(
      'Calling options',
    );
    expect(doc.querySelector('details')).toBeNull();
    expect(doc.querySelector('[data-field="caller-id"]')).not.toBeNull();
    expect(doc.querySelector('[data-field="calling-mode"]')).not.toBeNull();
    expect(doc.querySelector('[data-action="start-configured"]')).toBeNull();
  });
});
