const DEFAULT_RANK_BINS = [
  { name: 'r1', minRank: 1, maxRank: 1 },
  { name: 'r2_3', minRank: 2, maxRank: 3 },
  { name: 'r4_5', minRank: 4, maxRank: 5 },
  { name: 'r6_10', minRank: 6, maxRank: 10 },
];

const CALIBRATION_MIN_CASES = 50;

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function getRankBin(rank, bins = DEFAULT_RANK_BINS) {
  return bins.find((bin) => rank >= bin.minRank && rank <= bin.maxRank) || null;
}

function getRankSupport(rank, calibration) {
  const bin = getRankBin(rank, calibration?.bins || DEFAULT_RANK_BINS);
  if (!bin) return 0;
  return Number(bin.estimatedRelevanceRate ?? 0);
}

function getRelevantPaths(caseDefinition) {
  return new Set((caseDefinition?.labels || [])
    .filter((label) => Number(label.relevance || 0) > 0)
    .map((label) => label.path));
}

function collectCalibrationCounts(report, casesById, excludedCaseId = null, bins = DEFAULT_RANK_BINS) {
  const counts = new Map(bins.map((bin) => [bin.name, { samples: 0, relevant: 0 }]));

  for (const caseResult of report?.benchmark?.caseResults || []) {
    if (!caseResult?.id || caseResult.id === excludedCaseId) continue;
    const relevantPaths = getRelevantPaths(casesById.get(caseResult.id));
    (caseResult.topPaths || []).slice(0, 10).forEach((filePath, index) => {
      const bin = getRankBin(index + 1, bins);
      if (!bin) return;
      const current = counts.get(bin.name);
      current.samples += 1;
      if (relevantPaths.has(filePath)) current.relevant += 1;
    });
  }

  return counts;
}

function jeffreysRate(relevant, samples) {
  return (Number(relevant || 0) + 0.5) / (Number(samples || 0) + 1);
}

function fitRankCalibration(report, caseCorpus, options = {}) {
  const bins = options.bins || DEFAULT_RANK_BINS;
  const minimumCases = options.minimumCases || CALIBRATION_MIN_CASES;
  const cases = caseCorpus?.cases || [];
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const allCounts = collectCalibrationCounts(report, casesById, null, bins);
  const caseResults = report?.benchmark?.caseResults || [];
  let squaredError = 0;
  let scoredObservations = 0;

  for (const caseResult of caseResults) {
    const heldOutRelevant = getRelevantPaths(casesById.get(caseResult.id));
    const trainingCounts = collectCalibrationCounts(report, casesById, caseResult.id, bins);
    (caseResult.topPaths || []).slice(0, 10).forEach((filePath, index) => {
      const bin = getRankBin(index + 1, bins);
      if (!bin) return;
      const counts = trainingCounts.get(bin.name);
      const prediction = jeffreysRate(counts.relevant, counts.samples);
      const observed = heldOutRelevant.has(filePath) ? 1 : 0;
      squaredError += (prediction - observed) ** 2;
      scoredObservations += 1;
    });
  }

  const fittedBins = bins.map((bin) => {
    const counts = allCounts.get(bin.name);
    return {
      ...bin,
      samples: counts.samples,
      relevant: counts.relevant,
      estimatedRelevanceRate: jeffreysRate(counts.relevant, counts.samples),
    };
  });

  return {
    schemaVersion: 1,
    method: 'jeffreys-smoothed-binomial-rank-bins',
    status: caseResults.length >= minimumCases && options.approvedCalibration === true ? 'calibrated' : 'provisional',
    minimumCasesForCalibratedStatus: minimumCases,
    caseCount: caseResults.length,
    observationCount: fittedBins.reduce((sum, bin) => sum + bin.samples, 0),
    prior: { alpha: 0.5, beta: 0.5 },
    bins: fittedBins,
    leaveOneCaseOutBrier: scoredObservations > 0 ? squaredError / scoredObservations : null,
  };
}

function getResultRole(result) {
  if (/\.(spec|test)\.[jt]sx?$/.test(result.path || '') || String(result.path || '').includes('/__tests__/')) {
    return 'test';
  }
  if (result.is_implementation) return 'implementation';
  if (/\.(json|toml|ya?ml)$/.test(result.path || '')) return 'configuration';
  if (/\.(md|mdx)$/.test(result.path || '')) return 'documentation';
  return result.chunk_type || 'related';
}

