import { test, expect } from 'bun:test';
import { createDurableTranscriptSource } from '../runtime/coaching';
import { createCueService, type CallAdmission } from './cue-service';
import { createScriptSession, createClosedSetSelector } from './script-engine';
import { compilePlaybook, SYNTHETIC_LIFE_INSURANCE } from './playbooks';
import type { PlaybookStore, Publication } from './playbook-store';
import type { TranscriptSegment } from '../call-operations/contracts';
const scope = { workspaceId: 'w', callSessionId: 'call', callGeneration: 1 };
const binding = {
  participantId: 'customer',
  legId: 'leg',
  role: 'customer',
  provenance: 'authenticated-leg',
  bindingRevision: 1,
} as const;
const admission: CallAdmission = {
  scope,
  participants: [binding],
  active: true,
  audioOffsetMs: 0,
  audioOffsetsByStream: { one: 0, two: 1000 },
  policy: {
    scope,
    memberId: 'u',
    revision: 1,
    validUntilMs: 100000,
    revoked: false,
    capabilities: ['manual-reference', 'live-transcription', 'live-coaching'],
    consent: {
      ephemeralTranscription: true,
      retainedTranscript: false,
      aiGeneration: false,
    },
  },
};
const compiled = () =>
  compilePlaybook({
    workspaceId: 'w',
    scriptId: 'script',
    sourceRevision: 1,
    version: 1,
    title: 'Example',
    content: SYNTHETIC_LIFE_INSURANCE.content,
    rules: SYNTHETIC_LIFE_INSURANCE.rules,
    industryPackVersion: 'example',
    companyPolicyVersion: 'example',
  });
