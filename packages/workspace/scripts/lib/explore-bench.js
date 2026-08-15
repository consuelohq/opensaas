'use strict';

const { Buffer } = require('node:buffer');

const DEFAULT_K_VALUES = [1, 3, 5, 10];
const TOOL_ACTIONS = ['explore', 'decideNext', 'confidenceScore', 'exploit'];

function finiteNumbers(values) {
  return (values || []).map(Number).filter(Number.isFinite);
}

function round(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function nearestRank(sorted, probability) {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil(probability * sorted.length));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
}

function summarizeDistribution(values) {
  const sorted = finiteNumbers(values).sort((left, right) => left - right);
  if (sorted.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p90: null,
      p95: null,
    };
  }

  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted.at(-1),
    mean: round(mean),
    median: nearestRank(sorted, 0.5),
    p90: nearestRank(sorted, 0.9),
    p95: nearestRank(sorted, 0.95),
  };
}

function dedupeEvidenceEvents(events) {
  const seenIds = new Set();
  const deduped = [];
  for (const event of events || []) {
    const id = typeof event?.id === 'string' && event.id.trim() ? event.id.trim() : null;
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);
    deduped.push(event);
  }
  return deduped;
}

function normalizeAction(value) {
  const normalized = String(value || '').replace(/[._-]/g, '').toLowerCase();
  if (normalized === 'explore') return 'explore';
  if (normalized === 'decidenext') return 'decideNext';
  if (normalized === 'confidencescore') return 'confidenceScore';
  if (normalized === 'exploit') return 'exploit';
  return null;
}

function summarizeToolAdoption(events) {
  const summary = {
    total: (events || []).length,
    explore: 0,
    decideNext: 0,
    confidenceScore: 0,
    exploit: 0,
  };
  for (const event of events || []) {
    const action = [event?.source, event?.action, event?.type]
      .map((candidate) => normalizeAction(candidate))
      .find(Boolean);
    if (action && TOOL_ACTIONS.includes(action)) summary[action] += 1;
  }
  return summary;
}

function serializedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function measurePayloadFields(results) {
  const bytesByField = new Map();
  for (const result of results || []) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) continue;
    for (const [field, value] of Object.entries(result)) {
      const bytes = serializedBytes(value);
      bytesByField.set(field, (bytesByField.get(field) || 0) + bytes);
    }
  }
  const totalValueBytes = Array.from(bytesByField.values()).reduce((sum, value) => sum + value, 0);
  const fields = Array.from(bytesByField.entries())
    .map(([field, bytes]) => ({
      field,
      bytes,
      fraction: totalValueBytes === 0 ? 0 : round(bytes / totalValueBytes),
    }))
    .sort((left, right) => right.bytes - left.bytes || left.field.localeCompare(right.field));
  return {
    resultCount: Array.isArray(results) ? results.length : 0,
    totalValueBytes,
    fields,
  };
}

function compactResult(result, maxConnections) {
  return {
    path: result.path ?? null,
    symbol: result.symbol ?? null,
    chunk_type: result.chunk_type ?? null,
    lines: result.lines ?? null,
    score: result.score ?? null,
    belief_prior: result.belief_prior ?? null,
    evidence_state: result.evidence_state ?? null,
    information_value: result.information_value ?? null,
    reason: result.reason ?? null,
    preview: result.preview ?? '',
    connections: Array.from(new Set(result.graph_connections || [])).slice(0, maxConnections),
  };
}

function projectCompactExplorePayload(payload, options = {}) {
  const maxConnections = Number.isInteger(options.maxConnections) && options.maxConnections >= 0
    ? options.maxConnections
    : 2;
  const compactPayload = {
    query: payload?.query ?? null,
    budget: payload?.budget ?? null,
    results: (payload?.results || []).map((result) => compactResult(result, maxConnections)),
    source_routes: payload?.source_routes || [],
    index_stats: payload?.index_stats || {},
  };
  const originalBytes = serializedBytes(payload || {});
  const compactBytes = serializedBytes(compactPayload);
  return {
    payload: compactPayload,
    originalBytes,
    compactBytes,
    byteReductionFraction: originalBytes === 0 ? 0 : round(1 - (compactBytes / originalBytes)),
  };
}

