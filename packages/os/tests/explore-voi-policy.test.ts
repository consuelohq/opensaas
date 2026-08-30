import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

const calibration = {
  schemaVersion: 1,
  status: 'provisional',
  minimumCasesForCalibratedStatus: 50,
  caseCount: 10,
  bins: [
    { name: 'r1', minRank: 1, maxRank: 1, samples: 10, estimatedRelevanceRate: 0.8 },
    { name: 'r2_3', minRank: 2, maxRank: 3, samples: 20, estimatedRelevanceRate: 0.4 },
  ],
};

const costModel = {
  schemaVersion: 1,
  status: 'observational',
  action: 'read',
  successfulRead: {
    sampleCount: 970,
    medianDurationMs: 500,
    medianTotalTokens: 2000,
  },
};

function state() {
  return {
    query: 'fix owner wiring',
    results: [
      { path: 'src/owner.ts', file_size: 1000 },
      { path: 'src/helper.ts', file_size: 1000 },
      { path: 'src/owner.test.ts', file_size: 1000 },
    ],
    hypotheses: [{
      id: 'h1',
      root_path: 'src/owner.ts',
      root_rank: 1,
      member_paths: ['src/owner.ts', 'src/helper.ts'],
      members: [
        { path: 'src/owner.ts', rank: 1, role: 'implementation' },
        { path: 'src/helper.ts', rank: 2, role: 'related' },
      ],
      context_paths: ['src/owner.test.ts'],
      read_paths: [],
      support_state: 'unlabeled',
      retrieval_support: 0.8,
      calibration_status: 'provisional',
    }],
  };
}

const controlPolicy = {
  policy_version: 1,
  readiness: 'gathering',
  edit_ready: false,
  edit_target: null,
  coverage: { root_read: false, dependency_read_count: 0, dependency_count: 2 },
  next_action: { type: 'read', path: 'src/owner.ts', reason: 'read root' },
};