const segment = (n: number, streamSid: string): TranscriptSegment => ({
  id: 's' + n,
  workspaceId: 'w',
  sessionId: 'call',
  providerCallId: 'leg',
  sequence: n,
  idempotencyKey: 's' + n,
  track: 'inbound',
  speaker: 'customer',
  text: 'unrelated speech',
  startMs: 0,
  endMs: 900,
  language: null,
  confidence: null,
  provider: 'groq',
  model: 'fixture',
  createdAt: new Date(1000 * n).toISOString(),
  metadata: {
    schemaVersion: 1,
    sourceAudioStartMs: 0,
    sourceAudioEndMs: 1000,
    streamSid,
    timingBasis: 'provider-words',
    speakerProvenance: 'authenticated-leg',
    words: [],
    speechSegments: [],
  },
});
const event = (n: number, text = 'unrelated speech') => ({
  schemaVersion: 1 as const,
  kind: 'segment' as const,
  eventId: 'e' + n,
  scope,
  cursor: { sequence: n, epoch: 0 },
  observedAtMs: 1000 * n,
  source: { adapter: 'fixture' },
  segmentId: 's' + n,
  segmentRevision: 1,
  participantId: 'customer',
  legId: 'leg',
  speaker: {
    role: 'customer' as const,
    provenance: 'authenticated-leg' as const,
    bindingRevision: 1,
  },
  audioStartMs: 1000 * (n - 1),
  audioEndMs: 1000 * n,
  text,
  finality: 'final' as const,
});
const fakeStore = (mutations: { pins: number }): PlaybookStore => ({
  preview: async () => compiled(),
  publish: async () => ({
    version: 1,
    sourceRevision: 1,
    createdAt: 'now',
    compiled: compiled(),
  }),
  versions: async () => [],
  pin: async () => {
    mutations.pins++;
    return {
      version: 1,
      sourceRevision: 1,
      createdAt: 'now',
      compiled: compiled(),
    };
  },
  claim: async () => 1,
  archive: async () => {},
});
test('projection cleanup/generation isolates replay stream epochs', async () => {
  const rows = [
    { outbox_id: 'one', cursor: 1, segment: segment(1, 'one') },
    { outbox_id: 'two', cursor: 2, segment: segment(2, 'two') },
  ];
  const database = {
    query: async <T>(sql: string, values?: readonly unknown[]) => ({
      rows: (sql.includes('SELECT outbox')
        ? rows.filter((r) => r.cursor > Number(values?.[2]))
        : []) as T[],
    }),
  };
  const source = createDurableTranscriptSource(database),
    signal = new AbortController().signal;
  const first = await source.read({
    admission,
    afterCursor: 0,
    cursor: { sequence: 0, epoch: 0 },
    projectionId: 'generation-1',
    signal,
  });
  for (const row of first) await row.acknowledge?.();
  source.release?.('generation-1');
  const second = await source.read({
    admission,
    afterCursor: 0,
    cursor: { sequence: 0, epoch: 0 },
    projectionId: 'generation-2',
    signal,
  });
  expect(second[0]?.events).toHaveLength(1);
  expect(second[0]?.events[0]?.cursor).toEqual({ sequence: 1, epoch: 0 });
  source.release?.('generation-2');
});
test('inactive admission rejects before durable pin mutation', async () => {
  const mutations = { pins: 0 };
  const service = createCueService({
    store: fakeStore(mutations),
    nowMs: () => 1000,
    resolve: async () => ({ ...admission, active: false }),
  });
  await expect(
    service.open(
      { workspaceId: 'w', userId: 'u' },
      { scopeKey: 'outbound:call', scriptId: 'script' },
    ),
  ).rejects.toThrow();
  expect(mutations.pins).toBe(0);
  service.dispose();
});
test('renewal authorization failure aborts old selector work', async () => {
  let fail = false,
    signal: AbortSignal | undefined;
  const selector = createClosedSetSelector({
    providerRevision: 'fixture',
    modelRevision: 'v1',
    structuredOutput: true,
    run: async (input) => {
      signal = input.signal;
      return new Promise(() => {});
    },
  });
  const service = createCueService({
    store: fakeStore({ pins: 0 }),
    nowMs: () => 1000,
    selector,
    resolve: async () => {
      if (fail) throw new Error('authority unavailable');
      return admission;
    },
    source: { read: async () => [{ sourceCursor: 1, events: [event(1)] }] },
  });
  await service.open(
    { workspaceId: 'w', userId: 'u' },
    { scopeKey: 'outbound:call', scriptId: 'script' },
  );
  expect(signal?.aborted).toBe(false);
  fail = true;
  await expect(
    service.read({ workspaceId: 'w', userId: 'u' }, 'outbound:call'),
  ).rejects.toThrow();
  expect(signal?.aborted).toBe(true);
  service.dispose();
});
test('selector cannot choose valid but server-ineligible approved card', async () => {
  const plan = compiled();
  const restricted = {
    ...plan,
    rules: plan.rules.map((r) =>
      r.cardId === 'affordability' ? { ...r, required: ['approval code'] } : r,
    ),
  };
  const selector = createClosedSetSelector({
    providerRevision: 'fixture',
    modelRevision: 'v1',
    structuredOutput: true,
    run: async () => ({
      cardId: 'affordability',
      slotIds: ['affordability-1', 'affordability-2', 'affordability-3'],
      evidence: [{ segmentId: 's1', segmentRevision: 1 }],
      source: 'manual',
      pin: true,
    }),
  });
  const session = createScriptSession({
    scope,
    participants: [binding],
    compiled: restricted,
    policy: admission.policy,
    nowMs: () => 1000,
    selector,
    minimumDwellMs: 0,
  });
  await session.ingest(event(1));
  await session.flush();
  expect(session.view('outbound:call').kind).toBe('manual');
  session.dispose();
});
test('continuous fresh finals do not blanket-cancel context job; exact cursor still rejects stale result', async () => {
  let resolve: (value: unknown) => void = () => {},
    signal: AbortSignal | undefined;
  let calls = 0;
  const selector = createClosedSetSelector({
    providerRevision: 'fixture',
    modelRevision: 'v1',
    structuredOutput: true,
    run: async (input) => {
      calls++;
      signal = input.signal;
      return new Promise((r) => {
        resolve = r;
      });
    },
  });
  let now = 1000;
  const session = createScriptSession({
    scope,
    participants: [binding],
    compiled: compiled(),
    policy: admission.policy,
    nowMs: () => now,
    selector,
    contextIntervalMs: 15000,
    minimumDwellMs: 0,
  });
  await session.ingest(event(1));
  now = 3000;
  await session.ingest(event(2));
  expect(signal?.aborted).toBe(false);
  resolve({
    cardId: 'affordability',
    slotIds: ['affordability-1', 'affordability-2', 'affordability-3'],
    evidence: [{ segmentId: 's1', segmentRevision: 1 }],
  });
  await session.flush();
  expect(calls).toBe(1);
  expect(session.view('outbound:call').kind).toBe('manual');
  expect(session.diagnostics().selectorDiscards).toBeGreaterThan(0);
  session.dispose();
});