function validateBenchmarkCases(cases) {
  if (!Array.isArray(cases)) throw new Error('benchmark cases must be an array');
  const ids = new Set();
  let labeledCaseCount = 0;
  for (const benchmarkCase of cases) {
    if (!benchmarkCase || typeof benchmarkCase !== 'object') throw new Error('benchmark case must be an object');
    if (typeof benchmarkCase.id !== 'string' || !benchmarkCase.id.trim()) throw new Error('benchmark case id is required');
    if (ids.has(benchmarkCase.id)) throw new Error(`duplicate benchmark case id: ${benchmarkCase.id}`);
    ids.add(benchmarkCase.id);
    if (typeof benchmarkCase.query !== 'string' || !benchmarkCase.query.trim()) throw new Error(`benchmark case ${benchmarkCase.id} query is required`);
    if (!Array.isArray(benchmarkCase.labels)) throw new Error(`benchmark case ${benchmarkCase.id} labels must be an array`);
    const paths = new Set();
    for (const label of benchmarkCase.labels) {
      if (typeof label?.path !== 'string' || !label.path.trim()) throw new Error(`benchmark case ${benchmarkCase.id} label path is required`);
      if (paths.has(label.path)) throw new Error(`benchmark case ${benchmarkCase.id} has duplicate label path: ${label.path}`);
      paths.add(label.path);
      if (!Number.isInteger(label.relevance) || label.relevance < 0 || label.relevance > 3) {
        throw new Error(`benchmark case ${benchmarkCase.id} relevance must be an integer from 0 to 3`);
      }
      if (label.required != null && typeof label.required !== 'boolean') {
        throw new Error(`benchmark case ${benchmarkCase.id} required must be boolean`);
      }
      if (label.role != null && (typeof label.role !== 'string' || !label.role.trim())) {
        throw new Error(`benchmark case ${benchmarkCase.id} role must be a non-empty string`);
      }
    }
    if (benchmarkCase.labels.some((label) => label.relevance > 0)) labeledCaseCount += 1;
  }
  return {
    caseCount: cases.length,
    labeledCaseCount,
    unlabeledCaseCount: cases.length - labeledCaseCount,
  };
}

function uniqueRankedPaths(ranking) {
  const seen = new Set();
  const paths = [];
  for (const row of ranking || []) {
    const path = typeof row === 'string' ? row : row?.path;
    if (!path || seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
  }
  return paths;
}

function dcg(relevances, k) {
  let total = 0;
  for (let index = 0; index < Math.min(k, relevances.length); index += 1) {
    const relevance = relevances[index] || 0;
    total += ((2 ** relevance) - 1) / Math.log2(index + 2);
  }
  return total;
}

function meanMetric(rows, selector) {
  if (rows.length === 0) return 0;
  return round(rows.reduce((sum, row) => sum + selector(row), 0) / rows.length, 12);
}

function evaluateBenchmark(cases, rankingsByCaseId, options = {}) {
  const validation = validateBenchmarkCases(cases);
  const kValues = Array.from(new Set(options.kValues || DEFAULT_K_VALUES))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);
  if (kValues.length === 0) throw new Error('at least one positive k value is required');

  const rows = [];
  for (const benchmarkCase of cases) {
    const relevantLabels = benchmarkCase.labels.filter((label) => label.relevance > 0);
    if (relevantLabels.length === 0) continue;
    const relevanceByPath = new Map(relevantLabels.map((label) => [label.path, label.relevance]));
    const requiredPaths = new Set(relevantLabels.filter((label) => label.required).map((label) => label.path));
    const rankedPaths = uniqueRankedPaths(rankingsByCaseId?.get(benchmarkCase.id) || []);
    const firstRelevantIndex = rankedPaths.findIndex((path) => relevanceByPath.has(path));
    const idealRelevances = relevantLabels.map((label) => label.relevance).sort((left, right) => right - left);
    const maxK = kValues.at(-1);
    const row = {
      id: benchmarkCase.id,
      reciprocalRank: firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1),
      recallAtK: {},
      requiredRecallAtK: {},
      ndcgAtK: {},
      topPaths: rankedPaths.slice(0, maxK),
      requiredPaths: Array.from(requiredPaths),
      missingRequiredPaths: Array.from(requiredPaths).filter((path) => !rankedPaths.slice(0, maxK).includes(path)),
    };
    for (const k of kValues) {
      const top = rankedPaths.slice(0, k);
      const foundRelevant = top.filter((path) => relevanceByPath.has(path)).length;
      const foundRequired = top.filter((path) => requiredPaths.has(path)).length;
      row.recallAtK[k] = foundRelevant / relevantLabels.length;
      row.requiredRecallAtK[k] = requiredPaths.size === 0 ? 1 : foundRequired / requiredPaths.size;
      const actualRelevances = top.map((path) => relevanceByPath.get(path) || 0);
      const ideal = dcg(idealRelevances, k);
      row.ndcgAtK[k] = ideal === 0 ? 0 : dcg(actualRelevances, k) / ideal;
    }
    rows.push(row);
  }

  const recallAtK = {};
  const requiredRecallAtK = {};
  const ndcgAtK = {};
  for (const k of kValues) {
    recallAtK[k] = meanMetric(rows, (row) => row.recallAtK[k]);
    requiredRecallAtK[k] = meanMetric(rows, (row) => row.requiredRecallAtK[k]);
    ndcgAtK[k] = meanMetric(rows, (row) => row.ndcgAtK[k]);
  }
  return {
    caseCount: validation.caseCount,
    evaluatedCaseCount: rows.length,
    unlabeledCaseCount: validation.unlabeledCaseCount,
    metrics: {
      recallAtK,
      requiredRecallAtK,
      mrr: meanMetric(rows, (row) => row.reciprocalRank),
      ndcgAtK,
    },
    caseResults: rows,
  };
}