function buildHypothesesFromResults(results = [], calibration = { bins: DEFAULT_RANK_BINS, status: 'provisional' }) {
  const ranked = results.map((result, index) => ({ ...result, rank: index + 1 }));
  const resultPaths = new Set(ranked.map((result) => result.path));
  const parent = new Map(ranked.map((result) => [result.path, result.path]));

  function find(filePath) {
    const current = parent.get(filePath);
    if (current === filePath) return current;
    const root = find(current);
    parent.set(filePath, root);
    return root;
  }

  function union(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const leftRank = ranked.find((result) => result.path === leftRoot)?.rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = ranked.find((result) => result.path === rightRoot)?.rank ?? Number.MAX_SAFE_INTEGER;
    if (leftRank <= rightRank) parent.set(rightRoot, leftRoot);
    else parent.set(leftRoot, rightRoot);
  }

  for (const result of ranked) {
    for (const connection of result.graph_connections || []) {
      if (resultPaths.has(connection)) union(result.path, connection);
    }
  }

  const groups = new Map();
  for (const result of ranked) {
    const root = find(result.path);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(result);
  }

  const hypotheses = [];
  for (const group of groups.values()) {
    group.sort((left, right) => left.rank - right.rank || left.path.localeCompare(right.path));
    const root = group[0];
    const memberPaths = group.map((result) => result.path);
    const memberSet = new Set(memberPaths);
    const contextPaths = unique(group.flatMap((result) => result.graph_connections || []))
      .filter((filePath) => !memberSet.has(filePath))
      .sort();

    hypotheses.push({
      id: `hypothesis:${root.path}`,
      root_path: root.path,
      root_rank: root.rank,
      member_paths: memberPaths,
      members: group.map((result) => ({
        path: result.path,
        rank: result.rank,
        role: getResultRole(result),
      })),
      context_paths: contextPaths,
      retrieval_support: getRankSupport(root.rank, calibration),
      calibration_status: calibration?.status || 'provisional',
      read_paths: [],
      explicit_relevant_paths: [],
      explicit_irrelevant_paths: [],
      support_state: 'unlabeled',
    });
  }

  return rankHypotheses(hypotheses);
}

function deriveSupportState(hypothesis) {
  const relevant = new Set(hypothesis.explicit_relevant_paths || []);
  const irrelevant = new Set(hypothesis.explicit_irrelevant_paths || []);
  if (irrelevant.has(hypothesis.root_path)) return 'contradicted';
  if (relevant.size > 0 && irrelevant.size > 0) return 'mixed';
  if (relevant.size > 0) return 'supported';
  if (irrelevant.size > 0) return 'mixed';
  return 'unlabeled';
}

function supportStateRank(state) {
  if (state === 'supported') return 3;
  if (state === 'unlabeled') return 2;
  if (state === 'mixed') return 1;
  return 0;
}

function rankHypotheses(hypotheses = []) {
  return [...hypotheses].sort((left, right) => {
    const stateDifference = supportStateRank(right.support_state) - supportStateRank(left.support_state);
    if (stateDifference !== 0) return stateDifference;
    const supportDifference = Number(right.retrieval_support || 0) - Number(left.retrieval_support || 0);
    if (supportDifference !== 0) return supportDifference;
    return Number(left.root_rank || 0) - Number(right.root_rank || 0) || left.root_path.localeCompare(right.root_path);
  });
}

function normalizeHypothesis(hypothesis) {
  const normalized = {
    ...hypothesis,
    read_paths: unique(hypothesis.read_paths || []).sort(),
    explicit_relevant_paths: unique(hypothesis.explicit_relevant_paths || []).sort(),
    explicit_irrelevant_paths: unique(hypothesis.explicit_irrelevant_paths || []).sort(),
  };
  normalized.support_state = deriveSupportState(normalized);
  return normalized;
}

function updateHypothesesWithEvents(state, events = [], calibration) {
  const hypotheses = (state?.hypotheses?.length
    ? state.hypotheses
    : buildHypothesesFromResults(state?.results || [], calibration))
    .map((hypothesis) => normalizeHypothesis(hypothesis));
  const appliedEventIds = new Set(state?.hypothesis_event_ids || []);

  function matchingHypotheses(filePath) {
    return hypotheses.filter((hypothesis) => hypothesis.member_paths.includes(filePath) || hypothesis.context_paths.includes(filePath));
  }

  for (const event of events) {
    if (!event?.id || appliedEventIds.has(event.id)) continue;
    const filePath = event.file_path || null;

    if (filePath && event.type === 'file.read') {
      for (const hypothesis of matchingHypotheses(filePath)) {
        hypothesis.read_paths = unique([...(hypothesis.read_paths || []), filePath]).sort();
      }
      appliedEventIds.add(event.id);
      continue;
    }

    if (filePath && (event.type === 'file.relevant' || event.type === 'file.irrelevant')) {
      for (const hypothesis of matchingHypotheses(filePath)) {
        const relevant = new Set(hypothesis.explicit_relevant_paths || []);
        const irrelevant = new Set(hypothesis.explicit_irrelevant_paths || []);
        if (event.type === 'file.relevant') {
          irrelevant.delete(filePath);
          relevant.add(filePath);
        } else {
          relevant.delete(filePath);
          irrelevant.add(filePath);
        }
        hypothesis.explicit_relevant_paths = Array.from(relevant).sort();
        hypothesis.explicit_irrelevant_paths = Array.from(irrelevant).sort();
      }
      appliedEventIds.add(event.id);
      continue;
    }

    appliedEventIds.add(event.id);
  }

  const normalized = hypotheses.map(normalizeHypothesis);
  return {
    ...state,
    hypothesis_version: 1,
    hypotheses: rankHypotheses(normalized),
    hypothesis_event_ids: Array.from(appliedEventIds),
    hypotheses_updated_at: new Date().toISOString(),
  };
}

