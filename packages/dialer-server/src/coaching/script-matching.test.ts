import { describe, expect, test } from 'bun:test';
import type {
  AssistancePolicy,
  TranscriptSegmentEvent,
} from '@consuelo/conversation';
import { compilePlaybook, type CardRule } from './playbooks';
import {
  createScriptSession,
  createClosedSetSelector,
  ruleContextEligible,
  selectScriptRule,
} from './script-engine';
const scope = { workspaceId: 'w', callSessionId: 'call', callGeneration: 1 };
const speaker = {
  role: 'customer',
  provenance: 'authenticated-leg',
  bindingRevision: 1,
} as const;
const binding = { ...speaker, participantId: 'customer', legId: 'leg' };
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
  source: { adapter: 'unit' },
  segmentId: 's' + sequence,
  segmentRevision: 1,
  participantId: 'customer',
  legId: 'leg',
  speaker,
  audioStartMs: (sequence - 1) * 1000,
  audioEndMs: sequence * 1000,
  text,
  finality: 'final',
  ...overrides,
});
const rule = (changes: Partial<CardRule> = {}): CardRule => ({
  cardId: 'alpha',
  aliases: ['existing coverage'],
  required: [],
  forbidden: [],
  priority: 50,
  speaker: 'customer',
  nextCardIds: [],
  ...changes,
});
const plan = (rules?: readonly CardRule[]) =>
  compilePlaybook({
    workspaceId: 'w',
    scriptId: 'script',
    sourceRevision: 1,
    version: 1,
    title: 'Approved',
    content: ['Alpha', 'Beta', 'Gamma']
      .map(
        (name) =>
          '# ' +
          name +
          '\n- Ask the approved question\n- Confirm their answer\n- Review the approved next step',
      )
      .join('\n\n'),
    industryPackVersion: 'reviewed',
    companyPolicyVersion: 'reviewed',
    rules,
  });
