import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';

import { renderLeadConnectorEmbed } from './view';
import {
  createInitialEmbedState,
  reduceEmbedState,
  type LeadConnectorEmbedState,
} from './state-machine';

const commercialState = (): LeadConnectorEmbedState =>
  ({
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
  }) as LeadConnectorEmbedState;

const commercialAdminState = (
  subscription: Record<string, unknown> | null,
): LeadConnectorEmbedState => ({
  ...commercialState(),
  commercialCaller: {
    planCode: 'single',
    trial: !subscription,
    callerIds: [],
    connectedMinutes: 42,
    remainingMinutes: 58,
    lineOptions: [1],
    predictive: false,
    recordings: false,
    transcripts: false,
    canStartCall: true,
    denialCode: null,
    billing: { state: subscription ? 'active' : 'trial', graceEndsAt: null },
  },
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
  it('opens management sections only from settings', () => {
    const html = renderLeadConnectorEmbed(commercialState(), {
      surface: 'admin',
      workspace: { screen: 'settings', mode: 'inbound', compact: false },
    });

    expect(html).toContain('YOUR PLAN');
    expect(html).toContain('Team');
    expect(html).toContain('Phone numbers');
    expect(html).toContain('Minutes, subscription and invoices');
    expect(html).toContain('Plan &amp; billing');
    expect(html).not.toContain('Who do you want to call?');
    expect(html).not.toContain('data-action="start-call"');
  });

  it('combines authoritative minutes, subscription and invoices with a hosted Stripe action', () => {
    const options = {
      surface: 'admin' as const,
      workspace: {
        screen: 'billing' as const,
        mode: 'inbound' as const,
        compact: false,
      },
    };
    const state = commercialAdminState(null);
    state.commercialDashboard!.publicPurchase = null;
    const trial = renderLeadConnectorEmbed(state, options);
    expect(trial).toContain('Starter');
    expect(trial).toContain('58');
    expect(trial).toContain('42 used');
    expect(trial).toContain('100 included');
    expect(trial).toContain('Upgrade your plan');
    expect(trial).toContain('data-action="manage-billing"');
    expect(trial).not.toContain('commercial-billing-checkout');
    const active = renderLeadConnectorEmbed(
      commercialAdminState({ status: 'active' }),
      options,
    );
    expect(active).toContain('Invoices & payment');
    expect(active).toContain('Open billing portal');
    expect(active).not.toContain('commercial-billing-change');
    expect(
      renderLeadConnectorEmbed(
        commercialAdminState({ status: 'past_due' }),
        options,
      ),
    ).toContain('Payment needs attention');
    expect(
      renderLeadConnectorEmbed(
        commercialAdminState({ status: 'active', cancel_at_period_end: true }),
        options,
      ),
    ).toContain('Cancels at period end');
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
    expect(
      document.querySelector('button[data-action="refresh"]'),
    ).not.toBeNull();
    expect(
      [...document.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Refresh CRM',
      ),
    ).toBe(false);
    expect(document.querySelectorAll('select')).toHaveLength(0);
    expect(
      document.querySelectorAll('[role="combobox"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      document.querySelectorAll('[role="listbox"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders provider pipeline stages as selectable queue options when they are returned', () => {
    const html = renderLeadConnectorEmbed(
      {
        ...commercialState(),
        pipelines: [
          {
            id: 'marketing-pipeline',
            name: 'Marketing Pipeline',
            stages: [{ id: 'new-lead', name: 'New Lead', position: 0 }],
          },
        ],
        selectedQueue: null,
      },
      { surface: 'overlay' },
    );
    const document = new JSDOM(html).window.document;
    const queueOptions = [
      ...document.querySelectorAll(
        '[data-combobox-field="queue"] [role="option"]',
      ),
    ].map((option) => option.textContent?.trim());

    expect(queueOptions).toEqual(['Marketing Pipeline — New Lead']);
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
    const idleHtml = renderLeadConnectorEmbed(connected, {
      surface: 'overlay',
    });

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
  it('uses the authoritative public plan and never offers legacy quantities for a public subscription', () => {
    const state = commercialAdminState({ status: 'active' });
    state.commercialDashboard!.publicPurchase = {
      plan: 'agency',
      billing: 'annual',
      seats: 5,
      mercurySeats: 2,
      minutePack: 0,
      numberPack: 10,
      recurringCents: 894000,
    };
    const doc = new JSDOM(
      renderLeadConnectorEmbed(state, {
        surface: 'admin',
        workspace: { screen: 'billing', mode: 'inbound', compact: false },
      }),
    ).window.document;
    expect(doc.body.textContent).toContain('Agency');
    expect(
      doc.querySelector('[data-form="commercial-billing-change"]'),
    ).toBeNull();
    expect(
      doc.querySelector('[data-form="commercial-billing-checkout"]'),
    ).toBeNull();
    expect(
      doc.querySelector('[data-form="commercial-purchase-claim"]'),
    ).toBeNull();
    expect(doc.querySelector('[data-action="manage-billing"]')).not.toBeNull();
    expect(doc.body.textContent).toContain('$8,940.00');
    expect(doc.querySelectorAll('details')).toHaveLength(0);
  });

  it('reveals the purchase claim only when the server advertises that contract', () => {
    const state = commercialAdminState(null);
    const options = {
      surface: 'admin' as const,
      workspace: {
        screen: 'billing' as const,
        mode: 'inbound' as const,
        compact: false,
      },
    };
    expect(renderLeadConnectorEmbed(state, options)).not.toContain(
      'data-form="commercial-purchase-claim"',
    );
    state.commercialDashboard!.publicPurchase = null;
    const doc = new JSDOM(renderLeadConnectorEmbed(state, options)).window
      .document;
    const field = doc.querySelector<HTMLInputElement>(
      '[data-form="commercial-purchase-claim"] input',
    );
    expect(field?.type).toBe('password');
    expect(field?.autocomplete).toBe('off');
    expect(
      doc
        .querySelector('details[data-disclosure="purchase-claim"]')
        ?.hasAttribute('open'),
    ).toBe(false);
  });
  it('keeps native plan and number billing separate and opens only Stripe management controls', () => {
    const state = commercialAdminState({ status: 'active' });
    state.commercialDashboard!.publicPurchase = {
      plan: 'agency',
      billing: 'annual',
      seats: 2,
      mercurySeats: 2,
      minutePack: 0,
      numberPack: 10,
      recurringCents: 417600,
      baseRecurringCents: 417600,
      numberRecurringCents: 2800,
      numberBilling: 'monthly',
      separateInvoices: true,
    };
    const doc = new JSDOM(
      renderLeadConnectorEmbed(state, {
        surface: 'admin',
        workspace: { screen: 'billing', mode: 'inbound', compact: false },
      }),
    ).window.document;
    expect(
      doc.querySelector('[data-action="manage-number-billing"]'),
    ).not.toBeNull();
    expect(doc.body.textContent).toContain('$4,176.00');
    expect(doc.body.textContent).toContain('$28.00');
    expect(doc.body.textContent).toContain('separate invoice');
    expect(doc.body.textContent).toContain('Mercury');
    expect(
      doc.querySelector('[data-form="commercial-billing-checkout"]'),
    ).toBeNull();
  });
});
