#!/usr/bin/env bun

const fs = require('fs');
const path = require('path');

const { getToken } = require('./lib/github');
const {
  commandExists,
  fetchOrigin,
  findTaskMetaRecord,
  getAheadBehind,
  getCurrentBranch,
  getRemoteBranchName,
  getRepoRoot,
  getStreamFromContext,
  getWorkspaceServerHealth,
  parseTaskBranch,
  runCommand,
  writeError,
  writeLine,
} = require('./lib/workspace-state');

function printHelp() {
  [
    'usage: bun run doctor -- [options]',
    '',
    'checks workspace harness health from the main repo or a task worktree.',
    '',
    'options:',
    '  --json      output json',
    '  --help      show this help',
  ].forEach(writeLine);
}

function parseArgs(argv) {
  const args = { json: false, help: false };

  for (const raw of argv) {
    switch (raw) {
      case '--json':
        args.json = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`unknown flag: ${raw}`);
    }
  }

  return args;
}

function makeCheck(checks, name, status, summary, details = {}) {
  checks.push({ name, status, summary, details });
}

function commandSummary(command) {
  const result = commandExists(command);
  return {
    status: result.ok ? 'ok' : 'warn',
    summary: result.ok ? `${command} found` : `${command} not found`,
    details: result,
  };
}

function checkNodeModules(repoRoot) {
  const nodeModulesPath = path.join(repoRoot, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    return {
      status: 'warn',
      summary: 'node_modules missing',
      details: { path: nodeModulesPath },
    };
  }

  const stat = fs.lstatSync(nodeModulesPath);
  return {
    status: 'ok',
    summary: stat.isSymbolicLink() ? 'node_modules symlink present' : 'node_modules present',
    details: {
      path: nodeModulesPath,
      symlink: stat.isSymbolicLink(),
      target: stat.isSymbolicLink() ? fs.readlinkSync(nodeModulesPath) : null,
    },
  };
}

function checkGitHubAuth() {
  try {
    const token = getToken();
    return {
      status: 'ok',
      summary: 'github auth available',
      details: { source: 'env, .env, or gh auth', credentialLength: token.length },
    };
  } catch (err) {
    return {
      status: 'warn',
      summary: 'github auth unavailable',
      details: { error: err instanceof Error ? err.message : 'unknown error' },
    };
  }
}

function checkRailway(repoRoot) {
  const cli = commandExists('railway');

  if (!cli.ok) {
    return {
      status: 'warn',
      summary: 'railway cli not found',
      details: cli,
    };
  }

  const status = runCommand('railway', ['status', '--service', 'opensaas'], {
    cwd: repoRoot,
    timeout: 12000,
  });

  return {
    status: status.ok ? 'ok' : 'warn',
    summary: status.ok ? 'railway status available' : 'railway status unavailable',
    details: {
      cli: cli.path,
      stdout: status.stdout.slice(0, 1000),
      stderr: status.stderr.slice(0, 1000),
      error: status.error,
    },
  };
}

