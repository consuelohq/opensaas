import { describe, expect, test } from 'bun:test';
import { compilePlaybook } from './playbooks';
import {
  createClosedSetSelector,
  createScriptSession,
  type ScriptSessionOptions,
} from './script-engine';
import { createContextScheduler } from './context-scheduler';
import type {
  AssistancePolicy,
  TranscriptEvent,
  TranscriptSegmentEvent,
} from '@consuelo/conversation';

const scope = { workspaceId: 'w', callSessionId: 'call', callGeneration: 1 };
const participant = {
  participantId: 'customer',
  legId: 'leg',
  role: 'customer',
  provenance: 'authenticated-leg',
  bindingRevision: 1,
} as const;
const compiled = compilePlaybook({
  workspaceId: 'w',
  scriptId: 'script',
  sourceRevision: 2,
  version: 3,
  title: 'Approved example',
  industryPackVersion: 'industry-v1',
  companyPolicyVersion: 'policy-v1',
  content:
    '# Opening\n- Opening one\n- Opening two\n- Opening three\n# Topic\n- Topic one\n- Topic two\n- Topic three\n# Manual\n- Manual one\n- Manual two\n- Manual three',
  rules: [
    { cardId: 'opening', aliases: ['opening trigger'], priority: 1 },
    { cardId: 'topic', aliases: ['topic trigger'], priority: 10 },
    { cardId: 'manual', aliases: [], priority: 100 },
  ],
});
const policy: AssistancePolicy = {
  scope,
  memberId: 'rep',
  revision: 1,
  validUntilMs: 1000000,
  revoked: false,
  capabilities: ['manual-reference', 'live-transcription', 'live-coaching'],
  consent: {
    ephemeralTranscription: true,
    retainedTranscript: false,
    aiGeneration: false,
  },
};
const event = (
  text: string,
  sequence = 1,
  overrides: Partial<TranscriptSegmentEvent> = {},
): TranscriptSegmentEvent => ({
  schemaVersion: 1,
  kind: 'segment',
  eventId: 'e' + sequence,
  scope,
  cursor: { sequence, epoch: 0 },
  observedAtMs: sequence * 1000,
  source: { adapter: 'mock' },
  segmentId: 's' + sequence,
  segmentRevision: 1,
  participantId: 'customer',
  legId: 'leg',
  speaker: {
    role: 'customer',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  },
  audioStartMs: sequence * 1000,
  audioEndMs: sequence * 1000 + 100,
  text,
  finality: 'final',
  ...overrides,
});
const selector = (run: Parameters<typeof createClosedSetSelector>[0]['run']) =>
  createClosedSetSelector({
    providerRevision: 'mock',
    modelRevision: 'pinned-v1',
    structuredOutput: true,
    run,
  });
const session = (extra: Partial<ScriptSessionOptions> = {}) =>
  createScriptSession({
    scope,
    participants: [participant],
    compiled,
    policy,
    nowMs: () => 1000,
    scheduler: createContextScheduler(),
    minimumDwellMs: 0,
    contextIntervalMs: 0,
    ...extra,
  });
const selection = (segmentId = 's1', segmentRevision = 1) => ({
  cardId: 'topic',
  slotIds: ['topic-1', 'topic-2', 'topic-3'],
  evidence: [{ segmentId, segmentRevision }],
});
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const interruption = (kind: 'gap' | 'reconnected'): TranscriptEvent => {
  const common = {
    schemaVersion: 1 as const,
    eventId: 'interruption',
    scope,
    cursor: { sequence: 2, epoch: kind === 'reconnected' ? 1 : 0 },
    observedAtMs: 2000,
    source: { adapter: 'mock' },
  };
  return kind === 'gap'
    ? {
        ...common,
        kind,
        audioStartMs: 1000,
        audioEndMs: 2000,
        reason: 'missing-audio',
      }
    : { ...common, kind };
};

