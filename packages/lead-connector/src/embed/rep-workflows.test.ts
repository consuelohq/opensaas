import { it, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { createInitialEmbedState, reduceEmbedState } from './state-machine';
import { renderLeadConnectorEmbed } from './view';
import {
  readWorkspacePreferences,
  writeWorkspacePreferences,
} from './workspace-preferences';
import type { CallingWorkspace } from './calling-workspace';
import { targetChoices } from './target-picker';
const rep = () => {
  const s = createInitialEmbedState();
  return {
    ...s,
    phase: 'ready' as const,
    sessionToken: 'test',
    inboundOperator: {
      ...s.inboundOperator,
      phase: 'ready' as const,
      rep: {
        ...s.inboundOperator.rep,
        repId: 'rep',
        endpoints: [
          {
            endpointId: 'phone',
            kind: 'phone' as const,
            label: 'Phone',
            healthy: true,
            active: true,
          },
          {
            endpointId: 'browser',
            kind: 'browser' as const,
            label: 'Browser',
            healthy: true,
            active: false,
          },
        ],
      },
    },
  };
};
const render = (workspace: CallingWorkspace, state = rep()) =>
  new JSDOM(renderLeadConnectorEmbed(state, { surface: 'overlay', workspace }))
    .window.document;
it('defaults to the browser, orders it first and disables readiness when both are deselected', () => {
  const doc = render({ screen: 'calling', mode: 'inbound', compact: false });
  const devices = doc.querySelectorAll<HTMLInputElement>(
    '[data-field=inbound-endpoint]',
  );
  expect(devices[0]?.dataset.endpointKind).toBe('browser');
  expect(devices[0]?.checked).toBe(true);
  expect(devices[1]?.checked).toBe(false);
  const none = render({
    screen: 'calling',
    mode: 'inbound',
    compact: false,
    answeringEndpointIds: [],
  });
  expect(
    none.querySelector<HTMLButtonElement>('[data-action=inbound-readiness]')
      ?.disabled,
  ).toBe(true);
  expect(
    doc
      .querySelector('[data-action=workspace-queue-details]')!
      .compareDocumentPosition(
        doc.querySelector('[data-action=inbound-readiness]')!,
      ),
  ).toBe(4);
});
it('uses a single destination chooser without duplicate phone/source forms', () => {
  const s = rep();
  s.setup.mode = 'single';
  const doc = render(
    { screen: 'calling', mode: 'outbound', compact: false },
    s,
  );
  expect(doc.querySelector('[data-field=target-query]')).not.toBeNull();
  expect(
    doc.querySelector(
      '[data-field=single-phone],.single-contact-list,[data-action=select-single-number]',
    ),
  ).toBeNull();
});
it('keeps mode valid for Starter and lets local presence own source selection', () => {
  let s = rep();
  s = {
    ...s,
    commercialCaller: {
      planCode: 'standard',
      trial: true,
      callerIds: ['+15550100123'],
      connectedMinutes: 0,
      remainingMinutes: 100,
      lineOptions: [1],
      predictive: false,
      recordings: false,
      transcripts: false,
      canStartCall: true,
      denialCode: null,
      billing: { state: 'trial', graceEndsAt: null },
    },
  } as typeof s;
  s = reduceEmbedState(s, {
    type: 'SETUP_CHANGED',
    setup: {
      mode: 'queue',
      callingMode: 'predictive',
      callerIdNumber: '+15550100123',
      preferLocalPresence: true,
    },
  }) as typeof s;
  expect(s.setup.callingMode).toBe('single');
  expect(s.setup.callerIdNumber).toBeNull();
  const doc = render(
    { screen: 'call-options', mode: 'outbound', compact: false },
    s,
  );
  expect(doc.body.textContent).toContain('Call from');
  expect(doc.body.textContent).toContain('Sequential dialing');
  expect(
    doc.querySelector<HTMLButtonElement>(
      '[data-combobox-field=caller-id] [role=combobox]',
    )?.disabled,
  ).toBe(true);
});
it('orders settings around the rep workflow', () => {
  const doc = render({ screen: 'settings', mode: 'inbound', compact: false });
  expect(
    [...doc.querySelectorAll('.navigation-row')].map(
      (e) => (e as HTMLElement).dataset.action,
    ),
  ).toEqual([
    'workspace-numbers',
    'workspace-mercury',
    'workspace-team',
    'workspace-billing',
    'workspace-appearance',
  ]);
});
it('persists only safe view preferences, scopes them and expires after eight hours', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
  };
  const workspace = {
    screen: 'settings' as const,
    mode: 'outbound' as const,
    compact: true,
    scriptDraft: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Private',
      expectedRevision: 0,
      content: 'private',
    },
    sessionToken: 'secret',
  };
  writeWorkspacePreferences(storage, 'location:rep', workspace, 'single', 1000);
  const saved = readWorkspacePreferences(storage, 'location:rep', 2000)!;
  expect(saved.screen).toBe('settings');
  expect(saved.mode).toBe('outbound');
  expect(saved.setupMode).toBe('single');
  expect([...values.values()].join()).not.toMatch(
    /secret|private|scriptDraft|sessionToken|compact/,
  );
  expect(readWorkspacePreferences(storage, 'other:rep', 2000)).toBeNull();
  expect(
    readWorkspacePreferences(
      storage,
      'location:rep',
      1000 + 8 * 60 * 60 * 1000 + 1,
    ),
  ).toBeNull();
});
it('combines existing contacts and typed destination numbers without auto calling', () => {
  const contacts = [
    {
      id: 'c',
      name: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+15550100123',
      email: null,
      tags: [],
    },
  ];
  expect(targetChoices(contacts, 'Ada')[0]?.name).toBe('Ada Lovelace');
  expect(targetChoices(contacts, '5550100124')[0]).toMatchObject({
    phone: '+15550100124',
    contactId: null,
  });
  expect(targetChoices(contacts, '5550100123')).toHaveLength(1);
});

it('prioritizes a matching known contact even beyond the first seven numeric suggestions', () => {
  const query = '5550100123';
  const contacts = Array.from({ length: 8 }, (_, i) => ({
    id: 'contact-' + i,
    name: i === 7 ? 'Exact Contact' : query + ' Search ' + i,
    firstName: i === 7 ? 'Exact' : 'Other',
    lastName: 'Contact',
    phone: i === 7 ? '+15550100123' : '+1555010200' + i,
    email: null,
    tags: [],
  }));
  const choices = targetChoices(contacts, query);
  expect(choices[0]).toMatchObject({ phone: '+15550100123', contactId: 'contact-7' });
  expect(choices.filter((c) => c.dedupeKey.endsWith(':+15550100123'))).toHaveLength(1);
});
