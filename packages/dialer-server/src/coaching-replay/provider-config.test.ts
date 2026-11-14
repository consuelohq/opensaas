import { describe, expect, it } from 'bun:test';
import {
  authorizeProviderRun,
  configurationFingerprint,
  parseProviderConfig,
} from './provider-config';
const value = {
  schemaVersion: 1,
  model: 'fixture/model',
  providerRevision: 'fixture-v1',
  allowedRequestProviderTags: ['fixture'],
  allowedResponseModels: ['fixture/model'],
  allowedResponseProviderNames: ['Fixture'],
  transportRevision: 'fixture-prompt-v1',
  scenarioCount: 2,
  maxRequests: 2,
  maxReservedNanoUsd: 100000,
  contextWindowTokens: 1000,
  inputNanoUsdPerMillion: 1000000,
  outputNanoUsdPerMillion: 1000000,
  maxPromptNanoUsdPerMillion: 1000000,
  maxCompletionNanoUsdPerMillion: 1000000,
  pricingSource: 'https://example.invalid/pricing',
  pricingAsOf: '2026-01-01',
};
const snapshot = {
  bunVersion: 'fixture',
  files: [{ path: 'fixture.ts', sha256: 'a'.repeat(64) }],
};
describe('provider benchmark preflight', () => {
  it('refuses missing opt-in, incomplete config, source drift and unreviewed fingerprints', () => {
    const config = parseProviderConfig(value),
      fingerprint = configurationFingerprint(
        config,
        snapshot,
        '/fixture/private',
      );
    expect(() =>
      authorizeProviderRun({
        optIn: undefined,
        config: value,
        snapshot,
        outputDirectory: '/fixture/private',
        expectedFingerprint: fingerprint,
      }),
    ).toThrow();
    expect(() =>
      authorizeProviderRun({
        optIn: '1',
        config: {},
        snapshot,
        outputDirectory: '/fixture/private',
        expectedFingerprint: fingerprint,
      }),
    ).toThrow();
    expect(() =>
      authorizeProviderRun({
        optIn: '1',
        config: value,
        snapshot,
        outputDirectory: '/fixture/private',
        expectedFingerprint: undefined,
      }),
    ).toThrow();
    expect(() =>
      authorizeProviderRun({
        optIn: '1',
        config: value,
        snapshot: { ...snapshot, bunVersion: 'changed' },
        outputDirectory: '/fixture/private',
        expectedFingerprint: fingerprint,
      }),
    ).toThrow('INTEGRITY');
    expect(
      authorizeProviderRun({
        optIn: '1',
        config: value,
        snapshot,
        outputDirectory: '/fixture/private',
        expectedFingerprint: fingerprint,
      }).fingerprint,
    ).toBe(fingerprint);
    expect(() => parseProviderConfig({ ...value, scenarioCount: 3 })).toThrow();
    expect(() =>
      parseProviderConfig({
        ...value,
        pricingSource: 'http://example.invalid',
      }),
    ).toThrow();
    expect(() =>
      parseProviderConfig({ ...value, maxReservedNanoUsd: 1000 }),
    ).toThrow();
  });
});
