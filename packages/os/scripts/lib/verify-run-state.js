const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_WAIT_MS = 10 * 60 * 1000;
const DEFAULT_LOCK_STALE_MS = 30 * 60 * 1000;
const POLL_MS = 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getRefSha(repoRoot, ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', ref + '^' + '{commit}'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function gitPath(repoRoot, relativePath) {
  try {
    const output = execFileSync('git', ['rev-parse', '--git-path', relativePath], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.isAbsolute(output) ? output : path.join(repoRoot, output);
  } catch {
    return path.join(repoRoot, '.git', relativePath);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function sleep(ms) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, ms);
}

function getVerifyRunDir(repoRoot) {
  return gitPath(repoRoot, 'opensaas-verify-runs');
}

function normalizeArgs(args = {}) {
  return {
    db: args.db !== false,
    dbWarnOnly: Boolean(args.dbWarnOnly),
    review: args.review !== false,
    reviewArgs: Array.isArray(args.reviewArgs) ? [...args.reviewArgs] : [],
    stamp: args.stamp !== false,
  };
}

function makeVerifyRunIdentity({ repoRoot, branch, base, headSha, changeHash, args }) {
  const payload = {
    schema: 'verify-run-identity.v1',
    repoRoot: path.resolve(repoRoot),
    branch,
    base,
    baseSha: getRefSha(repoRoot, base),
    headSha,
    changeHash,
    args: normalizeArgs(args),
  };

  return {
    ...payload,
    key: sha256(JSON.stringify(payload)),
  };
}

function pathsForIdentity(repoRoot, identity) {
  const dir = path.join(getVerifyRunDir(repoRoot), identity.key);
  return {
    dir,
    lockPath: path.join(dir, 'run.lock'),
    recordPath: path.join(dir, 'record.json'),
    stdoutPath: path.join(dir, 'stdout.txt'),
    stderrPath: path.join(dir, 'stderr.txt'),
  };
}

function readCompletedResult(paths) {
  const record = readJson(paths.recordPath);
  if (!record || record.status !== 'completed') return null;
  const exitCode = Number.isInteger(record.exitCode) ? record.exitCode : 1;
  if (exitCode !== 0) return null;
  if (!fs.existsSync(paths.stdoutPath) || !fs.existsSync(paths.stderrPath)) return null;

  return {
    record,
    stdout: fs.readFileSync(paths.stdoutPath, 'utf8'),
    stderr: fs.readFileSync(paths.stderrPath, 'utf8'),
    exitCode,
  };
}

function readActiveRecord(paths) {
  return readJson(paths.recordPath);
}

function removeLock(paths) {
  try {
    fs.unlinkSync(paths.lockPath);
  } catch {
    // best effort; another process may have removed it.
  }
}

function lockExists(paths) {
  return fs.existsSync(paths.lockPath);
}

function isLockStale(paths, staleMs = DEFAULT_LOCK_STALE_MS) {
  try {
    const stat = fs.statSync(paths.lockPath);
    return Date.now() - stat.mtimeMs > staleMs;
  } catch {
    return true;
  }
}

function markOrphaned(paths, record, reason) {
  writeJsonAtomic(paths.recordPath, {
    ...(record || {}),
    status: 'orphaned',
    orphanedAt: new Date().toISOString(),
    orphanReason: reason,
  });
  removeLock(paths);
}

function waitForExistingRun(paths, waitMs) {
  const start = Date.now();

  while (Date.now() - start < waitMs) {
    const completed = readCompletedResult(paths);
    if (completed) return completed;

    const record = readActiveRecord(paths);
    if (!record) {
      if (!lockExists(paths)) return null;
      if (isLockStale(paths)) {
        removeLock(paths);
        return null;
      }
      sleep(POLL_MS);
      continue;
    }

    if (record.status !== 'running') {
      removeLock(paths);
      return null;
    }

    if (!isPidRunning(record.pid)) {
      markOrphaned(paths, record, 'record pid is no longer running');
      return null;
    }

    sleep(POLL_MS);
  }

  const record = readActiveRecord(paths);
  const error = new Error(`verify run still running after ${waitMs}ms`);
  error.code = 'VERIFY_RUN_STILL_RUNNING';
  error.record = record;
  throw error;
}

function beginVerifyRun(repoRoot, identity, options = {}) {
  const waitMs = Number(options.waitMs || process.env.WORKSPACE_VERIFY_RUN_WAIT_MS || DEFAULT_WAIT_MS);
  const paths = pathsForIdentity(repoRoot, identity);
  ensureDir(paths.dir);

  const completed = readCompletedResult(paths);
  if (completed) {
    return { mode: 'replay', paths, identity, result: completed };
  }

  while (true) {
    try {
      const lockFd = fs.openSync(paths.lockPath, 'wx');
      const record = {
        schema: 'verify-run-record.v1',
        status: 'running',
        key: identity.key,
        identity,
        pid: process.pid,
        startedAt: new Date().toISOString(),
        stdoutPath: paths.stdoutPath,
        stderrPath: paths.stderrPath,
      };
      try {
        writeJsonAtomic(paths.recordPath, record);
      } catch (writeError) {
        try {
          fs.closeSync(lockFd);
        } catch {
          // best effort
        }
        removeLock(paths);
        throw writeError;
      }
      return { mode: 'run', paths, identity, lockFd };
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;

      const existingResult = waitForExistingRun(paths, waitMs);
      if (existingResult) {
        return { mode: 'replay', paths, identity, result: existingResult };
      }
    }
  }
}

function closeRunLock(run) {
  try {
    fs.closeSync(run.lockFd);
  } catch {
    // best effort
  }
  removeLock(run.paths);
}

function finishVerifyRun(run, result) {
  if (!run || run.mode !== 'run') return;

  try {
    fs.writeFileSync(run.paths.stdoutPath, result.stdout || '', 'utf8');
    fs.writeFileSync(run.paths.stderrPath, result.stderr || '', 'utf8');
    writeJsonAtomic(run.paths.recordPath, {
      schema: 'verify-run-record.v1',
      status: 'completed',
      key: run.identity.key,
      identity: run.identity,
      pid: process.pid,
      startedAt: readJson(run.paths.recordPath)?.startedAt || null,
      completedAt: new Date().toISOString(),
      exitCode: Number.isInteger(result.exitCode) ? result.exitCode : 0,
      stdoutPath: run.paths.stdoutPath,
      stderrPath: run.paths.stderrPath,
    });
  } finally {
    closeRunLock(run);
  }
}

function abortVerifyRun(run, reason = 'verify run aborted before completion') {
  if (!run || run.mode !== 'run') return;

  try {
    const existingRecord = readJson(run.paths.recordPath) || {};
    writeJsonAtomic(run.paths.recordPath, {
      ...existingRecord,
      schema: 'verify-run-record.v1',
      status: 'aborted',
      key: run.identity.key,
      identity: run.identity,
      pid: process.pid,
      startedAt: existingRecord.startedAt || null,
      abortedAt: new Date().toISOString(),
      abortReason: reason,
      stdoutPath: run.paths.stdoutPath,
      stderrPath: run.paths.stderrPath,
    });
  } finally {
    closeRunLock(run);
  }
}

module.exports = {
  abortVerifyRun,
  beginVerifyRun,
  finishVerifyRun,
  getVerifyRunDir,
  makeVerifyRunIdentity,
  readCompletedResult,
  pathsForIdentity,
  sha256,
};