function getLatestValidation(events, group) {
  let latest = null;
  for (const event of events || []) {
    if (String(event.type || '').split('.')[0] === group) latest = event;
  }
  if (!latest) return 'unobserved';
  if (latest.type === `${group}.pass` || latest.type === `${group}.clean`) return 'pass';
  if (latest.type === `${group}.fail` || latest.type === `${group}.error`) return 'fail';
  return latest.status || 'observed';
}

function deriveReadiness(state, events = []) {
  const hypotheses = rankHypotheses(state?.hypotheses || []);
  const top = hypotheses[0] || null;
  const validation = {
    test: getLatestValidation(events, 'test'),
    verify: getLatestValidation(events, 'verify'),
    runtime: getLatestValidation(events, 'runtime'),
  };
  const contradiction = (events || []).some((event) => event.type === 'contradiction.detected');
  const validationFailed = Object.values(validation).includes('fail');

  if (!top) {
    return {
      state: 'insufficient-evidence',
      top_hypothesis: null,
      validation,
      contradiction,
      coverage: { root_read: false, dependency_read_count: 0, dependency_count: 0 },
      reasons: ['no hypotheses are available'],
    };
  }

  const read = new Set(top.read_paths || []);
  const dependencyPaths = unique([
    ...(top.member_paths || []).filter((filePath) => filePath !== top.root_path),
    ...(top.context_paths || []),
  ]);
  const dependencyReadCount = dependencyPaths.filter((filePath) => read.has(filePath)).length;
  const rootRead = read.has(top.root_path);
  const blocked = validationFailed || contradiction || top.support_state === 'contradicted';
  const enoughCoverage = rootRead && (dependencyPaths.length === 0 || dependencyReadCount > 0);
  const readinessState = blocked ? 'blocked' : enoughCoverage ? 'ready-to-edit' : 'gathering';
  const reasons = [];
  if (!rootRead) reasons.push('read the top hypothesis root');
  if (dependencyPaths.length > 0 && dependencyReadCount === 0) reasons.push('read at least one connected dependency');
  if (top.support_state === 'contradicted') reasons.push('top hypothesis root is explicitly marked irrelevant');
  if (validationFailed) reasons.push('validation evidence contains a failure');
  if (contradiction) reasons.push('a contradiction is recorded');

  return {
    state: readinessState,
    top_hypothesis: {
      id: top.id,
      root_path: top.root_path,
      support_state: top.support_state,
      retrieval_support: top.retrieval_support,
      calibration_status: top.calibration_status,
    },
    validation,
    contradiction,
    coverage: {
      root_read: rootRead,
      dependency_read_count: dependencyReadCount,
      dependency_count: dependencyPaths.length,
    },
    reasons,
  };
}

function chooseHypothesisTarget(hypotheses = []) {
  return rankHypotheses(hypotheses)[0]?.root_path || null;
}

function getNextUnreadPath(state) {
  const top = rankHypotheses(state?.hypotheses || [])[0];
  if (!top) return null;
  const read = new Set(top.read_paths || []);
  const candidates = unique([
    top.root_path,
    ...(top.member_paths || []).filter((filePath) => filePath !== top.root_path),
    ...(top.context_paths || []),
  ]);
  return candidates.find((filePath) => !read.has(filePath)) || null;
}

module.exports = {
  CALIBRATION_MIN_CASES,
  DEFAULT_RANK_BINS,
  buildHypothesesFromResults,
  chooseHypothesisTarget,
  deriveReadiness,
  fitRankCalibration,
  getNextUnreadPath,
  getRankSupport,
  rankHypotheses,
  updateHypothesesWithEvents,
};
