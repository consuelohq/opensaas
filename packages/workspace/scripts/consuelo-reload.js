#!/usr/bin/env node
// consuelo-reload.js — manage the workspace MCP server reload path
// supports both launchd and direct process modes
const { execFileSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const os = require('os');
const path = require('path');

const LABEL = 'com.consuelo.workspace';
const HOME = process.env.HOME || os.homedir();
const PLIST = path.join(HOME, 'Library', 'LaunchAgents', `${LABEL}.plist`);
const PORT = process.env.WORKSPACE_DAEMON_PORT || process.env.PORT || '8850';
const HEALTH = `http://127.0.0.1:${PORT}/health`;
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(WORKSPACE_DIR, 'scripts', 'start-brain.sh');
const SERVER_PY = path.join(WORKSPACE_DIR, 'server.py');
const LOG_FILE = '/tmp/workspace.log';
const LAUNCH_DOMAIN = `gui/${process.getuid()}`;
const RELOAD_WAIT_ATTEMPTS = Number(process.env.CONSUELO_RELOAD_WAIT_ATTEMPTS || 40);
const EXPECTED_SERVER_NAME = 'openworkspace';
const CONFLICTING_LABELS = ['com.consuelo.system'];

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
    const r = run('curl', ['-sf', HEALTH]);
    return JSON.parse(r);
  } catch { return null; }
}

function isExpectedHealth(result) {
  return result?.name === EXPECTED_SERVER_NAME;
}

function isLaunchdLoaded() {
  const output = run('launchctl', ['print', `${LAUNCH_DOMAIN}/${LABEL}`]);
  return output.includes(LABEL) || output.includes('state = running');
}

function findServerPids() {
  return parsePids(run('pgrep', ['-f', 'packages/workspace/server.py|workspace/server.py']));
}

function findPortPids() {
  return parsePids(run('lsof', [`-iTCP:${PORT}`, '-sTCP:LISTEN', '-t']));
}

function findServerPid() {
  return findServerPids()[0] || null;
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

  for (const p of pids) {
    run('kill', [p]);
  }
  for (let i = 0; i < 10; i++) {
    if (findRunningPids().length === 0) return true;
    sleep(0.3);
  }
  for (const p of pids) {
    run('kill', ['-9', p]);
  }
  return findRunningPids().length === 0;
}

function startDirect() {
  if (existsSync(START_SCRIPT)) {
    spawn('bash', [START_SCRIPT], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      cwd: WORKSPACE_DIR,
    }).unref();
  } else {
    // fallback: start server.py directly with .env
    const envFile = path.join(WORKSPACE_DIR, '.env');
    const env = { ...process.env };
    if (existsSync(envFile)) {
      const content = require('fs').readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z_]+)=(.+)/);
        if (match) env[match[1]] = match[2].trim();
      }
    }
    const python = path.join(WORKSPACE_DIR, '.venv', 'bin', 'python');
    const pythonBin = existsSync(python) ? python : 'python3';
    spawn(pythonBin, [SERVER_PY], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      cwd: WORKSPACE_DIR,
      env,
    }).unref();
  }
}

function waitForHealth(label, attempts = RELOAD_WAIT_ATTEMPTS) {
  let wrongServerName = null;
  for (let i = 0; i < attempts; i++) {
    const h = health();
    if (isExpectedHealth(h)) {
      writeStdout(`✓ ${label} — ${h.tools} tools, name: ${h.name}`);
      const pids = findRunningPids();
      if (pids.length) writeStdout(`  pid: ${pids.join(', ')}`);
      writeStdout(`  health: ${HEALTH}`);
      return true;
    }
    if (h?.name && h.name !== EXPECTED_SERVER_NAME) wrongServerName = h.name;
    sleep(0.5);
  }
  if (wrongServerName) {
    writeStdout(`${label} (wrong server "${wrongServerName}" is answering ${HEALTH}; expected ${EXPECTED_SERVER_NAME})`);
  }
  writeStdout(`${label} (health check pending — server may still be starting)`);
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
    cwd: WORKSPACE_DIR,
    env: {
      ...process.env,
      WORKSPACE_SERVER_RELOAD_CHILD: '1',
      WORKSPACE_SERVER_RELOAD_LAUNCHD: useLaunchd ? '1' : '0',
    },
  });
  child.unref();
  writeStdout('consuelo reload scheduled');
  writeStdout('  workspace will briefly disconnect while launchd reloads it');
  writeStdout('  check with: bun run consuelo-reload -- status');
}

// --- main ---

const args = process.argv.slice(2);
if (args.includes('--help')) {
  writeStdout('usage: bun run consuelo-reload -- [consuelo-reload|reload|reload-now|status|stop|start|logs]');
  writeStdout('');
  writeStdout('  consuelo-reload  schedule a safe async reload of the workspace MCP server (default)');
  writeStdout('  reload           alias for consuelo-reload');
  writeStdout('  restart          legacy alias for consuelo-reload');
  writeStdout('  reload-now       stop + start immediately; intended for detached reload children');
  writeStdout('  status       show server health and process info');
  writeStdout('  stop         stop the server');
  writeStdout('  start        start the server');
  writeStdout('  logs         tail server logs');
  writeStdout('');
  writeStdout('uses launchd if the agent is loaded, otherwise manages the process directly.');
  writeStdout('consuelo-reload returns before the server stops so MCP callers do not drop their response.');
  process.exit(0);
}

const cmd = args[0] || 'consuelo-reload';
const useLaunchd = isLaunchdLoaded();
switch (cmd) {
  case 'status': {
    const shouldWaitForLaunchd = useLaunchd && existsSync(PLIST);
    const h = health() || (findRunningPids().length || shouldWaitForLaunchd ? (waitForHealth('server starting', 20) ? health() : null) : null);
    if (isExpectedHealth(h)) {
      writeStdout(`✓ server running — ${h.tools} tools, name: ${h.name}`);
      const pids = findRunningPids();
      if (pids.length) writeStdout(`  pid: ${pids.join(', ')}`);
      writeStdout(`  mode: ${useLaunchd ? 'launchd' : 'direct'}`);
      writeStdout(`  health: ${HEALTH}`);
    } else {
      writeStdout('✗ server not responding');
      if (h?.name) writeStdout(`  wrong server responding: ${h.name} (expected ${EXPECTED_SERVER_NAME})`);
      const pids = findRunningPids();
      if (pids.length) writeStdout(`  process exists (pid ${pids.join(', ')}) but not healthy`);
    }
    break;
  }

  case 'stop':
    if (useLaunchd) {
      bootoutLaunchAgent();
    }
    killServer();
    writeStdout('stopped');
    break;

  case 'start':
    if (findRunningPids().length) {
      writeStdout('server already running');
      const h = health();
      if (h) writeStdout(`  ✓ healthy — ${h.tools} tools`);
      else writeStdout('  ✗ process exists but not healthy');
      break;
    }
    if (useLaunchd && existsSync(PLIST)) {
      bootstrapLaunchAgent();
    } else {
      startDirect();
    }
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
    runReload({ useLaunchd: process.env.WORKSPACE_SERVER_RELOAD_LAUNCHD === '1' || useLaunchd });
    break;

  case 'logs':
    if (existsSync(LOG_FILE)) spawn('tail', ['-50', LOG_FILE], { stdio: 'inherit' });
    else writeStdout(`no logs at ${LOG_FILE}`);
    break;

  default:
    writeStderr(`unknown command: ${cmd}`);
    process.exit(1);
}
