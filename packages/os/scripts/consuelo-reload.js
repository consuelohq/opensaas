#!/usr/bin/env node
const { execFileSync, spawn } = require('child_process');
const { existsSync } = require('fs');
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
const EXPECTED_SERVER_NAME = 'consuelo-os';
const CONFLICTING_LABELS = ['com.consuelo.workspace'];

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

function isLaunchdLoaded() {
  const output = runBestEffort('launchctl', ['print', `${LAUNCH_DOMAIN}/${LABEL}`]);
  return output.includes(LABEL) || output.includes('state = running');
}

function findServerPid() {
  return findServerPids()[0] || null;
}

function findServerPids() {
  return parsePids(runBestEffort('pgrep', ['-f', 'packages/os/scripts/server/main.ts|scripts/server/main.ts']));
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

function runReload({ useLaunchd }) {
  if (useLaunchd && existsSync(PLIST)) {
    stopConflictingLaunchAgents();
    runRequired(
      'launchctl',
      ['kickstart', '-k', `${LAUNCH_DOMAIN}/${LABEL}`],
      'launchctl kickstart',
    );
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

function scheduleReload({ useLaunchd }) {
  const child = spawn(process.execPath, [__filename, 'reload-now'], {
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
  writeStdout('usage: bun run consuelo-reload -- [reload|reload-now|status|stop|start|logs]');
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
  case 'restart':
    scheduleReload({ useLaunchd: hasLaunchdPlist });
    break;

  case 'reload-now':
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