function summarizeCompactProjections(traceRows) {
  const projections = [];
  const projectedOutputTokens = [];
  for (const row of traceRows || []) {
    if (!row?.payload || !Array.isArray(row.payload.results)) continue;
    const projection = projectCompactExplorePayload(row.payload);
    projections.push(projection);
    if (Number.isFinite(Number(row.outputTokens)) && projection.originalBytes > 0) {
      projectedOutputTokens.push(Number(row.outputTokens) * (projection.compactBytes / projection.originalBytes));
    }
  }
  return {
    sampleCount: projections.length,
    originalBytes: summarizeDistribution(projections.map((entry) => entry.originalBytes)),
    compactBytes: summarizeDistribution(projections.map((entry) => entry.compactBytes)),
    byteReductionFraction: summarizeDistribution(projections.map((entry) => entry.byteReductionFraction)),
    projectedOutputTokens: summarizeDistribution(projectedOutputTokens),
    projectionMethod: 'observed output tokens multiplied by compact/original payload byte ratio; estimate only',
  };
}
function aggregatePayloadFields(traceRows) {
  const allResults = [];
  for (const row of traceRows || []) {
    if (Array.isArray(row?.payload?.results)) allResults.push(...row.payload.results);
  }
  return measurePayloadFields(allResults);
}

function buildExploreBenchReport(input) {
  const traceRows = (input.traceRows || []).filter((row) => normalizeAction(row?.tool) === 'explore');
  const successfulPayloadRows = traceRows.filter((row) => row?.ok !== false && Array.isArray(row?.payload?.results));
  const evidenceEvents = dedupeEvidenceEvents(input.evidenceEvents || []);
  const benchmark = evaluateBenchmark(
    input.benchmarkCases || [],
    input.rankingsByCaseId || new Map(),
    input.benchmarkOptions,
  );
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt || new Date().toISOString(),
    traceSummary: {
      sampleCount: traceRows.length,
      successfulPayloadCount: successfulPayloadRows.length,
      failedOrPayloadlessCount: traceRows.length - successfulPayloadRows.length,
      dateRange: {
        start: traceRows.map((row) => row.ts).filter(Boolean).sort()[0] || null,
        end: traceRows.map((row) => row.ts).filter(Boolean).sort().at(-1) || null,
      },
      inputTokens: summarizeDistribution(successfulPayloadRows.map((row) => row.inputTokens)),
      outputTokens: summarizeDistribution(successfulPayloadRows.map((row) => row.outputTokens)),
      allOutputTokens: summarizeDistribution(traceRows.map((row) => row.outputTokens)),
      durationMs: summarizeDistribution(successfulPayloadRows.map((row) => row.durationMs)),
      resultCount: summarizeDistribution(successfulPayloadRows.map((row) => row?.payload?.results?.length)),
    },
    toolAdoption: summarizeToolAdoption(evidenceEvents),
    payloadSummary: {
      fieldAttribution: aggregatePayloadFields(traceRows),
      compactProjection: summarizeCompactProjections(traceRows),
    },
    benchmark,
  };
}

function formatPercent(value) {
  return Number.isFinite(value) ? ((value * 100).toFixed(1) + '%') : 'n/a';
}

