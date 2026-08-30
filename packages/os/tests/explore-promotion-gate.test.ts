import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

type BenchmarkRow = {
  id: string;
  challengerConfigurationId: string;
  challengerStatus: 'evaluable_shadow';
  challengerUsedFallback: boolean;
  agreement: boolean;
  controlRelevance: number;
  challengerRelevance: number;
  relevanceDelta: number;
  controlRequiredHit: boolean;
  challengerRequiredHit: boolean;
  requiredHitDelta: number;
};

const criteria = {
  schemaVersion: 1,
  target: 'controlled_trial',
  alpha: 0.05,
  minimumIndependentBenchmarkCases: 50,
  plannedEvaluatedBenchmarkCases: 50,
  minimumRelevanceDiscordantCases: 10,
  minimumShadowObservations: 50,
  minimumDistinctShadowQuestions: 20,
  maximumShadowErrors: 0,
  maximumRequiredNodeRegressions: 0,
};

const calibrated = {
  status: 'calibrated',
  caseCount: 60,
  minimumCasesForCalibratedStatus: 50,
};

const evaluableChallenger = {
  voi_version: 1,
  method: 'myopic-empirical-voi-proxy',
  status: 'evaluable_shadow',
  promotion_eligible: false,
  net_voi: 0.2,
  shadow_recommendation: { type: 'read', path: 'src/challenger.ts' },
  recommended_replacement: null,
};

const readCostModel = {
  schemaVersion: 1,
  status: 'observational',
  successfulRead: {
    sampleCount: 970,
    medianTotalTokens: 2031,
    medianDurationMs: 537,
    actionRisk: 0,
  },
};

function frozenChallengerConfiguration() {
  return {
    schemaVersion: 1,
    criteriaVersion: 1,
    status: 'frozen_challenger_configuration',
    frozen: true,
    configurationId: 'test-e5-config-v1',
    voiVersion: 1,
    method: 'myopic-empirical-voi-proxy',
    promotionAuthority: 'e6_gate_only',
    readCostModelSchemaVersion: 1,
    utilityProfileId: 'test-utility-v1',
    utilityRates: {
      utilityPerToken: 0.00001,
      utilityPerMs: 0.00001,
      actionRiskUtility: 0,
    },
    claim: 'explicit frozen utility configuration for a controlled E5 study',
  };
}

function pairedRows(): BenchmarkRow[] {
  return Array.from({ length: 50 }, (_, index) => {
    if (index < 15) {
      return {
        id: `case-${index}`,
        challengerConfigurationId: 'test-e5-config-v1',
        challengerStatus: 'evaluable_shadow',
        challengerUsedFallback: false,
        agreement: false,
        controlRelevance: 2,
        challengerRelevance: 3,
        relevanceDelta: 1,
        controlRequiredHit: false,
        challengerRequiredHit: true,
        requiredHitDelta: 1,
      };
    }
    if (index < 20) {
      return {
        id: `case-${index}`,
        challengerConfigurationId: 'test-e5-config-v1',
        challengerStatus: 'evaluable_shadow',
        challengerUsedFallback: false,
        agreement: false,
        controlRelevance: 2,
        challengerRelevance: 1,
        relevanceDelta: -1,
        controlRequiredHit: false,
        challengerRequiredHit: false,
        requiredHitDelta: 0,
      };
    }
    return {
      id: `case-${index}`,
      challengerConfigurationId: 'test-e5-config-v1',
      challengerStatus: 'evaluable_shadow',
      challengerUsedFallback: true,
      agreement: true,
      controlRelevance: 2,
      challengerRelevance: 2,
      relevanceDelta: 0,
      controlRequiredHit: true,
      challengerRequiredHit: true,
      requiredHitDelta: 0,
    };
  });
}

