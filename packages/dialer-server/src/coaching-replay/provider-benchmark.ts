import { createContextScheduler } from '../coaching/context-scheduler';
import {
  createOpenRouterSelector,
  OPENROUTER_SELECTOR_REVISION,
} from '../coaching/openrouter-selector';
import { scenarios, type Scenario } from './fixtures';
import { independentScenarios } from './independent';
import { createProductionReplaySession } from './production';
import { runTextReplay } from './runner';
import { createBudgetedFetch, type BenchmarkFetch } from './provider-budget';
import type { ProviderBenchmarkConfig } from './provider-config';
import { createProviderLedger } from './provider-ledger';
import type { ProviderReport } from './provider-artifact';

export function benchmarkCases(count: number): readonly Scenario[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 108)
    throw new Error('invalid scenario count');
  const all = [...scenarios, ...independentScenarios],
    order = all.map((_, i) => i);
  let random = 17;
  for (let i = order.length - 1; i > 0; i--) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    const j = (random >>> 0) % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.slice(0, count).map((i) => all[i]!);
}
function transportOptions(config: ProviderBenchmarkConfig) {
  if (config.transportRevision !== OPENROUTER_SELECTOR_REVISION)
    throw new Error('transport revision changed');
  return {
    model: config.model,
    providerRevision: config.providerRevision,
    ...(config.reasoningMode === 'disabled'
      ? { reasoningMode: 'disabled' as const }
      : {}),
    allowedRequestProviderTags: config.allowedRequestProviderTags,
    allowedResponseProviderNames: config.allowedResponseProviderNames,
    allowedResponseModels: config.allowedResponseModels,
    maxPriceUsdPerMillionTokens: {
      prompt: config.maxPromptNanoUsdPerMillion / 1_000_000_000,
      completion: config.maxCompletionNanoUsdPerMillion / 1_000_000_000,
    },
  };
}
/** Pure local dry run: real serializer, fixed synthetic key, injected non-network response. */
export async function measureSyntheticRequestBytes(
  config: ProviderBenchmarkConfig,
) {
  const cases = benchmarkCases(config.scenarioCount),
    bytes: number[] = [];
  const fakeFetch: BenchmarkFetch = async (_input, init) => {
    if (typeof init?.body !== 'string') throw new Error('missing body');
    const body = JSON.parse(init.body);
    const hasCache = (x: unknown): boolean =>
      !!x &&
      typeof x === 'object' &&
      Object.entries(x).some(
        ([key, value]) =>
          [
            'cache_control',
            'prompt_cache_breakpoint',
            'prompt_cache_options',
          ].includes(key) || hasCache(value),
      );
    if (
      hasCache(body) ||
      body.model !== config.model ||
      body.max_tokens !== 512 ||
      (config.reasoningMode === 'disabled'
        ? JSON.stringify(body.reasoning) !== JSON.stringify({ enabled: false })
        : Object.hasOwn(body, 'reasoning')) ||
      JSON.stringify(body.provider?.only) !==
        JSON.stringify(config.allowedRequestProviderTags) ||
      body.provider?.max_price?.prompt !==
        config.maxPromptNanoUsdPerMillion / 1_000_000_000 ||
      body.provider?.max_price?.completion !==
        config.maxCompletionNanoUsdPerMillion / 1_000_000_000
    )
      throw new Error('dry-run request contract mismatch');
    bytes.push(new TextEncoder().encode(init.body).length);
    return new Response(
      JSON.stringify({
        model: config.allowedResponseModels[0],
        provider: config.allowedResponseProviderNames[0],
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
      }),
    );
  };
  const selector = createOpenRouterSelector({
    ...transportOptions(config),
    getApiKey: () => 'synthetic-fixture-only',
    fetch: fakeFetch as typeof globalThis.fetch,
  });
  const results = await runTextReplay({
    cases,
    concurrency: 20,
    seed: 17,
    captureWallOutcomes: true,
    create: createProductionReplaySession('context-provider', selector),
  });
  if (
    bytes.length !== cases.length ||
    results.some(
      (r) => r.selectorRequests !== 1 || r.selectorMetrics?.failures !== 0,
    )
  )
    throw new Error('synthetic dry-run incomplete');
  return {
    requests: bytes.length,
    minBytes: Math.min(...bytes),
    maxBytes: Math.max(...bytes),
    totalBytes: bytes.reduce((sum, n) => sum + n, 0),
  };
}

