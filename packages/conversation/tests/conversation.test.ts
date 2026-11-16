import { describe, expect, test } from 'bun:test';
import {
  createTimeline,
  reduceTimeline,
  replayTimeline,
  validateTranscriptEvent,
  validatePlaybook,
  createCardState,
  reduceCard,
  advanceCardWorker,
  admitCapability,
  VirtualClock,
  LIMITS,
  type TranscriptEvent,
  type TranscriptSegmentEvent,
  type CardPatch,
  type AssistancePolicy,
  type ConversationScope,
} from '../src/index.ts';

const scope: ConversationScope = {
  workspaceId: 'workspace-a',
  callSessionId: 'call-a',
  callGeneration: 1,
};
const binding = {
  participantId: 'person-a',
  legId: 'leg-a',
  role: 'customer',
  provenance: 'authenticated-leg',
  bindingRevision: 1,
} as const;
const speaker = {
  role: binding.role,
  provenance: binding.provenance,
  bindingRevision: 1,
} as const;
const segment = (
  overrides: Partial<TranscriptSegmentEvent> = {},
): TranscriptSegmentEvent => ({
  schemaVersion: 1,
  kind: 'segment',
  eventId: 'event-1',
  scope,
  cursor: { sequence: 1, epoch: 0 },
  observedAtMs: 1000,
  source: { adapter: 'fixture', modelVersion: 'frozen-v1' },
  segmentId: 'segment-1',
  segmentRevision: 1,
  participantId: binding.participantId,
  legId: binding.legId,
  speaker,
  audioStartMs: 0,
  audioEndMs: 900,
  text: 'I have existing coverage.',
  finality: 'final',
  ...overrides,
});
const timeline = () => createTimeline(scope, [binding]);
const accepted = () => reduceTimeline(timeline(), segment()).state;
const policy: AssistancePolicy = {
  scope,
  memberId: 'rep-a',
  revision: 1,
  validUntilMs: 10000,
  revoked: false,
  capabilities: ['manual-reference', 'live-transcription', 'live-coaching'],
  consent: {
    ephemeralTranscription: true,
    retainedTranscript: false,
    aiGeneration: false,
  },
};
const playbookInput = {
  schemaVersion: 1,
  workspaceId: scope.workspaceId,
  playbookId: 'life',
  publishedVersion: 'script-v1',
  industryPackVersion: 'life-v1',
  companyPolicyVersion: 'company-v1',
  cards: [
    {
      id: 'coverage',
      title: 'Existing coverage',
      slots: [
        {
          id: 'type',
          text: 'Ask about existing coverage',
          source: {
            documentId: 'approved-source',
            revision: '1',
            excerpt: 'What coverage do you have?',
          },
        },
        {
          id: 'amount',
          text: 'Confirm the coverage amount',
          source: {
            documentId: 'approved-source',
            revision: '1',
            excerpt: 'How much coverage?',
          },
        },
        {
          id: 'family',
          text: 'Ask who it protects',
          source: {
            documentId: 'approved-source',
            revision: '1',
            excerpt: 'Who does it protect?',
          },
        },
      ],
    },
  ],
};
const playbook = () => {
  const result = validatePlaybook(playbookInput);
  if (!result.ok) throw new Error(result.reason);
  return result.value;
};
const card = () => createCardState(scope, playbook(), 1);
const patch = (overrides: Partial<CardPatch> = {}): CardPatch => ({
  schemaVersion: 1,
  patchId: 'patch-1',
  scope,
  baseCardRevision: 0,
  transcriptCursor: { sequence: 1, epoch: 0 },
  workerGeneration: 1,
  policyRevision: 1,
  publishedScriptVersion: 'script-v1',
  cardId: 'coverage',
  source: 'rules',
  sourceVersion: 'rules-v1',
  changedSlots: [
    { position: 0, approvedSlotId: 'type' },
    { position: 1, approvedSlotId: 'amount' },
    { position: 2, approvedSlotId: 'family' },
  ],
  evidence: [{ segmentId: 'segment-1', segmentRevision: 1 }],
  issuedAtMs: 1000,
  expiresAtMs: 2000,
  ...overrides,
});
const context = () => ({
  timeline: accepted(),
  policy,
  nowMs: 1200,
  sourceVersions: {
    manual: 'manual-v1',
    rules: 'rules-v1',
    selector: 'selector-v1',
  },
});