describe('Explore E5 shadow VOI challenger', () => {
  it('loads the E5 shadow challenger module', () => {
    expect(() => require('../scripts/lib/state/explore-voi-policy.js')).not.toThrow();
  });

  it('keeps provisional empirical support shadow-only and never invents net utility', () => {
    const { evaluateExploreVoiChallenger } = require('../scripts/lib/state/explore-voi-policy.js');
    const beforeState = structuredClone(state());
    const beforePolicy = structuredClone(controlPolicy);
    const result = evaluateExploreVoiChallenger({ state: beforeState, controlPolicy: beforePolicy, calibration, costModel });

    expect(result).toMatchObject({
      voi_version: 1,
      method: 'myopic-empirical-voi-proxy',
      status: 'provisional_evidence',
      promotion_eligible: false,
      control_action: { type: 'read', path: 'src/owner.ts' },
      research_candidate: { type: 'read', path: 'src/owner.ts' },
      net_voi: null,
    });
    expect(result.research_candidate.expected_proxy_gain).toBeCloseTo(0.4, 12);
    expect(result.research_candidate.costs).toEqual({ total_tokens: 2000, latency_ms: 500, action_risk: 0 });
    expect(result.research_candidate.break_even).toEqual({
      utility_per_token_if_latency_free: 0.0002,
      utility_per_ms_if_tokens_free: 0.0008,
    });
    expect(beforeState).toEqual(state());
    expect(beforePolicy).toEqual(controlPolicy);
  });

  it('computes net VOI only from explicit non-negative utility exchange rates', () => {
    const { evaluateExploreVoiChallenger } = require('../scripts/lib/state/explore-voi-policy.js');
    const calibrated = { ...calibration, status: 'calibrated', caseCount: 60 };
    const rates = { utilityPerToken: 0.00005, utilityPerMs: 0.0001, actionRiskUtility: 0 };
    const result = evaluateExploreVoiChallenger({ state: state(), controlPolicy, calibration: calibrated, costModel, utilityRates: rates });

    expect(result.status).toBe('evaluable_shadow');
    expect(result.promotion_eligible).toBe(false);
    expect(result.net_voi).toBeCloseTo(0.25, 12);
    expect(result.shadow_recommendation).toMatchObject({ type: 'read', path: 'src/owner.ts' });
    expect(result.recommended_replacement).toBeNull();

    expect(() => evaluateExploreVoiChallenger({
      state: state(), controlPolicy, calibration: calibrated, costModel,
      utilityRates: { ...rates, utilityPerToken: -1 },
    })).toThrow(/non-negative/i);
  });

  it('refuses a calibrated label when the independent-case minimum is not actually met', () => {
    const { evaluateExploreVoiChallenger } = require('../scripts/lib/state/explore-voi-policy.js');
    const mislabeledCalibration = {
      ...calibration,
      status: 'calibrated',
      caseCount: 20,
      minimumCasesForCalibratedStatus: 50,
    };
    const result = evaluateExploreVoiChallenger({
      state: state(),
      controlPolicy,
      calibration: mislabeledCalibration,
      costModel,
      utilityRates: { utilityPerToken: 0, utilityPerMs: 0, actionRiskUtility: 0 },
    });

    expect(result.status).toBe('insufficient_calibration_cases');
    expect(result.net_voi).toBeNull();
    expect(result.shadow_recommendation).toBeNull();
    expect(result.promotion_eligible).toBe(false);
  });

  it('fails closed when empirical read cost data is missing or malformed', () => {
    const { evaluateExploreVoiChallenger } = require('../scripts/lib/state/explore-voi-policy.js');
    const calibrated = { ...calibration, status: 'calibrated', caseCount: 60 };
    const rates = { utilityPerToken: 0.00005, utilityPerMs: 0.0001, actionRiskUtility: 0 };

    for (const badCostModel of [
      {},
      { successfulRead: { medianDurationMs: 500 } },
      { successfulRead: { medianTotalTokens: 2000 } },
      { successfulRead: { medianDurationMs: -1, medianTotalTokens: 2000 } },
      { successfulRead: { medianDurationMs: 500, medianTotalTokens: Number.NaN } },
    ]) {
      const result = evaluateExploreVoiChallenger({
        state: state(),
        controlPolicy,
        calibration: calibrated,
        costModel: badCostModel,
        utilityRates: rates,
      });

      expect(result.status).toBe('insufficient_cost_data');
      expect(result.research_candidate).toBeNull();
      expect(result.shadow_recommendation).toBeNull();
      expect(result.recommended_replacement).toBeNull();
      expect(result.net_voi).toBeNull();
      expect(result.promotion_eligible).toBe(false);
    }
  });

  it('abstains when a candidate has no empirical rank support or the action is not modeled', () => {
    const { evaluateExploreVoiChallenger } = require('../scripts/lib/state/explore-voi-policy.js');
    const unsupportedState = state();
    unsupportedState.results = [];
    unsupportedState.hypotheses[0].members = [];
    unsupportedState.hypotheses[0].root_rank = 99;
    const unsupported = evaluateExploreVoiChallenger({ state: unsupportedState, controlPolicy, calibration, costModel });
    expect(unsupported.status).toBe('insufficient_data');
    expect(unsupported.research_candidate).toBeNull();

    const editControl = { ...controlPolicy, readiness: 'ready-to-edit', edit_ready: true, edit_target: 'src/owner.ts', next_action: { type: 'edit', path: 'src/owner.ts' } };
    const edit = evaluateExploreVoiChallenger({ state: state(), controlPolicy: editControl, calibration, costModel });
    expect(edit.status).toBe('not_applicable');
    expect(edit.recommended_replacement).toBeNull();
  });

  it('uses broader dependency coverage as a bounded research utility proxy', () => {
    const { coverageUtility, simulateReadCoverageGain } = require('../scripts/lib/state/explore-voi-policy.js');
    expect(coverageUtility({ root_read: false, dependency_read_count: 0, dependency_count: 2 })).toBe(0);
    expect(coverageUtility({ root_read: true, dependency_read_count: 0, dependency_count: 2 })).toBe(0.5);
    expect(coverageUtility({ root_read: true, dependency_read_count: 1, dependency_count: 2 })).toBe(0.75);
    expect(coverageUtility({ root_read: true, dependency_read_count: 2, dependency_count: 2 })).toBe(1);
    expect(simulateReadCoverageGain(controlPolicy.coverage, 'root')).toBeCloseTo(0.5, 12);
    expect(simulateReadCoverageGain({ root_read: true, dependency_read_count: 0, dependency_count: 2 }, 'dependency')).toBeCloseTo(0.25, 12);
  });
});
