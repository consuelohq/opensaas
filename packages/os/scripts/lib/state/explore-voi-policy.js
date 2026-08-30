'use strict';

const VOI_VERSION = 1;
const METHOD = 'myopic-empirical-voi-proxy';

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function round(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function coverageUtility(coverage = {}) {
  const root = coverage.root_read ? 1 : 0;
  const dependencyCount = Math.max(0, Number(coverage.dependency_count) || 0);
  const dependencyReadCount = Math.max(0, Number(coverage.dependency_read_count) || 0);
  if (dependencyCount === 0) return root;
  const dependencyFraction = clamp01(dependencyReadCount / dependencyCount);
  return round((root + dependencyFraction) / 2);
}

function simulateReadCoverageGain(coverage = {}, role) {
  const before = coverageUtility(coverage);
  const next = {
    root_read: Boolean(coverage.root_read),
    dependency_count: Math.max(0, Number(coverage.dependency_count) || 0),
    dependency_read_count: Math.max(0, Number(coverage.dependency_read_count) || 0),
  };
  if (role === 'root') next.root_read = true;
  if (role === 'dependency' && next.dependency_count > 0) {
    next.dependency_read_count = Math.min(next.dependency_count, next.dependency_read_count + 1);
  }
  return round(Math.max(0, coverageUtility(next) - before));
}

function rankBinFor(rank, calibration) {
  if (!Number.isInteger(rank) || rank < 1) return null;
  return (calibration?.bins || []).find((bin) => rank >= Number(bin.minRank) && rank <= Number(bin.maxRank)) || null;
}

function topHypothesis(state) {
  return Array.isArray(state?.hypotheses) ? state.hypotheses[0] || null : null;
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function pathRank(state, hypothesis, filePath) {
  if (!filePath) return null;
  if (filePath === hypothesis?.root_path && Number.isInteger(hypothesis?.root_rank)) return hypothesis.root_rank;
  const member = (hypothesis?.members || []).find((entry) => entry?.path === filePath && Number.isInteger(entry?.rank));
  if (member) return member.rank;
  const resultIndex = (state?.results || []).findIndex((entry) => entry?.path === filePath);
  return resultIndex >= 0 ? resultIndex + 1 : null;
}

function readCandidates(state, controlPolicy, calibration, costModel) {
  const hypothesis = topHypothesis(state);
  if (!hypothesis) return [];
  const read = new Set(hypothesis.read_paths || []);
  const paths = unique([
    hypothesis.root_path,
    ...(hypothesis.member_paths || []).filter((filePath) => filePath !== hypothesis.root_path),
    ...(hypothesis.context_paths || []),
  ]);
  const cost = costModel?.successfulRead || {};
  const totalTokens = Number(cost.medianTotalTokens);
  const latencyMs = Number(cost.medianDurationMs);
  const actionRisk = Number(cost.actionRisk ?? 0);

  return paths.flatMap((filePath) => {
    if (read.has(filePath)) return [];
    const role = filePath === hypothesis.root_path ? 'root' : 'dependency';
    const coverageGain = simulateReadCoverageGain(controlPolicy?.coverage || {}, role);
    if (!(coverageGain > 0)) return [];
    const rank = pathRank(state, hypothesis, filePath);
    const bin = rankBinFor(rank, calibration);
    const support = Number(bin?.estimatedRelevanceRate);
    const samples = Number(bin?.samples);
    if (!Number.isFinite(support) || support < 0 || support > 1 || !Number.isFinite(samples) || samples <= 0) return [];
    const expectedProxyGain = round(support * coverageGain);
    return [{
      type: 'read',
      path: filePath,
      role,
      rank,
      evidence: {
        calibration_status: calibration?.status || 'unknown',
        bin: bin.name || null,
        samples,
        estimated_relevance_rate: round(support),
      },
      coverage_gain_if_useful: coverageGain,
      expected_proxy_gain: expectedProxyGain,
      costs: {
        total_tokens: Number.isFinite(totalTokens) ? totalTokens : null,
        latency_ms: Number.isFinite(latencyMs) ? latencyMs : null,
        action_risk: Number.isFinite(actionRisk) ? actionRisk : null,
      },
      break_even: {
        utility_per_token_if_latency_free: Number.isFinite(totalTokens) && totalTokens > 0 ? round(expectedProxyGain / totalTokens) : null,
        utility_per_ms_if_tokens_free: Number.isFinite(latencyMs) && latencyMs > 0 ? round(expectedProxyGain / latencyMs) : null,
      },
    }];
  }).sort((left, right) => right.expected_proxy_gain - left.expected_proxy_gain || left.rank - right.rank || left.path.localeCompare(right.path));
}

function validateUtilityRates(rates) {
  if (rates == null) return null;
  const normalized = {
    utilityPerToken: Number(rates.utilityPerToken ?? 0),
    utilityPerMs: Number(rates.utilityPerMs ?? 0),
    actionRiskUtility: Number(rates.actionRiskUtility ?? 0),
  };
  for (const [key, value] of Object.entries(normalized)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`utility exchange rate ${key} must be finite and non-negative`);
  }
  return normalized;
}

function hasUsableReadCostModel(costModel) {
  const successfulRead = costModel?.successfulRead;
  if (!successfulRead) return false;
  const totalTokens = Number(successfulRead.medianTotalTokens);
  const latencyMs = Number(successfulRead.medianDurationMs);
  return Number.isFinite(totalTokens)
    && totalTokens > 0
    && Number.isFinite(latencyMs)
    && latencyMs > 0;
}

function netVoi(candidate, rates) {
  if (!rates) return null;
  const tokenCost = (candidate.costs.total_tokens || 0) * rates.utilityPerToken;
  const latencyCost = (candidate.costs.latency_ms || 0) * rates.utilityPerMs;
  const riskCost = (candidate.costs.action_risk || 0) * rates.actionRiskUtility;
  return round(candidate.expected_proxy_gain - tokenCost - latencyCost - riskCost);
}

function summarizeAction(action) {
  if (!action) return null;
  return { type: action.type || null, path: action.path || null };
}

function evaluateExploreVoiChallenger(input = {}) {
  const state = input.state || {};
  const controlPolicy = input.controlPolicy || {};
  const calibration = input.calibration || {};
  const costModel = input.costModel || {};
  const rates = validateUtilityRates(input.utilityRates);
  const controlAction = summarizeAction(controlPolicy.next_action);
  const base = {
    voi_version: VOI_VERSION,
    method: METHOD,
    estimand: 'expected benchmark-relevance-weighted dependency-coverage gain from one additional read',
    control_action: controlAction,
    promotion_eligible: false,
    research_candidate: null,
    shadow_recommendation: null,
    recommended_replacement: null,
    agreement: null,
    net_voi: null,
    limitations: [
      'myopic one-step research proxy; not an exact POMDP solution',
      'retrieval support is observational benchmark evidence, not a Bayesian posterior or causal effect',
      'resource costs remain separate from utility unless explicit exchange rates are supplied',
    ],
  };

  if (controlAction?.type !== 'read') {
    return { ...base, status: 'not_applicable', reason: 'the current E4 control action is not a modeled read acquisition' };
  }

  if (!hasUsableReadCostModel(costModel)) {
    return {
      ...base,
      status: 'insufficient_cost_data',
      reason: 'the empirical read-cost artifact is missing a finite positive token or latency median',
    };
  }

  const candidates = readCandidates(state, controlPolicy, calibration, costModel);
  if (candidates.length === 0) {
    return { ...base, status: 'insufficient_data', reason: 'no unread candidate has empirical rank support and positive coverage gain' };
  }

  const scored = candidates.map((candidate) => ({ ...candidate, net_voi: netVoi(candidate, rates) }));
  const researchCandidate = rates
    ? [...scored].sort((left, right) => (right.net_voi ?? -Infinity) - (left.net_voi ?? -Infinity) || right.expected_proxy_gain - left.expected_proxy_gain || left.path.localeCompare(right.path))[0]
    : scored[0];
  const calibrated = calibration.status === 'calibrated'
    && Number(calibration.caseCount) >= Number(calibration.minimumCasesForCalibratedStatus || 0);
  const evaluable = calibrated && Boolean(rates);
  const net = evaluable ? researchCandidate.net_voi : null;
  const positive = Number.isFinite(net) && net > 0;

  return {
    ...base,
    status: calibration.status !== 'calibrated'
      ? 'provisional_evidence'
      : !calibrated
        ? 'insufficient_calibration_cases'
      : rates
        ? 'evaluable_shadow'
        : 'insufficient_utility_scale',
    reason: calibration.status !== 'calibrated'
      ? 'retrieval relevance evidence is provisional; challenger cannot replace the E4 control'
      : !calibrated
        ? 'the calibration artifact is labeled calibrated but does not meet its declared independent-case minimum'
      : rates
        ? 'calibrated retrieval evidence and explicit utility exchange rates are available for shadow comparison'
        : 'calibrated retrieval evidence exists but no token/latency/risk utility exchange rates were supplied',
    promotion_eligible: false,
    research_candidate: researchCandidate,
    shadow_recommendation: evaluable && positive ? summarizeAction(researchCandidate) : null,
    recommended_replacement: null,
    agreement: researchCandidate ? researchCandidate.type === controlAction?.type && researchCandidate.path === controlAction?.path : null,
    net_voi: net,
    candidate_count: scored.length,
  };
}

module.exports = {
  METHOD,
  VOI_VERSION,
  coverageUtility,
  evaluateExploreVoiChallenger,
  simulateReadCoverageGain,
};
