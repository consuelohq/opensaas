import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  createInitialEmbedState,
  type LeadConnectorEmbedState,
} from './state-machine';
import { renderLeadConnectorEmbed } from './view';
import { selectedAnsweringEndpoints } from './inbound-operator-view';

const makeState = (): LeadConnectorEmbedState => {
  const state = createInitialEmbedState();
  state.phase = 'ready';
  state.sessionToken = 'test-session';
  state.inboundOperator.phase = 'ready';
  state.inboundOperator.rep.repId = 'rep';
  state.inboundOperator.rep.deviceEditingAvailable = true;
  state.inboundOperator.phase = 'ready';
  state.inboundOperator.rep.endpoints = [
    {
      endpointId: 'web-1',
      kind: 'browser',
      label: 'Web',
      healthy: true,
      active: true,
    },
    {
      endpointId: 'cell-1',
      kind: 'phone',
      label: 'Cell phone',
      healthy: true,
      active: true,
    },
  ];
  state.commercialDashboard = {
    numbers: [],
    catalog: { additionalNumberPriceCents: 300 },
    seats: [],
  } as unknown as LeadConnectorEmbedState['commercialDashboard'];
  return state;
};
const page = (
  state: LeadConnectorEmbedState,
  screen:
    | 'calling'
    | 'settings'
    | 'numbers'
    | 'mercury'
    | 'team'
    | 'billing'
    | 'appearance'
    | 'queue-details'
    | 'call-options',
  mode: 'inbound' | 'outbound' = 'inbound',
  numberTab?: 'receive' | 'call-from',
) =>
  new JSDOM(
    renderLeadConnectorEmbed(state, {
      surface: 'overlay',
      workspace: { screen, mode, compact: false, numberTab },
    }),
  ).window.document;