function benchmarkEvidence(rows = pairedRows()) {
  return {
    schemaVersion: 1,
    criteriaVersion: 1,
    status: 'paired_curated_labels',
    challengerConfigurationId: 'test-e5-config-v1',
    analysisMode: 'fixed_sample',
    plannedEvaluatedCaseCount: 50,
    frozen: true,
    independentCaseCount: 50,
    evaluatedCaseCount: rows.length,
    caseResults: rows,
    claim: 'paired curated-label evidence only',
  };
}

function shadowEvents(count = 60) {
  return Array.from({ length: count }, (_, index) => ({
    id: `shadow-${index}`,
    occurred_at: `2026-08-15T22:${String(index % 60).padStart(2, '0')}:00.000Z`,
    type: 'explore.voi.shadow',
    source: 'explore',
    question: `question-${index % 25}`,
    worktree_id: `worktree-${index % 3}`,
    status: 'evaluable_shadow',
    details: {
      voi_version: 1,
      method: 'myopic-empirical-voi-proxy',
      promotion_eligible: false,
      challenger_configuration_id: 'test-e5-config-v1',
      agreement: index % 2 === 0,
    },
  }));
}

function frozenShadowEvidence(events = shadowEvents()) {
  return {
    schemaVersion: 1,
    criteriaVersion: 1,
    status: 'frozen_shadow_history',
    frozen: true,
    challengerConfigurationId: 'test-e5-config-v1',
    events,
    claim: 'frozen operational shadow history only',
  };
}

