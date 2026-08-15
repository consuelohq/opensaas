const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  branchExistsLocal,
  createWorktree,
  getRefSha,
  listWorktrees,
  refExists,
  removeWorktree,
  runGit,
  runGitMaybe,
} = require('./git');
const { getConsueloHome } = require('./paths');
const {
  deleteDurableTaskSessionMetadata,
  getDurableTaskSessionPath,
  readDurableTaskSessionMetadata,
  writeDurableTaskSessionMetadata,
} = require('./task-registry');

const RECOVERY_SCHEMA_VERSION = 1;

function resolveNow(now = Date.now) {
  const value = typeof now === 'function' ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid task recovery timestamp');
  return date;
}

function nowIso(now = Date.now) {
  return resolveNow(now).toISOString();
}

function getTaskInactivityAgeMs(metadata, now = Date.now()) {
  const value = typeof now === 'function' ? now() : now;
  const nowMs = value instanceof Date ? value.getTime() : Number(value);
  const timestamp = metadata?.lastActiveAt || metadata?.updatedAt || metadata?.createdAt;
  const activityMs = timestamp ? Date.parse(String(timestamp)) : Number.NaN;
  if (!Number.isFinite(nowMs) || !Number.isFinite(activityMs)) return 0;
  return Math.max(0, nowMs - activityMs);
}

function getTaskRecoveryRoot(taskSession, home = getConsueloHome()) {
  return path.join(path.resolve(home), 'node', 'tasks', 'archives', String(taskSession));
}

function assertTaskRecoveryPath(candidate, taskSession, home) {
  const root = path.resolve(getTaskRecoveryRoot(taskSession, home));
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`task recovery path escapes the task archive root: ${resolved}`);
  }
  return resolved;
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    try { fs.rmSync(temporaryPath, { force: true }); } catch {}
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveRepositoryRoot(worktreePath, metadata = {}) {
  if (metadata.repoRoot) {
    const repoRoot = path.resolve(metadata.repoRoot);
    if (!fs.existsSync(repoRoot)) throw new Error(`registered task repository is unavailable: ${repoRoot}`);
    return repoRoot;
  }
  const worktrees = listWorktrees(worktreePath);
  if (worktrees.length === 0 || !worktrees[0].path) {
    throw new Error(`unable to resolve repository root for task worktree ${worktreePath}`);
  }
  return path.resolve(worktrees[0].path);
}

