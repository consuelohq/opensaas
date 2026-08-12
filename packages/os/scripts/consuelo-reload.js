#!/usr/bin/env node
const { execFileSync, spawn } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const os = require('os');
const path = require('path');

const LABEL = process.env.WORKSPACE_DAEMON_LABEL || 'com.consuelo.system';
const HOME = process.env.HOME || os.homedir();
const PLIST = path.join(HOME, 'Library', 'LaunchAgents', `${LABEL}.plist`);
const PORT = process.env.CONSUELO_OS_PORT || process.env.PORT || process.env.WORKSPACE_DAEMON_PORT || '46321';
const HEALTH = `http://127.0.0.1:${PORT}/health`;
const OS_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(OS_DIR, 'scripts', 'start-consuelo-daemon.sh');
const LOG_FILE = process.env.CONSUELO_DAEMON_LOG_FILE || path.join(HOME, 'Library', 'Logs', 'Consuelo', 'system.log');
const LAUNCH_DOMAIN = `gui/${process.getuid()}`;
const RELOAD_WAIT_ATTEMPTS = Number(process.env.CONSUELO_RELOAD_WAIT_ATTEMPTS || 40);
const RELOAD_POLL_MS = 500;
const EXPECTED_SERVER_NAME = 'consuelo-os';
const CONFLICTING_LABELS = ['com.consuelo.workspace'];
const CONSUELO_HOME = process.env.CONSUELO_HOME || path.join(HOME, '.consuelo');
const WORKER_POOL_STATE = path.join(CONSUELO_HOME, 'node', 'runs', 'os-worker-pool.json');

function writeStdout(message = '') { process.stdout.write(`${message}\n`); }
function writeStderr(message = '') { process.stderr.write(`${message}\n`); }

function runBestEffort(command, args = []) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return error.stdout?.trim() || '';
  }
}