describe('authenticated deterministic timeline', () => {
  test('replay is immutable, idempotent and never concatenates revisions', () => {
    const first = segment({ finality: 'interim' });
    const second = segment({
      eventId: 'event-2',
      cursor: { sequence: 2, epoch: 0 },
      segmentRevision: 2,
      text: 'Existing term coverage.',
    });
    const initial = timeline();
    const replay = replayTimeline(initial, [first, first, second]);
    expect(replay.results.map((r) => r.status)).toEqual([
      'applied',
      'duplicate',
      'applied',
    ]);
    expect(replay.state.segments['segment-1']?.text).toBe(
      'Existing term coverage.',
    );
    expect(initial.cursor.sequence).toBe(0);
    (first as { text: string }).text = 'mutated adapter buffer';
    expect(
      replay.state.events[0]?.kind === 'segment' && replay.state.events[0].text,
    ).toBe('I have existing coverage.');
    expect(Object.isFrozen(replay.state.segments)).toBe(true);
  });
  test.each([
    ['workspace', { scope: { ...scope, workspaceId: 'foreign' } }],
    ['call', { scope: { ...scope, callSessionId: 'foreign' } }],
    ['generation', { scope: { ...scope, callGeneration: 2 } }],
    ['participant', { participantId: 'foreign' }],
    ['leg', { legId: 'foreign' }],
    [
      'track is not role',
      {
        speaker: {
          role: 'rep',
          provenance: 'authenticated-leg',
          bindingRevision: 1,
        },
      },
    ],
    ['cursor gap', { cursor: { sequence: 2, epoch: 0 } }],
    ['epoch jump', { cursor: { sequence: 1, epoch: 1 } }],
  ])('rejects %s', (_, value) => {
    const initial = timeline();
    const result = reduceTimeline(
      initial,
      segment(value as Partial<TranscriptSegmentEvent>),
    );
    expect(result.status).toBe('rejected');
    expect(result.state).toBe(initial);
  });
  test('duplicate identity with different content and stale sequences are rejected', () => {
    const state = accepted();
    expect(reduceTimeline(state, segment({ text: 'different' })).status).toBe(
      'rejected',
    );
    expect(reduceTimeline(state, segment({ eventId: 'other' })).status).toBe(
      'rejected',
    );
  });
  test('final cannot reopen, revisions cannot jump or change participant/time start', () => {
    const state = accepted();
    for (const change of [
      { segmentRevision: 2 },
      { segmentRevision: 4 },
      { segmentRevision: 2, finality: 'interim' },
      { segmentRevision: 2, audioStartMs: 20 },
    ]) {
      expect(
        reduceTimeline(
          state,
          segment({
            ...change,
            eventId: 'event-2',
            cursor: { sequence: 2, epoch: 0 },
          } as Partial<TranscriptSegmentEvent>),
        ).status,
      ).toBe('rejected');
    }
  });
  test('explicit gaps and reconnect epochs survive replay; missing audio is not silence', () => {
    const gap: TranscriptEvent = {
      schemaVersion: 1,
      kind: 'gap',
      eventId: 'gap',
      scope,
      cursor: { sequence: 2, epoch: 0 },
      observedAtMs: 1100,
      source: { adapter: 'fixture' },
      audioStartMs: 900,
      audioEndMs: 1200,
      reason: 'missing-audio',
    };
    const reconnect: TranscriptEvent = {
      schemaVersion: 1,
      kind: 'reconnected',
      eventId: 'reconnect',
      scope,
      cursor: { sequence: 3, epoch: 1 },
      observedAtMs: 1300,
      source: { adapter: 'fixture' },
    };
    const result = replayTimeline(timeline(), [
      segment(),
      gap,
      reconnect,
      segment({
        eventId: 'event-4',
        segmentId: 'segment-2',
        cursor: { sequence: 4, epoch: 1 },
        audioStartMs: 1200,
        audioEndMs: 1400,
      }),
    ]);
    expect(result.results.every((r) => r.status === 'applied')).toBe(true);
    expect(result.state.gaps).toHaveLength(1);
    expect(result.state.cursor).toEqual({ sequence: 4, epoch: 1 });
  });
  test.each(['ended', 'revoked', 'deleted'] as const)(
    '%s rejects late results and preserves tombstone',
    (kind) => {
      const terminal: TranscriptEvent = {
        schemaVersion: 1,
        kind,
        eventId: kind,
        scope,
        cursor: { sequence: 2, epoch: 0 },
        observedAtMs: 1500,
        source: { adapter: 'fixture' },
      };
      const state = reduceTimeline(accepted(), terminal).state;
      expect(state.status).toBe(kind);
      expect(
        reduceTimeline(
          state,
          segment({
            eventId: 'late',
            cursor: { sequence: 3, epoch: 0 },
            segmentId: 'late',
          }),
        ).status,
      ).toBe('rejected');
      if (kind === 'deleted') {
        expect(Object.keys(state.segments)).toHaveLength(0);
        expect(state.events).toHaveLength(0);
      }
    },
  );
  test.each([
    null,
    {},
    { ...segment(), schemaVersion: 2 },
    { ...segment(), text: 'x'.repeat(LIMITS.textLength + 1) },
    { ...segment(), audioEndMs: -1 },
    { ...segment(), observedAtMs: NaN },
    { ...segment(), cursor: { epoch: 0, sequence: 1.5 } },
    { ...segment(), speaker: null },
  ])('rejects malformed payload %#', (value) => {
    expect(validateTranscriptEvent(value).ok).toBe(false);
    expect(reduceTimeline(timeline(), value).status).toBe('rejected');
  });
  test('explicit unknown role is accepted only against unknown authenticated binding', () => {
    const unknown = {
      ...binding,
      role: 'unknown',
      provenance: 'unknown',
    } as const;
    const state = createTimeline(scope, [unknown]);
    expect(
      reduceTimeline(
        state,
        segment({
          speaker: {
            role: 'unknown',
            provenance: 'unknown',
            bindingRevision: 1,
          },
        }),
      ).status,
    ).toBe('applied');
  });
});

