const {
  chooseHypothesisTarget,
  deriveReadiness,
  getNextUnreadPath,
  rankHypotheses,
} = require('./explore-hypothesis-model');

const POLICY_VERSION = 1;
const DEPENDENCY_MEMBER_LIMIT = 6;
const ALTERNATIVE_HYPOTHESIS_LIMIT = 3;

function summarizeHypothesis(hypothesis) {
  if (!hypothesis) return null;
  return {
    id: hypothesis.id,
    root_path: hypothesis.root_path,
    support_state: hypothesis.support_state,
    retrieval_support: hypothesis.retrieval_support,
    calibration_status: hypothesis.calibration_status,
  };
}

function evidenceStateForPath(hypothesis, filePath) {
  if ((hypothesis.explicit_relevant_paths || []).includes(filePath)) return 'relevant';
  if ((hypothesis.explicit_irrelevant_paths || []).includes(filePath)) return 'irrelevant';
  if ((hypothesis.read_paths || []).includes(filePath)) return 'read';
  return 'unobserved';
}

function summarizePrimaryHypothesis(hypothesis) {
  if (!hypothesis) return null;
  const memberRoles = new Map((hypothesis.members || []).map((member) => [member.path, member.role]));
  const dependencyPaths = Array.from(new Set([
    ...(hypothesis.member_paths || []).filter((filePath) => filePath !== hypothesis.root_path),
    ...(hypothesis.context_paths || []),
  ])).slice(0, DEPENDENCY_MEMBER_LIMIT);

  return {
    ...summarizeHypothesis(hypothesis),
    root_evidence: evidenceStateForPath(hypothesis, hypothesis.root_path),
    dependencies: dependencyPaths.map((filePath) => ({
      path: filePath,
      role: memberRoles.get(filePath) || 'related',
      evidence: evidenceStateForPath(hypothesis, filePath),
    })),
    omitted_dependency_count: Math.max(0, new Set([
      ...(hypothesis.member_paths || []).filter((filePath) => filePath !== hypothesis.root_path),
      ...(hypothesis.context_paths || []),
    ]).size - DEPENDENCY_MEMBER_LIMIT),
  };
}

function buildDependencyMap(state) {
  const hypotheses = rankHypotheses(state?.hypotheses || []);
  return {
    primary: summarizePrimaryHypothesis(hypotheses[0] || null),
    alternatives: hypotheses.slice(1, 1 + ALTERNATIVE_HYPOTHESIS_LIMIT).map(summarizeHypothesis),
    alternative_count: Math.max(0, hypotheses.length - 1),
    omitted_alternative_count: Math.max(0, hypotheses.length - 1 - ALTERNATIVE_HYPOTHESIS_LIMIT),
  };
}

function computeReadinessEvidence(state, events = []) {
  const readiness = deriveReadiness(state, events);
  const hypotheses = rankHypotheses(state?.hypotheses || []);
  const top = hypotheses[0] || null;
  const evidenceFor = [];
  const evidenceAgainst = [];
  const uncertainties = [...(readiness.reasons || [])];
  const startingState = [];

  if (top) {
    startingState.push(`${hypotheses.length} dependency hypothesis${hypotheses.length === 1 ? '' : 'es'} available`);
    startingState.push(`top hypothesis ${top.root_path}`);
    startingState.push(`retrieval support ${Number(top.retrieval_support || 0).toFixed(3)} (${top.calibration_status || 'provisional'})`);
    if ((top.explicit_relevant_paths || []).length > 0) {
      evidenceFor.push(`explicit relevance: ${(top.explicit_relevant_paths || []).join(', ')}`);
    }
    if ((top.explicit_irrelevant_paths || []).length > 0) {
      evidenceAgainst.push(`explicit irrelevance: ${(top.explicit_irrelevant_paths || []).join(', ')}`);
    }
  }

  if (readiness.coverage?.root_read) evidenceFor.push('top hypothesis root read');
  if ((readiness.coverage?.dependency_read_count || 0) > 0) {
    evidenceFor.push(`read ${readiness.coverage.dependency_read_count}/${readiness.coverage.dependency_count} connected dependencies`);
  }
  if (readiness.validation.test === 'pass') evidenceFor.push('targeted test passed');
  if (readiness.validation.verify === 'pass') evidenceFor.push('verify passed');
  if (readiness.validation.runtime === 'pass') evidenceFor.push('runtime evidence clean');
  if (readiness.validation.test === 'fail') evidenceAgainst.push('targeted test failed');
  if (readiness.validation.verify === 'fail') evidenceAgainst.push('verify failed');
  if (readiness.validation.runtime === 'fail') evidenceAgainst.push('runtime evidence failed');
  if (readiness.contradiction) evidenceAgainst.push('contradiction recorded');

  const recommendation = readiness.state === 'ready-to-edit'
    ? 'evidence coverage is sufficient to choose an edit target; validation is still required after editing'
    : readiness.state === 'blocked'
      ? 'resolve the contradiction or failed validation before editing further'
      : readiness.state === 'insufficient-evidence'
        ? 'run explore before choosing an edit path'
        : 'gather the missing evidence listed under uncertainties';

  return {
    readiness: readiness.state,
    top_hypothesis: readiness.top_hypothesis,
    starting_state: startingState,
    evidence_for: evidenceFor,
    evidence_against: evidenceAgainst,
    uncertainties,
    coverage: readiness.coverage,
    validation: readiness.validation,
    contradiction: readiness.contradiction,
    calibration_status: top?.calibration_status || null,
    evidence_counts: {
      events: events.length,
      hypotheses: hypotheses.length,
      read_top_root: readiness.coverage?.root_read ? 1 : 0,
      dependency_files: readiness.coverage?.dependency_count || 0,
      read_dependency_files: readiness.coverage?.dependency_read_count || 0,
      explicit_relevant_files: top?.explicit_relevant_paths?.length || 0,
      explicit_irrelevant_files: top?.explicit_irrelevant_paths?.length || 0,
    },
    recommendation,
  };
}

