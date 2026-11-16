import { createScriptSession } from '../coaching/script-engine';
import {
  compilePlaybook,
  SYNTHETIC_LIFE_INSURANCE,
} from '../coaching/playbooks';
import { fixtureParticipants } from './transcript';
import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseProviderConfig } from './provider-config';
import {
  measureSyntheticRequestBytes,
  runProviderBenchmark,
} from './provider-benchmark';
const config = parseProviderConfig({
  schemaVersion: 1,
  model: 'fixture/model',
  providerRevision: 'fixture-v1',
  allowedRequestProviderTags: ['fixture'],
  allowedResponseProviderNames: ['Fixture'],
  allowedResponseModels: ['fixture/model'],
  transportRevision: 'closed-set-openrouter-v1',
  scenarioCount: 3,
  maxRequests: 3,
  maxReservedNanoUsd: 1000000,
  contextWindowTokens: 1000,
  inputNanoUsdPerMillion: 1000000,
  outputNanoUsdPerMillion: 1000000,
  maxPromptNanoUsdPerMillion: 1000000,
  maxCompletionNanoUsdPerMillion: 1000000,
  pricingSource: 'https://openrouter.ai/api/v1/models/fixture/model/endpoints',
  pricingAsOf: '2026-11-14',
});
describe('provider benchmark end-to-end mechanics, injected local fake only', () => {
  it('measures real serialized synthetic requests without network', async () => {
    const bounds = await measureSyntheticRequestBytes(config);
    expect(bounds.requests).toBe(3);
    expect(bounds.minBytes).toBeGreaterThan(0);
    expect(bounds.maxBytes).toBeLessThanOrEqual(65536);
  });
  it('persists bounded local mock results and uses same-request costs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-run-'));
    let calls = 0;
    try {
      const report = await runProviderBenchmark({
        config,
        fingerprint: 'a'.repeat(64),
        directory: dir,
        integrity: () => true,
        getApiKey: () => 'fixture-only',
        fetcher: async () => {
          calls++;
          return new Response(
            JSON.stringify({
              model: 'fixture/model',
              provider: 'Fixture',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      cardId: null,
                      slotIds: [],
                      evidence: [],
                    }),
                  },
                },
              ],
              usage: {
                prompt_tokens: 10,
                completion_tokens: 2,
                total_tokens: 12,
                cost: 0.0000001,
              },
            }),
          );
        },
      });
      expect(calls).toBe(3);
      expect(report.attempts).toBe(3);
      expect(report.settlements).toBe(3);
      expect(report.reservedNanoUsd).toBe(0);
      expect(report.spentNanoUsd).toBe(303);
      expect(report.promptTokensReported).toBe(30);
      const artifact = readFileSync(
        join(dir, 'provider-replay-v1.json'),
        'utf8',
      );
      expect(artifact).not.toContain('fixture-only');
      expect(JSON.parse(artifact).results).toHaveLength(3);
      await expect(
        runProviderBenchmark({
          config,
          fingerprint: 'a'.repeat(64),
          directory: dir,
          integrity: () => true,
          getApiKey: () => 'fixture-only',
          fetcher: async () => {
            throw Error('should not send');
          },
        }),
      ).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('uses one bounded queue for twenty isolated sessions, with injected replies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-parallel-')),
      many = { ...config, scenarioCount: 20, maxRequests: 20 };
    let active = 0,
      peak = 0,
      calls = 0;
    try {
      const report = await runProviderBenchmark({
        config: many,
        fingerprint: 'b'.repeat(64),
        directory: dir,
        integrity: () => true,
        getApiKey: () => 'fixture-only',
        fetcher: async () => {
          calls++;
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active--;
          return new Response(
            JSON.stringify({
              model: 'fixture/model',
              provider: 'Fixture',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      cardId: null,
                      slotIds: [],
                      evidence: [],
                    }),
                  },
                },
              ],
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
                cost: 0.0000001,
              },
            }),
          );
        },
      });
      expect(calls).toBe(20);
      expect(peak).toBeLessThanOrEqual(4);
      expect(report.results).toHaveLength(20);
      expect(report.settlements).toBe(20);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('keeps all cases in an incomplete report when unknown costs exhaust the budget', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-stop-'));
    const many = {
      ...config,
      scenarioCount: 20,
      maxRequests: 20,
      maxReservedNanoUsd: 3024,
    };
    let calls = 0;
    try {
      const report = await runProviderBenchmark({
        config: many,
        fingerprint: 'c'.repeat(64),
        directory: dir,
        integrity: () => true,
        getApiKey: () => 'fixture-only',
        fetcher: async () => {
          calls++;
          throw new Error('unknown outcome');
        },
      });
      expect(calls).toBe(2);
      expect(report.attempts).toBe(2);
      expect(report.refused).toBe(18);
      expect(report.reservedNanoUsd).toBe(3024);
      expect(report.unreconciledCharges).toBe(2);
      expect(report.results).toHaveLength(20);
      expect(report.metadataResponses).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('reports a physical scheduler slot still occupied after logical deadline until the work settles', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-physical-'));
    let release!: () => void;
    const physical = new Promise<void>((resolve) => {
      release = resolve;
    });
    let schedulerRef:
      import('../coaching/context-scheduler').ContextScheduler | undefined;
    try {
      const report = await runProviderBenchmark({
        config: { ...config, scenarioCount: 1, maxRequests: 1 },
        fingerprint: 'd'.repeat(64),
        directory: dir,
        integrity: () => true,
        getApiKey: () => {
          throw Error('not accessed');
        },
        fetcher: async () => {
          throw Error('not accessed');
        },
        testSessionFactory: (scope, _emit, _clock, scheduler) => {
          schedulerRef = scheduler;
          const started = performance.now();
          const compiled = compilePlaybook({
            workspaceId: scope.workspaceId,
            scriptId: 'synthetic-script',
            sourceRevision: 1,
            version: 1,
            title: 'Synthetic examples',
            content: SYNTHETIC_LIFE_INSURANCE.content,
            industryPackVersion: 'synthetic-industry-v1',
            companyPolicyVersion: 'synthetic-policy-v1',
            rules: SYNTHETIC_LIFE_INSURANCE.rules,
          });
          return createScriptSession({
            scope,
            compiled,
            participants: fixtureParticipants,
            scheduler,
            selectorDeadlineMs: 10,
            maxSelectorRequests: 1,
            nowMs: () => 1000 + performance.now() - started,
            selector: {
              sourceVersion: 'fixture-v1',
              select: async () => {
                await physical;
                return { cardId: null, slotIds: [], evidence: [] };
              },
            },
            policy: {
              scope,
              memberId: 'fixture-rep',
              revision: 1,
              validUntilMs: 100000,
              revoked: false,
              capabilities: [
                'manual-reference',
                'live-transcription',
                'live-coaching',
              ],
              consent: {
                ephemeralTranscription: true,
                retainedTranscript: false,
                aiGeneration: false,
              },
            },
          });
        },
      });
      expect(report.results).toHaveLength(1);
      expect(report.attempts).toBe(0);
      expect(report.attempts).toBeLessThan(report.maxRequests);
      expect(report.metadataResponses).toBe(0);
      expect(report.results[0]?.selectorMetrics?.failures).toBe(1);
      expect(report.physicalUnsettled).toBe(1);
      expect(schedulerRef?.diagnostics().active).toBe(1);
      release();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(schedulerRef?.diagnostics().active).toBe(0);
    } finally {
      release();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

it('passes the fingerprinted disabled-reasoning mode to every synthetic request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'provider-reasoning-'));
  const disabled = {
    ...config,
    scenarioCount: 1,
    maxRequests: 1,
    reasoningMode: 'disabled',
  } as typeof config;
  const bodies: Record<string, unknown>[] = [];
  try {
    await runProviderBenchmark({
      config: disabled,
      fingerprint: 'e'.repeat(64),
      directory: dir,
      integrity: () => true,
      getApiKey: () => 'fixture-only',
      fetcher: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify({
            model: 'fixture/model',
            provider: 'Fixture',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    cardId: null,
                    slotIds: [],
                    evidence: [],
                  }),
                },
              },
            ],
            usage: { cost: 0 },
          }),
        );
      },
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.reasoning).toEqual({ enabled: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
