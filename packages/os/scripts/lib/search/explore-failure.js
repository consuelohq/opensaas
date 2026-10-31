'use strict';

// Errors must remain actionable even when the underlying index or semantic
// retrieval fails. Avoid passing unbounded provider/database diagnostics to
// the agent, and never include request secrets in the public failure text.
function safeDetail(error) {
  const raw = error instanceof Error ? error.message : String(error ?? 'unknown failure');
  return raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:token|password|secret|api[_-]?key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk|pk|rk|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{10,}\b/gi, '[REDACTED]')
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
    .replace(/\b[A-Za-z0-9+/=_-]{64,}\b/g, '[REDACTED_LONG_VALUE]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240) || 'unknown failure';
}

function formatExploreFailure(error, phase) {
  const detail = safeDetail(error);
  const rawCode = error && typeof error === 'object' ? error.code : undefined;
  const code = typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,32}$/.test(rawCode)
    ? rawCode
    : /database (?:table )?is locked|SQLITE_BUSY/i.test(detail)
      ? 'SQLITE_BUSY'
      : '';
  const stage = phase === 'retrieve' ? 'retrieve' : 'index';
  const busy = code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED';
  const next = busy
    ? 'Retry explore once after a short delay; if the lock persists, use fs.search or fs.read.'
    : 'Use fs.search or fs.read for direct source inspection; retry explore after resolving the cause.';
  return new Error(`explore ${stage} failed${code ? ` (${code})` : ''}: ${detail}. Next: ${next}`, {
    cause: error,
  });
}

module.exports = { formatExploreFailure };
