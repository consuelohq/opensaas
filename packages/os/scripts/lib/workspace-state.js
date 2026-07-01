const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { getTaskMetaBranchMismatch } = require('./task-meta');

const DEFAULT_SERVICE = 'opensaas';
const WORKSPACE_SCRIPTS_DIR = path.join('packages', 'workspace', 'scripts');

function writeLine(value = '') {
  process.stdout.write(`${value}\n`);
}

function writeError(value = '') {
  process.stderr.write(`${value}\n`);
}

function runCommand(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    timeout: options.timeout || 10000,
    env: options.env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    ok: result.status === 0 && !result.error,
    status: result.status,
    signal: result.signal,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error ? result.error.message : null,
  };
}

function commandExists(command) {
  const result = runCommand('which', [command], { timeout: 5000 });
  return {
    ok: result.ok,
    path: result.stdout || null,
    message: result.ok ? result.stdout : result.stderr || result.error || 'not found',
  };
}

function git(cwd, args, options = {}) {
  return runCommand('git', args, { cwd, timeout: options.timeout || 10000 });
}

function gitOutput(cwd, args, options = {}) {
  const result = git(cwd, args, options);
  return result.ok ? result.stdout : null;
}

function getRepoRoot(cwd = process.cwd()) {
  return gitOutput(cwd, ['rev-parse', '--show-toplevel']);
}

function getCurrentBranch(cwd = process.cwd()) {
  return gitOutput(cwd, ['branch', '--show-current']) || '';
}

function refExists(cwd, ref) {
  return git(cwd, ['rev-parse', '--verify', ref], { timeout: 5000 }).ok;
}

function fetchOrigin(cwd) {
  return git(cwd, ['fetch', 'origin', '--prune'], { timeout: 30000 });
}

function getAheadBehind(cwd, leftRef, rightRef) {
  if (!leftRef || !rightRef) return null;
  if (!refExists(cwd, leftRef) || !refExists(cwd, rightRef)) return null;

  const output = gitOutput(cwd, ['rev-list', '--left-right', '--count', `${leftRef}...${rightRef}`], { timeout: 10000 });
  if (!output) return null;

  const [aheadRaw, behindRaw] = output.split(/\s+/);
  return {
    ahead: Number.parseInt(aheadRaw, 10) || 0,
    behind: Number.parseInt(behindRaw, 10) || 0,
    left: leftRef,
    right: rightRef,
  };
}

function getChangedFiles(cwd = process.cwd()) {
  const result = git(cwd, ['status', '--porcelain', '-uall'], { timeout: 10000 });
  if (!result.ok || !result.stdout) return [];

  return result.stdout.split('\n').filter(Boolean).map((line) => {
    if (line.length >= 3 && line[2] === ' ') {
      const status = line.slice(0, 2).trim() || 'modified';
      const filePath = line.slice(3);
      return { status, path: filePath };
    }

    const separatorIndex = line.indexOf(' ');
    const statusText = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const filePath = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
    return { status: statusText.trim() || 'modified', path: filePath };
  });
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readPackageJson(repoRoot) {
  return readJsonFile(path.join(repoRoot, 'package.json')) || {};
}

function getPackageScripts(repoRoot) {
  const packageJson = readPackageJson(repoRoot);
  return packageJson.scripts || {};
}

function getWorkspaceScriptMappings(repoRoot) {
  const scripts = getPackageScripts(repoRoot);
  const mappings = [];

  for (const [name, command] of Object.entries(scripts)) {
    const match = String(command).match(/(?:^|\s)bun\s+packages\/workspace\/scripts\/([^\s]+)/);
    if (!match) continue;

    mappings.push({
      name,
      command,
      file: match[1],
      path: path.join(WORKSPACE_SCRIPTS_DIR, match[1]),
      exists: fs.existsSync(path.join(repoRoot, WORKSPACE_SCRIPTS_DIR, match[1])),
    });
  }

  return mappings.sort((a, b) => a.name.localeCompare(b.name));
}

function listWorkspaceScriptFiles(repoRoot) {
  const baseDir = path.join(repoRoot, WORKSPACE_SCRIPTS_DIR);
  const files = [];

  function walk(relativeDir) {
    const absoluteDir = path.join(baseDir, relativeDir);
    if (!fs.existsSync(absoluteDir)) return;

    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name);
      const absolutePath = path.join(baseDir, relativePath);

      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }

      files.push({
        file: relativePath.split(path.sep).join('/'),
        path: path.join(WORKSPACE_SCRIPTS_DIR, relativePath).split(path.sep).join('/'),
        executable: /\.(js|sh|py)$/.test(entry.name),
        bytes: fs.statSync(absolutePath).size,
      });
    }
  }

  walk('');
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

