const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { getCurrentBranch, getRefSha, getTrackedChanges } = require('./git');

const TASK_DIR = '.task';
const VERIFY_FILENAME = 'verify.json';
const LEGACY_VERIFY_STAMP_PATH = path.join(TASK_DIR, VERIFY_FILENAME);

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

function getTaskSlug(taskBranch) {
  if (!taskBranch) return null;
  const parts = String(taskBranch).split('/');
  return parts[parts.length - 1] || null;
}

function normalizeTaskMeta(taskMeta) {
  if (!taskMeta) return null;
  if (taskMeta.data && typeof taskMeta.data === 'object') return taskMeta.data;
  return taskMeta;
}

function getVerifyStampPath(repoRoot, taskMeta) {
  const meta = normalizeTaskMeta(taskMeta);
  const area = meta && meta.area;
  const slug = meta && getTaskSlug(meta.taskBranch || meta.branch);

  if (area && slug) {
    return path.join(repoRoot, TASK_DIR, area, slug, VERIFY_FILENAME);
  }

  return path.join(repoRoot, LEGACY_VERIFY_STAMP_PATH);
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readVerifyStamp(repoRoot, taskMeta) {
  const stampPath = getVerifyStampPath(repoRoot, taskMeta);

  if (fs.existsSync(stampPath)) {
    return readJsonFile(stampPath);
  }

  const legacyPath = path.join(repoRoot, LEGACY_VERIFY_STAMP_PATH);
  if (stampPath !== legacyPath && fs.existsSync(legacyPath)) {
    return readJsonFile(legacyPath);
  }

  return null;
}

function writeVerifyStamp(repoRoot, stamp, taskMeta) {
  const stampPath = getVerifyStampPath(repoRoot, taskMeta);
  fs.mkdirSync(path.dirname(stampPath), { recursive: true });
  fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
  return stampPath;
}

function getVerifyStampMismatch(repoRoot, branchOverride, taskMeta) {
  const stamp = readVerifyStamp(repoRoot, taskMeta);

  if (!stamp) {
    const relativePath = path.relative(repoRoot, getVerifyStampPath(repoRoot, taskMeta)).split(path.sep).join('/');
    return `missing ${relativePath} stamp`;
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
  writeVerifyStamp,
};