function normalizeComparablePath(filePath) {
  const resolved = path.resolve(filePath);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function readStatus(worktreePath) {
  return runGit([
    '-c',
    'core.quotePath=false',
    'status',
    '--porcelain=v1',
    '-z',
    '-uall',
    '--',
    '.',
    ':!node_modules',
  ], { cwd: worktreePath });
}

function inspectTaskWorktreeState({ repoRoot, worktreePath, taskBranch }) {
  if (!fs.existsSync(worktreePath)) {
    throw new Error(`task worktree is unavailable: ${worktreePath}`);
  }
  const headSha = getRefSha(worktreePath, 'HEAD');
  const remoteRef = `refs/remotes/origin/${taskBranch}`;
  const remoteSha = runGitMaybe(['rev-parse', '--verify', remoteRef], { cwd: repoRoot });
  const status = readStatus(worktreePath);
  const localAheadCount = remoteSha
    ? Number.parseInt(runGit(['rev-list', '--count', `${remoteSha}..${headSha}`], { cwd: repoRoot }), 10) || 0
    : 1;
  return {
    headSha,
    remoteRef,
    remoteSha,
    dirty: Boolean(status),
    status,
    localAheadCount,
    needsRecovery: Boolean(status) || localAheadCount > 0 || !remoteSha,
  };
}

function buildWorktreeTree(worktreePath, headSha) {
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'consuelo-task-recovery-index-'));
  const indexPath = path.join(temporaryDir, 'index');
  const env = { GIT_INDEX_FILE: indexPath };
  try {
    runGit(['read-tree', headSha], { cwd: worktreePath, env });
    runGit(['add', '-A', '--', '.'], { cwd: worktreePath, env });
    const treeSha = runGit(['write-tree'], { cwd: worktreePath, env });
    return treeSha;
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

function createCheckpointCommit({ worktreePath, treeSha, headSha, taskSession, timestamp }) {
  return runGit(['commit-tree', treeSha, '-p', headSha, '-m', `Consuelo recovery checkpoint ${taskSession}`], {
    cwd: worktreePath,
    env: {
      GIT_AUTHOR_NAME: 'Consuelo Recovery',
      GIT_AUTHOR_EMAIL: 'recovery@consuelo.local',
      GIT_COMMITTER_NAME: 'Consuelo Recovery',
      GIT_COMMITTER_EMAIL: 'recovery@consuelo.local',
      GIT_AUTHOR_DATE: timestamp,
      GIT_COMMITTER_DATE: timestamp,
    },
  });
}

function createVerifiedTaskRecoveryArchive(input) {
  const taskSession = String(input.taskSession || '').trim();
  const taskBranch = String(input.taskBranch || '').trim();
  const worktreePath = path.resolve(input.worktreePath);
  const repoRoot = path.resolve(input.repoRoot || resolveRepositoryRoot(worktreePath));
  const home = input.home || getConsueloHome();
  const timestamp = nowIso(input.now);
  const stateBefore = inspectTaskWorktreeState({ repoRoot, worktreePath, taskBranch });
  const treeSha = buildWorktreeTree(worktreePath, stateBefore.headSha);
  const checkpointSha = createCheckpointCommit({
    worktreePath,
    treeSha,
    headSha: stateBefore.headSha,
    taskSession,
    timestamp,
  });
  const suffix = `${timestamp.replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  const archiveDir = path.join(getTaskRecoveryRoot(taskSession, home), suffix);
  const bundlePath = path.join(archiveDir, 'recovery.bundle');
  const manifestPath = path.join(archiveDir, 'manifest.json');
  const exportedRef = `refs/consuelo/recovery/${taskSession}/${suffix}`;
  const temporaryBundlePath = `${bundlePath}.tmp-${process.pid}`;

  fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  runGit(['update-ref', exportedRef, checkpointSha], { cwd: repoRoot });
  try {
    const bundleArgs = ['bundle', 'create', temporaryBundlePath, exportedRef];
    if (stateBefore.remoteSha) bundleArgs.push(`^${stateBefore.remoteSha}`);
    runGit(bundleArgs, { cwd: repoRoot });
    runGit(['bundle', 'verify', temporaryBundlePath], { cwd: repoRoot });

    const headAfter = getRefSha(worktreePath, 'HEAD');
    const treeAfter = buildWorktreeTree(worktreePath, headAfter);
    if (headAfter !== stateBefore.headSha || treeAfter !== treeSha) {
      throw new Error('task worktree changed while the recovery archive was being created');
    }

    fs.renameSync(temporaryBundlePath, bundlePath);
    const bundleSha256 = sha256File(bundlePath);
    const manifest = {
      schemaVersion: RECOVERY_SCHEMA_VERSION,
      taskSession,
      taskBranch,
      repoRoot,
      worktreePath,
      createdAt: timestamp,
      headSha: stateBefore.headSha,
      anchorSha: stateBefore.remoteSha || null,
      checkpointSha,
      treeSha,
      exportedRef,
      bundlePath,
      bundleSha256,
      manifestPath,
      dirty: stateBefore.dirty,
      localAheadCount: stateBefore.localAheadCount,
    };
    atomicWriteJson(manifestPath, manifest);
    return manifest;
  } catch (error) {
    try { fs.rmSync(temporaryBundlePath, { force: true }); } catch {}
    try { fs.rmSync(archiveDir, { recursive: true, force: true }); } catch {}
    throw error;
  } finally {
    try { runGit(['update-ref', '-d', exportedRef], { cwd: repoRoot }); } catch {}
  }
}

function readRecoveryManifest(metadata, options = {}) {
  if (!metadata?.recovery) return null;
  const recovery = metadata.recovery;
  const home = options.home || getConsueloHome();
  const manifestPath = assertTaskRecoveryPath(recovery.manifestPath, metadata.taskSession, home);
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (
    parsed.schemaVersion !== RECOVERY_SCHEMA_VERSION
    || parsed.taskSession !== metadata.taskSession
    || parsed.taskBranch !== metadata.taskBranch
  ) {
    throw new Error(`task recovery manifest identity mismatch: ${manifestPath}`);
  }
  parsed.bundlePath = assertTaskRecoveryPath(parsed.bundlePath, metadata.taskSession, home);
  if (!parsed.bundleSha256 || sha256File(parsed.bundlePath) !== parsed.bundleSha256) {
    throw new Error(`task recovery bundle digest mismatch: ${parsed.bundlePath}`);
  }
  return parsed;
}

function defaultTerminateTmux(metadata) {
  const { terminateTaskTmuxSession } = require('./task-session');
  return terminateTaskTmuxSession(metadata, {
    branch: metadata.taskBranch,
    worktreePath: metadata.worktreePath,
  });
}

function assertSafeTmuxCleanup(result) {
  if (!result) return;
  if (result.status === 'terminate-failed' || result.status === 'inspect-failed') {
    throw new Error(`task tmux cleanup failed: ${result.status}`);
  }
}

function evictDurableTaskWorktree(input) {
  const home = input.home || getConsueloHome();
  const metadata = readDurableTaskSessionMetadata(input.taskSession, { home });
  if (!metadata) throw new Error(`durable task session not found: ${input.taskSession}`);
  const worktreePath = path.resolve(metadata.worktreePath);
  if (metadata.status === 'evicted' && !fs.existsSync(worktreePath)) return metadata;
  if (!fs.existsSync(worktreePath)) throw new Error(`task worktree is unavailable: ${worktreePath}`);

  const repoRoot = resolveRepositoryRoot(worktreePath, metadata);
  const comparableWorktreePath = normalizeComparablePath(worktreePath);
  const registered = listWorktrees(repoRoot).some((entry) =>
    entry.branch === metadata.taskBranch && normalizeComparablePath(entry.path) === comparableWorktreePath);
  if (!registered) throw new Error(`task worktree is not registered for ${metadata.taskBranch}`);

  let recovery = metadata.recovery || null;
  let evicting = writeDurableTaskSessionMetadata({
    ...metadata,
    repoRoot,
    status: 'evicting',
    recovery,
  }, { home, now: input.now });

  const createRecoveryArchive = input.createRecoveryArchive || createVerifiedTaskRecoveryArchive;
  try {
    let state = inspectTaskWorktreeState({ repoRoot, worktreePath, taskBranch: metadata.taskBranch });
    if (state.needsRecovery) {
      recovery = createRecoveryArchive({
        taskSession: metadata.taskSession,
        taskBranch: metadata.taskBranch,
        worktreePath,
        repoRoot,
        home,
        now: input.now,
      });
    } else {
      state = inspectTaskWorktreeState({ repoRoot, worktreePath, taskBranch: metadata.taskBranch });
      if (state.needsRecovery) {
        recovery = createRecoveryArchive({
          taskSession: metadata.taskSession,
          taskBranch: metadata.taskBranch,
          worktreePath,
          repoRoot,
          home,
          now: input.now,
        });
      }
    }
    evicting = writeDurableTaskSessionMetadata({ ...evicting, recovery }, { home, now: input.now });
    const terminateTmux = input.terminateTmux || defaultTerminateTmux;
    const tmux = terminateTmux(evicting);
    assertSafeTmuxCleanup(tmux);
    removeWorktree(repoRoot, worktreePath);
    const evictedAt = nowIso(input.now);
    return writeDurableTaskSessionMetadata({
      ...evicting,
      status: 'evicted',
      evictedAt,
      recovery,
    }, { home, now: input.now });
  } catch (error) {
    writeDurableTaskSessionMetadata({
      ...evicting,
      status: 'active',
      recovery,
    }, { home, now: input.now });
    throw error;
  }
}

function importRecoveryBundle(repoRoot, manifest, taskSession) {
  const importRef = `refs/consuelo/recovery-import/${taskSession}`;
  try { runGit(['update-ref', '-d', importRef], { cwd: repoRoot }); } catch {}
  runGit(['bundle', 'verify', manifest.bundlePath], { cwd: repoRoot });
  runGit(['fetch', manifest.bundlePath, `${manifest.exportedRef}:${importRef}`], { cwd: repoRoot });
  const importedSha = getRefSha(repoRoot, importRef);
  if (importedSha !== manifest.checkpointSha) {
    try { runGit(['update-ref', '-d', importRef], { cwd: repoRoot }); } catch {}
    throw new Error('task recovery bundle checkpoint does not match its manifest');
  }
  return importRef;
}

function applyRecoveryCheckpoint(worktreePath, manifest) {
  const patch = childProcess.execFileSync('git', [
    'diff',
    '--binary',
    '--full-index',
    manifest.headSha,
    manifest.checkpointSha,
  ], {
    cwd: worktreePath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (patch) {
    childProcess.execFileSync('git', ['apply', '--whitespace=nowarn', '-'], {
      cwd: worktreePath,
      encoding: 'utf8',
      input: patch,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }
  const restoredTree = buildWorktreeTree(worktreePath, manifest.headSha);
  if (restoredTree !== manifest.treeSha) {
    throw new Error('restored task worktree does not match the verified recovery checkpoint');
  }
}

function removeRecoveryArchiveFiles(metadata, options = {}) {
  const recovery = metadata?.recovery;
  if (!recovery?.manifestPath) return;
  const home = options.home || getConsueloHome();
  const manifestPath = assertTaskRecoveryPath(recovery.manifestPath, metadata.taskSession, home);
  const archiveDir = path.dirname(manifestPath);
  assertTaskRecoveryPath(archiveDir, metadata.taskSession, home);
  fs.rmSync(archiveDir, { recursive: true, force: true });
  const sessionRoot = getTaskRecoveryRoot(metadata.taskSession, home);
  try {
    if (fs.existsSync(sessionRoot) && fs.readdirSync(sessionRoot).length === 0) fs.rmdirSync(sessionRoot);
  } catch {}
}

function removeTaskRecoveryRoot(taskSession, home = getConsueloHome()) {
  const root = getTaskRecoveryRoot(taskSession, home);
  fs.rmSync(root, { recursive: true, force: true });
}

function restoreEvictedTaskWorktree(taskSession, options = {}) {
  const home = options.home || getConsueloHome();
  const metadata = readDurableTaskSessionMetadata(taskSession, { home });
  if (!metadata) throw new Error(`durable task session not found: ${taskSession}`);
  const worktreePath = path.resolve(metadata.worktreePath);
  if (metadata.status === 'evicting' && fs.existsSync(worktreePath)) {
    throw new Error(`task eviction is in progress: ${taskSession}`);
  }
  if (fs.existsSync(worktreePath) && metadata.status !== 'evicted' && metadata.status !== 'evicting') {
    return metadata;
  }
  const repoRoot = metadata.repoRoot ? path.resolve(metadata.repoRoot) : null;
  if (!repoRoot || !fs.existsSync(repoRoot)) {
    throw new Error(`registered task repository is unavailable: ${repoRoot || '(missing)'}`);
  }
  const recovery = readRecoveryManifest(metadata, { home });
  let importRef = null;
  let createdWorktree = false;
  try {
    if (recovery) importRef = importRecoveryBundle(repoRoot, recovery, taskSession);

    if (branchExistsLocal(repoRoot, metadata.taskBranch)) {
      if (recovery) {
        const localHead = getRefSha(repoRoot, `refs/heads/${metadata.taskBranch}`);
        if (localHead !== recovery.headSha) {
          throw new Error(`task branch changed after eviction: ${metadata.taskBranch}`);
        }
      }
    } else if (recovery) {
      runGit(['branch', metadata.taskBranch, recovery.headSha], { cwd: repoRoot });
    } else {
      const remoteRef = `refs/remotes/origin/${metadata.taskBranch}`;
      if (!refExists(repoRoot, remoteRef)) throw new Error(`remote task branch is unavailable: ${metadata.taskBranch}`);
      runGit(['branch', metadata.taskBranch, remoteRef], { cwd: repoRoot });
    }

    const existing = listWorktrees(repoRoot).find((entry) => entry.branch === metadata.taskBranch);
    if (existing && normalizeComparablePath(existing.path) !== normalizeComparablePath(worktreePath)) {
      throw new Error(`task branch is already checked out at ${existing.path}`);
    }
    if (!existing) {
      fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
      createWorktree(repoRoot, worktreePath, metadata.taskBranch);
      createdWorktree = true;
    }

    if (recovery) applyRecoveryCheckpoint(worktreePath, recovery);

    const restoredAt = nowIso(options.now);
    const restored = writeDurableTaskSessionMetadata({
      ...metadata,
      repoRoot,
      status: 'active',
      recovery: null,
      evictedAt: null,
      lastActiveAt: restoredAt,
    }, { home, now: options.now });
    if (recovery) removeTaskRecoveryRoot(taskSession, home);
    return restored;
  } catch (error) {
    if (createdWorktree) {
      try { removeWorktree(repoRoot, worktreePath); } catch {}
    }
    throw error;
  } finally {
    if (importRef) {
      try { runGit(['update-ref', '-d', importRef], { cwd: repoRoot }); } catch {}
    }
  }
}

function removeDurableTaskRecoveryState(taskSession, options = {}) {
  const home = options.home || getConsueloHome();
  removeTaskRecoveryRoot(taskSession, home);
  deleteDurableTaskSessionMetadata(taskSession, { home });
  return getDurableTaskSessionPath(taskSession, home);
}

module.exports = {
  createVerifiedTaskRecoveryArchive,
  evictDurableTaskWorktree,
  getTaskInactivityAgeMs,
  getTaskRecoveryRoot,
  inspectTaskWorktreeState,
  removeDurableTaskRecoveryState,
  restoreEvictedTaskWorktree,
};
