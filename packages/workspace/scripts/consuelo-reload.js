#!/usr/bin/env node
// consuelo-reload.js — manage the workspace MCP server reload path
// supports both launchd and direct process modes
const { execSync, spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const LABEL = 'com.consuelo.workspace';
const PLIST = `${process.env.HOME}/Library/LaunchAgents/${LABEL}.plist`;
const HEALTH = 'http://localhost:8850/health';
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const START_SCRIPT = path.join(WORKSPACE_DIR, 'scripts', 'start-brain.sh');
const SERVER_PY = path.join(WORKSPACE_DIR, 'server.py');
const LOG_FILE = '/tmp/workspace.log';

function writeStdout(message = '') { process.stdout.write(`${message}\n`); }
function writeStderr(message = '') { process.stderr.write(`${message}\n`); }

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim(); }
  catch (e) { return e.stdout?.trim() || e.message; }
}

function health() {
  try {
    const r = run(`curl -sf ${HEALTH}`);
    return JSON.parse(r);
  } catch { return null; }
}

function isLaunchdLoaded() {
  const out = run(`launchctl list ${LABEL} 2>/dev/null`);
  return out.includes('PID') || out.includes(LABEL);
}

function findServerPid() {
  const pid = run('pgrep -f "workspace/server.py"');
  return pid && /^\d+$/.test(pid) ? pid : null;
}

function killServer() {
  // kill by pid AND by port to catch stale processes
  const pid = findServerPid();
  const portPid = run('lsof -iTCP:8850 -sTCP:LISTEN -t 2>/dev/null');
  const pids = new Set([pid, portPid].filter(p => p && /^\d+$/.test(p)));

  for (const p of pids) {
    run(`kill ${p}`);
  }
  for (let i = 0; i < 10; i++) {
    if (!findServerPid() && !run('lsof -iTCP:8850 -sTCP:LISTEN -t 2>/dev/null').match(/^\d+$/)) return true;
    run('sleep 0.3');
  }
  for (const p of pids) {
    run(`kill -9 ${p}`);
  }
  return !findServerPid();
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

function waitForHealth(label) {
  for (let i = 0; i < 15; i++) {
    const h = health();
    if (h) {
      writeStdout(`✓ ${label} — ${h.tools} tools, name: ${h.name}`);
      const pid = findServerPid();
      if (pid) writeStdout(`  pid: ${pid}`);
      return true;
    }
    run('sleep 0.5');
  }
  writeStdout(`${label} (health check pending — server may still be starting)`);
  return false;
}

function runReload({ useLaunchd }) {
  if (useLaunchd) {
    run(`launchctl unload ${PLIST} 2>/dev/null`);
    run('sleep 1');
    run(`launchctl load ${PLIST} 2>/dev/null`);
  } else {
    killServer();
    run('sleep 1');
    startDirect();
  }
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
    const h = health();
    if (h) {
      writeStdout(`✓ server running — ${h.tools} tools, name: ${h.name}`);
      const pid = findServerPid();
      if (pid) writeStdout(`  pid: ${pid}`);
      writeStdout(`  mode: ${useLaunchd ? 'launchd' : 'direct'}`);
    } else {
      writeStdout('✗ server not responding');
      const pid = findServerPid();
      if (pid) writeStdout(`  process exists (pid ${pid}) but not healthy`);
    }
    break;
  }

  case 'stop':
    if (useLaunchd) {
      run(`launchctl unload ${PLIST} 2>/dev/null`);
    }
    killServer();
    writeStdout('stopped');
    break;

  case 'start':
    if (findServerPid()) {
      writeStdout('server already running');
      const h = health();
      if (h) writeStdout(`  ✓ healthy — ${h.tools} tools`);
      else writeStdout('  ✗ process exists but not healthy');
      break;
    }
    if (useLaunchd) {
      run(`launchctl load ${PLIST} 2>/dev/null`);
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
    run('sleep 0.5');
    runReload({ useLaunchd: process.env.WORKSPACE_SERVER_RELOAD_LAUNCHD === '1' || useLaunchd });
    if (!process.env.WORKSPACE_SERVER_RELOAD_CHILD) waitForHealth('reloaded');
    break;

  case 'logs':
    try {
      execSync(`tail -50 ${LOG_FILE}`, { stdio: 'inherit' });
    } catch { writeStdout(`no logs at ${LOG_FILE}`); }
    break;

  default:
    writeStderr(`unknown command: ${cmd}`);
    process.exit(1);
}