describe('Explore E6 promotion gate', () => {
  it('loads the E6 promotion gate module', () => {
    expect(() => require('../scripts/lib/state/explore-promotion-gate.js')).not.toThrow();
  });

  it('computes the exact one-sided paired sign-test tail without treating ties as trials', () => {
    const { exactOneSidedSignTest } = require('../scripts/lib/state/explore-promotion-gate.js');

    expect(exactOneSidedSignTest(8, 2)).toMatchObject({ wins: 8, losses: 2, discordant: 10 });
    expect(exactOneSidedSignTest(8, 2).p_value).toBeCloseTo(0.0546875, 12);
    expect(exactOneSidedSignTest(9, 1).p_value).toBeCloseTo(0.0107421875, 12);
    expect(exactOneSidedSignTest(0, 0).p_value).toBe(1);
  });

  it('summarizes live shadow history as operational evidence only and deduplicates event ids', () => {
    const { summarizeVoiShadowHistory } = require('../scripts/lib/state/explore-promotion-gate.js');
    const events = shadowEvents(60);
    events.push({ ...events[0] });
    const summary = summarizeVoiShadowHistory(events);

    expect(summary).toMatchObject({
      observation_count: 60,
      distinct_question_count: 25,
      distinct_worktree_count: 3,
      error_count: 0,
      authority_violation_count: 0,
      agreement_count: 30,
      disagreement_count: 30,
    });
    expect(summary.claim).toMatch(/operational/i);
    expect(summary.claim).toMatch(/not.*accuracy|not.*causal/i);
  });

  it('allows only controlled-trial eligibility when every pre-specified gate passes', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(),
      shadowEvidence: frozenShadowEvidence(),
      localShadowEvents: shadowEvents(),
      criteria,
    });

    expect(result).toMatchObject({
      gate_version: 1,
      method: 'prespecified-paired-sign-test-gate',
      status: 'eligible_for_controlled_trial',
      target: 'controlled_trial',
      promotion_eligible: true,
      production_cutover: false,
      blockers: [],
    });
    expect(result.benchmark.relevance).toMatchObject({
      wins: 15,
      losses: 5,
      ties: 30,
      discordant: 20,
    });
    expect(result.benchmark.relevance.p_value).toBeLessThanOrEqual(0.05);
    expect(result.benchmark.required_node.regressions).toBe(0);
  });

  it('blocks the current E5 evidence state rather than manufacturing promotion readiness', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: {
        ...frozenChallengerConfiguration(),
        status: 'insufficient_evidence',
        frozen: false,
        configurationId: null,
        utilityProfileId: null,
        utilityRates: null,
      },
      localChallenger: {
        ...evaluableChallenger,
        status: 'provisional_evidence',
        net_voi: null,
        shadow_recommendation: null,
      },
      costModel: readCostModel,
      calibration: {
        status: 'provisional',
        caseCount: 10,
        minimumCasesForCalibratedStatus: 50,
      },
      benchmarkEvidence: {
        schemaVersion: 1,
        criteriaVersion: 1,
        status: 'insufficient_evidence',
        analysisMode: 'fixed_sample',
        plannedEvaluatedCaseCount: 50,
        frozen: false,
        independentCaseCount: 10,
        evaluatedCaseCount: 0,
        caseResults: [],
      },
      shadowEvidence: { schemaVersion: 1, criteriaVersion: 1, status: 'insufficient_evidence', frozen: false, events: [] },
      localShadowEvents: [],
      criteria,
    });

    expect(result.status).toBe('blocked');
    expect(result.promotion_eligible).toBe(false);
    expect(result.production_cutover).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'challenger_evidence_not_ready',
      'challenger_evidence_not_frozen',
      'challenger_utility_scale_missing',
      'calibration_not_ready',
      'benchmark_case_minimum_not_met',
      'benchmark_evaluated_plan_not_met',
      'benchmark_evidence_not_frozen',
      'benchmark_disagreement_minimum_not_met',
      'shadow_evidence_not_ready',
      'shadow_evidence_not_frozen',
      'shadow_observation_minimum_not_met',
      'shadow_question_minimum_not_met',
    ]));
  });

  it('blocks from the committed E6 criteria, evidence, and calibration artifacts today', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const committedCriteria = require('../scripts/lib/state/explore-promotion-criteria.v1.json');
    const committedEvidence = require('../scripts/lib/state/explore-promotion-evidence.v1.json');
    const committedCalibration = require('../scripts/lib/state/explore-calibration.v1.json');
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: committedEvidence.challengerConfiguration,
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: committedCalibration,
      benchmarkEvidence: committedEvidence,
      shadowEvidence: committedEvidence.shadowEvidence,
      localShadowEvents: [],
      criteria: committedCriteria,
    });

    expect(result.status).toBe('blocked');
    expect(result.promotion_eligible).toBe(false);
    expect(result.production_cutover).toBe(false);
    expect(result.benchmark).toMatchObject({
      analysis_mode: 'fixed_sample',
      planned_evaluated_case_count: 50,
      frozen: false,
      independent_case_count: 10,
      evaluated_case_count: 0,
    });
    expect(result.blockers).toEqual(expect.arrayContaining([
      'challenger_evidence_not_ready',
      'challenger_evidence_not_frozen',
      'challenger_utility_scale_missing',
      'calibration_not_ready',
      'benchmark_evidence_not_ready',
      'benchmark_evidence_not_frozen',
      'benchmark_case_minimum_not_met',
      'benchmark_evaluated_plan_not_met',
      'benchmark_disagreement_minimum_not_met',
      'shadow_observation_minimum_not_met',
      'shadow_question_minimum_not_met',
    ]));
  });

  it('does not let the current query-local challenger packet determine global promotion eligibility', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: {
        ...evaluableChallenger,
        status: 'not_applicable',
        net_voi: null,
        shadow_recommendation: null,
      },
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(),
      shadowEvidence: frozenShadowEvidence(),
      localShadowEvents: [],
      criteria,
    });

    expect(result.status).toBe('eligible_for_controlled_trial');
    expect(result.promotion_eligible).toBe(true);
    expect(result.local_challenger).toMatchObject({ status: 'not_applicable', net_voi: null });
  });

  it('rejects mixed-policy rows and shadow observations inside an otherwise matching evidence artifact', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const rows = pairedRows();
    rows[0] = { ...rows[0], challengerConfigurationId: 'other-config' };
    const events = shadowEvents();
    events[0] = {
      ...events[0],
      details: { ...events[0].details, challenger_configuration_id: 'other-config' },
    };
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(rows),
      shadowEvidence: frozenShadowEvidence(events),
      localShadowEvents: [],
      criteria,
    });
    expect(result.promotion_eligible).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'invalid_benchmark_evidence',
      'invalid_shadow_evidence',
    ]));
  });

  it('blocks evidence collected under a different challenger configuration', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: { ...benchmarkEvidence(), challengerConfigurationId: 'other-config' },
      shadowEvidence: frozenShadowEvidence(),
      localShadowEvents: shadowEvents(),
      criteria,
    });
    expect(result.promotion_eligible).toBe(false);
    expect(result.blockers).toContain('evidence_configuration_mismatch');
  });

  it('does not let transient worktree shadow events satisfy an unfrozen promotion snapshot', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(),
      shadowEvidence: {
        schemaVersion: 1,
        criteriaVersion: 1,
        status: 'insufficient_evidence',
        frozen: false,
        events: [],
      },
      localShadowEvents: shadowEvents(60),
      criteria,
    });

    expect(result.promotion_eligible).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'shadow_evidence_not_ready',
      'shadow_evidence_not_frozen',
      'shadow_observation_minimum_not_met',
      'shadow_question_minimum_not_met',
    ]));
    expect(result.shadow.observation_count).toBe(0);
    expect(result.local_shadow.observation_count).toBe(60);
  });

  it('fails closed on coercible criteria values and non-ready benchmark evidence status', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const malformedCriteria = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(),
      shadowEvidence: frozenShadowEvidence(),
      localShadowEvents: shadowEvents(),
      criteria: { ...criteria, minimumShadowObservations: '50' },
    });
    expect(malformedCriteria.promotion_eligible).toBe(false);
    expect(malformedCriteria.blockers).toEqual(['invalid_criteria']);

    const notReadyEvidence = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: { ...benchmarkEvidence(), status: 'insufficient_evidence' },
      shadowEvidence: frozenShadowEvidence(),
      localShadowEvents: shadowEvents(),
      criteria,
    });
    expect(notReadyEvidence.promotion_eligible).toBe(false);
    expect(notReadyEvidence.blockers).toContain('benchmark_evidence_not_ready');
  });

  it('treats any required-node regression as a non-compensatory safety blocker', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const rows = pairedRows();
    rows[0] = {
      ...rows[0],
      controlRequiredHit: true,
      challengerRequiredHit: false,
      requiredHitDelta: -1,
    };
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(rows),
      shadowEvidence: frozenShadowEvidence(),
      localShadowEvents: shadowEvents(),
      criteria,
    });

    expect(result.promotion_eligible).toBe(false);
    expect(result.blockers).toContain('required_node_regression');
    expect(result.benchmark.required_node.regressions).toBe(1);
  });

  it('blocks weak paired evidence, shadow evaluator errors, and E5 authority violations', () => {
    const { evaluateExplorePromotionGate } = require('../scripts/lib/state/explore-promotion-gate.js');
    const rows = pairedRows().map((row, index) => ({
      ...row,
      controlRelevance: index < 8 ? 2 : row.controlRelevance,
      challengerRelevance: index < 8 ? 3 : index < 10 ? 1 : row.controlRelevance,
      relevanceDelta: index < 8 ? 1 : index < 10 ? -1 : 0,
    }));
    const events = shadowEvents();
    events[0] = { ...events[0], status: 'error' };
    events[1] = {
      ...events[1],
      details: { ...events[1].details, promotion_eligible: true },
    };
    const result = evaluateExplorePromotionGate({
      challengerConfiguration: frozenChallengerConfiguration(),
      localChallenger: evaluableChallenger,
      costModel: readCostModel,
      calibration: calibrated,
      benchmarkEvidence: benchmarkEvidence(rows),
      shadowEvidence: frozenShadowEvidence(events),
      localShadowEvents: events,
      criteria,
    });

    expect(result.promotion_eligible).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'benchmark_relevance_not_significant',
      'shadow_error_limit_exceeded',
      'shadow_authority_violation',
    ]));
  });
});