describe('compact Dialer workspace UX', () => {
  test('inbound answering uses exclusive Web or Cell phone selection, including legacy double-active snapshots', () => {
    const state = makeState();
    const selection = selectedAnsweringEndpoints(state.inboundOperator, [
      'web-1',
      'cell-1',
    ]);
    expect(selection).toEqual(['web-1']);
    const doc = page(state, 'calling');
    const options = [
      ...doc.querySelectorAll<HTMLInputElement>(
        '[data-field="inbound-endpoint"]',
      ),
    ];
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.type)).toEqual(['radio', 'radio']);
    expect(options[0]!.name).toBe(options[1]!.name);
    expect(options.filter((option) => option.checked)).toHaveLength(1);
    expect(doc.querySelector('.answering-devices')?.textContent).toContain(
      'Web',
    );
    expect(doc.querySelector('.answering-devices')?.textContent).toContain(
      'Cell phone',
    );
    expect(doc.querySelector('.answering-devices')?.textContent).not.toContain(
      'My phone',
    );
    expect(doc.querySelector('.answering-devices')?.textContent).not.toContain(
      'This browser',
    );
  });

  test('answering devices show masked saved destination and self-service controls, never inferred configuration', () => {
    const state = makeState();
    const phone = state.inboundOperator.rep.endpoints.find(
      (e) => e.kind === 'phone',
    )!;
    phone.maskedDestination = '••• ••• 0123';
    phone.configurationSource = 'workspace';
    const doc = page(state, 'numbers', 'inbound', 'receive');
    expect(doc.querySelector('[data-form="answering-phone"]')).not.toBeNull();
    expect(
      doc.querySelector('input[name="phone"]')?.getAttribute('value'),
    ).toBeNull();
    expect(doc.body.textContent).toContain('••• ••• 0123');
    expect(doc.body.textContent).not.toContain('Configured');
    expect(
      doc.querySelector('[data-action="remove-answering-phone"]'),
    ).not.toBeNull();
    state.inboundOperator.rep.assignment = {
      assignmentId: 'active',
      requestId: 'request',
      generation: 1,
      phase: 'unknown',
      offerExpiresAt: null,
      endpointId: null,
      externalStarted: true,
      connectedAt: null,
      unknownSince: null,
      wrapUpUntil: null,
    };
    expect(
      page(state, 'numbers', 'inbound', 'receive')
        .querySelector('input[name="phone"]')
        ?.hasAttribute('disabled'),
    ).toBe(true);
  });
  test('a rep can edit their own answering phone without an administrator billing dashboard', () => {
    const state = makeState();
    state.commercialDashboard = null;
    const doc = page(state, 'numbers', 'inbound', 'receive');
    expect(doc.querySelector('[data-form="answering-phone"]')).not.toBeNull();
    expect(doc.body.textContent).not.toContain('Loading workspace settings');
  });
  test('an unprovisioned rep gets setup guidance rather than an unusable device form', () => {
    const state = makeState();
    state.inboundOperator.rep.repId = '';
    state.inboundOperator.rep.endpoints = [];
    state.inboundOperator.phase = 'error';
    const doc = page(state, 'numbers', 'inbound', 'receive');
    expect(doc.querySelector('[data-form="answering-phone"]')).toBeNull();
    expect(doc.body.textContent).toContain(
      'administrator needs to add you to an inbound team',
    );
  });
  test('phone editing is unavailable when the server has no encryption capability', () => {
    const state = makeState();
    state.inboundOperator.rep.deviceEditingAvailable = false;
    const doc = page(state, 'numbers', 'inbound', 'receive');
    expect(
      doc.querySelector('input[name="phone"]')?.hasAttribute('disabled'),
    ).toBe(true);
    expect(doc.body.textContent).toContain('encrypted phone settings');
  });
  test('device rows use borderless, bright selected, quiet inactive and pointer-hover states', () => {
    const styles = readFileSync(
      new URL('./workspace-theme.css', import.meta.url),
      'utf8',
    );
    const base =
      styles
        .match(/\.calling-workspace \.inbound-endpoint-row \{([^}]+)\}/g)
        ?.at(-1) ?? '';
    const active =
      styles
        .match(
          /\.calling-workspace \.inbound-endpoint-row:has\(:checked\) \{([^}]+)\}/g,
        )
        ?.at(-1) ?? '';
    expect(base).toContain('background: transparent');
    expect(active).toContain('background: var(--soft)');
    expect(styles).toMatch(
      /\.calling-workspace \.inbound-endpoint-row:has\(input:not\(:disabled\)\)\s*\{[^}]*cursor:\s*pointer/s,
    );
    expect(styles).toMatch(
      /\.calling-workspace \.inbound-endpoint-row:has\(input:not\(:disabled\)\):hover\s*\{[^}]*background:\s*var\(--soft\)/s,
    );
    expect(styles).toMatch(
      /\.calling-workspace \.inbound-endpoint-row:has\(input:not\(:disabled\)\):hover strong\s*\{[^}]*color:\s*var\(--ink\)/s,
    );
    const doc = page(makeState(), 'calling');
    const rows = [
      ...doc.querySelectorAll<HTMLLabelElement>('label.inbound-endpoint-row'),
    ];
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.querySelector('input[type="radio"]'))).toBe(
      true,
    );
  });

  test('the entire Starter plan card opens billing with only Manage plan highlighting', () => {
    const doc = page(makeState(), 'settings');
    const plan = doc.querySelector<HTMLElement>('.settings-plan');
    expect(plan?.tagName).toBe('BUTTON');
    expect(plan?.getAttribute('data-action')).toBe('workspace-billing');
    expect(plan?.getAttribute('type')).toBe('button');
    expect(plan?.textContent).toContain('YOUR PLAN');
    expect(plan?.textContent).toContain('Manage plan');
    expect(plan?.querySelector('button, a')).toBeNull();
    expect(plan?.querySelector('h1, h2, h3, div')).toBeNull();
    const styles = readFileSync(
      new URL('./workspace-theme.css', import.meta.url),
      'utf8',
    );
    expect(styles).toMatch(
      /\.calling-workspace \.settings-plan\s*\{[^}]*cursor:\s*pointer/s,
    );
    expect(styles).toMatch(
      /\.calling-workspace \.settings-plan:hover:not\(:disabled\)\s*\{[^}]*filter:\s*none/s,
    );
    expect(styles).toMatch(
      /\.calling-workspace \.settings-plan:hover \.text-button\s*\{[^}]*color:\s*var\(--ink\)/s,
    );
  });

  test('the Call from number finder does not show the redundant slot-pricing caption', () => {
    const doc = page(makeState(), 'numbers', 'inbound', 'call-from');
    expect(
      doc.querySelector('[data-form="commercial-number-search"]'),
    ).not.toBeNull();
    expect(doc.body.textContent).not.toContain('An additional number slot');
    expect(doc.body.textContent).not.toContain(
      'Included slots follow your plan.',
    );
  });

  test('outbound tabs have one underline, plain queue placeholder and no empty-state filler', () => {
    const state = makeState();
    const doc = page(state, 'calling', 'outbound');
    const options = [
      ...doc.querySelectorAll<HTMLElement>('.setup-tabs .setup-tab'),
    ];
    expect(options).toHaveLength(2);
    expect(
      options.filter((button) => button.classList.contains('is-active')),
    ).toHaveLength(1);
    expect(
      doc.querySelector('[data-combobox-field="queue"] [role="combobox"]')
        ?.textContent,
    ).toBe('Select a pipeline stage');
    expect(doc.body.textContent).not.toContain(
      'Choose a pipeline stage to build your calling list.',
    );
    const styles = readFileSync(
      new URL('./workspace-theme.css', import.meta.url),
      'utf8',
    );
    expect(styles).not.toMatch(
      /\.calling-workspace\s+\.setup-tab\.is-active\s*\{\s*text-decoration:\s*underline/,
    );
  });

  test('calling options and queue details share a footer action group immediately above the primary action', () => {
    const state = makeState();
    for (const mode of ['outbound', 'inbound'] as const) {
      const doc = page(state, 'calling', mode);
      const entry = doc.querySelector<HTMLElement>('.calling-options-entry');
      const actions = doc.querySelector<HTMLElement>(
        '.setup-action-group .setup-actions',
      );
      expect(entry).not.toBeNull();
      expect(actions).not.toBeNull();
      expect(entry?.parentElement).toBe(actions?.parentElement);
      expect(entry?.nextElementSibling).toBe(actions);
      expect(entry?.firstElementChild?.querySelector('svg')).not.toBeNull();
      expect(entry?.getAttribute('data-action')).toBe(
        mode === 'inbound'
          ? 'workspace-queue-details'
          : 'workspace-call-options',
      );
    }
  });

  test('settings and inner pages place the heading on the same row as a quiet back breadcrumb', () => {
    const state = makeState();
    for (const [screen, title, back] of [
      ['settings', 'Settings', 'workspace-calling'],
      ['numbers', 'Phone numbers', 'workspace-settings'],
      ['mercury', 'Mercury', 'workspace-settings'],
      ['team', 'Team & seats', 'workspace-settings'],
      ['billing', 'Plan & billing', 'workspace-settings'],
      ['appearance', 'Appearance', 'workspace-settings'],
      ['queue-details', 'Queue details', 'workspace-calling'],
      ['call-options', 'Calling options', 'workspace-calling'],
    ] as const) {
      const doc = page(state, screen);
      expect(doc.querySelector('.page-breadcrumb h1')?.textContent).toBe(title);
      expect(
        doc.querySelector('.page-breadcrumb [data-action="' + back + '"]'),
      ).not.toBeNull();
      expect(doc.querySelectorAll('#workspace-page-title')).toHaveLength(1);
      expect(doc.querySelector('.workspace-content .page-heading')).toBeNull();
    }
    const settings = page(state, 'settings');
    expect(settings.body.textContent).not.toContain(
      'A few things to make calling yours.',
    );
    const numbers = page(state, 'numbers');
    expect(numbers.body.textContent).not.toContain(
      'Choose how callers reach you.',
    );
    expect(page(state, 'mercury').body.textContent).not.toContain(
      'Keep your team’s playbook close.',
    );
  });

  test('phone-number purpose tabs use the same quiet inactive and bright active tab classes', () => {
    const state = makeState();
    for (const [numberTab, active] of [
      ['receive', 'numbers-receive'],
      ['call-from', 'numbers-call-from'],
    ] as const) {
      const doc = page(state, 'numbers', 'inbound', numberTab);
      const tabs = [
        ...doc.querySelectorAll<HTMLElement>(
          '[aria-label="Phone number purpose"] .setup-tab',
        ),
      ];
      expect(tabs).toHaveLength(2);
      expect(
        tabs.filter((tab) => tab.classList.contains('is-active')),
      ).toHaveLength(1);
      expect(
        tabs
          .find((tab) => tab.classList.contains('is-active'))
          ?.getAttribute('data-action'),
      ).toBe(active);
      expect(
        tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true'),
      ).toHaveLength(1);
    }
  });
});
