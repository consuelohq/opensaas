const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_LOCK_STALE_MS = 30 * 60 * 1000;
const DEFAULT_LAUNCH_GRACE_MS = 15 * 1000;

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
    committedOnlyTests: Boolean(args.committedOnlyTests),
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

function selectVerifyBase({ explicitBase, branch, taskMeta, hasRef }) {
  if (explicitBase) return explicitBase;
  const candidates = [];
  const remote = (candidate) => candidate.startsWith('origin/') ? candidate : 'origin/' + candidate;
  // The task's own remote branch is not a comparison baseline: selecting it
  // conceals its changes and can give a false zero-suite result.
  if (taskMeta?.baseBranch) candidates.push(remote(taskMeta.baseBranch), taskMeta.baseBranch);
  if (taskMeta?.stream) candidates.push(remote(taskMeta.stream), taskMeta.stream);
  const task = branch?.match(/^task\/([^/]+)\//);
  if (task) candidates.push('origin/stream/' + task[1], 'stream/' + task[1]);
  candidates.push('origin/main', 'main');
  for (const candidate of candidates) {
    if (hasRef(candidate)) return candidate;
  }
  return 'origin/main';
}

function pathsForIdentity(repoRoot, identity) {
  const dir = path.join(getVerifyRunDir(repoRoot), identity.key);
  return {
    dir,
    lockPath: path.join(dir, 'run.lock'),
    recordPath: path.join(dir, 'record.json'),
    stdoutPath: path.join(dir, 'stdout.txt'),
    stderrPath: path.join(dir, 'stderr.txt'),
    workerStdoutPath: path.join(dir, 'worker.stdout.log'),
    workerStderrPath: path.join(dir, 'worker.stderr.log'),
  };
}

function readCompletedResult(paths) {
  const record = readJson(paths.recordPath);
  if (!record || record.status !== 'completed') return null;
  const exitCode = Number.isInteger(record.exitCode) ? record.exitCode : 1;
  // Do not silently restart an expensive failed gate after a short TTL.
  // An unchanged run identity replays its failure until an explicit --retry.
  if (!fs.existsSync(paths.stdoutPath) || !fs.existsSync(paths.stderrPath)) return null;

  return {
    record,
    stdout: fs.readFileSync(paths.stdoutPath, 'utf8'),
    stderr: fs.readFileSync(paths.stderrPath, 'utf8'),
    exitCode,
  };
}

function readVerifyRunStatus(repoRoot, runKey) {
  if (typeof runKey !== 'string' || !/^[a-f0-9]{64}$/.test(runKey)) {
    throw new Error('verify run key must be a 64-character lowercase SHA-256 hex digest');
  }
  const paths = pathsForIdentity(repoRoot, { key: runKey });
  const record = readJson(paths.recordPath);
  if (!record || record.key !== runKey) {
    return { state: 'not_found', pending: false, runKey };
  }

  const context = {
    runKey,
    startedAt: record.startedAt || null,
    phase: record.phase || record.status,
    completedAt: record.completedAt || record.abortedAt || record.orphanedAt || null,
    branch: record.identity?.branch || null,
    base: record.identity?.base || null,
    headSha: record.identity?.headSha || null,
    baseSha: record.identity?.baseSha || null,
    changeHash: record.identity?.changeHash || null,
    workerPid: record.workerPid ?? null,
  };

  if (record.status === 'completed') {
    const exitCode = Number.isInteger(record.exitCode) ? record.exitCode : 1;
    let summary = null;
    try {
      // The detached verifier writes its JSON result only when complete.
      // A corrupted or unexpectedly large file must not break status queries.
      if (fs.statSync(paths.stdoutPath).size <= 8 * 1024 * 1024) {
        const parsed = JSON.parse(fs.readFileSync(paths.stdoutPath, 'utf8'));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) summary = parsed;
      }
    } catch { /* no valid terminal summary available */ }
    const passed = exitCode === 0 && summary?.passed === true;
    const publishValid = passed && summary?.publishValid === true;
    return {
      ...context,
      state: passed ? 'passed' : 'failed',
      pending: false,
      passed,
      publishValid,
      exitCode,
      summary,
    };
  }
  if (record.status === 'aborted' || record.status === 'orphaned') {
    return {
      ...context,
      state: record.status,
      pending: false,
      reason: record.abortReason || record.orphanReason || 'verify did not finish',
    };
  }
  if (record.status === 'launching' || record.status === 'running') {
    const pid = Number.isInteger(record.workerPid)
      ? record.workerPid
      : Number.isInteger(record.pid) ? record.pid : null;
    const active = (pid && isPidRunning(pid)) || (record.status === 'launching' && isFreshLaunch(record));
    if (active) {
      return {
        ...context,
        state: record.status,
        pending: true,
        elapsedSeconds: Number.isFinite(Date.parse(record.startedAt))
          ? Math.max(0, Math.floor((Date.now() - Date.parse(record.startedAt)) / 1000))
          : null,
      };
    }
    return { ...context, state: 'orphaned', pending: false, reason: 'verify worker exited before producing a completed result' };
  }
  return { ...context, state: 'unavailable', pending: false, reason: 'unknown verify state' };
}

