import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  clusterBenchmarkCases,
  evaluateBenchmarkCases,
  historicalCasesFromTraceRows,
  loadGoldCases,
  loadTraceRows,
  type BenchmarkCase,
  type SearchResult,
} from './tools-search-benchmark';
import { runToolSearch } from './tools-search';
import { applyManifestOverlay, readManifestOverlay, resolveOverlayHome } from './lib/manifest-overlay';

export type JevCatalogEntry = {
  name: string;
  category?: string;
  description?: string;
  hidden?: boolean;
  domainAliases?: string[];
  keywords?: string[];
  entities?: string[];
};

export type JevEncodedOption = {
  id: string;
  toolName: string;
  criterion: string;
};

export type JevEncodedCatalog = {
  options: JevEncodedOption[];
  criteria: Record<string, string>;
  toolByChoice: Map<string, string>;
};

type JevChoiceAnswer = {
  choice?: unknown;
  probabilities?: unknown;
  confidence?: unknown;
};

export type JevDecisionResponse = {
  answers?: Record<string, JevChoiceAnswer>;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
};

export type JevDecisionRequest = {
  model: string;
  state: { query: string };
  questions: {
    route: {
      type: 'choice';
      instructions: string;
      criteria: Record<string, string>;
    };
  };
};

export type JevBenchmarkConfig = {
  apiKey: string;
  model: string;
  maxCostUsd: number;
  timeoutMs: number;
  endpoint: string;
  safeSummary: {
    hasApiKey: boolean;
    credentialSource: 'OPENROUTER_API_KEY' | 'CONSUELO_OPENROUTER_API_KEY' | 'missing';
    model: string;
    maxCostUsd: number;
    timeoutMs: number;
    endpoint: string;
  };
};

type JevProviderObservation = {
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  reportedCost: boolean;
};

type CanonicalManifestEntry = {
  name: string;
  kind: 'os-skill' | 'facade-tool';
  category?: string;
  description?: string;
  definition?: Record<string, unknown>;
};

