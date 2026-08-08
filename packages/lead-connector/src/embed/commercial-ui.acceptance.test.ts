import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';

import { renderLeadConnectorEmbed } from './view';
import {
  createInitialEmbedState,
  reduceEmbedState,
  type LeadConnectorEmbedState,
} from './state-machine';

const commercialState = (): LeadConnectorEmbedState => ({
  ...createInitialEmbedState(),
  phase: 'ready',
  contacts: [],
  opportunities: [],
  pipelines: [
    {
      id: 'pipeline-one',
      name: 'Sales',
      stages: [
        { id: 'stage-one', name: 'New', position: 0 },
        { id: 'stage-two', name: 'Qualified', position: 1 },
      ],
    },
  ],
  selectedQueue: {
    pipelineId: 'pipeline-one',
    pipelineName: 'Sales',
    stageId: 'stage-one',
    stageName: 'New',
    opportunityTotal: 4,
    callableTotal: 3,
  },
  setup: {
    mode: 'queue',
    callingMode: 'single',
    requestedFanout: 1,
    preferLocalPresence: true,
    callerIdNumber: '+15550100001',
  },
  callerIds: ['+15550100001', '+15550100002'],
} as LeadConnectorEmbedState);

const commercialAdminState = (
  subscription: Record<string, unknown> | null,
): LeadConnectorEmbedState => ({
  ...commercialState(),
  commercialDashboard: {
    workspaceId: 'workspace-one',
    catalog: {
      plans: {
        single: {
          code: 'single',
          priceCents: 5900,
          maxNumbersPerSeat: 1,
          includedMinutes: 1388,
          predictive: false,
          recordings: false,
          transcripts: false,
        },
        standard: {
          code: 'standard',
          priceCents: 9900,
          maxNumbersPerSeat: 3,
          includedMinutes: null,
          predictive: true,
          recordings: true,
          transcripts: true,
        },
        power: {
          code: 'power',
          priceCents: 15900,
          maxNumbersPerSeat: 10,
          includedMinutes: null,
          predictive: true,
          recordings: true,
          transcripts: true,
        },
      },
      trial: {
        includedMinutes: 500,
        maxSeats: 1,
        maxNumbers: 1,
        planCode: 'standard',
      },
      additionalNumberPriceCents: 199,
      includedNumbersPerSeat: 1,
      paymentGraceDays: 3,
    },
    subscription,
    subscriptionItems: subscription
      ? [
          { item_code: 'single', quantity: 2 },
          { item_code: 'additional-number', quantity: 1 },
        ]
      : [],
    billingSummary: subscription
      ? { amountDue: 12_198, currency: 'usd', periodEnd: 1_788_600_000 }
      : null,
    billingSummaryError: null,
    seats: [{ user_id: 'user-one', plan_code: 'single', status: 'active' }],
    numbers: [
      { phone_number: '+15550100001', user_id: 'user-one', status: 'active' },
    ],
    usage: { connected_minutes: 42, provider_cost_micros: 9000 },
  },
});

