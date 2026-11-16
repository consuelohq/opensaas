import { describe, expect, it } from 'bun:test';
import { JSDOM } from 'jsdom';
import { createInitialEmbedState } from './state-machine';
import { renderLeadConnectorEmbed } from './view';
import { renderMercuryCue, connectedTimer } from './mercury-call';
import { replaceWorkspace } from './workspace-dom';
import type { CallingWorkspace } from './calling-workspace';
import type { MercuryCueView } from './mercury-cues';

const workspace: CallingWorkspace = {
  screen: 'calling',
  mode: 'outbound',
  compact: false,
  coachingMode: 'script',
  activeScriptId: 'manual',
  coachingLibrary: {
    scripts: [
      {
        id: 'manual',
        title: 'Life insurance',
        content:
          '# Opening\nAsk about family.\nAsk about existing coverage.\nAsk about priorities.',
        revision: 1,
        updatedAt: '',
        canEdit: true,
      },
    ],
  },
};
const card: MercuryCueView = {
  scopeKey: 'outbound:call-a',
  revision: 1,
  heading: 'Family priorities',
  kind: 'approved',
  status: 'live',
  points: [
    'Ask about family',
    'Review existing coverage',
    'Check their priorities',
  ].map((text, i) => ({
    slotId: String(i),
    text,
    exact: text + '?',
    source: 'Approved team playbook · v1',
  })),
};
describe('stable Mercury on-call view', () => {
  it('labels legacy material as manual and keeps AI disabled', () => {
    const doc = new JSDOM(renderMercuryCue(workspace, 'outbound:call-a')).window
      .document;
    expect(doc.body.textContent).toContain('Manual script');
    expect(
      doc.querySelector('[data-mode="ai"]')?.hasAttribute('disabled'),
    ).toBe(true);
    expect(doc.querySelectorAll('[data-cue-slot]')).toHaveLength(4);
    expect(doc.body.textContent).not.toContain('Approved points');
  });
  it('never paints a different call card and escapes source text', () => {
    const html = renderMercuryCue(
      {
        ...workspace,
        mercuryCard: { ...card, scopeKey: 'old-call', heading: 'STALE' },
      },
      'outbound:call-a',
    );
    expect(html).not.toContain('STALE');
    const safe = renderMercuryCue(
      {
        ...workspace,
        mercuryCard: {
          ...card,
          points: [
            {
              slotId: 'x',
              text: '<script>bad</script>',
              exact: '<b>literal</b>',
              source: '<img>',
            },
          ],
        },
      },
      card.scopeKey,
    );
    expect(safe).toContain('&lt;script&gt;');
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('Source &amp; exact wording');
  });
  it('updates only changed points and preserves selected text, source disclosure and scroll', () => {
    const dom = new JSDOM('<div id="app"></div>');
    const root = dom.window.document.querySelector<HTMLElement>('#app')!;
    const page = (view: MercuryCueView) =>
      '<main data-workspace data-workspace-screen="calling"><div class="workspace-content">' +
      renderMercuryCue({ ...workspace, mercuryCard: view }, card.scopeKey) +
      '</div></main>';
    replaceWorkspace(root, page(card));
    const first = root.querySelector('[data-cue-slot="0"]')!;
    const second = root.querySelector('[data-cue-slot="1"]')!;
    const range = dom.window.document.createRange();
    range.selectNodeContents(first);
    dom.window.getSelection()!.addRange(range);
    root.querySelector<HTMLDetailsElement>(
      '[data-disclosure="mercury-source"]',
    )!.open = true;
    root.querySelector<HTMLElement>('.workspace-content')!.scrollTop = 92;
    replaceWorkspace(
      root,
      page({
        ...card,
        revision: 2,
        points: card.points.map((p, i) =>
          i === 1 ? { ...p, text: 'Ask who needs protection' } : p,
        ),
      }),
    );
    expect(root.querySelector('[data-cue-slot="0"]')).toBe(first);
    expect(root.querySelector('[data-cue-slot="1"]')).not.toBe(second);
    expect(
      root
        .querySelector('[data-cue-slot="1"]')
        ?.hasAttribute('data-cue-changed'),
    ).toBe(true);
    expect(dom.window.getSelection()?.toString()).toBe('Ask about family');
    expect(
      root.querySelector<HTMLDetailsElement>(
        '[data-disclosure="mercury-source"]',
      )?.open,
    ).toBe(true);
    expect(
      root.querySelector<HTMLElement>('.workspace-content')?.scrollTop,
    ).toBe(92);
  });
  it('uses only confirmed timestamps for elapsed time', () => {
    expect(
      connectedTimer(
        'connecting',
        '2026-11-13T12:00:00Z',
        Date.parse('2026-11-13T12:00:30Z'),
      ),
    ).toBe('—');
    expect(connectedTimer('connected', null, Date.now())).toBe('—');
    expect(
      connectedTimer(
        'connected',
        '2026-11-13T12:00:00Z',
        Date.parse('2026-11-13T12:01:05Z'),
      ),
    ).toBe('1:05');
  });
  it('keeps End call available in the compact outbound bar without creating media', () => {
    const state = {
      ...createInitialEmbedState(),
      phase: 'connected' as const,
      activeSessionId: 'call-a',
      callSession: {
        groupId: 'call-a',
        status: 'connected',
        winnerSid: 'leg',
        winner: null,
        calls: [],
      },
    };
    const doc = new JSDOM(
      renderLeadConnectorEmbed(state, {
        surface: 'overlay',
        workspace: { ...workspace, compact: true },
      }),
    ).window.document;
    expect(doc.querySelector('[data-action="hang-up"]')?.textContent).toContain(
      'End',
    );
    expect(
      doc.querySelector('[data-action="workspace-expand"]'),
    ).not.toBeNull();
    expect(doc.querySelector('[data-call-timer]')?.textContent).toBe('—');
  });
});