test('concurrent admission serializes claims and stale control cannot disable reopened projection', async () => {
  let generation = 0,
    claimCalls = 0,
    release: (value: number) => void = () => {};
  const store = fakeStore({ pins: 0 });
  store.claim = async (_identity, _scope, _owner, restart) => {
    claimCalls++;
    if (restart) {
      generation++;
      if (generation === 1)
        return new Promise((r) => {
          release = r;
        });
    }
    return generation;
  };
  const service = createCueService({
    store,
    nowMs: () => 1000,
    resolve: async () => admission,
  });
  const identity = { workspaceId: 'w', userId: 'u' },
    input = { scopeKey: 'outbound:call', scriptId: 'script' };
  const first = service.open(identity, input),
    second = service.open(identity, input);
  await new Promise((r) => setTimeout(r, 0));
  expect(claimCalls).toBe(1);
  release(1);
  const [a, b] = await Promise.all([first, second]);
  expect(a.projectionToken).toBeTruthy();
  expect(a.projectionToken).toBe(b.projectionToken);
  expect(generation).toBe(1);
  await service.control(identity, input.scopeKey, 'off', a.projectionToken);
  const reopened = await service.open(identity, input);
  expect(reopened.projectionToken).not.toBe(a.projectionToken);
  expect(generation).toBe(2);
  await expect(
    service.control(identity, input.scopeKey, 'off', a.projectionToken),
  ).rejects.toThrow();
  expect((await service.read(identity, input.scopeKey)).projectionToken).toBe(
    reopened.projectionToken,
  );
  service.dispose();
});

for (const loss of ['revoked', 'lease'] as const) {
  test(`authority loss after an in-flight source read rejects cached cue delivery: ${loss}`, async () => {
    let reading = false,
      lost = false;
    let finish!: () => void;
    let sourceSignal: AbortSignal | undefined;
    const released: string[] = [];
    const store = fakeStore({ pins: 0 });
    store.claim = async () => (lost && loss === 'lease' ? null : 1);
    const service = createCueService({
      store,
      nowMs: () => 1000,
      resolve: async () => ({
        ...admission,
        policy: { ...admission.policy, revoked: lost && loss === 'revoked' },
      }),
      source: {
        read: async ({ signal }) => {
          sourceSignal = signal;
          if (reading)
            await new Promise<void>((resolve) => {
              finish = resolve;
            });
          return [];
        },
        release: (id) => {
          released.push(id);
        },
      },
    });
    const identity = { workspaceId: 'w', userId: 'u' };
    await service.open(identity, {
      scopeKey: 'outbound:call',
      scriptId: 'script',
    });
    reading = true;
    const pending = service.read(identity, 'outbound:call');
    for (let i = 0; i < 10 && !finish; i++) await Promise.resolve();
    expect(finish).toBeDefined();
    lost = true;
    finish();
    await expect(pending).rejects.toThrow();
    expect(sourceSignal?.aborted).toBe(true);
    expect(released).toHaveLength(1);
    await expect(service.read(identity, 'outbound:call')).rejects.toThrow();
    service.dispose();
  });
}

test('a transient transcript source failure retains an authorized delayed projection', async () => {
  let fail = false;
  const service = createCueService({
    store: fakeStore({ pins: 0 }),
    nowMs: () => 1000,
    resolve: async () => admission,
    source: {
      read: async () => {
        if (fail) throw new Error('Source offline');
        return [];
      },
    },
  });
  const identity = { workspaceId: 'w', userId: 'u' };
  const opened = await service.open(identity, {
    scopeKey: 'outbound:call',
    scriptId: 'script',
  });
  fail = true;
  const result = await service.read(identity, 'outbound:call');
  expect(result.projectionToken).toBe(opened.projectionToken);
  expect(result.view?.status).toBe('delayed');
  service.dispose();
});

