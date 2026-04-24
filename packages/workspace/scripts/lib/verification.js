const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getCurrentBranch, getRefSha, getTrackedChanges } = require('./git');

const VERIFY_STAMP_PATH = path.join('.task', 'verify.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isVerificationIgnored(filePath) {
  return filePath === VERIFY_STAMP_PATH || filePath.startsWith('.task/');
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

function getVerifyStampPath(repoRoot) {
  return path.join(repoRoot, VERIFY_STAMP_PATH);
}

function readVerifyStamp(repoRoot) {
  const stampPath = getVerifyStampPath(repoRoot);

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
  const stampPath = getVerifyStampPath(repoRoot);
  fs.mkdirSync(path.dirname(stampPath), { recursive: true });
  fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
}

function getVerifyStampMismatch(repoRoot, branchOverride) {
  const stamp = readVerifyStamp(repoRoot);

  if (!stamp) {
    return 'missing .task/verify.json stamp';
  }

  if (stamp.result !== 'pass') {
    return `last verify result was ${stamp.result || 'unknown'}`;
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
  writeVerifyStamp,
};