describe('approved cards and policy fences', () => {
  test('applies approved slots, freezes published source, and no-change emits nothing', () => {
    const published = playbook();
    expect(Object.isFrozen(published.cards[0]?.slots[0]?.source)).toBe(true);
    const result = reduceCard(card(), patch(), context());
    expect(result.status).toBe('applied');
    expect(result.state.revision).toBe(1);
    expect(result.state.slots).toEqual(['type', 'amount', 'family']);
    expect(
      reduceCard(
        result.state,
        patch({ patchId: 'patch-2', baseCardRevision: 1 }),
        context(),
      ).status,
    ).toBe('unchanged');
  });
  test.each([
    ['stale card', { baseCardRevision: 1 }],
    ['foreign call', { scope: { ...scope, callSessionId: 'other' } }],
    ['worker fence', { workerGeneration: 2 }],
    ['policy fence', { policyRevision: 2 }],
    ['script version', { publishedScriptVersion: 'other' }],
    ['expired', { expiresAtMs: 1200 }],
    ['future', { issuedAtMs: 1500 }],
    ['cursor', { transcriptCursor: { sequence: 0, epoch: 0 } }],
    [
      'invented slot',
      { changedSlots: [{ position: 0, approvedSlotId: 'invented free text' }] },
    ],
    ['missing evidence', { evidence: [] }],
    [
      'foreign evidence',
      { evidence: [{ segmentId: 'foreign', segmentRevision: 1 }] },
    ],
    [
      'stale evidence',
      { evidence: [{ segmentId: 'segment-1', segmentRevision: 2 }] },
    ],
  ])('rejects %s', (_, value) => {
    const initial = card();
    const result = reduceCard(
      initial,
      patch(value as Partial<CardPatch>),
      context(),
    );
    expect(result.status).toBe('rejected');
    expect(result.state).toBe(initial);
  });
  test('manual reference works without capture consent and a pin blocks automation', () => {
    const noCapture = {
      ...policy,
      capabilities: ['manual-reference'] as const,
      consent: { ...policy.consent, ephemeralTranscription: false },
    };
    const manual = patch({
      source: 'manual',
      sourceVersion: 'manual-v1',
      evidence: [],
      pin: true,
      transcriptCursor: { sequence: 0, epoch: 0 },
    });
    const state = reduceCard(card(), manual, {
      ...context(),
      timeline: timeline(),
      policy: noCapture,
    }).state;
    expect(state.pinned).toBe(true);
    expect(
      reduceCard(state, patch({ baseCardRevision: 1 }), context()).status,
    ).toBe('rejected');
  });
  test('worker restart and call termination cancel old work', () => {
    const next = advanceCardWorker(card(), 2);
    expect(reduceCard(next, patch(), context()).status).toBe('rejected');
    const ended = reduceTimeline(accepted(), {
      schemaVersion: 1,
      kind: 'ended',
      eventId: 'end',
      scope,
      cursor: { sequence: 2, epoch: 0 },
      observedAtMs: 1400,
      source: { adapter: 'fixture' },
    }).state;
    expect(
      reduceCard(card(), patch(), { ...context(), timeline: ended }).status,
    ).toBe('rejected');
  });
  test('independent grants do not silently enable capture, retention or generation', () => {
    expect(
      admitCapability(policy, scope, 'manual-reference', 1200).allowed,
    ).toBe(true);
    expect(admitCapability(policy, scope, 'live-coaching', 1200).allowed).toBe(
      true,
    );
    for (const capability of [
      'retain-transcript',
      'review-upload',
      'ai-generation',
    ] as const)
      expect(admitCapability(policy, scope, capability, 1200).allowed).toBe(
        false,
      );
    expect(
      admitCapability(
        {
          ...policy,
          consent: { ...policy.consent, ephemeralTranscription: false },
        },
        scope,
        'live-coaching',
        1200,
      ).allowed,
    ).toBe(false);
    for (const denied of [
      { ...policy, revoked: true },
      { ...policy, validUntilMs: 1200 },
      { ...policy, scope: { ...scope, workspaceId: 'foreign' } },
    ]) {
      expect(
        admitCapability(denied, scope, 'manual-reference', 1200).allowed,
      ).toBe(false);
      expect(
        reduceCard(card(), patch(), { ...context(), policy: denied }).status,
      ).toBe('rejected');
    }
  });
  test('malformed playbooks and patches fail closed', () => {
    expect(
      validatePlaybook({
        ...playbookInput,
        cards: [{ ...playbookInput.cards[0], slots: [] }],
      }).ok,
    ).toBe(false);
    for (const value of [
      null,
      {},
      { ...patch(), changedSlots: null },
      { ...patch(), evidence: [null] },
      { ...patch(), source: 'model-text' },
    ])
      expect(reduceCard(card(), value, context()).status).toBe('rejected');
  });
  test('virtual clock is monotonic and expiry boundary deterministic', () => {
    const clock = new VirtualClock(1000);
    clock.advanceTo(1999);
    expect(
      reduceCard(card(), patch(), { ...context(), nowMs: clock.nowMs() })
        .status,
    ).toBe('applied');
    clock.advanceTo(2000);
    expect(
      reduceCard(card(), patch(), { ...context(), nowMs: clock.nowMs() })
        .status,
    ).toBe('rejected');
    expect(() => clock.advanceTo(1999)).toThrow();
  });
});