/** Called only after separate human approval, opt-in, metadata and fingerprint checks. */
export async function runProviderBenchmark(input: {
  config: ProviderBenchmarkConfig;
  fingerprint: string;
  directory: string;
  getApiKey: () => string;
  fetcher: BenchmarkFetch;
  integrity: () => boolean;
  /** Injectable only for deterministic local scheduler/timeout tests. */
  testSessionFactory?: (
    scope: Parameters<Parameters<typeof runTextReplay>[0]['create']>[0],
    emit: Parameters<Parameters<typeof runTextReplay>[0]['create']>[1],
    clock: Parameters<Parameters<typeof runTextReplay>[0]['create']>[2],
    scheduler: ReturnType<typeof createContextScheduler>,
  ) => import('./runner').ReplaySession;
}) {
  const { config, fingerprint } = input,
    cases = benchmarkCases(config.scenarioCount);
  const ledger = createProviderLedger(input.directory, fingerprint);
  const gate = createBudgetedFetch(
    config,
    input.fetcher,
    input.integrity,
    ledger.record,
  );
  let metadataResponses = 0,
    promptTokenReports = 0,
    completionTokenReports = 0,
    costReports = 0;
  let promptTokensReported: number | null = null,
    completionTokensReported: number | null = null;
  try {
    const scheduler = createContextScheduler();
    const create: Parameters<typeof runTextReplay>[0]['create'] = (
      scope,
      emit,
      clock,
    ) => {
      if (input.testSessionFactory)
        return input.testSessionFactory(scope, emit, clock, scheduler);
      const ticket = scope.callSessionId;
      const selector = createOpenRouterSelector({
        ...transportOptions(config),
        getApiKey: input.getApiKey,
        fetch: gate.fetchFor(ticket) as typeof globalThis.fetch,
        onProviderMetadata: (meta) => {
          metadataResponses++;
          if (meta.usage?.promptTokens !== undefined) {
            promptTokenReports++;
            promptTokensReported =
              (promptTokensReported ?? 0) + meta.usage.promptTokens;
          }
          if (meta.usage?.completionTokens !== undefined) {
            completionTokenReports++;
            completionTokensReported =
              (completionTokensReported ?? 0) + meta.usage.completionTokens;
          }
          if (meta.usage?.cost !== undefined) {
            costReports++;
            gate.settle(ticket, meta.usage.cost);
          }
        },
      });
      return createProductionReplaySession(
        'context-provider',
        selector,
        scheduler,
      )(scope, emit, clock);
    };
    const results = await runTextReplay({
      cases,
      concurrency: 20,
      seed: 17,
      captureWallOutcomes: true,
      create,
    });
    // Give already-settled selector jobs one event-loop turn to release their
    // scheduler slots. Never wait for a potentially non-cooperative transport.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    gate.finalize();
    const budget = gate.counters();
    const schedulerState = scheduler.diagnostics();
    const report: ProviderReport = {
      schemaVersion: 1,
      lane: 'provider-synthetic',
      fingerprint,
      seed: 17,
      logicalConcurrency: 20,
      maxRequests: config.maxRequests,
      reservationPerRequestNanoUsd: gate.reservationPerRequestNanoUsd,
      attempts: budget.attempts,
      reservedNanoUsd: budget.reservedNanoUsd,
      spentNanoUsd: budget.spentNanoUsd,
      maxReservedNanoUsd: config.maxReservedNanoUsd,
      settlements: budget.settlements,
      halted: budget.halted,
      physicalUnsettled: schedulerState.active,
      queuedAtFinish: schedulerState.waiting,
      unreconciledCharges: budget.unreconciledCharges,
      refused: budget.refused,
      metadataResponses,
      promptTokenReports,
      promptTokensReported,
      completionTokenReports,
      completionTokensReported,
      costReports,
      results,
    };
    ledger.writeReport(report);
    return report;
  } finally {
    gate.finalize();
    ledger.close();
  }
}
