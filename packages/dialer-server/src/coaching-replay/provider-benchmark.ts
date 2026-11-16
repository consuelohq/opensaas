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
                selection: { cardId: null, evidence: [] },
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
    bytes.length !==
      results.reduce((n, r) => n + (r.selectorRequests ?? NaN), 0) ||
    results.some(
      (r) =>
        (r.selectorRequests !== 0 && r.selectorRequests !== 1) ||
        r.selectorMetrics?.failures !== 0,
    )
  )
    throw new Error('synthetic dry-run incomplete');
  return {
    scenarios: cases.length,
    requests: bytes.length,
    locallyAbstained: cases.length - bytes.length,
    minBytes: bytes.length ? Math.min(...bytes) : 0,
    maxBytes: bytes.length ? Math.max(...bytes) : 0,
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
  const physicalSignals = new WeakSet<AbortSignal>();
  const gate = createBudgetedFetch(
    config,
    (request, init) => {
      if (init?.signal) physicalSignals.add(init.signal);
      return input.fetcher(request, init);
    },
    input.integrity,
    ledger.record,
  );
  let metadataResponses = 0,
    promptTokenReports = 0,
    completionTokenReports = 0,
    costReports = 0;
  let promptTokensReported: number | null = null,
    completionTokensReported: number | null = null;
  const diagnostics: import('./provider-artifact').ProviderDiagnostics = {
    stages: {},
    statuses: {},
    finishReasons: {},
    cachedInputTokens: { reports: 0, total: null },
    cacheWriteTokens: { reports: 0, total: null },
    reasoningTokens: { reports: 0, total: null },
  };
  let reportClosed = false;
  try {
    const scheduler = createContextScheduler({
      concurrency: Math.min(
        4,
        Math.floor(
          config.maxReservedNanoUsd / gate.reservationPerRequestNanoUsd,
        ),
      ),
    });
    const create: Parameters<typeof runTextReplay>[0]['create'] = (
      scope,
      emit,
      clock,
    ) => {
      if (input.testSessionFactory)
        return input.testSessionFactory(scope, emit, clock, scheduler);
      const ticket = scope.callSessionId;
      let signal: AbortSignal | undefined;
      const fetchForTicket = gate.fetchFor(ticket);
      const selector = createOpenRouterSelector({
        ...transportOptions(config),
        getApiKey: input.getApiKey,
        fetch: ((request, init) => {
          signal = init?.signal ?? undefined;
          return fetchForTicket(request, init);
        }) as typeof globalThis.fetch,
        onProviderMetadata: () => {
          metadataResponses++;
        },
        onProviderAttempt: (attempt) => {
          if (reportClosed || !signal || !physicalSignals.has(signal)) return;
          diagnostics.stages[attempt.stage] =
            (diagnostics.stages[attempt.stage] ?? 0) + 1;
          if (attempt.status !== undefined) {
            const status = String(attempt.status);
            diagnostics.statuses[status] =
              (diagnostics.statuses[status] ?? 0) + 1;
          }
          if (attempt.finishReason)
            diagnostics.finishReasons[attempt.finishReason] =
              (diagnostics.finishReasons[attempt.finishReason] ?? 0) + 1;
          const prompt = attempt.usage?.promptTokens;
          if (
            prompt !== undefined &&
            Number.isSafeInteger((promptTokensReported ?? 0) + prompt)
          ) {
            promptTokenReports++;
            promptTokensReported = (promptTokensReported ?? 0) + prompt;
          }
          const completion = attempt.usage?.completionTokens;
          if (
            completion !== undefined &&
            Number.isSafeInteger((completionTokensReported ?? 0) + completion)
          ) {
            completionTokenReports++;
            completionTokensReported =
              (completionTokensReported ?? 0) + completion;
          }
          for (const key of [
            'cachedInputTokens',
            'cacheWriteTokens',
            'reasoningTokens',
          ] as const) {
            const value = attempt.usage?.[key],
              target = diagnostics[key];
            if (
              value !== undefined &&
              Number.isSafeInteger((target.total ?? 0) + value)
            ) {
              target.reports++;
              target.total = (target.total ?? 0) + value;
            }
          }
          if (attempt.usage?.cost !== undefined) {
            costReports++;
            gate.settle(ticket, attempt.usage.cost);
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
    reportClosed = true;
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
      diagnostics,
      results,
    };
    ledger.writeReport(report);
    return report;
  } finally {
    reportClosed = true;
    gate.finalize();
    ledger.close();
  }
}