const selected = (text: string, changes: Partial<CardRule> = {}) => {
  const e = event(text);
  return selectScriptRule(plan([rule(changes)]), e, [e])?.cardId ?? null;
};
describe('authored phrase matching contract', () => {
  test.each([
    ['I cannot afford it', ['cant afford']],
    ["I can't afford it", ['cannot afford']],
    ['I CAN’T afford it', ['can not afford']],
    ['I have questions about my beneficiaries', ['beneficiary']],
    ['I have several policies already', ['policy']],
    ['I do not need that. My spouse wants to join.', ['my spouse']],
    ['I never said that; my spouse is joining', ['my spouse']],
    [
      'I had a different plan, but I have existing coverage',
      ['existing coverage'],
    ],
    [
      'I do not have existing coverage, but I now have existing coverage',
      ['existing coverage'],
    ],
    ['My spouse said no', ['my spouse']],
    [
      'I have existing coverage and work as a constructor',
      ['existing coverage'],
    ],
    [
      'The phrase "last year" is irrelevant. I have existing coverage',
      ['existing coverage'],
    ],
    ['I still hold the policy I purchased a year ago', ['policy']],
    [
      'I currently have existing coverage that began last year',
      ['existing coverage'],
    ],
  ] as const)('matches approved wording in %s', (text, aliases) => {
    expect(selected(text, { aliases })).toBe('alpha');
  });
  test.each([
    ['I am not worried about the cost', ['cost']],
    ['I do not have existing coverage', ['existing coverage']],
    ['I used to have existing coverage', ['existing coverage']],
    ['I have existing coverage last year', ['existing coverage']],
    ['She said too expensive', ['too expensive']],
    ['The old note reads “too expensive”', ['too expensive']],
    ['The old note reads "too expensive', ['too expensive']],
    ["She said 'too expensive' yesterday", ['too expensive']],
    ['My existing coveragesheet is here', ['existing coverage']],
    ['My policyholder called', ['policy']],
    ['Coins are scarce', ['cannot afford']],
    ['My spouse and I have already decided', ['my spouse']],
    ['That cost concern is resolved', ['cost']],
    ['Existing coverage is no longer an issue', ['existing coverage']],
    ['Cost does not matter to me', ['cost']],
    ['Cost is not my concern', ['cost']],
    ['The earlier cost concern is fine now', ['cost']],
    ['My budget works for me now', ['my budget']],
    ['My spouse and I already approved our plan', ['my spouse']],
    ['My employer does not cover me', ['my employer']],
    ["The example is 'I can't afford it' from an old note", ['afford']],
    ['The example is ‘I can’t afford it’ from an old note', ['afford']],
  ] as const)('abstains for %s', (text, aliases) => {
    expect(selected(text, { aliases })).toBeNull();
  });
  test('an eligible occurrence is not vetoed by another negated occurrence', () => {
    const e = event(
      'I do not have existing coverage, but now I have existing coverage',
    );
    expect(ruleContextEligible(rule(), e, [e])).toBe(true);
  });
  test.each([
    'I have existing coverage, but I do not have existing coverage.',
    'I have existing coverage. I no longer have existing coverage.',
    'I have existing coverage and I do not have existing coverage.',
    'I have existing coverage, but existing coverage is no longer an issue.',
  ])('latest explicit retraction wins within %s', (text) => {
    const e = event(text);
    expect(selectScriptRule(plan([rule()]), e, [e])).toBeNull();
    expect(ruleContextEligible(rule(), e, [e])).toBe(false);
  });
  test.each([
    'I do not have existing coverage, but I now have existing coverage.',
    'I do not have existing coverage. I now have existing coverage.',
    'I do not have existing coverage and now I have existing coverage.',
  ])('latest explicit affirmation wins within %s', (text) => {
    const e = event(text);
    expect(selectScriptRule(plan([rule()]), e, [e])?.cardId).toBe('alpha');
    expect(ruleContextEligible(rule(), e, [e])).toBe(true);
  });
  test('unknown role, interim and wrong authored speaker abstain', () => {
    const compiled = plan([rule()]);
    for (const e of [
      event('existing coverage', 1, { finality: 'interim' }),
      event('existing coverage', 1, {
        speaker: { ...speaker, role: 'unknown', provenance: 'unknown' },
      }),
      event('existing coverage', 1, { speaker: { ...speaker, role: 'rep' } }),
    ]) {
      expect(selectScriptRule(compiled, e, [e])).toBeNull();
      expect(ruleContextEligible(rule(), e, [e])).toBe(false);
    }
  });
  test.each([
    ['existing coverage', 'already insured'],
    ['already insured', 'existing coverage'],
  ])(
    'latest explicit card assertion wins across aliases %j',
    (first: string, second: string) => {
      const aliases = [first, second];
      for (const [text, expected] of [
        ['I have existing coverage, but I am not already insured.', false],
        ['I am already insured. I do not have existing coverage.', false],
        ['I do not have existing coverage, but I am already insured.', true],
        ['I am not already insured. I have existing coverage.', true],
      ] as const) {
        const e = event(text);
        const compiled = plan([rule({ aliases })]);
        expect(selectScriptRule(compiled, e, [e])?.cardId ?? null).toBe(
          expected ? 'alpha' : null,
        );
        expect(ruleContextEligible(compiled.rules[0]!, e, [e])).toBe(expected);
      }
    },
  );
  test.each([
    ['my budget', 'does not fit my budget'],
    ['does not fit my budget', 'my budget'],
  ])(
    'longest approved alias wins at the same occurrence end %j',
    (first: string, second: string) => {
      const aliases = [first, second];
      const e = event('This does not fit my budget');
      const compiled = plan([rule({ aliases })]);
      expect(selectScriptRule(compiled, e, [e])?.cardId).toBe('alpha');
      expect(ruleContextEligible(compiled.rules[0]!, e, [e])).toBe(true);
      const withdrawn = event(
        'This does not fit my budget, but my budget is fine now',
      );
      expect(selectScriptRule(compiled, withdrawn, [withdrawn])).toBeNull();
      expect(
        ruleContextEligible(compiled.rules[0]!, withdrawn, [withdrawn]),
      ).toBe(false);
    },
  );
  test('reported, historical and quoted alternative aliases do not retract a current card assertion', () => {
    const aliases = ['existing coverage', 'already insured'];
    for (const text of [
      'I have existing coverage. She said I am not already insured.',
      'I have existing coverage. I was not already insured last year.',
      'I have existing coverage. The note says "not already insured".',
    ]) {
      const e = event(text);
      const compiled = plan([rule({ aliases })]);
      expect(selectScriptRule(compiled, e, [e])?.cardId).toBe('alpha');
      expect(ruleContextEligible(compiled.rules[0]!, e, [e])).toBe(true);
    }
  });
});
describe('bounded evidence for authored context', () => {
  test('mutable rules do not retain stale cached phrases', () => {
    const aliases = ['unrelated'];
    const mutable = Object.freeze(rule({ aliases }));
    const current = event('I do not have existing coverage');
    expect(ruleContextEligible(mutable, current, [current])).toBe(true);
    aliases.push('existing coverage');
    expect(ruleContextEligible(mutable, current, [current])).toBe(false);
  });
  const contextual = rule({ required: ['approval code'] });
  const current = event('existing coverage', 10, { observedAtMs: 40000 });
  test('unknown final speech is a boundary for older required context', () => {
    const prior = event('My approval code is ready', 8, {
      observedAtMs: 38000,
    });
    const unknown = event('A new concern with unknown speaker', 9, {
      observedAtMs: 39000,
      participantId: 'unknown',
      legId: 'unknown-leg',
      speaker: { role: 'unknown', provenance: 'unknown', bindingRevision: 1 },
    });
    const compiled = plan([contextual]);
    expect(
      selectScriptRule(compiled, current, [prior, unknown, current]),
    ).toBeNull();
    expect(
      ruleContextEligible(compiled.rules[0]!, current, [
        prior,
        unknown,
        current,
      ]),
    ).toBe(false);
    const renewed = event('My approval code is ready', 10, {
      observedAtMs: 40000,
    });
    const next = event('existing coverage', 11, { observedAtMs: 41000 });
    expect(
      selectScriptRule(compiled, next, [prior, unknown, renewed, next])?.cardId,
    ).toBe('alpha');
  });
  test.each([
    'I no longer have an approval code. I have existing coverage.',
    'My approval code is not valid. I have existing coverage.',
  ])('current retraction overrides earlier required context: %s', (text) => {
    const prior = event('My approval code is ready', 9, {
      observedAtMs: 39000,
    });
    const latest = event(text, 10, { observedAtMs: 40000 });
    const compiled = plan([contextual]);
    expect(selectScriptRule(compiled, latest, [prior, latest])).toBeNull();
    expect(
      ruleContextEligible(compiled.rules[0]!, latest, [prior, latest]),
    ).toBe(false);
  });
  test('the latest explicit required assertion wins across bounded turns', () => {
    const positive = event('My approval code is ready', 7, {
      observedAtMs: 37000,
    });
    const negative = event('I no longer have an approval code', 8, {
      observedAtMs: 38000,
    });
    const unrelated = event('Let us continue', 9, { observedAtMs: 39000 });
    const compiled = plan([contextual]);
    expect(
      selectScriptRule(compiled, current, [
        positive,
        negative,
        unrelated,
        current,
      ]),
    ).toBeNull();
    const reaffirmed = event('My approval code is ready', 9, {
      observedAtMs: 39000,
    });
    expect(
      selectScriptRule(compiled, current, [
        positive,
        negative,
        reaffirmed,
        current,
      ])?.cardId,
    ).toBe('alpha');
  });
  test('revised phrase polarity replaces both positive and negative stale revisions', () => {
    const positive = event('My approval code is ready', 8, {
      segmentId: 'revised',
      observedAtMs: 38000,
    });
    const negative = event('I no longer have an approval code', 9, {
      segmentId: 'revised',
      segmentRevision: 2,
      observedAtMs: 39000,
    });
    const compiled = plan([contextual]);
    expect(
      selectScriptRule(compiled, current, [negative, positive, current]),
    ).toBeNull();
    const corrected = event('My approval code is ready', 9, {
      segmentId: 'revised',
      segmentRevision: 3,
      observedAtMs: 39000,
    });
    expect(
      selectScriptRule(compiled, current, [
        corrected,
        negative,
        positive,
        current,
      ])?.cardId,
    ).toBe('alpha');
  });
  test.each([
    'She said "no approval code"',
    'I used to have no approval code',
    'She said there is no approval code',
  ])(
    'reported or historical mentions do not retract current required context: %s',
    (text) => {
      const prior = event('My approval code is ready', 8, {
        observedAtMs: 38000,
      });
      const mention = event(text, 9, { observedAtMs: 39000 });
      expect(
        selectScriptRule(plan([contextual]), current, [prior, mention, current])
          ?.cardId,
      ).toBe('alpha');
    },
  );
  test.each([
    [
      'foreign workspace',
      event('approval code', 9, {
        scope: { ...scope, workspaceId: 'foreign' },
        observedAtMs: 39000,
      }),
    ],
    [
      'foreign call generation',
      event('approval code', 9, {
        scope: { ...scope, callGeneration: 2 },
        observedAtMs: 39000,
      }),
    ],
    ['future cursor', event('approval code', 11, { observedAtMs: 39000 })],
    [
      'previous epoch',
      event('approval code', 9, {
        cursor: { sequence: 9, epoch: 1 },
        observedAtMs: 39000,
      }),
    ],
    ['future observation', event('approval code', 9, { observedAtMs: 41000 })],
    ['stale turn', event('approval code', 9, { observedAtMs: 1000 })],
    [
      'rep context',
      event('approval code', 9, {
        observedAtMs: 39000,
        speaker: { ...speaker, role: 'rep' },
      }),
    ],
    [
      'negated requirement',
      event('There is no approval code', 9, { observedAtMs: 39000 }),
    ],
    [
      'quoted requirement',
      event('She said "approval code"', 9, { observedAtMs: 39000 }),
    ],
  ] as const)('cannot use %s to satisfy context', (_label, prior) => {
    expect(
      selectScriptRule(plan([contextual]), current, [prior, current]),
    ).toBeNull();
    expect(ruleContextEligible(contextual, current, [prior, current])).toBe(
      false,
    );
  });
  test('does not manufacture a phrase across separate turns', () => {
    const recent = [
      event('approval', 8, { observedAtMs: 38000 }),
      event('code', 9, { observedAtMs: 39000 }),
      current,
    ];
    expect(selectScriptRule(plan([contextual]), current, recent)).toBeNull();
  });
  test('keeps final matching-role context within the bounded window', () => {
    const prior = event('My approval code is ready', 9, {
      observedAtMs: 39000,
    });
    expect(
      selectScriptRule(plan([contextual]), current, [current, prior])?.cardId,
    ).toBe('alpha');
  });
  test('stale segment revision cannot contribute required context', () => {
    const stale = event('approval code', 8, {
      segmentId: 'revised',
      observedAtMs: 38000,
    });
    const revised = event('unrelated', 9, {
      segmentId: 'revised',
      segmentRevision: 2,
      observedAtMs: 39000,
    });
    expect(
      selectScriptRule(plan([contextual]), current, [stale, revised, current]),
    ).toBeNull();
  });
  test('forbidden context is conservative even when quoted or negated', () => {
    for (const text of [
      'There is no approval code',
      'She said "approval code"',
    ]) {
      const prior = event(text, 9, { observedAtMs: 39000 });
      expect(
        selectScriptRule(
          plan([rule({ forbidden: ['approval code'] })]),
          current,
          [prior, current],
        ),
      ).toBeNull();
    }
  });
  test('last six turns are ordered by cursor, not caller array order', () => {
    const old = event('approval code', 3, { observedAtMs: 33000 });
    const newer = Array.from({ length: 6 }, (_, i) =>
      event('unrelated', i + 4, { observedAtMs: 34000 + i * 1000 }),
    );
    expect(
      selectScriptRule(plan([contextual]), current, [current, ...newer, old]),
    ).toBeNull();
  });
});
describe('deterministic session ranking and dwell', () => {
  const policy: AssistancePolicy = {
    scope,
    memberId: 'rep',
    revision: 1,
    validUntilMs: 100000,
    revoked: false,
    capabilities: ['manual-reference', 'live-transcription', 'live-coaching'],
    consent: {
      ephemeralTranscription: true,
      retainedTranscript: false,
      aiGeneration: false,
    },
  };
  test.each([
    ['explicit empty rule list', []],
    ['a card with no aliases', [rule({ cardId: 'beta', aliases: [] })]],
  ] as const)(
    '%s remains manual-only with an optional selector',
    async (_label, rules) => {
      let requests = 0;
      const selector = createClosedSetSelector({
        providerRevision: 'unit',
        modelRevision: 'unit',
        structuredOutput: true,
        run: async () => {
          requests++;
          return {
            cardId: 'beta',
            slotIds: ['beta-1', 'beta-2', 'beta-3'],
            evidence: [{ segmentId: 's1', segmentRevision: 1 }],
          };
        },
      });
      const compiled = plan(rules);
      const e = event('Unrelated customer wording');
      expect(selectScriptRule(compiled, e, [e])).toBeNull();
      for (const reviewedRule of compiled.rules)
        expect(ruleContextEligible(reviewedRule, e, [e])).toBe(false);
      const session = createScriptSession({
        scope,
        participants: [binding],
        compiled,
        policy,
        selector,
        nowMs: () => 5000,
        minimumDwellMs: 0,
      });
      await session.ingest(e);
      await session.flush();
      expect(requests).toBe(0);
      expect(session.decision()).toBeNull();
      expect(session.view('scope').kind).toBe('manual');
      session.dispose();
    },
  );
  test('omitting rules still creates automatic heading triggers', async () => {
    const compiled = plan();
    const session = createScriptSession({
      scope,
      participants: [binding],
      compiled,
      policy,
      nowMs: () => 5000,
    });
    await session.ingest(event('Alpha'));
    expect(session.decision()?.source).toBe('rules');
    expect(session.decision()?.cardId).toBe('alpha');
    session.dispose();
  });
  test('authored transition prefers only equally prioritized eligible triggers', async () => {
    const compiled = plan([
      rule({ aliases: ['begin'], nextCardIds: ['gamma'] }),
      rule({ cardId: 'beta', aliases: ['continue'] }),
      rule({ cardId: 'gamma', aliases: ['continue'] }),
    ]);
    const session = createScriptSession({
      scope,
      participants: [binding],
      compiled,
      policy,
      nowMs: () => 5000,
      minimumDwellMs: 0,
    });
    await session.ingest(event('begin'));
    await session.ingest(event('continue', 2));
    expect(session.decision()?.cardId).toBe('gamma');
    session.dispose();
  });
  test('repeat evidence does not restart dwell and higher priority interrupts dwell', async () => {
    let now = 1000;
    const compiled = plan([
      rule({ aliases: ['begin'] }),
      rule({ cardId: 'beta', aliases: ['ordinary'] }),
      rule({ cardId: 'gamma', aliases: ['urgent'], priority: 90 }),
    ]);
    const session = createScriptSession({
      scope,
      participants: [binding],
      compiled,
      policy,
      nowMs: () => now,
      minimumDwellMs: 1500,
    });
    await session.ingest(event('begin'));
    now = 2000;
    await session.ingest(event('begin', 2));
    now = 2600;
    await session.ingest(event('ordinary', 3));
    expect(session.decision()?.cardId).toBe('beta');
    now = 2700;
    await session.ingest(event('urgent', 4));
    expect(session.decision()?.cardId).toBe('gamma');
    session.control('pin');
    now = 5000;
    await session.ingest(event('begin', 5));
    expect(session.decision()?.cardId).toBe('gamma');
    session.dispose();
  });
});