type CanonicalManifest = {
  tools: CanonicalManifestEntry[];
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(packageRoot, 'manifests', 'generated', 'tool.manifest.json');
const DEFAULT_MODEL = 'typesafe/jev-1.13';
const DEFAULT_MAX_COST_USD = 0.15;
const DEFAULT_TIMEOUT_MS = 20_000;
const OPENROUTER_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
const JEV_INPUT_PRICE_PER_MILLION_USD = 0.042;
const MAX_CRITERION_CHARS = 118;
const DEFAULT_HISTORICAL_LIMIT = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function criterionFor(entry: JevCatalogEntry): string {
  const description = compactText(entry.description || '');
  const category = compactText(entry.category || '');
  const base = category ? entry.name + ' [' + category + ']' : entry.name;
  const terms = [...new Set([
    ...(entry.domainAliases || []),
    ...(entry.keywords || []),
    ...(entry.entities || []),
  ].map(compactText).filter(Boolean))];
  const metadata = terms.length > 0 ? terms.join(' ') : '';
  const full = metadata
    ? base + ' | ' + metadata + (description ? ' | ' + description : '')
    : description
      ? base + ': ' + description
      : base;
  return full.length <= MAX_CRITERION_CHARS ? full : full.slice(0, MAX_CRITERION_CHARS - 1) + '…';
}

export function encodeJevCatalog(entries: JevCatalogEntry[]): JevEncodedCatalog {
  const visible = entries
    .filter((entry) => entry.hidden !== true)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const options: JevEncodedOption[] = visible.map((entry, index) => {
    const id = `tool_${String(index).padStart(3, '0')}`;
    return { id, toolName: entry.name, criterion: criterionFor(entry) };
  });
  const criteria: Record<string, string> = {};
  const toolByChoice = new Map<string, string>();
  for (const option of options) {
    criteria[option.id] = option.criterion;
    toolByChoice.set(option.id, option.toolName);
  }
  criteria.none = 'No listed tool is a good fit for this request; abstain instead of guessing.';
  return { options, criteria, toolByChoice };
}

export function buildJevDecisionRequest(input: {
  query: string;
  model: string;
  criteria: Record<string, string>;
}): JevDecisionRequest {
  return {
    model: input.model,
    state: { query: input.query },
    questions: {
      route: {
        type: 'choice',
        instructions: 'Select the single Consuelo tool that best handles state.query. Use only the listed criteria. Select none when no listed tool is a good fit.',
        criteria: input.criteria,
      },
    },
  };
}

function confidenceLabel(value: number): 'high' | 'medium' | 'low' {
  if (value >= 0.7) return 'high';
  if (value >= 0.4) return 'medium';
  return 'low';
}

function usageField(usage: Record<string, unknown> | undefined, names: string[]): number {
  if (!usage) return 0;
  for (const name of names) {
    const value = asFiniteNumber(usage[name]);
    if (value > 0) return value;
  }
  return 0;
}

export function parseJevDecisionResponse(input: {
  response: JevDecisionResponse;
  encoded: JevEncodedCatalog;
  latencyMs: number;
}): {
  searchResult: SearchResult;
  provider: JevProviderObservation;
} {
  const answer = input.response.answers?.route;
  if (!answer || typeof answer.choice !== 'string') {
    throw new Error('OpenRouter Decisions response is missing answers.route.choice');
  }
  const probabilities = isObject(answer.probabilities) ? answer.probabilities : {};
  const rankedChoices = Object.entries(probabilities)
    .map(([choice, probability]) => ({ choice, probability: asFiniteNumber(probability) }))
    .filter((row) => row.probability >= 0)
    .sort((a, b) => b.probability - a.probability || a.choice.localeCompare(b.choice));
  const chosenProbability = rankedChoices.find((row) => row.choice === answer.choice)?.probability
    ?? asFiniteNumber(answer.confidence);
  const chosenTool = answer.choice === 'none' ? undefined : input.encoded.toolByChoice.get(answer.choice);
  if (answer.choice !== 'none' && !chosenTool) {
    throw new Error(`OpenRouter Decisions returned unknown choice ${answer.choice}`);
  }

  const rankedTools = rankedChoices
    .filter((row) => row.choice !== 'none')
    .map((row) => input.encoded.toolByChoice.get(row.choice))
    .filter((name): name is string => typeof name === 'string');
  if (chosenTool && !rankedTools.includes(chosenTool)) rankedTools.unshift(chosenTool);

  const usage = isObject(input.response.usage) ? input.response.usage : undefined;
  const inputTokens = usageField(usage, ['input_tokens', 'inputTokens', 'prompt_tokens', 'promptTokens']);
  const outputTokens = usageField(usage, ['output_tokens', 'outputTokens', 'completion_tokens', 'completionTokens']);
  const reportedCost = usage ? ['cost', 'cost_usd', 'costUsd'].some((name) => usage[name] !== undefined) : false;
  const reportedCostUsd = usageField(usage, ['cost', 'cost_usd', 'costUsd']);
  const costUsd = reportedCost ? reportedCostUsd : inputTokens * (JEV_INPUT_PRICE_PER_MILLION_USD / 1_000_000);
  const matches = rankedTools.slice(0, 3).map((name) => ({ name }));
  const searchResult: SearchResult = {
    ...(chosenTool ? { recommended: chosenTool } : {}),
    confidence: confidenceLabel(chosenProbability),
    retrievalMode: 'jev',
    matches,
    diagnostics: {
      candidatesBeforeRanking: input.encoded.options.length,
      candidatesRanked: input.encoded.options.length,
      providerLatencyMs: input.latencyMs,
      inputTokens,
      outputTokens,
      costUsd,
    },
  };
  return {
    searchResult,
    provider: {
      latencyMs: input.latencyMs,
      inputTokens,
      outputTokens,
      costUsd,
      reportedCost,
    },
  };
}

export function estimateJevMaximumCostUsd(
  requests: Array<JevDecisionRequest | Record<string, unknown>>,
  inputPricePerMillionUsd = JEV_INPUT_PRICE_PER_MILLION_USD,
): number {
  const maximumInputTokens = requests.reduce(
    (sum, request) => sum + Buffer.byteLength(JSON.stringify(request)),
    0,
  );
  return maximumInputTokens * (inputPricePerMillionUsd / 1_000_000);
}

export function assertJevBudget(input: {
  requests: Array<JevDecisionRequest | Record<string, unknown>>;
  maxCostUsd: number;
}): number {
  const maximumCostUsd = estimateJevMaximumCostUsd(input.requests);
  if (maximumCostUsd > input.maxCostUsd) {
    throw new Error(
      `Jev benchmark preflight budget exceeded: conservative maximum $${maximumCostUsd.toFixed(6)} > budget $${input.maxCostUsd.toFixed(6)}`,
    );
  }
  return maximumCostUsd;
}

export function resolveJevBenchmarkConfig(
  env: Record<string, string | undefined> = process.env,
): JevBenchmarkConfig {
  const directKey = env.OPENROUTER_API_KEY?.trim();
  const existingConsueloKey = env.CONSUELO_OPENROUTER_API_KEY?.trim();
  const apiKey = directKey || existingConsueloKey || '';
  const credentialSource = directKey
    ? 'OPENROUTER_API_KEY'
    : existingConsueloKey
      ? 'CONSUELO_OPENROUTER_API_KEY'
      : 'missing';
  const model = env.JEV_MODEL?.trim() || DEFAULT_MODEL;
  const parsedBudget = Number.parseFloat(env.JEV_BENCHMARK_MAX_COST_USD || '');
  const maxCostUsd = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : DEFAULT_MAX_COST_USD;
  const parsedTimeout = Number.parseInt(env.JEV_BENCHMARK_TIMEOUT_MS || '', 10);
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS;
  const endpoint = env.JEV_DECISIONS_URL?.trim() || OPENROUTER_DECISIONS_URL;
  return {
    apiKey,
    model,
    maxCostUsd,
    timeoutMs,
    endpoint,
    safeSummary: {
      hasApiKey: apiKey.length > 0,
      credentialSource,
      model,
      maxCostUsd,
      timeoutMs,
      endpoint,
    },
  };
}

export function loadJevToolCatalog(): JevCatalogEntry[] {
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as CanonicalManifest;
  if (!parsed || !Array.isArray(parsed.tools)) {
    throw new Error(`${manifestPath}: expected generated tool manifest with tools array`);
  }
  const home = resolveOverlayHome();
  const manifest = fs.existsSync(path.join(home, 'config.json'))
    ? applyManifestOverlay(parsed, readManifestOverlay(home))
    : parsed;
  return manifest.tools.map((entry) => {
    const definition = isObject(entry.definition) ? entry.definition : {};
    const search = isObject(definition.search) ? definition.search : {};
    const definitionName = typeof definition.name === 'string' ? definition.name : undefined;
    const definitionDescription = typeof definition.description === 'string' ? definition.description : undefined;
    const definitionCategory = typeof definition.category === 'string' ? definition.category : undefined;
    const stringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
    return {
      name: entry.kind === 'facade-tool' && definitionName ? definitionName : entry.name,
      category: definitionCategory || entry.category,
      description: definitionDescription || entry.description,
      hidden: search.hidden === true,
      domainAliases: stringArray(search.domainAliases),
      keywords: stringArray(search.keywords),
      entities: stringArray(search.entities),
    };
  });
}

async function callJevDecision(input: {
  request: JevDecisionRequest;
  config: JevBenchmarkConfig;
  encoded: JevEncodedCatalog;
}): Promise<ReturnType<typeof parseJevDecisionResponse>> {
  if (!input.config.apiKey) {
    throw new Error('OpenRouter API key is missing; set OPENROUTER_API_KEY');
  }
  const started = performance.now();
  const response = await fetch(input.config.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://consuelohq.com',
      'X-Title': 'Consuelo OS tool-search Jev benchmark',
    },
    body: JSON.stringify(input.request),
    signal: AbortSignal.timeout(input.config.timeoutMs),
  });
  const latencyMs = performance.now() - started;
  const bodyText = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(`OpenRouter Decisions returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok) {
    const message = isObject(body) && isObject(body.error) && typeof body.error.message === 'string'
      ? body.error.message
      : `HTTP ${response.status}`;
    throw new Error(`OpenRouter Decisions request failed: ${message}`);
  }
  if (!isObject(body)) {
    throw new Error('OpenRouter Decisions returned an invalid response object');
  }
  return parseJevDecisionResponse({
    response: body as JevDecisionResponse,
    encoded: input.encoded,
    latencyMs,
  });
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1));
  return sorted[index];
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function evaluateCurrent(cases: BenchmarkCase[]) {
  try {
    const latencies: number[] = [];
    const report = await evaluateBenchmarkCases(cases, (query) => {
      const started = performance.now();
      return runToolSearch({
        query,
        limit: 3,
        includeEmbeddings: false,
        includeDocs: false,
        detail: 'full',
      }).then((result) => {
        latencies.push(performance.now() - started);
        return result as SearchResult;
      });
    });
    return {
      report,
      latency: {
        averageMs: average(latencies),
        p50Ms: percentile(latencies, 0.5),
        p95Ms: percentile(latencies, 0.95),
        totalMs: latencies.reduce((sum, value) => sum + value, 0),
      },
    };
  } catch (error: unknown) {
    throw new Error('current tools.search benchmark failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

async function evaluateJev(input: {
  cases: BenchmarkCase[];
  config: JevBenchmarkConfig;
  encoded: JevEncodedCatalog;
}) {
  const requests = input.cases.map((item) => buildJevDecisionRequest({
    query: item.query,
    model: input.config.model,
    criteria: input.encoded.criteria,
  }));
  const preflightMaximumCostUsd = assertJevBudget({
    requests,
    maxCostUsd: input.config.maxCostUsd,
  });
  let requestIndex = 0;
  let errorCount = 0;
  const errors: Array<{ id: string; message: string }> = [];
  const observations: JevProviderObservation[] = [];
  const report = await evaluateBenchmarkCases(input.cases, async () => {
    const index = requestIndex++;
    const item = input.cases[index];
    try {
      const parsed = await callJevDecision({
        request: requests[index],
        config: input.config,
        encoded: input.encoded,
      });
      observations.push(parsed.provider);
      return parsed.searchResult;
    } catch (error: unknown) {
      errorCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ id: item.id, message });
      return {
        confidence: 'low',
        retrievalMode: 'jev-error',
        matches: [],
        diagnostics: {
          candidatesBeforeRanking: input.encoded.options.length,
          candidatesRanked: input.encoded.options.length,
          providerError: true,
        },
      };
    }
  });
  const actualCostUsd = observations.reduce((sum, item) => sum + item.costUsd, 0);
  return {
    report,
    provider: {
      requests: input.cases.length,
      successes: observations.length,
      errors: errorCount,
      inputTokens: observations.reduce((sum, item) => sum + item.inputTokens, 0),
      outputTokens: observations.reduce((sum, item) => sum + item.outputTokens, 0),
      actualCostUsd,
      reportedCostResponses: observations.filter((item) => item.reportedCost).length,
      preflightMaximumCostUsd,
      latency: {
        averageMs: average(observations.map((item) => item.latencyMs)),
        p50Ms: percentile(observations.map((item) => item.latencyMs), 0.5),
        p95Ms: percentile(observations.map((item) => item.latencyMs), 0.95),
        totalMs: observations.reduce((sum, item) => sum + item.latencyMs, 0),
      },
      errorSamples: errors.slice(0, 5),
    },
  };
}

function parseArgs(argv: string[]): {
  historicalLimit: number;
  mode: 'all' | 'gold' | 'historical';
  dryRun: boolean;
} {
  let historicalLimit = DEFAULT_HISTORICAL_LIMIT;
  let mode: 'all' | 'gold' | 'historical' = 'all';
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--historical-limit') {
      historicalLimit = Math.max(1, Number.parseInt(argv[++index] || '', 10) || DEFAULT_HISTORICAL_LIMIT);
      continue;
    }
    if (arg === '--gold-only') {
      mode = 'gold';
      continue;
    }
    if (arg === '--historical-only') {
      mode = 'historical';
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }
  return { historicalLimit, mode, dryRun };
}

async function main(): Promise<void> {
  try {
const args = parseArgs(Bun.argv.slice(2));
  const config = resolveJevBenchmarkConfig();
  const catalog = loadJevToolCatalog();
  const encoded = encodeJevCatalog(catalog);
  const gold = args.mode === 'historical' ? [] : loadGoldCases();
  const traceRows = args.mode === 'gold' ? [] : await loadTraceRows();
  const historical = args.mode === 'gold'
    ? []
    : historicalCasesFromTraceRows(traceRows, args.historicalLimit)
      .filter((item) => item.weakExpected && item.weakExpected.length > 0);
  const cases = clusterBenchmarkCases([...gold, ...historical]);
  const requests = cases.map((item) => buildJevDecisionRequest({
    query: item.query,
    model: config.model,
    criteria: encoded.criteria,
  }));
  const preflightMaximumCostUsd = assertJevBudget({ requests, maxCostUsd: config.maxCostUsd });

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({
      config: config.safeSummary,
      corpus: {
        total: cases.length,
        gold: gold.length,
        historicalWeak: historical.length,
      },
      catalog: {
        total: catalog.length,
        visible: encoded.options.length,
      },
      preflightMaximumCostUsd,
      plannedRequests: requests.length,
    }, null, 2)}\n`);
    return;
  }
  if (!config.apiKey) {
    throw new Error('OpenRouter API key is missing; set OPENROUTER_API_KEY');
  }

  const current = await evaluateCurrent(cases);
  const jev = await evaluateJev({ cases, config, encoded });
  const comparison = {
    goldTop1Delta: jev.report.quality.top1Accuracy - current.report.quality.top1Accuracy,
    goldRecallAt3Delta: jev.report.quality.recallAt3 - current.report.quality.recallAt3,
    goldAbstentionDelta: jev.report.quality.abstentionAccuracy - current.report.quality.abstentionAccuracy,
    historicalWeakTop1Delta: jev.report.weakQuality.top1Accuracy - current.report.weakQuality.top1Accuracy,
    historicalWeakRecallAt3Delta: jev.report.weakQuality.recallAt3 - current.report.weakQuality.recallAt3,
    averageLatencyDeltaMs: jev.provider.latency.averageMs - current.latency.averageMs,
  };
  process.stdout.write(`${JSON.stringify({
    config: config.safeSummary,
    corpus: {
      total: cases.length,
      gold: gold.length,
      historicalWeak: historical.length,
    },
    catalog: {
      total: catalog.length,
      visible: encoded.options.length,
    },
    current,
    jev,
    comparison,
  }, null, 2)}\n`);
  } catch (error: unknown) {
    throw new Error('Jev tool-search benchmark failed: ' + (error instanceof Error ? error.message : String(error)));
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
