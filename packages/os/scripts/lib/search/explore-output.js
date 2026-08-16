const COMPACT_CONNECTION_LIMIT = 3;
const COMPACT_PREVIEW_LIMIT = 240;

function compactConnections(result) {
  const connections = [];
  const seen = new Set();

  for (const edge of result.typed_edges || []) {
    if (!edge?.path || seen.has(edge.path)) continue;
    seen.add(edge.path);
    connections.push({
      path: edge.path,
      type: edge.type || 'related',
    });
    if (connections.length >= COMPACT_CONNECTION_LIMIT) return connections;
  }

  for (const filePath of result.graph_connections || []) {
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    connections.push({ path: filePath, type: 'related' });
    if (connections.length >= COMPACT_CONNECTION_LIMIT) break;
  }

  return connections;
}

function compactExploreResult(result) {
  return {
    path: result.path,
    score: result.score,
    symbol: result.symbol ?? null,
    chunk_type: result.chunk_type ?? null,
    is_implementation: Boolean(result.is_implementation),
    has_test: Boolean(result.has_test),
    changed_in_branch: Boolean(result.changed_in_branch),
    evidence_state: result.evidence_state ?? null,
    retrieval_support: result.retrieval_support ?? null,
    calibration_status: result.calibration_status ?? null,
    reason: result.reason || '',
    preview: String(result.preview || '').slice(0, COMPACT_PREVIEW_LIMIT),
    lines: result.lines || null,
    connections: compactConnections(result),
    connection_count: result.graph_connection_count
      ?? result.graph_connections?.length
      ?? result.typed_edges?.length
      ?? 0,
  };
}

function compactIndexStats(indexStats = {}) {
  return {
    total_files: indexStats.total_files ?? null,
    total_chunks: indexStats.total_chunks ?? null,
    last_indexed: indexStats.last_indexed ?? null,
    files_indexed: indexStats.files_indexed ?? null,
    chunks_embedded: indexStats.chunks_embedded ?? null,
  };
}

function compactVoiChallenger(challenger) {
  if (!challenger) return null;
  const candidate = challenger.research_candidate;
  return {
    voi_version: challenger.voi_version ?? null,
    status: challenger.status ?? null,
    promotion_eligible: Boolean(challenger.promotion_eligible),
    control_action: challenger.control_action || null,
    research_candidate: candidate ? {
      type: candidate.type || null,
      path: candidate.path || null,
      expected_proxy_gain: candidate.expected_proxy_gain ?? null,
    } : null,
    shadow_recommendation: challenger.shadow_recommendation || null,
    recommended_replacement: challenger.recommended_replacement || null,
    agreement: challenger.agreement ?? null,
    net_voi: challenger.net_voi ?? null,
  };
}

function compactPromotionGate(gate) {
  if (!gate) return null;
  return {
    gate_version: gate.gate_version ?? null,
    status: gate.status ?? null,
    target: gate.target ?? null,
    promotion_eligible: Boolean(gate.promotion_eligible),
    production_cutover: Boolean(gate.production_cutover),
    blockers: Array.isArray(gate.blockers) ? gate.blockers.slice(0, 12) : [],
    challenger_configuration: gate.challenger_configuration ? {
      status: gate.challenger_configuration.status ?? null,
      frozen: gate.challenger_configuration.frozen ?? null,
      configuration_id: gate.challenger_configuration.configuration_id ?? null,
      utility_profile_id: gate.challenger_configuration.utility_profile_id ?? null,
      utility_scale_present: Boolean(gate.challenger_configuration.utility_scale_present),
      utility_scale_valid: Boolean(gate.challenger_configuration.utility_scale_valid),
      utility_scale_non_degenerate: Boolean(gate.challenger_configuration.utility_scale_non_degenerate),
      read_cost_model_ready: Boolean(gate.challenger_configuration.read_cost_model_ready),
    } : null,
    local_challenger: gate.local_challenger ? {
      status: gate.local_challenger.status ?? null,
      net_voi: gate.local_challenger.net_voi ?? null,
      has_shadow_recommendation: Boolean(gate.local_challenger.has_shadow_recommendation),
      promotion_eligible: Boolean(gate.local_challenger.promotion_eligible),
    } : null,
    benchmark: gate.benchmark ? {
      analysis_mode: gate.benchmark.analysis_mode ?? null,
      planned_evaluated_case_count: gate.benchmark.planned_evaluated_case_count ?? null,
      frozen: gate.benchmark.frozen ?? null,
      independent_case_count: gate.benchmark.independent_case_count ?? null,
      evaluated_case_count: gate.benchmark.evaluated_case_count ?? null,
      relevance: gate.benchmark.relevance ? {
        wins: gate.benchmark.relevance.wins ?? null,
        losses: gate.benchmark.relevance.losses ?? null,
        ties: gate.benchmark.relevance.ties ?? null,
        discordant: gate.benchmark.relevance.discordant ?? null,
        p_value: gate.benchmark.relevance.p_value ?? null,
      } : null,
      required_node: gate.benchmark.required_node ? {
        regressions: gate.benchmark.required_node.regressions ?? null,
      } : null,
    } : null,
    shadow: gate.shadow ? {
      status: gate.shadow.status ?? null,
      frozen: gate.shadow.frozen ?? null,
      observation_count: gate.shadow.observation_count ?? null,
      distinct_question_count: gate.shadow.distinct_question_count ?? null,
      error_count: gate.shadow.error_count ?? null,
      authority_violation_count: gate.shadow.authority_violation_count ?? null,
    } : null,
    local_shadow: gate.local_shadow ? {
      observation_count: gate.local_shadow.observation_count ?? null,
      distinct_question_count: gate.local_shadow.distinct_question_count ?? null,
      error_count: gate.local_shadow.error_count ?? null,
      authority_violation_count: gate.local_shadow.authority_violation_count ?? null,
    } : null,
  };
}

function formatExploreOutput(payload, detail = 'compact') {
  if (detail === 'full') return payload;
  if (detail !== 'compact') {
    throw new Error(`unsupported explore detail mode: ${detail}`);
  }

  return {
    detail: 'compact',
    query: payload.query,
    budget: payload.budget,
    policy: payload.policy || null,
    voi_challenger: compactVoiChallenger(payload.voi_challenger),
    promotion_gate: compactPromotionGate(payload.promotion_gate),
    results: (payload.results || []).map(compactExploreResult),
    index_stats: compactIndexStats(payload.index_stats),
  };
}

module.exports = {
  COMPACT_CONNECTION_LIMIT,
  COMPACT_PREVIEW_LIMIT,
  compactExploreResult,
  compactPromotionGate,
  compactVoiChallenger,
  formatExploreOutput,
};