function findTaskMetaRecord(startDirectory = process.cwd(), options = {}) {
  let directory = path.resolve(startDirectory);

  while (true) {
    const currentPath = path.join(directory, '.task', 'current.json');
    if (fs.existsSync(currentPath)) {
      const data = readJsonFile(currentPath);
      const mismatch = getTaskMetaBranchMismatch(data, options.currentBranch);
      const record = { path: currentPath, dir: directory, data, stale: Boolean(mismatch), mismatch };
      if (mismatch && !options.includeStale) return null;
      return record;
    }

    const legacyPath = path.join(directory, '.task-meta.json');
    if (fs.existsSync(legacyPath)) {
      const data = readJsonFile(legacyPath);
      const mismatch = getTaskMetaBranchMismatch(data, options.currentBranch);
      const record = { path: legacyPath, dir: directory, data, stale: Boolean(mismatch), mismatch };
      if (mismatch && !options.includeStale) return null;
      return record;
    }

    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  return null;
}

function parseTaskBranch(branch) {
  if (!branch || !branch.startsWith('task/')) return null;
  const rest = branch.slice('task/'.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) return { area: rest, slug: '' };
  return { area: rest.slice(0, slashIndex), slug: rest.slice(slashIndex + 1) };
}

function parseStreamBranch(branch) {
  if (!branch || !branch.startsWith('stream/')) return null;
  return { area: branch.slice('stream/'.length) };
}

function getStreamFromContext({ branch, taskMeta }) {
  if (taskMeta?.data?.stream) return taskMeta.data.stream;
  if (taskMeta?.data?.baseBranch?.startsWith('stream/')) return taskMeta.data.baseBranch;
  if (branch?.startsWith('stream/')) return branch;

  const parsedTask = parseTaskBranch(branch || taskMeta?.data?.taskBranch);
  if (parsedTask?.area) return `stream/${parsedTask.area}`;

  return null;
}

function getRemoteBranchName(branch) {
  return branch ? `origin/${branch}` : null;
}

function getLatestRailwayDeploy(service = DEFAULT_SERVICE, cwd = process.cwd()) {
  const result = runCommand('railway', ['deployment', 'list', '--service', service, '--json'], {
    cwd,
    timeout: 15000,
  });

  if (!result.ok) {
    return {
      ok: false,
      service,
      status: 'unavailable',
      error: result.stderr || result.error || result.stdout || 'railway deployment list failed',
    };
  }

  try {
    const deploys = JSON.parse(result.stdout);
    const latest = Array.isArray(deploys) ? deploys[0] : null;
    if (!latest) return { ok: true, service, status: 'none', latest: null };

    return {
      ok: true,
      service,
      status: latest.status || 'unknown',
      latest: {
        id: latest.id || null,
        status: latest.status || null,
        commit: latest.meta?.commitHash || null,
        message: latest.meta?.commitMessage ? latest.meta.commitMessage.split('\n')[0] : null,
        branch: latest.meta?.branch || null,
        author: latest.meta?.commitAuthor || null,
        createdAt: latest.createdAt || null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      service,
      status: 'parse-error',
      error: err instanceof Error ? err.message : 'failed to parse railway json',
    };
  }
}

function getWorkspaceServerHealth(timeout = 2500) {
  return new Promise((resolve) => {
    const request = http.get('http://localhost:8850/health', { timeout }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, statusCode: response.statusCode, body: parsed });
        } catch {
          resolve({ ok: false, statusCode: response.statusCode, body });
        }
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ ok: false, statusCode: null, error: 'timeout' });
    });

    request.on('error', (err) => {
      resolve({ ok: false, statusCode: null, error: err.message });
    });
  });
}

function findRecentStamp(repoRoot, cwd = process.cwd()) {
  const candidateDirectories = [
    path.join(cwd, '.task'),
    path.join(repoRoot, '.task'),
  ];

  const candidateNames = [
    'verify.json',
    'verification.json',
    'verify-stamp.json',
    'review.json',
    'review-stamp.json',
    'last-review.json',
  ];

  for (const directory of candidateDirectories) {
    for (const name of candidateNames) {
      const filePath = path.join(directory, name);
      if (!fs.existsSync(filePath)) continue;

      const parsed = readJsonFile(filePath);
      return {
        path: path.relative(repoRoot, filePath).split(path.sep).join('/'),
        data: parsed || fs.readFileSync(filePath, 'utf8').slice(0, 1000),
      };
    }
  }

  return null;
}

function formatAge(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;

  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

module.exports = {
  DEFAULT_SERVICE,
  WORKSPACE_SCRIPTS_DIR,
  commandExists,
  fetchOrigin,
  findRecentStamp,
  findTaskMetaRecord,
  formatAge,
  getAheadBehind,
  getChangedFiles,
  getCurrentBranch,
  getLatestRailwayDeploy,
  getPackageScripts,
  getRemoteBranchName,
  getRepoRoot,
  getStreamFromContext,
  getWorkspaceScriptMappings,
  getWorkspaceServerHealth,
  git,
  gitOutput,
  listWorkspaceScriptFiles,
  parseStreamBranch,
  parseTaskBranch,
  readJsonFile,
  readPackageJson,
  refExists,
  runCommand,
  writeError,
  writeLine,
};
