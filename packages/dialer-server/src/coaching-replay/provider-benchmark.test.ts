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
  transportRevision: 'closed-set-openrouter-v2',
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
  it('queues affordable requests at the capacity implied by the reservation cap', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'provider-capacity-'));
    const bounded = {
      ...config,
      scenarioCount: 6,
      maxRequests: 6,
      maxReservedNanoUsd: 4024,
    };
    let active = 0,
      peak = 0,
      calls = 0;
    try {
      const report = await runProviderBenchmark({
        config: bounded,
        fingerprint: 'f'.repeat(64),
        directory,
        integrity: () => true,
        getApiKey: () => 'fixture-only',
        fetcher: async () => {
          calls++;
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 10));
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
                      selection: { cardId: null, evidence: [] },
                    }),
                  },
                },
              ],
              usage: { cost: 0.0000001 },
            }),
          );
        },
      });
      expect(report.reservationPerRequestNanoUsd).toBe(1512);
      expect(calls).toBe(6);
      expect(report.attempts).toBe(6);
      expect(report.settlements).toBe(6);
      expect(report.refused).toBe(0);
      expect(report.unreconciledCharges).toBe(0);
      expect(peak).toBe(2);
      expect(peak).toBeLessThanOrEqual(
        Math.min(
          4,
          Math.floor(
            bounded.maxReservedNanoUsd / report.reservationPerRequestNanoUsd,
          ),
        ),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('settles rejected responses with trusted costs and distinguishes missing cache counters from zero', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'provider-rejected-'));
    let calls = 0;
    try {
      const report = await runProviderBenchmark({
        config,
        fingerprint: 'f'.repeat(64),
        directory,
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
                  finish_reason: 'length',
                  message: { role: 'assistant', content: 'private generation' },
                },
              ],
              usage: {
                cost: 0.0000001,
                prompt_tokens: 7,
                completion_tokens: 2,
                ...(calls === 1
                  ? { prompt_tokens_details: { cached_tokens: 0 } }
                  : {}),
              },
            }),
          );
        },
      });
      expect(report.metadataResponses).toBe(0);
      expect(report.costReports).toBe(3);
      expect(report.promptTokenReports).toBe(3);
      expect(report.promptTokensReported).toBe(21);
      expect(report.completionTokenReports).toBe(3);
      expect(report.completionTokensReported).toBe(6);
      expect(report.settlements).toBe(3);
      expect(report.reservedNanoUsd).toBe(0);
      expect(report.diagnostics?.stages.finish).toBe(3);
      expect(report.diagnostics?.finishReasons.length).toBe(3);
      expect(report.diagnostics?.cachedInputTokens).toEqual({
        reports: 1,
        total: 0,
      });
      expect(report.diagnostics?.cacheWriteTokens).toEqual({
        reports: 0,
        total: null,
      });
      expect(
        readFileSync(join(directory, 'provider-replay-v1.json'), 'utf8'),
      ).not.toContain('private generation');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('keeps reservations for non-success and identity failures, and counts physical transport failures', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'provider-unknown-'));
    let calls = 0;
    try {
      const report = await runProviderBenchmark({
        config,
        fingerprint: 'f'.repeat(64),
        directory,
        integrity: () => true,
        getApiKey: () => 'fixture-only',
        fetcher: async () => {
          calls++;
          if (calls === 1) return new Response('private', { status: 429 });
          if (calls === 2)
            return new Response(
              JSON.stringify({
                model: 'wrong',
                provider: 'Fixture',
                usage: { cost: 0 },
              }),
            );
          throw Error('private');
        },
      });
      expect(report.settlements).toBe(0);
      expect(report.unreconciledCharges).toBe(3);
      expect(report.costReports).toBe(0);
      expect(report.diagnostics?.stages).toEqual({
        http: 1,
        identity: 1,
        transport: 1,
      });
      expect(report.diagnostics?.statuses).toEqual({ '429': 1, '200': 1 });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
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
                      selection: { cardId: null, evidence: [] },
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
                      selection: { cardId: null, evidence: [] },
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
      // Historical-only cases can abstain locally before inference.
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThan(20);
      expect(
        report.results.filter((r) => r.selectorRequests === 0).length,
      ).toBeGreaterThan(0);
      expect(peak).toBeLessThanOrEqual(4);
      expect(report.results).toHaveLength(20);
      expect(report.settlements).toBe(calls);
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
      expect(report.refused).toBe(
        report.results.reduce((n, r) => n + (r.selectorRequests ?? 0), 0) -
          report.attempts,
      );
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
                    selection: { cardId: null, evidence: [] },
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
