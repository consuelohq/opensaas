import { expect, it, mock } from 'bun:test';
import {
  createMercuryFeedApi,
  parseMercuryResponse,
  type MercuryFeedApi,
} from './mercury-feed-api';
import { createMercuryFeed } from './mercury-feed';
import type { MercuryCueView } from './mercury-cues';
const view = (scopeKey = 'outbound:a', revision = 1): MercuryCueView => ({
  scopeKey,
  revision,
  kind: 'approved',
  status: 'manual',
  heading: 'Family priorities',
  points: [
    {
      slotId: 'one',
      text: 'Ask about family',
      exact: 'Who depends on your income?',
      source: 'Approved playbook v1',
    },
  ],
});
const response = (scope = 'outbound:a', revision = 1) => ({
  view: view(scope, revision),
  publishedVersion: 'script:1',
  projectionToken: 'opaque:' + scope,
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

it('validates every untrusted presentation field before delivery', () => {
  expect(parseMercuryResponse(response(), 'outbound:a').view?.status).toBe(
    'manual',
  );
  for (const change of [
    { scopeKey: 'other' },
    { revision: NaN },
    { revision: 1.2 },
    { kind: 'ai' },
    { status: 'invented' },
    { heading: 'x'.repeat(201) },
    {
      points: [
        { slotId: 'one', text: 'x'.repeat(201), exact: 'x', source: 'v1' },
      ],
    },
  ]) {
    expect(() =>
      parseMercuryResponse(
        { ...response(), view: { ...view(), ...change } },
        'outbound:a',
      ),
    ).toThrow();
  }
  expect(() =>
    parseMercuryResponse({ ...response(), publishedVersion: '' }, 'outbound:a'),
  ).toThrow();
  expect(() =>
    parseMercuryResponse(
      {
        ...response(),
        view: { ...view(), points: [view().points[0], view().points[0]] },
      },
      'outbound:a',
    ),
  ).toThrow();
});

it('uses encoded authenticated app contracts with no transcript or provider input', async () => {
  const requests: Request[] = [];
  const api = createMercuryFeedApi({
    baseUrl: 'https://example.test',
    getToken: () => 'fixture-token',
    fetch: async (input, init) => {
      const r = new Request(input, init);
      requests.push(r);
      return new Response(JSON.stringify(response('inbound:a:3')), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await api.start({ scopeKey: 'inbound:a:3', scriptId: 'script' });
  await api.read('inbound:a:3', 1);
  await api.control('inbound:a:3', 'off', 'opaque:inbound:a:3');
  expect(requests.map((r) => new URL(r.url).pathname)).toEqual([
    '/v1/coaching/sessions',
    '/v1/coaching/sessions/inbound%3Aa%3A3/cue',
    '/v1/coaching/sessions/inbound%3Aa%3A3/control',
  ]);
  expect(requests[1]?.url).toContain('afterRevision=1');
  expect(
    requests.every(
      (r) => r.headers.get('authorization') === 'Bearer fixture-token',
    ),
  ).toBe(true);
  expect(await requests[0]!.json()).toEqual({
    scopeKey: 'inbound:a:3',
    scriptId: 'script',
  });
  expect(await requests[2]!.json()).toEqual({
    action: 'off',
    projectionToken: 'opaque:inbound:a:3',
  });
});

it('ignores old fetches on caller change and keeps polling non-overlapping', async () => {
  let resolveStart!: (v: ReturnType<typeof response>) => void;
  const api: MercuryFeedApi = {
    start: mock(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          resolveStart = resolve;
        }),
    ),
    read: mock(async () => response('outbound:b', 2)),
    control: mock(async (scope) => response(scope, 3)),
  };
  const delivered: MercuryCueView[] = [];
  const scheduled: Array<() => void> = [];
  const feed = createMercuryFeed({
    api,
    onView: (v) => {
      if (v) delivered.push(v);
    },
    onStatus: () => {},
    schedule: (fn) => {
      scheduled.push(fn);
      return () => {};
    },
  });
  feed.configure({
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  const old = resolveStart;
  feed.configure({
    scopeKey: 'outbound:b',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  expect(api.start).toHaveBeenCalledTimes(1);
  old(response());
  await flush();
  const next = resolveStart;
  expect(delivered).toHaveLength(0);
  next(response('outbound:b'));
  await flush();
  expect(delivered.at(-1)?.scopeKey).toBe('outbound:b');
  expect(scheduled).toHaveLength(1);
  scheduled.shift()!();
  await flush();
  expect(api.read).toHaveBeenCalledTimes(1);
  expect(scheduled).toHaveLength(1);
  feed.dispose();
  await flush();
});

it('sends Off and awaits cleanup before same-call re-admission; late polls never repaint', async () => {
  let readDone!: (v: ReturnType<typeof response>) => void;
  let offDone!: (v: ReturnType<typeof response>) => void;
  const api: MercuryFeedApi = {
    start: mock(async () => response()),
    read: mock(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          readDone = resolve;
        }),
    ),
    control: mock(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          offDone = resolve;
        }),
    ),
  };
  const delivered: Array<MercuryCueView | null> = [];
  const scheduled: Array<() => void> = [];
  const feed = createMercuryFeed({
    api,
    onView: (v) => delivered.push(v),
    onStatus: () => {},
    schedule: (fn) => {
      scheduled.push(fn);
      return () => {};
    },
  });
  const config = {
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  };
  feed.configure(config);
  await flush();
  scheduled.shift()!();
  await flush();
  feed.configure({ ...config, enabled: false });
  await flush();
  expect(api.control).toHaveBeenCalledWith(
    'outbound:a',
    'off',
    'opaque:outbound:a',
    expect.any(AbortSignal),
  );
  feed.configure(config);
  await flush();
  expect(api.start).toHaveBeenCalledTimes(1);
  readDone(response('outbound:a', 9));
  await flush();
  expect(delivered.at(-1)).toBeNull();
  offDone(response('outbound:a', 2));
  await flush();
  expect(api.start).toHaveBeenCalledTimes(2);
  expect(delivered.at(-1)?.revision).toBe(1);
  feed.dispose();
});

it('preserves manual/unavailable truth and clears assistance on denial without touching telephony', async () => {
  const statuses: string[] = [];
  const delivered: Array<MercuryCueView | null> = [];
  const api: MercuryFeedApi = {
    start: mock(async () => response()),
    read: mock(async () => {
      throw Object.assign(new Error('denied'), { status: 403 });
    }),
    control: mock(async (scope) => response(scope)),
  };
  const scheduled: Array<() => void> = [];
  const feed = createMercuryFeed({
    api,
    onView: (v) => delivered.push(v),
    onStatus: (s) => statuses.push(s),
    schedule: (fn) => {
      scheduled.push(fn);
      return () => {};
    },
  });
  feed.configure({
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  expect(delivered.at(-1)?.status).toBe('manual');
  scheduled.shift()!();
  await flush();
  expect(statuses.at(-1)).toBe('denied');
  expect(delivered.at(-1)).toBeNull();
  expect(scheduled).toHaveLength(0);
  feed.dispose();
});

it('keeps HTTP denial authoritative even with a malformed error body and rejects oversized successful bodies', async () => {
  const denied = createMercuryFeedApi({
    baseUrl: 'https://example.test',
    getToken: () => 'fixture',
    fetch: async () => new Response('not JSON', { status: 403 }),
  });
  await expect(
    denied.start({ scopeKey: 'outbound:a', scriptId: 'script' }),
  ).rejects.toMatchObject({ status: 403 });
  const oversized = createMercuryFeedApi({
    baseUrl: 'https://example.test',
    getToken: () => 'fixture',
    fetch: async () => new Response('x'.repeat(262145)),
  });
  await expect(
    oversized.start({ scopeKey: 'outbound:a', scriptId: 'script' }),
  ).rejects.toThrow('could not be verified');
  const fetcher = mock(async () => new Response('{}'));
  const missing = createMercuryFeedApi({
    baseUrl: 'https://example.test',
    getToken: () => null,
    fetch: fetcher,
  });
  await expect(
    missing.start({ scopeKey: 'outbound:a', scriptId: 'script' }),
  ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('never replaces a pinned published version and coalesces repeated remote controls', async () => {
  let finishControl!: (value: ReturnType<typeof response>) => void;
  const api: MercuryFeedApi = {
    start: mock(async () => response()),
    read: mock(async () => ({
      ...response('outbound:a', 2),
      publishedVersion: 'foreign:2',
    })),
    control: mock(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          finishControl = resolve;
        }),
    ),
  };
  const delivered: Array<MercuryCueView | null> = [];
  const scheduled: Array<() => void> = [];
  const feed = createMercuryFeed({
    api,
    onView: (v) => delivered.push(v),
    onStatus: () => {},
    schedule: (fn) => {
      scheduled.push(fn);
      return () => {};
    },
  });
  feed.configure({
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  scheduled.shift()!();
  await flush();
  expect(delivered.at(-1)?.revision).toBe(1);
  const pin = feed.control('pin');
  const duplicate = feed.control('pin');
  await flush();
  expect(api.control).toHaveBeenCalledTimes(1);
  finishControl(response('outbound:a', 3));
  await Promise.all([pin, duplicate]);
  expect(delivered.at(-1)?.revision).toBe(3);
  feed.dispose();
});

it('does not let a definitively denied admission block assistance for the next eligible caller', async () => {
  let starts = 0;
  const api: MercuryFeedApi = {
    start: async (command) => {
      if (++starts === 1)
        throw Object.assign(new Error('denied'), { status: 403 });
      return response(command.scopeKey);
    },
    read: async (scope) => response(scope),
    control: mock(async () => {
      throw Object.assign(new Error('not owned'), { status: 403 });
    }),
  };
  const delivered: Array<MercuryCueView | null> = [];
  const feed = createMercuryFeed({
    api,
    onView: (v) => delivered.push(v),
    onStatus: () => {},
    schedule: () => () => {},
  });
  feed.configure({
    scopeKey: 'inbound:a:1',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  feed.configure({
    scopeKey: 'outbound:b',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  expect(starts).toBe(2);
  expect(delivered.at(-1)?.scopeKey).toBe('outbound:b');
  expect(api.control).not.toHaveBeenCalled();
  feed.dispose();
});

it('requires opaque projection tokens and never adopts a different projection from an old poll', async () => {
  expect(() =>
    parseMercuryResponse({ ...response(), projectionToken: '' }, 'outbound:a'),
  ).toThrow();
  expect(() =>
    parseMercuryResponse(
      { ...response(), projectionToken: undefined },
      'outbound:a',
    ),
  ).toThrow();
  const delivered: Array<MercuryCueView | null> = [];
  const scheduled: Array<() => void> = [];
  const api: MercuryFeedApi = {
    start: async () => response(),
    read: async () => ({
      ...response('outbound:a', 9),
      projectionToken: 'foreign-projection',
    }),
    control: mock(async (scope) => response(scope, 2)),
  };
  const feed = createMercuryFeed({
    api,
    onView: (v) => delivered.push(v),
    onStatus: () => {},
    schedule: (fn) => {
      scheduled.push(fn);
      return () => {};
    },
  });
  feed.configure({
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  });
  await flush();
  scheduled.shift()!();
  await flush();
  expect(delivered.at(-1)?.revision).toBe(1);
  await feed.control('pin');
  expect(api.control).toHaveBeenCalledWith(
    'outbound:a',
    'pin',
    'opaque:outbound:a',
    expect.any(AbortSignal),
  );
  feed.dispose();
});

it('recovers an unknown admission token through an authorized read before sending Off', async () => {
  const api: MercuryFeedApi = {
    start: mock(async () => {
      throw new Error('Response lost after possible commit');
    }),
    read: mock(async () => response()),
    control: mock(async (scope) => response(scope)),
  };
  const feed = createMercuryFeed({
    api,
    onView: () => {},
    onStatus: () => {},
    schedule: () => () => {},
  });
  const config = {
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  };
  feed.configure(config);
  await flush();
  feed.configure({ ...config, enabled: false });
  await flush();
  expect(api.read).toHaveBeenCalledWith(
    'outbound:a',
    0,
    expect.any(AbortSignal),
  );
  expect(api.control).toHaveBeenCalledWith(
    'outbound:a',
    'off',
    'opaque:outbound:a',
    expect.any(AbortSignal),
  );
});

it('uses the newly admitted opaque token after same-call Off and reopen', async () => {
  let generation = 0;
  const api: MercuryFeedApi = {
    start: mock(async () => ({
      ...response(),
      projectionToken: 'token-' + ++generation,
    })),
    read: mock(async () => ({
      ...response(),
      projectionToken: 'token-' + generation,
    })),
    control: mock(async (scope, _action, token) => ({
      ...response(scope, 2),
      projectionToken: token,
    })),
  };
  const feed = createMercuryFeed({
    api,
    onView: () => {},
    onStatus: () => {},
    schedule: () => () => {},
  });
  const config = {
    scopeKey: 'outbound:a',
    scriptId: 'script',
    enabled: true,
    authEpoch: 'one',
  };
  feed.configure(config);
  await flush();
  feed.configure({ ...config, enabled: false });
  await flush();
  feed.configure(config);
  await flush();
  await feed.control('pin');
  expect(api.control).toHaveBeenNthCalledWith(
    1,
    'outbound:a',
    'off',
    'token-1',
    expect.any(AbortSignal),
  );
  expect(api.control).toHaveBeenNthCalledWith(
    2,
    'outbound:a',
    'pin',
    'token-2',
    expect.any(AbortSignal),
  );
  feed.dispose();
});
