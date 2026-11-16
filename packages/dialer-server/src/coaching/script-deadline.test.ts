import { expect, test } from 'bun:test';
import { compilePlaybook } from './playbooks';
import {
  createClosedSetSelector,
  createScriptSession,
  type ScriptSessionOptions,
} from './script-engine';
import { createContextScheduler } from './context-scheduler';
import {
  fixtureParticipants,
  fixtureScope,
  segment,
} from '../coaching-replay/transcript';

const scope = fixtureScope(1);
const compiled = compilePlaybook({
  workspaceId: scope.workspaceId,
  scriptId: 'deadline-script',
  sourceRevision: 1,
  version: 1,
  title: 'Approved',
  industryPackVersion: 'fixture',
  companyPolicyVersion: 'fixture',
  content:
    '# Opening\n- One\n- Two\n- Three\n# Concern\n- Ask\n- Listen\n- Clarify',
  rules: [
    { cardId: 'opening', aliases: ['opening trigger'], priority: 1 },
    { cardId: 'concern', aliases: ['specific trigger'], priority: 2 },
  ],
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const clock = () => ({ mono: 0, wall: 1000 });
function create(
  time: ReturnType<typeof clock>,
  run: Parameters<typeof createClosedSetSelector>[0]['run'],
  extra: Partial<ScriptSessionOptions> = {},
) {
  return createScriptSession({
    scope,
    compiled,
    participants: fixtureParticipants,
    nowMs: () => time.wall,
    monotonicNowMs: () => time.mono,
    minimumDwellMs: 0,
    contextIntervalMs: 0,
    scheduler: createContextScheduler(),
    selector: createClosedSetSelector({
      providerRevision: 'fixture',
      modelRevision: 'fixture',
      structuredOutput: true,
      run,
    }),
    policy: {
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
    },
    ...extra,
  });
}
const answer = (segmentId = 'first') => ({
  cardId: 'concern',
  slotIds: ['concern-1', 'concern-2', 'concern-3'],
  evidence: [{ segmentId, segmentRevision: 1 }],
});

test('queue plus provider time shares the original monotonic ingest deadline', async () => {
  const time = clock(),
    block = deferred<void>(),
    reply = deferred<unknown>(),
    scheduler = createContextScheduler({ concurrency: 1 });
  const busy = scheduler.enqueue({}, async () => block.promise);
  const s = create(time, async () => reply.promise, { scheduler });
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'A current issue in unfamiliar wording',
        segmentId: 'first',
      }),
    );
    time.mono = 4200;
    block.resolve();
    await tick();
    expect(s.diagnostics().requests).toBe(1);
    time.mono = 5100;
    reply.resolve(answer());
    await s.flush();
    expect(s.decision()).toBeNull();
    expect(s.diagnostics().selectorDiscards).toBe(1);
    expect(s.diagnostics().selectorTrace).toMatchObject([
      {
        request: 1,
        queueMs: 4200,
        decisionMs: 900,
        cueAgeMs: 5100,
        outcome: 'expired',
      },
    ]);
    const trace = s.diagnostics().selectorTrace;
    trace[0]!.evidenceTurnIndices.push(999);
    expect(s.diagnostics().selectorTrace[0]!.evidenceTurnIndices).not.toContain(
      999,
    );
  } finally {
    reply.resolve(null);
    block.resolve();
    await busy;
    s.dispose();
  }
});
test('expired queue evidence never starts a provider request', async () => {
  const time = clock(),
    block = deferred<void>(),
    scheduler = createContextScheduler({ concurrency: 1 });
  const busy = scheduler.enqueue({}, async () => block.promise);
  let calls = 0;
  const s = create(
    time,
    async () => {
      calls++;
      return answer();
    },
    { scheduler },
  );
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'An unfamiliar current concern',
        segmentId: 'first',
      }),
    );
    time.mono = 5001;
    block.resolve();
    await s.flush();
    expect(calls).toBe(0);
    expect(s.decision()).toBeNull();
  } finally {
    block.resolve();
    await busy;
    s.dispose();
  }
});
test('a same-party exact repeat does not renew old evidence age', async () => {
  const time = clock(),
    reply = deferred<unknown>();
  const s = create(time, async () => reply.promise);
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'An unfamiliar current concern',
        segmentId: 'first',
      }),
    );
    time.mono = 4900;
    await s.ingest(
      segment(scope, 2, 0, {
        text: 'An unfamiliar current concern',
        segmentId: 'repeat',
      }),
    );
    time.mono = 5001;
    reply.resolve(answer());
    await s.flush();
    expect(s.decision()).toBeNull();
  } finally {
    reply.resolve(null);
    s.dispose();
  }
});
test('new meaningful queued speech receives its own ingest deadline', async () => {
  const time = clock(),
    block = deferred<void>(),
    scheduler = createContextScheduler({ concurrency: 1 });
  const busy = scheduler.enqueue({}, async () => block.promise);
  const s = create(time, async () => answer('fresh'), { scheduler });
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'The first unfamiliar current concern',
        segmentId: 'first',
      }),
    );
    time.mono = 4900;
    await s.ingest(
      segment(scope, 2, 0, {
        text: 'A different current concern needing clarity',
        segmentId: 'fresh',
      }),
    );
    time.mono = 5100;
    block.resolve();
    await s.flush();
    expect(s.decision()?.cardId).toBe('concern');
  } finally {
    block.resolve();
    await busy;
    s.dispose();
  }
});
test('an end-to-end queue lease expires without releasing the occupied physical slot', async () => {
  const time = clock(),
    block = deferred<void>(),
    scheduler = createContextScheduler({ concurrency: 1 });
  const busy = scheduler.enqueue({}, async () => block.promise);
  let calls = 0;
  const s = create(
    time,
    async () => {
      calls++;
      return answer();
    },
    { scheduler, cueMaxAgeMs: 10 },
  );
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'An unfamiliar current concern',
        segmentId: 'first',
      }),
    );
    const ended = await Promise.race([
      s.flush().then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 50)),
    ]);
    expect(ended).toBe(true);
    expect(calls).toBe(0);
    expect(scheduler.diagnostics()).toMatchObject({ active: 1, waiting: 0 });
  } finally {
    s.dispose();
    block.resolve();
    await busy;
  }
});
test('referenced historical evidence cannot justify a current unrelated cue', async () => {
  const time = clock(),
    reply = deferred<unknown>();
  const s = create(time, async () => reply.promise);
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'My former supplier provided this service.',
        segmentId: 'history',
      }),
    );
    await s.flush();
    await tick();
    time.mono = 10;
    await s.ingest(
      segment(scope, 2, 0, {
        text: 'A current issue needs clarification',
        segmentId: 'fresh',
      }),
    );
    reply.resolve(answer('history'));
    await s.flush();
    expect(s.decision()).toBeNull();
  } finally {
    reply.resolve(null);
    s.dispose();
  }
});

