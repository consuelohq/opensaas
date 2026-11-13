import { describe, test, expect } from 'bun:test';
import { compilePlaybook, SYNTHETIC_LIFE_INSURANCE } from './playbooks';
import { createScriptSession, createClosedSetSelector } from './script-engine';
import type {
  AssistancePolicy,
  TranscriptSegmentEvent,
} from '@consuelo/conversation';
const scope = { workspaceId: 'w', callSessionId: 'call', callGeneration: 1 };
const binding = {
  participantId: 'customer',
  legId: 'leg',
  role: 'customer',
  provenance: 'authenticated-leg',
  bindingRevision: 1,
} as const;
const compiled = () =>
  compilePlaybook({
    workspaceId: 'w',
    scriptId: 'script',
    sourceRevision: 1,
    version: 1,
    title: 'Example',
    content: SYNTHETIC_LIFE_INSURANCE.content,
    rules: SYNTHETIC_LIFE_INSURANCE.rules,
    industryPackVersion: 'example-life-v1',
    companyPolicyVersion: 'example-company-v1',
  });
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
  observedAtMs: 1000 * sequence,
  source: { adapter: 'fixture' },
  segmentId: 's' + sequence,
  segmentRevision: 1,
  participantId: 'customer',
  legId: 'leg',
  speaker: {
    role: 'customer',
    provenance: 'authenticated-leg',
    bindingRevision: 1,
  },
  audioStartMs: (sequence - 1) * 1000,
  audioEndMs: sequence * 1000,
  text,
  finality: 'final',
  ...overrides,
});
const session = (options: Record<string, unknown> = {}) =>
  createScriptSession({
    scope,
    participants: [binding],
    compiled: compiled(),
    policy,
    nowMs: () => 1000,
    ...options,
  });
