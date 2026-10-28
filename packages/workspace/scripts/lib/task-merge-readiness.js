const PASSING_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

function normalizeCheckRun(check) {
  return {
    name: String(check?.name || 'unnamed check'),
    status: String(check?.status || '').toLowerCase(),
    conclusion: check?.conclusion == null ? null : String(check.conclusion).toLowerCase(),
  };
}

function summarizeCheckRuns(checkRuns) {
  const checks = Array.isArray(checkRuns) ? checkRuns.map(normalizeCheckRun) : [];
  const failed = [];
  const pending = [];
  const passed = [];

  for (const check of checks) {
    if (check.status !== 'completed') {
      pending.push(check.name);
      continue;
    }
    if (check.conclusion && PASSING_CONCLUSIONS.has(check.conclusion)) {
      passed.push(check.name);
      continue;
    }
    failed.push(check.name);
  }

  const state = failed.length > 0
    ? 'failed'
    : pending.length > 0 || checks.length === 0
      ? 'pending'
      : 'passed';

  return {
    state,
    total: checks.length,
    pending,
    failed,
    passed,
  };
}

module.exports = {
  summarizeCheckRuns,
};
