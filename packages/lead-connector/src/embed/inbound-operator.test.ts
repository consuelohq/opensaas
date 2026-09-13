import { describe, expect, test } from 'bun:test';

import {
  createInitialInboundOperatorState,
  createLeadConnectorInboundOperatorApi,
  reduceInboundOperatorState,
  type InboundOperatorSnapshot,
} from './inbound-operator.js';
import { renderInboundOperatorPanel } from './inbound-operator-view.js';

const snapshot: InboundOperatorSnapshot = {
  serverTime: '2026-09-13T16:00:00.000Z',
  rep: {
    repId: 'rep-1',
    ready: true,
    presence: 'online',
    endpoints: [
      {
        endpointId: 'browser-1',
        kind: 'browser',
        healthy: true,
        label: 'Browser',
      },
      {
        endpointId: 'phone-1',
        kind: 'phone',
        healthy: true,
        label: 'Desk phone',
      },
    ],
    capacityPhase: 'offering',
    assignment: {
      assignmentId: 'assignment-1',
      requestId: 'request-1',
      generation: 7,
      phase: 'offering',
      offerExpiresAt: '2026-09-13T16:00:12.000Z',
      endpointId: null,
      externalStarted: false,
      connectedAt: null,
      unknownSince: null,
      wrapUpUntil: null,
    },
  },
  offers: [
    {
      assignmentId: 'assignment-1',
      requestId: 'request-1',
      generation: 7,
      queueId: 'queue-1',
      queueName: 'Inbound sales',
      callerLabel: '••• ••• 0142',
      waitingSeconds: 18,
      offerExpiresAt: '2026-09-13T16:00:12.000Z',
      ownerRepId: null,
      eligibleEndpoints: ['browser-1', 'phone-1'],
    },
  ],
  queue: {
    queueId: 'queue-1',
    queueName: 'Inbound sales',
    waitingCount: 3,
    oldestWaitSeconds: 42,
    serviceableCount: 2,
    businessHours: 'open',
    overflow: 'standby',
  },
  configuration: {
    numberLabel: 'Main sales line',
    maskedNumber: '••• ••• 0100',
    teamName: 'Sales',
    hoursLabel: 'Mon–Fri, 9:00 AM–5:00 PM',
    overflowLabel: 'Callback then voicemail',
  },
};

describe('inbound operator state', () => {
  test('projects an authoritative snapshot without inventing capacity', () => {
    const state = reduceInboundOperatorState(
      createInitialInboundOperatorState(),
      { type: 'SNAPSHOT_LOADED', snapshot },
    );
    expect(state.phase).toBe('ready');
    expect(state.rep.assignment?.generation).toBe(7);
    expect(state.offers[0]?.assignmentId).toBe('assignment-1');
    expect(state.queue.waitingCount).toBe(3);
  });

  test('stale acceptance keeps the offer actionable and reports the server reason', () => {
    const ready = reduceInboundOperatorState(
      createInitialInboundOperatorState(),
      { type: 'SNAPSHOT_LOADED', snapshot },
    );
    const state = reduceInboundOperatorState(ready, {
      type: 'ACTION_REJECTED',
      action: 'accept',
      assignmentId: 'assignment-1',
      code: 'STALE_ASSIGNMENT',
      message: 'This offer is no longer current.',
    });
    expect(state.offers).toHaveLength(1);
    expect(state.rep.assignment?.phase).toBe('offering');
    expect(state.error?.code).toBe('STALE_ASSIGNMENT');
  });

  test('renders endpoint readiness, truthful connecting state, queue visibility, and recovery controls', () => {
    const ready = reduceInboundOperatorState(
      createInitialInboundOperatorState(),
      { type: 'SNAPSHOT_LOADED', snapshot },
    );
    const connecting = reduceInboundOperatorState(ready, {
      type: 'ASSIGNMENT_UPDATED',
      assignment: {
        ...snapshot.rep.assignment!,
        phase: 'connecting',
        externalStarted: true,
        endpointId: 'browser-1',
      },
    });
    const html = renderInboundOperatorPanel(connecting);
    expect(html).toContain('Inbound operator');
    expect(html).toContain('Ready for inbound');
    expect(html).toContain('Accept');
    expect(html).toContain('Connecting');
    expect(html).toContain('Waiting callers');
    expect(html).toContain('Reconnect state');
    expect(html).toContain('Save inbound configuration');
    expect(html).toContain('name="hoursLabel"');
    expect(html).toContain('data-assignment-id="assignment-1"');
  });
});

describe('inbound operator adapter', () => {
  test('sends fenced actions through authenticated UI routes', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const adapter = createLeadConnectorInboundOperatorApi({
      baseUrl: 'https://dialer.example.test/',
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            accepted: false,
            status: 'stale',
            message: 'expired',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    adapter.setSessionToken('session-token');
    const result = await adapter.acceptOffer({
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'browser-1',
    });
    expect(result.status).toBe('stale');
    expect(requests[0]?.url).toBe(
      'https://dialer.example.test/v1/inbound/operator/offers/accept',
    );
    expect(requests[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer session-token',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      assignmentId: 'assignment-1',
      generation: 7,
      endpointId: 'browser-1',
    });
  });
});