describe('transcript interruption recovery', () => {
  test.each(['gap', 'reconnected'] as const)(
    'a trusted final clears %s without changing an existing approved cue',
    async (kind) => {
      for (const text of [
        'opening trigger',
        'The conversation continues without a rule match',
      ]) {
        let decisions = 0;
        const statuses: string[] = [];
        const s = session({
          minimumDwellMs: 1500,
          onDecision: () => decisions++,
          onChange: (view) => statuses.push(view.status),
        });
        try {
          await s.ingest(event('opening trigger'));
          const first = s.decision();
          expect(s.view('call')).toMatchObject({
            kind: 'approved',
            status: 'live',
          });
          expect((await s.ingest(interruption(kind))).status).toBe('applied');
          expect(s.view('call').status).toBe(
            kind === 'gap' ? 'delayed' : 'reconnecting',
          );
          expect(
            (
              await s.ingest(
                event(text, 3, {
                  cursor: {
                    sequence: 3,
                    epoch: kind === 'reconnected' ? 1 : 0,
                  },
                }),
              )
            ).status,
          ).toBe('applied');
          expect(statuses.at(-1)).toBe('live');
          expect(s.view('call')).toMatchObject({
            heading: 'Opening',
            kind: 'approved',
            status: 'live',
          });
          expect(s.decision()).toEqual(first);
          expect(decisions).toBe(1);
        } finally {
          s.dispose();
        }
      }
    },
  );
  test.each(['gap', 'reconnected'] as const)(
    'a trusted unmatched final restores manual reference after %s',
    async (kind) => {
      const s = session();
      try {
        await s.ingest(event('A conversation without matching phrases'));
        await s.ingest(interruption(kind));
        await s.ingest(
          event('The conversation continues without matching phrases', 3, {
            cursor: { sequence: 3, epoch: kind === 'reconnected' ? 1 : 0 },
          }),
        );
        expect(s.view('call')).toMatchObject({
          kind: 'manual',
          status: 'manual',
        });
        expect(s.decision()).toBeNull();
      } finally {
        s.dispose();
      }
    },
  );
  test.each(['gap', 'reconnected'] as const)(
    'interim and unknown speech cannot clear %s before a trusted final',
    async (kind) => {
      const unknown = {
        participantId: 'unknown',
        legId: 'unknown-leg',
        role: 'unknown',
        provenance: 'unknown',
        bindingRevision: 1,
      } as const;
      const s = session({ participants: [participant, unknown] });
      const epoch = kind === 'reconnected' ? 1 : 0;
      const interrupted = kind === 'gap' ? 'delayed' : 'reconnecting';
      try {
        await s.ingest(event('opening trigger'));
        await s.ingest(interruption(kind));
        expect(
          (
            await s.ingest(
              event('An unfinished segment', 3, {
                finality: 'interim',
                cursor: { sequence: 3, epoch },
              }),
            )
          ).status,
        ).toBe('applied');
        expect(s.view('call').status).toBe(interrupted);
        expect(
          (
            await s.ingest(
              event('Unknown final speech', 4, {
                cursor: { sequence: 4, epoch },
                participantId: unknown.participantId,
                legId: unknown.legId,
                speaker: {
                  role: unknown.role,
                  provenance: unknown.provenance,
                  bindingRevision: unknown.bindingRevision,
                },
              }),
            )
          ).status,
        ).toBe('applied');
        expect(s.view('call').status).toBe(interrupted);
        expect(
          (
            await s.ingest(
              event('A trusted continuation without a matching rule', 5, {
                cursor: { sequence: 5, epoch },
              }),
            )
          ).status,
        ).toBe('applied');
        expect(s.view('call')).toMatchObject({
          heading: 'Opening',
          kind: 'approved',
          status: 'live',
        });
      } finally {
        s.dispose();
      }
    },
  );
});