describe('approved playbook compile', () => {
  test('source-linked synthetic life examples compile deterministically without generated statements', () => {
    const a = compiled();
    expect(a).toEqual(compiled());
    expect(a.playbook.cards).toHaveLength(6);
    for (const card of a.playbook.cards)
      for (const slot of card.slots) {
        expect(SYNTHETIC_LIFE_INSURANCE.content).toContain(slot.text);
        expect(slot.source.excerpt).toContain(slot.text);
      }
    expect(Object.isFrozen(a.playbook)).toBe(true);
  });
  test.each([
    '# Bad\n- one\n- two',
    '',
    'x'.repeat(100001),
    '# Bad\n- one\n- two\n- three\n- four\n- five',
  ])('rejects invalid source %#', (content) => {
    expect(() =>
      compilePlaybook({
        ...SYNTHETIC_LIFE_INSURANCE,
        workspaceId: 'w',
        scriptId: 's',
        sourceRevision: 1,
        version: 1,
        title: 'bad',
        content,
        industryPackVersion: 'i',
        companyPolicyVersion: 'c',
      }),
    ).toThrow();
  });
  test('rejects malformed trigger config and nonexistent graph transitions', () => {
    for (const rules of [
      [{ cardId: 'missing', aliases: ['coverage'], priority: 1 }],
      [{ ...SYNTHETIC_LIFE_INSURANCE.rules[0], aliases: [''] }],
      [{ ...SYNTHETIC_LIFE_INSURANCE.rules[0], nextCardIds: ['missing'] }],
    ])
      expect(() =>
        compilePlaybook({
          workspaceId: 'w',
          scriptId: 's',
          sourceRevision: 1,
          version: 1,
          title: 'Example',
          content: SYNTHETIC_LIFE_INSURANCE.content,
          rules,
          industryPackVersion: 'i',
          companyPolicyVersion: 'c',
        }),
      ).toThrow();
  });
});
describe('Script decisions and safety', () => {
  test('eligible customer final selects only approved coverage slots', async () => {
    const s = session();
    await s.ingest(event('I have existing coverage'));
    expect(s.view('outbound:call')).toMatchObject({
      kind: 'approved',
      status: 'live',
      heading: 'Existing coverage',
    });
    expect(s.view('outbound:call').points).toHaveLength(3);
  });
  test.each([
    'I do not have existing coverage',
    'She said "existing coverage"',
    'I used to have existing coverage',
    'No relevant objection',
  ])('abstains for %s', async (text) => {
    const s = session();
    await s.ingest(event(text));
    expect(s.view('outbound:call').status).toBe('manual');
  });
  test('interim, unknown role and foreign scope cannot produce automatic cue', async () => {
    const s = session();
    for (const e of [
      event('existing coverage', 1, { finality: 'interim' }),
      event('existing coverage', 2, {
        speaker: { role: 'unknown', provenance: 'unknown', bindingRevision: 1 },
      }),
      event('existing coverage', 3, {
        scope: { ...scope, workspaceId: 'other' },
      }),
    ])
      await s.ingest(e);
    expect(s.view('outbound:call').status).toBe('manual');
  });
  test('manual pin wins and Off makes no selector request', async () => {
    let calls = 0;
    const selector = createClosedSetSelector({
      providerRevision: 'fixture',
      modelRevision: 'v1',
      structuredOutput: true,
      run: async () => {
        calls++;
        return {
          cardId: 'affordability',
          slotIds: ['affordability-1', 'affordability-2', 'affordability-3'],
          evidence: [{ segmentId: 's1', segmentRevision: 1 }],
          source: 'manual',
          pin: true,
        };
      },
    });
    const s = session({ selector, contextIntervalMs: 0 });
    s.control('pin');
    await s.ingest(event('too expensive'));
    await s.flush();
    expect(s.view('outbound:call').status).toBe('manual');
    s.control('off');
    await s.ingest(event('existing coverage', 2));
    await s.flush();
    expect(calls).toBe(0);
  });
  test('no inference without capture consent or unchanged input', async () => {
    let calls = 0;
    const selector = createClosedSetSelector({
      providerRevision: 'fixture',
      modelRevision: 'v1',
      structuredOutput: true,
      run: async () => {
        calls++;
        return null;
      },
    });
    const s = session({
      selector,
      policy: {
        ...policy,
        consent: { ...policy.consent, ephemeralTranscription: false },
      },
      contextIntervalMs: 0,
    });
    await s.ingest(event('existing coverage'));
    await s.flush();
    expect(calls).toBe(0);
  });
  test('late selector cannot overwrite urgent/manual results or later call', async () => {
    let resolve: (v: unknown) => void = () => {};
    const selector = createClosedSetSelector({
      providerRevision: 'fixture',
      modelRevision: 'v1',
      structuredOutput: true,
      run: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    const s = session({ selector, contextIntervalMs: 0 });
    await s.ingest(event('existing coverage'));
    s.control('next');
    const before = s.view('outbound:call');
    resolve({
      cardId: 'existing-coverage',
      slotIds: [
        'existing-coverage-1',
        'existing-coverage-2',
        'existing-coverage-3',
      ],
      evidence: [{ segmentId: 's1', segmentRevision: 1 }],
      source: 'manual',
      pin: true,
    });
    await s.flush();
    expect(s.view('outbound:call')).toEqual(before);
  });
  test('honest long-call cap rejects data and records unavailable without resetting cursor', async () => {
    const s = session();
    for (let n = 1; n <= 2049; n++) await s.ingest(event('unrelated', n));
    expect(s.diagnostics().cursor.sequence).toBe(2048);
    expect(s.view('outbound:call').status).toBe('unavailable');
    expect(s.diagnostics().capacityRejected).toBe(true);
  });
});

test('fixture baseline vs bounded selector uses approved IDs and forces trusted source', async () => {
  const baseline = session();
  await baseline.ingest(event('unrelated speech'));
  expect(baseline.view('outbound:call').kind).toBe('manual');
  let calls = 0;
  const selector = createClosedSetSelector({
    providerRevision: 'fixture',
    modelRevision: 'reviewed-v1',
    structuredOutput: true,
    run: async () => {
      calls++;
      return {
        cardId: 'affordability',
        slotIds: ['affordability-1', 'affordability-2', 'affordability-3'],
        evidence: [{ segmentId: 's1', segmentRevision: 1 }],
        source: 'manual',
        pin: true,
        scope: { workspaceId: 'foreign' },
        freeText: 'Never display this',
      };
    },
  });
  const assisted = session({ selector, minimumDwellMs: 0 });
  await assisted.ingest(event('unrelated speech'));
  await assisted.flush();
  expect(calls).toBe(1);
  expect(assisted.view('outbound:call').kind).toBe('approved');
  expect(assisted.decision()).toMatchObject({
    cardId: 'affordability',
    source: 'selector',
    sourceVersion: 'fixture:reviewed-v1',
    scope,
  });
  expect(assisted.decision()?.pin).toBeUndefined();
  expect(JSON.stringify(assisted.view('outbound:call'))).not.toContain(
    'Never display',
  );
  assisted.dispose();
  baseline.dispose();
});
test('selector deadline aborts bounded work and malformed provider capability is rejected', async () => {
  expect(() =>
    createClosedSetSelector({
      providerRevision: 'fixture',
      modelRevision: 'v1',
      structuredOutput: false,
      run: async () => null,
    }),
  ).toThrow();
  let signal: AbortSignal | undefined,
    calls = 0;
  const selector = createClosedSetSelector({
    providerRevision: 'fixture',
    modelRevision: 'v1',
    structuredOutput: true,
    run: async (input) => {
      calls++;
      signal = input.signal;
      return new Promise(() => {});
    },
  });
  const assisted = session({
    selector,
    selectorDeadlineMs: 5,
    maxSelectorRequests: 1,
    contextIntervalMs: 0,
  });
  await assisted.ingest(event('unrelated speech'));
  await assisted.flush();
  expect(signal?.aborted).toBe(true);
  await assisted.ingest(event('more unrelated speech', 2));
  await assisted.flush();
  expect(calls).toBe(1);
  assisted.dispose();
});