it('keeps End recovery available when coaching or session refresh fails for an active caller', () => {
  const state = {
    ...createInitialEmbedState(),
    phase: 'failed' as const,
    activeSessionId: 'call-a',
    error: {
      code: 'REQUEST_FAILED',
      message: 'Connection check unavailable',
      recoverable: true,
    },
    callSession: {
      groupId: 'call-a',
      status: 'connected',
      winnerSid: 'leg',
      winner: null,
      calls: [],
    },
  };
  const doc = new JSDOM(
    renderLeadConnectorEmbed(state, { surface: 'overlay', workspace }),
  ).window.document;
  expect(doc.querySelector('[data-action="hang-up"]')?.textContent).toContain(
    'End',
  );
  expect(doc.querySelector('[data-action="start-configured"]')).toBeNull();
  expect(doc.querySelector('[data-session-status]')?.textContent).toContain(
    'Reconnecting',
  );
});

it('does not replay a previously changed point fade on unchanged polling snapshots', () => {
  const root = new JSDOM(
    '<div id="app"></div>',
  ).window.document.querySelector<HTMLElement>('#app')!;
  const page = (view: MercuryCueView) =>
    renderMercuryCue({ ...workspace, mercuryCard: view }, card.scopeKey);
  replaceWorkspace(root, page(card));
  const update = {
    ...card,
    revision: 2,
    points: card.points.map((p, i) =>
      i === 1 ? { ...p, text: 'A changed point' } : p,
    ),
  };
  replaceWorkspace(root, page(update));
  expect(root.querySelectorAll('[data-cue-changed]')).toHaveLength(1);
  replaceWorkspace(root, page(update));
  expect(root.querySelectorAll('[data-cue-changed]')).toHaveLength(0);
});

it('labels a published but manual-only server feed as reference rather than live coaching', () => {
  const doc = new JSDOM(
    renderMercuryCue(
      {
        ...workspace,
        mercuryRemote: true,
        mercuryCard: { ...card, status: 'manual' },
      },
      card.scopeKey,
    ),
  ).window.document;
  expect(doc.querySelector('.mercury-cue-status')?.textContent).toContain(
    'Manual reference',
  );
  expect(
    doc.querySelector('[data-action="script-next"]')?.hasAttribute('disabled'),
  ).toBe(false);
  const waiting = new JSDOM(
    renderMercuryCue(
      { ...workspace, mercuryFeedStatus: 'unavailable' },
      card.scopeKey,
    ),
  ).window.document;
  expect(waiting.querySelector('.mercury-cue-status')?.textContent).toContain(
    'Live assistance unavailable',
  );
});

it('retains the offered customer context only for the same inbound assignment generation', async () => {
  const { mercuryCallScope, observeMercuryCaller, renderCallIdentity } =
    await import('./mercury-call');
  const state = createInitialEmbedState();
  state.inboundOperator.offers = [
    {
      assignmentId: 'a',
      requestId: 'r',
      generation: 1,
      queueId: 'q',
      queueName: 'Life insurance',
      callerLabel: 'Jordan Taylor',
      waitingSeconds: 0,
      offerExpiresAt: '2026-11-13T12:00:00Z',
      ownerRepId: 'rep',
      eligibleEndpoints: ['web'],
    },
  ];
  const ws: CallingWorkspace = {
    screen: 'calling',
    mode: 'inbound',
    compact: false,
  };
  ws.mercuryScope = mercuryCallScope(state, 'inbound') ?? undefined;
  observeMercuryCaller(ws, state);
  state.inboundOperator.offers = [];
  state.inboundOperator.rep.assignment = {
    assignmentId: 'a',
    requestId: 'r',
    generation: 1,
    phase: 'connected',
    offerExpiresAt: null,
    endpointId: 'web',
    externalStarted: true,
    connectedAt: '2026-11-13T12:00:00Z',
    unknownSince: null,
    wrapUpUntil: null,
  };
  expect(renderCallIdentity(state, ws)).toContain('Jordan Taylor');
  expect(renderCallIdentity(state, ws)).toContain('Life insurance');
  state.inboundOperator.rep.assignment = {
    ...state.inboundOperator.rep.assignment,
    assignmentId: 'b',
    generation: 2,
  };
  expect(renderCallIdentity(state, ws)).not.toContain('Jordan Taylor');
});

it('does not claim server coaching stopped when admission ownership is unknown', () => {
  const doc = new JSDOM(
    renderMercuryCue(
      { ...workspace, coachingMode: 'off', mercuryFeedStatus: 'unknown' },
      card.scopeKey,
    ),
  ).window.document;
  expect(doc.querySelector('.mercury-cue-status')?.textContent).toContain(
    'Assistance status unknown',
  );
  expect(doc.querySelector('.mercury-cue-status')?.textContent).not.toContain(
    'Coaching off',
  );
});