describe('bounded context input and scheduling', () => {
  test('unknown latest finals cannot replay old known text and trusted speech recovers after the boundary', async () => {
    const unknown = {
      participantId: 'unknown',
      legId: 'unknown-leg',
      role: 'unknown',
      provenance: 'unknown',
      bindingRevision: 1,
    } as const;
    const received: { id: string; text: string }[][] = [];
    const s = session({
      participants: [participant, unknown],
      selector: selector(async (input) => {
        received.push(
          input.turns.map((turn) => ({ id: turn.id, text: turn.text })),
        );
        return null;
      }),
    });
    await s.ingest(event('A previous trusted concern'));
    await s.flush();
    await tick();
    expect(received).toHaveLength(1);
    const accepted = await s.ingest(
      event('The topic changed with an unknown speaker', 2, {
        participantId: unknown.participantId,
        legId: unknown.legId,
        speaker: {
          role: unknown.role,
          provenance: unknown.provenance,
          bindingRevision: unknown.bindingRevision,
        },
      }),
    );
    expect(accepted.status).toBe('applied');
    await s.flush();
    await tick();
    expect(received).toHaveLength(1);
    expect(s.view('call').kind).toBe('manual');
    await s.ingest(event('A new trusted concern after the boundary', 3));
    await s.flush();
    expect(received).toHaveLength(2);
    expect(received[1]).toEqual([
      { id: 's3', text: 'A new trusted concern after the boundary' },
    ]);
    s.dispose();
  });
  test('queued interim speech defers inference until its trusted final revision', async () => {
    const scheduler = createContextScheduler({ concurrency: 1 });
    let release!: () => void;
    const hold = scheduler.enqueue(
      {},
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await tick();
    const received: { id: string; revision: number; text: string }[][] = [];
    const s = session({
      scheduler,
      selector: selector(async (input) => {
        received.push(
          input.turns.map((turn) => ({
            id: turn.id,
            revision: turn.revision,
            text: turn.text,
          })),
        );
        return null;
      }),
    });
    await s.ingest(event('A previous trusted concern'));
    const interim = event('An unfinished correction', 2, {
      finality: 'interim',
    });
    expect((await s.ingest(interim)).status).toBe('applied');
    release();
    await hold;
    await s.flush();
    await tick();
    expect(received).toHaveLength(0);
    expect(s.view('call').kind).toBe('manual');
    const final = event('A trusted final correction', 3, {
      segmentId: interim.segmentId,
      segmentRevision: 2,
      audioStartMs: interim.audioStartMs,
    });
    expect((await s.ingest(final)).status).toBe('applied');
    await s.flush();
    expect(received).toHaveLength(1);
    expect(received[0]?.at(-1)).toEqual({
      id: 's2',
      revision: 2,
      text: 'A trusted final correction',
    });
    s.dispose();
  });
  test('a configured positive request limit cannot exceed twenty requests per call', async () => {
    let requests = 0;
    const s = session({
      maxSelectorRequests: 100,
      selector: selector(async () => {
        requests++;
        return null;
      }),
    });
    try {
      for (let sequence = 1; sequence <= 21; sequence++) {
        await s.ingest(
          event('A different current concern number ' + sequence, sequence),
        );
        await s.flush();
        await tick();
      }
      expect(requests).toBe(20);
      expect(s.diagnostics().requests).toBe(20);
    } finally {
      s.dispose();
    }
  });
  test.each([NaN, Infinity, -1, 1.5])(
    'rejects invalid request limit %s before inference',
    (maxSelectorRequests) => {
      let requests = 0;
      expect(() =>
        session({
          maxSelectorRequests,
          selector: selector(async () => {
            requests++;
            return null;
          }),
        }),
      ).toThrow('Invalid selector request limit');
      expect(requests).toBe(0);
    },
  );
  test('an explicit zero request limit disables the context lane', async () => {
    let requests = 0;
    const s = session({
      maxSelectorRequests: 0,
      selector: selector(async () => {
        requests++;
        return null;
      }),
    });
    await s.ingest(event('A current concern in different language'));
    await s.flush();
    await tick();
    expect(requests).toBe(0);
    expect(s.diagnostics().requests).toBe(0);
    s.dispose();
  });
  test('selector receives approved source-linked meaning and excludes explicit manual-only cards', async () => {
    let received: unknown;
    const s = session({
      selector: selector(async (input) => {
        received = input;
        return null;
      }),
    });
    await s.ingest(event('A concern in different language'));
    await s.flush();
    expect(received).toMatchObject({
      catalog: {
        playbookId: 'script',
        publishedVersion: 'script:3',
        sourceRevision: 2,
      },
      cards: [
        {
          cardId: 'opening',
          title: 'Opening',
          slots: [
            {
              slotId: 'opening-1',
              text: 'Opening one',
              source: { documentId: 'script', revision: '2' },
            },
            {
              slotId: 'opening-2',
              text: 'Opening two',
              source: { documentId: 'script', revision: '2' },
            },
            {
              slotId: 'opening-3',
              text: 'Opening three',
              source: { documentId: 'script', revision: '2' },
            },
          ],
        },
        { cardId: 'topic', title: 'Topic' },
      ],
    });
    expect(JSON.stringify(received)).not.toContain('manual-1');
    s.dispose();
  });
  test('known harmless new finals preserve captured evidence without rebasing the reported proposal cursor', async () => {
    let resolve!: (value: unknown) => void;
    const s = session({
      selector: selector(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    });
    await s.ingest(event('A concern in different language'));
    await s.ingest(event('A concern in different language', 2));
    resolve(selection());
    await s.flush();
    expect(s.view('call').heading).toBe('Topic');
    expect(s.decision()?.transcriptCursor.sequence).toBe(1);
    expect(s.diagnostics()).toMatchObject({
      lastSelectorCheckpoint: {
        capturedCursor: { sequence: 1, epoch: 0 },
        commitCursor: { sequence: 2, epoch: 0 },
        outcome: 'applied',
      },
    });
    s.dispose();
  });
  test.each([
    ['Need a payment schedule', '"Need a payment schedule"'],
    ['Need a payment schedule', '“Need a payment schedule”'],
    ['I can pay +$50', 'I can pay -$50'],
    ['I can pay $50', 'I can pay €50'],
  ])(
    'quoted or signed speech changes invalidate captured context: %j',
    async (captured: string, changed: string) => {
      let resolve!: (value: unknown) => void;
      const s = session({
        maxSelectorRequests: 1,
        selector: selector(
          () =>
            new Promise((r) => {
              resolve = r;
            }),
        ),
      });
      await s.ingest(event(captured));
      await s.ingest(event(changed, 2));
      resolve(selection());
      await s.flush();
      expect(s.view('call').kind).toBe('manual');
      expect(s.diagnostics().selectorDiscards).toBeGreaterThan(0);
      s.dispose();
    },
  );
  test.each([
    [
      'A concern in different language',
      '  a CONCERN   in DIFFERENT language  ',
    ],
    ['A cafe\u0301 concern', 'A café concern'],
  ])(
    'case whitespace and NFC repetition preserve captured context: %j',
    async (captured: string, repeated: string) => {
      let resolve!: (value: unknown) => void;
      const s = session({
        maxSelectorRequests: 1,
        selector: selector(
          () =>
            new Promise((r) => {
              resolve = r;
            }),
        ),
      });
      await s.ingest(event(captured));
      await s.ingest(event(repeated, 2));
      resolve(selection());
      await s.flush();
      expect(s.view('call').heading).toBe('Topic');
      expect(s.decision()?.transcriptCursor.sequence).toBe(1);
      expect(
        s.diagnostics().lastSelectorCheckpoint?.commitCursor.sequence,
      ).toBe(2);
      s.dispose();
    },
  );
  test('novel customer correction cannot commit an old checkpoint', async () => {
    let resolve!: (value: unknown) => void;
    const s = session({
      maxSelectorRequests: 1,
      selector: selector(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    });
    await s.ingest(event('A concern in different language'));
    await s.ingest(
      event('Actually that is settled; a different concern now', 2),
    );
    resolve(selection());
    await s.flush();
    expect(s.view('call').kind).toBe('manual');
    expect(s.diagnostics().selectorDiscards).toBeGreaterThan(0);
    s.dispose();
  });
  test('twenty live calls drain a bounded fair queue at four concurrent requests without new text', async () => {
    const releases: (() => void)[] = [];
    const order: number[] = [];
    let active = 0,
      peak = 0;
    const scheduler = createContextScheduler();
    const sessions = Array.from({ length: 20 }, (_, index) =>
      session({
        scheduler,
        scope: { ...scope, callSessionId: 'call' + index },
        policy: {
          ...policy,
          scope: { ...scope, callSessionId: 'call' + index },
        },
        maxSelectorRequests: 1,
        selector: selector(
          () =>
            new Promise((r) => {
              order.push(index);
              active++;
              peak = Math.max(peak, active);
              releases.push(() => {
                active--;
                r(null);
              });
            }),
        ),
      }),
    );
    for (let i = 0; i < sessions.length; i++)
      await sessions[i]!.ingest(
        event('A concern in different language', 1, {
          scope: { ...scope, callSessionId: 'call' + i },
        }),
      );
    await tick();
    expect(order).toEqual([0, 1, 2, 3]);
    let released = 0;
    for (let wave = 0; wave < 5; wave++) {
      const count = releases.length;
      while (released < count) releases[released++]!();
      await tick();
    }
    await Promise.all(sessions.map((s) => s.flush()));
    expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(peak).toBe(4);
    sessions.forEach((s) => s.dispose());
  });
  test.each(['next', 'off', 'revoked', 'ended', 'urgent'] as const)(
    '%s fences old selector output',
    async (action) => {
      let resolve!: (value: unknown) => void;
      let signal!: AbortSignal;
      const s = session({
        maxSelectorRequests: 1,
        selector: selector((input) => {
          signal = input.signal;
          return new Promise((r) => {
            resolve = r;
          });
        }),
      });
      await s.ingest(event('A concern in different language'));
      if (action === 'next' || action === 'off') s.control(action);
      if (action === 'revoked')
        s.renew({ ...policy, revision: 2, revoked: true });
      if (action === 'ended')
        await s.ingest({
          schemaVersion: 1,
          kind: 'ended',
          eventId: 'end',
          scope,
          cursor: { sequence: 2, epoch: 0 },
          observedAtMs: 2000,
          source: { adapter: 'mock' },
        });
      if (action === 'urgent') await s.ingest(event('opening trigger', 2));
      const before = s.view('call');
      resolve(selection());
      await s.flush();
      expect(s.view('call')).toEqual(before);
      expect(signal.aborted).toBe(true);
      s.dispose();
    },
  );
  test('revised captured evidence is rejected even when its text repeats', async () => {
    let resolve!: (value: unknown) => void;
    const s = session({
      maxSelectorRequests: 1,
      selector: selector(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    });
    await s.ingest(event('A concern in different language'));
    const revision = await s.ingest(
      event('A concern in different language', 2, {
        segmentId: 's1',
        segmentRevision: 2,
      }),
    );
    expect(revision.status).toBe('rejected');
    resolve(selection('s1', 2));
    await s.flush();
    expect(s.view('call').kind).toBe('manual');
    s.dispose();
  });
  test('a meaningful final inside the interval is scheduled once after it expires', async () => {
    let now = 1000,
      calls = 0;
    const s = session({
      contextIntervalMs: 15,
      nowMs: () => now,
      selector: selector(async () => {
        calls++;
        return null;
      }),
    });
    await s.ingest(event('A concern in different language'));
    await s.flush();
    now = 1005;
    await s.ingest(event('A new different concern', 2));
    expect(calls).toBe(1);
    now = 1015;
    await new Promise((r) => setTimeout(r, 20));
    await s.flush();
    expect(calls).toBe(2);
    s.dispose();
  });
  test('silence and unchanged normalized final text do not spend more requests', async () => {
    let calls = 0;
    const s = session({
      selector: selector(async () => {
        calls++;
        return null;
      }),
    });
    await s.ingest(event('A concern in different language'));
    await s.flush();
    await s.ingest(event('  ', 2));
    await s.flush();
    await s.ingest(event('A concern in different language!', 3));
    await s.flush();
    expect(calls).toBe(1);
    s.dispose();
  });
});

test('noncooperative deadlines retain four physical slots and drain only after settlement', async () => {
  const scheduler = createContextScheduler();
  const releases: (() => void)[] = [];
  const sessions = Array.from({ length: 5 }, (_, i) =>
    session({
      scheduler,
      scope: { ...scope, callSessionId: 'physical' + i },
      policy: { ...policy, scope: { ...scope, callSessionId: 'physical' + i } },
      maxSelectorRequests: 1,
      selectorDeadlineMs: 3,
      selector: selector(
        () => new Promise((r) => releases.push(() => r(null))),
      ),
    }),
  );
  for (let i = 0; i < sessions.length; i++)
    await sessions[i]!.ingest(
      event('A concern in different language', 1, {
        scope: { ...scope, callSessionId: 'physical' + i },
      }),
    );
  await new Promise((r) => setTimeout(r, 8));
  expect(releases).toHaveLength(4);
  expect(scheduler.diagnostics()).toMatchObject({ active: 4, waiting: 1 });
  for (const s of sessions.slice(0, 4)) {
    await s.flush();
    expect(s.diagnostics().transportUnsettled).toBe(true);
    expect(s.view('call').status).toBe('unavailable');
  }
  releases[0]!();
  await tick();
  expect(releases).toHaveLength(5);
  releases.slice(1).forEach((r) => r());
  await Promise.all(sessions.map((s) => s.flush()));
  sessions.forEach((s) => s.dispose());
});
test('a request budget queue expires once without automatic unbounded readmission', async () => {
  const scheduler = createContextScheduler({
    maxRequestsPerMinute: 1,
    maxWaitMs: 5,
  });
  let calls = 0;
  const a = session({
    scheduler,
    selector: selector(async () => {
      calls++;
      return null;
    }),
  });
  const b = session({
    scheduler,
    selector: selector(async () => {
      calls++;
      return null;
    }),
  });
  await a.ingest(event('A concern in different language'));
  await a.flush();
  await b.ingest(event('A concern in different language'));
  await new Promise((r) => setTimeout(r, 20));
  expect(calls).toBe(1);
  expect(scheduler.diagnostics().waiting).toBe(0);
  expect(b.diagnostics().selectorQueued).toBe(false);
  a.dispose();
  b.dispose();
});
test('an intervening rep question prevents reusing the same old short customer answer', async () => {
  const rep = {
    participantId: 'rep',
    legId: 'rep-leg',
    role: 'rep',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  } as const;
  let resolve!: (v: unknown) => void;
  const s = session({
    participants: [participant, rep],
    maxSelectorRequests: 1,
    selector: selector(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  });
  await s.ingest(event('No'));
  await s.ingest(
    event('Would you agree to a different proposal?', 2, {
      participantId: rep.participantId,
      legId: rep.legId,
      speaker: {
        role: rep.role,
        provenance: rep.provenance,
        bindingRevision: rep.bindingRevision,
      },
    }),
  );
  await s.ingest(event('No', 3));
  resolve(selection());
  await s.flush();
  expect(s.view('call').kind).toBe('manual');
  s.dispose();
});
test('trusted rep acknowledgement is benign and leaves an immutable two-cursor checkpoint', async () => {
  const rep = {
    participantId: 'rep',
    legId: 'rep-leg',
    role: 'rep',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  } as const;
  let resolve!: (v: unknown) => void;
  let checkpoint: unknown;
  const s = session({
    participants: [participant, rep],
    onSelectorCheckpoint: (c) => {
      checkpoint = c;
    },
    selector: selector(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  });
  await s.ingest(event('A concern in different language'));
  await s.ingest(
    event('Understood.', 2, {
      participantId: rep.participantId,
      legId: rep.legId,
      speaker: {
        role: rep.role,
        provenance: rep.provenance,
        bindingRevision: rep.bindingRevision,
      },
    }),
  );
  resolve(selection());
  await s.flush();
  expect(s.view('call').heading).toBe('Topic');
  expect(Object.isFrozen(checkpoint)).toBe(true);
  expect(s.diagnostics().lastSelectorCheckpoint?.deltaCursors).toEqual([
    { sequence: 2, epoch: 0 },
  ]);
  s.dispose();
});
test.each(['"yes"', '‘yes’', 'yes?', '+yes', 'yes!'])(
  'a quoted or punctuated rep response is not a benign acknowledgement: %s',
  async (text) => {
    const rep = {
      participantId: 'rep',
      legId: 'rep-leg',
      role: 'rep',
      provenance: 'authenticated-leg',
      bindingRevision: 1,
    } as const;
    let resolve!: (value: unknown) => void;
    const s = session({
      participants: [participant, rep],
      maxSelectorRequests: 1,
      selector: selector(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      ),
    });
    await s.ingest(event('A current concern in different language'));
    await s.ingest(
      event(text, 2, {
        participantId: rep.participantId,
        legId: rep.legId,
        speaker: {
          role: rep.role,
          provenance: rep.provenance,
          bindingRevision: rep.bindingRevision,
        },
      }),
    );
    resolve(selection());
    await s.flush();
    expect(s.view('call').kind).toBe('manual');
    expect(s.diagnostics().selectorDiscards).toBeGreaterThan(0);
    s.dispose();
  },
);
test('admitted policy revision renewal still fences the captured proposal', async () => {
  let resolve!: (v: unknown) => void;
  const s = session({
    maxSelectorRequests: 1,
    selector: selector(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  });
  await s.ingest(event('A concern in different language'));
  s.renew({ ...policy, revision: 2 });
  resolve(selection());
  await s.flush();
  expect(s.view('call').kind).toBe('manual');
  s.dispose();
});

test('queued Off removes admission without a provider call when capacity returns', async () => {
  const scheduler = createContextScheduler({ concurrency: 1 });
  let release!: (v: unknown) => void,
    secondCalls = 0;
  const a = session({
    scheduler,
    selector: selector(
      () =>
        new Promise((r) => {
          release = r;
        }),
    ),
  });
  const b = session({
    scheduler,
    selector: selector(async () => {
      secondCalls++;
      return null;
    }),
  });
  await a.ingest(event('A concern in different language'));
  await b.ingest(event('A concern in different language'));
  expect(b.diagnostics().selectorQueued).toBe(true);
  b.control('off');
  release(null);
  await a.flush();
  await b.flush();
  await tick();
  expect(secondCalls).toBe(0);
  expect(scheduler.diagnostics().waiting).toBe(0);
  a.dispose();
  b.dispose();
});
test('bounded queue rejects excess owners and never retains more than64 waiting', async () => {
  const scheduler = createContextScheduler();
  const owners = Array.from({ length: 75 }, () => ({}));
  const release: (() => void)[] = [];
  let accepted = 0;
  for (const owner of owners)
    if (
      scheduler.enqueue(owner, () => new Promise<void>((r) => release.push(r)))
    )
      accepted++;
  await tick();
  expect(accepted).toBe(68);
  expect(scheduler.diagnostics()).toMatchObject({ active: 4, waiting: 64 });
  owners.forEach((o) => scheduler.cancel(o));
  release.forEach((r) => r());
  await tick();
  expect(scheduler.diagnostics()).toMatchObject({ active: 0, waiting: 0 });
});
test('too-large trusted catalogs and transcript input make no provider request', async () => {
  const make = (count: number, width: number, largeRules = false) =>
    compilePlaybook({
      workspaceId: 'w',
      scriptId: 'bounded',
      sourceRevision: 1,
      version: 1,
      title: 'Bounded',
      industryPackVersion: 'i',
      companyPolicyVersion: 'p',
      rules: largeRules
        ? Array.from({ length: count }, (_, i) => ({
            cardId: 'card-' + i,
            priority: 0,
            aliases: Array.from(
              { length: 32 },
              (_, j) => 'alias ' + j + ' ' + 'z'.repeat(65),
            ),
          }))
        : undefined,
      content: Array.from(
        { length: count },
        (_, i) =>
          '# Card ' +
          i +
          '\n- ' +
          'a'.repeat(width) +
          '\n- ' +
          'b'.repeat(width) +
          '\n- ' +
          'c'.repeat(width),
      ).join('\n'),
    });
  let calls = 0;
  const provider = selector(async () => {
    calls++;
    return null;
  });
  for (const plan of [make(33, 2), make(24, 256, true)]) {
    const s = session({ compiled: plan, selector: provider });
    await s.ingest(event('A concern in different language'));
    await s.flush();
    s.dispose();
  }
  const s = session({ selector: provider });
  await s.ingest(event('x'.repeat(8001)));
  await s.flush();
  s.dispose();
  expect(calls).toBe(0);
});
test('compiled identity prevents identical script identifiers from reusing different source text', async () => {
  const plan = compilePlaybook({
    workspaceId: 'w',
    scriptId: 'script',
    sourceRevision: 2,
    version: 3,
    title: 'Other',
    industryPackVersion: 'i',
    companyPolicyVersion: 'p',
    content: '# Opening\n- Different one\n- Different two\n- Different three',
  });
  const texts: string[] = [];
  const provider = selector(async (input) => {
    texts.push(input.cards[0]!.slots[0]!.text);
    return null;
  });
  for (const variant of [plan, compiled]) {
    const s = session({ compiled: variant, selector: provider });
    await s.ingest(event('A concern in different language'));
    await s.flush();
    s.dispose();
  }
  expect(texts).toEqual(['Different one', 'Opening one']);
});
test('a repeated currently visible priority rule cancels older semantic work', async () => {
  let resolve!: (v: unknown) => void;
  const s = session({
    maxSelectorRequests: 1,
    selector: selector(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  });
  await s.ingest(event('opening trigger'));
  await s.ingest(event('opening trigger', 2));
  resolve(selection());
  await s.flush();
  expect(s.view('call').heading).toBe('Opening');
  s.dispose();
});

test('Off always disables inference even when manual-reference permission is absent', async () => {
  let calls = 0;
  const s = session({
    policy: {
      ...policy,
      capabilities: ['live-transcription', 'live-coaching'],
    },
    selector: selector(async () => {
      calls++;
      return null;
    }),
  });
  s.control('off');
  await s.ingest(event('A concern in different language'));
  await s.flush();
  expect(calls).toBe(0);
  expect(s.diagnostics().mode).toBe('off');
  s.dispose();
});

test('a validated unchanged selector layout restores live status without emitting a changed-slot patch', async () => {
  let patches = 0;
  const s = session({
    onDecision: () => patches++,
    selector: selector(async () => ({
      cardId: 'opening',
      slotIds: ['opening-1', 'opening-2', 'opening-3'],
      evidence: [{ segmentId: 's1', segmentRevision: 1 }],
    })),
  });
  s.control('auto');
  expect(s.view('call').kind).toBe('manual');
  await s.ingest(event('A concern in different language'));
  await s.flush();
  expect(s.view('call')).toMatchObject({ kind: 'approved', status: 'live' });
  expect(patches).toBe(1);
  expect(s.diagnostics().lastSelectorCheckpoint?.outcome).toBe('unchanged');
  s.dispose();
});