function buildNextAction(state, readinessResult) {
  const nextUnreadPath = getNextUnreadPath(state);
  const editTarget = chooseHypothesisTarget(state?.hypotheses || []);
  const topPath = readinessResult.top_hypothesis?.root_path || null;

  if (readinessResult.readiness === 'blocked') {
    return {
      type: 'inspect-failure',
      path: nextUnreadPath || topPath,
      reason: readinessResult.recommendation,
    };
  }

  if (readinessResult.readiness === 'ready-to-edit' && editTarget) {
    return {
      type: 'edit',
      path: editTarget,
      reason: 'the strongest dependency hypothesis has sufficient read coverage to choose an edit target',
    };
  }

  if (nextUnreadPath) {
    return {
      type: 'read',
      path: nextUnreadPath,
      reason: nextUnreadPath === topPath
        ? 'observe the strongest hypothesis root before committing to it'
        : 'cover a connected dependency in the strongest hypothesis before editing',
    };
  }

  return {
    type: 'explore',
    path: null,
    query: topPath || state?.query || null,
    reason: 'the current hypothesis graph does not contain another unread evidence target',
  };
}

function evaluateExplorePolicy(state, events = []) {
  const readinessResult = computeReadinessEvidence(state, events);
  const dependencyMap = buildDependencyMap(state);
  const nextAction = buildNextAction(state, readinessResult);
  const editTarget = readinessResult.readiness === 'ready-to-edit'
    ? chooseHypothesisTarget(state?.hypotheses || [])
    : null;

  return {
    policy_version: POLICY_VERSION,
    readiness: readinessResult.readiness,
    edit_ready: Boolean(editTarget),
    top_hypothesis: readinessResult.top_hypothesis,
    dependency_map: dependencyMap,
    uncertainty: {
      reasons: readinessResult.uncertainties,
      contradiction: Boolean(readinessResult.contradiction),
      alternative_hypothesis_count: dependencyMap.alternative_count,
      calibration_status: readinessResult.calibration_status,
    },
    next_action: nextAction,
    edit_target: editTarget,
    coverage: readinessResult.coverage,
    validation: readinessResult.validation,
    calibration_status: readinessResult.calibration_status,
    evidence_for: readinessResult.evidence_for,
    evidence_against: readinessResult.evidence_against,
    starting_state: readinessResult.starting_state,
    evidence_counts: readinessResult.evidence_counts,
    recommendation: readinessResult.recommendation,
  };
}

function projectReadiness(policyResult) {
  return {
    readiness: policyResult.readiness,
    top_hypothesis: policyResult.top_hypothesis,
    starting_state: policyResult.starting_state,
    evidence_for: policyResult.evidence_for,
    evidence_against: policyResult.evidence_against,
    uncertainties: policyResult.uncertainty?.reasons || [],
    coverage: policyResult.coverage,
    validation: policyResult.validation,
    calibration_status: policyResult.calibration_status,
    evidence_counts: policyResult.evidence_counts,
    recommendation: policyResult.recommendation,
  };
}

function projectDecisionRecommendation(policyResult, options = {}) {
  const next = policyResult.next_action || { type: 'explore', path: null, reason: policyResult.recommendation };
  let action;
  let alternative;
  let recommendation;

  if (next.type === 'inspect-failure') {
    action = 'inspect contradictory or failed validation evidence';
    alternative = next.path ? `read ${next.path}` : 'rerun explore after resolving the failure';
    recommendation = 'investigate-failure';
  } else if (next.type === 'edit') {
    action = `run exploit --target ${next.path}`;
    alternative = 'run confirm --verify after editing';
    recommendation = 'exploit';
  } else if (next.type === 'read') {
    action = `read ${next.path}`;
    alternative = 'rerun explore if the dependency graph is incomplete';
    recommendation = 'read';
  } else {
    action = `explore deeper into ${next.query || policyResult.top_hypothesis?.root_path || 'the current task'}`;
    alternative = 'rerun explore with a larger budget or a tighter scope';
    recommendation = 'explore';
  }

  return {
    action,
    reason: next.reason,
    readiness: policyResult.readiness,
    hypothesis_support: policyResult.top_hypothesis,
    alternative,
    context: options.context || null,
    ...(policyResult.edit_target ? { exploit_target: policyResult.edit_target } : {}),
    recommendation,
  };
}

function resolveExploitTarget(policyResult, targetOverride = null) {
  if (targetOverride) return targetOverride;
  if (!policyResult?.edit_ready) return null;
  return policyResult.edit_target || null;
}

module.exports = {
  ALTERNATIVE_HYPOTHESIS_LIMIT,
  DEPENDENCY_MEMBER_LIMIT,
  POLICY_VERSION,
  buildDependencyMap,
  computeReadinessEvidence,
  evaluateExplorePolicy,
  projectDecisionRecommendation,
  projectReadiness,
  resolveExploitTarget,
};
