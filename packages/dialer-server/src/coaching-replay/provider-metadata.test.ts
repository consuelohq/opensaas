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
