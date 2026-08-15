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

function formatExploreOutput(payload, detail = 'compact') {
  if (detail === 'full') return payload;
  if (detail !== 'compact') {
    throw new Error(`unsupported explore detail mode: ${detail}`);
  }

  return {
    detail: 'compact',
    query: payload.query,
    budget: payload.budget,
    results: (payload.results || []).map(compactExploreResult),
    index_stats: compactIndexStats(payload.index_stats),
  };
}

module.exports = {
  COMPACT_CONNECTION_LIMIT,
  COMPACT_PREVIEW_LIMIT,
  compactExploreResult,
  formatExploreOutput,
};
