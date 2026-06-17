#!/usr/bin/env node
const { execFileSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const os = require('os');
const path = require('path');

const LABEL = process.env.WORKSPACE_DAEMON_LABEL || 'com.consuelo.system';
const HOME = process.env.HOME || os.homedir();
const PLIST = path.join(HOME, 'Library', 'LaunchAgents', `${LABEL}.plist`);
const PORT = process.env.WORKSPACE_DAEMON_PORT || process.env.CONSUELO_OS_PORT || process.env.PORT || '8850';
const HEALTH = `http://127.0.0.1:${PORT}/health`;
const OS_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(OS_DIR, 'scripts', 'start-brain.sh');
const LOG_FILE = process.env.CONSUELO_DAEMON_LOG_FILE || path.join(HOME, 'Library', 'Logs', 'Consuelo', 'system.log');
const LAUNCH_DOMAIN = `gui/${process.getuid()}`;
const RELOAD_WAIT_ATTEMPTS = Number(process.env.CONSUELO_RELOAD_WAIT_ATTEMPTS || 40);
const EXPECTED_SERVER_NAME = 'consuelo-os';
const CONFLICTING_LABELS = ['com.consuelo.workspace'];

function writeStdout(message = '') { process.stdout.write(`${message}\n`); }
function writeStderr(message = '') { process.stderr.write(`${message}\n`); }

function run(command, args = []) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', timeout: 10000 }).trim();
  } catch (error) {
    return error.stdout?.trim() || error.message;
  }
}

function sleep(seconds) {
  run('sleep', [String(seconds)]);
}

function parsePids(output) {
  return output
    .split(/\s+/)
    .map((pid) => pid.trim())
    .filter((pid) => /^\d+$/.test(pid));
}

function health() {
  try {
    const response = run('curl', ['-sf', HEALTH]);
    return JSON.parse(response);
  } catch {
    return null;
  }
}

function isExpectedHealth(result) {
  return result?.name === EXPECTED_SERVER_NAME;
}

function isLaunchdLoaded() {
  const output = run('launchctl', ['print', `${LAUNCH_DOMAIN}/${LABEL}`]);
  return output.includes(LABEL) || output.includes('state = running');
}

function findServerPid() {
  return findServerPids()[0] || null;
}

function findServerPids() {
  return parsePids(run('pgrep', ['-f', 'packages/os/scripts/server.ts|scripts/server.ts']));
}

function findPortPids() {
  return parsePids(run('lsof', [`-iTCP:${PORT}`, '-sTCP:LISTEN', '-t']));
}

function findRunningPids() {
  return [...new Set([...findServerPids(), ...findPortPids()])];
}

function bootoutLaunchLabel(label) {
  run('launchctl', ['bootout', `${LAUNCH_DOMAIN}/${label}`]);
}

function stopConflictingLaunchAgents() {
  for (const label of CONFLICTING_LABELS) {
    bootoutLaunchLabel(label);
  }
}

function killServer() {
  const pids = findRunningPids();

  for (const pid of pids) run('kill', [pid]);
  for (let index = 0; index < 10; index += 1) {
    if (findRunningPids().length === 0) return true;
    sleep(0.3);
  }
  for (const pid of pids) run('kill', ['-9', pid]);
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
  run('launchctl', ['bootstrap', LAUNCH_DOMAIN, PLIST]);
  run('launchctl', ['kickstart', '-k', `${LAUNCH_DOMAIN}/${LABEL}`]);
}

function runReload({ useLaunchd }) {
  if (useLaunchd && existsSync(PLIST)) {
    bootoutLaunchAgent();
    stopConflictingLaunchAgents();
    killServer();
    sleep(1);
    bootstrapLaunchAgent();
  } else {
    stopConflictingLaunchAgents();
    killServer();
    sleep(1);
    startDirect();
  }
  waitForHealth('reloaded');
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
    if (useLaunchd && existsSync(PLIST)) bootstrapLaunchAgent();
    else startDirect();
    waitForHealth('started');
    break;

  case 'consuelo-reload':
  case 'reload':
  case 'restart':
    scheduleReload({ useLaunchd });
    break;

  case 'reload-now':
  case 'restart-now':
    sleep(0.5);
    runReload({ useLaunchd: process.env.CONSUELO_OS_RELOAD_LAUNCHD === '1' || useLaunchd });
    break;

  case 'logs':
    if (existsSync(LOG_FILE)) spawn('tail', ['-50', LOG_FILE], { stdio: 'inherit' });
    else writeStdout(`no logs at ${LOG_FILE}`);
    break;

  default:
    writeStderr(`unknown command: ${command}`);
    process.exit(1);
}
