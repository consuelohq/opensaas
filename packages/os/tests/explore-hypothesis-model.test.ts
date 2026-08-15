import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const calibrationArtifact = require('../scripts/lib/state/explore-calibration.v1.json');

const model = require('../scripts/lib/state/explore-hypothesis-model.js') as {
  buildHypothesesFromResults: (results: Array<Record<string, unknown>>, calibration: Record<string, unknown>) => Array<Record<string, any>>;
  chooseHypothesisTarget: (hypotheses: Array<Record<string, any>>) => string | null;
  deriveReadiness: (state: Record<string, any>, events: Array<Record<string, any>>) => Record<string, any>;
  fitRankCalibration: (report: Record<string, any>, cases: Record<string, any>) => Record<string, any>;
  updateHypothesesWithEvents: (state: Record<string, any>, events: Array<Record<string, any>>, calibration: Record<string, unknown>) => Record<string, any>;
};
const policy = require('../scripts/lib/state/explore-policy.js') as {
  evaluateExplorePolicy: (state: Record<string, any>, events: Array<Record<string, any>>) => Record<string, any>;
  projectDecisionRecommendation: (policyResult: Record<string, any>, options?: Record<string, any>) => Record<string, any>;
  projectReadiness: (policyResult: Record<string, any>) => Record<string, any>;
  resolveExploitTarget: (policyResult: Record<string, any>, targetOverride?: string | null) => string | null;
};

const calibration = {
  schemaVersion: 1,
  status: 'provisional',
  bins: [
    { name: 'r1', minRank: 1, maxRank: 1, estimatedRelevanceRate: 0.86 },
    { name: 'r2_3', minRank: 2, maxRank: 3, estimatedRelevanceRate: 0.33 },
    { name: 'r4_5', minRank: 4, maxRank: 5, estimatedRelevanceRate: 0.13 },
    { name: 'r6_10', minRank: 6, maxRank: 10, estimatedRelevanceRate: 0.10 },
  ],
};

function sampleResults() {
  return [
    {
      path: 'src/owner.ts',
      score: 0.9,
      graph_connections: ['src/helper.ts', 'src/owner.test.ts'],
    },
    {
      path: 'src/helper.ts',
      score: 0.8,
      graph_connections: ['src/owner.ts'],
    },
    {
      path: 'src/unrelated.ts',
      score: 0.7,
      graph_connections: [],
    },
  ];
}