test('current evidence remains usable when required context arrives in a later turn', async () => {
  const time = clock();
  let calls = 0;
  const required = compilePlaybook({
    workspaceId: scope.workspaceId,
    scriptId: 'required-script',
    sourceRevision: 1,
    version: 1,
    title: 'Approved',
    industryPackVersion: 'fixture',
    companyPolicyVersion: 'fixture',
    content:
      '# Opening\n- One\n- Two\n- Three\n# Concern\n- Ask\n- Listen\n- Clarify',
    rules: [
      {
        cardId: 'concern',
        aliases: ['specific trigger'],
        required: ['permission granted'],
        priority: 2,
      },
    ],
  });
  const s = create(
    time,
    async () => {
      calls++;
      return answer('first');
    },
    { compiled: required },
  );
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'A current issue in unfamiliar wording',
        segmentId: 'first',
      }),
    );
    await s.flush();
    await tick();
    expect(calls).toBe(0);
    time.mono = 10;
    await s.ingest(
      segment(scope, 2, 0, {
        text: 'Permission granted',
        segmentId: 'permission',
      }),
    );
    await s.flush();
    expect(s.decision()?.cardId).toBe('concern');
  } finally {
    s.dispose();
  }
});

test('logical deadline is reported as expiry while physical work remains owned', async () => {
  const time = clock(),
    reply = deferred<unknown>();
  const s = create(time, async () => reply.promise, { cueMaxAgeMs: 10 });
  try {
    await s.ingest(
      segment(scope, 1, 0, {
        text: 'An unfamiliar current concern',
        segmentId: 'first',
      }),
    );
    await s.flush();
    expect(s.diagnostics().selectorTrace[0]).toMatchObject({
      outcome: 'expired',
      requestMs: null,
    });
    expect(s.diagnostics().transportUnsettled).toBe(true);
    expect(s.diagnostics().scheduler.active).toBe(1);
  } finally {
    reply.resolve(null);
    await tick();
    s.dispose();
  }
});

test('a lower-priority selector cannot replace a stronger current authored match', async () => {
  const time = clock();
  const priority = compilePlaybook({
    workspaceId: scope.workspaceId,
    scriptId: 'priority-script',
    sourceRevision: 1,
    version: 1,
    title: 'Approved',
    industryPackVersion: 'fixture',
    companyPolicyVersion: 'fixture',
    content:
      '# Opening\n- One\n- Two\n- Three\n# Concern\n- Ask\n- Listen\n- Clarify',
    rules: [
      { cardId: 'opening', aliases: ['opening trigger'], priority: 90 },
      { cardId: 'concern', aliases: ['specific trigger'], priority: 2 },
    ],
  });
  const s = create(time, async () => answer(), { compiled: priority });
  try {
    await s.ingest(
      segment(scope, 1, 0, { text: 'opening trigger', segmentId: 'first' }),
    );
    await s.flush();
    expect(s.decision()?.cardId).toBe('opening');
    expect(s.diagnostics().selectorTrace[0]?.outcome).toBe('rule-priority');
  } finally {
    s.dispose();
  }
});
