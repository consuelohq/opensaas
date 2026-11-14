import { describe, expect, it } from 'bun:test';
import {
  BudgetError,
  createBudgetedFetch,
  reservationPerRequest,
  type BudgetConfig,
} from './provider-budget';
const config: BudgetConfig = {
  model: 'fixture/model',
  allowedRequestProviderTags: ['fixture'],
  maxRequests: 2,
  maxReservedNanoUsd: 1000000,
  contextWindowTokens: 1000,
  inputNanoUsdPerMillion: 1000000,
  outputNanoUsdPerMillion: 1000000,
  maxPromptNanoUsdPerMillion: 1000000,
  maxCompletionNanoUsdPerMillion: 1000000,
};
const url = 'https://openrouter.ai/api/v1/chat/completions';
const init = {
  method: 'POST',
  body: JSON.stringify({
    model: 'fixture/model',
    max_tokens: 512,
    provider: {
      only: ['fixture'],
      require_parameters: true,
      allow_fallbacks: false,
      data_collection: 'deny',
      max_price: { prompt: 0.001, completion: 0.001 },
    },
  }),
};
describe('synthetic provider benchmark budget', () => {
  it('reserves the full bound and never retries or refunds unknown outcomes', async () => {
    let calls = 0;
    const gate = createBudgetedFetch(
      config,
      async () => {
        calls++;
        throw new Error('unknown');
      },
      () => true,
    );
    expect(reservationPerRequest(config)).toBe(1512);
    await expect(gate.fetch(url, init)).rejects.toThrow();
    await expect(gate.fetch(url, init)).rejects.toThrow();
    await expect(gate.fetch(url, init)).rejects.toBeInstanceOf(BudgetError);
    expect(calls).toBe(2);
    expect(gate.counters()).toMatchObject({
      attempts: 2,
      reservedNanoUsd: 3024,
      refused: 1,
      unreconciledCharges: 2,
    });
  });
  it('stops before network on cost, request, source integrity and configuration errors', async () => {
    let calls = 0;
    const downstream: (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response> = async () => {
      calls++;
      return new Response('{}');
    };
    const budget = createBudgetedFetch(
      { ...config, maxRequests: 10, maxReservedNanoUsd: 1512 },
      downstream,
      () => true,
    );
    await budget.fetch(url, init);
    await expect(budget.fetch(url, init)).rejects.toThrow('LIMIT');
    const changed = createBudgetedFetch(config, downstream, () => false);
    await expect(changed.fetch(url, init)).rejects.toThrow('INTEGRITY');
    await expect(
      changed.fetch(url, { ...init, body: JSON.stringify({ model: 'other' }) }),
    ).rejects.toThrow('REQUEST');
    expect(() =>
      createBudgetedFetch(
        { ...config, inputNanoUsdPerMillion: 0 },
        downstream,
        () => true,
      ),
    ).toThrow('CONFIG');
    expect(calls).toBe(1);
  });
  it('refunds only a validated same-request cost and holds missing or unknown costs', async () => {
    let calls = 0;
    const gate = createBudgetedFetch(
      { ...config, maxRequests: 4, maxReservedNanoUsd: 3125 },
      async () => {
        calls++;
        return new Response('{}');
      },
      () => true,
    );
    await gate.fetchFor('a')(url, init);
    await gate.fetchFor('b')(url, init);
    await expect(gate.fetchFor('c')(url, init)).rejects.toThrow('LIMIT');
    gate.settle('other', 0.0000001);
    gate.settle('a', undefined);
    expect(gate.counters()).toMatchObject({
      reservedNanoUsd: 3024,
      settlements: 0,
    });
    gate.settle('a', 0.0000001);
    expect(gate.counters()).toMatchObject({
      reservedNanoUsd: 1512,
      spentNanoUsd: 101,
      settlements: 1,
    });
    await gate.fetchFor('c')(url, init);
    gate.settle('a', 0);
    expect(gate.counters()).toMatchObject({
      attempts: 3,
      settlements: 1,
      unreconciledCharges: 2,
    });
    expect(calls).toBe(3);
  });
  it('halts future sends on reported cost above its bound and rejects price or caching drift', async () => {
    let calls = 0;
    const gate = createBudgetedFetch(
      { ...config, maxRequests: 5 },
      async () => {
        calls++;
        return new Response('{}');
      },
      () => true,
    );
    const body = JSON.parse(init.body);
    await expect(
      gate.fetchFor('cache')(url, {
        ...init,
        body: JSON.stringify({
          ...body,
          messages: [{ cache_control: { type: 'ephemeral' } }],
        }),
      }),
    ).rejects.toThrow('REQUEST');
    await expect(
      gate.fetchFor('price')(url, {
        ...init,
        body: JSON.stringify({
          ...body,
          provider: {
            ...body.provider,
            max_price: { prompt: 2, completion: 2 },
          },
        }),
      }),
    ).rejects.toThrow('REQUEST');
    await gate.fetchFor('a')(url, init);
    gate.settle('a', 1);
    expect(gate.counters()).toMatchObject({
      halted: true,
      reservedNanoUsd: 1512,
      settlements: 0,
    });
    await expect(gate.fetchFor('b')(url, init)).rejects.toThrow('LIMIT');
    expect(calls).toBe(1);
  });
  it('bounds concurrent requests to four and removes aborted queued work', async () => {
    let active = 0,
      peak = 0,
      calls = 0;
    const releases: (() => void)[] = [];
    const gate = createBudgetedFetch(
      { ...config, maxRequests: 10 },
      async () => {
        calls++;
        active++;
        peak = Math.max(peak, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active--;
        return new Response('{}');
      },
      () => true,
    );
    const controller = new AbortController();
    const running = Array.from({ length: 4 }, () => gate.fetch(url, init));
    await Promise.resolve();
    const aborted = gate.fetch(url, { ...init, signal: controller.signal });
    controller.abort();
    await expect(aborted).rejects.toThrow('ABORTED');
    expect(gate.counters().queued).toBe(0);
    releases.forEach((fn) => fn());
    await Promise.all(running);
    expect(peak).toBe(4);
    expect(calls).toBe(4);
  });
});