async function waitForVerifyRun(repoRoot, runKey, options = {}) {
  // One bounded read-only long-poll replaces repeated mutating verify requests.
  const waitMs = Math.min(90_000, Math.max(0, Number(options.waitMs ?? 60_000) || 0));
  const intervalMs = Math.min(5_000, Math.max(25, Number(options.intervalMs ?? 1_000) || 1_000));
  const deadline = Date.now() + waitMs;
  let status = readVerifyRunStatus(repoRoot, runKey);
  while (status.pending === true && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())));
    status = readVerifyRunStatus(repoRoot, runKey);
  }
  return status;
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

function isFreshLaunch(record) {
  const startedAt = Date.parse(record?.startedAt || '');
  return Number.isFinite(startedAt)
    && Date.now() - startedAt < DEFAULT_LAUNCH_GRACE_MS;
}

function readPendingRecord(paths) {
  const record = readActiveRecord(paths);
  if (!record) {
    if (!lockExists(paths)) return null;
    if (isLockStale(paths)) {
      removeLock(paths);
      return null;
    }
    return {
      status: 'launching',
      pid: null,
      workerPid: null,
      startedAt: null,
    };
  }

  if (!['launching', 'running'].includes(record.status)) {
    removeLock(paths);
    return null;
  }

  const workerPid = Number.isInteger(record.workerPid)
    ? record.workerPid
    : Number.isInteger(record.pid)
      ? record.pid
      : null;
  if ((workerPid && isPidRunning(workerPid)) || (record.status === 'launching' && isFreshLaunch(record))) {
    return record;
  }

  markOrphaned(paths, record, 'verify worker is no longer running');
  return null;
}

function beginVerifyRun(repoRoot, identity, options = {}) {
  const paths = pathsForIdentity(repoRoot, identity);
  ensureDir(paths.dir);

  const completed = readCompletedResult(paths);
  if (completed && (!options.retry || completed.exitCode === 0)) {
    return { mode: 'replay', paths, identity, result: completed };
  }

  if (
    options.adoptReservedKey
    && options.adoptReservedKey === identity.key
    && lockExists(paths)
  ) {
    const reserved = readActiveRecord(paths);
    if (reserved?.status === 'launching' && reserved.key === identity.key) {
      const runningRecord = {
        ...reserved,
        status: 'running',
        pid: process.pid,
        workerPid: process.pid,
        workerStartedAt: new Date().toISOString(),
      };
      writeJsonAtomic(paths.recordPath, runningRecord);
      return {
        mode: 'run',
        paths,
        identity,
        lockFd: null,
        record: runningRecord,
      };
    }
  }

  while (true) {
    const replay = readCompletedResult(paths);
    if (replay && (!options.retry || replay.exitCode === 0)) {
      return { mode: 'replay', paths, identity, result: replay };
    }
    if (lockExists(paths)) {
      const pendingRecord = readPendingRecord(paths);
      if (pendingRecord) {
        return {
          mode: 'pending',
          paths,
          identity,
          record: pendingRecord,
        };
      }
    }

    try {
      const lockFd = fs.openSync(paths.lockPath, 'wx');
      const record = {
        schema: 'verify-run-record.v1',
        status: options.defer ? 'launching' : 'running',
        key: identity.key,
        identity,
        pid: options.defer ? null : process.pid,
        launcherPid: options.defer ? process.pid : null,
        workerPid: options.defer ? null : process.pid,
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
      if (options.defer) {
        fs.closeSync(lockFd);
        return {
          mode: 'launch',
          paths,
          identity,
          lockFd: null,
          record,
        };
      }
      return { mode: 'run', paths, identity, lockFd, record };
    } catch (error) {
      if (!error || error.code !== 'EEXIST') throw error;
      const pendingRecord = readPendingRecord(paths);
      if (pendingRecord) {
        return {
          mode: 'pending',
          paths,
          identity,
          record: pendingRecord,
        };
      }
    }
  }
}

function markVerifyRunLaunched(run, workerPid) {
  if (!run || run.mode !== 'launch') return;
  const record = readJson(run.paths.recordPath) || run.record || {};
  if (record.status === 'running' || record.status === 'completed') {
    return;
  }
  writeJsonAtomic(run.paths.recordPath, {
    ...record,
    status: 'launching',
    workerPid: Number.isInteger(workerPid) ? workerPid : null,
    launchedAt: new Date().toISOString(),
  });
}

function markVerifyRunPhase(run, phase) {
  if (!run || run.mode !== 'run' || !['review', 'tests', 'db', 'docs', 'finalizing'].includes(phase)) return false;
  const record = readJson(run.paths.recordPath);
  if (record?.key !== run.identity.key || record.status !== 'running') return false;
  writeJsonAtomic(run.paths.recordPath, { ...record, phase, phaseStartedAt: new Date().toISOString() });
  return true;
}

function closeRunLock(run) {
  if (Number.isInteger(run?.lockFd)) {
    try {
      fs.closeSync(run.lockFd);
    } catch {
      // best effort
    }
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
  if (!run || !['run', 'launch'].includes(run.mode)) return;

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
  markVerifyRunLaunched,
  markVerifyRunPhase,
  readCompletedResult,
  readVerifyRunStatus,
  waitForVerifyRun,
  selectVerifyBase,
  pathsForIdentity,
  sha256,
};
