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

  it('provides connected-call warm and cold transfer controls in the overlay', () => {
    const html = renderLeadConnectorEmbed({
      ...commercialState(),
      phase: 'connected',
      callSession: {
        groupId: 'group-one',
        status: 'connected',
        winnerSid: 'call-one',
        winner: null,
        calls: [],
      },
    }, { surface: 'overlay' });

    expect(html).toContain('data-action="warm-transfer"');
    expect(html).toContain('data-action="cold-transfer"');
    expect(html).toContain('data-action="complete-transfer"');
    expect(html).toContain('data-action="cancel-transfer"');
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