test('compiled playbook text, identifier, and card boundaries survive the UI wire parsers', async () => {
  const { parseMercuryPreview } =
    await import('../../../lead-connector/src/embed/mercury-authoring');
  const { parseMercuryResponse } =
    await import('../../../lead-connector/src/embed/mercury-feed-api');
  const compile = (content: string) =>
    compilePlaybook({
      workspaceId: 'w',
      scriptId: 'script',
      sourceRevision: 1,
      version: 1,
      title: 'Example',
      content,
      industryPackVersion: 'example',
      companyPolicyVersion: 'example',
    });
  const cue = (plan: ReturnType<typeof compile>) => ({
    publishedVersion: 'script:1',
    projectionToken: 'own-token',
    view: {
      scopeKey: 'outbound:call',
      revision: 1,
      kind: 'approved',
      status: 'manual',
      heading: plan.playbook.cards[0]!.title,
      points: plan.playbook.cards[0]!.slots.map((slot) => ({
        slotId: slot.id,
        text: slot.text,
        exact: slot.source.excerpt,
        source: slot.source.documentId,
      })),
    },
  });
  for (const length of [200, 201, 256]) {
    const plan = compile(`# Card\n- ${'a'.repeat(length)}\n- second\n- third`);
    expect(
      parseMercuryPreview({ preview: plan }).cards[0]!.points[0]!.text,
    ).toHaveLength(length);
    expect(
      parseMercuryResponse(cue(plan), 'outbound:call').view?.points[0]!.text,
    ).toHaveLength(length);
  }
  expect(() =>
    compile(`# Card\n- ${'a'.repeat(257)}\n- second\n- third`),
  ).toThrow();
  const invalid = compile('# Card\n- first\n- second\n- third');
  const malformed = JSON.parse(JSON.stringify(invalid));
  malformed.playbook.cards[0].slots[0].text = 'a'.repeat(257);
  expect(() => parseMercuryPreview({ preview: malformed })).toThrow();
  const malformedCue = cue(invalid);
  malformedCue.view.points[0]!.text = 'a'.repeat(257);
  expect(() => parseMercuryResponse(malformedCue, 'outbound:call')).toThrow();
  for (const headingLength of [118, 119, 126]) {
    const plan = compile(
      `# ${'a'.repeat(headingLength)}\n- first\n- second\n- third`,
    );
    expect(
      parseMercuryResponse(cue(plan), 'outbound:call').view?.points[0]!.slotId,
    ).toHaveLength(headingLength + 2);
  }
  for (const cards of [256, 257, 512]) {
    const plan = compile(
      Array.from(
        { length: cards },
        (_, i) => `# Card ${i}\n- first\n- second\n- third`,
      ).join('\n'),
    );
    expect(parseMercuryPreview({ preview: plan }).cards).toHaveLength(cards);
  }
  const tooMany = {
    preview: {
      playbook: {
        cards: Array.from({ length: 513 }, (_, i) => ({
          ...invalid.playbook.cards[0],
          id: 'card-' + i,
        })),
      },
    },
  };
  expect(() => parseMercuryPreview(tooMany)).toThrow();
});

test('valid compiled previews larger than 256 KiB survive authenticated authoring transport', async () => {
  const { createMercuryAuthoringApi } =
    await import('../../../lead-connector/src/embed/mercury-authoring');
  const content = Array.from(
    { length: 100 },
    (_, i) =>
      `# Card ${i}\n${Array.from({ length: 4 }, () => '- ' + 'a'.repeat(150)).join('\n')}`,
  ).join('\n');
  const plan = compilePlaybook({
    workspaceId: 'w',
    scriptId: 'script',
    sourceRevision: 1,
    version: 1,
    title: 'Example',
    content,
    industryPackVersion: 'example',
    companyPolicyVersion: 'example',
  });
  const body = JSON.stringify({ preview: plan, expectedPublishedVersion: 0 });
  expect(new TextEncoder().encode(content).length).toBeLessThanOrEqual(100000);
  expect(new TextEncoder().encode(body).length).toBeGreaterThan(262144);
  const api = createMercuryAuthoringApi({
    baseUrl: 'https://example.test',
    getToken: () => 'fixture',
    fetch: async () => new Response(body),
  });
  expect((await api.preview('script', 1)).cards).toHaveLength(100);
  const oversized = createMercuryAuthoringApi({
    baseUrl: 'https://example.test',
    getToken: () => 'fixture',
    fetch: async () => new Response(' '.repeat(4 * 1024 * 1024 + 1)),
  });
  await expect(oversized.preview('script', 1)).rejects.toThrow();
});