describe('capacity, cancellation and lifecycle boundaries', () => {
  test('capacity rejects data but always admits authoritative end/revoke/delete', () => {
    const full = {
      ...accepted(),
      events: Array.from({ length: LIMITS.events }, () => segment()),
    };
    expect(
      reduceTimeline(
        full,
        segment({
          eventId: 'overflow',
          segmentId: 'new',
          cursor: { sequence: 2, epoch: 0 },
        }),
      ).status,
    ).toBe('rejected');
    for (const kind of ['ended', 'revoked', 'deleted'] as const) {
      const result = reduceTimeline(full, {
        schemaVersion: 1,
        kind,
        eventId: kind,
        scope,
        cursor: { sequence: 2, epoch: 0 },
        observedAtMs: 1600,
        source: { adapter: 'fixture' },
      });
      expect(result.status).toBe('applied');
      expect(result.state.status).toBe(kind);
    }
  });
  test('segment capacity, prototype identities and conflicting bindings fail closed', () => {
    const full = {
      ...timeline(),
      segments: Object.fromEntries(
        Array.from({ length: LIMITS.segments }, (_, i) => [
          's' + i,
          segment({ segmentId: 's' + i }),
        ]),
      ),
    };
    expect(reduceTimeline(full, segment()).status).toBe('rejected');
    expect(
      reduceTimeline(timeline(), segment({ segmentId: '__proto__' })).status,
    ).toBe('rejected');
    expect(() =>
      createTimeline(scope, [
        binding,
        { ...binding, participantId: 'rep', role: 'rep' },
      ]),
    ).toThrow();
  });
  test('aborted, interim, foreign and unknown-field card results cannot commit', () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      reduceCard(card(), patch(), { ...context(), signal: controller.signal })
        .status,
    ).toBe('rejected');
    const interim = reduceTimeline(
      timeline(),
      segment({ finality: 'interim' }),
    ).state;
    expect(
      reduceCard(card(), patch(), { ...context(), timeline: interim }).status,
    ).toBe('rejected');
    expect(
      reduceCard(card(), patch(), {
        ...context(),
        timeline: createTimeline({ ...scope, callGeneration: 2 }, [binding]),
      }).status,
    ).toBe('rejected');
    expect(
      reduceCard(
        card(),
        { ...patch(), freeText: 'unapproved advice' },
        context(),
      ).status,
    ).toBe('rejected');
    expect(
      reduceCard(
        card(),
        patch({
          changedSlots: [
            { position: 0, approvedSlotId: 'type' },
            { position: 0, approvedSlotId: 'amount' },
          ],
        }),
        context(),
      ).status,
    ).toBe('rejected');
  });
  test('deleted tombstone can follow end and old scope cannot resume a later call', () => {
    const ended = reduceTimeline(accepted(), {
      schemaVersion: 1,
      kind: 'ended',
      eventId: 'end',
      scope,
      cursor: { sequence: 2, epoch: 0 },
      observedAtMs: 1200,
      source: { adapter: 'fixture' },
    }).state;
    const deleted = reduceTimeline(ended, {
      schemaVersion: 1,
      kind: 'deleted',
      eventId: 'delete',
      scope,
      cursor: { sequence: 3, epoch: 0 },
      observedAtMs: 1300,
      source: { adapter: 'fixture' },
    }).state;
    expect(deleted.status).toBe('deleted');
    expect(deleted.events).toHaveLength(0);
    expect(
      reduceTimeline(
        createTimeline({ ...scope, callGeneration: 2 }, [binding]),
        segment(),
      ).status,
    ).toBe('rejected');
  });
});

test('card source revision must match the host-pinned origin revision', () => {
  expect(
    reduceCard(card(), patch({ sourceVersion: 'unevaluated-v2' }), {
      ...context(),
      sourceVersions: {
        manual: 'manual-v1',
        rules: 'rules-v1',
        selector: 'selector-v1',
      },
    }).status,
  ).toBe('rejected');
});
