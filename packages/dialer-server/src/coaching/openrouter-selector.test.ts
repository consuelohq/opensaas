import { describe, expect, test } from 'bun:test';
import { createOpenRouterSelector } from './openrouter-selector';
import type { ClosedSetSelectorInput } from './context-selector';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type FixtureInput = {
  catalog: Mutable<ClosedSetSelectorInput['catalog']>;
  cards: Mutable<ClosedSetSelectorInput['cards'][number]>[];
  turns: {
    id: string;
    revision: number;
    role: 'rep' | 'customer';
    text: string;
  }[];
  signal: AbortSignal;
};
type RequestBody = {
  model: string;
  provider: {
    require_parameters: boolean;
    allow_fallbacks: boolean;
    data_collection: string;
    only: string[];
  };
  max_tokens: number;
  response_format: {
    type: string;
    json_schema: { strict: boolean; schema: Record<string, unknown> };
  };
  messages: { role: string; content: string }[];
};

const secret = 'synthetic-secret-never-return';
const config = () => ({
  model: 'vendor/model-v1',
  providerRevision: 'router-config-v1',
  allowedRequestProviderTags: ['approved-provider'],
  allowedResponseProviderNames: ['approved-provider'],
  allowedResponseModels: ['vendor/model-v1'],
  getApiKey: () => secret,
});
const input = (): FixtureInput => ({
  catalog: {
    workspaceId: 'tenant-a',
    playbookId: 'playbook-a',
    publishedVersion: 'v1',
    sourceRevision: 1,
    industryPackVersion: 'industry-v1',
    companyPolicyVersion: 'policy-v1',
  },
  cards: [
    {
      cardId: 'price',
      title: 'Price',
      slotIds: ['price-1'],
      slots: [
        {
          slotId: 'price-1',
          text: 'Ask about budget',
          source: { documentId: 'doc', revision: '1' },
        },
      ],
      matching: {
        aliases: ['cost'],
        required: [],
        forbidden: [],
        speaker: 'customer',
        priority: 1,
      },
    },
    {
      cardId: 'family',
      title: 'Family',
      slotIds: ['family-1'],
      slots: [
        {
          slotId: 'family-1',
          text: 'Invite questions',
          source: { documentId: 'doc', revision: '1' },
        },
      ],
      matching: {
        aliases: ['spouse'],
        required: [],
        forbidden: [],
        speaker: 'customer',
        priority: 1,
      },
    },
  ],
  turns: [{ id: 'seg-1', revision: 1, role: 'customer', text: 'How much?' }],
  signal: new AbortController().signal,
});
const selection = {
  cardId: 'price',
  slotIds: ['price-1'],
  evidence: [{ segmentId: 'seg-1', segmentRevision: 1 }],
};
const result = (value: unknown, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      model: 'vendor/model-v1',
      provider: 'approved-provider',
      choices: [
        {
          finish_reason: 'stop',
          message: { role: 'assistant', content: JSON.stringify(value) },
        },
      ],
      ...extra,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('OpenRouter closed-set selector', () => {
  test('copies explicit price ceilings into routing and never enables remote caching', async () => {
    let sent: Record<string, unknown> = {};
    const cfg = {
      ...config(),
      maxPriceUsdPerMillionTokens: { prompt: 1, completion: 5 },
    };
    const selector = createOpenRouterSelector({
      ...cfg,
      fetch: (async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return result(selection);
      }) as unknown as typeof globalThis.fetch,
    });
    cfg.maxPriceUsdPerMillionTokens.prompt = 99;
    cfg.maxPriceUsdPerMillionTokens.completion = 99;
    await selector.select(input());
    expect((sent.provider as Record<string, unknown>).max_price).toEqual({
      prompt: 1,
      completion: 5,
    });
    expect(Object.keys(sent).sort()).toEqual([
      'max_tokens',
      'messages',
      'model',
      'provider',
      'response_format',
    ]);
    const allKeys = (value: unknown): string[] =>
      Array.isArray(value)
        ? value.flatMap(allKeys)
        : value && typeof value === 'object'
          ? Object.entries(value).flatMap(([key, child]) => [
              key,
              ...allKeys(child),
            ])
          : [];
    expect(allKeys(sent)).not.toContain('cache_control');
    expect(allKeys(sent)).not.toContain('prompt_cache_breakpoint');
    expect(selector.sourceVersion).not.toBe(
      createOpenRouterSelector({
        ...config(),
        maxPriceUsdPerMillionTokens: { prompt: 2, completion: 5 },
        fetch: globalThis.fetch,
      }).sourceVersion,
    );
    for (const prompt of [NaN, Infinity, -1]) {
      expect(() =>
        createOpenRouterSelector({
          ...config(),
          maxPriceUsdPerMillionTokens: { prompt, completion: 5 },
          fetch: globalThis.fetch,
        }),
      ).toThrow('CONFIG');
    }
  });
  test('keeps request provider tags distinct from response provider names', async () => {
    let sent: unknown;
    const selector = createOpenRouterSelector({
      ...config(),
      allowedRequestProviderTags: ['anthropic'],
      allowedResponseProviderNames: ['Anthropic'],
      fetch: (async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body)).provider.only;
        return result(selection, { provider: 'Anthropic' });
      }) as unknown as typeof globalThis.fetch,
    });
    expect(await selector.select(input())).toEqual(selection);
    expect(sent).toEqual(['anthropic']);
    const wrongName = createOpenRouterSelector({
      ...config(),
      allowedRequestProviderTags: ['anthropic'],
      allowedResponseProviderNames: ['Anthropic'],
      fetch: (async () =>
        result(selection, {
          provider: 'anthropic',
        })) as unknown as typeof globalThis.fetch,
    });
    await expect(wrongName.select(input())).rejects.toMatchObject({
      code: 'RESPONSE',
    });
  });
  test('sends scoped data and a strict enum schema through approved routing', async () => {
    let request:
      { url: string; body: RequestBody; headers: Headers } | undefined;
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
      request = {
        url: String(url),
        body: JSON.parse(String(init?.body)),
        headers: new Headers(init?.headers),
      };
      return result(selection);
    };
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    expect(await selector.select(input())).toEqual(selection);
    expect(request!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(request!.headers.get('authorization')).toBe('Bearer ' + secret);
    expect(request!.body.provider).toEqual({
      require_parameters: true,
      allow_fallbacks: false,
      data_collection: 'deny',
      only: ['approved-provider'],
    });
    expect(request!.body.model).toBe('vendor/model-v1');
    expect(request!.body.max_tokens).toBe(512);
    expect(request!.body.response_format.type).toBe('json_schema');
    expect(request!.body.response_format.json_schema.strict).toBe(true);
    const schema = request!.body.response_format.json_schema.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).toContain('price-1');
    expect(JSON.stringify(schema)).toContain('seg-1');
    expect(JSON.stringify(request!.body.messages)).not.toContain('tenant-a');
    expect(JSON.stringify(request!.body.messages)).toContain(
      'Ask about budget',
    );
    expect(JSON.stringify(request!.body)).not.toContain(secret);
  });

  test('accepts explicit abstention', async () => {
    const value = { cardId: null, slotIds: [], evidence: [] };
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: (async () => result(value)) as unknown as typeof globalThis.fetch,
    });
    expect(await selector.select(input())).toEqual(value);
  });

  test('rejects unsupported and malformed output with redacted errors', async () => {
    const bad = [
      { ...selection, wording: 'invented' },
      { ...selection, cardId: 'other' },
      { ...selection, slotIds: ['family-1'] },
      { ...selection, slotIds: ['price-1', 'price-1'] },
      { ...selection, evidence: [{ segmentId: 'seg-1', segmentRevision: 2 }] },
      {
        ...selection,
        evidence: [selection.evidence[0], selection.evidence[0]],
      },
      { cardId: null, slotIds: ['price-1'], evidence: [] },
      { ...selection, evidence: [] },
      'free-form generated words',
    ];
    for (const value of bad) {
      const selector = createOpenRouterSelector({
        ...config(),
        fetch: (async () =>
          result(value)) as unknown as typeof globalThis.fetch,
      });
      await expect(selector.select(input())).rejects.toThrow();
    }
    for (const response of [
      result(selection, { model: 'other' }),
      result(selection, { provider: 'other' }),
      result(selection, { choices: [] }),
      result(selection, {
        choices: [
          {
            finish_reason: 'length',
            message: { role: 'assistant', content: '{}' },
          },
        ],
      }),
      result(selection, {
        choices: [
          {
            finish_reason: 'stop',
            message: { role: 'assistant', refusal: 'no', content: '{}' },
          },
        ],
      }),
      new Response('invalid ' + secret, { status: 200 }),
      new Response(secret, { status: 429 }),
      new Response(secret, { status: 500 }),
    ]) {
      let calls = 0;
      const selector = createOpenRouterSelector({
        ...config(),
        fetch: (async () => {
          calls++;
          return response;
        }) as unknown as typeof globalThis.fetch,
      });
      try {
        await selector.select(input());
        throw new Error('unexpected success');
      } catch (e: unknown) {
        expect(String(e)).not.toContain(secret);
        expect(String(e)).not.toContain('unexpected success');
      }
      expect(calls).toBe(1);
    }
  });

  test('enforces input and response bounds even with a lying content length', async () => {
    let calls = 0;
    const fetch = (async () => {
      calls++;
      return new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array(65537));
            c.close();
          },
        }),
        { headers: { 'content-length': '1' } },
      );
    }) as unknown as typeof globalThis.fetch;
    const selector = createOpenRouterSelector({ ...config(), fetch });
    await expect(selector.select(input())).rejects.toThrow();
    const huge = input();
    huge.turns[0]!.text = 'x'.repeat(8001);
    await expect(selector.select(huge)).rejects.toThrow();
    const invalid = input();
    Object.assign(invalid.turns[0]!, { role: 'unknown' });
    await expect(selector.select(invalid)).rejects.toThrow();
    const oversized = input();
    oversized.cards = Array.from({ length: 33 }, (_, i) => ({
      ...oversized.cards[0]!,
      cardId: String(i),
    }));
    await expect(selector.select(oversized)).rejects.toThrow();
    expect(calls).toBe(1);
  });

  test('cancels promptly, without retrying or exposing thrown fetch errors', async () => {
    let calls = 0;
    const fetch = (async (_url: unknown, init?: RequestInit) => {
      calls++;
      return await new Promise<Response>((_resolve, reject) =>
        init!.signal!.addEventListener('abort', () =>
          reject(new Error(secret)),
        ),
      );
    }) as unknown as typeof globalThis.fetch;
    const selector = createOpenRouterSelector({ ...config(), fetch });
    const request = input();
    const controller = new AbortController();
    request.signal = controller.signal;
    const pending = selector.select(request);
    controller.abort();
    try {
      await pending;
      throw new Error('unexpected success');
    } catch (e: unknown) {
      expect(String(e)).not.toContain(secret);
      expect(String(e)).not.toContain('unexpected success');
    }
    expect(calls).toBe(1);
  });

  test.each([selection, { cardId: null, slotIds: [], evidence: [] }])(
    'never emits ordinary metadata or output after a final-read abort: %j',
    async (value) => {
      const observed: unknown[] = [];
      const controller = new AbortController();
      const bytes = new TextEncoder().encode(await result(value).text());
      const selector = createOpenRouterSelector({
        ...config(),
        onProviderMetadata: (metadata) => observed.push(metadata),
        fetch: (async () =>
          new Response(
            new ReadableStream<Uint8Array>(
              {
                pull(stream) {
                  stream.enqueue(bytes);
                  stream.close();
                  controller.abort();
                },
              },
              { highWaterMark: 0 },
            ),
          )) as unknown as typeof globalThis.fetch,
      });
      const request = input();
      request.signal = controller.signal;
      await expect(selector.select(request)).rejects.toMatchObject({
        code: 'ABORTED',
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(observed).toEqual([]);
    },
  );

  test('copies configuration and never reuses tenant catalog data', async () => {
    const cfg = config();
    const requests: RequestBody[] = [];
    const selector = createOpenRouterSelector({
      ...cfg,
      fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
        requests.push(JSON.parse(String(init!.body)));
        return result({ cardId: null, slotIds: [], evidence: [] });
      }) as unknown as typeof globalThis.fetch,
    });
    cfg.allowedRequestProviderTags[0] = 'changed';
    cfg.allowedResponseProviderNames[0] = 'changed';
    cfg.allowedResponseModels[0] = 'changed';
    await selector.select(input());
    const second = input();
    second.catalog.workspaceId = 'tenant-b';
    second.cards[0]!.title = 'Different tenant';
    await selector.select(second);
    expect(requests[0].provider.only).toEqual(['approved-provider']);
    expect(JSON.stringify(requests[1].messages)).not.toContain('tenant-b');
    expect(JSON.stringify(requests[1].messages)).not.toContain('tenant-a');
    expect(JSON.stringify(requests[1].messages)).not.toContain('Price');
  });

  test('redacts phone-like numbers and excludes unknown input fields', async () => {
    let body = '';
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
        body = String(init!.body);
        return result(selection);
      }) as unknown as typeof globalThis.fetch,
    });
    const request = input();
    request.turns[0]!.text = 'Call me at +1 (212) 555-0123';
    Object.assign(request.turns[0]!, { hidden: 'should-not-leave' });
    await selector.select(request);
    expect(body).not.toContain('212');
    expect(body).not.toContain('should-not-leave');
    expect(body).toContain('[redacted number]');
  });

  test('preserves large dollar amounts while masking formatted phone numbers', async () => {
    let body = '';
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
        body = String(init!.body);
        return result(selection);
      }) as unknown as typeof globalThis.fetch,
    });
    const request = input();
    request.turns[0]!.text =
      'Coverage is $1000000 or $1000000000; call (212) 555-0123.';
    await selector.select(request);
    expect(body).toContain('$1000000');
    expect(body).toContain('$1000000000');
    expect(body).not.toContain('555-0123');
  });

  test('reports only validated provider identity and numeric usage', async () => {
    const observed: unknown[] = [];
    const selector = createOpenRouterSelector({
      ...config(),
      onProviderMetadata: (value) => observed.push(value),
      fetch: (async () =>
        result(selection, {
          usage: {
            prompt_tokens: 10,
            completion_tokens: 3,
            total_tokens: 13,
            cost: 0.002,
            secret,
          },
        })) as unknown as typeof globalThis.fetch,
    });
    await selector.select(input());
    expect(observed).toEqual([
      {
        model: 'vendor/model-v1',
        provider: 'approved-provider',
        providerRevision: 'router-config-v1',
        selectorRevision: 'closed-set-openrouter-v1',
        usage: {
          promptTokens: 10,
          completionTokens: 3,
          totalTokens: 13,
          cost: 0.002,
        },
      },
    ]);
    const invalid: unknown[] = [];
    const second = createOpenRouterSelector({
      ...config(),
      onProviderMetadata: (value) => invalid.push(value),
      fetch: (async () =>
        result(selection, {
          usage: { prompt_tokens: -1, cost: '0', total_tokens: 1.5 },
        })) as unknown as typeof globalThis.fetch,
    });
    await second.select(input());
    expect(invalid).toEqual([
      {
        model: 'vendor/model-v1',
        provider: 'approved-provider',
        providerRevision: 'router-config-v1',
        selectorRevision: 'closed-set-openrouter-v1',
      },
    ]);
    expect(selector.sourceVersion).not.toBe(
      createOpenRouterSelector({
        ...config(),
        allowedRequestProviderTags: ['other'],
        fetch: globalThis.fetch,
      }).sourceVersion,
    );
    expect(selector.sourceVersion).not.toBe(
      createOpenRouterSelector({
        ...config(),
        allowedResponseProviderNames: ['Other'],
        fetch: globalThis.fetch,
      }).sourceVersion,
    );
    expect(JSON.stringify(observed)).not.toContain(secret);
  });

  test('deadline aborts but retains the physical promise until ignored-abort fetch settles', async () => {
    let release!: (response: Response) => void;
    let signal!: AbortSignal;
    let calls = 0;
    let settled = false;
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: (async (_url: unknown, init?: RequestInit) => {
        calls++;
        signal = init!.signal!;
        return await new Promise<Response>((resolve) => {
          release = resolve;
        });
      }) as unknown as typeof globalThis.fetch,
    });
    const pending = selector.select(input()).finally(() => {
      settled = true;
    });
    void pending.catch(() => {});
    await new Promise<void>((resolve) =>
      signal.addEventListener('abort', () => resolve(), { once: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      expect(signal.aborted).toBe(true);
      expect(settled).toBe(false);
      expect(calls).toBe(1);
    } finally {
      release(result(selection));
      await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    }
  }, 7000);

  test('deadline also bounds a stalled response body after headers arrive', async () => {
    let cancelled = false;
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: (async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            cancel() {
              cancelled = true;
            },
          }),
        )) as unknown as typeof globalThis.fetch,
    });
    const started = Date.now();
    await expect(selector.select(input())).rejects.toMatchObject({
      code: 'ABORTED',
    });
    expect(Date.now() - started).toBeLessThan(6500);
    expect(cancelled).toBe(true);
  }, 7000);

  test('retains the physical promise while response-body cancellation is unsettled', async () => {
    let release!: () => void;
    let reading!: () => void;
    const started = new Promise<void>((resolve) => {
      reading = resolve;
    });
    const cancellation = new Promise<void>((resolve) => {
      release = resolve;
    });
    const controller = new AbortController();
    let settled = false;
    const selector = createOpenRouterSelector({
      ...config(),
      fetch: (async () =>
        new Response(
          new ReadableStream<Uint8Array>(
            {
              pull() {
                reading();
              },
              cancel() {
                return cancellation;
              },
            },
            { highWaterMark: 0 },
          ),
        )) as unknown as typeof globalThis.fetch,
    });
    const request = input();
    request.signal = controller.signal;
    const pending = selector.select(request).finally(() => {
      settled = true;
    });
    void pending.catch(() => {});
    await started;
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      expect(settled).toBe(false);
    } finally {
      release();
      await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    }
  });
});