function runRequired(command, args, label) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    const detail = error.stderr?.trim() || error.stdout?.trim() || '';
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`);
  }
}

function sleep(seconds) {
  runBestEffort('sleep', [String(seconds)]);
}

function parsePids(output) {
  return output
    .split(/\s+/)
    .map((pid) => pid.trim())
    .filter((pid) => /^\d+$/.test(pid));
}

function health() {
  try {
    const response = runBestEffort('curl', ['-sf', HEALTH]);
    return JSON.parse(response);
  } catch {
    return null;
  }
}

function isExpectedHealth(result) {
  return result?.name === EXPECTED_SERVER_NAME;
}

function workerPoolState() {
  try {
    const parsed = JSON.parse(readFileSync(WORKER_POOL_STATE, 'utf8'));
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.workers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWorkerPoolStatus() {
  const pool = workerPoolState();
  if (!pool) return;
  const ready = pool.workers.filter((worker) => worker?.state === 'ready').length;
  writeStdout(`  workers: ${ready}/${pool.desiredWorkers} ready`);
  for (const worker of pool.workers) {
    const pid = worker?.pid ? ` pid=${worker.pid}` : '';
    writeStdout(`    ${worker.workerId}: ${worker.state} port=${worker.port}${pid} restarts=${worker.restartCount ?? 0}`);
  }
}

function isLaunchdLoaded() {
  try {
    execFileSync('launchctl', ['print', `${LAUNCH_DOMAIN}/${LABEL}`], {
      timeout: 10000,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function findServerPid() {
  return findServerPids()[0] || null;
}

function findServerPids() {
  return parsePids(runBestEffort('pgrep', ['-f', 'packages/os/scripts/server/supervisor.ts|scripts/server/supervisor.ts|packages/os/scripts/server/main.ts|scripts/server/main.ts']));
}

function findPortPids() {
  return parsePids(runBestEffort('lsof', [`-iTCP:${PORT}`, '-sTCP:LISTEN', '-t']));
}

function findLaunchLabelPid(label) {
  const output = runBestEffort('launchctl', ['print', `${LAUNCH_DOMAIN}/${label}`]);
  const match = output.match(/\bpid\s*=\s*(\d+)/);
  return match?.[1] || null;
}

function findRunningPids() {
  return [...new Set([...findServerPids(), ...findPortPids()])];
}

function bootoutLaunchLabel(label) {
  runBestEffort('launchctl', ['bootout', `${LAUNCH_DOMAIN}/${label}`]);
}

function stopConflictingLaunchAgents() {
  const portPids = new Set(findPortPids());
  for (const label of CONFLICTING_LABELS) {
    const pid = findLaunchLabelPid(label);
    if (pid && portPids.has(pid)) {
      bootoutLaunchLabel(label);
    }
  }
}

function killServer() {
  const pids = findRunningPids();

  for (const pid of pids) runBestEffort('kill', [pid]);
  for (let index = 0; index < 10; index += 1) {
    if (findRunningPids().length === 0) return true;
    sleep(0.3);
  }
  for (const pid of pids) runBestEffort('kill', ['-9', pid]);
  return findRunningPids().length === 0;
}

function startDirect() {
  spawn('bash', [START_SCRIPT], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    cwd: OS_DIR,
    env: process.env,
  }).unref();
}

function waitForHealth(label, attempts = RELOAD_WAIT_ATTEMPTS) {
  let wrongServerName = null;
  for (let index = 0; index < attempts; index += 1) {
    const result = health();
    if (isExpectedHealth(result)) {
      writeStdout(`${label}: healthy`);
      const pids = findRunningPids();
      if (pids.length) writeStdout(`  pid: ${pids.join(', ')}`);
      writeStdout(`  health: ${HEALTH}`);
      return true;
    }
    if (result?.name && result.name !== EXPECTED_SERVER_NAME) wrongServerName = result.name;
    sleep(0.5);
  }
  if (wrongServerName) {
    writeStdout(`${label}: wrong server "${wrongServerName}" is answering ${HEALTH}; expected ${EXPECTED_SERVER_NAME}`);
  }
  writeStdout(`${label}: health check pending`);
  return false;
}

function bootoutLaunchAgent() {
  bootoutLaunchLabel(LABEL);
}

function bootstrapLaunchAgent() {
  runRequired('launchctl', ['bootstrap', LAUNCH_DOMAIN, PLIST], 'launchctl bootstrap');
  runRequired('launchctl', ['kickstart', '-k', `${LAUNCH_DOMAIN}/${LABEL}`], 'launchctl kickstart');
}

function isHealthyRollingPool(pool) {
  return Boolean(
    pool
    && Number.isInteger(pool.supervisorPid)
    && pool.supervisorPid > 0
    && Number.isInteger(pool.desiredWorkers)
    && pool.desiredWorkers > 0
    && pool.workers.length === pool.desiredWorkers
    && pool.workers.every((worker) =>
      worker
      && worker.state === 'ready'
      && typeof worker.workerInstanceId === 'string'
      && worker.workerInstanceId.length > 0
      && Number.isInteger(worker.pid)
      && worker.pid > 0
    )
  );
}

function rollingReloadWaitAttempts(before) {
  const configuredDrainTimeout = Number(process.env.CONSUELO_OS_DRAIN_TIMEOUT_MS || 30_000);
  const drainTimeoutMs = Number.isInteger(configuredDrainTimeout)
    && configuredDrainTimeout >= 0
    && configuredDrainTimeout <= 300_000
    ? configuredDrainTimeout
    : 30_000;
  const desiredWorkers = Number.isInteger(before?.desiredWorkers) && before.desiredWorkers > 0
    ? before.desiredWorkers
    : 1;
  const derivedAttempts = Math.ceil(
    (desiredWorkers * Math.max(60_000, drainTimeoutMs + 20_000)) / RELOAD_POLL_MS,
  );
  return Math.max(RELOAD_WAIT_ATTEMPTS, derivedAttempts);
}

function waitForRollingReload(before, attempts = rollingReloadWaitAttempts(before)) {
  const previousInstances = new Map(
    before.workers.map((worker) => [worker.workerId, worker.workerInstanceId]),
  );
  for (let index = 0; index < attempts; index += 1) {
    const current = workerPoolState();
    if (
      isHealthyRollingPool(current)
      && current.supervisorPid === before.supervisorPid
      && current.workers.every((worker) =>
        previousInstances.get(worker.workerId) !== worker.workerInstanceId
      )
    ) return true;
    sleep(RELOAD_POLL_MS / 1000);
  }
  return false;
}

function tryRollingReload() {
  if (process.platform === 'win32') return false;
  const pool = workerPoolState();
  if (!isHealthyRollingPool(pool)) return false;
  const supervisorPid = String(pool.supervisorPid);
  if (!findServerPids().includes(supervisorPid)) return false;
  runRequired('kill', ['-USR2', supervisorPid], 'rolling worker reload signal');
  if (!waitForRollingReload(pool)) {
    throw new Error('Consuelo OS worker pool did not complete rolling reload.');
  }
  if (!waitForHealth('reloaded', 1)) {
    throw new Error('Consuelo OS did not remain healthy after rolling reload.');
  }
  return true;
}

function runReload({ useLaunchd }) {
  if (useLaunchd && existsSync(PLIST)) {
    stopConflictingLaunchAgents();
    if (isLaunchdLoaded()) {
      runRequired(
        'launchctl',
        ['kickstart', '-k', `${LAUNCH_DOMAIN}/${LABEL}`],
        'launchctl kickstart',
      );
    } else {
      bootstrapLaunchAgent();
    }
  } else {
    stopConflictingLaunchAgents();
    killServer();
    sleep(1);
    startDirect();
  }
  if (!waitForHealth('reloaded')) {
    throw new Error('Consuelo OS did not become healthy after reload.');
  }
}

function scheduleReload({ useLaunchd, command = 'reload-now' }) {
  const child = spawn(process.execPath, [__filename, command], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    cwd: OS_DIR,
    env: {
      ...process.env,
      CONSUELO_OS_RELOAD_CHILD: '1',
      CONSUELO_OS_RELOAD_LAUNCHD: useLaunchd ? '1' : '0',
    },
  });
  child.unref();
  writeStdout('Consuelo OS reload scheduled');
  writeStdout('check with: bun run consuelo-reload -- status');
}

const args = process.argv.slice(2);
if (args.includes('--help')) {
  writeStdout('usage: bun run consuelo-reload -- [reload|reload-now|restart|restart-now|status|stop|start|logs]');
  writeStdout('manages the local Consuelo OS Bun server and user LaunchAgent.');
  process.exit(0);
}

const command = args[0] || 'reload';
const useLaunchd = isLaunchdLoaded();
const hasLaunchdPlist = existsSync(PLIST);

try {
switch (command) {
  case 'status': {
    const shouldWaitForLaunchd = useLaunchd && existsSync(PLIST);
    const result = health() || (findRunningPids().length || shouldWaitForLaunchd ? (waitForHealth('server starting', 20) ? health() : null) : null);
    if (isExpectedHealth(result)) {
      writeStdout('server running');
      const pids = findRunningPids();
      if (pids.length) writeStdout(`  pid: ${pids.join(', ')}`);
      writeStdout(`  mode: ${useLaunchd ? 'launchd' : 'direct'}`);
      writeStdout(`  health: ${HEALTH}`);
      writeWorkerPoolStatus();
    } else {
      writeStdout('server not responding');
      if (result?.name) writeStdout(`  wrong server responding: ${result.name} (expected ${EXPECTED_SERVER_NAME})`);
      const pids = findRunningPids();
      if (pids.length) writeStdout(`  process exists (pid ${pids.join(', ')}) but is not healthy`);
    }
    break;
  }

  case 'stop':
    if (useLaunchd) bootoutLaunchAgent();
    killServer();
    writeStdout('stopped');
    break;

  case 'start':
    if (findRunningPids().length) {
      writeStdout('server already running');
      break;
    }
    if (hasLaunchdPlist) {
      if (useLaunchd) {
        runRequired('launchctl', ['kickstart', '-k', `${LAUNCH_DOMAIN}/${LABEL}`], 'launchctl kickstart');
      } else {
        bootstrapLaunchAgent();
      }
    } else {
      startDirect();
    }
    if (!waitForHealth('started')) {
      throw new Error('Consuelo OS did not become healthy after start.');
    }
    break;

  case 'consuelo-reload':
  case 'reload':
    scheduleReload({ useLaunchd: hasLaunchdPlist, command: 'reload-now' });
    break;

  case 'restart':
    scheduleReload({ useLaunchd: hasLaunchdPlist, command: 'restart-now' });
    break;

  case 'reload-now':
    sleep(0.5);
    if (!tryRollingReload()) {
      runReload({ useLaunchd: process.env.CONSUELO_OS_RELOAD_LAUNCHD === '1' || hasLaunchdPlist });
    }
    break;

  case 'restart-now':
    sleep(0.5);
    runReload({ useLaunchd: process.env.CONSUELO_OS_RELOAD_LAUNCHD === '1' || hasLaunchdPlist });
    break;

  case 'logs':
    if (existsSync(LOG_FILE)) spawn('tail', ['-50', LOG_FILE], { stdio: 'inherit' });
    else writeStdout(`no logs at ${LOG_FILE}`);
    break;

  default:
    writeStderr(`unknown command: ${command}`);
    process.exit(1);
}
} catch (error) {
  writeStderr(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