describe('Explore honest hypothesis model', () => {
  it('groups connected ranked results into dependency hypotheses with benchmark support', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);

    expect(hypotheses).toHaveLength(2);
    expect(hypotheses[0]).toMatchObject({
      root_path: 'src/owner.ts',
      root_rank: 1,
      member_paths: ['src/owner.ts', 'src/helper.ts'],
      retrieval_support: 0.86,
      calibration_status: 'provisional',
      support_state: 'unlabeled',
    });
    expect(hypotheses[0].context_paths).toContain('src/owner.test.ts');
  });

  it('treats a plain read as coverage only, never positive relevance evidence', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = { results: sampleResults(), hypotheses, hypothesis_event_ids: [] };
    const updated = model.updateHypothesesWithEvents(state, [{
      id: 'read-1',
      type: 'file.read',
      file_path: 'src/owner.ts',
    }], calibration);

    expect(updated.hypotheses[0].read_paths).toContain('src/owner.ts');
    expect(updated.hypotheses[0].explicit_relevant_paths).toEqual([]);
    expect(updated.hypotheses[0].retrieval_support).toBe(0.86);
    expect(updated.hypotheses[0].support_state).toBe('unlabeled');
  });

  it('keeps explicit relevance evidence separate from validation evidence', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = { results: sampleResults(), hypotheses, hypothesis_event_ids: [] };
    const updated = model.updateHypothesesWithEvents(state, [
      { id: 'rel-1', type: 'file.relevant', file_path: 'src/helper.ts' },
      { id: 'test-1', type: 'test.pass', file_path: 'src/helper.ts' },
      { id: 'verify-1', type: 'verify.pass' },
    ], calibration);

    expect(updated.hypotheses[0].explicit_relevant_paths).toEqual(['src/helper.ts']);
    expect(updated.hypotheses[0].support_state).toBe('supported');
    expect(updated.hypotheses[0].retrieval_support).toBe(0.86);

    const readiness = model.deriveReadiness(updated, [
      { id: 'test-1', type: 'test.pass', file_path: 'src/helper.ts' },
      { id: 'verify-1', type: 'verify.pass' },
    ]);
    expect(readiness.validation).toMatchObject({ test: 'pass', verify: 'pass' });
  });

  it('selects the strongest supported hypothesis instead of blindly result index zero', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = { results: sampleResults(), hypotheses, hypothesis_event_ids: [] };
    const updated = model.updateHypothesesWithEvents(state, [
      { id: 'irr-1', type: 'file.irrelevant', file_path: 'src/owner.ts' },
      { id: 'rel-2', type: 'file.relevant', file_path: 'src/unrelated.ts' },
    ], calibration);

    expect(model.chooseHypothesisTarget(updated.hypotheses)).toBe('src/unrelated.ts');
  });

  it('fits provisional rank support from ExploreBench with Jeffreys smoothing and leave-one-case-out Brier', () => {
    const cases = {
      cases: [
        { id: 'a', labels: [{ path: 'a1', relevance: 3 }, { path: 'a3', relevance: 1 }] },
        { id: 'b', labels: [{ path: 'b1', relevance: 3 }] },
      ],
    };
    const report = {
      benchmark: {
        caseCount: 2,
        caseResults: [
          { id: 'a', topPaths: ['a1', 'a2', 'a3', 'a4'] },
          { id: 'b', topPaths: ['b1', 'b2', 'b3', 'b4'] },
        ],
      },
    };

    const fitted = model.fitRankCalibration(report, cases);
    expect(fitted.status).toBe('provisional');
    expect(fitted.method).toBe('jeffreys-smoothed-binomial-rank-bins');
    expect(fitted.caseCount).toBe(2);
    expect(fitted.bins[0]).toMatchObject({ name: 'r1', samples: 2, relevant: 2 });
    expect(fitted.bins[0].estimatedRelevanceRate).toBeCloseTo(2.5 / 3, 12);
    expect(Number.isFinite(fitted.leaveOneCaseOutBrier)).toBe(true);
  });

  it('never self-promotes provisional calibration from sample count alone', () => {
    const cases = { cases: Array.from({ length: 60 }, (_, index) => ({ id: 'case-' + index, labels: [{ path: 'p-' + index, relevance: 3 }] })) };
    const report = { benchmark: { caseCount: 60, caseResults: cases.cases.map((item) => ({ id: item.id, topPaths: [item.labels[0].path] })) } };

    const provisional = model.fitRankCalibration(report, cases);
    const approved = model.fitRankCalibration(report, cases, { approvedCalibration: true });

    expect(provisional.status).toBe('provisional');
    expect(approved.status).toBe('calibrated');
  });

  it('uses evidence-log order for the latest validation observation', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = { results: sampleResults(), hypotheses };
    const readiness = model.deriveReadiness(state, [
      { type: 'test.pass' },
      { type: 'test.fail' },
      { type: 'test.pass' },
    ]);
    expect(readiness.validation.test).toBe('pass');
  });

  it('reports readiness categorically rather than as a posterior probability', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = model.updateHypothesesWithEvents(
      { results: sampleResults(), hypotheses, hypothesis_event_ids: [] },
      [
        { id: 'read-root', type: 'file.read', file_path: 'src/owner.ts' },
        { id: 'read-dep', type: 'file.read', file_path: 'src/helper.ts' },
      ],
      calibration,
    );

    const readiness = model.deriveReadiness(state, []);
    expect(readiness.state).toBe('ready-to-edit');
    expect(readiness).not.toHaveProperty('posterior');
    expect(readiness).not.toHaveProperty('probability');
  });

  it('unifies readiness, dependency map, uncertainty, next action, and edit readiness in one policy result', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = model.updateHypothesesWithEvents(
      { query: 'fix the owner dependency path', results: sampleResults(), hypotheses, hypothesis_event_ids: [] },
      [
        { id: 'read-root', type: 'file.read', file_path: 'src/owner.ts' },
        { id: 'read-dep', type: 'file.read', file_path: 'src/helper.ts' },
      ],
      calibration,
    );

    const result = policy.evaluateExplorePolicy(state, []);

    expect(result).toMatchObject({
      policy_version: 1,
      readiness: 'ready-to-edit',
      edit_ready: true,
      top_hypothesis: { root_path: 'src/owner.ts' },
      dependency_map: {
        primary: { root_path: 'src/owner.ts', support_state: 'unlabeled' },
        alternative_count: 1,
      },
      uncertainty: {
        reasons: [],
        contradiction: false,
      },
      next_action: {
        type: 'edit',
        path: 'src/owner.ts',
      },
      edit_target: 'src/owner.ts',
    });
    expect(result).not.toHaveProperty('posterior');
    expect(result).not.toHaveProperty('probability');
  });

  it('returns the next evidence read while the strongest hypothesis lacks coverage', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = { query: 'fix owner', results: sampleResults(), hypotheses };

    const result = policy.evaluateExplorePolicy(state, []);

    expect(result.readiness).toBe('gathering');
    expect(result.edit_ready).toBe(false);
    expect(result.uncertainty.reasons).toContain('read the top hypothesis root');
    expect(result.next_action).toMatchObject({
      type: 'read',
      path: 'src/owner.ts',
    });
  });

  it('blocks editing when validation contradicts the current path', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = model.updateHypothesesWithEvents(
      { query: 'fix owner', results: sampleResults(), hypotheses, hypothesis_event_ids: [] },
      [
        { id: 'read-root', type: 'file.read', file_path: 'src/owner.ts' },
        { id: 'read-dep', type: 'file.read', file_path: 'src/helper.ts' },
      ],
      calibration,
    );

    const result = policy.evaluateExplorePolicy(state, [{ id: 'test-fail', type: 'test.fail' }]);

    expect(result.readiness).toBe('blocked');
    expect(result.edit_ready).toBe(false);
    expect(result.next_action.type).toBe('inspect-failure');
    expect(result.uncertainty.reasons).toContain('validation evidence contains a failure');
  });

  it('projects legacy readiness, decision, and exploit views from the same unified policy result', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const state = model.updateHypothesesWithEvents(
      { query: 'fix owner', results: sampleResults(), hypotheses, hypothesis_event_ids: [] },
      [
        { id: 'read-root', type: 'file.read', file_path: 'src/owner.ts' },
        { id: 'read-dep', type: 'file.read', file_path: 'src/helper.ts' },
      ],
      calibration,
    );
    const unified = policy.evaluateExplorePolicy(state, []);

    expect(policy.projectReadiness(unified)).toMatchObject({
      readiness: unified.readiness,
      top_hypothesis: unified.top_hypothesis,
      uncertainties: unified.uncertainty.reasons,
      coverage: unified.coverage,
      validation: unified.validation,
    });
    expect(policy.projectDecisionRecommendation(unified)).toMatchObject({
      readiness: unified.readiness,
      recommendation: 'exploit',
      exploit_target: 'src/owner.ts',
    });
    expect(policy.resolveExploitTarget(unified)).toBe('src/owner.ts');
  });

  it('does not let the legacy exploit alias bypass a non-ready policy without an explicit override', () => {
    const hypotheses = model.buildHypothesesFromResults(sampleResults(), calibration);
    const unified = policy.evaluateExplorePolicy({ query: 'fix owner', results: sampleResults(), hypotheses }, []);

    expect(unified.edit_ready).toBe(false);
    expect(policy.resolveExploitTarget(unified)).toBeNull();
    expect(policy.resolveExploitTarget(unified, 'src/helper.ts')).toBe('src/helper.ts');
  });

  it('keeps the committed calibration artifact reproducible from the E2 benchmark', () => {
    const report = JSON.parse(readFileSync(new URL('../explore-bench/reports/e2-live-challenger.json', import.meta.url), 'utf8'));
    const cases = JSON.parse(readFileSync(new URL('../explore-bench/cases.v1.json', import.meta.url), 'utf8'));
    const fitted = model.fitRankCalibration(report, cases);

    expect(fitted.status).toBe('provisional');
    expect(fitted.caseCount).toBe(calibrationArtifact.caseCount);
    expect(fitted.observationCount).toBe(calibrationArtifact.observationCount);
    expect(fitted.leaveOneCaseOutBrier).toBeCloseTo(calibrationArtifact.leaveOneCaseOutBrier, 12);
    expect(fitted.bins).toEqual(calibrationArtifact.bins);
  });



});