describe('commercial LeadConnector surfaces', () => {
  it('keeps calling controls out of admin and exposes commercial management sections', () => {
    const html = renderLeadConnectorEmbed(commercialState(), {
      surface: 'admin',
    });

    expect(html).toContain('Plans');
    expect(html).toContain('Team');
    expect(html).toContain('Phone numbers');
    expect(html).toContain('Usage');
    expect(html).toContain('Billing');
    expect(html).not.toContain('Who do you want to call?');
    expect(html).not.toContain('data-action="start-call"');
  });

  it('renders progressive Checkout, subscription-change, invoice, payment, and cancellation billing states', () => {
    const trialHtml = renderLeadConnectorEmbed(commercialAdminState(null), {
      surface: 'admin',
    });
    expect(trialHtml).toContain('data-form="commercial-billing-checkout"');
    expect(trialHtml).toContain('Start paid plan');
    expect(trialHtml).not.toContain('data-form="commercial-billing-change"');

    const active = commercialAdminState({
      status: 'active',
      cancel_at_period_end: false,
      payment_failed_at: null,
    });
    const activeHtml = renderLeadConnectorEmbed(active, { surface: 'admin' });
    expect(activeHtml).toContain('data-form="commercial-billing-change"');
    const activeDocument = new JSDOM(activeHtml).window.document;
    expect(
      activeDocument
        .querySelector<HTMLInputElement>('input[name="single"]')
        ?.getAttribute('value'),
    ).toBe('2');
    expect(
      activeDocument
        .querySelector<HTMLInputElement>('input[name="additionalNumber"]')
        ?.getAttribute('value'),
    ).toBe('1');
    expect(activeHtml).toContain('Upcoming invoice');
    expect(activeHtml).toContain('$121.98');
    expect(activeHtml).toContain('1 additional number');
    expect(activeHtml).toContain('Payment methods, invoices, and cancellation');
    expect(activeHtml).toContain('data-action="manage-billing"');

    const previewHtml = renderLeadConnectorEmbed(
      {
        ...active,
        commercialBillingPreview: {
          quantities: {
            single: 2,
            standard: 1,
            power: 0,
            additionalNumber: 1,
          },
          amountDue: 4200,
          currency: 'usd',
          prorationDate: 1_786_000_000,
        },
      },
      { surface: 'admin' },
    );
    expect(previewHtml).toContain('Proration preview');
    expect(previewHtml).toContain('$42.00');
    expect(previewHtml).toContain('data-action="apply-billing-change"');
    expect(previewHtml).toContain('data-action="cancel-billing-preview"');

    const recoveryHtml = renderLeadConnectorEmbed(
      commercialAdminState({
        status: 'past_due',
        cancel_at_period_end: false,
        payment_failed_at: '2026-08-04T00:00:00.000Z',
      }),
      { surface: 'admin' },
    );
    expect(recoveryHtml).toContain('Payment recovery');
    expect(recoveryHtml).toContain('3-day grace');

    const cancellationHtml = renderLeadConnectorEmbed(
      commercialAdminState({
        status: 'active',
        cancel_at_period_end: true,
        payment_failed_at: null,
      }),
      { surface: 'admin' },
    );
    expect(cancellationHtml).toContain('Cancellation scheduled');
  });

  it('renders the overlay as a focused calling surface with accessible comboboxes and no promotional header', () => {
    const html = renderLeadConnectorEmbed(commercialState(), {
      surface: 'overlay',
    });
    const dom = new JSDOM(html);
    const document = dom.window.document;

    expect(document.querySelector('.brand-mark')).toBeNull();
    expect(document.querySelector('.status-pill')).toBeNull();
    expect(document.body.textContent).not.toContain('Consuelo Dialer');
    expect(document.querySelector('button[data-action="refresh"]')).not.toBeNull();
    expect(
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Refresh CRM',
      ),
    ).toBe(false);
    expect(document.querySelectorAll('select')).toHaveLength(0);
    expect(document.querySelectorAll('[role="combobox"]').length).toBeGreaterThanOrEqual(2);
    expect(document.querySelectorAll('[role="listbox"]').length).toBeGreaterThanOrEqual(2);
  });

  it('renders an actionable transfer form and only exposes complete or cancel during a warm consultation', () => {
    const connected = {
      ...commercialState(),
      phase: 'connected' as const,
      callSession: {
        groupId: 'group-one',
        status: 'connected',
        winnerSid: 'call-one',
        winner: null,
        calls: [],
      },
    };
    const idleHtml = renderLeadConnectorEmbed(connected, { surface: 'overlay' });

    expect(idleHtml).toContain('data-form=\"transfer\"');
    expect(idleHtml).toContain('name=\"to\"');
    expect(idleHtml).toContain('name=\"type\"');
    expect(idleHtml).toContain('data-action=\"initiate-transfer\"');
    expect(idleHtml).not.toContain('data-action=\"complete-transfer\"');
    expect(idleHtml).not.toContain('data-action=\"cancel-transfer\"');

    const consultingHtml = renderLeadConnectorEmbed(
      {
        ...connected,
        transfer: {
          status: 'consulting',
          type: 'warm',
          target: '+15550100111',
          transferId: 'transfer-one',
          transferCallSid: 'CA_transfer_one',
          conferenceSid: 'CF_one',
        },
      },
      { surface: 'overlay' },
    );
    expect(consultingHtml).toContain('Warm consultation');
    expect(consultingHtml).toContain('data-action=\"complete-transfer\"');
    expect(consultingHtml).toContain('data-action=\"cancel-transfer\"');
    expect(consultingHtml).not.toContain('data-action=\"initiate-transfer\"');
  });

  it('soft Home reset preserves authenticated resources, caller identity, and setup', () => {
    const state = {
      ...commercialState(),
      selectedTargets: [
        {
          dedupeKey: 'contact-one:+15550100003',
          contactId: 'contact-one',
          opportunityId: null,
          phone: '+15550100003',
          name: 'Person One',
        },
      ],
    };
    const next = reduceEmbedState(state, { type: 'RETURN_HOME' });

    expect(next.pipelines).toEqual(state.pipelines);
    expect(next.callerIds).toEqual(state.callerIds);
    expect(next.setup).toEqual(state.setup);
    expect(next.selectedTargets).toEqual(state.selectedTargets);
    expect(next.phase).toBe('ready');
  });

  it('implements a stable keyboard and pointer combobox contract across option refreshes', async () => {
    const module = (await import('./combobox')) as {
      createCombobox: (input: {
        root: HTMLElement;
        options: Array<{ value: string; label: string }>;
        value: string | null;
        onChange: (value: string) => void;
      }) => {
        update: (input: {
          options: Array<{ value: string; label: string }>;
          value: string | null;
        }) => void;
        destroy: () => void;
      };
    };
    const dom = new JSDOM(
      '<div id="root"><button role="combobox" aria-expanded="false"></button><div role="listbox"></div></div>',
      { pretendToBeVisual: true },
    );
    const root = dom.window.document.getElementById('root') as HTMLElement;
    const selected: string[] = [];
    const combobox = module.createCombobox({
      root,
      options: [
        { value: 'one', label: 'Alpha' },
        { value: 'two', label: 'Bravo' },
        { value: 'three', label: 'Charlie' },
      ],
      value: 'one',
      onChange: (value) => selected.push(value),
    });
    const trigger = root.querySelector<HTMLElement>('[role="combobox"]')!;
    trigger.focus();
    trigger.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      }),
    );
    trigger.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'End',
        bubbles: true,
      }),
    );
    trigger.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      }),
    );
    expect(selected.at(-1)).toBe('three');

    trigger.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'b',
        bubbles: true,
      }),
    );
    combobox.update({
      options: [
        { value: 'one', label: 'Alpha' },
        { value: 'two', label: 'Bravo updated' },
        { value: 'three', label: 'Charlie' },
      ],
      value: 'three',
    });
    expect(dom.window.document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      }),
    );
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(dom.window.document.activeElement).toBe(trigger);
    combobox.destroy();
  });
});
