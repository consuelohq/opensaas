'use strict';

const GATE_VERSION = 1;
const METHOD = 'prespecified-paired-sign-test-gate';
const SHADOW_EVENT_TYPE = 'explore.voi.shadow';

function round(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function nonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveInteger(value) {
  const numeric = nonNegativeInteger(value);
  return numeric != null && numeric > 0 ? numeric : null;
}

function logChoose(n, k) {
  const reduced = Math.min(k, n - k);
  let total = 0;
  for (let index = 1; index <= reduced; index += 1) {
    total += Math.log(n - reduced + index) - Math.log(index);
  }
  return total;
}

function binomialProbability(n, k, probability = 0.5) {
  if (k < 0 || k > n) return 0;
  if (probability === 0) return k === 0 ? 1 : 0;
  if (probability === 1) return k === n ? 1 : 0;
  const logProbability = logChoose(n, k)
    + (k * Math.log(probability))
    + ((n - k) * Math.log1p(-probability));
  return Math.exp(logProbability);
}

function exactOneSidedSignTest(winsInput, lossesInput) {
  const wins = nonNegativeInteger(winsInput);
  const losses = nonNegativeInteger(lossesInput);
  if (wins == null || losses == null) {
    throw new Error('sign-test wins and losses must be non-negative integers');
  }
  const discordant = wins + losses;
  if (discordant === 0) {
    return { wins, losses, discordant, null_probability: 0.5, p_value: 1 };
  }
  let pValue = 0;
  for (let successes = wins; successes <= discordant; successes += 1) {
    pValue += binomialProbability(discordant, successes, 0.5);
  }
  return {
    wins,
    losses,
    discordant,
    null_probability: 0.5,
    p_value: round(Math.min(1, Math.max(0, pValue))),
  };
}

function normalizeCriteria(criteria) {
  if (!criteria || criteria.schemaVersion !== GATE_VERSION || criteria.target !== 'controlled_trial') {
    return { valid: false, reason: 'criteria must use schemaVersion=1 and target=controlled_trial' };
  }
  const alpha = finiteNumber(criteria.alpha);
  const normalized = {
    schemaVersion: GATE_VERSION,
    target: 'controlled_trial',
    alpha,
    minimumIndependentBenchmarkCases: positiveInteger(criteria.minimumIndependentBenchmarkCases),
    plannedEvaluatedBenchmarkCases: positiveInteger(criteria.plannedEvaluatedBenchmarkCases),
    minimumRelevanceDiscordantCases: positiveInteger(criteria.minimumRelevanceDiscordantCases),
    minimumShadowObservations: positiveInteger(criteria.minimumShadowObservations),
    minimumDistinctShadowQuestions: positiveInteger(criteria.minimumDistinctShadowQuestions),
    maximumShadowErrors: nonNegativeInteger(criteria.maximumShadowErrors),
    maximumRequiredNodeRegressions: nonNegativeInteger(criteria.maximumRequiredNodeRegressions),
  };
  if (alpha == null || !(alpha > 0 && alpha < 1)) {
    return { valid: false, reason: 'criteria alpha must be finite and strictly between zero and one' };
  }
  for (const [key, value] of Object.entries(normalized)) {
    if (key === 'schemaVersion' || key === 'target' || key === 'alpha') continue;
    if (value == null) return { valid: false, reason: `criteria ${key} must be a valid integer threshold` };
  }
  return { valid: true, value: normalized };
}

function summarizeChallengerConfiguration(configuration = {}, costModel = {}) {
  const rates = configuration?.utilityRates;
  const normalizedRates = rates && typeof rates === 'object' ? {
    utilityPerToken: finiteNumber(rates.utilityPerToken),
    utilityPerMs: finiteNumber(rates.utilityPerMs),
    actionRiskUtility: finiteNumber(rates.actionRiskUtility),
  } : null;
  const ratesValid = normalizedRates != null
    && Object.values(normalizedRates).every((value) => value != null && value >= 0);
  const ratesNonDegenerate = ratesValid
    && Object.values(normalizedRates).some((value) => value > 0);
  const read = costModel?.successfulRead || {};
  const costModelReady = costModel?.schemaVersion === configuration?.readCostModelSchemaVersion
    && costModel?.status === 'observational'
    && positiveInteger(read.sampleCount) != null
    && finiteNumber(read.medianTotalTokens) != null
    && read.medianTotalTokens > 0
    && finiteNumber(read.medianDurationMs) != null
    && read.medianDurationMs > 0
    && finiteNumber(read.actionRisk) != null
    && read.actionRisk >= 0;
  const structurallyValid = configuration?.schemaVersion === GATE_VERSION
    && configuration?.criteriaVersion === GATE_VERSION
    && typeof configuration?.frozen === 'boolean'
    && configuration?.voiVersion === 1
    && configuration?.method === 'myopic-empirical-voi-proxy'
    && configuration?.promotionAuthority === 'e6_gate_only'
    && positiveInteger(configuration?.readCostModelSchemaVersion) != null;

  return {
    valid: structurallyValid,
    schema_version: configuration?.schemaVersion ?? null,
    criteria_version: configuration?.criteriaVersion ?? null,
    status: configuration?.status || null,
    frozen: typeof configuration?.frozen === 'boolean' ? configuration.frozen : null,
    configuration_id: typeof configuration?.configurationId === 'string' && configuration.configurationId.trim()
      ? configuration.configurationId.trim()
      : null,
    voi_version: configuration?.voiVersion ?? null,
    method: configuration?.method || null,
    promotion_authority: configuration?.promotionAuthority || null,
    utility_profile_id: typeof configuration?.utilityProfileId === 'string' && configuration.utilityProfileId.trim()
      ? configuration.utilityProfileId.trim()
      : null,
    utility_rates: ratesValid ? normalizedRates : null,
    utility_scale_present: rates != null,
    utility_scale_valid: ratesValid,
    utility_scale_non_degenerate: ratesNonDegenerate,
    read_cost_model_schema_version: configuration?.readCostModelSchemaVersion ?? null,
    read_cost_model_ready: costModelReady,
    claim: configuration?.claim || null,
  };
}

function summarizeLocalChallenger(challenger = {}) {
  return {
    status: challenger?.status || null,
    net_voi: finiteNumber(challenger?.net_voi),
    has_shadow_recommendation: Boolean(challenger?.shadow_recommendation),
    promotion_eligible: challenger?.promotion_eligible === true,
  };
}

function summarizeVoiShadowHistory(events = []) {
  const rows = [];
  const seen = new Set();
  for (let index = 0; index < (events || []).length; index += 1) {
    const event = events[index];
    if (event?.type !== SHADOW_EVENT_TYPE) continue;
    const key = event.id || `anonymous:${index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(event);
  }

  const questions = new Set();
  const worktrees = new Set();
  let errorCount = 0;
  let authorityViolationCount = 0;
  let agreementCount = 0;
  let disagreementCount = 0;
  let unknownAgreementCount = 0;

  for (const event of rows) {
    if (typeof event.question === 'string' && event.question.trim()) questions.add(event.question.trim());
    if (typeof event.worktree_id === 'string' && event.worktree_id.trim()) worktrees.add(event.worktree_id.trim());
    if (event.status === 'error') errorCount += 1;
    if (event.details?.promotion_eligible === true) authorityViolationCount += 1;
    if (event.details?.agreement === true) agreementCount += 1;
    else if (event.details?.agreement === false) disagreementCount += 1;
    else unknownAgreementCount += 1;
  }

  return {
    observation_count: rows.length,
    distinct_question_count: questions.size,
    distinct_worktree_count: worktrees.size,
    error_count: errorCount,
    authority_violation_count: authorityViolationCount,
    agreement_count: agreementCount,
    disagreement_count: disagreementCount,
    unknown_agreement_count: unknownAgreementCount,
    agreement_rate: rows.length > 0 ? round(agreementCount / rows.length) : null,
    disagreement_rate: rows.length > 0 ? round(disagreementCount / rows.length) : null,
    claim: 'Operational shadow evidence only; agreement and disagreement are descriptive and are not accuracy, causal-effect, or counterfactual-success labels.',
  };
}

function summarizeShadowEvidence(evidence = {}) {
  const events = Array.isArray(evidence.events) ? evidence.events : [];
  const challengerConfigurationId = typeof evidence?.challengerConfigurationId === 'string' && evidence.challengerConfigurationId.trim()
    ? evidence.challengerConfigurationId.trim()
    : null;
  const ids = new Set();
  let duplicate = false;
  let invalid = false;
  for (const event of events) {
    if (!event || typeof event.id !== 'string' || !event.id.trim() || ids.has(event.id)) {
      duplicate = duplicate || Boolean(event?.id && ids.has(event.id));
      invalid = true;
      continue;
    }
    ids.add(event.id);
    if (event.type !== SHADOW_EVENT_TYPE
        || typeof event.question !== 'string'
        || !event.question.trim()
        || event.details?.voi_version !== 1
        || event.details?.method !== 'myopic-empirical-voi-proxy'
        || typeof event.details?.promotion_eligible !== 'boolean'
        || (challengerConfigurationId != null
          && event.details?.challenger_configuration_id !== challengerConfigurationId)) {
      invalid = true;
    }
  }
  const summary = summarizeVoiShadowHistory(events);
  return {
    valid: evidence?.schemaVersion === GATE_VERSION
      && evidence?.criteriaVersion === GATE_VERSION
      && typeof evidence?.frozen === 'boolean'
      && Array.isArray(evidence?.events)
      && (events.length === 0 || challengerConfigurationId != null)
      && !invalid
      && !duplicate
      && summary.observation_count === events.length,
    schema_version: evidence?.schemaVersion ?? null,
    criteria_version: evidence?.criteriaVersion ?? null,
    status: evidence?.status || null,
    challenger_configuration_id: challengerConfigurationId,
    frozen: typeof evidence?.frozen === 'boolean' ? evidence.frozen : null,
    ...summary,
    claim: evidence?.claim || 'Frozen operational shadow evidence only; not an accuracy, causal-effect, or counterfactual-success estimate.',
  };
}

function validBenchmarkRow(row) {
  if (!row || typeof row.id !== 'string' || !row.id.trim()) return false;
  const controlRelevance = row.controlRelevance;
  const challengerRelevance = row.challengerRelevance;
  return typeof row.challengerConfigurationId === 'string'
    && Boolean(row.challengerConfigurationId.trim())
    && Number.isInteger(controlRelevance)
    && controlRelevance >= 0
    && controlRelevance <= 3
    && Number.isInteger(challengerRelevance)
    && challengerRelevance >= 0
    && challengerRelevance <= 3
    && row.challengerStatus === 'evaluable_shadow'
    && typeof row.challengerUsedFallback === 'boolean'
    && typeof row.controlRequiredHit === 'boolean'
    && typeof row.challengerRequiredHit === 'boolean';
}

function summarizeBenchmarkEvidence(evidence = {}) {
  const rows = Array.isArray(evidence.caseResults) ? evidence.caseResults : [];
  const challengerConfigurationId = typeof evidence?.challengerConfigurationId === 'string' && evidence.challengerConfigurationId.trim()
    ? evidence.challengerConfigurationId.trim()
    : null;
  const ids = new Set();
  let invalid = false;
  let duplicate = false;
  let relevanceWins = 0;
  let relevanceLosses = 0;
  let relevanceTies = 0;
  let requiredImprovements = 0;
  let requiredRegressions = 0;
  let requiredTies = 0;

  for (const row of rows) {
    if (!validBenchmarkRow(row)) {
      invalid = true;
      continue;
    }
    if (ids.has(row.id)) duplicate = true;
    ids.add(row.id);
    if (challengerConfigurationId == null || row.challengerConfigurationId !== challengerConfigurationId) {
      invalid = true;
    }
    const relevanceDelta = row.challengerRelevance - row.controlRelevance;
    if (relevanceDelta > 0) relevanceWins += 1;
    else if (relevanceDelta < 0) relevanceLosses += 1;
    else relevanceTies += 1;

    if (!row.controlRequiredHit && row.challengerRequiredHit) requiredImprovements += 1;
    else if (row.controlRequiredHit && !row.challengerRequiredHit) requiredRegressions += 1;
    else requiredTies += 1;
  }

  const declaredEvaluated = nonNegativeInteger(evidence.evaluatedCaseCount);
  const independentCaseCount = nonNegativeInteger(evidence.independentCaseCount);
  const plannedEvaluatedCaseCount = positiveInteger(evidence.plannedEvaluatedCaseCount);
  const analysisMode = evidence.analysisMode || null;
  const frozen = typeof evidence.frozen === 'boolean' ? evidence.frozen : null;
  const signTest = exactOneSidedSignTest(relevanceWins, relevanceLosses);
  return {
    valid: evidence?.schemaVersion === GATE_VERSION
      && evidence?.criteriaVersion === GATE_VERSION
      && declaredEvaluated != null
      && independentCaseCount != null
      && plannedEvaluatedCaseCount != null
      && analysisMode === 'fixed_sample'
      && frozen != null
      && declaredEvaluated === rows.length
      && independentCaseCount >= rows.length
      && !invalid
      && !duplicate,
    schema_version: evidence?.schemaVersion ?? null,
    criteria_version: evidence?.criteriaVersion ?? null,
    status: evidence?.status || null,
    challenger_configuration_id: challengerConfigurationId,
    analysis_mode: analysisMode,
    planned_evaluated_case_count: plannedEvaluatedCaseCount,
    frozen,
    independent_case_count: independentCaseCount,
    evaluated_case_count: rows.length,
    declared_evaluated_case_count: declaredEvaluated,
    relevance: {
      wins: relevanceWins,
      losses: relevanceLosses,
      ties: relevanceTies,
      discordant: signTest.discordant,
      p_value: signTest.p_value,
      test: 'exact-one-sided-paired-sign-test',
      null_probability: 0.5,
    },
    required_node: {
      improvements: requiredImprovements,
      regressions: requiredRegressions,
      ties: requiredTies,
      safety_rule: 'non-compensatory-regression-limit',
    },
    claim: evidence?.claim || 'Paired curated-label evidence only; not an online causal-effect estimate.',
  };
}

function currentCalibrationReady(calibration, criteria) {
  const caseCount = nonNegativeInteger(calibration?.caseCount);
  const declaredMinimum = positiveInteger(calibration?.minimumCasesForCalibratedStatus);
  return calibration?.status === 'calibrated'
    && caseCount != null
    && declaredMinimum != null
    && caseCount >= declaredMinimum
    && caseCount >= criteria.minimumIndependentBenchmarkCases;
}

function evaluateExplorePromotionGate(input = {}) {
  const criteriaResult = normalizeCriteria(input.criteria);
  const base = {
    gate_version: GATE_VERSION,
    method: METHOD,
    target: 'controlled_trial',
    promotion_eligible: false,
    production_cutover: false,
    control_remains_authoritative: true,
    blockers: [],
    limitations: [
      'paired curated-label evidence evaluates retrieval relevance direction, not downstream engineering-task success',
      'the exact sign test discards relevance magnitude and ties because the 0-3 labels are ordinal',
      'live shadow observations establish operational stability and diversity only; they do not label counterfactual challenger outcomes',
      'eligibility authorizes only a controlled trial/manual promotion review; production cutover is outside this gate',
    ],
  };

  if (!criteriaResult.valid) {
    return {
      ...base,
      status: 'blocked',
      blockers: ['invalid_criteria'],
      reason: criteriaResult.reason,
      criteria: null,
      benchmark: summarizeBenchmarkEvidence(input.benchmarkEvidence || {}),
      shadow: summarizeShadowEvidence(input.shadowEvidence || {}),
      local_shadow: summarizeVoiShadowHistory(input.localShadowEvents || []),
    };
  }

  const criteria = criteriaResult.value;
  const blockers = [];
  const challengerConfiguration = summarizeChallengerConfiguration(
    input.challengerConfiguration || {},
    input.costModel || {},
  );
  const localChallenger = summarizeLocalChallenger(input.localChallenger || {});
  const calibration = input.calibration || {};
  const benchmark = summarizeBenchmarkEvidence(input.benchmarkEvidence || {});
  const shadow = summarizeShadowEvidence(input.shadowEvidence || {});
  const localShadow = summarizeVoiShadowHistory(input.localShadowEvents || []);

  if (!challengerConfiguration.valid) blockers.push('invalid_challenger_evidence');
  if (challengerConfiguration.status !== 'frozen_challenger_configuration') {
    blockers.push('challenger_evidence_not_ready');
  }
  if (challengerConfiguration.frozen !== true) blockers.push('challenger_evidence_not_frozen');
  if (!challengerConfiguration.configuration_id || !challengerConfiguration.utility_profile_id
      || !challengerConfiguration.utility_scale_present) {
    blockers.push('challenger_utility_scale_missing');
  } else if (!challengerConfiguration.utility_scale_valid) {
    blockers.push('invalid_challenger_utility_scale');
  } else if (!challengerConfiguration.utility_scale_non_degenerate) {
    blockers.push('challenger_utility_scale_degenerate');
  }
  if (!challengerConfiguration.read_cost_model_ready) blockers.push('read_cost_model_not_ready');
  if (challengerConfiguration.promotion_authority !== 'e6_gate_only') {
    blockers.push('challenger_authority_configuration_invalid');
  }
  if (!currentCalibrationReady(calibration, criteria)) blockers.push('calibration_not_ready');

  const configurationId = challengerConfiguration.configuration_id;
  if (configurationId && (benchmark.challenger_configuration_id !== configurationId
      || shadow.challenger_configuration_id !== configurationId)) {
    blockers.push('evidence_configuration_mismatch');
  }

  if (!benchmark.valid) blockers.push('invalid_benchmark_evidence');
  if (benchmark.status !== 'paired_curated_labels') blockers.push('benchmark_evidence_not_ready');
  if (benchmark.analysis_mode !== 'fixed_sample'
      || benchmark.planned_evaluated_case_count !== criteria.plannedEvaluatedBenchmarkCases) {
    blockers.push('benchmark_analysis_plan_mismatch');
  }
  if (benchmark.frozen !== true) blockers.push('benchmark_evidence_not_frozen');
  if ((benchmark.independent_case_count ?? 0) < criteria.minimumIndependentBenchmarkCases) {
    blockers.push('benchmark_case_minimum_not_met');
  }
  if (benchmark.evaluated_case_count !== criteria.plannedEvaluatedBenchmarkCases) {
    blockers.push('benchmark_evaluated_plan_not_met');
  }
  if (benchmark.relevance.discordant < criteria.minimumRelevanceDiscordantCases) {
    blockers.push('benchmark_disagreement_minimum_not_met');
  } else if (!(benchmark.relevance.wins > benchmark.relevance.losses
      && benchmark.relevance.p_value <= criteria.alpha)) {
    blockers.push('benchmark_relevance_not_significant');
  }
  if (benchmark.required_node.regressions > criteria.maximumRequiredNodeRegressions) {
    blockers.push('required_node_regression');
  }

  if (!shadow.valid) blockers.push('invalid_shadow_evidence');
  if (shadow.status !== 'frozen_shadow_history') blockers.push('shadow_evidence_not_ready');
  if (shadow.frozen !== true) blockers.push('shadow_evidence_not_frozen');
  if (shadow.observation_count < criteria.minimumShadowObservations) {
    blockers.push('shadow_observation_minimum_not_met');
  }
  if (shadow.distinct_question_count < criteria.minimumDistinctShadowQuestions) {
    blockers.push('shadow_question_minimum_not_met');
  }
  if (shadow.error_count > criteria.maximumShadowErrors) blockers.push('shadow_error_limit_exceeded');
  if (shadow.authority_violation_count > 0) blockers.push('shadow_authority_violation');

  const uniqueBlockers = Array.from(new Set(blockers));
  const eligible = uniqueBlockers.length === 0;
  return {
    ...base,
    status: eligible ? 'eligible_for_controlled_trial' : 'blocked',
    promotion_eligible: eligible,
    blockers: uniqueBlockers,
    reason: eligible
      ? 'all pre-specified E6 evidence, safety, and operational gates are satisfied for a controlled trial'
      : 'one or more pre-specified E6 evidence, safety, or operational gates are not satisfied',
    criteria,
    benchmark,
    shadow,
    local_shadow: localShadow,
    challenger_configuration: challengerConfiguration,
    local_challenger: localChallenger,
    calibration: {
      status: calibration.status || null,
      case_count: nonNegativeInteger(calibration.caseCount),
      declared_minimum: positiveInteger(calibration.minimumCasesForCalibratedStatus),
    },
    recommended_action: eligible ? { type: 'controlled_trial', challenger: 'e5_voi' } : null,
  };
}

module.exports = {
  GATE_VERSION,
  METHOD,
  evaluateExplorePromotionGate,
  exactOneSidedSignTest,
  summarizeBenchmarkEvidence,
  summarizeShadowEvidence,
  summarizeVoiShadowHistory,
};
