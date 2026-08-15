'use strict';

const DEFAULT_K_VALUES = [1, 3, 5, 10];

function round(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function validateBenchmarkCases(cases) {
  if (!Array.isArray(cases)) throw new Error('benchmark cases must be an array');
  const ids = new Set();
  let labeledCaseCount = 0;

  for (const benchmarkCase of cases) {
    if (!benchmarkCase || typeof benchmarkCase !== 'object') {
      throw new Error('benchmark case must be an object');
    }
    if (typeof benchmarkCase.id !== 'string' || !benchmarkCase.id.trim()) {
      throw new Error('benchmark case id is required');
    }
    if (ids.has(benchmarkCase.id)) {
      throw new Error(`duplicate benchmark case id: ${benchmarkCase.id}`);
    }
    ids.add(benchmarkCase.id);
    if (typeof benchmarkCase.query !== 'string' || !benchmarkCase.query.trim()) {
      throw new Error(`benchmark case ${benchmarkCase.id} query is required`);
    }
    if (!Array.isArray(benchmarkCase.labels)) {
      throw new Error(`benchmark case ${benchmarkCase.id} labels must be an array`);
    }

    const paths = new Set();
    for (const label of benchmarkCase.labels) {
      if (typeof label?.path !== 'string' || !label.path.trim()) {
        throw new Error(`benchmark case ${benchmarkCase.id} label path is required`);
      }
      if (paths.has(label.path)) {
        throw new Error(`benchmark case ${benchmarkCase.id} has duplicate label path: ${label.path}`);
      }
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
    const filePath = typeof row === 'string' ? row : row?.path;
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    paths.push(filePath);
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
  return round(rows.reduce((sum, row) => sum + selector(row), 0) / rows.length);
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
    const requiredPaths = new Set(
      relevantLabels.filter((label) => label.required).map((label) => label.path),
    );
    const rankedPaths = uniqueRankedPaths(rankingsByCaseId?.get(benchmarkCase.id) || []);
    const firstRelevantIndex = rankedPaths.findIndex((filePath) => relevanceByPath.has(filePath));
    const idealRelevances = relevantLabels
      .map((label) => label.relevance)
      .sort((left, right) => right - left);
    const maxK = kValues.at(-1);
    const row = {
      id: benchmarkCase.id,
      reciprocalRank: firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1),
      recallAtK: {},
      requiredRecallAtK: {},
      ndcgAtK: {},
      topPaths: rankedPaths.slice(0, maxK),
      requiredPaths: Array.from(requiredPaths),
      missingRequiredPaths: Array.from(requiredPaths)
        .filter((filePath) => !rankedPaths.slice(0, maxK).includes(filePath)),
    };

    for (const k of kValues) {
      const top = rankedPaths.slice(0, k);
      const foundRelevant = top.filter((filePath) => relevanceByPath.has(filePath)).length;
      const foundRequired = top.filter((filePath) => requiredPaths.has(filePath)).length;
      row.recallAtK[k] = foundRelevant / relevantLabels.length;
      row.requiredRecallAtK[k] = requiredPaths.size === 0 ? 1 : foundRequired / requiredPaths.size;
      const actualRelevances = top.map((filePath) => relevanceByPath.get(filePath) || 0);
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

function renderBenchmarkMarkdown(report, options = {}) {
  const title = options.title || 'OS ExploreBench';
  const metrics = report?.benchmark?.metrics || {};
  const kValues = Object.keys(metrics.recallAtK || {}).sort((left, right) => Number(left) - Number(right));
  return [
    `# ${title}`,
    '',
    `Generated: ${report?.generatedAt || 'unknown'}`,
    '',
    `- Cases: **${report?.benchmark?.caseCount ?? 0}**`,
    `- MRR: **${metrics.mrr ?? 'n/a'}**`,
    '',
    '| k | Recall@k | required-node recall | nDCG@k |',
    '|---:|---:|---:|---:|',
    ...kValues.map((k) => `| ${k} | ${metrics.recallAtK?.[k] ?? 'n/a'} | ${metrics.requiredRecallAtK?.[k] ?? 'n/a'} | ${metrics.ndcgAtK?.[k] ?? 'n/a'} |`),
    '',
    '## Case diagnostics at max k',
    '',
    '| case | reciprocal rank | missing required nodes |',
    '|---|---:|---|',
    ...(report?.benchmark?.caseResults || []).map((entry) => (
      `| ${entry.id} | ${entry.reciprocalRank.toFixed(3)} | ${entry.missingRequiredPaths.length ? entry.missingRequiredPaths.join('<br>') : 'none'} |`
    )),
    '',
    '## Provenance',
    '',
    `- Retrieval surface: **${report?.metadata?.retrievalSurface || 'unknown'}**`,
    `- Commit: \`${report?.metadata?.commit || 'unknown'}\``,
    `- Case file: \`${report?.metadata?.caseFile || 'unknown'}\``,
    `- Index files/chunks: **${report?.metadata?.index?.totalFiles ?? 'n/a'} / ${report?.metadata?.index?.totalChunks ?? 'n/a'}**`,
    '',
  ].join('\n');
}

module.exports = {
  evaluateBenchmark,
  renderBenchmarkMarkdown,
  validateBenchmarkCases,
};