function renderExploreBenchMarkdown(report, options = {}) {
  const title = options.title || 'ExploreBench baseline';
  const trace = report?.traceSummary || {};
  const adoption = report?.toolAdoption || {};
  const compact = report?.payloadSummary?.compactProjection || {};
  const fields = report?.payloadSummary?.fieldAttribution?.fields || [];
  const benchmark = report?.benchmark || {};
  const metrics = benchmark.metrics || {};
  const kValues = Object.keys(metrics.recallAtK || {}).sort((a, b) => Number(a) - Number(b));
  const lines = [
    '# ' + title,
    '',
    'Generated: ' + (report?.generatedAt || 'unknown'),
    '',
    '## Trace baseline',
    '',
    '- Explore calls in trace DB: **' + (trace.sampleCount ?? 0) + '**; successful payloads: **' + (trace.successfulPayloadCount ?? 0) + '**; failed/payloadless: **' + (trace.failedOrPayloadlessCount ?? 0) + '**',
    '- Trace range: **' + (trace.dateRange?.start ?? 'n/a') + '** to **' + (trace.dateRange?.end ?? 'n/a') + '**',
    '- Output tokens: median **' + (trace.outputTokens?.median ?? 'n/a') + '**, p90 **' + (trace.outputTokens?.p90 ?? 'n/a') + '**, max **' + (trace.outputTokens?.max ?? 'n/a') + '**',
    '- Duration: median **' + (trace.durationMs?.median ?? 'n/a') + ' ms**, p90 **' + (trace.durationMs?.p90 ?? 'n/a') + ' ms**',
    '- Result count: median **' + (trace.resultCount?.median ?? 'n/a') + '**',
    '',
    '## Tool adoption (deduplicated evidence events)',
    '',
    '- Explore: **' + (adoption.explore ?? 0) + '**',
    '- decideNext: **' + (adoption.decideNext ?? 0) + '**',
    '- confidenceScore: **' + (adoption.confidenceScore ?? 0) + '**',
    '- exploit: **' + (adoption.exploit ?? 0) + '**',
    '',
    '## Payload cost',
    '',
    '- Compact-packet projection samples: **' + (compact.sampleCount ?? 0) + '**',
    '- Median serialized-byte reduction: **' + formatPercent(compact.byteReductionFraction?.median) + '**',
    '- Projected median output tokens: **' + (compact.projectedOutputTokens?.median == null ? 'n/a' : Math.round(compact.projectedOutputTokens.median)) + '**',
    '- Projection method: ' + (compact.projectionMethod || 'n/a'),
    '',
    'Largest result fields by serialized value bytes:',
    '',
    '| field | bytes | share |',
    '|---|---:|---:|',
    ...fields.slice(0, 10).map((entry) => '| ' + entry.field + ' | ' + entry.bytes + ' | ' + formatPercent(entry.fraction) + ' |'),
    '',
    '## Curated retrieval benchmark',
    '',
    '- Cases: **' + (benchmark.caseCount ?? 0) + '**; evaluated: **' + (benchmark.evaluatedCaseCount ?? 0) + '**; unlabeled: **' + (benchmark.unlabeledCaseCount ?? 0) + '**',
    '- MRR: **' + (metrics.mrr ?? 'n/a') + '**',
    '',
    '| k | Recall@k | required-node recall | nDCG@k |',
    '|---:|---:|---:|---:|',
    ...kValues.map((k) => '| ' + k + ' | ' + (metrics.recallAtK?.[k] ?? 'n/a') + ' | ' + (metrics.requiredRecallAtK?.[k] ?? 'n/a') + ' | ' + (metrics.ndcgAtK?.[k] ?? 'n/a') + ' |'),
    '',
    '### Case diagnostics at max k',
    '',
    '| case | reciprocal rank | missing required nodes |',
    '|---|---:|---|',
    ...(benchmark.caseResults || []).map((entry) => '| ' + entry.id + ' | ' + entry.reciprocalRank.toFixed(3) + ' | ' + (entry.missingRequiredPaths.length ? entry.missingRequiredPaths.join('<br>') : 'none') + ' |'),
    '',
    '## Input provenance',
    '',
    '- Control commit: `' + (report?.metadata?.controlCommit || 'unknown') + '`',
    '- Ranking mode: **' + (report?.metadata?.rankingMode || 'unknown') + '**',
    '- Evidence logs scanned: **' + (report?.metadata?.evidenceLogFileCount ?? 0) + '**; parse errors: **' + (report?.metadata?.evidenceParseErrorCount ?? 0) + '**',
    '- Index files/chunks: **' + (report?.metadata?.index?.totalFiles ?? 'n/a') + ' / ' + (report?.metadata?.index?.totalChunks ?? 'n/a') + '**',
    '- Embedding configuration: `' + (report?.metadata?.index?.embeddingConfigId || 'n/a') + '`',
    '',
    '## Methodological limits',
    '',
    '- Raw trace queries and payloads are analysis inputs only and are not embedded in this report.',
    '- Compact-token numbers are byte-ratio projections, not measurements from a deployed compact response.',
    '- Retrieval metrics use the curated labels in the benchmark corpus; they are not an unbiased estimate over all engineering queries.',
    '- E0 measures the current Explore control and does not alter retrieval, ranking, belief updates, or response behavior.',
    '',
  ];
  return lines.join('\n');
}
module.exports = {
  buildExploreBenchReport,
  dedupeEvidenceEvents,
  evaluateBenchmark,
  measurePayloadFields,
  projectCompactExplorePayload,
  renderExploreBenchMarkdown,
  summarizeDistribution,
  summarizeToolAdoption,
  validateBenchmarkCases,
};