function checkAgentBrowser() {
  let binary = 'agent-browser';
  try {
    let home = path.resolve(process.env.CONSUELO_HOME || process.env.CONSUELO_OS_HOME || path.join(process.env.HOME || require('os').homedir(), '.consuelo'));
    if (path.basename(home) === 'os' && path.basename(path.dirname(home)) === '.consuelo') home = path.dirname(home);
    const root = path.join(home, 'managed', 'agent-browser');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'active.json'), 'utf8'));
    if (manifest.schemaVersion === 1 && manifest.browserReady === true &&
      typeof manifest.version === 'string' && /^\d+\.\d+\.\d+$/.test(manifest.version)) {
      const candidate = path.join(root, manifest.version, process.platform === 'win32' ? 'agent-browser.exe' : 'agent-browser');
      if (fs.existsSync(candidate)) binary = candidate;
    }
  } catch {
    // An absent or incomplete managed install falls back to PATH.
  }
  const cli = binary === 'agent-browser' ? commandExists('agent-browser') : { ok: true, path: binary };

  if (!cli.ok) {
    return {
      status: 'warn',
      summary: 'agent-browser not found',
      details: cli,
    };
  }

  const version = runCommand(binary, ['--version'], { timeout: 5000 });
  const parsed = (version.stdout + '\n' + version.stderr).match(/agent-browser\s+(\d+\.\d+\.\d+)/);
  const current = parsed?.[1];
  const numbers = current?.split('.').map(Number) ?? [];
  const compatible = numbers.length === 3 &&
    (numbers[0] > 0 || (numbers[0] === 0 && numbers[1] >= 40));
  return {
    status: version.ok && compatible ? 'ok' : 'warn',
    summary: version.ok
      ? 'agent-browser ' + (current ?? 'unknown') + (compatible ? ' compatible' : ' upgrade recommended (>=0.40.0)')
      : 'agent-browser version check failed',
    details: { path: cli.path, version: current, minimum: '0.40.0' },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const checks = [];
  const cwd = process.cwd();
  const repoRoot = getRepoRoot(cwd);

  if (!repoRoot) {
    const result = {
      ok: false,
      cwd,
      checks: [{
        name: 'repo',
        status: 'fail',
        summary: 'not inside a git repository',
        details: {},
      }],
    };

    if (args.json) {
      writeLine(JSON.stringify(result, null, 2));
    } else {
      writeLine('doctor: failed');
      writeLine('x repo: not inside a git repository');
    }

    process.exit(1);
  }

  makeCheck(checks, 'repo', 'ok', 'git repository detected', { cwd, repoRoot });

  const currentBranch = getCurrentBranch(cwd);
  makeCheck(checks, 'branch', currentBranch ? 'ok' : 'warn', currentBranch ? `current branch: ${currentBranch}` : 'unable to determine branch', { currentBranch });

  const taskMeta = findTaskMetaRecord(cwd, { currentBranch, includeStale: true });
  if (taskMeta?.data) {
    makeCheck(checks, 'task metadata', taskMeta.stale ? 'warn' : 'ok', taskMeta.stale ? 'stale .task/current.json found and ignored for active task selection' : '.task/current.json found', {
      path: path.relative(repoRoot, taskMeta.path).split(path.sep).join('/'),
      area: taskMeta.data.area || null,
      taskBranch: taskMeta.data.taskBranch || null,
      stream: taskMeta.data.stream || taskMeta.data.baseBranch || null,
      stale: Boolean(taskMeta.stale),
    });

    const expectedBranch = taskMeta.data.taskBranch;
    makeCheck(
      checks,
      'metadata branch',
      taskMeta.mismatch ? 'warn' : 'ok',
      taskMeta.mismatch
        ? `metadata branch mismatch: expected ${taskMeta.mismatch.expectedBranch}, got ${taskMeta.mismatch.currentBranch}`
        : 'branch matches task metadata',
      { expectedBranch, currentBranch, mismatch: taskMeta.mismatch || null },
    );
  } else {
    const isTaskBranch = Boolean(parseTaskBranch(currentBranch));
    makeCheck(
      checks,
      'task metadata',
      isTaskBranch ? 'warn' : 'ok',
      isTaskBranch ? 'task branch has no .task/current.json' : 'no task metadata expected in this context',
      { currentBranch },
    );
  }

  const fetchResult = fetchOrigin(repoRoot);
  makeCheck(
    checks,
    'origin fetch',
    fetchResult.ok ? 'ok' : 'warn',
    fetchResult.ok ? 'origin refs refreshed' : 'origin fetch failed',
    { stderr: fetchResult.stderr.slice(0, 1000), error: fetchResult.error },
  );

  const stream = getStreamFromContext({ branch: currentBranch, taskMeta });
  if (stream) {
    const localRemote = getAheadBehind(repoRoot, stream, getRemoteBranchName(stream));
    if (localRemote) {
      const synced = localRemote.ahead === 0 && localRemote.behind === 0;
      makeCheck(
        checks,
        'stream sync',
        synced ? 'ok' : 'warn',
        synced ? `${stream} synced with origin` : `${stream} is ${localRemote.ahead} ahead / ${localRemote.behind} behind origin`,
        localRemote,
      );
    } else {
      makeCheck(checks, 'stream sync', 'warn', `unable to compare ${stream} with origin`, { stream });
    }
  } else {
    makeCheck(checks, 'stream sync', 'warn', 'unable to infer stream branch', { currentBranch });
  }

  const nodeModules = checkNodeModules(repoRoot);
  makeCheck(checks, 'node_modules', nodeModules.status, nodeModules.summary, nodeModules.details);

  for (const command of ['bun', 'yarn', 'node']) {
    const result = commandSummary(command);
    makeCheck(checks, command, result.status, result.summary, result.details);
  }

  const github = checkGitHubAuth();
  makeCheck(checks, 'github auth', github.status, github.summary, github.details);

  const railway = checkRailway(repoRoot);
  makeCheck(checks, 'railway', railway.status, railway.summary, railway.details);

  const server = await getWorkspaceServerHealth();
  makeCheck(
    checks,
    'workspace server',
    server.ok ? 'ok' : 'warn',
    server.ok ? 'workspace server health endpoint responding' : 'workspace server health endpoint unavailable',
    server,
  );

  const browser = checkAgentBrowser();
  makeCheck(checks, 'agent-browser', browser.status, browser.summary, browser.details);

  const failures = checks.filter((check) => check.status === 'fail');
  const warnings = checks.filter((check) => check.status === 'warn');
  const result = {
    ok: failures.length === 0,
    cwd,
    repoRoot,
    currentBranch,
    stream,
    summary: {
      checks: checks.length,
      failures: failures.length,
      warnings: warnings.length,
    },
    checks,
  };

  if (args.json) {
    writeLine(JSON.stringify(result, null, 2));
  } else {
    const label = failures.length > 0 ? 'failed' : warnings.length > 0 ? 'warnings' : 'ok';
    writeLine(`doctor: ${label}`);
    writeLine(`repo: ${repoRoot}`);
    writeLine(`branch: ${currentBranch || 'unknown'}`);
    if (stream) writeLine(`stream: ${stream}`);
    writeLine('');

    for (const check of checks) {
      const mark = check.status === 'ok' ? 'ok' : check.status === 'warn' ? 'warn' : 'fail';
      writeLine(`${mark} ${check.name}: ${check.summary}`);
    }
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  writeError(err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});
