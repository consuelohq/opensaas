const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getCurrentBranch, getRefSha, getTrackedChanges } = require('./git');
const { findTaskMeta, getTaskVerifyPath } = require('./task-meta');

const VERIFY_STAMP_PATH = path.join('.task', 'verify.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isVerificationIgnored(filePath) {
  return filePath.startsWith('.task/');
}

function getFileDigest(repoRoot, change) {
  if (change.deleted) {
    return null;
  }

  const absolutePath = path.join(repoRoot, change.path);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return sha256(fs.readFileSync(absolutePath));
}

function getRelevantChanges(repoRoot) {
  return getTrackedChanges(repoRoot)
    .filter((change) => !isVerificationIgnored(change.path))
    .map((change) => ({
      path: change.path,
      status: change.status,
      deleted: Boolean(change.deleted),
      digest: getFileDigest(repoRoot, change),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function computeVerificationState(repoRoot, branchOverride) {
  const branch = branchOverride || getCurrentBranch(repoRoot);
  const headSha = getRefSha(repoRoot, 'HEAD');
  const changes = getRelevantChanges(repoRoot);
  const changeHash = sha256(JSON.stringify({ branch, headSha, changes }));

  return {
    branch,
    headSha,
    changeHash,
    changes,
  };
}


function compactFailureOutput(value, limit = 1200) {
  const normalized = String(value || '')
    .trim()
    .replace(/\s*\n\s*/g, ' | ')
    .replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.length > limit
    ? `${normalized.slice(0, limit)} ... truncated ${normalized.length - limit} chars`
    : normalized;
}

function summarizeTestSelectionFailures(testSelection) {
  if (!testSelection || testSelection.passed) return [];

  const data = testSelection.data || {};
  const failedSuites = Array.isArray(data.failedSuites) ? data.failedSuites : [];
  if (failedSuites.length > 0) {
    return failedSuites.flatMap((suite) => {
      const details = [
        suite.ruleId ? `rule ${suite.ruleId}` : null,
        suite.exitCode !== null && suite.exitCode !== undefined ? `exit ${suite.exitCode}` : null,
        suite.signal ? `signal ${suite.signal}` : null,
        suite.error?.code ? `error ${suite.error.code}` : null,
        Number.isFinite(suite.durationMs) ? `${suite.durationMs}ms` : null,
      ].filter(Boolean).join(', ');
      const lines = [`registry failed suite ${suite.name || 'unnamed'}${details ? ` (${details})` : ''}`];
      const output = compactFailureOutput(suite.outputTail);
      if (output) lines.push(`registry output tail: ${output}`);
      return lines;
    });
  }

  const runnerDetails = [
    testSelection.status !== null && testSelection.status !== undefined ? `exit ${testSelection.status}` : null,
    testSelection.signal ? `signal ${testSelection.signal}` : null,
    testSelection.error?.code ? `error ${testSelection.error.code}` : null,
    data.error || null,
  ].filter(Boolean).join(', ');
  const lines = [`registry runner failed${runnerDetails ? ` (${runnerDetails})` : ''}`];
  const output = compactFailureOutput(testSelection.stderr || data.stdout);
  if (output) lines.push(`registry runner output: ${output}`);
  return lines;
}

function getVerifyStampPath(repoRoot, branchOverride) {
  const taskMeta = findTaskMeta(repoRoot, { currentBranch: branchOverride, taskBranch: branchOverride });
  if (taskMeta?.data) return getTaskVerifyPath(repoRoot, taskMeta.data);
  return path.join(repoRoot, VERIFY_STAMP_PATH);
}

function readVerifyStamp(repoRoot, branchOverride) {
  const stampPath = getVerifyStampPath(repoRoot, branchOverride);

  if (!fs.existsSync(stampPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeVerifyStamp(repoRoot, stamp) {
  const stampPath = getVerifyStampPath(repoRoot, stamp.branch);
  fs.mkdirSync(path.dirname(stampPath), { recursive: true });
  fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
  return stampPath;
}

function getVerifyStampMismatch(repoRoot, branchOverride) {
  const stamp = readVerifyStamp(repoRoot, branchOverride);

  if (!stamp) {
    return `missing ${path.relative(repoRoot, getVerifyStampPath(repoRoot, branchOverride)).split(path.sep).join('/')} stamp`;
  }

  if (stamp.result !== 'pass') {
    return `last verify result was ${stamp.result || 'unknown'}`;
  }

  if (stamp.publishValid !== true) {
    return 'last verify stamp is not publish-valid';
  }

  if (stamp.mode !== 'full') {
    return `last verify mode was ${stamp.mode || 'unknown'}, not full`;
  }

  if (!stamp.review || stamp.review.skipped || stamp.review.passed !== true) {
    return 'last verify did not complete review successfully';
  }

  if (!stamp.db || stamp.db.skipped || stamp.db.passed !== true || stamp.db.warnOnly) {
    return 'last verify did not complete db guardrails successfully';
  }

  const state = computeVerificationState(repoRoot, branchOverride);

  if (stamp.branch !== state.branch) {
    return `verify branch mismatch: ${stamp.branch} != ${state.branch}`;
  }

  if (stamp.headSha !== state.headSha) {
    return `verify head mismatch: ${stamp.headSha || 'unknown'} != ${state.headSha}`;
  }

  if (stamp.changeHash !== state.changeHash) {
    return 'tracked changes changed since last verify';
  }

  return null;
}

module.exports = {
  computeVerificationState,
  getVerifyStampMismatch,
  getVerifyStampPath,
  readVerifyStamp,
  summarizeTestSelectionFailures,
  writeVerifyStamp,
};
