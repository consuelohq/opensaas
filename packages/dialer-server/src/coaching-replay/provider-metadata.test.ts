import { readFileSync } from 'node:fs';
import { reservationPerRequest } from './provider-budget';
import { describe, expect, it } from 'bun:test';
import { parseProviderConfig } from './provider-config';
import {
  rateNanoUsdPerMillion,
  verifyPublicModelMetadata,
} from './provider-metadata';
const config = parseProviderConfig({
  schemaVersion: 1,
  model: 'fixture/model',
  providerRevision: 'fixture-v1',
  allowedRequestProviderTags: ['fixture'],
  allowedResponseProviderNames: ['Fixture'],
  allowedResponseModels: ['fixture/model'],
  transportRevision: 'fixture-v1',
  scenarioCount: 2,
  maxRequests: 2,
  maxReservedNanoUsd: 2000000000,
  contextWindowTokens: 200000,
  inputNanoUsdPerMillion: 2000000000,
  outputNanoUsdPerMillion: 5000000000,
  maxPromptNanoUsdPerMillion: 1000000000,
  maxCompletionNanoUsdPerMillion: 5000000000,
  pricingSource: 'https://openrouter.ai/api/v1/models/fixture/model/endpoints',
  pricingAsOf: '2026-11-14',
});
const endpoint = {
  tag: 'fixture',
  provider_name: 'Fixture',
  model_id: 'fixture/model',
  context_length: 200000,
  max_completion_tokens: 64000,
  pricing: {
    prompt: '0.000001',
    completion: '0.000005',
    input_cache_write: '0.00000125',
    input_cache_write_1h: '0.000002',
  },
  supported_parameters: ['structured_outputs', 'response_format', 'max_tokens'],
};
const now = Date.parse('2026-11-14T12:00:00Z');
describe('public metadata preflight with injected local responses only', () => {
  it('checks exact provider, context, supported parameters and decimal rates', async () => {
    expect(rateNanoUsdPerMillion('0.00000125')).toBe(1250000000);
    const fake = async () =>
      new Response(
        JSON.stringify({
          data: { id: 'fixture/model', endpoints: [endpoint] },
        }),
      );
    expect(
      (await verifyPublicModelMetadata(config, fake, now))
        .conservativeInputNanoUsdPerMillion,
    ).toBe(2000000000);
    await expect(
      verifyPublicModelMetadata(
        config,
        async () =>
          new Response(
            JSON.stringify({
              data: {
                id: 'fixture/model',
                endpoints: [{ ...endpoint, tag: 'other' }],
              },
            }),
          ),
        now,
      ),
    ).rejects.toThrow();
    await expect(
      verifyPublicModelMetadata(
        config,
        async () =>
          new Response(
            JSON.stringify({
              data: {
                id: 'fixture/model',
                endpoints: [
                  {
                    ...endpoint,
                    pricing: { ...endpoint.pricing, prompt: '0.000003' },
                  },
                ],
              },
            }),
          ),
        now,
      ),
    ).rejects.toThrow();
    await expect(
      verifyPublicModelMetadata(config, fake, now + 86400000),
    ).rejects.toThrow();
  });
});

it('accepts absent optional cache-write rates and fails closed on invalid fields or missing capabilities', async () => {
  const disabled = {
    ...config,
    reasoningMode: 'disabled' as const,
    inputNanoUsdPerMillion: 1000000000,
  };
  const noCache = {
    ...endpoint,
    pricing: {
      prompt: '0.000001',
      completion: '0.000005',
      input_cache_read: '0.0000001',
    },
    supported_parameters: [...endpoint.supported_parameters, 'reasoning'],
  };
  const reply = (item: unknown) => async () =>
    new Response(
      JSON.stringify({ data: { id: 'fixture/model', endpoints: [item] } }),
    );
  expect(
    (await verifyPublicModelMetadata(disabled, reply(noCache), now))
      .conservativeInputNanoUsdPerMillion,
  ).toBe(1000000000);
  for (const key of ['input_cache_write', 'input_cache_write_1h']) {
    for (const invalid of [null, '', 'invalid', -1]) {
      await expect(
        verifyPublicModelMetadata(
          disabled,
          reply({
            ...noCache,
            pricing: { ...noCache.pricing, [key]: invalid },
          }),
          now,
        ),
      ).rejects.toThrow();
    }
  }
  await expect(
    verifyPublicModelMetadata(
      disabled,
      reply({
        ...noCache,
        supported_parameters: endpoint.supported_parameters,
      }),
      now,
    ),
  ).rejects.toThrow();
  await expect(
    verifyPublicModelMetadata(
      disabled,
      reply({
        ...noCache,
        supported_parameters: ['reasoning', 'response_format', 'max_tokens'],
      }),
      now,
    ),
  ).rejects.toThrow();
  await expect(
    verifyPublicModelMetadata(
      disabled,
      reply({
        ...noCache,
        pricing: { ...noCache.pricing, prompt: '0.0000011' },
      }),
      now,
    ),
  ).rejects.toThrow();
});

it('pins the DeepInfra endpoint and denies the official endpoint without strict schema support', async () => {
  const draft = parseProviderConfig(
    JSON.parse(
      readFileSync(
        new URL('./provider-deepseek.draft.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  const deep = {
    tag: 'deepinfra/fp8',
    provider_name: 'DeepInfra',
    model_id: draft.model,
    context_length: 1048576,
    max_completion_tokens: 393216,
    pricing: {
      prompt: '0.000000098',
      completion: '0.000000294',
      input_cache_read: '0.00000000294',
    },
    supported_parameters: [
      'reasoning',
      'max_tokens',
      'response_format',
      'structured_outputs',
    ],
  };
  const reply = (item: unknown) => async () =>
    new Response(
      JSON.stringify({ data: { id: draft.model, endpoints: [item] } }),
    );
  expect(
    (await verifyPublicModelMetadata(draft, reply(deep), now))
      .conservativeInputNanoUsdPerMillion,
  ).toBe(98000000);
  expect(reservationPerRequest(draft)).toBe(102910976);
  const official = {
    ...deep,
    tag: 'deepseek',
    provider_name: 'DeepSeek',
    supported_parameters: ['reasoning', 'max_tokens', 'response_format'],
  };
  const officialConfig = parseProviderConfig({
    ...draft,
    allowedRequestProviderTags: ['deepseek'],
    allowedResponseProviderNames: ['DeepSeek'],
  });
  await expect(
    verifyPublicModelMetadata(officialConfig, reply(official), now),
  ).rejects.toThrow();
  await expect(
    verifyPublicModelMetadata(draft, reply(official), now),
  ).rejects.toThrow();
});
